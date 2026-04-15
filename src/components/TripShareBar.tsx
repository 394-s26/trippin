import { useState, useEffect, useRef, Fragment } from 'react';
import { createPortal } from 'react-dom';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase';
import { AppUser } from '../types/auth';
import UserAvatar from './UserAvatar';
import { Role, ASSIGNABLE_ROLES, ROLE_PERMISSIONS } from '../config/permissions';
import { inviteMembers, removeMember, changeMemberRole } from '../services/firestoreTripService';
import { sendInviteEmail, subscribeToPendingInvites, cancelInvite, PendingInvite } from '../services/inviteService';
import { useAuth } from '../contexts/AuthContext';
import { PlusIcon, SaveIcon } from '../services/svgIcons';
import './TripShareBar.css';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_CARD_AVATARS = 3;

interface EmailPill {
  id: string;
  email: string;
  isValidEmail: boolean;
  user: AppUser | null;
  resolving: boolean;
  /** true when the email is valid but no account exists — eligible for email invite */
  isUnregistered: boolean;
}

interface PendingAdd {
  pillId: string;
  email: string;
  user: AppUser | null;
  role: Role;
  /** true when this add will be an email invite instead of a direct share */
  isInvite: boolean;
}

interface RemovePopover {
  uid: string;
  top: number;
  left: number;
}

interface TripShareBarProps {
  shared: string[];
  tripId: string;
  tripName?: string;
  ownerId?: string;
  permissions?: Record<string, Role>;
  canInvite?: boolean;
  canRemove?: boolean;
  canChangeRole?: boolean;
  variant?: 'banner' | 'card';
  onBeforeOpen?: () => void;
}

