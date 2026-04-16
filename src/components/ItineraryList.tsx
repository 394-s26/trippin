import { useState, useCallback } from 'react';
import EventCard from './EventCard';
import { PlusIcon, ChevronsUpDownIcon } from '../services/svgIcons';
import { Day } from '../types/day';
import { Event } from '../types/event';
import { AppUser } from '../types/auth';
import { UserSelection } from '../hooks/useSessionSelections';
import './ItineraryList.css';

// ─── Constants ────────────────────────────────────────────────────────────────
const HOUR_HEIGHT = 64;       // px per hour
const TOTAL_HOURS = 24;
const DEFAULT_START = 9;      // 9 AM — always shown
const DEFAULT_END = 19;       // 7 PM — always shown (exclusive upper bound)
const GAP_THRESHOLD = 4;      // consecutive empty hours within 9–7 PM before collapsing

// ─── Helpers ──────────────────────────────────────────────────────────────────
const minutesToY = (minutes: number) => minutes * (HOUR_HEIGHT / 60);
const dateToMinutes = (d: Date) => d.getHours() * 60 + d.getMinutes();

const formatHour = (h: number) => {
  if (h === 0) return '12 AM';
  if (h < 12) return `${h} AM`;
  if (h === 12) return '12 PM';
  return `${h - 12} PM`;
};

// ─── Segment types ────────────────────────────────────────────────────────────
type ExpandedSeg  = { type: 'expanded';  startHour: number; endHour: number };
type CollapsedSeg = { type: 'collapsed'; startHour: number; endHour: number; key: string };
type Segment = ExpandedSeg | CollapsedSeg;

function segKey(dayId: string, startH: number, endH: number) {
  return `${dayId}:${startH}-${endH}`;
}

function buildDaySegments(day: Day, expandedKeys: Set<string>): Segment[] {
  // Pre-compute each event's [startMin, endMin) in minutes since midnight, sorted by start.
  const eventRanges = day.events
    .map(e => {
      const startMin = e.hasTime !== false ? dateToMinutes(e.startDate) : 0;
      const durMin = e.endDate && e.hasTime !== false
        ? Math.max(30, (e.endDate.getTime() - e.startDate.getTime()) / 60000)
        : 30;
      return { startMin, endMin: startMin + durMin };
    })
    .sort((a, b) => a.startMin - b.startMin);

  // Which individual hours contain at least part of an event?
  const hasEvent = new Array(24).fill(false);
  for (const { startMin, endMin } of eventRanges) {
    const startH = Math.floor(startMin / 60);
    // Last hour touched: if the event ends exactly on an hour boundary don't
    // claim that next hour; otherwise floor to the partial hour.
    const endH = endMin % 60 === 0
      ? Math.max(startH, endMin / 60 - 1)
      : Math.floor(endMin / 60);
    for (let h = startH; h <= Math.min(23, endH); h++) hasEvent[h] = true;
  }

  // Base visibility: default range (9 AM–7 PM) + any hour that has an event.
  const visible = Array.from({ length: 24 }, (_, h) =>
    hasEvent[h] || (h >= DEFAULT_START && h < DEFAULT_END)
  );

  // Adjust visibility based on the gap between each consecutive pair of events.
  // Rules:
  //  • gap ≤ 2 h  → force all hours in the gap visible (even outside default range)
  //  • gap ≥ 4 h  → collapse gap hours that fall inside the default range
  //  • 2 < gap < 4 → leave as-is (default range visible, outside collapsed)
  for (let i = 0; i < eventRanges.length - 1; i++) {
    const gapStartMin = eventRanges[i].endMin;
    const gapEndMin   = eventRanges[i + 1].startMin;
    if (gapEndMin <= gapStartMin) continue; // events overlap — no gap

    const gapHours  = (gapEndMin - gapStartMin) / 60;
    // First hour that is fully inside the gap; last hour (exclusive) of the gap.
    const gapStartH = Math.ceil(gapStartMin / 60);
    const gapEndH   = Math.floor(gapEndMin / 60);

    if (gapHours <= 2) {
      // Short gap: always show the hours between these two events.
      for (let h = gapStartH; h < gapEndH; h++) {
        if (h >= 0 && h < 24) visible[h] = true;
      }
    } else if (gapHours >= GAP_THRESHOLD) {
      // Long gap: collapse the portion of this gap that sits inside 9 AM–7 PM.
      // Hours before 9 AM or after 7 PM are already collapsed by the base rule.
      for (let h = Math.max(DEFAULT_START, gapStartH); h < Math.min(DEFAULT_END, gapEndH); h++) {
        if (!hasEvent[h]) visible[h] = false;
      }
    }
  }

  // Build the segment list from the visibility array.
  const segments: Segment[] = [];
  let h = 0;
  while (h < 24) {
    if (visible[h]) {
      let end = h + 1;
      while (end < 24 && visible[end]) end++;
      segments.push({ type: 'expanded', startHour: h, endHour: end });
      h = end;
    } else {
      let end = h + 1;
      while (end < 24 && !visible[end]) end++;
      const key = segKey(day.id, h, end);
      segments.push(
        expandedKeys.has(key)
          ? { type: 'expanded', startHour: h, endHour: end }
          : { type: 'collapsed', startHour: h, endHour: end, key }
      );
      h = end;
    }
  }

  return segments;
}

