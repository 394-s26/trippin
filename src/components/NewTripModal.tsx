import { useState } from 'react';
import './NewTripModal.css';

interface NewTripModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (name: string, startDate: Date, endDate: Date) => void;
  submitting?: boolean;
}

const toInputDate = (d: Date) => d.toISOString().slice(0, 10);

export default function NewTripModal({ isOpen, onClose, onSubmit, submitting }: NewTripModalProps) {
  const today = new Date();
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState(toInputDate(today));
  const [endDate, setEndDate] = useState(toInputDate(today));

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim() || 'New Trip';
    onSubmit(
      trimmed,
      new Date(startDate + 'T00:00:00'),
      new Date(endDate + 'T00:00:00'),
    );
  };

  const isValid = startDate && endDate && endDate >= startDate;

  return (
    <div className="overlay-center" onClick={onClose}>
      <div
        className="overlay-panel overlay-panel--sm rounded-2xl p-6 shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        <form onSubmit={handleSubmit} className="new-trip-modal-form">
          <h2 className="new-trip-modal-title">Create a New Trip</h2>
          <p className="new-trip-modal-subtitle">Give your trip a name and pick your dates.</p>

          <div className="new-trip-modal-field">
            <label className="new-trip-modal-label" htmlFor="new-trip-name">Trip Name</label>
            <input
              id="new-trip-name"
              className="new-trip-modal-input"
              type="text"
              placeholder="e.g. Spring Break in Tokyo"
              value={name}
              onChange={e => setName(e.target.value)}
              autoFocus
            />
          </div>

          <div className="new-trip-modal-dates">
            <div className="new-trip-modal-field">
              <label className="new-trip-modal-label" htmlFor="new-trip-start">Start Date</label>
              <input
                id="new-trip-start"
                className="new-trip-modal-input"
                type="date"
                value={startDate}
                onChange={e => {
                  setStartDate(e.target.value);
                  if (e.target.value > endDate) setEndDate(e.target.value);
                }}
              />
            </div>
            <div className="new-trip-modal-field">
              <label className="new-trip-modal-label" htmlFor="new-trip-end">End Date</label>
              <input
                id="new-trip-end"
                className="new-trip-modal-input"
                type="date"
                value={endDate}
                min={startDate}
                onChange={e => setEndDate(e.target.value)}
              />
            </div>
          </div>

          <button
            type="submit"
            className="new-trip-modal-submit"
            disabled={!isValid || submitting}
          >
            {submitting ? 'Creating…' : 'Create Trip'}
          </button>
          <button type="button" className="new-trip-modal-cancel" onClick={onClose}>
            Cancel
          </button>
        </form>
      </div>
    </div>
  );
}