const TripShareBar = ({
  shared, tripId, tripName = '', ownerId,  permissions = {},
  canInvite = false, canRemove = false, canChangeRole = false,
  variant = 'banner', onBeforeOpen,
}: TripShareBarProps) => {
  const { appUser } = useAuth();
  const uid = appUser?.uid ?? '';

  const [sharedUsers, setSharedUsers] = useState<AppUser[]>([]);
  const [ownerUser, setOwnerUser] = useState<AppUser | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [pills, setPills] = useState<EmailPill[]>([]);
  const [pendingAdds, setPendingAdds] = useState<PendingAdd[]>([]);
  const [pendingRoles, setPendingRoles] = useState<Record<string, Role>>({});
  const [removeConfirmUid, setRemoveConfirmUid] = useState<string | null>(null);
  const [removeConfirmInviteId, setRemoveConfirmInviteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [inviteStatus, setInviteStatus] = useState<Record<string, 'sending' | 'sent' | 'error'>>({});
  const [duplicateError, setDuplicateError] = useState<string | null>(null);
  const [highlightedMember, setHighlightedMember] = useState<string | null>(null);

  // Persisted pending invites loaded from Firestore (invites that were already sent)
  const [persistedInvites, setPersistedInvites] = useState<PendingInvite[]>([]);

  // Banner variant — small remove popover
  const [removePopover, setRemovePopover] = useState<RemovePopover | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const copyBtnRef = useRef<HTMLButtonElement>(null);
  const [copiedPos, setCopiedPos] = useState<{ top: number; left: number } | null>(null);

  const sharedKey = shared.join(',');
  useEffect(() => {
    if (!shared.length) { setSharedUsers([]); return; }
    Promise.all(shared.map(u => getDoc(doc(db, 'users', u)))).then(docs => {
      setSharedUsers(docs.filter(d => d.exists()).map(d => d.data() as AppUser));
    });
  }, [sharedKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!ownerId) { setOwnerUser(null); return; }
    getDoc(doc(db, 'users', ownerId)).then(d => {
      setOwnerUser(d.exists() ? (d.data() as AppUser) : null);
    });
  }, [ownerId]);

  // Real-time subscription to pending invites — auto-updates when a user signs up
  useEffect(() => {
    const unsubscribe = subscribeToPendingInvites(tripId, setPersistedInvites);
    return () => unsubscribe();
  }, [tripId]);

  const lookupUserByEmail = async (email: string): Promise<AppUser | null> => {
    const snap = await getDocs(query(collection(db, 'users'), where('email', '==', email)));
    return snap.empty ? null : (snap.docs[0].data() as AppUser);
  };

  // ── Pill management ─────────────────────────────────────────────────────────

  const addPill = async (email: string) => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) return;

    // Duplicate checks — highlight the existing row and show a brief note
    const flashMember = (key: string) => {
      setDuplicateError('Already added ↓');
      setHighlightedMember(key);
      setTimeout(() => setHighlightedMember(null), 1500);
    };

    if (ownerUser?.email?.toLowerCase() === trimmed) {
      flashMember(ownerUser.uid);
      return;
    }
    const existingMember = sharedUsers.find(u => u.email?.toLowerCase() === trimmed);
    if (existingMember) {
      flashMember(existingMember.uid);
      return;
    }
    if (pills.some(p => p.email === trimmed)) {
      setDuplicateError('Already added above');
      return;
    }
    const existingInvite = persistedInvites.find(inv => inv.email === trimmed);
    if (existingInvite) {
      flashMember(existingInvite.id);
      return;
    }

    setDuplicateError(null);
    const isValidEmail = EMAIL_RE.test(trimmed);
    const id = `${trimmed}-${Date.now()}`;

    if (!isValidEmail) {
      setPills(prev => [...prev, { id, email: trimmed, isValidEmail: false, user: null, resolving: false, isUnregistered: false }]);
      return;
    }

    setPills(prev => [...prev, { id, email: trimmed, isValidEmail: true, user: null, resolving: true, isUnregistered: false }]);
    setPendingAdds(prev => [...prev, { pillId: id, email: trimmed, user: null, role: ASSIGNABLE_ROLES[0], isInvite: false }]);

    const user = await lookupUserByEmail(trimmed);
    const isUnregistered = !user;
    setPills(prev => prev.map(p => p.id === id ? { ...p, user, resolving: false, isUnregistered } : p));
    setPendingAdds(prev => prev.map(pa => pa.pillId === id ? { ...pa, user, isInvite: isUnregistered } : pa));
  };

  const removePillAndPending = (pillId: string) => {
    setPills(prev => prev.filter(p => p.id !== pillId));
    setPendingAdds(prev => prev.filter(pa => pa.pillId !== pillId));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (inputValue.trim()) { addPill(inputValue); setInputValue(''); }
    } else if (e.key === 'Backspace' && !inputValue) {
      const last = pills[pills.length - 1];
      if (last) removePillAndPending(last.id);
    }
  };

  const handleSendBtn = () => {
    if (inputValue.trim()) { addPill(inputValue); setInputValue(''); }
  };

  // ── Role & removal handlers ──────────────────────────────────────────────────

  const handleExistingRoleChange = (targetUid: string, newRole: Role) => {
    const current = permissions[targetUid] ?? 'editor';
    if (current === newRole) {
      setPendingRoles(prev => { const n = { ...prev }; delete n[targetUid]; return n; });
    } else {
      setPendingRoles(prev => ({ ...prev, [targetUid]: newRole }));
    }
  };

  const handlePendingRoleChange = (pillId: string, newRole: Role) => {
    setPendingAdds(prev => prev.map(pa => pa.pillId === pillId ? { ...pa, role: newRole } : pa));
  };

  const handleRemoveConfirm = async () => {
    if (!removeConfirmUid) return;
    await removeMember(uid, tripId, removeConfirmUid);
    setPendingRoles(prev => { const n = { ...prev }; delete n[removeConfirmUid!]; return n; });
    setRemoveConfirmUid(null);
  };

  // ── Save all pending changes ─────────────────────────────────────────────────

  const handleSave = async () => {
    setSaving(true);
    try {
      // 1. Add existing users directly
      const validAdds = pendingAdds.filter(pa => pa.user && !shared.includes(pa.user.uid));
      const byRole = validAdds.reduce<Partial<Record<Role, string[]>>>((acc, pa) => {
        if (!acc[pa.role]) acc[pa.role] = [];
        acc[pa.role]!.push(pa.user!.uid);
        return acc;
      }, {});
      await Promise.all(
        Object.entries(byRole).map(([role, uids]) => inviteMembers(uid, tripId, uids!, role as Role))
      );

      // 2. Send email invites for unregistered users
      const emailInvites = pendingAdds.filter(pa => pa.isInvite);
      for (const invite of emailInvites) {
        setInviteStatus(prev => ({ ...prev, [invite.pillId]: 'sending' }));
        try {
          await sendInviteEmail({
            email: invite.email,
            tripId,
            tripName: tripName || 'a trip',
            role: invite.role,
          });
          setInviteStatus(prev => ({ ...prev, [invite.pillId]: 'sent' }));
        } catch {
          setInviteStatus(prev => ({ ...prev, [invite.pillId]: 'error' }));
        }
      }

      // 3. Update roles for existing members
      await Promise.all(
        Object.entries(pendingRoles).map(([targetUid, newRole]) => changeMemberRole(uid, tripId, targetUid, newRole))
      );

      // Real-time subscription auto-updates persisted invites — no manual refresh needed

      // Clear successfully added members (keep failed invites visible)
      const failedPillIds = new Set(
        emailInvites
          .filter(inv => inviteStatus[inv.pillId] === 'error')
          .map(inv => inv.pillId)
      );
      setPendingAdds(prev => prev.filter(pa => failedPillIds.has(pa.pillId)));
      setPills(prev => prev.filter(p => failedPillIds.has(p.id)));
      setPendingRoles({});
    } catch (err) {
      console.error('Failed to save changes:', err);
    } finally {
      setSaving(false);
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setPills([]);
    setPendingAdds([]);
    setPendingRoles({});
    setInputValue('');
    setRemoveConfirmUid(null);
    setRemoveConfirmInviteId(null);
    setInviteStatus({});
    setDuplicateError(null);
    setHighlightedMember(null);
  };

  const hasPendingChanges =
    pendingAdds.some(pa => (pa.user && !shared.includes(pa.user.uid)) || pa.isInvite) ||
    Object.keys(pendingRoles).length > 0;

  // ── Render helpers ───────────────────────────────────────────────────────────

  const renderAvatar = (user: AppUser, _i: number, style?: React.CSSProperties) => (
    <UserAvatar user={user} size="md" bordered style={style} />
  );

  const renderAvatarBtn = (user: AppUser, i: number, style?: React.CSSProperties) => (
    <button
      key={user.uid}
      className="trip-share-bar-avatar-btn"
      style={{ ...style, zIndex: removePopover?.uid === user.uid ? 999 : sharedUsers.length - i + 1 }}
      onClick={e => {
        onBeforeOpen?.();
        if (removePopover?.uid === user.uid) { setRemovePopover(null); return; }
        const rect = e.currentTarget.getBoundingClientRect();
        setRemovePopover({ uid: user.uid, top: rect.bottom + 8, left: rect.left + rect.width / 2 });
      }}
      aria-label={`Manage ${user.firstName}`}
    >
      {renderAvatar(user, i)}
    </button>
  );

  const roleLabelOf = (targetUid: string) => {
    const r = permissions[targetUid];
    return r ? r.charAt(0).toUpperCase() + r.slice(1) : '';
  };

  // ── Banner variant ───────────────────────────────────────────────────────────
  const bannerContent = (
    <div className="trip-share-bar">
      <div className="trip-share-bar-users">
        {ownerUser && (
          <span key={ownerUser.uid} style={{ marginLeft: 0, zIndex: sharedUsers.length + 2, display: 'contents' }}>
            {renderAvatar(ownerUser, -1)}
          </span>
        )}
        {sharedUsers.map((user, i) => (
          canRemove || user.uid === uid
            ? renderAvatarBtn(user, i, { marginLeft: -10 })
            : <span key={user.uid} style={{ marginLeft: ownerUser || i > 0 ? -10 : 0, zIndex: sharedUsers.length - i + 1, display: 'contents' }}>
                {renderAvatar(user, i)}
              </span>
        ))}
        {canInvite && (
          <button className="trip-share-bar-add-btn" aria-label="Add user" onClick={() => { onBeforeOpen?.(); setShowModal(true); }}>
            {shared.length === 0 && <span className="trip-share-bar-add-label">Add Friends</span>}
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 21a8 8 0 0 1 13.292-6"/><circle cx="10" cy="8" r="5"/><path d="M19 16v6"/><path d="M22 19h-6"/>
            </svg>
          </button>
        )}
      </div>
      <button
        ref={copyBtnRef}
        className={`trip-share-bar-copy-btn${copied ? ' trip-share-bar-copy-btn--copied' : ''}`}
        aria-label="Copy link"
        onClick={() => {
          onBeforeOpen?.();
          navigator.clipboard.writeText(window.location.href);
          if (copyBtnRef.current) {
            const rect = copyBtnRef.current.getBoundingClientRect();
            setCopiedPos({ top: rect.bottom + 8, left: rect.left + rect.width / 2 });
          }
          setCopied(true);
          setTimeout(() => { setCopied(false); setCopiedPos(null); }, 2000);
        }}
      >
        {copied ? (
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 17H7A5 5 0 0 1 7 7h2"/><path d="M15 7h2a5 5 0 1 1 0 10h-2"/><line x1="8" x2="16" y1="12" y2="12"/>
          </svg>
        )}
      </button>
    </div>
  );

  const copiedPortal = copiedPos
    ? createPortal(
        <span
          className="trip-share-bar-copied-text"
          style={{ top: copiedPos.top, left: copiedPos.left }}
        >
          Copied!
        </span>,
        document.body
      )
    : null;

  // ── Card variant ─────────────────────────────────────────────────────────────
  const allCardUsers = ownerUser ? [ownerUser, ...sharedUsers] : sharedUsers;
  const visibleUsers = allCardUsers.slice(0, MAX_CARD_AVATARS);
  const overflowCount = allCardUsers.length - visibleUsers.length;

  const cardContent = (
    <div className="trip-share-bar-card">
      {shared.length === 0 && !ownerUser && <span className="trip-share-bar-empty-label">No friends invited yet...</span>}
      <div className="trip-share-bar-card-avatars">
        {visibleUsers.map((user, i) => {
          const isOwner = user.uid === ownerId;
          return isOwner || (!canRemove && user.uid !== uid)
            ? <span key={user.uid} style={{ marginLeft: i === 0 ? 0 : -10, zIndex: allCardUsers.length - i + 1, display: 'contents' }}>
                {renderAvatar(user, i)}
              </span>
            : renderAvatarBtn(user, i, { marginLeft: i === 0 ? 0 : -10 });
        })}
        {overflowCount > 0 && (
          <div className="trip-share-bar-card-overflow" style={{ marginLeft: -10 }}>+{overflowCount}</div>
        )}
      </div>
      <div className="trip-share-bar-card-actions">
        {canInvite && (
          <button className="trip-share-bar-card-invite-btn" onClick={() => { onBeforeOpen?.(); setShowModal(true); }} aria-label="Invite friends">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 21a8 8 0 0 1 13.292-6"/><circle cx="10" cy="8" r="5"/><path d="M19 16v6"/><path d="M22 19h-6"/>
            </svg>
            <span>Invite</span>
          </button>
        )}
        <button
          className={`trip-share-bar-card-copy-btn${copied ? ' trip-share-bar-card-copy-btn--copied' : ''}`}
          aria-label="Copy link"
          onClick={() => {
            onBeforeOpen?.();
            navigator.clipboard.writeText(window.location.href);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }}
        >
          {copied ? (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              <span>Copied!</span>
            </>
          ) : (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 17H7A5 5 0 0 1 7 7h2"/><path d="M15 7h2a5 5 0 1 1 0 10h-2"/><line x1="8" x2="16" y1="12" y2="12"/>
              </svg>
              <span>Copy Link</span>
            </>
          )}
        </button>
      </div>
    </div>
  );

  // ── Modal ────────────────────────────────────────────────────────────────────
  const modal = showModal && (
    <div className="overlay-center" onClick={closeModal}>
      <div className="share-modal" onClick={e => e.stopPropagation()}>
      <div className="overlay-panel overlay-panel--md rounded-2xl p-6 shadow-xl flex flex-col">

        {/* Header */}
        <div className="share-modal-header">
          <div>
            <h2 className="share-modal-title">Manage Members</h2>
            <p className="share-modal-subtitle">Invite friends or update roles</p>
          </div>
          <button className="share-modal-close-btn" onClick={closeModal} aria-label="Close">×</button>
        </div>
        {/* Role guide */}
        <p className="share-modal-roles-heading">Trip Roles</p>
        <div className="share-modal-role-guide">
        <div className="share-modal-role-guide-item">
          <span className="share-modal-role-guide-emoji">🪂</span>
          <span className="share-modal-role-guide-label">Manager</span>
          <span className="share-modal-role-guide-desc">
            For the friend who needs control. Full access to plan and manage the trip.
          </span>
        </div>
        <div className="share-modal-role-guide-item">
          <span className="share-modal-role-guide-emoji">🚣‍♂️</span>
          <span className="share-modal-role-guide-label">Explorer</span>
          <span className="share-modal-role-guide-desc">
            Here for the vibes. Suggests trip ideas and lets the group decide.
          </span>
        </div>
      </div>

        {/* Input row — only shown when canInvite */}
        {canInvite && (
          <>
          <div className="share-modal-input-row">
            <div className="share-modal-input-area" onClick={() => inputRef.current?.focus()}>
              {pills.map(pill => (
                <div
                  key={pill.id}
                  className={`share-modal-pill${!pill.isValidEmail ? ' share-modal-pill-invalid' : ''}${pill.isUnregistered ? ' share-modal-pill-invite' : ''}`}
                >
                  {pill.isUnregistered ? (
                    <span className="share-modal-pill-envelope">
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
                      </svg>
                    </span>
                  ) : (
                    <UserAvatar user={pill.user} size="sm" className="share-modal-pill-avatar" />
                  )}
                  <span className="share-modal-pill-label">
                    {pill.resolving
                      ? pill.email
                      : pill.user
                        ? `${pill.user.firstName} ${pill.user.lastName}`.trim()
                        : pill.email}
                  </span>
                  <button
                    className="share-modal-pill-remove"
                    onClick={e => { e.stopPropagation(); removePillAndPending(pill.id); }}
                    aria-label="Remove"
                  >×</button>
                </div>
              ))}
              <input
                ref={inputRef}
                className="share-modal-input"
                value={inputValue}
                onChange={e => { setInputValue(e.target.value); setDuplicateError(null); }}
                onKeyDown={handleKeyDown}
                placeholder={pills.length === 0 ? 'Enter email address...' : ''}
                autoFocus
              />
            </div>
            <button className="share-modal-send-btn" onClick={handleSendBtn} aria-label="Add email" disabled={!inputValue.trim()}>
              <PlusIcon size={18} />
            </button>
          </div>
          {duplicateError && (
            <p className="share-modal-duplicate-error">{duplicateError}</p>
          )}
          </>
        )}

        {/* Member list */}
        {(ownerUser || sharedUsers.length > 0 || pendingAdds.length > 0 || persistedInvites.length > 0) && (
          <>
            <div className="share-modal-divider" />
            <table className="share-modal-members">
              <tbody className="share-modal-members-body">

                {/* Owner row — no remove button, role shown as "Owner" */}
                {ownerUser && (
                  <tr className={`share-modal-member-row${highlightedMember === ownerUser.uid ? ' share-modal-member-row--highlight' : ''}`}>
                    <td className="share-modal-td-status" />
                    <td className="share-modal-td-avatar">
                      <UserAvatar user={ownerUser} size="sm" />
                    </td>
                    <td className="share-modal-td-name">
                      {ownerUser.firstName} {ownerUser.lastName}
                    </td>
                    <td className="share-modal-td-role">
                      <span className="share-modal-member-role-badge">Owner</span>
                    </td>
                    <td className="share-modal-td-remove" />
                  </tr>
                )}

                {/* Existing members */}
                {sharedUsers.map(user => {
                  const currentRole = (permissions[user.uid] ?? 'editor') as Role;
                  const pendingRole = pendingRoles[user.uid];
                  const hasPending = pendingRole !== undefined;
                  const displayRole = pendingRole ?? currentRole;
                  const isConfirming = removeConfirmUid === user.uid;

                  return (
                    <Fragment key={user.uid}>
                      <tr className={`share-modal-member-row${highlightedMember === user.uid ? ' share-modal-member-row--highlight' : ''}`}>
                        <td className="share-modal-td-status">
                          {hasPending && <span className="share-modal-pending-dot" />}
                        </td>
                        <td className="share-modal-td-avatar">
                          <UserAvatar user={user} size="sm" />
                        </td>
                        <td className="share-modal-td-name">
                          {user.firstName} {user.lastName}
                        </td>
                        <td className="share-modal-td-role">
                          {canChangeRole ? (
                            <select
                              className="share-modal-member-role-select"
                              value={displayRole}
                              onChange={e => handleExistingRoleChange(user.uid, e.target.value as Role)}
                            >
                              {ASSIGNABLE_ROLES.map(role => (
                                <option key={role} value={role}>{role.charAt(0).toUpperCase() + role.slice(1)}</option>
                              ))}
                            </select>
                          ) : (
                            <span className="share-modal-member-role-badge">{currentRole}</span>
                          )}
                        </td>
                        <td className="share-modal-td-remove">
                          {(canRemove || user.uid === uid) && (
                            <button
                              className="share-modal-member-remove-btn"
                              onClick={() => setRemoveConfirmUid(isConfirming ? null : user.uid)}
                              aria-label={`Remove ${user.firstName}`}
                            >×</button>
                          )}
                        </td>
                      </tr>
                      {isConfirming && (
                        <tr className="share-modal-confirm-row">
                          <td colSpan={5}>
                            <div className="share-modal-remove-confirm">
                              <p className="share-modal-remove-confirm-text">Remove {user.firstName} from this trip?</p>
                              <div className="share-modal-remove-confirm-actions">
                                <button className="share-modal-remove-confirm-btn" onClick={handleRemoveConfirm}>Remove</button>
                                <button className="share-modal-remove-cancel-btn" onClick={() => setRemoveConfirmUid(null)}>Cancel</button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}

                {/* Persisted pending invites (sent but user hasn't signed up yet) */}
                {persistedInvites.map(inv => {
                  const isConfirming = removeConfirmInviteId === inv.id;
                  return (
                    <Fragment key={inv.id}>
                      <tr className={`share-modal-member-row${highlightedMember === inv.id ? ' share-modal-member-row--highlight' : ''}`}>
                        <td className="share-modal-td-status">
                          <span className="share-modal-pending-invite-dot" title="Awaiting signup" />
                        </td>
                        <td className="share-modal-td-avatar">
                          <span className="share-modal-invite-icon" title="Not on Trippin yet">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                              <rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
                            </svg>
                          </span>
                        </td>
                        <td className="share-modal-td-name share-modal-td-name--pending">
                          <span>{inv.email}</span>
                          <span className="share-modal-pending-badge">Pending</span>
                        </td>
                        <td className="share-modal-td-role">
                          <span className="share-modal-member-role-badge">{inv.role.charAt(0).toUpperCase() + inv.role.slice(1)}</span>
                        </td>
                        <td className="share-modal-td-remove">
                          {(canRemove || inv.invitedBy === uid) && (
                            <button
                              className="share-modal-member-remove-btn"
                              onClick={() => setRemoveConfirmInviteId(isConfirming ? null : inv.id)}
                              aria-label={`Cancel invite for ${inv.email}`}
                            >×</button>
                          )}
                        </td>
                      </tr>
                      {isConfirming && (
                        <tr className="share-modal-confirm-row">
                          <td colSpan={5}>
                            <div className="share-modal-remove-confirm">
                              <p className="share-modal-remove-confirm-text">Cancel invite for {inv.email}?</p>
                              <div className="share-modal-remove-confirm-actions">
                                <button
                                  className="share-modal-remove-confirm-btn"
                                  onClick={async () => {
                                    await cancelInvite(inv.id);
                                    setPersistedInvites(prev => prev.filter(i => i.id !== inv.id));
                                    setRemoveConfirmInviteId(null);
                                  }}
                                >Cancel Invite</button>
                                <button
                                  className="share-modal-remove-cancel-btn"
                                  onClick={() => setRemoveConfirmInviteId(null)}
                                >Keep</button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}

                {/* Pending new users (from pills) */}
                {pendingAdds.map(pa => {
                  const status = inviteStatus[pa.pillId];
                  return (
                    <tr key={pa.pillId} className="share-modal-member-row">
                      <td className="share-modal-td-status">
                        {status === 'sent' ? (
                          <span className="share-modal-sent-dot" title="Invite sent" />
                        ) : status === 'error' ? (
                          <span className="share-modal-error-dot" title="Failed to send" />
                        ) : (
                          <span className="share-modal-pending-dot" />
                        )}
                      </td>
                      <td className="share-modal-td-avatar">
                        {pa.isInvite ? (
                          <span className="share-modal-invite-icon" title="Not on Trippin yet">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                              <rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
                            </svg>
                          </span>
                        ) : (
                          <UserAvatar user={pa.user} size="sm" />
                        )}
                      </td>
                      <td className="share-modal-td-name share-modal-td-name--pending">
                        <span>
                          {pa.user
                            ? `${pa.user.firstName} ${pa.user.lastName}`.trim()
                            : pa.email}
                        </span>
                        {pa.isInvite && (
                          <span className="share-modal-invite-badge">
                            {status === 'sent' ? 'Invite sent!' : status === 'error' ? 'Failed — retry' : 'Will receive invite email'}
                          </span>
                        )}
                      </td>
                      <td className="share-modal-td-role">
                        <select
                          className="share-modal-member-role-select"
                          value={pa.role}
                          onChange={e => handlePendingRoleChange(pa.pillId, e.target.value as Role)}
                          disabled={status === 'sent'}
                        >
                          {ASSIGNABLE_ROLES
                            .filter(role => canChangeRole || !ROLE_PERMISSIONS[role].includes('change_member_role'))
                            .map(role => (
                              <option key={role} value={role}>{role.charAt(0).toUpperCase() + role.slice(1)}</option>
                            ))}
                        </select>
                      </td>
                      <td className="share-modal-td-remove" />
                    </tr>
                  );
                })}

              </tbody>
            </table>
          </>
        )}

        {!ownerUser && sharedUsers.length === 0 && pendingAdds.length === 0 && persistedInvites.length === 0 && (
          <p className="share-modal-empty">No members yet. Invite friends above!</p>
        )}

        {/* Save button */}
        {hasPendingChanges && (
          <button
            className={`share-modal-save-btn${pendingAdds.some(pa => pa.isInvite && inviteStatus[pa.pillId] !== 'sent') ? ' share-modal-save-btn--invite' : ''}`}
            onClick={handleSave}
            disabled={saving}
          >
            <SaveIcon size={16} />
            {saving
              ? 'Saving…'
              : pendingAdds.some(pa => pa.isInvite && inviteStatus[pa.pillId] !== 'sent')
                ? 'Save & Send Invites'
                : 'Save Changes'}
          </button>
        )}
      </div>
      </div>
    </div>
  );

  // ── Banner remove popover ────────────────────────────────────────────────────
  const bannerPopover = removePopover && (
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
              onChange={async e => {
                await changeMemberRole(uid, tripId, removePopover.uid, e.target.value as Role);
              }}
            >
              {ASSIGNABLE_ROLES.map(role => (
                <option key={role} value={role}>{role.charAt(0).toUpperCase() + role.slice(1)}</option>
              ))}
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
              <button className="trip-share-bar-remove-confirm" onClick={async () => {
                await removeMember(uid, tripId, removePopover.uid);
                setRemovePopover(null);
              }}>Remove</button>
              <button className="trip-share-bar-remove-cancel" onClick={() => setRemovePopover(null)}>Cancel</button>
            </div>
          </>
        )}
      </div>
    </>
  );

  return (
    <>
      {variant === 'banner' ? bannerContent : cardContent}
      {bannerPopover}
      {modal}
      {copiedPortal}
    </>
  );
};

export default TripShareBar;
