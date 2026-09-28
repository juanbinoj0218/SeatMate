// Firebase sign-in for the app.
//
// Uses the SAME Firebase project (and the same accounts) as the SeatMate
// website, so people can sign in here with their website email/password.
//
// On a phone, Firebase needs to be told where to remember who's signed in,
// otherwise you'd be signed out every time the app closes. That's what
// AsyncStorage is for here.

import AsyncStorage from "@react-native-async-storage/async-storage";
import { getApp } from "firebase/app";
// getReactNativePersistence only exists in the React Native build of
// firebase/auth, so TypeScript's web types don't know about it:
// https://github.com/firebase/firebase-js-sdk/issues/9316
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { Auth, getAuth, getReactNativePersistence, initializeAuth } from "firebase/auth";

// Makes sure the Firebase app in firebase.ts is set up before we use it
import "./firebase";

function createAuth(): Auth {
  const app = getApp();

  try {
    return initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch {
    // Already set up (happens when Expo reloads the code while you edit)
    return getAuth(app);
  }
}

export const auth = createAuth();
