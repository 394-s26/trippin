import { useEffect, useRef, useState } from 'react';
import { AppUser } from '../../types/auth';
import {
  acquireNotesLock,
  releaseNotesLock,
  writeNotesContent,
  NOTES_LOCK_TTL_MS,
  TripNotes,
} from '../../services/firestoreMiscService';
import { PencilIcon, CheckIcon } from '../../services/svgIcons';
import './NotesSection.css';

interface NotesSectionProps {
  tripId: string;
  currentUid: string | null;
  notes: TripNotes | null;
  loading: boolean;
  tripUsers: AppUser[];
}

const WRITE_DEBOUNCE_MS = 500;
const HEARTBEAT_INTERVAL_MS = Math.floor(NOTES_LOCK_TTL_MS / 2);

const NotesSection = ({ tripId, currentUid, notes, loading, tripUsers }: NotesSectionProps) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [lockError, setLockError] = useState<string | null>(null);
  const writeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const latestDraftRef = useRef('');

  const now = Date.now();
  const lockExpired = !notes?.editingExpiresAt || notes.editingExpiresAt.toMillis() <= now;
  const lockedBy = notes?.editingBy && !lockExpired ? notes.editingBy : null;
  const lockedByMe = lockedBy === currentUid;
  const lockedByOther = lockedBy && !lockedByMe;
  const lockHolder = lockedByOther
    ? tripUsers.find((u) => u.uid === lockedBy)
    : null;

  // Remote content while not editing. While editing, show our own draft so
  // keystrokes feel instant (writes are async + debounced).
  const displayContent = editing ? draft : notes?.content ?? '';

  // Reflect remote updates into local draft when *we* are editing so if someone
  // somehow writes to our doc mid-edit we stay consistent. In practice the lock
  // prevents this, but it's a cheap safety net.
  useEffect(() => {
    if (!editing) setDraft(notes?.content ?? '');
  }, [notes?.content, editing]);

  // Tear down timers + release lock on unmount.
  useEffect(() => {
    return () => {
      if (writeTimerRef.current) clearTimeout(writeTimerRef.current);
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      if (editing && currentUid) {
        // Fire-and-forget — component is unmounting.
        releaseNotesLock(tripId, currentUid).catch(() => undefined);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // If our lock silently expires (long idle while editing), drop out of edit mode.
  useEffect(() => {
    if (!editing || !currentUid) return;
    if (notes?.editingBy && notes.editingBy !== currentUid) {
      // Someone else took over (shouldn't happen with our own lock, but defensive).
      setEditing(false);
      setLockError('Your edit session ended.');
    } else if (
      notes &&
      notes.editingBy === currentUid &&
      notes.editingExpiresAt &&
      notes.editingExpiresAt.toMillis() <= Date.now()
    ) {
      setEditing(false);
      setLockError('Your edit session expired.');
    }
  }, [notes, editing, currentUid]);

  const startEditing = async () => {
    if (!currentUid) return;
    setLockError(null);
    const acquired = await acquireNotesLock(tripId, currentUid);
    if (!acquired) {
      setLockError('Someone else is editing the notes right now.');
      return;
    }
    setDraft(notes?.content ?? '');
    latestDraftRef.current = notes?.content ?? '';
    setEditing(true);

    if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    heartbeatRef.current = setInterval(() => {
      // Heartbeat via a content write — updateNotesContent refreshes the TTL.
      writeNotesContent(tripId, currentUid, latestDraftRef.current).catch(() => undefined);
    }, HEARTBEAT_INTERVAL_MS);
  };

  const stopEditing = async () => {
    if (!currentUid) return;
    if (writeTimerRef.current) {
      clearTimeout(writeTimerRef.current);
      writeTimerRef.current = null;
    }
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }
    // Flush the latest draft before releasing.
    await writeNotesContent(tripId, currentUid, latestDraftRef.current).catch(() => undefined);
    await releaseNotesLock(tripId, currentUid).catch(() => undefined);
    setEditing(false);
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (!currentUid) return;
    const value = e.target.value;
    setDraft(value);
    latestDraftRef.current = value;
    if (writeTimerRef.current) clearTimeout(writeTimerRef.current);
    writeTimerRef.current = setTimeout(() => {
      writeNotesContent(tripId, currentUid, value).catch(() => undefined);
    }, WRITE_DEBOUNCE_MS);
  };

  if (loading) {
    return (
      <section className="misc-notes-section">
        <div className="misc-section-header">
          <h3 className="misc-section-title">Notes</h3>
        </div>
        <div className="misc-notes-loading">Loading…</div>
      </section>
    );
  }

  return (
    <section className="misc-notes-section">
      <div className="misc-section-header">
        <h3 className="misc-section-title">Notes</h3>
        <div className="misc-notes-meta">
          {lockedByOther && (
            <span className="misc-notes-editor-tag">
              {lockHolder ? `${lockHolder.firstName} is editing…` : 'Someone is editing…'}
            </span>
          )}
          {!editing && !lockedByOther && currentUid && (
            <button
              type="button"
              className="misc-notes-edit-btn"
              onClick={startEditing}
              aria-label="Edit notes"
            >
              <PencilIcon size={16} />
              <span>Edit</span>
            </button>
          )}
          {editing && (
            <button
              type="button"
              className="misc-notes-done-btn"
              onClick={stopEditing}
              aria-label="Finish editing notes"
            >
              <CheckIcon size={16} />
              <span>Done</span>
            </button>
          )}
        </div>
      </div>
      {lockError && <div className="misc-notes-error">{lockError}</div>}
      <textarea
        className={`misc-notes-textarea${editing ? ' misc-notes-textarea--editing' : ''}`}
        value={displayContent}
        onChange={handleChange}
        placeholder={editing ? 'Jot down anything — the group sees it live.' : 'No notes yet.'}
        readOnly={!editing}
        rows={8}
      />
    </section>
  );
};

export default NotesSection;
