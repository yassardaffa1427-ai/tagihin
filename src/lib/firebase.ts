import { getApps, initializeApp, type FirebaseOptions } from "firebase/app";

// Not called anywhere yet — this just prepares the env/config so Firestore
// (or any other Firebase product) can be wired in later without re-plumbing.
// Fill in .env.local from .env.local.example first.
const firebaseConfig: FirebaseOptions = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export function getFirebaseApp() {
  if (!firebaseConfig.apiKey) {
    throw new Error(
      "Firebase belum dikonfigurasi — isi .env.local dari .env.local.example terlebih dahulu."
    );
  }
  return getApps()[0] ?? initializeApp(firebaseConfig);
}
