"use client";

import { Timer } from "lucide-react";

// A table drawn from above with its seats tucked right up against its
// edge: in a ring around round tables and in rows along the long sides of
// rectangular ones. A bar stool or barber chair is a "table" with a single
// seat. Used by
// the floor-plan editor, the staff screen, the customer place page and the
// admin review.

import { useEffect, useState } from "react";

import { chairProgress, PROGRESS_STOPS } from "../barbers";

import {
  elapsed,
  isSingleSeat,
  stoolNumber,
  tableGeometry,
  type TableRotation,
  type TableSeat,
  type TableShape,
} from "../table-geometry";

export {
  isSingleSeat,
  parseTableRotation,
  parseTableShape,
  tableSize,
  type TableRotation,
  type TableSeat,
  type TableShape,
} from "../table-geometry";

// Pill under a barber chair: "Open" while free, and a running timer of how
// long the current customer has been in the chair once it is taken.
// A cut progress bar is added under it when `barber` is given (the customer
// floor plan): red to green as the cut nears its usual length, full green
// while open, with the barber's first name below.
function ChairTimer({
  seat,
  fontSize,
  barber,
}: {
  seat: TableSeat;
  fontSize: number;
  barber?: { name: string; cutMinutes: number } | null;
}) {
  const occupied = seat.status === "occupied";
  const since = occupied && typeof seat.occupiedSince === "number" ? seat.occupiedSince : null;
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (since === null) return;
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [since]);

  const pill = (
    <span
      className={`whitespace-nowrap rounded-full px-2 py-0.5 font-bold tabular-nums shadow-sm ${
        occupied ? "bg-red-50 text-red-600 ring-1 ring-red-200" : "bg-green-50 text-green-700 ring-1 ring-green-200"
      }`}
      style={{ fontSize }}
      aria-live="off"
    >
      {!occupied ? (
        "Open"
      ) : since === null ? (
        "In chair"
      ) : (
        <span className="inline-flex items-center gap-1">
          <Timer aria-hidden style={{ width: fontSize, height: fontSize }} />
          {elapsed(since, now)}
        </span>
      )}
    </span>
  );

  const progress = barber === undefined ? null : chairProgress(seat, barber, now);
  const fraction = progress?.state === "cutting" ? Math.max(0.06, progress.fraction) : 1;

  return (
    <span className="absolute left-1/2 top-full mt-1 flex -translate-x-1/2 flex-col items-center gap-1">
      {pill}
      {progress && progress.state !== "taken" && (
        <span className="block h-[5px] w-16 overflow-hidden rounded-full bg-gray-200">
          {progress.state === "cutting" ? (
            <span className="block h-full overflow-hidden rounded-full" style={{ width: `${fraction * 100}%` }}>
              <span
                className="block h-full"
                style={{ width: `${100 / fraction}%`, backgroundImage: `linear-gradient(90deg, ${PROGRESS_STOPS.join(", ")})` }}
              />
            </span>
          ) : (
            <span className="block h-full w-full bg-green-500" />
          )}
        </span>
      )}
      {barber && (
        <span className="whitespace-nowrap font-semibold text-gray-600" style={{ fontSize: fontSize * 0.95 }}>
          {barber.name.split(/\s+/)[0]}
        </span>
      )}
    </span>
  );
}

export default function TableWithSeats({
  name,
  shape,
  seats,
  scale = 1,
  rotation = 0,
  onSeatClick,
  seatsDisabled = false,
  className = "",
  barber,
}: {
  name: string;
  shape: TableShape;
  seats: TableSeat[];
  scale?: number;
  rotation?: TableRotation;
  onSeatClick?: (seatId: number) => void;
  seatsDisabled?: boolean;
  className?: string;
  // Barber chairs on the customer floor plan: the barber at this chair. When
  // set (null for a chair with nobody linked), a cut progress bar shows.
  barber?: { name: string; cutMinutes: number } | null;
}) {
  const stool = isSingleSeat(shape);
  const shown = stool ? seats.slice(0, 1) : seats;
  const { width, height, tableWidth, tableHeight, seatSize, spots } = tableGeometry(
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
            <div className="text-white/70 font-semibold mt-0.5">
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
        <ChairTimer seat={shown[0]} fontSize={Math.max(9, 10 * scale)} barber={barber} />
      )}
    </div>
  );
}
