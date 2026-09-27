import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  // Google sign-in fails with auth/auth-domain-config-required without an
  // auth domain. Fall back to the project's default Firebase domain when
  // the environment variable is missing from a deployment.
  authDomain:
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ||
    (projectId ? `${projectId}.firebaseapp.com` : undefined),
  projectId,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app =
  getApps().length === 0
    ? initializeApp(firebaseConfig)
    : getApps()[0];

export const auth = getAuth(app);
export const db = getFirestore(app);