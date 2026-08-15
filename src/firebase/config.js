// Firebase initialisation.
//
// Config comes from Vite env vars so the repo stays free of project-specific
// values. Copy .env.example to .env.local and fill in the values from the
// Firebase console (Project settings -> Your apps -> Web app).
import { initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, GoogleAuthProvider } from 'firebase/auth';
import {
  connectFirestoreEmulator,
  initializeFirestore,
  persistentLocalCache,
  persistentSingleTabManager,
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Surfaced in the UI so a missing .env.local produces a helpful screen rather
// than an opaque Firebase error.
export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId,
);

export const app = initializeApp(firebaseConfig);

// Offline persistence keeps the app usable with no signal — check-ins queue up
// and sync when the connection returns. Single-tab manager is the right call
// for a personal app (multi-tab sync adds coordination overhead we don't need).
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentSingleTabManager() }),
});

export const auth = getAuth(app);

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;

// Local development against the Firebase emulator suite. Set
// VITE_USE_EMULATOR=true in .env.local and run `npm run emulators` to work
// offline without touching real data. Never active in a production build
// unless the flag is explicitly set.
export const usingEmulator = import.meta.env.VITE_USE_EMULATOR === 'true';

if (usingEmulator) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
}
