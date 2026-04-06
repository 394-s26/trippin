import { useState, useEffect, useRef } from 'react';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase';
import { AppUser } from '../types/auth';
import UserAvatar from './UserAvatar';
import { Role } from '../config/permissions';
import { inviteMembers, removeMember, changeMemberRole } from '../services/firestoreTripService';
import { useAuth } from '../contexts/AuthContext';
import { PlusIcon } from '../services/svgIcons';
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

interface PendingAdd {
  pillId: string;
  email: string;
  user: AppUser | null;
  role: Role;
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
  const [pendingAdds, setPendingAdds] = useState<PendingAdd[]>([]);
  const [pendingRoles, setPendingRoles] = useState<Record<string, Role>>({});
  const [removeConfirmUid, setRemoveConfirmUid] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Banner variant — small remove popover
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

  // ── Pill management ─────────────────────────────────────────────────────────

  const addPill = async (email: string) => {
    const trimmed = email.trim();
    if (!trimmed) return;
    if (pills.some(p => p.email === trimmed)) return;
    const isValidEmail = EMAIL_RE.test(trimmed);
    const id = `${trimmed}-${Date.now()}`;

    if (!isValidEmail) {
      setPills(prev => [...prev, { id, email: trimmed, isValidEmail: false, user: null, resolving: false }]);
      return;
    }

    setPills(prev => [...prev, { id, email: trimmed, isValidEmail: true, user: null, resolving: true }]);
    setPendingAdds(prev => [...prev, { pillId: id, email: trimmed, user: null, role: 'editor' }]);

    const user = await lookupUserByEmail(trimmed);
    setPills(prev => prev.map(p => p.id === id ? { ...p, user, resolving: false } : p));
    setPendingAdds(prev => prev.map(pa => pa.pillId === id ? { ...pa, user } : pa));
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
      const validAdds = pendingAdds.filter(pa => pa.user && !shared.includes(pa.user.uid));
      const byRole = validAdds.reduce<Partial<Record<Role, string[]>>>((acc, pa) => {
        if (!acc[pa.role]) acc[pa.role] = [];
        acc[pa.role]!.push(pa.user!.uid);
        return acc;
      }, {});
      await Promise.all(
        Object.entries(byRole).map(([role, uids]) => inviteMembers(uid, tripId, uids!, role as Role))
      );
      await Promise.all(
        Object.entries(pendingRoles).map(([targetUid, newRole]) => changeMemberRole(uid, tripId, targetUid, newRole))
      );
      setPendingAdds([]);
      setPills([]);
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
  };

