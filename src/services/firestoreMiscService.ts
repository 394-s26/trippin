import { db, storage } from './firebase';
import {
  collection,
  doc,
  onSnapshot,
  deleteDoc,
  runTransaction,
  query,
  orderBy,
  Timestamp,
  FirestoreError,
  serverTimestamp,
  addDoc,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';

// ────────────────────────────────────────────────────────────────────────────
// Notes — one doc per trip at trips/{tripId}/notes/current.
// Real-time content sync with a soft-lock: only one user at a time holds the
// editing lock; content updates stream live while they type so other members
// see keystrokes.
// ────────────────────────────────────────────────────────────────────────────

export const NOTES_LOCK_TTL_MS = 60_000;

export interface TripNotes {
  content: string;
  editingBy: string | null;
  editingExpiresAt: Timestamp | null;
  updatedAt: Timestamp | null;
  updatedBy: string | null;
}

const notesDocRef = (tripId: string) => doc(db, 'trips', tripId, 'notes', 'current');

export const subscribeToNotes = (
  tripId: string,
  callback: (notes: TripNotes | null) => void,
): (() => void) => {
  return onSnapshot(
    notesDocRef(tripId),
    (snap) => {
      if (!snap.exists()) return callback(null);
      callback(snap.data() as TripNotes);
    },
    (err: FirestoreError) => {
      console.error('[subscribeToNotes]', tripId, err.code, err.message);
    },
  );
};

// Attempts to acquire the notes edit lock. Returns false if another user holds
// an un-expired lock.
export const acquireNotesLock = async (tripId: string, uid: string): Promise<boolean> => {
  const ref = notesDocRef(tripId);
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const nowMs = Date.now();
    const data = snap.exists() ? (snap.data() as TripNotes) : null;
    const expiresMs = data?.editingExpiresAt?.toMillis() ?? 0;
    const heldByOther = data?.editingBy && data.editingBy !== uid && expiresMs > nowMs;
    if (heldByOther) return false;

    const expires = Timestamp.fromMillis(nowMs + NOTES_LOCK_TTL_MS);
    if (!snap.exists()) {
      tx.set(ref, {
        content: '',
        editingBy: uid,
        editingExpiresAt: expires,
        updatedAt: null,
        updatedBy: null,
      });
    } else {
      tx.update(ref, { editingBy: uid, editingExpiresAt: expires });
    }
    return true;
  });
};

// Writes new content + refreshes the lock TTL. Only succeeds if the caller
// still holds the lock.
export const writeNotesContent = async (
  tripId: string,
  uid: string,
  content: string,
): Promise<boolean> => {
  const ref = notesDocRef(tripId);
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) return false;
    const data = snap.data() as TripNotes;
    const nowMs = Date.now();
    if (data.editingBy !== uid || (data.editingExpiresAt?.toMillis() ?? 0) <= nowMs) {
      return false;
    }
    tx.update(ref, {
      content,
      editingExpiresAt: Timestamp.fromMillis(nowMs + NOTES_LOCK_TTL_MS),
      updatedAt: serverTimestamp(),
      updatedBy: uid,
    });
    return true;
  });
};

export const releaseNotesLock = async (tripId: string, uid: string): Promise<void> => {
  const ref = notesDocRef(tripId);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) return;
    const data = snap.data() as TripNotes;
    if (data.editingBy === uid) {
      tx.update(ref, { editingBy: null, editingExpiresAt: null });
    }
  });
};

// ────────────────────────────────────────────────────────────────────────────
// Photos — stored under trips/{tripId}/photos/{photoId}. Files live at
// tripPhotos/{tripId}/{uploaderUid}/{timestamp}_{name}. Any trip member can
// upload; only the uploader can delete.
// ────────────────────────────────────────────────────────────────────────────

export interface TripPhoto {
  id: string;
  tripId: string;
  uploaderUid: string;
  url: string;
  storagePath: string;
  fileName: string;
  uploadedAt: Timestamp;
}

