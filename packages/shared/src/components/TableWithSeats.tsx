"use client";

// A table drawn from above with its seats tucked right up against its
// edge: in a ring around round tables and in rows along the long sides of
// rectangular ones. A bar stool or barber chair is a "table" with a single
// seat. Used by
// the floor-plan editor, the staff screen, the customer place page and the
// admin review.

import { useEffect, useState } from "react";

export type TableShape = "round" | "rectangle" | "stool" | "barberChair";
export type TableRotation = 0 | 90;

export type TableSeat = {
  id: number;
  status: "available" | "occupied";
  // When the seat was last marked taken (ms since epoch).
  occupiedSince?: number;
};

// "4:07" or "1:02:45" since a barber chair was taken.
const elapsed = (since: number, now: number) => {
  const total = Math.max(0, Math.floor((now - since) / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = String(total % 60).padStart(2, "0");
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${seconds}`
    : `${minutes}:${seconds}`;
};

// Pill under a barber chair: "Open" while free, and a running timer of how
// long the current customer has been in the chair once it is taken.
function ChairTimer({ seat, fontSize }: { seat: TableSeat; fontSize: number }) {
  const occupied = seat.status === "occupied";
  const since = occupied && typeof seat.occupiedSince === "number" ? seat.occupiedSince : null;
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (since === null) return;
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [since]);

  return (
    <span
      className={`absolute left-1/2 top-full mt-1 -translate-x-1/2 whitespace-nowrap rounded-full px-2 py-0.5 font-bold tabular-nums shadow-sm ${
        occupied ? "bg-red-50 text-red-600 ring-1 ring-red-200" : "bg-green-50 text-green-700 ring-1 ring-green-200"
      }`}
      style={{ fontSize }}
      aria-live="off"
    >
      {!occupied ? "Open" : since === null ? "In chair" : `⏱ ${elapsed(since, now)}`}
    </span>
  );
}

// Read a shape/rotation saved in Firestore, falling back to the defaults.
export const parseTableShape = (value: unknown): TableShape =>
  value === "round" || value === "stool" || value === "barberChair"
    ? value
    : "rectangle";

// Stools and barber chairs are one seat each, with no table around them.
export const isSingleSeat = (shape: TableShape) =>
  shape === "stool" || shape === "barberChair";

export const parseTableRotation = (value: unknown): TableRotation =>
  value === 90 ? 90 : 0;

const GAP = 3;

type Geometry = {
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

function geometry(
  shape: TableShape,
  count: number,
  scale: number,
  rotation: TableRotation
): Geometry {
  const seatSize = Math.max(20, Math.min(44, 28 * scale));
  const gap = GAP * scale;
  const reach = seatSize / 2 + gap;

  if (shape === "stool") {
    const size = seatSize + 8 * scale;
    return { width: size, height: size, tableWidth: size, tableHeight: size, seatSize, spots: [{ x: 0, y: 0 }] };
  }

  if (shape === "barberChair") {
    // Seat in the middle of a chair frame with a headrest above it.
    const chairWidth = seatSize + 14 * scale;
    const chairHeight = seatSize + 24 * scale;
    return {
      width: chairWidth,
      height: chairHeight,
      tableWidth: chairWidth,
      tableHeight: chairHeight,
      seatSize,
      spots: [{ x: 0, y: 3 * scale }],
    };
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
  const { width, height } = geometry(shape, count, scale, rotation);
  return { width, height };
}

// "Stool 3" → "3", so a stool or chair shows its number.
const stoolNumber = (name: string) => name.match(/(\d+)\s*$/)?.[1] ?? "";

export default function TableWithSeats({
  name,
  shape,
  seats,
  scale = 1,
  rotation = 0,
  onSeatClick,
  seatsDisabled = false,
  className = "",
}: {
  name: string;
  shape: TableShape;
  seats: TableSeat[];
  scale?: number;
  rotation?: TableRotation;
  onSeatClick?: (seatId: number) => void;
  seatsDisabled?: boolean;
  className?: string;
}) {
  const stool = isSingleSeat(shape);
  const shown = stool ? seats.slice(0, 1) : seats;
  const { width, height, tableWidth, tableHeight, seatSize, spots } = geometry(
    shape,
    shown.length,
    scale,
    rotation
  );
  const open = shown.filter((seat) => seat.status === "available").length;
  const fontSize = Math.max(9, Math.min(14, 12.5 * scale));
  const upright = shape === "rectangle" && rotation === 90;

  return (
    <div
      className={`relative ${className}`}
      style={{ width, height }}
      role="group"
      aria-label={`${name}: ${open} of ${shown.length} seats open`}
    >
      <div
        className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center text-center shadow-md ${
          shape === "barberChair"
            ? "rounded-t-[40%] rounded-b-xl bg-[#2b2f36] border-t-[5px] border-[#8b1e2d]"
            : stool
            ? "rounded-full bg-[#3b2a1c]"
            : `bg-[#101811] text-white ${shape === "round" ? "rounded-full" : "rounded-2xl"}`
        }`}
        style={{ width: tableWidth, height: tableHeight, padding: stool ? 0 : 6 * scale }}
      >
        {!stool && (
          <div className="min-w-0 leading-tight" style={{ fontSize, maxWidth: upright ? tableWidth - 8 : undefined }}>
            <div className={`font-bold ${upright ? "break-words" : "truncate"}`}>{name}</div>
            <div className="text-white/50 font-semibold mt-0.5">
              {shown.length} {shown.length === 1 ? "seat" : "seats"}
            </div>
          </div>
        )}
      </div>

      {shown.map((seat, index) => {
        const spot = spots[index];
        const classes = `absolute flex items-center justify-center rounded-full border-2 border-white font-bold text-white shadow-sm ${
          seat.status === "available" ? "bg-green-500" : "bg-red-500"
        }`;
        const style = {
          left: `calc(50% + ${spot.x}px)`,
          top: `calc(50% + ${spot.y}px)`,
          width: seatSize,
          height: seatSize,
          transform: "translate(-50%, -50%)",
          fontSize: Math.max(8, 10 * scale),
        };
        const status = seat.status === "available" ? "open" : "taken";
        const label = stool ? `${name}: ${status}` : `Seat ${seat.id}: ${status}`;
        const text = stool ? stoolNumber(name) : seat.id;

        return onSeatClick ? (
          <button
            key={seat.id}
            type="button"
            disabled={seatsDisabled}
            onPointerDown={(event) => {
              if (!seatsDisabled) event.stopPropagation();
            }}
            onClick={(event) => {
              event.stopPropagation();
              onSeatClick(seat.id);
            }}
            title={label}
            aria-label={label}
            className={`${classes} ${seatsDisabled ? "cursor-default opacity-90" : "transition-transform hover:scale-110 active:scale-95"}`}
            style={style}
          >
            {text}
          </button>
        ) : (
          <span key={seat.id} title={label} className={classes} style={style}>
            {text}
          </span>
        );
      })}

      {shape === "barberChair" && shown[0] && (
        <ChairTimer seat={shown[0]} fontSize={Math.max(9, 10 * scale)} />
      )}
    </div>
  );
}
