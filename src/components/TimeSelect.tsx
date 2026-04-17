import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import './TimeSelect.css';

interface TimeSelectProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  anchorMinutes?: number;
  disabled?: boolean;
  ariaLabel?: string;
  variant?: 'input' | 'chip';
}

const STEP_MINUTES = 15;

const pad2 = (n: number) => String(n).padStart(2, '0');

export const toMinutes = (hhmm: string): number | null => {
  if (!hhmm) return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm);
  if (!m) return null;
  const h = Number(m[1]);
  const mm = Number(m[2]);
  if (h < 0 || h > 23 || mm < 0 || mm > 59) return null;
  return h * 60 + mm;
};

export const fromMinutes = (total: number): string => {
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${pad2(h)}:${pad2(m)}`;
};

export const formatTime12h = (hhmm: string): string => {
  const total = toMinutes(hhmm);
  if (total == null) return '';
  const h24 = Math.floor(total / 60);
  const m = total % 60;
  const ampm = h24 >= 12 ? 'pm' : 'am';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${pad2(m)}${ampm}`;
};

export const parseTime = (raw: string): string | null => {
  const s = raw.trim().toLowerCase().replace(/\s+/g, '');
  if (!s) return null;

  let ampm: 'am' | 'pm' | null = null;
  let body = s;
  if (s.endsWith('am')) { ampm = 'am'; body = s.slice(0, -2); }
  else if (s.endsWith('pm')) { ampm = 'pm'; body = s.slice(0, -2); }
  else if (s.endsWith('a')) { ampm = 'am'; body = s.slice(0, -1); }
  else if (s.endsWith('p')) { ampm = 'pm'; body = s.slice(0, -1); }

  let h = NaN;
  let m = 0;

  if (body.includes(':')) {
    const [hp, mp] = body.split(':');
    h = Number(hp);
    m = Number(mp);
  } else if (/^\d+$/.test(body)) {
    if (body.length <= 2) {
      h = Number(body);
    } else if (body.length === 3) {
      h = Number(body.slice(0, 1));
      m = Number(body.slice(1));
    } else if (body.length === 4) {
      h = Number(body.slice(0, 2));
      m = Number(body.slice(2));
    }
  }

  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  if (m < 0 || m > 59) return null;

  if (ampm) {
    if (h < 1 || h > 12) return null;
    if (ampm === 'pm' && h !== 12) h += 12;
    if (ampm === 'am' && h === 12) h = 0;
  } else {
    if (h < 0 || h > 23) return null;
  }

  return `${pad2(h)}:${pad2(m)}`;
};

const formatDuration = (mins: number): string => {
  let m = mins;
  if (m <= 0) m += 24 * 60;
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (h === 0) return `${r}m`;
  if (r === 0) return `${h}h`;
  return `${h}h ${r}m`;
};

const TimeSelect = ({ id, value, onChange, anchorMinutes, disabled, ariaLabel, variant = 'input' }: TimeSelectProps) => {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(formatTime12h(value));
  const [focused, setFocused] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!focused) setText(formatTime12h(value));
  }, [value, focused]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  useLayoutEffect(() => {
    if (!open || !listRef.current) return;
    const selected = listRef.current.querySelector<HTMLButtonElement>('.time-select-option--selected');
    if (selected) {
      selected.scrollIntoView({ block: 'center' });
    }
  }, [open]);

  const commit = (raw: string) => {
    const parsed = parseTime(raw);
    if (parsed != null) {
      onChange(parsed);
      setText(formatTime12h(parsed));
    } else {
      setText(formatTime12h(value));
    }
  };

  const options: { hhmm: string; minutes: number }[] = [];
  for (let m = 0; m < 24 * 60; m += STEP_MINUTES) {
    options.push({ hhmm: fromMinutes(m), minutes: m });
  }

  const selectedMinutes = toMinutes(value);

  const isChip = variant === 'chip';

  return (
    <div className={`time-select${isChip ? ' time-select--chip' : ''}`} ref={wrapRef}>
      <input
        id={id}
        type="text"
        className={isChip ? 'time-select-chip-input' : 'time-select-input form-input'}
        value={text}
        disabled={disabled}
        aria-label={ariaLabel}
        autoComplete="off"
        inputMode="text"
        onFocus={(e) => {
          setFocused(true);
          setOpen(true);
          e.target.select();
        }}
        onBlur={() => {
          setFocused(false);
          commit(text);
        }}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            commit(text);
            setOpen(false);
            (e.target as HTMLInputElement).blur();
          } else if (e.key === 'Escape') {
            setText(formatTime12h(value));
            setOpen(false);
            (e.target as HTMLInputElement).blur();
          } else if (e.key === 'ArrowDown' && !open) {
            setOpen(true);
          }
        }}
      />
      {open && (
        <div className="time-select-options" role="listbox" ref={listRef}>
          {options.map((opt) => {
            const isSelected = selectedMinutes != null && opt.minutes === selectedMinutes;
            const showHint = anchorMinutes != null;
            const diff = showHint ? opt.minutes - anchorMinutes : 0;
            return (
              <button
                key={opt.hhmm}
                type="button"
                role="option"
                aria-selected={isSelected}
                className={`time-select-option${isSelected ? ' time-select-option--selected' : ''}`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  onChange(opt.hhmm);
                  setText(formatTime12h(opt.hhmm));
                  setOpen(false);
                }}
              >
                <span className="time-select-option-label">{formatTime12h(opt.hhmm)}</span>
                {showHint && diff !== 0 && (
                  <span className="time-select-option-hint">{formatDuration(diff)}</span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default TimeSelect;
