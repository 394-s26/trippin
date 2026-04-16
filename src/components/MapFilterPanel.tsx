import { EventCategory } from '../types/event';
import { Day } from '../types/day';
import { XIcon, SearchIcon, FilterIcon } from '../services/svgIcons';
import './MapFilterPanel.css';

const ALL_CATEGORIES: EventCategory[] = ['Transportation', 'Lodging', 'Activity', 'Attraction', 'Food & Drink'];

interface MapFilterPanelProps {
  isOpen: boolean;
  onToggle: () => void;
  days: Omit<Day, 'events'>[];
  selectedDayIds: Set<string>;
  selectedCategories: Set<EventCategory>;
  nameQuery: string;
  onChangeDays: (next: Set<string>) => void;
  onChangeCategories: (next: Set<EventCategory>) => void;
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

const getOrdinal = (n: number): string => {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};


const MapFilterPanel = ({
  isOpen,
  onToggle,
  days,
  selectedDayIds,
  selectedCategories,
  nameQuery,
  onChangeDays,
  onChangeCategories,
  onChangeNameQuery,
  onClose,
  onClearAll,
}: MapFilterPanelProps) => (
  <div className={`map-filter-panel${isOpen ? ' map-filter-panel--open' : ''}`}>
    <div className="map-filter-inner">
      <div className="map-filter-header">
        <button
          type="button"
          className={`map-filter-toggle${isOpen ? ' map-filter-toggle--active' : ''}`}
          onClick={onToggle}
          aria-label="Toggle filters"
          aria-expanded={isOpen}
        >
          <FilterIcon size={18} />
          <span>Filters</span>
        </button>

        <h2 className="map-filter-title">Filter Events</h2>

        <button onClick={onClose} className="map-filter-close" aria-label="Close filters">
          <XIcon size={18} />
        </button>
      </div>

      <div className="map-filter-body">
        <div className="map-filter-top-row">
          <section className="map-filter-section map-filter-search-section">
            <label className="map-filter-label">Search</label>
            <div className="map-filter-search">
              <SearchIcon size={14} className="map-filter-search-icon" />
              <input
                type="text"
                value={nameQuery}
                onChange={(e) => onChangeNameQuery(e.target.value)}
                placeholder="Event name…"
                className="map-filter-search-input"
              />
            </div>
          </section>

          <section className="map-filter-section map-filter-days-section">
            <label className="map-filter-label">Days</label>
            <div className="map-filter-days">
              {days.map((day) => {
                const checked = selectedDayIds.has(day.id);
                const dayNum = day.date.getDate();
                return (
                  <button
                    key={day.id}
                    type="button"
                    className={`map-filter-day-sq${checked ? ' map-filter-day-sq--active' : ''}`}
                    onClick={() => onChangeDays(toggle(selectedDayIds, day.id))}
                    aria-pressed={checked}
                    title={day.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  >
                    {getOrdinal(dayNum)}
                  </button>
                );
              })}
            </div>
          </section>
        </div>

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

        <button type="button" className="map-filter-clear" onClick={onClearAll}>
          Reset filters
        </button>
      </div>
    </div>
  </div>
);

export default MapFilterPanel;
