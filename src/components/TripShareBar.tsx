import { useState, useEffect, useRef } from 'react';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase';
import { AppUser } from '../types/auth';
import UserAvatar from './UserAvatar';
import { Role } from '../config/permissions';
import { inviteMembers, removeMember, changeMemberRole } from '../services/firestoreTripService';
import { useAuth } from '../contexts/AuthContext';
import './TripShareBar.css';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_CARD_AVATARS = 3;

interface EmailPill {
  id: string;
  email: string;
  isValidEmail: boolean;
  user: AppUser | null;
  resolving: boolean;
}

interface RemovePopover {
  uid: string;
  top: number;
  left: number;
}

interface TripShareBarProps {
  shared: string[];
  tripId: string;
  permissions?: Record<string, Role>;
  canInvite?: boolean;
  canRemove?: boolean;
  canChangeRole?: boolean;
  variant?: 'banner' | 'card';
}

const TripShareBar = ({
  shared, tripId, permissions = {},
  canInvite = false, canRemove = false, canChangeRole = false,
  variant = 'banner',
}: TripShareBarProps) => {
  const { appUser } = useAuth();
  const uid = appUser?.uid ?? '';

  const [sharedUsers, setSharedUsers] = useState<AppUser[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [pills, setPills] = useState<EmailPill[]>([]);
  const [inviteRole, setInviteRole] = useState<Role>('editor');
  const [removePopover, setRemovePopover] = useState<RemovePopover | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const sharedKey = shared.join(',');
  useEffect(() => {
    if (!shared.length) { setSharedUsers([]); return; }
    Promise.all(shared.map(u => getDoc(doc(db, 'users', u)))).then(docs => {
      setSharedUsers(docs.filter(d => d.exists()).map(d => d.data() as AppUser));
    });
  }, [sharedKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const lookupUserByEmail = async (email: string): Promise<AppUser | null> => {
    const snap = await getDocs(query(collection(db, 'users'), where('email', '==', email)));
    return snap.empty ? null : (snap.docs[0].data() as AppUser);
  };

  const addPill = async (email: string) => {
    const trimmed = email.trim();
    if (!trimmed) return;
    const isValidEmail = EMAIL_RE.test(trimmed);
    const id = `${trimmed}-${Date.now()}`;

    if (!isValidEmail) {
      setPills(prev => [...prev, { id, email: trimmed, isValidEmail: false, user: null, resolving: false }]);
      return;
    }

    setPills(prev => [...prev, { id, email: trimmed, isValidEmail: true, user: null, resolving: true }]);
    const user = await lookupUserByEmail(trimmed);
    setPills(prev => prev.map(p => p.id === id ? { ...p, user, resolving: false } : p));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (inputValue.trim()) {
        addPill(inputValue);
        setInputValue('');
      }
    } else if (e.key === 'Backspace' && !inputValue) {
      setPills(prev => prev.slice(0, -1));
    }
  };

  const handleShare = async () => {
    const newUids = pills
      .filter(p => p.isValidEmail && p.user && !shared.includes(p.user.uid))
      .map(p => p.user!.uid);

    if (newUids.length > 0) {
      await inviteMembers(uid, tripId, newUids, inviteRole);
    }

    closeModal();
  };

  const closeModal = () => {
    setShowModal(false);
    setPills([]);
    setInputValue('');
    setInviteRole('editor');
  };

  const handleAvatarClick = (targetUid: string, e: React.MouseEvent<HTMLButtonElement>) => {
    if (removePopover?.uid === targetUid) {
      setRemovePopover(null);
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    setRemovePopover({ uid: targetUid, top: rect.bottom + 8, left: rect.left + rect.width / 2 });
  };

  const handleRemoveUser = async () => {
    if (!removePopover) return;
    await removeMember(uid, tripId, removePopover.uid);
    setRemovePopover(null);
  };

  const handleChangeRole = async (targetUid: string, newRole: Role) => {
    await changeMemberRole(uid, tripId, targetUid, newRole);
  };

  const renderAvatar = (user: AppUser, _i: number, style?: React.CSSProperties) => (
    <UserAvatar user={user} size="md" bordered style={style} />
  );

  const renderAvatarBtn = (user: AppUser, i: number, style?: React.CSSProperties) => (
    <button
      key={user.uid}
      className="trip-share-bar-avatar-btn"
      style={{ ...style, zIndex: removePopover?.uid === user.uid ? 999 : sharedUsers.length - i + 1 }}
      onClick={e => handleAvatarClick(user.uid, e)}
      aria-label={`Manage ${user.firstName}`}
    >
      {renderAvatar(user, i)}
    </button>
  );

  const roleLabelOf = (targetUid: string): string => {
    const role = permissions[targetUid];
    return role ? role.charAt(0).toUpperCase() + role.slice(1) : '';
  };

  // ── Banner variant (inside the trip image header) ───────────────────────────
  const bannerContent = (
    <div className="trip-share-bar">
      <div className="trip-share-bar-users">
        {sharedUsers.map((user, i) => (
          canRemove ? (
            renderAvatarBtn(user, i, { marginLeft: i === 0 ? 0 : -10 })
          ) : (
            <span key={user.uid} style={{ marginLeft: i === 0 ? 0 : -10, zIndex: sharedUsers.length - i + 1, display: 'contents' }}>
              {renderAvatar(user, i)}
            </span>
          )
        ))}
        {canInvite && (
          <button
            className="trip-share-bar-add-btn"
            aria-label="Add user"
            onClick={() => setShowModal(true)}
          >
            {shared.length === 0 && <span className="trip-share-bar-add-label">Add Friends</span>}
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 21a8 8 0 0 1 13.292-6"/>
              <circle cx="10" cy="8" r="5"/>
              <path d="M19 16v6"/>
              <path d="M22 19h-6"/>
            </svg>
          </button>
        )}
      </div>

      {shared.length !== 0 && (
        <button
          className="trip-share-bar-copy-btn"
          aria-label="Copy link"
          onClick={() => navigator.clipboard.writeText(window.location.href)}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 17H7A5 5 0 0 1 7 7h2"/>
            <path d="M15 7h2a5 5 0 1 1 0 10h-2"/>
            <line x1="8" x2="16" y1="12" y2="12"/>
          </svg>
        </button>
      )}
    </div>
  );

  // ── Card variant (below banner on mobile) ───────────────────────────────────
  const visibleUsers = sharedUsers.slice(0, MAX_CARD_AVATARS);
  const overflowCount = sharedUsers.length - visibleUsers.length;

  const cardContent = (
    <div className="trip-share-bar-card">
      {shared.length === 0 && (
        <span className="trip-share-bar-empty-label">No friends invited yet...</span>
      )}
      <div className="trip-share-bar-card-avatars">
        {visibleUsers.map((user, i) => (
          canRemove ? (
            renderAvatarBtn(user, i, { marginLeft: i === 0 ? 0 : -10 })
          ) : (
            <span key={user.uid} style={{ marginLeft: i === 0 ? 0 : -10, zIndex: sharedUsers.length - i + 1, display: 'contents' }}>
              {renderAvatar(user, i)}
            </span>
          )
        ))}
        {overflowCount > 0 && (
          <div className="trip-share-bar-card-overflow" style={{ marginLeft: -10 }}>
            +{overflowCount}
          </div>
        )}
      </div>

      {canInvite && (
        <button
          className="trip-share-bar-card-invite-btn"
          onClick={() => setShowModal(true)}
          aria-label="Invite friends"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 21a8 8 0 0 1 13.292-6"/>
            <circle cx="10" cy="8" r="5"/>
            <path d="M19 16v6"/>
            <path d="M22 19h-6"/>
          </svg>
          <span>Invite</span>
        </button>
      )}
    </div>
  );

  return (
    <>
      {variant === 'banner' ? bannerContent : cardContent}

      {removePopover && (
        <>
          <div className="trip-share-bar-remove-backdrop" onClick={() => setRemovePopover(null)} />
          <div
            className="trip-share-bar-remove-popover"
            style={{ top: removePopover.top, left: removePopover.left }}
          >
            {canChangeRole && (
              <div className="trip-share-bar-role-row">
                <span className="trip-share-bar-role-label">Role:</span>
                <select
                  className="trip-share-bar-role-select"
                  value={permissions[removePopover.uid] ?? 'editor'}
                  onChange={e => handleChangeRole(removePopover.uid, e.target.value as Role)}
                >
                  <option value="admin">Admin</option>
                  <option value="editor">Editor</option>
                  <option value="viewer">Viewer</option>
                </select>
              </div>
            )}
            {!canChangeRole && roleLabelOf(removePopover.uid) && (
              <p className="trip-share-bar-role-display">{roleLabelOf(removePopover.uid)}</p>
            )}
            {canRemove && (
              <>
                <p className="trip-share-bar-remove-question">Remove user from trip?</p>
                <div className="trip-share-bar-remove-actions">
                  <button className="trip-share-bar-remove-confirm" onClick={handleRemoveUser}>Remove</button>
                  <button className="trip-share-bar-remove-cancel" onClick={() => setRemovePopover(null)}>Cancel</button>
                </div>
              </>
            )}
          </div>
        </>
      )}

      {showModal && (
        <div className="share-modal-overlay" onClick={closeModal}>
          <div className="share-modal" onClick={e => e.stopPropagation()}>
            <h2 className="share-modal-title">Add Friends</h2>
            <p className="share-modal-subtitle">Submit their emails to share your trip with them!</p>

            <div
              className="share-modal-input-area"
              onClick={() => inputRef.current?.focus()}
            >
              {pills.map(pill => (
                <div
                  key={pill.id}
                  className={`share-modal-pill${!pill.isValidEmail ? ' share-modal-pill-invalid' : ''}`}
                >
                  <UserAvatar user={pill.user} size="sm" className="share-modal-pill-avatar" />
                  <span className="share-modal-pill-label">
                    {pill.resolving
                      ? pill.email
                      : pill.user
                        ? `${pill.user.firstName} ${pill.user.lastName}`.trim()
                        : pill.email}
                  </span>
                  <button
                    className="share-modal-pill-remove"
                    onClick={e => { e.stopPropagation(); setPills(prev => prev.filter(p => p.id !== pill.id)); }}
                    aria-label="Remove"
                  >
                    ×
                  </button>
                </div>
              ))}
              <input
                ref={inputRef}
                className="share-modal-input"
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={pills.length === 0 ? 'Enter email address...' : ''}
                autoFocus
              />
            </div>

            <div className="share-modal-role-row">
              <label className="share-modal-role-label">Invite as:</label>
              <select
                className="share-modal-role-select"
                value={inviteRole}
                onChange={e => setInviteRole(e.target.value as Role)}
              >
                {canChangeRole && <option value="admin">Admin</option>}
                <option value="editor">Editor</option>
                <option value="viewer">Viewer</option>
              </select>
            </div>

            <button className="share-modal-submit" onClick={handleShare}>
              Share
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default TripShareBar;
