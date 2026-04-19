import { initializeApp } from 'firebase/app';
import { initializeFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";
import { getFunctions } from "firebase/functions";

const requiredFirebaseEnv = {
  VITE_FIREBASE_API_KEY: import.meta.env.VITE_FIREBASE_API_KEY,
  VITE_FIREBASE_AUTH_DOMAIN: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  VITE_FIREBASE_PROJECT_ID: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  VITE_FIREBASE_STORAGE_BUCKET: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  VITE_FIREBASE_MESSAGING_SENDER_ID: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  VITE_FIREBASE_APP_ID: import.meta.env.VITE_FIREBASE_APP_ID,
};

const missingFirebaseEnv = Object.entries(requiredFirebaseEnv)
  .filter(([, value]) => !value || value === 'mock')
  .map(([key]) => key);

if (missingFirebaseEnv.length > 0) {
  throw new Error(
    `Missing Firebase environment variables: ${missingFirebaseEnv.join(', ')}. ` +
      'Create a .env file in the project root with your Firebase web app config.'
  );
}

const firebaseConfig = {
  apiKey: requiredFirebaseEnv.VITE_FIREBASE_API_KEY,
  authDomain: requiredFirebaseEnv.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: requiredFirebaseEnv.VITE_FIREBASE_PROJECT_ID,
  storageBucket: requiredFirebaseEnv.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: requiredFirebaseEnv.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: requiredFirebaseEnv.VITE_FIREBASE_APP_ID,
};

export const app = initializeApp(firebaseConfig);

export const db = initializeFirestore(app, {
  experimentalAutoDetectLongPolling: true,
});
export const auth = getAuth(app);
export const storage = getStorage(app);
export const functions = getFunctions(app);