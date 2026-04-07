import { initializeApp } from 'firebase/app';
import { initializeFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'mock',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'mock',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'mock',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'mock',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || 'mock',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || 'mock',
};

export const app = initializeApp(firebaseConfig);

export const db = initializeFirestore(app, {
  experimentalAutoDetectLongPolling: true,
});
export const auth = getAuth(app);
export const storage = getStorage(app);