// ─── Overlap layout ───────────────────────────────────────────────────────────
interface EventLayout { left: string; width: string; zIndex: number; }

function computeLayout(events: Event[]): Map<string, EventLayout> {
  const result = new Map<string, EventLayout>();
  if (events.length === 0) return result;

  const sorted = [...events].sort((a, b) => {
    const aMin = a.hasTime !== false ? dateToMinutes(a.startDate) : 0;
    const bMin = b.hasTime !== false ? dateToMinutes(b.startDate) : 0;
    return aMin - bMin;
  });

  const endMinutes = (e: Event): number => {
    if (e.hasTime === false) return 30;
    const start = dateToMinutes(e.startDate);
    const dur = e.endDate
      ? Math.max(30, (e.endDate.getTime() - e.startDate.getTime()) / 60000)
      : 30;
    return start + dur;
  };

  const groups: string[][] = [];
  const assignedGroup = new Map<string, number>();

  for (const ev of sorted) {
    const evStart = ev.hasTime !== false ? dateToMinutes(ev.startDate) : 0;
    const evEnd = endMinutes(ev);
    let placed = false;
    for (let gi = 0; gi < groups.length; gi++) {
      const groupEndMax = Math.max(...groups[gi].map(id => endMinutes(events.find(x => x.id === id)!)));
      const groupStartMin = Math.min(...groups[gi].map(id => {
        const e = events.find(x => x.id === id)!;
        return e.hasTime !== false ? dateToMinutes(e.startDate) : 0;
      }));
      if (evStart < groupEndMax && evEnd > groupStartMin) {
        groups[gi].push(ev.id);
        assignedGroup.set(ev.id, gi);
        placed = true;
        break;
      }
    }
    if (!placed) {
      assignedGroup.set(ev.id, groups.length);
      groups.push([ev.id]);
    }
  }

  for (const group of groups) {
    if (group.length === 1) {
      result.set(group[0], { left: '0%', width: '100%', zIndex: 1 });
    } else {
      const colEndTime: number[] = [];
      for (const id of group) {
        const ev = events.find(x => x.id === id)!;
        const evStart = ev.hasTime !== false ? dateToMinutes(ev.startDate) : 0;
        const evEnd = endMinutes(ev);
        let col = -1;
        for (let c = 0; c < Math.min(colEndTime.length, 2); c++) {
          if (colEndTime[c] <= evStart) { col = c; break; }
        }
        if (col === -1 && colEndTime.length < 2) col = colEndTime.length;
        if (col === -1) col = 1;
        if (col >= colEndTime.length) colEndTime.push(evEnd);
        else colEndTime[col] = Math.max(colEndTime[col], evEnd);
        const left = col === 0 ? '0%' : '50%';
        const existingInCol1 = [...result.values()].filter(v => v.left === '50%').length;
        result.set(id, { left, width: '50%', zIndex: col === 1 ? 2 + existingInCol1 : 1 });
      }
    }
  }

  return result;
}

