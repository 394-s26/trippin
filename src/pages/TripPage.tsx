import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import AppHeader from '../components/AppHeader';
import Navbar from '../components/Navbar';
import TripBanner from '../components/TripBanner';
import ItineraryList from '../components/ItineraryList';
import EventFormModal from '../components/EventFormModal';
import BudgetModal from '../components/BudgetModal';
import TripShareBar from '../components/TripShareBar';
import { SelectionActionBar } from '../components/SelectionActionBar';
import { Event } from '../types/event';
import { Day } from '../types/day';
import { AppUser } from '../types/auth';
import useTrip from '../hooks/useTrip';
import useDays from '../hooks/useDays';
import useItinerary from '../hooks/useItinerary';
import { useSessionSelections } from '../hooks/useSessionSelections';
import { createEvent, deleteEvent } from '../services/firestoreEventsService';
import { useAuth } from '../contexts/AuthContext';
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
  const { trip, loading, error, permissionDenied, can, updateTripName, updateBannerImage, updateEndDate, deleteTrip } = useTrip(id!);
  const { days, addDay, renameDayLabel, removeDay, changeStartDate } = useDays(id!);
  const { events } = useItinerary(id!);
  const { mySelectedIds, allSelections, toggleSelection, deselectAll } = useSessionSelections(id!, appUser?.uid);

  const [activeDay, setActiveDay] = useState<{ id: string; date: Date } | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [tripName, setTripName] = useState('New Trip');
  const [bannerImage, setBannerImage] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [tripUsers, setTripUsers] = useState<AppUser[]>([]);

  const handleDeleteConfirmed = async () => {
    await deleteTrip();
    navigate('/');
  };

  // Merge Firestore events into their matching days by dayId.
  const daysWithEvents: Day[] = days.map(day => ({
    ...day,
    events: events.filter(e => e.dayId === day.id),
  }));

  useEffect(() => {
    if (trip && !initialized) {
      setTripName(trip.name);
      if (trip.bannerImageUrl !== undefined) setBannerImage(trip.bannerImageUrl);
      setInitialized(true);
    }
  }, [trip, initialized]);

  // Fetch AppUser records for all trip members (owner + shared).
  const memberUidsKey = trip ? [trip.userId, ...trip.shared].join(',') : '';
  useEffect(() => {
    if (!trip) return;
    const uids = [trip.userId, ...trip.shared.filter(uid => uid !== trip.userId)];
    Promise.all(uids.map(uid => getDoc(doc(db, 'users', uid)))).then(docs => {
      setTripUsers(docs.filter(d => d.exists()).map(d => d.data() as AppUser));
    });
  }, [memberUidsKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleChangeStartDate = (newStartDate: Date) => {
    changeStartDate(newStartDate);
  };

  const handleAddDay = async () => {
    const lastDate = days[days.length - 1]?.date ?? new Date();
    await addDay(lastDate);
    const newDayDate = new Date(lastDate);
    newDayDate.setDate(newDayDate.getDate() + 1);
    if (trip?.endDate && newDayDate > trip.endDate) {
      await updateEndDate(newDayDate);
    }
  };

  const handleUpdateDayLabel = (dayId: string, label: string) => {
    renameDayLabel(dayId, label);
  };

  const handleDeleteDay = (dayId: string) => {
    removeDay(dayId);
  };

  const handleChangeName = (tripName: string) => {
    setTripName(tripName);
    updateTripName(tripName);
  };

  const handleChangeBannerImage = (url: string) => {
    setBannerImage(url);
    updateBannerImage(url);
  };

  const handleNewEvent = async (event: Omit<Event, 'id' | 'tripId' | 'dayId'>) => {
    const dayId = activeDay?.id;
    if (!dayId || !appUser) return;
    await createEvent(appUser.uid, { ...event, tripId: id!, dayId });
  };

  const handleDeleteSelected = async () => {
    if (!appUser) return;
    const selected = events.filter(e => mySelectedIds.includes(e.id));
    await Promise.all(
      selected.map(e => deleteEvent(appUser.uid, e.tripId, e.dayId, e.id)),
    );
    await deselectAll();
  };

  if (loading) {
    return (
      <div className="home-wrapper">
        <div className="home-container">
          <AppHeader />
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
        <AppHeader />
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
          <AppHeader />
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
    <div className="home-wrapper">
      <div className="home-container">
        <AppHeader />
        <main className="home-main">
          <div className="home-content">
            <TripBanner
              tripName={tripName}
              backgroundImage={bannerImage}
              dateRange={formatDateRange(days, trip.startDate)}
              tripId={id!}
              shared={trip.shared}
              permissions={trip.permissions ?? {}}
              canChangeName={can('change_trip_name')}
              canChangeBanner={can('change_banner')}
              canChangeStartDate={can('change_start_date')}
              canDelete={can('delete_trip')}
              canManageMembers={can('invite_member')}
              canRemoveMembers={can('remove_member')}
              canChangeRole={can('change_member_role')}
              onChangeName={handleChangeName}
              onChangeImage={handleChangeBannerImage}
              onChangeStartDate={handleChangeStartDate}
              onDelete={() => setShowDeleteConfirm(true)}
            />
            <TripShareBar
              shared={trip.shared}
              tripId={id!}
              variant="card"
              permissions={trip.permissions ?? {}}
              canInvite={can('invite_member')}
              canRemove={can('remove_member')}
              canChangeRole={can('change_member_role')}
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
              onAddDay={handleAddDay}
              onUpdateDayLabel={handleUpdateDayLabel}
              onDeleteDay={handleDeleteDay}
              onAddEvent={(day) => setActiveDay({ id: day.id, date: day.date })}
              selectedEventIds={mySelectedIds}
              onSelectEvent={toggleSelection}
              allSelections={allSelections}
              currentUserId={appUser?.uid}
              tripUsers={tripUsers}
              canAddEvent={can('add_event')}
              canAddDay={can('add_day')}
              canEditDay={can('edit_day')}
              canDeleteDay={can('delete_day')}
            />
          </div>
        </main>

        <Navbar />

        <SelectionActionBar
          selectedCount={mySelectedIds.length}
          onDelete={handleDeleteSelected}
          onDeselectAll={deselectAll}
          canDelete={can('delete_event')}
        />

        <EventFormModal
          isOpen={activeDay !== null}
          onClose={() => setActiveDay(null)}
          onSubmit={handleNewEvent}
          dayDate={activeDay?.date}
          tripUsers={tripUsers}
          currentUserId={appUser?.uid}
          tripBudget={trip.budget}
          tripSpent={events.reduce((sum, e) => sum + (e.cost ?? 0), 0)}
        />

        {showDeleteConfirm && (
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
          </div>
        )}
      </div>
    </div>
  );
};

export default TripPage;
