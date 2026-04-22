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
import { createEvent, deleteEvent, updateEvent, acquireEventLock, releaseEventLock, suggestEventDeletion, voteOnSuggestion, approveSuggestion } from '../services/firestoreEventsService';
import { eventOverlapsDay } from '../utilities/eventOverlapsDay';
import { useAuth } from '../contexts/AuthContext';
import { useLastViewedTrip } from '../contexts/LastViewedTripContext';
import './Home.css';

const formatDateRange = (days: Omit<Day, 'events'>[], fallbackStart?: Date): string => {
  const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  if (days.length === 0) {
    return fallbackStart ? fmt(fallbackStart) : '';
  }
  return `${fmt(days[0].date)} — ${fmt(days[days.length - 1].date)}`;
};

const TripPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { appUser } = useAuth();
  const { trip, loading, error, permissionDenied, can, updateTripName, updateBannerImage, updateStartAndEndDate, deleteTrip } = useTrip(id!);
  const { days, adjustTripLength } = useDays(id!, { seedWithTrip: trip });
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
  } | null>(null);
  // Snapshot of event IDs pending deletion confirmation. Captured up-front so
  // the SelectionActionBar's overlay auto-deselect doesn't erase them mid-flow.
  const [deleteConfirmIds, setDeleteConfirmIds] = useState<string[] | null>(null);

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
    events: events.filter(e => eventOverlapsDay(e, day)),
  }));

  const tripDayRefs = days.map(d => ({ id: d.id, date: d.date }));

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
    await adjustTripLength(newStart, newEnd);
    await updateStartAndEndDate(newStart, newEnd);
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

  const handleNewEvent = async (event: Omit<Event, 'id' | 'tripId'> & { isSuggestion?: boolean }) => {
    if (!event.dayId || !appUser) return;
    await createEvent(appUser.uid, { ...event, tripId: id! });
  };

  const handleRequestDeleteSelected = async () => {
    if (mySelectedIds.length === 0) return;
    if (canDeleteEvent) {
      setDeleteConfirmIds([...mySelectedIds]);
    } else if (canProposeDeleteEvent && appUser) {
      const selected = events.filter(e => mySelectedIds.includes(e.id) && !e.suggestion);
      await Promise.all(selected.map(e => suggestEventDeletion(appUser.uid, e)));
      await deselectAll();
    }
  };

  const handleConfirmDeleteSelected = async () => {
    if (!appUser || !deleteConfirmIds) return;
    const selected = events.filter(e => deleteConfirmIds.includes(e.id));
    await Promise.all(
      selected.map(e => deleteEvent(appUser.uid, e.tripId, e.dayId, e.id)),
    );
    setDeleteConfirmIds(null);
    await deselectAll();
  };

  const handleEditSelected = async () => {
    if (!appUser || mySelectedIds.length !== 1 || !can('edit_event')) return;
    const target = events.find(e => e.id === mySelectedIds[0]);
    if (!target) return;
    const result = await acquireEventLock(id!, target.id, appUser.uid);
    if (result.acquired) {
      setEditingEvent({ event: target, lock: 'acquired' });
    } else {
      const holder = tripUsers.find(u => u.uid === result.holderUid);
      const holderName = holder ? `${holder.firstName} ${holder.lastName}`.trim() : 'Another user';
      setEditingEvent({ event: target, lock: 'readonly', holderName });
    }
  };

  const handleUpdateEvent = async (updated: Omit<Event, 'id' | 'tripId'>) => {
    if (!appUser || !editingEvent || editingEvent.lock !== 'acquired') return;
    const { event } = editingEvent;
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
      await releaseEventLock(id!, editingEvent.event.id, appUser.uid);
    }
    setEditingEvent(null);
  };

  const handleVoteSuggestion = async (event: Event, vote: SuggestionVote) => {
    if (!appUser || !event.suggestion) return;
    await voteOnSuggestion(appUser.uid, event.tripId, event.dayId, event.id, vote);
  };

  const handleApproveSuggestion = async (event: Event) => {
    if (!appUser || !event.suggestion) return;
    await approveSuggestion(appUser.uid, event);
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
              dateRange={formatDateRange(days, trip.startDate)}
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
            <div className="overlay-scrim" onClick={() => setDeleteConfirmIds(null)} />
            <div className="overlay-panel overlay-panel--sm rounded-t-2xl p-6 pb-8 flex flex-col gap-3 animate-slide-up">
              <h2 className="delete-confirm-title">
                Delete {deleteConfirmIds.length} {deleteConfirmIds.length === 1 ? 'event' : 'events'}?
              </h2>
              <p className="delete-confirm-body">
                {deleteConfirmIds.length === 1
                  ? 'This event will be permanently deleted. This cannot be undone.'
                  : `These ${deleteConfirmIds.length} events will be permanently deleted. This cannot be undone.`}
              </p>
              <button onClick={handleConfirmDeleteSelected} className="delete-confirm-btn">
                Delete
              </button>
              <button onClick={() => setDeleteConfirmIds(null)} className="delete-cancel-btn">
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
              <button onClick={handleDeleteConfirmed} className="delete-confirm-btn">
                Delete
              </button>
              <button onClick={() => setShowDeleteConfirm(false)} className="delete-cancel-btn">
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
