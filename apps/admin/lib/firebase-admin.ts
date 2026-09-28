import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

// Server-side Firestore access for API routes. Needs the
// FIREBASE_SERVICE_ACCOUNT_KEY environment variable (the service account
// JSON from Firebase → Project settings → Service accounts). Returns null
// when it isn't set so routes can skip their work instead of crashing.
function adminApp(): App | null {
  const existing = getApps()[0];

  if (existing) {
    return existing;
  }

  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

  // Local testing against the Firebase emulators needs no credentials.
  if (process.env.FIRESTORE_EMULATOR_HOST || process.env.FIREBASE_AUTH_EMULATOR_HOST) {
    return initializeApp({ projectId });
  }

  const key = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

  if (!key) {
    return null;
  }

  try {
    return initializeApp({ credential: cert(JSON.parse(key)), projectId });
  } catch (error) {
    console.error("FIREBASE_SERVICE_ACCOUNT_KEY is not valid JSON:", error);
    return null;
  }
}

export function adminDb() {
  const app = adminApp();
  return app ? getFirestore(app) : null;
}

export function adminAuth() {
  const app = adminApp();
  return app ? getAuth(app) : null;
}
