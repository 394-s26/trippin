import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  browserLocalPersistence,
  setPersistence,
} from 'firebase/auth';
import { auth } from './firebase';

const provider = new GoogleAuthProvider();

const SESSION_DURATION_MS = 12 * 60 * 60 * 1000; // 12 hours
const LOGIN_TIME_KEY = 'auth_login_time';

export const setLoginTime = () => {
  localStorage.setItem(LOGIN_TIME_KEY, Date.now().toString());
};

export const clearLoginTime = () => {
  localStorage.removeItem(LOGIN_TIME_KEY);
};

export const isSessionExpired = (): boolean => {
  const loginTime = localStorage.getItem(LOGIN_TIME_KEY);
  if (!loginTime) return true;
  return Date.now() - parseInt(loginTime, 10) > SESSION_DURATION_MS;
};

export const signInWithGoogle = async () => {
  await setPersistence(auth, browserLocalPersistence);
  setLoginTime(); // must be set before signInWithPopup so onAuthStateChanged sees a valid session
  try {
    const result = await signInWithPopup(auth, provider);
    return result.user;
  } catch (error) {
    clearLoginTime();
    throw error;
  }
};

export const signInWithEmail = async (email: string, password: string) => {
  await setPersistence(auth, browserLocalPersistence);
  setLoginTime();
  try {
    const result = await signInWithEmailAndPassword(auth, email, password);
    return result.user;
  } catch (error) {
    clearLoginTime();
    throw error;
  }
};

export const signUpWithEmail = async (email: string, password: string) => {
  await setPersistence(auth, browserLocalPersistence);
  setLoginTime();
  try {
    const result = await createUserWithEmailAndPassword(auth, email, password);
    return result.user;
  } catch (error) {
    clearLoginTime();
    throw error;
  }
};

export const signOutUser = async () => {
  await signOut(auth);
  clearLoginTime();
};
