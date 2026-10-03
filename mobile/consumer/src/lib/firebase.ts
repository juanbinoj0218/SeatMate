import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import { getApp, getApps, initializeApp } from "firebase/app";
import {
  getAuth,
  // Only in Firebase's React Native build, which Metro picks.
  // @ts-expect-error: missing from the web typings TypeScript reads.
  getReactNativePersistence,
  initializeAuth,
  type Auth,
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Same Firebase project as the web sites. Expo only exposes environment
// variables that start with EXPO_PUBLIC_ (see .env.example).
const projectId = process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID;

export const firebaseConfigured = Boolean(process.env.EXPO_PUBLIC_FIREBASE_API_KEY && projectId);

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain:
    process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN ||
    (projectId ? `${projectId}.firebaseapp.com` : undefined),
  projectId,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

const alreadyStarted = getApps().length > 0;
const app = alreadyStarted ? getApp() : initializeApp(firebaseConfig);

// Keep people signed in between app launches. On fast refresh the app is
// already set up, and initializeAuth may only be called once. In a browser
// (the web preview) Firebase's own browser storage does this.
export const auth: Auth =
  alreadyStarted || Platform.OS === "web"
    ? getAuth(app)
    : initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) });

export const db = getFirestore(app);
