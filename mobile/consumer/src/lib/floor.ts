import { collection, onSnapshot, Timestamp } from "firebase/firestore";

import { readMarker, readTable, type TableBase } from "@seatmate/shared/floor-docs";
import type { FloorMarker } from "@seatmate/shared/floor-plan";

import { db } from "@/lib/firebase";

export type Table = TableBase & {
  // When seats were last changed or confirmed.
  occupancyUpdatedMs: number | null;
};

// The floor plan is drawn on a 1000 × 700 canvas like the website, with
// tables and markers placed by percentage, then scaled to the screen.
export const CANVAS_WIDTH = 1000;
export const CANVAS_HEIGHT = 700;

// Live tables for a business, with the same defaults as the website.
export function watchTables(
  businessId: string,
  onTables: (tables: Table[]) => void,
  onError: (error: unknown) => void
) {
  return onSnapshot(
    collection(db, "businesses", businessId, "tables"),
    (snapshot) =>
      onTables(
        snapshot.docs.map((tableDoc, index) => {
          const data = tableDoc.data();

          return {
            ...readTable(tableDoc.id, data, index),
            occupancyUpdatedMs:
              data.occupancyUpdatedAt instanceof Timestamp ? data.occupancyUpdatedAt.toMillis() : null,
          };
        })
      ),
    onError
  );
}

export function watchMarkers(
  businessId: string,
  onMarkers: (markers: FloorMarker[]) => void,
  onError: (error: unknown) => void
) {
  return onSnapshot(
    collection(db, "businesses", businessId, "floorMarkers"),
    (snapshot) =>
      onMarkers(
        snapshot.docs.map((markerDoc, index) => readMarker(markerDoc.id, markerDoc.data(), index))
      ),
    onError
  );
}

export { seatCounts } from "@seatmate/shared/floor-docs";
