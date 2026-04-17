import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import TimezonePicker from './TimezonePicker';
import './TimezoneModal.css';

interface TimezoneModalProps {
  isOpen: boolean;
  onClose: () => void;
  zones: string[];
  startValue: string;
  endValue: string | null;        // null = no separate end zone (use start)
  useSeparate: boolean;
  onSave: (start: string, end: string | null) => void;
}

const systemTimezone = (): string => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
};

const TimezoneModal = ({
  isOpen, onClose, zones, startValue, endValue, useSeparate, onSave,
}: TimezoneModalProps) => {
  const [start, setStart] = useState(startValue);
  const [end, setEnd] = useState<string>(endValue ?? startValue);
  const [separate, setSeparate] = useState(useSeparate);

  // Re-seed staged values whenever the modal opens — never carry stale state
  // across two openings, and reflect any external edits made while closed.
  useEffect(() => {
    if (isOpen) {
      setStart(startValue);
      setEnd(endValue ?? startValue);
      setSeparate(useSeparate);
    }
  }, [isOpen, startValue, endValue, useSeparate]);

  // Esc closes (matches Google Calendar's behavior).
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  const handleOk = () => {
    onSave(start, separate ? end : null);
    onClose();
  };

  const handleUseCurrent = () => {
    const sys = systemTimezone();
    setStart(sys);
    if (separate) setEnd(sys);
  };

  const handleSwap = () => {
    const a = start;
    const b = end;
    setStart(b);
    setEnd(a);
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="tz-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="tz-modal-title">
      <div className="tz-modal-scrim" onClick={onClose} />
      <div className="tz-modal-panel">
        <h3 id="tz-modal-title" className="tz-modal-title">Event time zone</h3>

        <label className="tz-modal-checkbox">
          <input
            type="checkbox"
            checked={separate}
            onChange={(e) => {
              const next = e.target.checked;
              setSeparate(next);
              if (next && !end) setEnd(start);
            }}
          />
          <span>Use separate start and end time zones</span>
        </label>

        <div className="tz-modal-pickers">
          <TimezonePicker
            zones={zones}
            value={start}
            onChange={setStart}
            label={separate ? 'Event start time zone' : 'Event time zone'}
          />

          {/* Always rendered (just invisible when not separate) so toggling
              the checkbox doesn't change the modal's height. */}
          <button
            type="button"
            className={`tz-modal-swap${separate ? '' : ' tz-modal-swap--hidden'}`}
            onClick={handleSwap}
            disabled={!separate}
            aria-hidden={!separate}
            tabIndex={separate ? 0 : -1}
            aria-label="Swap start and end time zones"
            title="Swap start and end time zones"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M7 3v18" />
              <path d="m3 7 4-4 4 4" />
              <path d="M17 21V3" />
              <path d="m21 17-4 4-4-4" />
            </svg>
          </button>

          <TimezonePicker
            zones={zones}
            value={separate ? end : start}
            onChange={setEnd}
            disabled={!separate}
            label="Event end time zone"
          />
        </div>

        <div className="tz-modal-actions">
          <button type="button" className="tz-modal-link" onClick={handleUseCurrent}>
            Use current time zone
          </button>
          <div className="tz-modal-actions-right">
            <button type="button" className="tz-modal-cancel" onClick={onClose}>
              Cancel
            </button>
            <button type="button" className="tz-modal-ok" onClick={handleOk}>
              OK
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default TimezoneModal;
