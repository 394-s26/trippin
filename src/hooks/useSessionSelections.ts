import { useEffect, useRef, useState } from 'react';
import { collection, doc, setDoc, deleteDoc, onSnapshot, serverTimestamp, FirestoreError, Timestamp } from 'firebase/firestore';
import { db } from '../services/firebase';

const STALE_MS = 5 * 60 * 1000;
const HEARTBEAT_MS = 60 * 1000;

const SESSION_COLORS = [
  '#e53e3e',
  '#dd6b20',
  '#d69e2e',
  '#38a169',
  '#3182ce',
  '#805ad5',
  '#d53f8c',
  '#2b6cb0',
];

function hashColor(uid: string): string {
  let hash = 0;
  for (let i = 0; i < uid.length; i++) {
    hash = (hash * 31 + uid.charCodeAt(i)) >>> 0;
  }
  return SESSION_COLORS[hash % SESSION_COLORS.length];
}

export interface UserSelection {
  uid: string;
  color: string;
  selectedIds: string[];
  lastActive?: Timestamp;
}

export function useSessionSelections(tripId: string, userId: string | undefined) {
  const [mySelectedIds, setMySelectedIds] = useState<string[]>([]);
  const [allSelections, setAllSelections] = useState<UserSelection[]>([]);
  const colorRef = useRef(userId ? hashColor(userId) : SESSION_COLORS[0]);
  const mySelectedIdsRef = useRef<string[]>([]);
  mySelectedIdsRef.current = mySelectedIds;

  useEffect(() => {
    if (!userId) return;

    const color = colorRef.current;
    const docRef = doc(db, 'sessions', tripId, 'selections', userId);

    void setDoc(docRef, { uid: userId, color, selectedIds: [], lastActive: serverTimestamp() }).catch(
      (err: FirestoreError) => {
        console.error('[useSessionSelections] setDoc', tripId, err?.code, err?.message);
      }
    );

    const colRef = collection(db, 'sessions', tripId, 'selections');
    const unsub = onSnapshot(
      colRef,
      (snap) => {
        const now = Date.now();
        const selections: UserSelection[] = snap.docs
          .map(d => d.data() as UserSelection)
          .filter(s => !s.lastActive || now - s.lastActive.toMillis() < STALE_MS);
        setAllSelections(selections);
        const mine = selections.find(s => s.uid === userId);
        if (mine) setMySelectedIds(mine.selectedIds);
      },
      (err: FirestoreError) => {
        console.error('[useSessionSelections] onSnapshot selections', tripId, err?.code, err?.message);
      }
    );

    // Keep lastActive fresh so TTL filtering can detect stale sessions
    const heartbeat = setInterval(() => {
      void setDoc(docRef, { uid: userId, color, selectedIds: mySelectedIdsRef.current, lastActive: serverTimestamp() }).catch(() => {});
    }, HEARTBEAT_MS);

    // Best-effort cleanup when the browser tab/window is closed or refreshed
    const handleBeforeUnload = () => {
      void deleteDoc(docRef).catch(() => {});
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      clearInterval(heartbeat);
      unsub();
      void deleteDoc(docRef).catch(() => {
        /* best-effort: doc may be gone (e.g. after trip delete) or rules may deny */
      });
    };
  }, [tripId, userId]);

  const toggleSelection = async (eventId: string) => {
    if (!userId) return;

    const newIds = mySelectedIds.includes(eventId)
      ? mySelectedIds.filter(id => id !== eventId)
      : [...mySelectedIds, eventId];

    setMySelectedIds(newIds);

    const color = colorRef.current;
    const docRef = doc(db, 'sessions', tripId, 'selections', userId);
    await setDoc(docRef, { uid: userId, color, selectedIds: newIds, lastActive: serverTimestamp() });
  };

  const deselectAll = async () => {
    if (!userId) return;

    setMySelectedIds([]);

    const color = colorRef.current;
    const docRef = doc(db, 'sessions', tripId, 'selections', userId);
    await setDoc(docRef, { uid: userId, color, selectedIds: [], lastActive: serverTimestamp() });
  };

  return { mySelectedIds, allSelections, toggleSelection, deselectAll, myColor: colorRef.current };
}
