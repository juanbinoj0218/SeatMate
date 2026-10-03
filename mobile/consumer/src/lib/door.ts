import { doc, onSnapshot } from "firebase/firestore";

import { db } from "@/lib/firebase";

// A bar's live door count (businesses/{id}/live/door), kept by its bouncer in
// the business app or portal. Customers only read it; the raw data is read
// with readDoorCount against a ticking clock, so last night's count drops
// off on its own.
export function watchDoor(businessId: string, onData: (data: Record<string, unknown> | undefined) => void) {
  return onSnapshot(
    doc(db, "businesses", businessId, "live", "door"),
    (snapshot) => onData(snapshot.data({ serverTimestamps: "estimate" })),
    (error) => console.error("Could not load the crowd count:", error)
  );
}
