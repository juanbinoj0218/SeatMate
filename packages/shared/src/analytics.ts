import { doc, increment, setDoc } from "firebase/firestore";

import { db } from "./firebase";

// Daily analytics documents, one per day (YYYY-MM-DD, in the writer's local
// time):
//
// - publicBusinesses/{slug}/stats/{day}: `views`, `saves` and `scans`
//   (visits from the business's QR code sign), bumped by
//   customers' browsers (Firestore rules only allow +1 on those fields).
// - businesses/{businessId}/stats/{day}: `updates` (seat changes) and, per
//   hour of the day, `occ_{h}` (sum of % seats taken at each update) and
//   `n_{h}` (number of updates), written by the owner and staff.

import { dayKey } from "./day-key";

export { dayKey };

export type PlaceStat = "views" | "saves" | "scans";

// Fire and forget: analytics never block or break the page.
export function bumpPlaceStat(slug: string, stat: PlaceStat) {
  if (!slug) {
    return;
  }

  setDoc(
    doc(db, "publicBusinesses", slug, "stats", dayKey()),
    { [stat]: increment(1) },
    { merge: true }
  ).catch(() => {});
}

export function recordOccupancy(businessId: string, openSeats: number, totalSeats: number) {
  if (!businessId || totalSeats <= 0) {
    return;
  }

  const now = new Date();
  const hour = now.getHours();
  const takenPct = Math.round(((totalSeats - openSeats) / totalSeats) * 100);

  setDoc(
    doc(db, "businesses", businessId, "stats", dayKey(now)),
    {
      updates: increment(1),
      [`occ_${hour}`]: increment(takenPct),
      [`n_${hour}`]: increment(1),
    },
    { merge: true }
  ).catch(() => {});
}