const photosCol = (tripId: string) => collection(db, 'trips', tripId, 'photos');

export const subscribeToTripPhotos = (
  tripId: string,
  callback: (photos: TripPhoto[]) => void,
): (() => void) => {
  const q = query(photosCol(tripId), orderBy('uploadedAt', 'desc'));
  return onSnapshot(
    q,
    (snap) => {
      const photos = snap.docs.map((d) => ({ ...(d.data() as Omit<TripPhoto, 'id'>), id: d.id }));
      callback(photos);
    },
    (err: FirestoreError) => {
      console.error('[subscribeToTripPhotos]', tripId, err.code, err.message);
    },
  );
};

const sanitizeFileName = (name: string): string =>
  name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 100);

export const uploadTripPhoto = async (
  tripId: string,
  uid: string,
  file: File,
): Promise<TripPhoto> => {
  const safeName = sanitizeFileName(file.name || 'photo');
  const storagePath = `tripPhotos/${tripId}/${uid}/${Date.now()}_${safeName}`;
  const storageRef = ref(storage, storagePath);
  await uploadBytes(storageRef, file, { contentType: file.type || undefined });
  const url = await getDownloadURL(storageRef);

  const docRef = await addDoc(photosCol(tripId), {
    tripId,
    uploaderUid: uid,
    url,
    storagePath,
    fileName: safeName,
    uploadedAt: Timestamp.now(),
  });

  return {
    id: docRef.id,
    tripId,
    uploaderUid: uid,
    url,
    storagePath,
    fileName: safeName,
    uploadedAt: Timestamp.now(),
  };
};

export const deleteTripPhoto = async (photo: TripPhoto, uid: string): Promise<void> => {
  if (photo.uploaderUid !== uid) {
    throw new Error('You can only delete photos you uploaded.');
  }
  try {
    await deleteObject(ref(storage, photo.storagePath));
  } catch (err) {
    // Storage delete can fail if already gone — log but continue to remove the Firestore doc.
    console.warn('[deleteTripPhoto] storage delete failed', err);
  }
  await deleteDoc(doc(photosCol(photo.tripId), photo.id));
};

// ────────────────────────────────────────────────────────────────────────────
// Tic-tac-toe — one active game per trip, stored at trips/{tripId}/game/current.
// ────────────────────────────────────────────────────────────────────────────

export type GameCell = 'X' | 'O' | null;
export type GameStatus = 'pending' | 'active' | 'completed' | 'draw' | 'declined';

export interface TripGame {
  // X = challenger (invites), O = invitee.
  playerX: string;
  playerO: string;
  board: GameCell[]; // length 9
  turn: 'X' | 'O';
  status: GameStatus;
  winner: string | null; // uid of winner; null = no winner yet / draw / declined
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

const gameDocRef = (tripId: string) => doc(db, 'trips', tripId, 'game', 'current');

const emptyBoard = (): GameCell[] => [null, null, null, null, null, null, null, null, null];

const WIN_LINES: [number, number, number][] = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

export const evaluateBoard = (board: GameCell[]): { winner: 'X' | 'O' | null; draw: boolean } => {
  for (const [a, b, c] of WIN_LINES) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return { winner: board[a] as 'X' | 'O', draw: false };
    }
  }
  const draw = board.every((cell) => cell !== null);
  return { winner: null, draw };
};

export const subscribeToTripGame = (
  tripId: string,
  callback: (game: TripGame | null) => void,
): (() => void) => {
  return onSnapshot(
    gameDocRef(tripId),
    (snap) => {
      if (!snap.exists()) return callback(null);
      callback(snap.data() as TripGame);
    },
    (err: FirestoreError) => {
      console.error('[subscribeToTripGame]', tripId, err.code, err.message);
    },
  );
};

