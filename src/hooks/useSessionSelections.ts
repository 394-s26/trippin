import { useEffect, useRef, useState } from 'react';
import { collection, doc, setDoc, deleteDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { db } from '../services/firebase';

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
}

export function useSessionSelections(tripId: string, userId: string | undefined) {
  const [mySelectedIds, setMySelectedIds] = useState<string[]>([]);
  const [allSelections, setAllSelections] = useState<UserSelection[]>([]);
  const colorRef = useRef(userId ? hashColor(userId) : SESSION_COLORS[0]);

  useEffect(() => {
    if (!userId) return;

    const color = colorRef.current;
    const docRef = doc(db, 'sessions', tripId, 'selections', userId);

    setDoc(docRef, { uid: userId, color, selectedIds: [], lastActive: serverTimestamp() });

    const colRef = collection(db, 'sessions', tripId, 'selections');
    const unsub = onSnapshot(colRef, (snap) => {
      const selections: UserSelection[] = snap.docs.map(d => d.data() as UserSelection);
      setAllSelections(selections);
      const mine = selections.find(s => s.uid === userId);
      if (mine) setMySelectedIds(mine.selectedIds);
    });

    return () => {
      unsub();
      deleteDoc(docRef);
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
