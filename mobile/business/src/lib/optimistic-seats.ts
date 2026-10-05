import { useEffect, useRef, useState } from "react";

import type { Table } from "@/lib/floor";
import { tap, warning } from "@/lib/haptics";
import { setSeatStatus, type SeatStatus } from "@/lib/seat-updates";

// A seat change the person has made that the live snapshot may not show yet.
// `settledOn` is the snapshot that was current when the write went through:
// the change keeps showing until a newer snapshot arrives, so the seat never
// flickers back while the confirmation is on its way.
type PendingSeat = { status: SeatStatus; since: number; token: number; settledOn: Table[] | null };

const keyOf = (tableId: string, seatId: number) => `${tableId}:${seatId}`;

// Seat taps change the screen straight away. Seat writes are Firestore
// transactions, which (unlike plain updates) aren't applied locally until
// the server answers, so without this every tap would wait for a round trip.
// When a write fails the seat goes back to what the server has, with a
// warning haptic and `onError`.
export function useOptimisticSeats(
  businessId: string | null | undefined,
  tables: Table[] | null,
  onError: (message: string) => void
) {
  const [pending, setPending] = useState<Record<string, PendingSeat>>({});
  const latest = useRef(tables);
  const nextToken = useRef(0);

  useEffect(() => {
    latest.current = tables;
  }, [tables]);

  const shown = tables ? applyPending(tables, pending) : null;

  const toggleSeat = (tableId: string, seatId: number, failure = "Could not update this seat.") => {
    if (!businessId || !shown) return;
    const seat = shown.find((table) => table.id === tableId)?.seats.find((item) => item.id === seatId);
    if (!seat) return;

    const status: SeatStatus = seat.status === "available" ? "occupied" : "available";
    const key = keyOf(tableId, seatId);
    nextToken.current += 1;
    const token = nextToken.current;

    tap();
    setPending((current) => ({
      ...withoutStale(current, latest.current),
      [key]: { status, since: Date.now(), token, settledOn: null },
    }));

    setSeatStatus(businessId, tableId, seatId, status, shown).then(
      () =>
        setPending((current) => {
          const entry = current[key];
          if (entry?.token !== token) return current;
          return { ...current, [key]: { ...entry, settledOn: latest.current } };
        }),
      (error) => {
        console.error(error);
        setPending((current) => {
          if (current[key]?.token !== token) return current;
          const rest = { ...current };
          delete rest[key];
          return rest;
        });
        warning();
        onError(failure);
      }
    );
  };

  return { tables: shown, toggleSeat };
}

// Confirmed changes that a newer snapshot has already replaced.
function withoutStale(pending: Record<string, PendingSeat>, tables: Table[] | null) {
  const kept: Record<string, PendingSeat> = {};
  Object.entries(pending).forEach(([key, entry]) => {
    if (!entry.settledOn || entry.settledOn === tables) kept[key] = entry;
  });
  return kept;
}

function applyPending(tables: Table[], pending: Record<string, PendingSeat>) {
  if (Object.keys(pending).length === 0) return tables;

  return tables.map((table) => {
    let changed = false;
    const seats = table.seats.map((seat) => {
      const entry = pending[keyOf(table.id, seat.id)];
      if (!entry || (entry.settledOn && entry.settledOn !== tables) || seat.status === entry.status) return seat;

      changed = true;
      if (entry.status === "occupied") return { ...seat, status: entry.status, occupiedSince: entry.since };
      const { occupiedSince, ...rest } = seat;
      return { ...rest, status: entry.status };
    });
    return changed ? { ...table, seats } : table;
  });
}
