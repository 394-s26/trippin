import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { AppUser } from '../types/auth';
import UserAvatar from './UserAvatar';
import greenBg from '../images/green_bg.jpg';
import './MiniTripBanner.css';

interface MiniTripBannerProps {
  tripName: string;
  backgroundImage: string | null;
  ownerId?: string;
  shared?: string[];
}

const MAX_AVATARS = 4;

const MiniTripBanner = ({ tripName, backgroundImage, ownerId, shared = [] }: MiniTripBannerProps) => {
  const [ownerUser, setOwnerUser] = useState<AppUser | null>(null);
  const [sharedUsers, setSharedUsers] = useState<AppUser[]>([]);

  useEffect(() => {
    if (!ownerId) { setOwnerUser(null); return; }
    getDoc(doc(db, 'users', ownerId)).then(d => {
      setOwnerUser(d.exists() ? (d.data() as AppUser) : null);
    });
  }, [ownerId]);

  useEffect(() => {
    if (!shared.length) { setSharedUsers([]); return; }
    Promise.all(shared.map(u => getDoc(doc(db, 'users', u)))).then(docs => {
      setSharedUsers(docs.filter(d => d.exists()).map(d => d.data() as AppUser));
    });
  }, [shared.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  const allUsers = ownerUser ? [ownerUser, ...sharedUsers] : sharedUsers;
  const visible = allUsers.slice(0, MAX_AVATARS);
  const overflow = allUsers.length - visible.length;

  return (
    <div
      className="mini-trip-banner"
      style={{ backgroundImage: `url(${backgroundImage ?? greenBg})` }}
    >
      <div className="mini-trip-banner-overlay" />
      <span className="mini-trip-banner-name">{tripName}</span>
      <div className="mini-trip-banner-users">
        {visible.map((user, i) => (
          <span key={user.uid} style={{ marginLeft: i === 0 ? 0 : -10, zIndex: visible.length - i, display: 'flex' }}>
            <UserAvatar user={user} size="sm" bordered />
          </span>
        ))}
        {overflow > 0 && (
          <div className="mini-trip-banner-overflow" style={{ marginLeft: -8 }}>+{overflow}</div>
        )}
      </div>
    </div>
  );
};

export default MiniTripBanner;
