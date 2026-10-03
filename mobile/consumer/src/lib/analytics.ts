import { doc, increment, setDoc } from "firebase/firestore";

import { db } from "@/lib/firebase";

// The same daily counters the website bumps (publicBusinesses/{slug}/stats/
// {day}), so a business's analytics include views and saves from the app.
// (packages/shared/src/analytics.ts imports the website's Firebase setup,
// so its day key is repeated here.) Fire and forget: analytics never block or break a screen.
export type PlaceStat = "views" | "saves" | "scans";

const dayKey = (date = new Date()) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

export function bumpPlaceStat(slug: string, stat: PlaceStat) {
  if (!slug) return;

  setDoc(doc(db, "publicBusinesses", slug, "stats", dayKey()), { [stat]: increment(1) }, { merge: true }).catch(
    () => {}
  );
}

// One view per place per app launch, like the website's one per visit.
const viewed = new Set<string>();

export function countView(slug: string) {
  if (viewed.has(slug)) return;
  viewed.add(slug);
  bumpPlaceStat(slug, "views");
}
