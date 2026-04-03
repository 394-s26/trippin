import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, db } from '../services/firebase';
import {
  signInWithGoogle,
  signInWithEmail,
  signUpWithEmail,
  signOutUser,
  isSessionExpired,
  clearLoginTime,
} from '../services/authService';
import { User, AppUser } from '../types/auth';

interface AuthContextType {
  user: User | null;
  appUser: AppUser | null;
  loading: boolean;
  loginWithGoogle: () => Promise<void>;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  registerWithEmail: (email: string, password: string, username: string) => Promise<void>;
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
        if (isSessionExpired()) {
          await signOut(auth);
          clearLoginTime();
          setUser(null);
          setAppUser(null);
        } else {
          setUser({
            uid: firebaseUser.uid,
            displayName: firebaseUser.displayName,
            email: firebaseUser.email,
            photoURL: firebaseUser.photoURL,
          });
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          setAppUser(userDoc.exists() ? (userDoc.data() as AppUser) : null);
        }
      } else {
        clearLoginTime();
        setUser(null);
        setAppUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const loginWithGoogle = async () => {
    const firebaseUser = await signInWithGoogle();
    const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
    if (!userDoc.exists()) {
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
  };

  const loginWithEmail = async (email: string, password: string) => {
    await signInWithEmail(email, password);
  };

  const registerWithEmail = async (email: string, password: string, username: string) => {
    const firebaseUser = await signUpWithEmail(email, password);
    const newAppUser: AppUser = {
      uid: firebaseUser.uid,
      email: firebaseUser.email,
      firstName: '',
      lastName: '',
      username,
      photoURL: null,
    };
    await createAppUser(newAppUser);
    setAppUser(newAppUser);
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
