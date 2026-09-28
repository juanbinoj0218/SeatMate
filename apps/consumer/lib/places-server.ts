import "server-only";

import {
  cityFromAddress,
  type City,
  type PublicPlace,
  toPublicPlace,
} from "@/lib/place-data";

// Reads the public place list on the server (city pages, link previews,
// sitemap) through Firestore's REST API. publicBusinesses is publicly
// readable, so this needs no login, and results are cached for 5 minutes.

const REVALIDATE_SECONDS = 300;

const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
const emulator = process.env.FIRESTORE_EMULATOR_HOST;

const documentsUrl = `${
  emulator ? `http://${emulator}/v1` : "https://firestore.googleapis.com/v1"
}/projects/${projectId}/databases/(default)/documents`;

type RestValue = {
  stringValue?: string;
  integerValue?: string;
  doubleValue?: number;
  booleanValue?: boolean;
};

type RestDocument = {
  name: string;
  fields?: Record<string, RestValue>;
};

const plainFields = (fields: Record<string, RestValue> = {}) =>
  Object.fromEntries(
    Object.entries(fields).map(([key, value]) => [
      key,
      value.stringValue ?? value.integerValue ?? value.doubleValue ?? value.booleanValue ?? "",
    ])
  );

const toPlace = (document: RestDocument) =>
  toPublicPlace(document.name.split("/").pop() || "", plainFields(document.fields));

async function firestoreGet<T>(path: string, params: Record<string, string> = {}): Promise<T | null> {
  if (!projectId) {
    return null;
  }

  const url = new URL(`${documentsUrl}/${path}`);
  if (apiKey && !emulator) url.searchParams.set("key", apiKey);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));

  try {
    const response = await fetch(url, { next: { revalidate: REVALIDATE_SECONDS } });
    return response.ok ? ((await response.json()) as T) : null;
  } catch (error) {
    console.error(`Could not load ${path}:`, error);
    return null;
  }
}

export async function listPlacesServer(): Promise<PublicPlace[]> {
  const places: PublicPlace[] = [];
  let pageToken = "";

  // A few pages of 300 is plenty; stop early if something loops.
  for (let page = 0; page < 20; page += 1) {
    const result = await firestoreGet<{ documents?: RestDocument[]; nextPageToken?: string }>(
      "publicBusinesses",
      { pageSize: "300", ...(pageToken ? { pageToken } : {}) }
    );

    places.push(...(result?.documents ?? []).map(toPlace));

    if (!result?.nextPageToken) break;
    pageToken = result.nextPageToken;
  }

  return places.filter((place) => place.name);
}

export async function getPlaceServer(slug: string): Promise<PublicPlace | null> {
  if (!/^[\w-]{1,200}$/.test(slug)) {
    return null;
  }

  const document = await firestoreGet<RestDocument>(`publicBusinesses/${slug}`);
  return document?.fields ? toPlace(document) : null;
}

export type CityGroup = City & { places: PublicPlace[] };

export async function listCitiesServer(): Promise<CityGroup[]> {
  const cities = new Map<string, CityGroup>();

  (await listPlacesServer()).forEach((place) => {
    const city = cityFromAddress(place.address);
    if (!city) return;

    const group = cities.get(city.slug) ?? { ...city, places: [] };
    group.places.push(place);
    cities.set(city.slug, group);
  });

  return [...cities.values()].sort(
    (a, b) => b.places.length - a.places.length || a.name.localeCompare(b.name)
  );
}
