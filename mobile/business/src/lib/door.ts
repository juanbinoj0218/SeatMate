import { doc, getDoc, increment, onSnapshot, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";

import { DOOR_STALE_MS, doorHour, localTimezone, readDoorCount, type DoorCount } from "@seatmate/shared/door-crowd";

import { db } from "@/lib/firebase";

// Bouncer mode for bars, writing the same businesses/{id}/live/door document
// as the web portal's door counter (packages/shared/src/door-count.ts), so a
// tablet on the website and a phone in the app count together.

const doorRef = (businessId: string) => doc(db, "businesses", businessId, "live", "door");

export function watchDoor(businessId: string, onDoor: (door: DoorCount) => void, onError: (error: unknown) => void) {
  return onSnapshot(
    doorRef(businessId),
    (snapshot) => onDoor(readDoorCount(snapshot.data({ serverTimestamps: "estimate" }))),
    onError
  );
}

// One tap at the door. Firestore rules only let staff move the count by one
// (or start over from 0 or 1).
export async function stepDoorCount(businessId: string, door: DoorCount, step: 1 | -1) {
  const next = door.count + step;
  if (next < 0) return;

  const hour = doorHour(door.timezone);
  const stale = door.updatedAtMs === null || Date.now() - door.updatedAtMs > DOOR_STALE_MS;

  await updateDoc(doorRef(businessId), {
    // increment() so taps from two devices both count.
    count: stale ? next : increment(step),
    updatedAt: serverTimestamp(),
    [`hours.${hour}.sum`]: increment(next),
    [`hours.${hour}.n`]: increment(1),
  });
}

export async function resetDoorCount(businessId: string) {
  await updateDoc(doorRef(businessId), { count: 0, updatedAt: serverTimestamp() });
}

// Owner only: turn bouncer mode on or off.
export async function setBouncerMode(businessId: string, enabled: boolean) {
  const ref = doorRef(businessId);
  const snapshot = await getDoc(ref);

  if (snapshot.exists()) {
    await updateDoc(ref, { enabled, timezone: localTimezone() });
    return;
  }

  await setDoc(ref, { enabled, count: 0, timezone: localTimezone(), hours: {} });
}
