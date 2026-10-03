import { collection, doc, onSnapshot, serverTimestamp, Timestamp, updateDoc } from "firebase/firestore";

import { clamp, MARKERS, markerStatus, type FloorMarker, type MarkerType } from "@seatmate/shared/floor-plan";
import {
  parseTableRotation,
  parseTableShape,
  type TableRotation,
  type TableSeat,
  type TableShape,
} from "@seatmate/shared/table-geometry";

import { db } from "@/lib/firebase";

export type Table = {
  id: string;
  name: string;
  seats: TableSeat[];
  xPct: number;
  yPct: number;
  shape: TableShape;
  rotation: TableRotation;
  scale: number;
  // When seats were last changed or confirmed, for the stale-seat reminder.
  occupancyUpdatedMs: number | null;
};

// The floor plan is drawn on a 1000 × 700 canvas like the web editor, with
// tables and markers placed by percentage, then scaled to the screen.
export const CANVAS_WIDTH = 1000;
export const CANVAS_HEIGHT = 700;

// Live tables for a business, with the same defaults as the web portal.
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
            id: tableDoc.id,
            name: data.name || `Table ${index + 1}`,
            seats: Array.isArray(data.seats) ? data.seats : [],
            xPct: typeof data.xPct === "number" ? data.xPct : 12 + (index % 3) * 32,
            yPct: typeof data.yPct === "number" ? data.yPct : 18 + Math.floor(index / 3) * 30,
            shape: parseTableShape(data.shape),
            rotation: parseTableRotation(data.rotation),
            scale: typeof data.scale === "number" ? clamp(data.scale, 0.65, 1.8) : 1,
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
        snapshot.docs.map((markerDoc, index) => {
          const data = markerDoc.data();
          const type: MarkerType = data.type in MARKERS ? data.type : "outlet";

          return {
            id: markerDoc.id,
            type,
            label: typeof data.label === "string" ? data.label : MARKERS[type].label,
            xPct: typeof data.xPct === "number" ? data.xPct : 15 + (index % 4) * 20,
            yPct: typeof data.yPct === "number" ? data.yPct : 82,
            scale: typeof data.scale === "number" ? clamp(data.scale, 0.5, 2.5) : 1,
            rotation: typeof data.rotation === "number" ? data.rotation : 0,
            status: markerStatus(data.status),
          };
        })
      ),
    onError
  );
}

// Pool tables, darts and bowling lanes: flip between open and in use. Staff
// may change only these two fields (see firestore.rules).
export function toggleGame(businessId: string, marker: FloorMarker) {
  return updateDoc(doc(db, "businesses", businessId, "floorMarkers", marker.id), {
    status: marker.status === "occupied" ? "available" : "occupied",
    statusUpdatedAt: serverTimestamp(),
  });
}

export const seatCounts = (tables: Table[]) => {
  let open = 0;
  let total = 0;

  tables.forEach((table) =>
    table.seats.forEach((seat) => {
      total += 1;
      if (seat.status === "available") open += 1;
    })
  );

  return { open, total, taken: total - open };
};
