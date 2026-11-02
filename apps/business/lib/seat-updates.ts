import { doc, runTransaction, serverTimestamp } from "firebase/firestore";

import { recordOccupancy } from "@seatmate/shared/analytics";
import { changeSeat } from "@seatmate/shared/barbers";
import { auth, db } from "@seatmate/shared/firebase";
import { notifySeatAlerts } from "@seatmate/shared/seat-alerts";
import type { TableSeat } from "@seatmate/shared/table-geometry";

type SeatStatus = "available" | "occupied";

type SeatTable = {
  id: string;
  seats: TableSeat[];
};

// Flips one seat between open and taken (used by the owner's floor plan and
// the staff console), then logs occupancy for analytics and, when a seat
// opens, emails customers waiting for one.
export async function toggleSeat(
  businessId: string,
  tableId: string,
  seatId: number,
  tables: SeatTable[]
) {
  const tableRef = doc(db, "businesses", businessId, "tables", tableId);

  const newStatus = await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(tableRef);

    if (!snapshot.exists()) {
      throw new Error("Table not found.");
    }

    const seats: SeatTable["seats"] = snapshot.data().seats || [];
    let changedTo: SeatStatus | null = null;

    const updatedSeats = seats.map((seat) => {
      if (seat.id !== seatId) {
        return seat;
      }

      // The chair timer starts over on every change; finishing a cut also
      // records how long it took (barbers.ts).
      changedTo = seat.status === "available" ? "occupied" : "available";
      return changeSeat(seat, changedTo, Date.now());
    });

    transaction.update(tableRef, {
      seats: updatedSeats,
      occupancyUpdatedAt: serverTimestamp(),
    });

    return changedTo as SeatStatus | null;
  });

  if (!newStatus) {
    return;
  }

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
    const idToken = await auth.currentUser?.getIdToken().catch(() => "");
    notifySeatAlerts(businessId, idToken || "");
  }
}
