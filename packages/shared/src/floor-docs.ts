// Reads table and floor-marker documents (businesses/{id}/tables and
// /floorMarkers) with the same defaults everywhere: the business portal,
// the customer site, the admin site and both apps. Plain TypeScript with
// no Firebase imports, so the Expo apps can use it too.

import { clamp, MARKERS, markerStatus, type FloorMarker, type MarkerType } from "./floor-plan";
import {
  parseTableRotation,
  parseTableShape,
  type TableRotation,
  type TableSeat,
  type TableShape,
} from "./table-geometry";

export type TableBase = {
  id: string;
  name: string;
  seats: TableSeat[];
  xPct: number;
  yPct: number;
  shape: TableShape;
  rotation: TableRotation;
  scale: number;
};

type DocData = Record<string, unknown>;

// Where a table with no saved position is drawn (older floor plans).
const defaultTablePosition = (index: number) => ({
  xPct: 12 + (index % 3) * 32,
  yPct: 18 + Math.floor(index / 3) * 30,
});

// Where a newly added table goes, so new tables don't stack on each other.
export const newTablePosition = (index: number) => ({
  xPct: 18 + (index % 3) * 31,
  yPct: 22 + (Math.floor(index / 3) % 3) * 28,
});

export function readTable(id: string, data: DocData, index: number): TableBase {
  const fallback = defaultTablePosition(index);

  return {
    id,
    name: typeof data.name === "string" && data.name ? data.name : `Table ${index + 1}`,
    seats: Array.isArray(data.seats) ? (data.seats as TableSeat[]) : [],
    xPct: typeof data.xPct === "number" ? data.xPct : fallback.xPct,
    yPct: typeof data.yPct === "number" ? data.yPct : fallback.yPct,
    shape: parseTableShape(data.shape),
    rotation: parseTableRotation(data.rotation),
    scale: typeof data.scale === "number" ? clamp(data.scale, 0.65, 1.8) : 1,
  };
}

export function readMarker(
  id: string,
  data: DocData,
  index: number
): FloorMarker & { status: "available" | "occupied" } {
  const type: MarkerType =
    typeof data.type === "string" && data.type in MARKERS ? (data.type as MarkerType) : "outlet";

  return {
    id,
    type,
    label: typeof data.label === "string" ? data.label : MARKERS[type].label,
    xPct: typeof data.xPct === "number" ? clamp(data.xPct, 0, 100) : 15 + (index % 4) * 20,
    yPct: typeof data.yPct === "number" ? clamp(data.yPct, 0, 100) : 82,
    scale: typeof data.scale === "number" ? clamp(data.scale, 0.5, 2.5) : 1,
    rotation: typeof data.rotation === "number" ? data.rotation : 0,
    status: markerStatus(data.status),
  };
}

// Open, taken and total seats across a floor plan.
export function seatCounts(tables: { seats: { status?: string }[] }[]) {
  let open = 0;
  let total = 0;

  tables.forEach((table) =>
    table.seats.forEach((seat) => {
      total += 1;
      if (seat.status === "available") open += 1;
    })
  );

  return { open, total, taken: total - open };
}
