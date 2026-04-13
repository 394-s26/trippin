import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, db } from '../services/firebase';
import {
  signInWithGoogle,
  signInWithEmail,
  signUpWithEmail,
  signOutUser,
  setLoginTime,
  clearLoginTime,
} from '../services/authService';
import { uploadUserAvatar } from '../services/storageService';
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
}

const createAppUser = async (appUser: AppUser) => {
  await setDoc(doc(db, 'users', appUser.uid), appUser);
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
        });
        const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
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
      const username = (firebaseUser.displayName ?? '').replace(/\s+/g, '').toLowerCase();
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

    const newAppUser: AppUser = {
      uid: firebaseUser.uid,
      email: firebaseUser.email,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      username: username.trim(),
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

  return (
    <AuthContext.Provider value={{ user, appUser, loading, loginWithGoogle, loginWithEmail, registerWithEmail, logout }} >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
};
