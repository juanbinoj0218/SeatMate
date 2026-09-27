import { collection, doc, getDoc, getDocs } from "firebase/firestore";

import { db } from "@seatmate/shared/firebase";

export type Availability = {
  available: number;
  total: number;
};

// Current open/total seats for one public place, read the same way the home
// and search pages do. Returns null when the place is no longer listed.
export async function fetchAvailability(
  slug: string
): Promise<Availability | null> {
  const place = await getDoc(doc(db, "publicBusinesses", slug));

  if (!place.exists()) {
    return null;
  }

  const businessId = String(place.data().businessId || "");

  if (!businessId) {
    return { available: 0, total: 0 };
  }

  const tables = await getDocs(
    collection(db, "businesses", businessId, "tables")
  );

  let available = 0;
  let total = 0;

  tables.docs.forEach((tableDoc) => {
    const seats = tableDoc.data().seats;

    if (!Array.isArray(seats)) {
      return;
    }

    total += seats.length;
    available += seats.filter(
      (seat: { status?: string }) => seat.status === "available"
    ).length;
  });

  return { available, total };
}
