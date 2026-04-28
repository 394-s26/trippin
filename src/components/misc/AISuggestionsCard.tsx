import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Event } from '../../types/event';
import { Day } from '../../types/day';
import { Trip } from '../../types/trip';
import { createEvent } from '../../services/firestoreEventsService';
import { XIcon, PlusIcon, LocationPinIcon, SparkleIcon, TrashIcon } from '../../services/svgIcons';
import {
  AIMeta,
  AISuggestion,
  GEMINI_MODEL_OPTIONS,
  DEFAULT_GEMINI_MODEL,
  MAX_AI_MESSAGES_PER_TRIP,
  PromptKey,
  TripLocation,
  buildPromptChips,
  fetchAISuggestions,
  saveLocations,
  saveSuggestions,
  subscribeToAIMeta,
} from '../../services/aiSuggestionService';
import { geocodeAddress } from '../../services/googleMapsService';
import { initPlaceAutocomplete } from '../../services/googlePlacesService';
import TimeSelect from '../TimeSelect';
import './AISuggestionsCard.css';

interface AISuggestionsCardProps {
  tripId: string;
  currentUid: string | null;
  days: Omit<Day, 'events'>[];
  canCreateEvent: boolean;
  canProposeEvent: boolean;
  trip: Trip;
  tripUserCount: number;
}

const HIGH_USAGE_MESSAGE = 'Gemini is experiencing high usage right now. Please try again in a moment.';
const LIMIT_REACHED_MESSAGE = `You've used all ${MAX_AI_MESSAGES_PER_TRIP} AI messages for this trip.`;

const formatDayOption = (d: Date): string =>
  d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