// ─── Props ────────────────────────────────────────────────────────────────────
interface ItineraryListProps {
  days: Day[];
  onAddEvent?: (day: Day, time?: Date) => void;
  selectedEventIds?: string[];
  onSelectEvent?: (eventId: string) => void;
  allSelections?: UserSelection[];
  currentUserId?: string;
  tripUsers?: AppUser[];
  canAddEvent?: boolean;
}

// ─── Component ────────────────────────────────────────────────────────────────
const ItineraryList = ({
  days,
  onAddEvent,
  selectedEventIds = [],
  onSelectEvent,
  allSelections = [],
  currentUserId,
  tripUsers = [],
  canAddEvent = false,
}: ItineraryListProps) => {
  const [hoverState, setHoverState] = useState<{ dayId: string; minutes: number } | null>(null);
  const [expandedSegmentKeys, setExpandedSegmentKeys] = useState<Set<string>>(new Set());

  const totalEvents = days.reduce((s, d) => s + d.events.length, 0);

  const snapToInterval = (minutes: number, intervalMin = 15) =>
    Math.round(minutes / intervalMin) * intervalMin;

  const toggleSegment = (key: string) => {
    setExpandedSegmentKeys(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  // segmentStartHour converts relative Y → absolute minutes since midnight
  const handleGridMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>, day: Day, segmentStartHour: number) => {
      const target = e.target as HTMLElement;
      if (target.closest('[data-event-id]')) { setHoverState(null); return; }
      const rect = e.currentTarget.getBoundingClientRect();
      const rawMinutes = segmentStartHour * 60 + (e.clientY - rect.top) / HOUR_HEIGHT * 60;
      const snapped = Math.min(Math.max(snapToInterval(rawMinutes), 0), TOTAL_HOURS * 60 - 30);
      setHoverState({ dayId: day.id, minutes: snapped });
    },
    []
  );

  const handleGridMouseLeave = useCallback(() => setHoverState(null), []);

  const handleGridClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>, day: Day, segmentStartHour: number) => {
      if (!canAddEvent) return;
      const target = e.target as HTMLElement;
      if (target.closest('[data-event-id]')) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const rawMinutes = segmentStartHour * 60 + (e.clientY - rect.top) / HOUR_HEIGHT * 60;
      const snapped = Math.min(Math.max(snapToInterval(rawMinutes), 0), TOTAL_HOURS * 60 - 30);
      const clickedTime = new Date(day.date);
      clickedTime.setHours(Math.floor(snapped / 60), snapped % 60, 0, 0);
      onAddEvent?.(day, clickedTime);
    },
    [canAddEvent, onAddEvent]
  );

  return (
    <div className="itinerary-list">
      {days.map((day, index) => {
        const layout = computeLayout(day.events);
        const isHovered = hoverState?.dayId === day.id;
        const showStaticGhost = totalEvents === 0 && index === 0;
        const segments = buildDaySegments(day, expandedSegmentKeys);

        return (
          <div key={day.id} className="cal-day">
            {/* Day header: number + divider line */}
            <div className="cal-day-header">
              <div className="cal-day-num-col">
                <span className="cal-day-number">{index + 1}</span>
              </div>
              <div className="cal-day-header-line" />
            </div>

            {/* Segments (indented past the day-number column) */}
            <div className="cal-segments">
              {segments.map(segment => {
                if (segment.type === 'collapsed') {
                  const count = segment.endHour - segment.startHour;
                  return (
                    <div key={segment.key} className="cal-segment-row">
                      <div className="cal-labels-spacer" />
                      <button
                        className="cal-collapsed-bar"
                        onClick={() => toggleSegment(segment.key)}
                        aria-label={`Expand ${count} collapsed hours`}
                      >
                        <ChevronsUpDownIcon size={11} />
                        <span>+{count} hour{count !== 1 ? 's' : ''}</span>
                      </button>
                    </div>
                  );
                }

                // ── Expanded segment ──────────────────────────────────────
                const segHours  = segment.endHour - segment.startHour;
                const segHeight = segHours * HOUR_HEIGHT;
                const hourRange = Array.from({ length: segHours }, (_, i) => segment.startHour + i);

                // Events whose start falls within this segment's hour range
                const segEvents = day.events.filter(e => {
                  const h = e.hasTime !== false ? e.startDate.getHours() : 0;
                  return h >= segment.startHour && h < segment.endHour;
                });

                const ghostInThisSeg =
                  isHovered &&
                  hoverState !== null &&
                  hoverState.minutes >= segment.startHour * 60 &&
                  hoverState.minutes <  segment.endHour   * 60;

                const staticGhostInThisSeg =
                  showStaticGhost &&
                  !isHovered &&
                  segment.startHour <= 9 &&
                  segment.endHour   >  9;

                return (
                  <div key={`${segment.startHour}-${segment.endHour}`} className="cal-segment-row">
                    {/* Hour labels */}
                    <div className="cal-labels" style={{ height: segHeight }}>
                      {hourRange.map(h => (
                        <div
                          key={h}
                          className="cal-label"
                          style={{ top: (h - segment.startHour) * HOUR_HEIGHT }}
                        >
                          {formatHour(h)}
                        </div>
                      ))}
                    </div>

                    {/* Grid */}
                    <div
                      className={`cal-grid${canAddEvent ? ' cal-grid--interactive' : ''}`}
                      style={{ height: segHeight }}
                      onMouseMove={canAddEvent ? e => handleGridMouseMove(e, day, segment.startHour) : undefined}
                      onMouseLeave={canAddEvent ? handleGridMouseLeave : undefined}
                      onClick={canAddEvent ? e => handleGridClick(e, day, segment.startHour) : undefined}
                    >
                      {/* Hour lines */}
                      {hourRange.map((h, i) => (
                        <div key={h} className="cal-hour-line" style={{ top: i * HOUR_HEIGHT }} />
                      ))}

                      {/* Events */}
                      {segEvents.map(event => {
                        const evLayout = layout.get(event.id) ?? { left: '0%', width: '100%', zIndex: 1 };
                        const startMin   = event.hasTime !== false ? dateToMinutes(event.startDate) : 0;
                        const relMin     = startMin - segment.startHour * 60;
                        const durMin     = event.endDate
                          ? Math.max(30, (event.endDate.getTime() - event.startDate.getTime()) / 60000)
                          : 30;
                        const wrapperHeight = minutesToY(durMin);
                        return (
                          <div
                            key={event.id}
                            className="cal-event-wrapper"
                            style={{
                              top:    minutesToY(relMin),
                              height: wrapperHeight,
                              left:   evLayout.left,
                              width:  evLayout.width,
                              zIndex: evLayout.zIndex,
                            }}
                          >
                            <EventCard
                              event={event}
                              heightPx={wrapperHeight}
                              onSelect={() => onSelectEvent?.(event.id)}
                              isSelected={selectedEventIds.includes(event.id)}
                              allSelections={allSelections}
                              currentUserId={currentUserId}
                              tripUsers={tripUsers}
                            />
                          </div>
                        );
                      })}

                      {/* Static ghost: 9 AM on day 1 when trip is empty */}
                      {staticGhostInThisSeg && (
                        <div
                          className="ghost-event ghost-event--static"
                          style={{
                            top:    minutesToY(9 * 60 - segment.startHour * 60),
                            height: minutesToY(30),
                          }}
                        >
                          <PlusIcon size={12} />
                          <span>Add Event</span>
                        </div>
                      )}

                      {/* Hover ghost */}
                      {ghostInThisSeg && hoverState && (
                        <div
                          className="ghost-event"
                          style={{
                            top:    minutesToY(hoverState.minutes - segment.startHour * 60),
                            height: minutesToY(30),
                          }}
                        >
                          <PlusIcon size={12} />
                          <span>Add Event</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Empty state */}
      {days.length === 0 && (
        <div className="empty-trip-hint">
          <p className="empty-trip-text">Your awesome trip is looking empty…</p>
          <span className="empty-trip-caret">&#8964;</span>
        </div>
      )}
    </div>
  );
};

export default ItineraryList;
