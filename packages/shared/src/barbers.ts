// Barber profiles and the haircut timer on each barber chair. Plain
// TypeScript with no React or Firebase imports, so the websites and both
// Expo apps share it.
//
// Data:
// - businesses/{businessId}/barbers/{barberId}: name, instagram, bio,
//   chairId (the barber chair "table" they work at), cutMinutes (their usual
//   cut length) and photos ([{ id, version }], newest first).
// - businesses/{businessId}/barbers/{barberId}/photos/{photoId}: one
//   compressed square JPEG of a past cut, as a data URL (like cover photos,
//   no separate file storage). The customer site serves them from
//   /api/barber-photo/{businessId}/{barberId}/{photoId}.
// - Each chair's seat keeps occupiedSince / openSince (when it last changed)
//   and recentCuts (the last few cut lengths, in seconds), which is how
//   customers get "about 6 min left".

import type { TableSeat } from "./table-geometry";

export const BARBERS = "barbers";
export const BARBER_PHOTOS = "photos";

export const MAX_BARBER_PHOTOS = 8;
// A 1080px square JPEG fits easily; Firestore documents max out at 1 MB.
export const MAX_BARBER_PHOTO_DATA_LENGTH = 450_000;
export const BARBER_PHOTO_SIZE = 1080;

export const MAX_NAME_LENGTH = 40;
export const MAX_BIO_LENGTH = 240;

// Usual cut length choices, in minutes, and the default when a barber has
// none set.
export const CUT_MINUTE_CHOICES = [15, 20, 25, 30, 35, 40, 45, 50, 60, 75, 90];
export const DEFAULT_CUT_MINUTES = 30;

export type BarberPhoto = { id: string; version: number };

export type Barber = {
  id: string;
  name: string;
  // Without the @.
  instagram: string;
  bio: string;
  chairId: string;
  cutMinutes: number;
  photos: BarberPhoto[];
  order: number;
};

type DocData = Record<string, unknown>;

const text = (value: unknown, max: number) => (typeof value === "string" ? value.trim().slice(0, max) : "");

export function readBarber(id: string, data: DocData): Barber {
  const photos = Array.isArray(data.photos)
    ? (data.photos as unknown[])
        .filter(
          (photo): photo is BarberPhoto =>
            typeof photo === "object" &&
            photo !== null &&
            typeof (photo as BarberPhoto).id === "string" &&
            typeof (photo as BarberPhoto).version === "number"
        )
        .slice(0, MAX_BARBER_PHOTOS)
    : [];

  return {
    id,
    name: text(data.name, MAX_NAME_LENGTH) || "Barber",
    instagram: cleanInstagram(data.instagram) ?? "",
    bio: text(data.bio, MAX_BIO_LENGTH),
    chairId: typeof data.chairId === "string" ? data.chairId : "",
    cutMinutes:
      typeof data.cutMinutes === "number" && data.cutMinutes >= 5 && data.cutMinutes <= 240
        ? Math.round(data.cutMinutes)
        : DEFAULT_CUT_MINUTES,
    photos,
    order: typeof data.order === "number" ? data.order : 0,
  };
}

export const sortBarbers = <T extends { order: number; name: string }>(barbers: T[]) =>
  [...barbers].sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));

