import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import AppHeader from '../components/AppHeader';
import Navbar from '../components/Navbar';
import TripBanner from '../components/TripBanner';
import ItineraryList from '../components/ItineraryList';
import EventFormModal from '../components/EventFormModal';
import BudgetModal from '../components/BudgetModal';
import TripShareBar from '../components/TripShareBar';
import { Event } from '../types/event';
import { Day } from '../types/day';
import useTrip from '../hooks/useTrip';
import useDays from '../hooks/useDays';
import useItinerary from '../hooks/useItinerary';
import { createEvent, deleteEvent } from '../services/firestoreEventsService';
import { useAuth } from '../contexts/AuthContext';
import './Home.css';

const formatDateRange = (days: Omit<Day, 'events'>[]): string => {
  if (days.length === 0) return '';
  const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  return `${fmt(days[0].date)} — ${fmt(days[days.length - 1].date)}`;
};

const TripPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { appUser } = useAuth();
  const { trip, loading, error, permissionDenied, updateTripName, updateBannerImage, deleteTrip } = useTrip(id!);
  const { days, addDay, renameDayLabel, removeDay, changeStartDate } = useDays(id!);
  const { events } = useItinerary(id!);

  const [activeDay, setActiveDay] = useState<{ id: string; date: Date } | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [tripName, setTripName] = useState('New Trip');
  const [bannerImage, setBannerImage] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);

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

  const handleChangeStartDate = (newStartDate: Date) => {
    changeStartDate(newStartDate);
  };

  const handleAddDay = () => {
    const lastDate = days[days.length - 1]?.date ?? new Date();
    addDay(lastDate);
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
  }

  const handleChangeBannerImage = (url: string) => {
    setBannerImage(url);
    updateBannerImage(url);
  };

  const handleNewEvent = async (event: Omit<Event, 'id' | 'tripId' | 'dayId'>) => {
    const dayId = activeDay?.id;
    if (!dayId) return;
    await createEvent({ ...event, tripId: id!, dayId });
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
              dateRange={formatDateRange(days)}
              tripId={id!}
              shared={trip.shared}
              isOwner={appUser?.uid === trip.userId}
              onChangeName={handleChangeName}
              onChangeImage={handleChangeBannerImage}
              onChangeStartDate={handleChangeStartDate}
              onDelete={() => setShowDeleteConfirm(true)}
            />
            <TripShareBar
              shared={trip.shared}
              tripId={id!}
              isOwner={appUser?.uid === trip.userId}
              variant="card"
            />
            <BudgetModal tripId={id!} spent={events.reduce((sum, e) => sum + (e.cost ?? 0), 0)} />
            <ItineraryList
              days={daysWithEvents}
              onAddDay={handleAddDay}
              onUpdateDayLabel={handleUpdateDayLabel}
              onDeleteDay={handleDeleteDay}
              onAddEvent={(day) => setActiveDay({ id: day.id, date: day.date })}
              onDeleteEvent={(tripId, dayId, eventId) => deleteEvent(tripId, dayId, eventId)}
            />
          </div>
        </main>

        <Navbar />

        <EventFormModal
          isOpen={activeDay !== null}
          onClose={() => setActiveDay(null)}
          onSubmit={handleNewEvent}
          dayDate={activeDay?.date}
        />

        {showDeleteConfirm && (
          <div className="delete-confirm-overlay">
            <div className="delete-confirm-backdrop" onClick={() => setShowDeleteConfirm(false)} />
            <div className="delete-confirm-sheet">
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
