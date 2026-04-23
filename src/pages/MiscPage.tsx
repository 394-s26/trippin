import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { AppUser } from '../types/auth';
import { useAuth } from '../contexts/AuthContext';
import useTrip from '../hooks/useTrip';
import { useDays } from '../hooks/useDays';
import useNotes from '../hooks/useNotes';
import useTripPhotos from '../hooks/useTripPhotos';
import useTripGame from '../hooks/useTripGame';
import NotesSection from '../components/misc/NotesSection';
import PhotosCard from '../components/misc/PhotosCard';
import GameCard from '../components/misc/GameCard';
import AISuggestionsCard from '../components/misc/AISuggestionsCard';
import './Home.css';
import './MiscPage.css';

const MiscPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { appUser } = useAuth();
  const { trip, loading: tripLoading, permissionDenied, can } = useTrip(id!);
  const { days } = useDays(id!, { seedWithTrip: trip });
  const { notes, loading: notesLoading } = useNotes(id!);
  const { photos } = useTripPhotos(id!);
  const { game } = useTripGame(id!);
  const [tripUsers, setTripUsers] = useState<AppUser[]>([]);

  const memberUidsKey = trip ? [trip.userId, ...trip.shared].join(',') : '';
  useEffect(() => {
    if (!trip) return;
    const uids = [trip.userId, ...trip.shared.filter((u) => u !== trip.userId)];
    Promise.all(uids.map((uid) => getDoc(doc(db, 'users', uid)))).then((docs) => {
      setTripUsers(docs.filter((d) => d.exists()).map((d) => d.data() as AppUser));
    });
  }, [memberUidsKey]); // eslint-disable-line react-hooks/exhaustive-deps

  if (tripLoading) {
    return (
      <div className="home-wrapper">
        <div className="home-container">
          <main className="home-main">
            <div className="misc-center-notice">
              <p>Loading…</p>
            </div>
          </main>
        </div>
      </div>
    );
  }

  if (permissionDenied || !trip) {
    return (
      <div className="home-wrapper">
        <div className="home-container">
          <main className="home-main">
            <div className="misc-center-notice">
              <p>You do not have permission to view this trip.</p>
              <button className="misc-back-btn" onClick={() => navigate('/')}>
                Go to home
              </button>
            </div>
          </main>
        </div>
      </div>
    );
  }

  const currentUid = appUser?.uid ?? null;

  return (
    <div className="home-wrapper">
      <div className="home-container">
        <main className="home-main">
          <div className="home-content misc-page-content">
            <h1 className="misc-page-title">{trip.name}</h1>

            <div className="misc-grid">
              <div className="misc-grid-col">
                <PhotosCard
                  tripId={id!}
                  currentUid={currentUid}
                  photos={photos}
                  tripUsers={tripUsers}
                />
                <GameCard
                  tripId={id!}
                  currentUid={currentUid}
                  game={game}
                  tripUsers={tripUsers}
                />
              </div>
              <div className="misc-grid-col">
                <AISuggestionsCard
                  tripId={id!}
                  currentUid={currentUid}
                  days={days}
                  canCreateEvent={can('add_event')}
                  canProposeEvent={can('propose_create_event')}
                />
              </div>
            </div>

            <NotesSection
              tripId={id!}
              currentUid={currentUid}
              notes={notes}
              loading={notesLoading}
              tripUsers={tripUsers}
            />
          </div>
        </main>
      </div>
    </div>
  );
};

export default MiscPage;
