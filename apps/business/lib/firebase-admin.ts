import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

import { parseServiceAccount } from "@seatmate/shared/service-account";

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

  // Local testing against the Firebase emulator needs no credentials.
  if (process.env.FIRESTORE_EMULATOR_HOST) {
    return initializeApp({ projectId });
  }

  try {
    const account = parseServiceAccount(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);

    if (!account) {
      return null;
    }

    return initializeApp({
      credential: cert({
        projectId: account.project_id,
        clientEmail: account.client_email,
        privateKey: account.private_key,
      }),
      projectId: account.project_id || projectId,
    });
  } catch (error) {
    console.error("FIREBASE_SERVICE_ACCOUNT_KEY could not be read:", error);
    return null;
  }
}

export function adminDb() {
  const app = adminApp();
  return app ? getFirestore(app) : null;
}