// Creates a new pending game challenging the specified opponent. Rejects if an
// un-resolved (pending/active) game already exists for this trip.
export const inviteToGame = async (
  tripId: string,
  challengerUid: string,
  opponentUid: string,
): Promise<void> => {
  if (challengerUid === opponentUid) {
    throw new Error('You cannot play against yourself.');
  }
  const ref = gameDocRef(tripId);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (snap.exists()) {
      const data = snap.data() as TripGame;
      if (data.status === 'pending' || data.status === 'active') {
        throw new Error('A game is already in progress for this trip.');
      }
    }
    const now = Timestamp.now();
    tx.set(ref, {
      playerX: challengerUid,
      playerO: opponentUid,
      board: emptyBoard(),
      turn: 'X',
      status: 'pending',
      winner: null,
      createdAt: now,
      updatedAt: now,
    } as TripGame);
  });
};

export const acceptGameInvite = async (tripId: string, uid: string): Promise<void> => {
  const ref = gameDocRef(tripId);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error('No pending game.');
    const data = snap.data() as TripGame;
    if (data.status !== 'pending') throw new Error('Game is no longer pending.');
    if (data.playerO !== uid) throw new Error('This invite is not for you.');
    tx.update(ref, { status: 'active', updatedAt: Timestamp.now() });
  });
};

export const declineGameInvite = async (tripId: string, uid: string): Promise<void> => {
  const ref = gameDocRef(tripId);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) return;
    const data = snap.data() as TripGame;
    if (data.status !== 'pending') return;
    if (data.playerO !== uid && data.playerX !== uid) throw new Error('Not a participant.');
    tx.update(ref, { status: 'declined', updatedAt: Timestamp.now() });
  });
};

export const playGameMove = async (
  tripId: string,
  uid: string,
  index: number,
): Promise<void> => {
  if (index < 0 || index > 8) throw new Error('Invalid cell.');
  const ref = gameDocRef(tripId);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error('No game.');
    const data = snap.data() as TripGame;
    if (data.status !== 'active') throw new Error('Game is not active.');
    const mySymbol = uid === data.playerX ? 'X' : uid === data.playerO ? 'O' : null;
    if (!mySymbol) throw new Error('You are not in this game.');
    if (data.turn !== mySymbol) throw new Error('Not your turn.');
    if (data.board[index] !== null) throw new Error('Cell already taken.');

    const nextBoard = [...data.board];
    nextBoard[index] = mySymbol;
    const result = evaluateBoard(nextBoard);

    const updates: Record<string, unknown> = {
      board: nextBoard,
      turn: mySymbol === 'X' ? 'O' : 'X',
      updatedAt: Timestamp.now(),
    };
    if (result.winner) {
      updates.status = 'completed';
      updates.winner = result.winner === 'X' ? data.playerX : data.playerO;
    } else if (result.draw) {
      updates.status = 'draw';
      updates.winner = null;
    }
    tx.update(ref, updates);
  });
};

// Clears the board but keeps the same players; resets to active with X to move.
export const resetGameBoard = async (tripId: string, uid: string): Promise<void> => {
  const ref = gameDocRef(tripId);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error('No game.');
    const data = snap.data() as TripGame;
    if (uid !== data.playerX && uid !== data.playerO) throw new Error('Not a participant.');
    tx.update(ref, {
      board: emptyBoard(),
      turn: 'X',
      status: 'active',
      winner: null,
      updatedAt: Timestamp.now(),
    });
  });
};

// Ends the current game entirely (marks completed with no winner). Frees the
// trip so anyone can start a new game with a new opponent.
export const endGame = async (tripId: string, uid: string): Promise<void> => {
  const ref = gameDocRef(tripId);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) return;
    const data = snap.data() as TripGame;
    if (uid !== data.playerX && uid !== data.playerO) throw new Error('Not a participant.');
    tx.update(ref, { status: 'completed', winner: null, updatedAt: Timestamp.now() });
  });
};