  const hasPendingChanges =
    pendingAdds.some(pa => pa.user && !shared.includes(pa.user.uid)) ||
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
        {sharedUsers.map((user, i) => (
          canRemove
            ? renderAvatarBtn(user, i, { marginLeft: i === 0 ? 0 : -10 })
            : <span key={user.uid} style={{ marginLeft: i === 0 ? 0 : -10, zIndex: sharedUsers.length - i + 1, display: 'contents' }}>
                {renderAvatar(user, i)}
              </span>
        ))}
        {canInvite && (
          <button className="trip-share-bar-add-btn" aria-label="Add user" onClick={() => setShowModal(true)}>
            {shared.length === 0 && <span className="trip-share-bar-add-label">Add Friends</span>}
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 21a8 8 0 0 1 13.292-6"/><circle cx="10" cy="8" r="5"/><path d="M19 16v6"/><path d="M22 19h-6"/>
            </svg>
          </button>
        )}
      </div>
      {shared.length !== 0 && (
        <button className="trip-share-bar-copy-btn" aria-label="Copy link" onClick={() => navigator.clipboard.writeText(window.location.href)}>
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 17H7A5 5 0 0 1 7 7h2"/><path d="M15 7h2a5 5 0 1 1 0 10h-2"/><line x1="8" x2="16" y1="12" y2="12"/>
          </svg>
        </button>
      )}
    </div>
  );

  // ── Card variant ─────────────────────────────────────────────────────────────
  const visibleUsers = sharedUsers.slice(0, MAX_CARD_AVATARS);
  const overflowCount = sharedUsers.length - visibleUsers.length;

  const cardContent = (
    <div className="trip-share-bar-card">
      {shared.length === 0 && <span className="trip-share-bar-empty-label">No friends invited yet...</span>}
      <div className="trip-share-bar-card-avatars">
        {visibleUsers.map((user, i) => (
          canRemove
            ? renderAvatarBtn(user, i, { marginLeft: i === 0 ? 0 : -10 })
            : <span key={user.uid} style={{ marginLeft: i === 0 ? 0 : -10, zIndex: sharedUsers.length - i + 1, display: 'contents' }}>
                {renderAvatar(user, i)}
              </span>
        ))}
        {overflowCount > 0 && (
          <div className="trip-share-bar-card-overflow" style={{ marginLeft: -10 }}>+{overflowCount}</div>
        )}
      </div>
      {canInvite && (
        <button className="trip-share-bar-card-invite-btn" onClick={() => setShowModal(true)} aria-label="Invite friends">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 21a8 8 0 0 1 13.292-6"/><circle cx="10" cy="8" r="5"/><path d="M19 16v6"/><path d="M22 19h-6"/>
          </svg>
          <span>Invite</span>
        </button>
      )}
    </div>
  );

  // ── Modal ────────────────────────────────────────────────────────────────────
  const modal = showModal && (
    <div className="share-modal-overlay" onClick={closeModal}>
      <div className="share-modal" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="share-modal-header">
          <div>
            <h2 className="share-modal-title">Manage Members</h2>
            <p className="share-modal-subtitle">Invite friends or update roles</p>
          </div>
          <button className="share-modal-close-btn" onClick={closeModal} aria-label="Close">×</button>
        </div>

        {/* Input row — only shown when canInvite */}
        {canInvite && (
          <div className="share-modal-input-row">
            <div className="share-modal-input-area" onClick={() => inputRef.current?.focus()}>
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
                    onClick={e => { e.stopPropagation(); removePillAndPending(pill.id); }}
                    aria-label="Remove"
                  >×</button>
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
            <button className="share-modal-send-btn" onClick={handleSendBtn} aria-label="Add email" disabled={!inputValue.trim()}>
              <PlusIcon size={18} />
            </button>
          </div>
        )}

        {/* Member list */}
        {(sharedUsers.length > 0 || pendingAdds.length > 0) && (
          <>
            <div className="share-modal-divider" />
            <table className="share-modal-members">
              <tbody className="share-modal-members-body">

                {/* Existing members */}
                {sharedUsers.map(user => {
                  const currentRole = (permissions[user.uid] ?? 'editor') as Role;
                  const pendingRole = pendingRoles[user.uid];
                  const hasPending = pendingRole !== undefined;
                  const displayRole = pendingRole ?? currentRole;
                  const isConfirming = removeConfirmUid === user.uid;

                  return (
                    <>
                      <tr key={user.uid} className="share-modal-member-row">
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
                              <option value="admin">Admin</option>
                              <option value="editor">Editor</option>
                              <option value="viewer">Viewer</option>
                            </select>
                          ) : (
                            <span className="share-modal-member-role-badge">{currentRole}</span>
                          )}
                        </td>
                        <td className="share-modal-td-remove">
                          {canRemove && (
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
                    </>
                  );
                })}

                {/* Pending new users (from pills) */}
                {pendingAdds.map(pa => (
                  <tr key={pa.pillId} className="share-modal-member-row">
                    <td className="share-modal-td-status">
                      <span className="share-modal-pending-dot" />
                    </td>
                    <td className="share-modal-td-avatar">
                      <UserAvatar user={pa.user} size="sm" />
                    </td>
                    <td className="share-modal-td-name share-modal-td-name--pending">
                      {pa.user
                        ? `${pa.user.firstName} ${pa.user.lastName}`.trim()
                        : pa.email}
                    </td>
                    <td className="share-modal-td-role">
                      <select
                        className="share-modal-member-role-select"
                        value={pa.role}
                        onChange={e => handlePendingRoleChange(pa.pillId, e.target.value as Role)}
                      >
                        {canChangeRole && <option value="admin">Admin</option>}
                        <option value="editor">Editor</option>
                        <option value="viewer">Viewer</option>
                      </select>
                    </td>
                    <td className="share-modal-td-remove" />
                  </tr>
                ))}

              </tbody>
            </table>
          </>
        )}

        {sharedUsers.length === 0 && pendingAdds.length === 0 && (
          <p className="share-modal-empty">No members yet. Invite friends above!</p>
        )}

        {/* Save button */}
        {hasPendingChanges && (
          <button
            className="share-modal-save-btn"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        )}
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
    </>
  );
};

export default TripShareBar;
