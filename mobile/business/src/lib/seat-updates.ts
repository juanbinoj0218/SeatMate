import { doc, increment, runTransaction, serverTimestamp, setDoc } from "firebase/firestore";

import { db } from "@/lib/firebase";
import type { Table } from "@/lib/floor";
import { businessUrl } from "@/lib/site-urls";

type SeatStatus = "available" | "occupied";

// YYYY-MM-DD in local time, matching the web sites' daily stats documents.
export const dayKey = (date = new Date()) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

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

// The business site emails customers waiting for a seat. Fire and forget:
// seat updates never wait on (or fail because of) alert emails.
function notifySeatAlerts(businessId: string) {
  fetch(businessUrl("/api/seat-alerts"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ businessId }),
  }).catch(() => {});
}

// Flips one seat between open and taken (owner's floor plan and the staff
// screen), then logs occupancy and, when a seat opens, sends seat alerts.
export async function toggleSeat(businessId: string, tableId: string, seatId: number, tables: Table[]) {
  const tableRef = doc(db, "businesses", businessId, "tables", tableId);

  const newStatus = await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(tableRef);

    if (!snapshot.exists()) {
      throw new Error("Table not found.");
    }

    const seats: { id: number; status: SeatStatus; occupiedSince?: number }[] = snapshot.data().seats || [];
    let changedTo: SeatStatus | null = null;

    const updatedSeats = seats.map((seat) => {
      if (seat.id !== seatId) return seat;

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

    transaction.update(tableRef, {
      seats: updatedSeats,
      occupancyUpdatedAt: serverTimestamp(),
    });

    return changedTo as SeatStatus | null;
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
    notifySeatAlerts(businessId);
  }
}
