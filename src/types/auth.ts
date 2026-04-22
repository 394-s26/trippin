// This file defines TypeScript interfaces for user authentication data.

// Mirrors the Firebase Auth user object.
export interface User {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
  providerIds: string[];
}

// Stored in Firestore at users/{uid}. Extends the Firebase Auth identity
// with profile fields that Auth does not natively support.
export interface AppUser {
  uid: string;        // Same as Firebase Auth uid — used as the Firestore document ID
  email: string | null;
  firstName: string;
  lastName: string;
  username: string;
  photoURL?: string | null;
}

export interface EmailRegistrationInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  username: string;
  photoFile?: File | null;
}
