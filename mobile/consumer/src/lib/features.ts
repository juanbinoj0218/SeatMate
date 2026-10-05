import { useSyncExternalStore } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import NetInfo from "@react-native-community/netinfo";

import { DEFAULT_FEATURES, FEATURES_DOC, readFeatures, type Features } from "@seatmate/shared/features";

import { db, firebaseConfigured } from "@/lib/firebase";

// Admin-controlled feature switches (settings/features), the same ones that
// turn parts of the website on and off. One live listener is shared by every
// screen, so a change in the admin site applies while the app is open.
// Everything counts as on until the settings say otherwise, and the last
// value read is kept if the connection drops.

let current: Features = DEFAULT_FEATURES;
let stopListening: (() => void) | null = null;
let stopNetInfo: (() => void) | null = null;
const subscribers = new Set<() => void>();

function listen() {
  if (stopListening || !firebaseConfigured) return;

  stopListening = onSnapshot(
    doc(db, ...FEATURES_DOC),
    (snapshot) => {
      current = readFeatures(snapshot.data());
      subscribers.forEach((notify) => notify());
    },
    (error) => {
      // A failed listener stops for good, so drop it: the next screen that
      // asks, or the connection coming back, starts a new one.
      console.warn("Could not load feature settings:", error);
      stopListening = null;
    }
  );
}

function start() {
  listen();

  stopNetInfo ??= NetInfo.addEventListener((state) => {
    if (state.isConnected !== false && state.isInternetReachable !== false) listen();
  });
}

function stop() {
  stopListening?.();
  stopListening = null;
  stopNetInfo?.();
  stopNetInfo = null;
}

function subscribe(notify: () => void) {
  subscribers.add(notify);
  start();

  return () => {
    subscribers.delete(notify);
    if (subscribers.size === 0) stop();
  };
}

const read = () => current;

export function useFeatures(): Features {
  return useSyncExternalStore(subscribe, read, read);
}
