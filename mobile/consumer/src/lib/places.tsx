import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { collection, onSnapshot, Timestamp } from "firebase/firestore";
import NetInfo from "@react-native-community/netinfo";

import { getOpenStatus, type Hours } from "@seatmate/shared/business-hours";
import { isBar, isBarbershop, isBowlingAlley } from "@seatmate/shared/floor-plan";

import { db, firebaseConfigured } from "@/lib/firebase";
import { CONSUMER_SITE_URL } from "@/lib/site-urls";

// Every listed place (publicBusinesses) with live open/total seat counts from
// its tables, kept up to date while the app is open. The website reads the
// same documents, so the app and seatmate360.com always agree.

export type Place = {
  slug: string;
  businessId: string;
  name: string;
  address: string;
  type: string;
  zipcode: string;
  // Absolute URL, or "" when the place hasn't added a photo.
  imageUrl: string;
  hours?: Hours;
  timezone?: string;
};

export type SeatSummary = {
  availableSeats: number;
  totalSeats: number;
  latestUpdateMs: number | null;
};

export type PlaceWithSeats = Place & SeatSummary & { seatsLoaded: boolean };

const NO_SEATS: SeatSummary = { availableSeats: 0, totalSeats: 0, latestUpdateMs: null };

const zipFromAddress = (address: string) => address.match(/\b\d{5}(?:-\d{4})?\b/)?.[0]?.slice(0, 5) || "";

// Uploaded cover photos are served by the website at a relative path
// (/api/place-photo/{id}), so point those at the live site.
export const absoluteImage = (url: string) => (url.startsWith("/") ? `${CONSUMER_SITE_URL}${url}` : url);

export function toPlace(slug: string, data: Record<string, unknown>): Place {
  const address = String(data.address || "");

  return {
    slug,
    businessId: String(data.businessId || ""),
    name: String(data.name || ""),
    address,
    type: String(data.type || ""),
    zipcode: String(data.zipcode || data.zip || zipFromAddress(address)).trim(),
    imageUrl: absoluteImage(String(data.imageUrl || data.coverImageUrl || data.photoUrl || "")),
    hours: typeof data.hours === "object" && data.hours ? (data.hours as Hours) : undefined,
    timezone: typeof data.timezone === "string" ? data.timezone : undefined,
  };
}

// Stock photos for places that haven't uploaded one, picked per place so the
// same place always gets the same photo (the website's list).
const FALLBACK_IMAGES = [
  "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&w=1200&q=82",
  "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=82",
  "https://images.unsplash.com/photo-1552566626-52f8b828add9?auto=format&fit=crop&w=1200&q=82",
  "https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&w=1200&q=82",
];

export function fallbackImageFor(value: string) {
  const hash = value.split("").reduce((total, character) => total + character.charCodeAt(0), 0);
  return FALLBACK_IMAGES[hash % FALLBACK_IMAGES.length];
}

export const placeImage = (place: { imageUrl: string; name: string; slug: string }) =>
  place.imageUrl || fallbackImageFor(place.name || place.slug);

// Seats open as a share of all seats, or null when the place has none.
export const openShare = (place: SeatSummary) =>
  place.totalSeats > 0 ? place.availableSeats / place.totalSeats : null;

// Open places before closed ones, then most open seats first; places
// without seat data last, then by name.
export const sortByAvailability = (places: PlaceWithSeats[], now = Date.now()) => {
  const closed = (place: PlaceWithSeats) => (getOpenStatus(place.hours, place.timezone, now)?.open === false ? 1 : 0);
  return [...places].sort(
    (a, b) =>
      closed(a) - closed(b) ||
      (openShare(b) ?? -1) - (openShare(a) ?? -1) ||
      b.availableSeats - a.availableSeats ||
      a.name.localeCompare(b.name)
  );
};

// Categories, matching the website's search filters.
export type Category = "all" | "available" | "cafe" | "restaurant" | "bar" | "barbershop" | "bowling";

export const CATEGORIES: { value: Category; label: string }[] = [
  { value: "all", label: "All" },
  { value: "available", label: "Open seats" },
  { value: "cafe", label: "Cafés" },
  { value: "restaurant", label: "Restaurants" },
  { value: "bar", label: "Bars" },
  { value: "barbershop", label: "Barbershops" },
  { value: "bowling", label: "Bowling" },
];

export function inCategory(place: PlaceWithSeats, category: Category) {
  const type = place.type.toLowerCase();

  switch (category) {
    case "available":
      return place.availableSeats > 0;
    case "cafe":
      return type.includes("cafe") || type.includes("café") || type.includes("coffee");
    case "restaurant":
      return type.includes("restaurant");
    case "bar":
      return isBar(place.type);
    case "barbershop":
      return isBarbershop(place.type);
    case "bowling":
      return isBowlingAlley(place.type);
    default:
      return true;
  }
}


