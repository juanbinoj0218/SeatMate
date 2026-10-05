import { doc, increment, runTransaction, serverTimestamp, setDoc } from "firebase/firestore";

import { dayKey } from "@seatmate/shared/day-key";

import { auth, db } from "@/lib/firebase";
import type { Table } from "@/lib/floor";
import { businessUrl } from "@/lib/site-urls";

export type SeatStatus = "available" | "occupied";

export { dayKey };

// businesses/{id}/stats/{day}: `updates` and, per hour, `occ_{h}` (sum of %
// seats taken at each update) and `n_{h}` (number of updates).
function recordOccupancy(businessId: string, openSeats: number, totalSeats: number) {
  if (totalSeats <= 0) return;

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

// The business site emails customers waiting for a seat; it only accepts
// the owner's or staff's ID token. Fire and forget: seat updates never wait
// on (or fail because of) alert emails.
async function notifySeatAlerts(businessId: string) {
  const idToken = await auth.currentUser?.getIdToken().catch(() => null);
  if (!idToken) return;

  fetch(businessUrl("/api/seat-alerts"), {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
    body: JSON.stringify({ businessId }),
  }).catch(() => {});
}

// Flips one seat between open and taken (owner's floor plan and the staff
// screen), then logs occupancy and, when a seat opens, sends seat alerts.
export function toggleSeat(businessId: string, tableId: string, seatId: number, tables: Table[]) {
  return writeSeat(businessId, tableId, seatId, tables, null);
}

// Sets one seat to the status the person saw it change to on screen. Unlike
// a flip, two quick taps (or two devices) can't cancel each other out: if
// the seat is already in that state nothing is written.
export function setSeatStatus(businessId: string, tableId: string, seatId: number, status: SeatStatus, tables: Table[]) {
  return writeSeat(businessId, tableId, seatId, tables, status);
}

async function writeSeat(
  businessId: string,
  tableId: string,
  seatId: number,
  tables: Table[],
  target: SeatStatus | null
) {
  const tableRef = doc(db, "businesses", businessId, "tables", tableId);

  const newStatus = await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(tableRef);

    if (!snapshot.exists()) {
      throw new Error("Table not found.");
    }

    const seats: { id: number; status: SeatStatus; occupiedSince?: number }[] = snapshot.data().seats || [];
    let changedTo: SeatStatus | null = null;

    const updatedSeats = seats.map((seat) => {
      if (seat.id !== seatId || seat.status === target) return seat;

      // Remember when the seat was taken so barber chairs can show how long
      // the current cut has been going; clear it again when the seat opens.
      if (seat.status === "available") {
        changedTo = "occupied";
        return { ...seat, status: changedTo, occupiedSince: Date.now() };
      }

      changedTo = "available";
      const { occupiedSince, ...rest } = seat;
      return { ...rest, status: changedTo };
    });

    const result = changedTo as SeatStatus | null;
    if (!result) return null;

    transaction.update(tableRef, {
      seats: updatedSeats,
      occupancyUpdatedAt: serverTimestamp(),
    });

    return result;
  });

  if (!newStatus) return;

  let open = 0;
  let total = 0;

  tables.forEach((table) =>
    table.seats.forEach((seat) => {
      total += 1;
      const status = table.id === tableId && seat.id === seatId ? newStatus : seat.status;
      if (status === "available") open += 1;
    })
  );

  recordOccupancy(businessId, open, total);

  if (newStatus === "available") {
    void notifySeatAlerts(businessId);
  }
}