// "@fades.by.marcus", "instagram.com/fades.by.marcus/" or "fades.by.marcus"
// → "fades.by.marcus". "" for empty, null when it can't be a handle.
export function cleanInstagram(value: unknown): string | null {
  if (typeof value !== "string") return "";
  const handle = value
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/^(www\.)?instagram\.com\//i, "")
    .replace(/^@/, "")
    .replace(/[/?#].*$/, "");
  if (!handle) return "";
  return /^[A-Za-z0-9._]{1,30}$/.test(handle) ? handle : null;
}

export const instagramUrl = (handle: string) => `https://instagram.com/${handle}`;

export const barberPhotoPath = (businessId: string, barberId: string, photo: BarberPhoto) =>
  `/api/barber-photo/${businessId}/${barberId}/${photo.id}?v=${photo.version}`;

// "Marcus Reed" → "MR", for the avatar when there are no photos yet.
export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "B";

// ---------------------------------------------------------------------------
// Chair timer
// ---------------------------------------------------------------------------

// Cuts shorter or longer than this were most likely a mis-tap or a chair
// someone forgot to free, so they don't count towards the usual length.
const MIN_CUT_SECONDS = 3 * 60;
const MAX_CUT_SECONDS = 3 * 60 * 60;
const RECENT_CUTS = 10;
// How many finished cuts a chair needs before its own average is used.
const CUTS_TO_LEARN = 3;

// A seat after it changes to `status` at `now`. The timer starts over on
// every change: occupiedSince while someone is in the chair, openSince while
// it's free. Finishing a cut also records how long it took.
export function changeSeat<S extends TableSeat>(seat: S, status: TableSeat["status"], now: number): S {
  const { occupiedSince, openSince, ...rest } = seat;
  void openSince;

  if (status === "occupied") {
    return { ...rest, status, occupiedSince: now } as S;
  }

  let recentCuts = Array.isArray(seat.recentCuts) ? seat.recentCuts.filter((cut) => typeof cut === "number") : undefined;
  if (seat.status === "occupied" && typeof occupiedSince === "number") {
    const seconds = Math.round((now - occupiedSince) / 1000);
    if (seconds >= MIN_CUT_SECONDS && seconds <= MAX_CUT_SECONDS) {
      recentCuts = [...(recentCuts ?? []), seconds].slice(-RECENT_CUTS);
    }
  }

  const next = { ...rest, status, openSince: now } as S;
  if (recentCuts) next.recentCuts = recentCuts;
  else delete next.recentCuts;
  return next;
}

// How long a cut in this chair usually takes, in ms: the chair's own recent
// average once it has a few, otherwise the barber's usual length.
export function usualCutMs(seat: TableSeat | undefined, barber?: Pick<Barber, "cutMinutes"> | null) {
  const cuts = (seat?.recentCuts ?? []).filter((cut) => cut >= MIN_CUT_SECONDS && cut <= MAX_CUT_SECONDS);
  if (cuts.length >= CUTS_TO_LEARN) {
    const average = cuts.reduce((sum, cut) => sum + cut, 0) / cuts.length;
    return Math.round(average) * 1000;
  }
  return (barber?.cutMinutes ?? DEFAULT_CUT_MINUTES) * 60_000;
}

export type ChairProgress =
  | { state: "open"; sinceMs: number | null }
  | {
      state: "cutting";
      elapsedMs: number;
      usualMs: number;
      // 0 when the cut starts, 1 at its usual length (capped).
      fraction: number;
      // Negative once the cut runs over.
      remainingMs: number;
      learned: boolean;
    }
  | { state: "taken" };

export function chairProgress(
  seat: TableSeat | undefined,
  barber: Pick<Barber, "cutMinutes"> | null | undefined,
  now: number
): ChairProgress {
  if (!seat || seat.status !== "occupied") {
    const since = typeof seat?.openSince === "number" ? seat.openSince : null;
    return { state: "open", sinceMs: since === null ? null : Math.max(0, now - since) };
  }
  if (typeof seat.occupiedSince !== "number") return { state: "taken" };

  const elapsedMs = Math.max(0, now - seat.occupiedSince);
  const usualMs = usualCutMs(seat, barber);
  return {
    state: "cutting",
    elapsedMs,
    usualMs,
    fraction: Math.min(1, elapsedMs / usualMs),
    remainingMs: usualMs - elapsedMs,
    learned: (seat.recentCuts ?? []).length >= CUTS_TO_LEARN,
  };
}

// The progress bar runs red (just sat down) through orange and yellow to
// green (nearly done). These stops are shared by every bar.
export const PROGRESS_STOPS = ["#ef4444", "#f97316", "#eab308", "#22c55e"] as const;

const hexToRgb = (hex: string) => [1, 3, 5].map((index) => parseInt(hex.slice(index, index + 2), 16));

// The bar's color at a point along it (0 = red, 1 = green).
export function progressColor(fraction: number) {
  const f = Math.min(1, Math.max(0, fraction)) * (PROGRESS_STOPS.length - 1);
  const index = Math.min(PROGRESS_STOPS.length - 2, Math.floor(f));
  const local = f - index;
  const from = hexToRgb(PROGRESS_STOPS[index]);
  const to = hexToRgb(PROGRESS_STOPS[index + 1]);
  const mixed = from.map((channel, i) => Math.round(channel + (to[i] - channel) * local));
  return `#${mixed.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}

// Text in the bar's color, a little darker so yellow stays readable on white.
export function progressTextColor(fraction: number) {
  const channels = hexToRgb(progressColor(fraction)).map((channel) => Math.round(channel * 0.72));
  return `#${channels.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}

const minutes = (ms: number) => Math.max(1, Math.round(ms / 60_000));

// Short status line under the bar.
export function progressLabel(progress: ChairProgress) {
  switch (progress.state) {
    case "open":
      return progress.sinceMs === null || progress.sinceMs < 60_000
        ? "Open now"
        : `Open for ${minutes(progress.sinceMs)} min`;
    case "taken":
      return "In the chair";
    case "cutting": {
      if (progress.remainingMs <= 60_000 && progress.remainingMs > -60_000) return "Finishing up";
      if (progress.remainingMs < 0) return `${minutes(-progress.remainingMs)} min over usual`;
      return `About ${minutes(progress.remainingMs)} min left`;
    }
  }
}

// "Usually about 25 min" (learned from the chair) or the barber's setting.
export const usualLabel = (progress: ChairProgress) =>
  progress.state === "cutting" ? `Cuts here usually take about ${minutes(progress.usualMs)} min` : "";
