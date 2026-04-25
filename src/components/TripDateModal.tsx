import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { WarningIcon } from '../services/svgIcons';
import { Day } from '../types/day';
import { Event } from '../types/event';
import './TripDateModal.css';

interface TripDateModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentStartDate: Date;
  currentEndDate: Date;
  days: Omit<Day, 'events'>[];
  events: Event[];
  onConfirm: (newStart: Date, newEnd: Date) => void;
}

const toInputDate = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const parseInputDate = (s: string): Date => new Date(`${s}T00:00:00`);


const TripDateModal = ({
  isOpen,
  onClose,
  currentStartDate,
  currentEndDate,
  days,
  events,
  onConfirm,
}: TripDateModalProps) => {
  const [startVal, setStartVal] = useState(() => toInputDate(currentStartDate));
  const [endVal, setEndVal] = useState(() => toInputDate(currentEndDate));

  useEffect(() => {
    if (isOpen) {
      setStartVal(toInputDate(currentStartDate));
      setEndVal(toInputDate(currentEndDate));
    }
  }, [isOpen, currentStartDate, currentEndDate]);

  if (!isOpen) return null;

  const newStart = startVal ? parseInputDate(startVal) : null;
  const newEnd = endVal ? parseInputDate(endVal) : null;

  const sorted = [...days].sort((a, b) => a.date.getTime() - b.date.getTime());
  const removedDays = newStart && newEnd
    ? sorted.filter(d => {
        const dayDate = new Date(d.date);
        dayDate.setHours(0, 0, 0, 0);
        return dayDate < newStart || dayDate > newEnd;
      })
    : sorted;
  const removedDayIdSet = new Set(removedDays.map(d => d.id));
  const eventsAtRisk = events.filter(e => removedDayIdSet.has(e.dayId));

  const canConfirm =
    startVal &&
    endVal &&
    parseInputDate(endVal).getTime() >= parseInputDate(startVal).getTime();

  const handleConfirm = () => {
    if (!startVal || !endVal) return;
    onConfirm(parseInputDate(startVal), parseInputDate(endVal));
    onClose();
  };

  return createPortal(
    <div className="overlay-center">
      <div className="overlay-scrim" onClick={onClose} />
      <div className="overlay-panel overlay-panel--sm trip-date-modal">
        <h2 className="trip-date-modal-title">Change Trip Dates</h2>

        <div className="trip-date-modal-fields">
          <div className="trip-date-field">
            <label className="trip-date-label" htmlFor="trip-start-date">
              Start Date
            </label>
            <input
              id="trip-start-date"
              type="date"
              className="trip-date-input"
              value={startVal}
              max={endVal || undefined}
              onChange={e => setStartVal(e.target.value)}
            />
          </div>
          <div className="trip-date-field">
            <label className="trip-date-label" htmlFor="trip-end-date">
              End Date
            </label>
            <input
              id="trip-end-date"
              type="date"
              className="trip-date-input"
              value={endVal}
              min={startVal || undefined}
              onChange={e => setEndVal(e.target.value)}
            />
          </div>
        </div>

        {eventsAtRisk.length > 0 && (
          <div className="trip-date-warning">
            <WarningIcon size={16} />
            <p className="trip-date-warning-text">
              Shortening the trip will remove{' '}
              <strong>
                {removedDays.length} day{removedDays.length !== 1 ? 's' : ''}
              </strong>
              , permanently deleting{' '}
              <strong>
                {eventsAtRisk.length} event{eventsAtRisk.length !== 1 ? 's' : ''}
              </strong>
              .
            </p>
          </div>
        )}

        {removedDays.length > 0 && eventsAtRisk.length === 0 && (
          <p className="trip-date-info-text">
            {removedDays.length} empty day{removedDays.length !== 1 ? 's' : ''} will be removed.
          </p>
        )}

        <div className="trip-date-modal-actions">
          <button
            className="trip-date-confirm-btn"
            onClick={handleConfirm}
            disabled={!canConfirm}
          >
            Save Dates
          </button>
          <button className="trip-date-cancel-btn" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export { TripDateModal };