const AISuggestionsCard = ({
  tripId,
  currentUid,
  days,
  canCreateEvent,
  canProposeEvent,
  trip,
  tripUserCount,
}: AISuggestionsCardProps) => {
  const [expanded, setExpanded] = useState(false);

  // Live-synced trip-wide AI state.
  const [meta, setMeta] = useState<AIMeta | null>(null);
  const suggestions = meta?.suggestions ?? [];
  const locations = meta?.locations ?? [];
  const messageCount = meta?.messageCount ?? 0;
  const remaining = Math.max(0, MAX_AI_MESSAGES_PER_TRIP - messageCount);
  const limitReached = messageCount >= MAX_AI_MESSAGES_PER_TRIP;
  const initialLoading = meta === null;

  // Add-to-itinerary picker state.
  const [adding, setAdding] = useState<AISuggestion | null>(null);
  const [dayId, setDayId] = useState('');
  const [time, setTime] = useState('10:00');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Generation state.
  const [generating, setGenerating] = useState(false);
  const [activePromptKey, setActivePromptKey] = useState<PromptKey | null>(null);
  const [suggestionsError, setSuggestionsError] = useState<string | null>(null);
  const [isHighUsageError, setIsHighUsageError] = useState(false);
  const [selectedModel, setSelectedModel] = useState<string>(DEFAULT_GEMINI_MODEL);

  // The expanded card has three navigable views.
  type View = 'setup' | 'prompts' | 'results';
  const [view, setView] = useState<View>('prompts');
  const locationInputRef = useRef<HTMLDivElement | null>(null);

  const sortedDays = useMemo(
    () => [...days].sort((a, b) => a.date.getTime() - b.date.getTime()),
    [days],
  );

  // Subscribe to live meta doc — keeps suggestions, locations, and quota in sync
  // across all collaborators in real time.
  useEffect(() => {
    const unsub = subscribeToAIMeta(tripId, setMeta, () => setMeta((prev) => prev ?? {
      suggestions: [], locations: [], messageCount: 0, updatedAt: 0,
    }));
    return () => unsub();
  }, [tripId]);

  // Pick a sensible default view the first time the card opens / meta loads.
  const initializedRef = useRef(false);
  useEffect(() => {
    if (!expanded || initialLoading || initializedRef.current) return;
    initializedRef.current = true;
    if (locations.length === 0) setView('setup');
    else if (suggestions.length > 0) setView('results');
    else setView('prompts');
  }, [expanded, initialLoading, locations.length, suggestions.length]);

  // Reset the "first time" flag when the card collapses so reopening picks a
  // sensible landing view again.
  useEffect(() => {
    if (!expanded) initializedRef.current = false;
  }, [expanded]);

  const showSetup = view === 'setup';

  // Mount the Google Places autocomplete element when the setup panel is visible.
  useEffect(() => {
    if (!expanded || !showSetup || !locationInputRef.current) return;
    let cleanupFn: (() => void) | undefined;
    let cancelled = false;

    initPlaceAutocomplete(locationInputRef.current, {
      onInput: () => {/* nothing — only commit on select */},
      onSelect: async (place) => {
        if (cancelled) return;
        const next: TripLocation = {
          name: place.name || place.address,
          address: place.address,
          lat: typeof place.lat === 'number' ? place.lat : null,
          lng: typeof place.lng === 'number' ? place.lng : null,
        };
        const dedup = [...locations.filter((l) => l.address !== next.address), next];
        await saveLocations(tripId, dedup).catch(() => {});
      },
    })
      .then((cleanup) => {
        if (cancelled) { cleanup(); return; }
        cleanupFn = cleanup;
      })
      .catch((err) => console.error('Error loading Google Places autocomplete:', err));

    return () => {
      cancelled = true;
      cleanupFn?.();
      if (locationInputRef.current) locationInputRef.current.innerHTML = '';
    };
    // We intentionally exclude `locations` so the autocomplete element isn't
    // re-mounted on every save — onSelect reads `locations` via closure but the
    // effect itself only needs to run when the panel becomes visible.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded, showSetup, tripId]);

  const removeLocation = async (address: string) => {
    const next = locations.filter((l) => l.address !== address);
    await saveLocations(tripId, next).catch(() => {});
  };

  const clearAllSuggestions = async () => {
    await saveSuggestions(tripId, []).catch(() => {});
    setView('prompts');
  };

  const buildContext = () => {
    const hasWeekend = sortedDays.some((d) => d.date.getDay() === 0 || d.date.getDay() === 6);
    const hasWeekday = sortedDays.some((d) => d.date.getDay() >= 1 && d.date.getDay() <= 5);
    return {
      tripId,
      tripName: trip.name,
      totalUsers: tripUserCount,
      budget: trip.budget > 0 ? trip.budget : null,
      numDays: sortedDays.length,
      hasWeekend,
      hasWeekday,
      locations,
    };
  };

  const promptChips = useMemo(
    () =>
      buildPromptChips({
        totalUsers: tripUserCount,
        budget: trip.budget > 0 ? trip.budget : null,
        hasWeekend: sortedDays.some((d) => d.date.getDay() === 0 || d.date.getDay() === 6),
        locations,
      }),
    [tripUserCount, trip.budget, sortedDays, locations],
  );

  const generate = async (promptKey: PromptKey, modelOverride?: string) => {
    if (limitReached) {
      setSuggestionsError(LIMIT_REACHED_MESSAGE);
      return;
    }
    setGenerating(true);
    setActivePromptKey(promptKey);
    setSuggestionsError(null);
    setIsHighUsageError(false);
    try {
      await fetchAISuggestions(buildContext(), promptKey, modelOverride ?? selectedModel);
      // suggestions arrive via onSnapshot — no local setSuggestions needed.
      setView('results');
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (msg === 'HIGH_USAGE') {
        setIsHighUsageError(true);
        setSuggestionsError(HIGH_USAGE_MESSAGE);
      } else if (msg === 'LIMIT_REACHED') {
        setSuggestionsError(LIMIT_REACHED_MESSAGE);
      } else {
        setSuggestionsError(`Error: ${msg}`);
      }
    } finally {
      setGenerating(false);
      setActivePromptKey(null);
    }
  };

  const canAct = canCreateEvent || canProposeEvent;
  const suggestOnly = !canCreateEvent && canProposeEvent;
  const actionLabel = suggestOnly ? 'Suggest' : 'Add';
  const pickerTitle = suggestOnly ? 'Suggest for the itinerary' : 'Add to itinerary';
  const confirmLabel = suggestOnly ? 'Suggest event' : 'Add to itinerary';
  const hasSuggestions = suggestions.length > 0;

  const openPicker = (e: React.MouseEvent, s: AISuggestion) => {
    e.stopPropagation();
    if (!canAct) return;
    setError(null);
    setAdding(s);
    setDayId(sortedDays[0]?.id ?? '');
    setTime('10:00');
  };

  const handleAdd = async () => {
    if (!currentUid || !adding || !dayId) return;
    const day = sortedDays.find((d) => d.id === dayId);
    if (!day) {
      setError('Pick a day first.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const [hh, mm] = time.split(':').map((p) => parseInt(p, 10) || 0);
      const startDate = new Date(day.date);
      startDate.setHours(hh, mm, 0, 0);
      const endDate = new Date(startDate);
      endDate.setHours(startDate.getHours() + 1);

      const coords = adding.address ? await geocodeAddress(adding.address).catch(() => null) : null;

      await createEvent(currentUid, {
        tripId,
        dayId,
        type: adding.type,
        name: adding.title,
        startDate,
        endDate,
        allDay: false,
        cost: adding.cost ? adding.cost * tripUserCount : null,
        location: adding.address ?? undefined,
        ...(coords ?? {}),
        suggestion: null,
        isSuggestion: suggestOnly,
      } as Omit<Event, 'id'> & { isSuggestion?: boolean });
      const addedId = adding.id;
      const updated = suggestions.filter((s) => s.id !== addedId);
      saveSuggestions(tripId, updated).catch(() => {});
      setAdding(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCardClick = () => { if (!expanded) setExpanded(true); };
  const handleCollapse = (e: React.MouseEvent) => { e.stopPropagation(); setExpanded(false); };

  const renderSkeletonRows = (count: number) =>
    Array.from({ length: count }).map((_, i) => (
      <div key={i} className="misc-ai-preview-row misc-ai-skeleton-row">
        <div className="misc-ai-preview-dot misc-ai-skeleton-dot" />
        <div className="misc-ai-skeleton-line" />
      </div>
    ));

  const ghostChipPreviews = useMemo(() => {
    const city = locations[0]?.name?.split(',')[0];
    return city
      ? [`Top things to do in ${city}`, `Hidden gems in ${city}`, `Best food spots in ${city}`]
      : ['Top things to do', 'Hidden gems near you', 'Best food spots'];
  }, [locations]);

  const renderCollapsed = () => (
    <div className="misc-ai-collapsed">
      <div className="misc-ai-collapsed-top">
        <span className="misc-ai-badge">
          <SparkleIcon size={10} />
          AI ASSISTANT
        </span>
        <span
          className={`misc-ai-quota-pill${limitReached ? ' misc-ai-quota-pill--exhausted' : ''}`}
        >
          {initialLoading ? '…' : `${remaining}/${MAX_AI_MESSAGES_PER_TRIP}`}
        </span>
      </div>

      {initialLoading ? (
        <div className="misc-ai-preview">{renderSkeletonRows(4)}</div>
      ) : hasSuggestions ? (
        <>
          <div className="misc-ai-preview">
            {suggestions.slice(0, 4).map((s) => (
              <div key={s.id} className="misc-ai-preview-row">
                <div className="misc-ai-preview-dot" />
                <span className="misc-ai-preview-title">{s.title}</span>
              </div>
            ))}
          </div>
          <span className="misc-ai-collapsed-cta">Tap to view all →</span>
        </>
      ) : (
        <div className="misc-ai-collapsed-empty">
          <div className="misc-ai-collapsed-orb">
            <SparkleIcon size={20} />
          </div>
          <h3 className="misc-ai-collapsed-heading">Plan smarter with AI</h3>
          <p className="misc-ai-collapsed-sub">
            Get ideas pulled live from Reddit, TripAdvisor & more.
          </p>
          <div className="misc-ai-collapsed-chips">
            {ghostChipPreviews.map((label) => (
              <span key={label} className="misc-ai-collapsed-chip">{label}</span>
            ))}
          </div>
          <span className="misc-ai-collapsed-cta">
            {limitReached ? 'Limit reached' : 'Tap to start →'}
          </span>
        </div>
      )}
    </div>
  );

  const renderQuotaBanner = () => (
    <div className={`misc-ai-quota-banner${limitReached ? ' misc-ai-quota-banner--exhausted' : ''}`}>
      <span>
        {limitReached
          ? `${LIMIT_REACHED_MESSAGE} You can still add saved suggestions.`
          : `${remaining} of ${MAX_AI_MESSAGES_PER_TRIP} AI messages left for this trip (shared with everyone).`}
      </span>
    </div>
  );

  const renderLocationTags = () => (
    <div className="misc-ai-location-tags">
      {locations.map((loc) => (
        <span key={loc.address} className="misc-ai-location-tag">
          <LocationPinIcon size={10} />
          <span>{loc.name || loc.address}</span>
          <button
            type="button"
            className="misc-ai-location-tag-remove"
            onClick={(e) => { e.stopPropagation(); removeLocation(loc.address); }}
            aria-label={`Remove ${loc.name || loc.address}`}
          >
            ×
          </button>
        </span>
      ))}
      <button
        type="button"
        className="misc-ai-location-edit-btn"
        onClick={(e) => { e.stopPropagation(); setView('setup'); }}
      >
        + Add destination
      </button>
    </div>
  );

  const renderSetup = () => (
    <div className="misc-ai-setup">
      <h4 className="misc-ai-setup-title">Where are you going?</h4>
      <p className="misc-ai-setup-subtitle">
        Add destinations so we can pull tailored suggestions from Reddit, TripAdvisor, and more.
      </p>
      <div className="misc-ai-setup-input-container" ref={locationInputRef} />
      {locations.length > 0 && (
        <>
          <div className="misc-ai-location-tags">
            {locations.map((loc) => (
              <span key={loc.address} className="misc-ai-location-tag">
                <LocationPinIcon size={10} />
                <span>{loc.name || loc.address}</span>
                <button
                  type="button"
                  className="misc-ai-location-tag-remove"
                  onClick={() => removeLocation(loc.address)}
                  aria-label={`Remove ${loc.name || loc.address}`}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
          <button
            type="button"
            className="misc-ai-generate-btn"
            onClick={() => setView('prompts')}
          >
            Done
          </button>
        </>
      )}
    </div>
  );

  const renderPromptChips = () => (
    <div className="misc-ai-prompt-grid">
      {promptChips.map((chip) => (
        <button
          key={chip.key}
          type="button"
          className="misc-ai-prompt-chip"
          onClick={() => generate(chip.key)}
          disabled={generating || limitReached}
        >
          {generating && activePromptKey === chip.key ? '… ' : ''}{chip.label}
        </button>
      ))}
    </div>
  );

  const renderResultCards = () => (
    <ul className="misc-ai-list misc-ai-list--inline">
      {suggestions.map((s) => (
        <li key={s.id} className="misc-ai-item">
          <div className="misc-ai-item-top-row">
            <div className="misc-ai-item-header">
              <span className="misc-ai-item-type">{s.type}</span>
              <h4 className="misc-ai-item-title">{s.title}</h4>
            </div>
            <button
              type="button"
              className="misc-ai-add-btn"
              onClick={(e) => openPicker(e, s)}
              disabled={!canAct || !currentUid || sortedDays.length === 0}
              aria-label={actionLabel}
            >
              <PlusIcon size={16} />
              <span>{actionLabel}</span>
            </button>
          </div>
          <p className="misc-ai-item-desc">{s.description}</p>
          {s.address && (
            <div className="misc-ai-item-address">
              <LocationPinIcon size={12} className="event-card-location--svg" />
              <span>{s.address}</span>
            </div>
          )}
          {s.cost != null && (
            <p className="misc-ai-item-cost">
              ~${s.cost * tripUserCount} total{s.cost > 0 && ` (~$${s.cost}/person)`}
            </p>
          )}
        </li>
      ))}
    </ul>
  );

  const renderErrorBlock = () =>
    suggestionsError && (
      <div className="misc-ai-error-block">
        <span>{suggestionsError}</span>
        {!limitReached && activePromptKey && (
          <button
            type="button"
            className="misc-ai-retry-btn"
            onClick={() => activePromptKey && generate(activePromptKey)}
          >
            Try again
          </button>
        )}
        {isHighUsageError && (
          <>
            <span className="misc-ai-model-label">Or try a different model…</span>
            <select
              className="misc-ai-model-select"
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
            >
              {GEMINI_MODEL_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </>
        )}
      </div>
    );

  const renderLoading = () => (
    <div className="misc-ai-loading">
      <div className="misc-ai-spinner" />
      <span>Searching Reddit, TripAdvisor & more…</span>
    </div>
  );

  // ---- Per-view header bars ----

  const renderHeader = (
    title: string,
    onBack?: () => void,
    rightSlot?: React.ReactNode,
  ) => (
    <div className="misc-ai-view-header">
      <div className="misc-ai-view-header-left">
        {onBack ? (
          <button
            type="button"
            className="misc-ai-back-btn"
            onClick={onBack}
            aria-label="Back"
          >
            ←
          </button>
        ) : (
          <span className="misc-ai-badge">
            <SparkleIcon size={10} />
            AI ASSISTANT
          </span>
        )}
        <span className="misc-ai-view-title">{title}</span>
      </div>
      <div className="misc-ai-header-actions">
        {rightSlot}
        <button
          type="button"
          className="misc-modal-close"
          onClick={handleCollapse}
          aria-label="Collapse"
        >
          <XIcon size={18} />
        </button>
      </div>
    </div>
  );

  // Tab strip — visible on prompts + results so users can hop between the two
  // freely. Disabled tabs (e.g. results when there are no suggestions yet)
  // make the relationship between the views obvious.
  const renderViewTabs = () => (
    <div className="misc-ai-tabs" role="tablist">
      <button
        type="button"
        role="tab"
        aria-selected={view === 'prompts'}
        className={`misc-ai-tab${view === 'prompts' ? ' misc-ai-tab--active' : ''}`}
        onClick={() => setView('prompts')}
      >
        Ask
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={view === 'results'}
        className={`misc-ai-tab${view === 'results' ? ' misc-ai-tab--active' : ''}`}
        onClick={() => hasSuggestions && setView('results')}
        disabled={!hasSuggestions}
      >
        Results
        {hasSuggestions && (
          <span className="misc-ai-tab-count">{suggestions.length}</span>
        )}
      </button>
    </div>
  );

  // ---- View bodies ----

  const renderSetupView = () => (
    <>
      {renderHeader(
        'Destinations',
        locations.length > 0 ? () => setView(hasSuggestions ? 'results' : 'prompts') : undefined,
      )}
      {renderSetup()}
    </>
  );

  const renderPromptsView = () => (
    <>
      {renderHeader('Ask the AI', undefined,
        <button
          type="button"
          className="misc-ai-icon-btn"
          onClick={() => setView('setup')}
          aria-label="Edit destinations"
          title="Edit destinations"
        >
          <LocationPinIcon size={14} />
        </button>,
      )}
      {renderViewTabs()}

      {renderLocationTags()}
      {renderQuotaBanner()}

      {generating ? (
        renderLoading()
      ) : (
        <>
          {renderErrorBlock()}
          {!limitReached && renderPromptChips()}
          {!generating && !suggestionsError && hasSuggestions && (
            <button
              type="button"
              className="misc-ai-view-results-link"
              onClick={() => setView('results')}
            >
              View {suggestions.length} saved suggestion{suggestions.length === 1 ? '' : 's'} →
            </button>
          )}
        </>
      )}

      {sortedDays.length === 0 && (
        <div className="misc-ai-inline-error">
          Add some trip days first, then these can be inserted.
        </div>
      )}
      {!canAct && (
        <div className="misc-ai-inline-error">
          You don't have permission to add or suggest events for this trip.
        </div>
      )}
    </>
  );

  const renderResultsView = () => (
    <>
      {renderHeader('Suggestions', () => setView('prompts'),
        <button
          type="button"
          className="misc-ai-icon-btn misc-ai-icon-btn--danger"
          onClick={clearAllSuggestions}
          aria-label="Clear all suggestions"
          title="Clear all"
        >
          <TrashIcon size={14} />
        </button>,
      )}
      {renderViewTabs()}

      {renderQuotaBanner()}

      {generating ? renderLoading() : renderErrorBlock()}

      {!generating && hasSuggestions && renderResultCards()}

      {!generating && hasSuggestions && (
        <button
          type="button"
          className="misc-ai-ask-again-btn"
          onClick={() => setView('prompts')}
          disabled={limitReached}
        >
          {limitReached ? 'Limit reached' : '+ Ask another prompt'}
        </button>
      )}

      {sortedDays.length === 0 && (
        <div className="misc-ai-inline-error">
          Add some trip days first, then these can be inserted.
        </div>
      )}
      {!canAct && (
        <div className="misc-ai-inline-error">
          You don't have permission to add or suggest events for this trip.
        </div>
      )}
    </>
  );

  const renderExpanded = () => (
    <>
      {showSetup
        ? renderSetupView()
        : view === 'results'
          ? renderResultsView()
          : renderPromptsView()}
    </>
  );

  return (
    <>
      <div
        className={`misc-card misc-card--ai${expanded ? ' misc-card--ai-expanded' : ''}`}
        role={!expanded ? 'button' : undefined}
        tabIndex={!expanded ? 0 : undefined}
        aria-label={!expanded ? 'Open AI suggestions' : undefined}
        onClick={!expanded ? handleCardClick : undefined}
        onKeyDown={
          !expanded
            ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setExpanded(true);
                }
              }
            : undefined
        }
      >
        {expanded ? renderExpanded() : renderCollapsed()}
      </div>

      {adding && createPortal(
        <div className="overlay-bottom misc-ai-picker-layer">
          <div className="overlay-scrim" onClick={() => (!submitting ? setAdding(null) : undefined)} />
          <div className="overlay-panel overlay-panel--sm rounded-t-2xl p-5 pb-8 flex flex-col gap-3 animate-slide-up misc-modal">
            <div className="misc-modal-header">
              <h2 className="misc-modal-title">{pickerTitle}</h2>
              <button
                type="button"
                className="misc-modal-close"
                onClick={() => setAdding(null)}
                aria-label="Cancel"
                disabled={submitting}
              >
                <XIcon size={20} />
              </button>
            </div>
            <div className="misc-ai-picker-title">{adding.title}</div>
            <label className="misc-ai-picker-label">
              <span>Day</span>
              <select
                className="misc-ai-picker-input"
                value={dayId}
                onChange={(e) => setDayId(e.target.value)}
                disabled={submitting}
              >
                {sortedDays.map((d) => (
                  <option key={d.id} value={d.id}>
                    {formatDayOption(d.date)}
                    {d.label ? ` — ${d.label}` : ''}
                  </option>
                ))}
              </select>
            </label>
            <label className="misc-ai-picker-label">
              <span>Start time</span>
              <TimeSelect
                value={time}
                onChange={setTime}
                disabled={submitting}
                ariaLabel="Start time"
              />
            </label>
            {error && <div className="misc-photos-error">{error}</div>}
            <button
              type="button"
              className="global-btn default-btn"
              onClick={handleAdd}
              disabled={submitting || !dayId}
            >
              {submitting ? (suggestOnly ? 'Suggesting…' : 'Adding…') : confirmLabel}
            </button>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
};

export default AISuggestionsCard;
