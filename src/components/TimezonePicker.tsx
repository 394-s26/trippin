import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import './TimezonePicker.css';

interface TimezonePickerProps {
  zones: string[];
  value: string;
  onChange: (tz: string) => void;
  disabled?: boolean;
  label: string;
  autoFocus?: boolean;
}

// Country → representative IANA zones. IANA strings only encode region/city,
// so this map is what powers "search by country" (e.g. typing "united states"
// surfaces all the US America/* zones). Beyond this list, substring matching
// against the zone string still catches everything else.
const COUNTRY_ZONES: Record<string, string[]> = {
  'united states': ['America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'America/Anchorage', 'America/Phoenix', 'Pacific/Honolulu', 'America/Adak'],
  'usa': ['America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'America/Anchorage', 'America/Phoenix', 'Pacific/Honolulu'],
  'united kingdom': ['Europe/London'],
  'uk': ['Europe/London'],
  'britain': ['Europe/London'],
  'england': ['Europe/London'],
  'scotland': ['Europe/London'],
  'wales': ['Europe/London'],
  'ireland': ['Europe/Dublin'],
  'france': ['Europe/Paris'],
  'germany': ['Europe/Berlin'],
  'italy': ['Europe/Rome'],
  'spain': ['Europe/Madrid', 'Atlantic/Canary'],
  'portugal': ['Europe/Lisbon', 'Atlantic/Azores'],
  'netherlands': ['Europe/Amsterdam'],
  'belgium': ['Europe/Brussels'],
  'switzerland': ['Europe/Zurich'],
  'austria': ['Europe/Vienna'],
  'sweden': ['Europe/Stockholm'],
  'norway': ['Europe/Oslo'],
  'denmark': ['Europe/Copenhagen'],
  'finland': ['Europe/Helsinki'],
  'poland': ['Europe/Warsaw'],
  'greece': ['Europe/Athens'],
  'turkey': ['Europe/Istanbul'],
  'russia': ['Europe/Moscow', 'Asia/Vladivostok', 'Asia/Yekaterinburg', 'Asia/Novosibirsk'],
  'japan': ['Asia/Tokyo'],
  'china': ['Asia/Shanghai'],
  'hong kong': ['Asia/Hong_Kong'],
  'taiwan': ['Asia/Taipei'],
  'south korea': ['Asia/Seoul'],
  'korea': ['Asia/Seoul'],
  'india': ['Asia/Kolkata'],
  'pakistan': ['Asia/Karachi'],
  'bangladesh': ['Asia/Dhaka'],
  'thailand': ['Asia/Bangkok'],
  'vietnam': ['Asia/Ho_Chi_Minh'],
  'singapore': ['Asia/Singapore'],
  'malaysia': ['Asia/Kuala_Lumpur'],
  'indonesia': ['Asia/Jakarta'],
  'philippines': ['Asia/Manila'],
  'australia': ['Australia/Sydney', 'Australia/Melbourne', 'Australia/Perth', 'Australia/Brisbane', 'Australia/Adelaide', 'Australia/Darwin', 'Australia/Hobart'],
  'new zealand': ['Pacific/Auckland'],
  'canada': ['America/Toronto', 'America/Vancouver', 'America/Edmonton', 'America/Winnipeg', 'America/Halifax', 'America/St_Johns'],
  'mexico': ['America/Mexico_City', 'America/Cancun', 'America/Tijuana'],
  'brazil': ['America/Sao_Paulo', 'America/Manaus', 'America/Bahia'],
  'argentina': ['America/Argentina/Buenos_Aires'],
  'chile': ['America/Santiago'],
  'colombia': ['America/Bogota'],
  'peru': ['America/Lima'],
  'venezuela': ['America/Caracas'],
  'south africa': ['Africa/Johannesburg'],
  'egypt': ['Africa/Cairo'],
  'morocco': ['Africa/Casablanca'],
  'nigeria': ['Africa/Lagos'],
  'kenya': ['Africa/Nairobi'],
  'uae': ['Asia/Dubai'],
  'united arab emirates': ['Asia/Dubai'],
  'emirates': ['Asia/Dubai'],
  'saudi arabia': ['Asia/Riyadh'],
  'qatar': ['Asia/Qatar'],
  'palestine': ['Asia/Jerusalem'],
};

// Inverse of COUNTRY_ZONES — used to render "City, Country" in option titles.
// Only canonical names (skip aliases like "uk", "usa") to avoid duplicates.
const ZONE_TO_COUNTRY: Record<string, string> = (() => {
  const out: Record<string, string> = {};
  const canonical = new Set([
    'united states', 'united kingdom', 'ireland', 'france', 'germany', 'italy', 'spain',
    'portugal', 'netherlands', 'belgium', 'switzerland', 'austria', 'sweden', 'norway',
    'denmark', 'finland', 'poland', 'greece', 'turkey', 'russia', 'japan', 'china',
    'hong kong', 'taiwan', 'south korea', 'india', 'pakistan', 'bangladesh', 'thailand',
    'vietnam', 'singapore', 'malaysia', 'indonesia', 'philippines', 'australia',
    'new zealand', 'canada', 'mexico', 'brazil', 'argentina', 'chile', 'colombia',
    'peru', 'venezuela', 'south africa', 'egypt', 'morocco', 'nigeria', 'kenya',
    'united arab emirates', 'saudi arabia', 'qatar', 'palestine',
  ]);
  const titleize = (s: string) => s.split(' ').map(w => w[0].toUpperCase() + w.slice(1)).join(' ');
  for (const [country, list] of Object.entries(COUNTRY_ZONES)) {
    if (!canonical.has(country)) continue;
    for (const tz of list) {
      if (!out[tz]) out[tz] = titleize(country);
    }
  }
  return out;
})();

const partOfDateTimeFormat = (tz: string, type: 'shortOffset' | 'long'): string => {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      timeZoneName: type,
    }).formatToParts(new Date());
    return parts.find(p => p.type === 'timeZoneName')?.value ?? '';
  } catch {
    return '';
  }
};

