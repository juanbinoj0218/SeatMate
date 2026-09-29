// Where a table's seats sit around it, in pixels, for a table drawn from
// above: in a ring around round tables and in rows along the long sides of
// rectangular ones. A bar stool is a "table" with a single seat. Shared by
// the web TableWithSeats component and the mobile business app.

export type TableShape = "round" | "rectangle" | "stool";
export type TableRotation = 0 | 90;

export type TableSeat = {
  id: number;
  status: "available" | "occupied";
};

// Read a shape/rotation saved in Firestore, falling back to the defaults.
export const parseTableShape = (value: unknown): TableShape =>
  value === "round" || value === "stool" ? value : "rectangle";

export const parseTableRotation = (value: unknown): TableRotation =>
  value === 90 ? 90 : 0;

const GAP = 3;

export type TableGeometry = {
  // Outer box that holds the table and its seats.
  width: number;
  height: number;
  // The table top itself, centred in the box.
  tableWidth: number;
  tableHeight: number;
  seatSize: number;
  // Seat centres relative to the middle of the box.
  spots: { x: number; y: number }[];
};

export function tableGeometry(
  shape: TableShape,
  count: number,
  scale: number,
  rotation: TableRotation
): TableGeometry {
  const seatSize = Math.max(20, Math.min(44, 28 * scale));
  const gap = GAP * scale;
  const reach = seatSize / 2 + gap;

  if (shape === "stool") {
    const size = seatSize + 8 * scale;
    return { width: size, height: size, tableWidth: size, tableHeight: size, seatSize, spots: [{ x: 0, y: 0 }] };
  }

  const spots: { x: number; y: number }[] = [];
  let tableWidth: number;
  let tableHeight: number;

  if (shape === "round") {
    // Wide enough that the ring of seats around it never overlaps.
    const ring = (count * (seatSize + 4 * scale)) / Math.PI;
    const diameter = Math.max(84 * scale, ring - seatSize);
    tableWidth = diameter;
    tableHeight = diameter;

    const radius = diameter / 2 + reach;
    const turn = rotation === 90 ? Math.PI / 2 : 0;
    for (let index = 0; index < count; index += 1) {
      const angle = -Math.PI / 2 + turn + (index / count) * Math.PI * 2;
      spots.push({ x: Math.cos(angle) * radius, y: Math.sin(angle) * radius });
    }
  } else {
    // Seats in two rows along the long sides, the table grown to fit them.
    const top = Math.ceil(count / 2);
    const bottom = count - top;
    const pitch = seatSize + 6 * scale;
    const long = Math.max(118 * scale, top * pitch + 16 * scale);
    const short = 66 * scale;

    const row = (n: number, y: number) => {
      for (let index = 0; index < n; index += 1) {
        spots.push({ x: (index - (n - 1) / 2) * pitch, y });
      }
    };
    row(top, -(short / 2 + reach));
    row(bottom, short / 2 + reach);

    if (rotation === 90) {
      // Stand the table up: rows become columns on the left and right.
      for (const spot of spots) {
        const { x, y } = spot;
        spot.x = -y;
        spot.y = x;
      }
      tableWidth = short;
      tableHeight = long;
    } else {
      tableWidth = long;
      tableHeight = short;
    }
  }

  // Only reserve room on the sides that actually have seats.
  const edge = reach + seatSize / 2;
  const seatsLeftRight = spots.some((spot) => Math.abs(spot.x) > tableWidth / 2);
  const seatsAboveBelow = spots.some((spot) => Math.abs(spot.y) > tableHeight / 2);
  const width = tableWidth + (seatsLeftRight ? 2 * edge : 0);
  const height = tableHeight + (seatsAboveBelow ? 2 * edge : 0);

  return { width, height, tableWidth, tableHeight, seatSize, spots };
}

// Size of the box a table (with its seats) takes up on the floor plan.
export function tableSize(
  shape: TableShape,
  count: number,
  scale = 1,
  rotation: TableRotation = 0
) {
  const { width, height } = tableGeometry(shape, count, scale, rotation);
  return { width, height };
}

// "Stool 3" → "3", so a stool shows its number.
export const stoolNumber = (name: string) => name.match(/(\d+)\s*$/)?.[1] ?? "";