type PlacesValue = {
  places: PlaceWithSeats[];
  loading: boolean;
  error: string;
  // Listens for places again after a failed load.
  retry: () => void;
};

const PlacesContext = createContext<PlacesValue | null>(null);

function summarize(docs: { data: () => Record<string, unknown> }[]): SeatSummary {
  const summary = { ...NO_SEATS };

  docs.forEach((tableDoc) => {
    const table = tableDoc.data();
    const seats: { status?: string }[] = Array.isArray(table.seats) ? table.seats : [];

    summary.totalSeats += seats.length;
    summary.availableSeats += seats.filter((seat) => seat.status === "available").length;

    if (table.occupancyUpdatedAt instanceof Timestamp) {
      const updateMs = table.occupancyUpdatedAt.toMillis();
      if (summary.latestUpdateMs === null || updateMs > summary.latestUpdateMs) {
        summary.latestUpdateMs = updateMs;
      }
    }
  });

  return summary;
}

export function PlacesProvider({ children }: { children: ReactNode }) {
  const [places, setPlaces] = useState<Place[]>([]);
  const [seats, setSeats] = useState<Record<string, SeatSummary>>({});
  const [loading, setLoading] = useState(firebaseConfigured);
  const [error, setError] = useState(
    firebaseConfigured ? "" : "SeatMate isn't connected to its database in this build."
  );
  const tableWatchers = useRef(new Map<string, () => void>());
  // Bumped by retry() to start a fresh listener.
  const [attempt, setAttempt] = useState(0);

  const retry = useCallback(() => {
    if (!firebaseConfigured) return;
    setError("");
    setLoading(true);
    setAttempt((value) => value + 1);
  }, []);

  useEffect(() => {
    if (!firebaseConfigured) return;

    return onSnapshot(
      collection(db, "publicBusinesses"),
      (snapshot) => {
        setPlaces(snapshot.docs.map((placeDoc) => toPlace(placeDoc.id, placeDoc.data())));
        setLoading(false);
        setError("");
      },
      (caught) => {
        console.error("Could not load places:", caught);
        setError("We couldn't load places. Check your connection and try again.");
        setLoading(false);
      }
    );
  }, [attempt]);

  // After a failed load, try again by itself once the phone is back online.
  useEffect(() => {
    if (!error || !firebaseConfigured) return;

    let wasOffline = false;
    return NetInfo.addEventListener((state) => {
      const offline = state.isConnected === false || state.isInternetReachable === false;
      if (offline) wasOffline = true;
      else if (wasOffline) retry();
    });
  }, [error, retry]);

  // One live listener per business's tables, added and removed as places
  // are listed or unlisted.
  useEffect(() => {
    const watchers = tableWatchers.current;
    const wanted = new Set(places.map((place) => place.businessId).filter(Boolean));

    watchers.forEach((stop, businessId) => {
      if (!wanted.has(businessId)) {
        stop();
        watchers.delete(businessId);
      }
    });

    wanted.forEach((businessId) => {
      if (watchers.has(businessId)) return;

      watchers.set(
        businessId,
        onSnapshot(
          collection(db, "businesses", businessId, "tables"),
          (snapshot) => setSeats((current) => ({ ...current, [businessId]: summarize(snapshot.docs) })),
          (caught) => {
            // A place whose tables can't be read counts as having no seat data.
            console.error(`Could not load seating for ${businessId}:`, caught);
            setSeats((current) => ({ ...current, [businessId]: NO_SEATS }));
          }
        )
      );
    });
  }, [places]);

  useEffect(() => {
    const watchers = tableWatchers.current;
    return () => {
      watchers.forEach((stop) => stop());
      watchers.clear();
    };
  }, []);

  const value = useMemo<PlacesValue>(
    () => ({
      places: places.map((place) => ({
        ...place,
        ...(seats[place.businessId] ?? NO_SEATS),
        seatsLoaded: place.businessId in seats || !place.businessId,
      })),
      loading,
      error,
      retry,
    }),
    [places, seats, loading, error, retry]
  );

  return <PlacesContext.Provider value={value}>{children}</PlacesContext.Provider>;
}

export function usePlaces() {
  const value = useContext(PlacesContext);
  if (!value) throw new Error("usePlaces must be used inside <PlacesProvider>.");
  return value;
}

export function usePlace(slug: string | undefined) {
  const { places, loading, error, retry } = usePlaces();
  return { place: places.find((place) => place.slug === slug) ?? null, loading, error, retry };
}