interface TzMeta {
  tz: string;
  city: string;
  country: string | undefined;
  long: string;
  offset: string;
  haystack: string;
}

const buildMeta = (tz: string): TzMeta => {
  const city = tz.split('/').pop()?.replace(/_/g, ' ') ?? tz;
  const country = ZONE_TO_COUNTRY[tz];
  const long = partOfDateTimeFormat(tz, 'long');
  const offset = partOfDateTimeFormat(tz, 'shortOffset');
  const haystack = [
    tz.replace(/_/g, ' ').replace(/\//g, ' '),
    city,
    country ?? '',
    long,
    offset,
  ].join(' ').toLowerCase();
  return { tz, city, country, long, offset, haystack };
};

// "(GMT-05:00) Central Time - Chicago" — matches the Google Calendar display
// inside the time-zone modal (see reference screenshot).
export const formatTzInputValue = (tz: string): string => {
  const meta = buildMeta(tz);
  const offsetPart = meta.offset ? `(${meta.offset}) ` : '';
  const longPart = meta.long ? meta.long : meta.tz;
  return `${offsetPart}${longPart} - ${meta.city}`;
};

const POPULAR_ZONES = [
  'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
  'Europe/London', 'Europe/Paris', 'Europe/Berlin',
  'Asia/Tokyo', 'Asia/Shanghai', 'Asia/Kolkata', 'Asia/Dubai', 'Asia/Singapore',
  'Australia/Sydney', 'Pacific/Auckland', 'America/Sao_Paulo', 'America/Toronto',
];

const TimezonePicker = ({ zones, value, onChange, disabled, label, autoFocus }: TimezonePickerProps) => {
  const formattedValue = useMemo(() => formatTzInputValue(value), [value]);
  const [text, setText] = useState(formattedValue);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputWrapRef = useRef<HTMLDivElement>(null);
  const optionsRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // Position of the options popover. Tracked so the popover (portaled to
  // document.body so it can overflow the modal panel) stays anchored to the
  // input even when the page or modal scrolls.
  const [popoverRect, setPopoverRect] = useState<{ top: number; left: number; width: number } | null>(null);

  // Build/cache the metadata for every zone exactly once per `zones` change.
  // `Intl.DateTimeFormat` is not free over 400+ zones, so this avoids
  // re-running it on every keystroke.
  const allMeta = useMemo(() => zones.map(buildMeta), [zones]);

  // Sync the input text whenever the controlled value changes from the
  // outside (e.g. parent staging state). Skip while the user is actively
  // typing a query (text doesn't match the formatted value).
  useEffect(() => {
    setText(formattedValue);
  }, [formattedValue]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      const insideWrap = wrapRef.current?.contains(target) ?? false;
      const insideOptions = optionsRef.current?.contains(target) ?? false;
      if (!insideWrap && !insideOptions) {
        setOpen(false);
        // Revert text to the formatted value if the user typed a query but
        // didn't pick anything.
        setText(formattedValue);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, formattedValue]);

  // Anchor the portaled popover to the input. Recompute on scroll/resize
  // (capture phase so nested scroll containers fire too — the modal panel
  // itself can scroll on small screens).
  useEffect(() => {
    if (!open) return;
    const update = () => {
      const el = inputWrapRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setPopoverRect({ top: r.bottom + 4, left: r.left, width: r.width });
    };
    update();
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [open]);

  useEffect(() => {
    if (autoFocus && !disabled) {
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [autoFocus, disabled]);

  // The text counts as a "search query" only when it differs from the
  // formatted current value — i.e. the user has started typing.
  const queryActive = open && text.trim() !== formattedValue;

  const filtered = useMemo(() => {
    if (!open) return [];
    if (!queryActive) {
      // Just-opened: show a curated short list of popular zones plus the
      // current value so the panel is useful without being overwhelming.
      const pinned = new Set([value, ...POPULAR_ZONES]);
      return allMeta.filter(m => pinned.has(m.tz));
    }
    const q = text.trim().toLowerCase();
    const countryHits = new Set<string>();
    for (const [country, list] of Object.entries(COUNTRY_ZONES)) {
      if (country.includes(q) || q.includes(country)) {
        for (const tz of list) countryHits.add(tz);
      }
    }
    const matches = allMeta.filter(m => countryHits.has(m.tz) || m.haystack.includes(q));
    return matches.slice(0, 200);
  }, [open, queryActive, text, allMeta, value]);

  const handleSelect = (tz: string) => {
    onChange(tz);
    setOpen(false);
    // text re-syncs via the formattedValue useEffect on next render.
  };

  const handleClear = () => {
    setText('');
    setOpen(true);
    inputRef.current?.focus();
  };

  return (
    <div className="tz-picker" ref={wrapRef}>
      <label className="tz-picker-label">{label}</label>
      <div className="tz-picker-input-wrap" ref={inputWrapRef}>
        <input
          ref={inputRef}
          type="text"
          className="tz-picker-input"
          value={text}
          disabled={disabled}
          placeholder="Search for a city or country"
          autoComplete="off"
          spellCheck={false}
          onFocus={() => {
            setOpen(true);
            // Select all so typing replaces the formatted value cleanly.
            requestAnimationFrame(() => inputRef.current?.select());
          }}
          onChange={(e) => {
            setText(e.target.value);
            setOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setOpen(false);
              setText(formattedValue);
              (e.target as HTMLInputElement).blur();
            }
          }}
        />
        {!disabled && text && open && (
          <button
            type="button"
            className="tz-picker-clear"
            onMouseDown={(e) => e.preventDefault()}
            onClick={handleClear}
            aria-label="Clear time zone search"
          >
            ×
          </button>
        )}
      </div>

      {open && !disabled && popoverRect && createPortal(
        <div
          ref={optionsRef}
          className="tz-picker-options"
          role="listbox"
          style={{
            position: 'fixed',
            top: popoverRect.top,
            left: popoverRect.left,
            width: popoverRect.width,
          }}
        >
          {filtered.length === 0 && (
            <div className="tz-picker-empty">No matches</div>
          )}
          {filtered.map((m) => {
            const isSel = m.tz === value;
            const title = m.country ? `${m.city}, ${m.country}` : m.city;
            const subtitle = [m.long, m.city].filter(Boolean).join(' - ')
              + (m.offset ? ` (${m.offset})` : '');
            return (
              <button
                key={m.tz}
                type="button"
                role="option"
                aria-selected={isSel}
                className={`tz-picker-option${isSel ? ' tz-picker-option--selected' : ''}`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleSelect(m.tz)}
              >
                <span className="tz-picker-option-title">{title}</span>
                <span className="tz-picker-option-subtitle">{subtitle}</span>
              </button>
            );
          })}
        </div>,
        document.body
      )}
    </div>
  );
};

export default TimezonePicker;
