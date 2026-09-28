import {
  collection,
  doc,
  getDoc,
  getDocs,
  Timestamp,
} from "firebase/firestore";

import { db } from "@seatmate/shared/firebase";

import {
  type PublicPlace,
  type SeatSummary,
  type PlaceWithSeats,
  toPublicPlace,
} from "@/lib/place-data";

export {
  type PublicPlace,
  type SeatSummary,
  type PlaceWithSeats,
  zipFromAddress,
} from "@/lib/place-data";

// Public place data and live seat counts, shared by the home, search and
// account pages.

const NO_SEATS: SeatSummary = {
  availableSeats: 0,
  totalSeats: 0,
  latestUpdateMs: null,
};

export async function fetchPublicPlaces(): Promise<PublicPlace[]> {
  const snapshot = await getDocs(collection(db, "publicBusinesses"));

  return snapshot.docs.map((placeDoc) =>
    toPublicPlace(placeDoc.id, placeDoc.data())
  );
}

// Open/total seats across a business's tables, plus the latest occupancy
// update. A place whose tables can't be read counts as having no seat data
// instead of failing the whole list it belongs to.
export async function fetchSeatSummary(
  businessId: string
): Promise<SeatSummary> {
  if (!businessId) {
    return NO_SEATS;
  }

  try {
    const tables = await getDocs(
      collection(db, "businesses", businessId, "tables")
    );

    const summary = { ...NO_SEATS };

    tables.docs.forEach((tableDoc) => {
      const table = tableDoc.data();
      const seats = Array.isArray(table.seats) ? table.seats : [];

      summary.totalSeats += seats.length;
      summary.availableSeats += seats.filter(
        (seat: { status?: string }) => seat.status === "available"
      ).length;

      if (table.occupancyUpdatedAt instanceof Timestamp) {
        const updateMs = table.occupancyUpdatedAt.toMillis();

        if (
          summary.latestUpdateMs === null ||
          updateMs > summary.latestUpdateMs
        ) {
          summary.latestUpdateMs = updateMs;
        }
      }
    });

    return summary;
  } catch (error) {
    console.error(`Could not load seating for ${businessId}:`, error);
    return NO_SEATS;
  }
}

export const withSeatSummaries = (
  places: PublicPlace[]
): Promise<PlaceWithSeats[]> =>
  Promise.all(
    places.map(async (place) => ({
      ...place,
      ...(await fetchSeatSummary(place.businessId)),
    }))
  );

// Seat summary for one place by slug; null when it is no longer listed.
export async function fetchPlaceSeats(
  slug: string
): Promise<SeatSummary | null> {
  const placeDoc = await getDoc(doc(db, "publicBusinesses", slug));

  if (!placeDoc.exists()) {
    return null;
  }

  return fetchSeatSummary(String(placeDoc.data().businessId || ""));
}
