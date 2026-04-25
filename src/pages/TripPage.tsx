import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import TripBanner from '../components/TripBanner';
import ItineraryList from '../components/ItineraryList';
import EventFormModal from '../components/EventFormModal';
import BudgetModal from '../components/BudgetModal';
import TripShareBar from '../components/TripShareBar';
import { SelectionActionBar } from '../components/SelectionActionBar';
import { TripDateModal } from '../components/TripDateModal';
import { Event, SuggestionVote } from '../types/event';
import { Day } from '../types/day';
import { AppUser } from '../types/auth';
import useTrip from '../hooks/useTrip';
import { useDays } from '../hooks/useDays';
import useItinerary from '../hooks/useItinerary';
import { useSessionSelections } from '../hooks/useSessionSelections';
import { useEventLock } from '../hooks/useEventLock';
import { createEvent, deleteEvent, updateEvent, acquireEventLock, releaseEventLock, suggestEventDeletion, voteOnSuggestion, resolveSuggestionByVote } from '../services/firestoreEventsService';
import { eventOverlapsDay, sliceEventForDay } from '../utilities/eventOverlapsDay';
import { EVENT_CATEGORY } from '../types/event';
import { useAuth } from '../contexts/AuthContext';
import { useLastViewedTrip } from '../contexts/LastViewedTripContext';
import './Home.css';

const formatDateRange = (days: Omit<Day, 'events'>[], fallbackStart?: Date, fallbackEnd?: Date): string => {
  const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  if (fallbackStart && fallbackEnd) {
    return `${fmt(fallbackStart)} — ${fmt(fallbackEnd)}`;
  }
  if (days.length === 0) {
    return fallbackStart ? fmt(fallbackStart) : '';
  }
  return `${fmt(days[0].date)} — ${fmt(days[days.length - 1].date)}`;
};

const sameCalendarDay = (a: Date, b: Date): boolean =>
  a.getFullYear() === b.getFullYear()
  && a.getMonth() === b.getMonth()
  && a.getDate() === b.getDate();

const getDayBounds = (d: Date) => {
  const start = new Date(d);
  start.setHours(0, 0, 0, 0);
  const end = new Date(d);
  end.setHours(23, 59, 59, 999);
  return { start, end };
};

const LODGING_SUFFIX_REGEX = /\s+\((Check-in|Check-out|Stay)\)$/;

const getLodgingSeriesBaseName = (name: string): string => name.replace(LODGING_SUFFIX_REGEX, '').trim();

