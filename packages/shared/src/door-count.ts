import {
  doc,
  getDoc,
  increment,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";

import {
  DOOR_STALE_MS,
  doorHour,
  localTimezone,
  type DoorCount,
} from "./door-crowd";
import { db } from "./firebase";

export {
  CROWD_LEVELS,
  crowdLevel,
  DOOR_STALE_MS,
  doorHour,
  readDoorCount,
  usualCrowd,
  type CrowdLevel,
  type DoorCount,
} from "./door-crowd";

// Bouncer mode for bars. Whoever is on the door taps +1 when someone comes
// in and -1 when they leave; customers see how busy the bar is compared with
// its usual crowd at this hour.
//
// Stored in businesses/{businessId}/live/door (publicly readable):
// - `enabled`: bouncer mode on or off (owner only).
// - `count`: people inside right now.
// - `updatedAt`: last tap.
// - `timezone`: the bar's time zone, so every device files taps under the
//   same hour of the day.
// - `hours`: per hour of the day ("0"–"23"), `sum` of the head count after
//   each tap and `n` taps. sum / n is the usual crowd at that hour.

export const doorRef = (businessId: string) =>
  doc(db, "businesses", businessId, "live", "door");

// One tap at the door. `door` is the latest snapshot; Firestore rules only
// let staff move the count by one (or start over from 0 or 1).
export async function stepDoorCount(businessId: string, door: DoorCount, step: 1 | -1) {
  const next = door.count + step;

  if (next < 0) {
    return;
  }

  const hour = doorHour(door.timezone);
  const stale = door.updatedAtMs === null || Date.now() - door.updatedAtMs > DOOR_STALE_MS;

  await updateDoc(doorRef(businessId), {
    // increment() so taps from two tablets both count.
    count: stale ? next : increment(step),
    updatedAt: serverTimestamp(),
    [`hours.${hour}.sum`]: increment(next),
    [`hours.${hour}.n`]: increment(1),
  });
}

export async function resetDoorCount(businessId: string) {
  await updateDoc(doorRef(businessId), {
    count: 0,
    updatedAt: serverTimestamp(),
  });
}

// Owner only: turn bouncer mode on or off.
export async function setBouncerMode(businessId: string, enabled: boolean) {
  const ref = doorRef(businessId);
  const snapshot = await getDoc(ref);

  if (snapshot.exists()) {
    await updateDoc(ref, { enabled, timezone: localTimezone() });
    return;
  }

  await setDoc(ref, {
    enabled,
    count: 0,
    timezone: localTimezone(),
    hours: {},
  });
}
