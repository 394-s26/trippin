import { Event, EventCategory, EVENT_CATEGORY } from '../types/event';
import { Day } from '../types/day';
import { EVENT_TYPE_ICONS } from '../services/eventSvgIcons';
import { XIcon, SearchIcon } from '../services/svgIcons';
import './MapFilterPanel.css';

const ALL_CATEGORIES: EventCategory[] = ['Transportation', 'Lodging', 'Activity', 'Attraction', 'Food & Drink'];
const ALL_TYPES = Object.keys(EVENT_CATEGORY) as Event['type'][];

interface MapFilterPanelProps {
  days: Omit<Day, 'events'>[];
  selectedDayIds: Set<string>;
  selectedCategories: Set<EventCategory>;
  selectedTypes: Set<Event['type']>;
  nameQuery: string;
  onChangeDays: (next: Set<string>) => void;
  onChangeCategories: (next: Set<EventCategory>) => void;
  onChangeTypes: (next: Set<Event['type']>) => void;
  onChangeNameQuery: (q: string) => void;
  onClose: () => void;
  onClearAll: () => void;
}

const toggle = <T,>(set: Set<T>, value: T): Set<T> => {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
};

const formatDayLabel = (day: Omit<Day, 'events'>): string => {
  const d = day.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return day.label ? `${d} · ${day.label}` : d;
};

const MapFilterPanel = ({
  days,
  selectedDayIds,
  selectedCategories,
  selectedTypes,
  nameQuery,
  onChangeDays,
  onChangeCategories,
  onChangeTypes,
  onChangeNameQuery,
  onClose,
  onClearAll,
}: MapFilterPanelProps) => {
  const allDaysSelected = selectedDayIds.size === days.length;
  const toggleAllDays = () => {
    onChangeDays(allDaysSelected ? new Set<string>() : new Set(days.map(d => d.id)));
  };

  return (
    <aside className="map-filter-panel">
      <div className="map-filter-header">
        <h2 className="map-filter-title">Filters</h2>
        <button onClick={onClose} className="map-filter-close" aria-label="Close filters">
          <XIcon size={18} />
        </button>
      </div>

      <section className="map-filter-section">
        <label className="map-filter-label">Search by name</label>
        <div className="map-filter-search">
          <SearchIcon size={16} className="map-filter-search-icon" />
          <input
            type="text"
            value={nameQuery}
            onChange={(e) => onChangeNameQuery(e.target.value)}
            placeholder="e.g. Old Faithful"
            className="map-filter-search-input"
          />
        </div>
      </section>

      <section className="map-filter-section">
        <div className="map-filter-section-header">
          <label className="map-filter-label">Days</label>
          <button type="button" className="map-filter-toggle-all" onClick={toggleAllDays}>
            {allDaysSelected ? 'None' : 'All'}
          </button>
        </div>
        <div className="map-filter-days">
          {days.map((day) => {
            const checked = selectedDayIds.has(day.id);
            return (
              <label key={day.id} className={`map-filter-day${checked ? ' map-filter-day--checked' : ''}`}>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => onChangeDays(toggle(selectedDayIds, day.id))}
                />
                <span>{formatDayLabel(day)}</span>
              </label>
            );
          })}
        </div>
      </section>

      <section className="map-filter-section">
        <label className="map-filter-label">Categories</label>
        <div className="map-filter-categories">
          {ALL_CATEGORIES.map((cat) => {
            const active = selectedCategories.has(cat);
            return (
              <button
                type="button"
                key={cat}
                className={`map-filter-chip${active ? ' map-filter-chip--active' : ''}`}
                onClick={() => onChangeCategories(toggle(selectedCategories, cat))}
              >
                {cat}
              </button>
            );
          })}
        </div>
      </section>

      <section className="map-filter-section">
        <label className="map-filter-label">Types</label>
        <div className="map-filter-types">
          {ALL_TYPES.map((t) => {
            const Icon = EVENT_TYPE_ICONS[t];
            const active = selectedTypes.has(t);
            return (
              <button
                type="button"
                key={t}
                className={`map-filter-type${active ? ' map-filter-type--active' : ''}`}
                onClick={() => onChangeTypes(toggle(selectedTypes, t))}
                aria-pressed={active}
              >
                <span className="map-filter-type-icon">
                  {Icon && <Icon size={18} />}
                </span>
                <span className="map-filter-type-label">{t}</span>
              </button>
            );
          })}
        </div>
      </section>

      <button type="button" className="map-filter-clear" onClick={onClearAll}>
        Reset filters
      </button>
    </aside>
  );
};

export default MapFilterPanel;
