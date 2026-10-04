// Plain place data and helpers with no Firebase imports, so both browser
// pages and server pages (city pages, link previews, sitemap) can use them.

import { slugify } from "@seatmate/shared/slug";

export type PublicPlace = {
  slug: string;
  businessId: string;
  // Raw values: empty strings when missing, so each page picks its own
  // display defaults.
  name: string;
  address: string;
  type: string;
  zipcode: string;
  imageUrl: string;
};

export type SeatSummary = {
  availableSeats: number;
  totalSeats: number;
  latestUpdateMs: number | null;
};

export type PlaceWithSeats = PublicPlace & SeatSummary;

export const zipFromAddress = (address: string) =>
  address.match(/\b\d{5}(?:-\d{4})?\b/)?.[0]?.slice(0, 5) || "";

export const toPublicPlace = (slug: string, data: Record<string, unknown>): PublicPlace => {
  const address = String(data.address || "");

  return {
    slug,
    businessId: String(data.businessId || ""),
    name: String(data.name || ""),
    address,
    type: String(data.type || ""),
    zipcode: String(
      data.zipcode || data.zip || zipFromAddress(address)
    ).trim(),
    imageUrl: String(
      data.imageUrl || data.coverImageUrl || data.photoUrl || ""
    ),
  };
};

// Stock photos for places that haven't uploaded one, picked per place so
// the same place always gets the same photo.
const FALLBACK_IMAGES = [
  "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&w=1200&q=82",
  "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=82",
  "https://images.unsplash.com/photo-1552566626-52f8b828add9?auto=format&fit=crop&w=1200&q=82",
  "https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&w=1200&q=82",
];

function hashString(value: string) {
  return value.split("").reduce((total, character) => {
    return total + character.charCodeAt(0);
  }, 0);
}

export function fallbackImageFor(value: string) {
  return FALLBACK_IMAGES[hashString(value) % FALLBACK_IMAGES.length];
}

export type City = {
  name: string;
  state: string;
  slug: string;
};

// "88 Mission St, San Francisco, CA 94105" -> San Francisco, CA.
export function cityFromAddress(address: string): City | null {
  const parts = address.split(",").map((part) => part.trim()).filter(Boolean);
  const stateIndex = parts.findIndex((part) => /^[A-Z]{2}(\s+\d{5}(-\d{4})?)?$/.test(part));

  if (stateIndex < 1) {
    return null;
  }

  const name = parts[stateIndex - 1];
  const state = parts[stateIndex].slice(0, 2);

  if (!name || /\d/.test(name)) {
    return null;
  }

  return { name, state, slug: slugify(`${name}-${state}`) };
}
