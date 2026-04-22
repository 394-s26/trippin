import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import {
  EmailAuthProvider,
  GoogleAuthProvider,
  User as FirebaseUser,
  onAuthStateChanged,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  updatePassword,
  deleteUser,
} from 'firebase/auth';
import { deleteDoc, doc, getDoc, runTransaction, setDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../services/firebase';
import {
  signInWithGoogle,
  signInWithEmail,
  signUpWithEmail,
  signOutUser,
  setLoginTime,
  clearLoginTime,
} from '../services/authService';
import { deleteUserAvatars, uploadUserAvatar } from '../services/storageService';
import { deleteUserOwnedTrips } from '../services/firestoreTripService';
import { acceptPendingInvites } from '../services/inviteService';
import { User, AppUser, EmailRegistrationInput } from '../types/auth';

interface AuthContextType {
  user: User | null;
  appUser: AppUser | null;
  loading: boolean;
  /** Returns the first accepted trip ID if the user had pending invites, otherwise null. */
  loginWithGoogle: () => Promise<string | null>;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  /** Returns the first accepted trip ID if the user had pending invites, otherwise null. */
  registerWithEmail: (input: EmailRegistrationInput) => Promise<string | null>;
  logout: () => Promise<void>;
  updateProfile: (input: { firstName: string; lastName: string }) => Promise<void>;
  updateUsername: (nextUsername: string) => Promise<void>;
  updateProfilePhoto: (file: File) => Promise<void>;
  changePasswordWithCurrentPassword: (currentPassword: string, nextPassword: string) => Promise<void>;
  deleteAccount: (input?: { currentPassword?: string }) => Promise<void>;
}

const createAppUser = async (appUser: AppUser) => {
  await setDoc(doc(db, 'users', appUser.uid), appUser);
};

const normalizeUsername = (value: string) => value.trim().replace(/\s+/g, '').toLowerCase();

const reserveUsername = async (input: { uid: string; nextUsername: string; prevUsername?: string | null }) => {
  const nextUsername = normalizeUsername(input.nextUsername);
  if (!nextUsername) throw new Error('Please choose a username.');
  const prev =
    input.prevUsername && normalizeUsername(input.prevUsername) !== nextUsername
      ? normalizeUsername(input.prevUsername)
      : null;

  await runTransaction(db, async (tx) => {
    const nextRef = doc(db, 'usernames', nextUsername);
    const prevRef = prev ? doc(db, 'usernames', prev) : null;

    // Firestore transactions require ALL reads before ANY writes.
    const prevSnap = prevRef ? await tx.get(prevRef) : null;
    const nextSnap = await tx.get(nextRef);

    if (nextSnap.exists() && nextSnap.data()?.uid !== input.uid) {
      throw new Error('That username is already taken.');
    }

    // Only create the reservation doc if it doesn't exist yet.
    // If it already exists for this user, `set` would be an **update**, and our rules disallow updates on `usernames/*`.
    if (!nextSnap.exists()) {
      tx.set(nextRef, { uid: input.uid }, { merge: false });
    }

    if (prevRef && prevSnap?.exists() && prevSnap.data()?.uid === input.uid) {
      tx.delete(prevRef);
    }
  });
};

const reserveFirstAvailableUsername = async (base: string, uid: string) => {
  const normalized = normalizeUsername(base);
  const candidates = [normalized, `${normalized}${Math.floor(Math.random() * 9000) + 1000}`];
  for (const candidate of candidates) {
    if (!candidate) continue;
    try {
      await reserveUsername({ uid, nextUsername: candidate });
      return candidate;
    } catch {
      // try next
    }
  }
  // last resort: uid suffix
  const fallback = `${normalized || 'user'}${uid.slice(0, 6)}`;
  await reserveUsername({ uid, nextUsername: fallback });
  return fallback;
};

const ensureUserProfileExists = async (firebaseUser: FirebaseUser): Promise<void> => {
  const ref = doc(db, 'users', firebaseUser.uid);
  const snap = await getDoc(ref);
  if (snap.exists()) return;

  const [firstName, ...rest] = (firebaseUser.displayName ?? '').split(' ');
  const lastName = rest.join(' ');
  let username = '';
  try {
    username = await reserveFirstAvailableUsername(firebaseUser.displayName ?? 'user', firebaseUser.uid);
  } catch {
    username = normalizeUsername(`user_${firebaseUser.uid.slice(0, 8)}`);
    await setDoc(
      ref,
      {
        uid: firebaseUser.uid,
        email: firebaseUser.email,
        firstName,
        lastName,
        username,
        photoURL: firebaseUser.photoURL,
      },
      { merge: true }
    );
    return;
  }

  const restored: AppUser = {
    uid: firebaseUser.uid,
    email: firebaseUser.email,
    firstName,
    lastName,
    username,
    photoURL: firebaseUser.photoURL,
  };

  await setDoc(ref, restored, { merge: true });
};

const restoreUserProfileAfterFailedDeletion = async (profile: AppUser) => {
  await setDoc(doc(db, 'users', profile.uid), profile);
  await reserveUsername({ uid: profile.uid, nextUsername: profile.username });
};

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setLoginTime();
        setUser({
          uid: firebaseUser.uid,
          displayName: firebaseUser.displayName,
          email: firebaseUser.email,
          photoURL: firebaseUser.photoURL,
          providerIds: firebaseUser.providerData.map((p) => p.providerId),
        });
        let userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
        if (!userDoc.exists()) {
          try {
            await ensureUserProfileExists(firebaseUser);
            userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          } catch (e) {
            console.error('Failed to restore missing user profile document.', e);
          }
        }
        setAppUser(userDoc.exists() ? (userDoc.data() as AppUser) : null);
      } else {
        clearLoginTime();
        setUser(null);
        setAppUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const loginWithGoogle = async (): Promise<string | null> => {
    const firebaseUser = await signInWithGoogle();
    const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
    let isNewUser = false;
    if (!userDoc.exists()) {
      isNewUser = true;
      const [firstName, ...rest] = (firebaseUser.displayName ?? '').split(' ');
      const lastName = rest.join(' ');
      const username = await reserveFirstAvailableUsername(firebaseUser.displayName ?? 'user', firebaseUser.uid);
      const newAppUser: AppUser = {
        uid: firebaseUser.uid,
        email: firebaseUser.email,
        firstName,
        lastName,
        username,
        photoURL: firebaseUser.photoURL,
      };
      await createAppUser(newAppUser);
      setAppUser(newAppUser);
    }
    // Accept pending invites — for new users, redirect to the first trip
    if (firebaseUser.email) {
      const tripIds = await acceptPendingInvites(firebaseUser.uid, firebaseUser.email);
      if (isNewUser && tripIds.length > 0) return tripIds[0];
    }
    return null;
  };

  const loginWithEmail = async (email: string, password: string): Promise<void> => {
    const firebaseUser = await signInWithEmail(email, password);
    // Accept any pending invites in the background — existing users land on home
    if (firebaseUser.email) {
      acceptPendingInvites(firebaseUser.uid, firebaseUser.email).catch(console.error);
    }
  };

  const registerWithEmail = async ({
    email,
    password,
    firstName,
    lastName,
    username,
    photoFile,
  }: EmailRegistrationInput): Promise<string | null> => {
    const firebaseUser = await signUpWithEmail(email, password);
    let photoURL: string | null = null;

    if (photoFile) {
      try {
        photoURL = await uploadUserAvatar(firebaseUser.uid, photoFile);
      } catch (error) {
        console.warn('Profile photo upload failed during signup. Continuing without photo.', error);
      }
    }

    // Reserve username (transactional) before writing the user doc.
    await reserveUsername({ uid: firebaseUser.uid, nextUsername: username });

    const newAppUser: AppUser = {
      uid: firebaseUser.uid,
      email: firebaseUser.email,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      username: normalizeUsername(username),
      photoURL,
    };
    await createAppUser(newAppUser);
    setAppUser(newAppUser);
    // Await so we can redirect new users directly to their invited trip
    if (firebaseUser.email) {
      const tripIds = await acceptPendingInvites(firebaseUser.uid, firebaseUser.email);
      return tripIds[0] ?? null;
    }
    return null;
  };

  const logout = async () => {
    await signOutUser();
  };

  const requireFirebaseUser = (): FirebaseUser => {
    const current = auth.currentUser;
    if (!current) throw new Error('You must be logged in.');
    return current;
  };

  const refreshAppUser = async (uid: string) => {
    const snap = await getDoc(doc(db, 'users', uid));
    setAppUser(snap.exists() ? (snap.data() as AppUser) : null);
  };

  const updateProfile = async (input: { firstName: string; lastName: string }) => {
    if (!user) throw new Error('You must be logged in.');
    const firstName = input.firstName.trim();
    const lastName = input.lastName.trim();
    const firebaseUser = requireFirebaseUser();
    const existing = await getDoc(doc(db, 'users', user.uid));
    if (!existing.exists()) {
      await ensureUserProfileExists(firebaseUser);
    }
    await updateDoc(doc(db, 'users', user.uid), { firstName, lastName });
    await refreshAppUser(user.uid);
  };

  const updateUsername = async (nextUsername: string) => {
    if (!user) throw new Error('You must be logged in.');
    const prev = appUser?.username ?? null;
    const firebaseUser = requireFirebaseUser();
    const existing = await getDoc(doc(db, 'users', user.uid));
    if (!existing.exists()) {
      await ensureUserProfileExists(firebaseUser);
    }
    const normalized = normalizeUsername(nextUsername);
    await reserveUsername({ uid: user.uid, nextUsername: normalized, prevUsername: prev });
    await updateDoc(doc(db, 'users', user.uid), { username: normalized });
    await refreshAppUser(user.uid);
  };

  const updateProfilePhoto = async (file: File) => {
    if (!user) throw new Error('You must be logged in.');
    const firebaseUser = requireFirebaseUser();
    const existing = await getDoc(doc(db, 'users', user.uid));
    if (!existing.exists()) {
      await ensureUserProfileExists(firebaseUser);
    }
    const photoURL = await uploadUserAvatar(user.uid, file);
    await updateDoc(doc(db, 'users', user.uid), { photoURL });
    await refreshAppUser(user.uid);
  };

  const changePasswordWithCurrentPassword = async (currentPassword: string, nextPassword: string) => {
    const current = requireFirebaseUser();
    if (!current.email) throw new Error('No email found for this account.');
    const credential = EmailAuthProvider.credential(current.email, currentPassword);
    await reauthenticateWithCredential(current, credential);
    await updatePassword(current, nextPassword);
  };

  const deleteAccount = async (input?: { currentPassword?: string }) => {
    const current = requireFirebaseUser();
    const providerIds = current.providerData.map((p) => p.providerId);
    const uid = current.uid;

    if (providerIds.includes('password')) {
      if (!current.email) throw new Error('No email found for this account.');
      if (!input?.currentPassword) throw new Error('Current password is required.');
      const credential = EmailAuthProvider.credential(current.email, input.currentPassword);
      await reauthenticateWithCredential(current, credential);
    } else if (providerIds.includes('google.com')) {
      const provider = new GoogleAuthProvider();
      await reauthenticateWithPopup(current, provider);
    } else {
      throw new Error('Please re-authenticate to delete your account.');
    }

    const userDocSnap = await getDoc(doc(db, 'users', uid));
    const backupProfile =
      userDocSnap.exists()
        ? (userDocSnap.data() as AppUser)
        : appUser;

    const usernameKey = backupProfile?.username ? normalizeUsername(backupProfile.username) : null;

    try {
      // Avatar/trip cleanup should never block account deletion (Storage rules/network issues).
      deleteUserAvatars(uid).catch((err) => console.warn('Avatar cleanup skipped/failed:', err));

      await Promise.all([
        deleteUserOwnedTrips(uid),
        deleteDoc(doc(db, 'users', uid)),
        usernameKey ? deleteDoc(doc(db, 'usernames', usernameKey)) : Promise.resolve(),
      ]);

      await deleteUser(current);
    } catch (err) {
      console.error('Account deletion failed.', err);

      if (backupProfile) {
        try {
          await restoreUserProfileAfterFailedDeletion(backupProfile);
        } catch (restoreErr) {
          console.error('Failed to restore profile after unsuccessful account deletion.', restoreErr);
        }
      }

      throw err instanceof Error ? err : new Error('Could not delete your account. Please try again.');
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        appUser,
        loading,
        loginWithGoogle,
        loginWithEmail,
        registerWithEmail,
        logout,
        updateProfile,
        updateUsername,
        updateProfilePhoto,
        changePasswordWithCurrentPassword,
        deleteAccount,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
};