const TripPage = () => {
  const sortEventsForDay = (day: Omit<Day, 'events'>, dayEvents: Event[]): Event[] => {
    return [...dayEvents].sort((a, b) => {
      const aSlice = sliceEventForDay(a, day);
      const bSlice = sliceEventForDay(b, day);
      const aIsStay = EVENT_CATEGORY[a.type] === 'Lodging' && a.name.includes('(Stay)');
      const bIsStay = EVENT_CATEGORY[b.type] === 'Lodging' && b.name.includes('(Stay)');
      if (aIsStay !== bIsStay) return aIsStay ? -1 : 1;
      const aIsMiddleLodging = EVENT_CATEGORY[a.type] === 'Lodging'
        && !!aSlice
        && aSlice.totalDays > 2
        && aSlice.dayIndex > 1
        && aSlice.dayIndex < aSlice.totalDays;
      const bIsMiddleLodging = EVENT_CATEGORY[b.type] === 'Lodging'
        && !!bSlice
        && bSlice.totalDays > 2
        && bSlice.dayIndex > 1
        && bSlice.dayIndex < bSlice.totalDays;
      if (aIsMiddleLodging !== bIsMiddleLodging) return aIsMiddleLodging ? 1 : -1;
      return 0;
    });
  };

  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { appUser } = useAuth();
  const { trip, loading, error, permissionDenied, can, updateTripName, updateBannerImage, updateStartAndEndDate, deleteTrip } = useTrip(id!);
  const { days, syncDaysToRange } = useDays(id!, { seedWithTrip: trip });
  const { events } = useItinerary(id!);
  const { mySelectedIds, allSelections, toggleSelection, deselectAll } = useSessionSelections(id!, appUser?.uid);
  const { setLastViewedTrip } = useLastViewedTrip();

  const scrollRef = useRef<HTMLElement>(null);

  const [activeDay, setActiveDay] = useState<{ id: string; date: Date } | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showDateModal, setShowDateModal] = useState(false);
  const [tripName, setTripName] = useState('New Trip');
  const [bannerImage, setBannerImage] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [tripUsers, setTripUsers] = useState<AppUser[]>([]);
  const [editingEvent, setEditingEvent] = useState<{
    event: Event;
    lock: 'acquired' | 'readonly';
    holderName?: string;
    groupedEvents?: Event[];
  } | null>(null);
  const [dateAdjustConfirm, setDateAdjustConfirm] = useState<{
    newStart: Date;
    newEnd: Date;
    removedDays: number;
    removedEvents: number;
  } | null>(null);
  // Snapshot of event IDs pending deletion confirmation. Captured up-front so
  // the SelectionActionBar's overlay auto-deselect doesn't erase them mid-flow.
  const [deleteConfirmIds, setDeleteConfirmIds] = useState<string[] | null>(null);
  // When set, the confirm popup will reject this suggestion instead of deleting real events.
  const [pendingSuggestionDelete, setPendingSuggestionDelete] = useState<Event | null>(null);

  const canCreateEvent = can('add_event');
  const canProposeCreateEvent = can('propose_create_event');
  const canDeleteEvent = can('delete_event');
  const canProposeDeleteEvent = can('propose_delete_event');
  const canApproveSuggestion = can('approve_suggestion');
  const totalTripUsers = trip ? new Set([trip.userId, ...trip.shared]).size : 0;

  // If our lock is stolen (expired past TTL while browser slept, etc.), flip
  // the open modal to read-only so we can't accidentally overwrite.
  useEventLock(
    id!,
    editingEvent?.lock === 'acquired' ? editingEvent.event.id : null,
    appUser?.uid,
    editingEvent?.lock === 'acquired',
    () => {
      setEditingEvent((curr) => curr ? { ...curr, lock: 'readonly' } : curr);
    },
  );

  const handleDeleteConfirmed = async () => {
    await deleteTrip();
    navigate('/');
  };

  // Merge Firestore events into every day they overlap. A multi-day event
  // appears as a separate chunk under each day's label.
  const daysWithEvents: Day[] = days.map(day => ({
    ...day,
    events: sortEventsForDay(day, events.filter(e => eventOverlapsDay(e, day))),
  }));

  const tripDayRefs = days.map(d => ({ id: d.id, date: d.date }));

  const computeRemovedDays = (nextStartDate: Date, nextEndDate: Date) => {
    const normalizedStart = new Date(nextStartDate);
    normalizedStart.setHours(0, 0, 0, 0);
    const normalizedEnd = new Date(nextEndDate);
    normalizedEnd.setHours(0, 0, 0, 0);
    return daysWithEvents.filter((day) => day.date < normalizedStart || day.date > normalizedEnd);
  };

  const expandLodgingSeriesIds = (seedIds: string[]): string[] => {
    const seedSet = new Set(seedIds);
    const expanded = new Set<string>(seedIds);
    const seedEvents = events.filter((event) => seedSet.has(event.id));
    seedEvents.forEach((event) => {
      if (EVENT_CATEGORY[event.type] !== 'Lodging' || !LODGING_SUFFIX_REGEX.test(event.name)) return;
      const base = getLodgingSeriesBaseName(event.name);
      events.forEach((candidate) => {
        if (EVENT_CATEGORY[candidate.type] !== 'Lodging') return;
        if (candidate.type !== event.type) return;
        if (getLodgingSeriesBaseName(candidate.name) !== base) return;
        expanded.add(candidate.id);
      });
    });
    return Array.from(expanded);
  };

  const computeRemovalImpact = (nextStartDate: Date, nextEndDate: Date) => {
    const removedDays = computeRemovedDays(nextStartDate, nextEndDate);
    const removedIds = removedDays.flatMap((day) => day.events.map((event) => event.id));
    const expandedRemovedIds = expandLodgingSeriesIds(removedIds);
    return {
      removedDaysCount: removedDays.length,
      removedEventsCount: expandedRemovedIds.length,
    };
  };

  useEffect(() => {
    if (trip && !initialized) {
      setTripName(trip.name);
      if (trip.bannerImageUrl !== undefined) setBannerImage(trip.bannerImageUrl);
      setInitialized(true);
      setLastViewedTrip({
        tripId: trip.id,
        tripName: trip.name,
        bannerImageUrl: trip.bannerImageUrl,
      });
    }
  }, [trip, initialized]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch AppUser records for all trip members (owner + shared).
  const memberUidsKey = trip ? [trip.userId, ...trip.shared].join(',') : '';
  useEffect(() => {
    if (!trip) return;
    const uids = [trip.userId, ...trip.shared.filter(uid => uid !== trip.userId)];
    Promise.all(uids.map(uid => getDoc(doc(db, 'users', uid)))).then(docs => {
      setTripUsers(docs.filter(d => d.exists()).map(d => d.data() as AppUser));
    });
  }, [memberUidsKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleChangeDates = async (newStart: Date, newEnd: Date) => {
    const { removedDaysCount, removedEventsCount } = computeRemovalImpact(newStart, newEnd);
    if (removedEventsCount > 0) {
      setDateAdjustConfirm({
        newStart,
        newEnd,
        removedDays: removedDaysCount,
        removedEvents: removedEventsCount,
      });
      return;
    }
    await syncDaysToRange(newStart, newEnd);
    await updateStartAndEndDate(newStart, newEnd);
  };

  const handleConfirmDateAdjust = async () => {
    if (!dateAdjustConfirm) return;
    if (appUser) {
      const removedDays = computeRemovedDays(dateAdjustConfirm.newStart, dateAdjustConfirm.newEnd);
      const removedIds = removedDays.flatMap((day) => day.events.map((event) => event.id));
      const expandedRemovedIds = expandLodgingSeriesIds(removedIds);
      const removedEvents = events.filter((event) => expandedRemovedIds.includes(event.id));
      await Promise.all(
        removedEvents.map((event) => deleteEvent(appUser.uid, event.tripId, event.dayId, event.id))
      );
    }
    await syncDaysToRange(dateAdjustConfirm.newStart, dateAdjustConfirm.newEnd);
    await updateStartAndEndDate(dateAdjustConfirm.newStart, dateAdjustConfirm.newEnd);
    setDateAdjustConfirm(null);
  };

  const handleChangeName = (newName: string) => {
    setTripName(newName);
    updateTripName(newName);
    setLastViewedTrip({ tripId: id!, tripName: newName, bannerImageUrl: bannerImage });
  };

  const handleChangeBannerImage = (url: string) => {
    setBannerImage(url);
    updateBannerImage(url);
    setLastViewedTrip({ tripId: id!, tripName: tripName, bannerImageUrl: url });
  };

  const buildLodgingEvents = (event: Omit<Event, 'id' | 'tripId'> & { isSuggestion?: boolean }) => {
    const start = new Date(event.startDate);
    const end = event.endDate ? new Date(event.endDate) : new Date(event.startDate);
    const startDay = tripDayRefs.find((d) => d.id === event.dayId)
      ?? tripDayRefs.find((d) => sameCalendarDay(d.date, start));
    const endDay = tripDayRefs.find((d) => {
      const bounds = getDayBounds(d.date);
      return end >= bounds.start && end <= bounds.end;
    }) ?? tripDayRefs.find((d) => sameCalendarDay(d.date, end));
    if (!startDay) return [event];
    if (!endDay) return [event];

    const middleDays = tripDayRefs.filter((d) =>
      d.date > startDay.date && d.date < endDay.date
    );

    const checkInEvent: Omit<Event, 'id' | 'tripId'> & { isSuggestion?: boolean } = {
      ...event,
      name: `${event.name} (Check-in)`,
      dayId: startDay.id,
      startDate: start,
      endDate: new Date(start),
      allDay: false,
    };

    const checkOutEvent: Omit<Event, 'id' | 'tripId'> & { isSuggestion?: boolean } = {
      ...event,
      name: `${event.name} (Check-out)`,
      dayId: endDay.id,
      startDate: end,
      endDate: end,
      allDay: false,
      cost: null,
    };

    const middleEvents = middleDays.map((d) => {
      const allDayDate = new Date(d.date);
      allDayDate.setHours(0, 0, 0, 0);
      return {
        ...event,
        name: `${event.name} (Stay)`,
        dayId: d.id,
        startDate: allDayDate,
        endDate: allDayDate,
        allDay: true,
        cost: null,
      } as Omit<Event, 'id' | 'tripId'> & { isSuggestion?: boolean };
    });

    if (startDay.id === endDay.id) {
      return [checkInEvent, checkOutEvent];
    }

    return [checkInEvent, ...middleEvents, checkOutEvent];
  };

  const handleNewEvent = async (event: Omit<Event, 'id' | 'tripId'> & { isSuggestion?: boolean }) => {
    if (!event.dayId || !appUser) return;
    if (EVENT_CATEGORY[event.type] === 'Lodging') {
      const lodgingEvents = buildLodgingEvents(event);
      await Promise.all(lodgingEvents.map((lodgingEvent) =>
        createEvent(appUser.uid, { ...lodgingEvent, tripId: id! })
      ));
      return;
    }
    await createEvent(appUser.uid, { ...event, tripId: id! });
  };

  const handleRequestDeleteSelected = async () => {
    if (mySelectedIds.length === 0) return;
    if (canDeleteEvent) {
      setDeleteConfirmIds(expandLodgingSeriesIds(mySelectedIds));
    } else if (canProposeDeleteEvent && appUser) {
      const expandedIds = expandLodgingSeriesIds(mySelectedIds);
      const selected = events.filter(e => expandedIds.includes(e.id) && !e.suggestion);
      await Promise.all(selected.map(e => suggestEventDeletion(appUser.uid, e)));
      await deselectAll();
    }
  };

  const handleConfirmDeleteSelected = async () => {
    if (!appUser || !deleteConfirmIds) return;
    if (pendingSuggestionDelete) {
      await resolveSuggestionByVote(appUser.uid, pendingSuggestionDelete, 'delete');
      setPendingSuggestionDelete(null);
    } else {
      const selected = events.filter(e => deleteConfirmIds.includes(e.id));
      await Promise.all(
        selected.map(e => deleteEvent(appUser.uid, e.tripId, e.dayId, e.id)),
      );
      await deselectAll();
    }
    setDeleteConfirmIds(null);
  };

  const handleEditSelected = async () => {
    if (!appUser || mySelectedIds.length !== 1 || !can('edit_event')) return;
    const target = events.find(e => e.id === mySelectedIds[0]);
    if (!target) return;
    const isLodgingSeries = EVENT_CATEGORY[target.type] === 'Lodging' && LODGING_SUFFIX_REGEX.test(target.name);
    const groupedEvents = isLodgingSeries
      ? events
          .filter((e) => EVENT_CATEGORY[e.type] === 'Lodging'
            && e.type === target.type
            && getLodgingSeriesBaseName(e.name) === getLodgingSeriesBaseName(target.name))
          .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
      : [target];

    const acquiredIds: string[] = [];
    for (const grouped of groupedEvents) {
      const result = await acquireEventLock(id!, grouped.id, appUser.uid);
      if (!result.acquired) {
        await Promise.all(acquiredIds.map((lockedId) => releaseEventLock(id!, lockedId, appUser.uid)));
        const holder = tripUsers.find(u => u.uid === result.holderUid);
        const holderName = holder ? `${holder.firstName} ${holder.lastName}`.trim() : 'Another user';
        setEditingEvent({ event: target, lock: 'readonly', holderName, groupedEvents });
        return;
      }
      acquiredIds.push(grouped.id);
    }

    if (isLodgingSeries && groupedEvents.length > 1) {
      const checkIn = groupedEvents.find((e) => e.name.includes('(Check-in)')) ?? groupedEvents[0];
      const checkOut = groupedEvents.find((e) => e.name.includes('(Check-out)')) ?? groupedEvents[groupedEvents.length - 1];
      const syntheticEvent: Event = {
        ...checkIn,
        name: getLodgingSeriesBaseName(checkIn.name),
        startDate: new Date(checkIn.startDate),
        endDate: new Date(checkOut.startDate),
        dayId: checkIn.dayId,
        allDay: false,
      };
      setEditingEvent({ event: syntheticEvent, lock: 'acquired', groupedEvents });
      return;
    }

    setEditingEvent({ event: target, lock: 'acquired', groupedEvents });
  };

  const handleUpdateEvent = async (updated: Omit<Event, 'id' | 'tripId'>) => {
    if (!appUser || !editingEvent || editingEvent.lock !== 'acquired') return;
    const { event, groupedEvents } = editingEvent;
    const isGroupedLodgingEdit = !!groupedEvents
      && groupedEvents.length > 1
      && groupedEvents.every((e) => EVENT_CATEGORY[e.type] === 'Lodging');

    if (isGroupedLodgingEdit) {
      await Promise.all(
        groupedEvents.map((grouped) => deleteEvent(appUser.uid, grouped.tripId, grouped.dayId, grouped.id))
      );
      const lodgingEvents = buildLodgingEvents({
        ...updated,
        dayId: updated.dayId || event.dayId,
      });
      await Promise.all(
        lodgingEvents.map((lodgingEvent) => createEvent(appUser.uid, { ...lodgingEvent, tripId: event.tripId }))
      );
      await Promise.all(groupedEvents.map((grouped) => releaseEventLock(id!, grouped.id, appUser.uid)));
      setEditingEvent(null);
      await deselectAll();
      return;
    }

    if (updated.dayId && updated.dayId !== event.dayId) {
      // Anchor day moved — Firestore stores events under the day's subcollection,
      // so re-create at the new path and delete the old doc.
      await createEvent(appUser.uid, { ...updated, tripId: event.tripId });
      await deleteEvent(appUser.uid, event.tripId, event.dayId, event.id);
    } else {
      await updateEvent(appUser.uid, event.tripId, event.dayId, event.id, updated);
    }
    await releaseEventLock(id!, event.id, appUser.uid);
    setEditingEvent(null);
    await deselectAll();
  };

  const handleCloseEdit = async () => {
    if (!appUser || !editingEvent) { setEditingEvent(null); return; }
    if (editingEvent.lock === 'acquired') {
      const lockIds = editingEvent.groupedEvents?.map((e) => e.id) ?? [editingEvent.event.id];
      await Promise.all(lockIds.map((lockId) => releaseEventLock(id!, lockId, appUser.uid)));
    }
    setEditingEvent(null);
  };

  const handleVoteSuggestion = async (event: Event, vote: SuggestionVote) => {
    if (!appUser || !event.suggestion) return;
    await voteOnSuggestion(appUser.uid, event.tripId, event.dayId, event.id, vote);
  };

  const handleApproveSuggestion = async (event: Event) => {
    if (!appUser || !event.suggestion) return;
    await resolveSuggestionByVote(appUser.uid, event, 'approve');
  };

  const handleDeleteSuggestion = (event: Event) => {
    if (!appUser || !event.suggestion) return;
    setPendingSuggestionDelete(event);
    setDeleteConfirmIds([event.id]);
  };

  if (loading) {
    return (
      <div className="home-wrapper">
        <div className="home-container">
          <main className="home-main">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
              <p style={{ color: '#6b7280' }}>Loading trip…</p>
            </div>
          </main>
        </div>
      </div>
    );
  }

  const noAccessView = (
    <div className="home-wrapper">
      <div className="home-container">
        <main className="home-main">
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '1rem' }}>
            <p style={{ color: '#6b7280' }}>You do not have permission to view this trip.</p>
            <button style={{ color: '#2d5a27', textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer' }} onClick={() => navigate('/')}>
              Go to home
            </button>
          </div>
        </main>
      </div>
    </div>
  );

  // Firestore blocked the read (backend enforcement).
  if (permissionDenied) return noAccessView;

  if (error || !trip) {
    return (
      <div className="home-wrapper">
        <div className="home-container">
          <main className="home-main">
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '1rem' }}>
              <p style={{ color: '#6b7280' }}>{error ?? 'Trip not found'}</p>
              <button style={{ color: '#2d5a27', textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer' }} onClick={() => navigate('/')}>
                Back to home
              </button>
            </div>
          </main>
        </div>
      </div>
    );
  }

  // Frontend guard: trip loaded but user is neither owner nor in shared[].
  if (appUser && appUser.uid !== trip.userId && !trip.shared.includes(appUser.uid)) {
    return noAccessView;
  }

  return (
    <div className="home-wrapper" onClick={() => { if (mySelectedIds.length > 0) deselectAll(); }}>
      <div className="home-container">
        <main className="home-main" ref={scrollRef}>
          <div className="home-content">
            <TripBanner
              tripName={tripName}
              backgroundImage={bannerImage}
              dateRange={formatDateRange(days, trip.startDate, trip.endDate)}
              startDate={trip.startDate}
              endDate={trip.endDate}
              tripId={id!}
              ownerId={trip.userId}
              shared={trip.shared}
              permissions={trip.permissions ?? {}}
              canChangeName={can('change_trip_name')}
              canChangeBanner={can('change_banner')}
              canChangeDates={can('change_start_date') && can('change_end_date')}
              canDelete={can('delete_trip')}
              canManageMembers={true}
              canRemoveMembers={can('remove_member')}
              canChangeRole={can('change_member_role')}
              onChangeName={handleChangeName}
              onChangeImage={handleChangeBannerImage}
              onOpenDatePicker={() => setShowDateModal(true)}
              onDelete={() => setShowDeleteConfirm(true)}
            />
            <TripShareBar
              shared={trip.shared}
              tripId={id!}
              tripName={trip.name}
              ownerId={trip.userId}
              variant="card"
              permissions={trip.permissions ?? {}}
              canInvite={true}
              canRemove={can('remove_member')}
              canChangeRole={can('change_member_role')}
              onBeforeOpen={deselectAll}
            />
            <BudgetModal
              tripId={id!}
              spent={events.reduce((sum, e) => sum + (e.cost ?? 0), 0)}
              events={events}
              tripUsers={tripUsers}
              currentUserId={appUser?.uid ?? ''}
              canEditBudget={can('change_budget')}
              canEditSplitMethod={can('change_split_method')}
            />
            <ItineraryList
              days={daysWithEvents}
              onAddEvent={(day) => setActiveDay({ id: day.id, date: day.date })}
              onSelectEvent={toggleSelection}
              selectedEventIds={mySelectedIds}
              allSelections={allSelections}
              currentUserId={appUser?.uid}
              tripUsers={tripUsers}
              totalTripUsers={totalTripUsers}
              canAddEvent={canCreateEvent || canProposeCreateEvent}
              addEventLabel={canCreateEvent ? 'Event' : 'Suggest Event'}
              onVoteSuggestion={handleVoteSuggestion}
              canApproveSuggestion={canApproveSuggestion}
              onApproveSuggestion={handleApproveSuggestion}
              onDeleteSuggestion={handleDeleteSuggestion}
            />
          </div>
        </main>

        <TripDateModal
          isOpen={showDateModal}
          onClose={() => setShowDateModal(false)}
          currentStartDate={trip.startDate ?? days[0]?.date ?? new Date()}
          currentEndDate={trip.endDate ?? days[days.length - 1]?.date ?? new Date()}
          days={days}
          events={events}
          onConfirm={handleChangeDates}
        />

        {deleteConfirmIds && createPortal(
          <div className="overlay-bottom">
            <div className="overlay-scrim" onClick={() => { setDeleteConfirmIds(null); setPendingSuggestionDelete(null); }} />
            <div className="overlay-panel overlay-panel--sm rounded-t-2xl p-6 pb-8 flex flex-col gap-3 animate-slide-up">
              <h2 className="delete-confirm-title">
                Delete {deleteConfirmIds.length} {deleteConfirmIds.length === 1 ? 'event' : 'events'}?
              </h2>
              <div className="delete-confirm-body">
                <p>
                  {deleteConfirmIds.length === 1
                    ? 'This event will be permanently deleted.'
                    : `These ${deleteConfirmIds.length} events will be permanently deleted.`}
                </p>
                {(() => {
                  const selectedEvents = events.filter(e => deleteConfirmIds.includes(e.id));
                  const hasMultiDay = selectedEvents.some(e =>
                    (e.endDate && new Date(e.endDate).toDateString() !== new Date(e.startDate).toDateString())
                    || (EVENT_CATEGORY[e.type] === 'Lodging' && LODGING_SUFFIX_REGEX.test(e.name))
                  );
                  return hasMultiDay ? (
                    <p className="delete-confirm-multiday-warning">
                      Since this is a multi-day event, linked events will also be deleted!
                    </p>
                  ) : null;
                })()}
                <p><strong>This cannot be undone.</strong></p>
              </div>
              <button onClick={handleConfirmDeleteSelected} className="submit-btn red">
                Delete
              </button>
              <button onClick={() => { setDeleteConfirmIds(null); setPendingSuggestionDelete(null); }} className="cancel-btn">
                Cancel
              </button>
            </div>
          </div>,
          document.body
        )}

        {dateAdjustConfirm && createPortal(
          <div className="overlay-bottom">
            <div className="overlay-scrim" onClick={() => setDateAdjustConfirm(null)} />
            <div className="overlay-panel overlay-panel--sm rounded-t-2xl p-6 pb-8 flex flex-col gap-3 animate-slide-up">
              <h2 className="delete-confirm-title">Adjust Trip Dates?</h2>
              <p className="delete-confirm-body">
                This change removes {dateAdjustConfirm.removedDays} {dateAdjustConfirm.removedDays === 1 ? 'day-section' : 'day-sections'} and will delete {dateAdjustConfirm.removedEvents} {dateAdjustConfirm.removedEvents === 1 ? 'event' : 'events'}. This cannot be undone.
              </p>
              <button onClick={handleConfirmDateAdjust} className="submit-btn red">
                Adjust Dates
              </button>
              <button onClick={() => setDateAdjustConfirm(null)} className="delete-cancel-btn">
                Cancel
              </button>
            </div>
          </div>,
          document.body
        )}

        <EventFormModal
          isOpen={activeDay !== null}
          onClose={() => setActiveDay(null)}
          onSubmit={handleNewEvent}
          tripDays={tripDayRefs}
          initialDayId={activeDay?.id}
          tripUsers={tripUsers}
          currentUserId={appUser?.uid}
          tripBudget={trip.budget}
          tripSpent={events.reduce((sum, e) => sum + (e.cost ?? 0), 0)}
          canCreateEvent={canCreateEvent}
          canProposeEvent={canProposeCreateEvent}
        />

        <EventFormModal
          isOpen={editingEvent !== null}
          onClose={handleCloseEdit}
          onSubmit={handleUpdateEvent}
          tripDays={tripDayRefs}
          initialDayId={editingEvent?.event.dayId}
          tripUsers={tripUsers}
          currentUserId={appUser?.uid}
          tripBudget={trip.budget}
          tripSpent={events.reduce((sum, e) => sum + (e.cost ?? 0), 0)}
          mode={editingEvent?.lock === 'readonly' ? 'readonly' : 'edit'}
          initialEvent={editingEvent?.event}
          lockHolderName={editingEvent?.holderName}
        />

        {showDeleteConfirm && createPortal(
          <div className="overlay-bottom">
            <div className="overlay-scrim" onClick={() => setShowDeleteConfirm(false)} />
            <div className="overlay-panel overlay-panel--sm rounded-t-2xl p-6 pb-8 flex flex-col gap-3 animate-slide-up">
              <h2 className="delete-confirm-title">Delete Trip?</h2>
              <p className="delete-confirm-body">
                "{tripName}" will be permanently deleted. This cannot be undone.
              </p>
              <button onClick={handleDeleteConfirmed} className="submit-btn red">
                Delete
              </button>
              <button onClick={() => setShowDeleteConfirm(false)} className="cancel-btn">
                Cancel
              </button>
            </div>
          </div>,
          document.body
        )}
      </div>
      <SelectionActionBar
        selectedCount={mySelectedIds.length}
        onEdit={handleEditSelected}
        selectedEventIds={mySelectedIds}
        onDelete={handleRequestDeleteSelected}
        onDeselectAll={deselectAll}
        canEdit={can('edit_event')}
        canDelete={canDeleteEvent}
        canSuggestDelete={canProposeDeleteEvent && !canDeleteEvent}
        scrollContainer={scrollRef.current}
      />
    </div>
  );
};

export default TripPage;
