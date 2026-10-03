import { getOpenStatus, toMinutes, type DayName } from "@seatmate/shared/business-hours";

import type { Place, SeatSummary } from "@/lib/places";

// Labels shared by the place cards and the place screen, worded like the
// website.

// Seat counts older than this get a "may have changed" note.
export const STALE_AFTER_MINUTES = 15;

export const DAY_LABELS: { key: DayName; label: string }[] = [
  { key: "monday", label: "Monday" },
  { key: "tuesday", label: "Tuesday" },
  { key: "wednesday", label: "Wednesday" },
  { key: "thursday", label: "Thursday" },
  { key: "friday", label: "Friday" },
  { key: "saturday", label: "Saturday" },
  { key: "sunday", label: "Sunday" },
];

// "17:30" -> "5:30 PM".
export function formatHour(time: string) {
  const minutes = toMinutes(time);
  if (minutes === null) return time;

  const hour = Math.floor(minutes / 60) % 24;
  const minute = minutes % 60;
  return `${hour % 12 || 12}:${String(minute).padStart(2, "0")} ${hour >= 12 ? "PM" : "AM"}`;
}

export function availabilityLabel(summary: SeatSummary) {
  if (summary.totalSeats === 0) return "No seats listed yet";
  const percentage = Math.round((summary.availableSeats / summary.totalSeats) * 100);
  if (percentage >= 60) return "Plenty of seating";
  if (percentage >= 25) return "Some seats available";
  if (percentage > 0) return "Limited seating";
  return "Currently full";
}

// Green / amber / red for a place's seat count.
export function availabilityTone(summary: SeatSummary): "good" | "some" | "full" | "none" {
  if (summary.totalSeats === 0) return "none";
  const share = summary.availableSeats / summary.totalSeats;
  if (share >= 0.6) return "good";
  if (share > 0) return "some";
  return "full";
}

export const TONE_COLORS = {
  good: { dot: "#22c55e", text: "#15803d", soft: "#ecfdf5" },
  some: { dot: "#f59e0b", text: "#b45309", soft: "#fffbeb" },
  full: { dot: "#ef4444", text: "#b91c1c", soft: "#fef2f2" },
  none: { dot: "#9ca3af", text: "#6b7280", soft: "#f3f4f6" },
};

export function minutesAgo(latestUpdateMs: number | null, now: number) {
  return latestUpdateMs === null ? null : Math.max(0, Math.floor((now - latestUpdateMs) / 60000));
}

export function freshnessLabel(latestUpdateMs: number | null, now: number) {
  const age = minutesAgo(latestUpdateMs, now);
  if (age === null) return "No occupancy update yet";
  if (age < 1) return "Updated just now";
  if (age === 1) return "Updated 1 minute ago";
  if (age < 60) return `Updated ${age} minutes ago`;
  const hours = Math.floor(age / 60);
  if (hours < 24) return hours === 1 ? "Updated 1 hour ago" : `Updated ${hours} hours ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "Updated yesterday" : `Updated ${days} days ago`;
}

// Short form for cards: "2m ago", "3h ago".
export function shortAge(latestUpdateMs: number | null, now: number) {
  const age = minutesAgo(latestUpdateMs, now);
  if (age === null) return null;
  if (age < 1) return "now";
  if (age < 60) return `${age}m ago`;
  if (age < 60 * 24) return `${Math.floor(age / 60)}h ago`;
  return `${Math.floor(age / 60 / 24)}d ago`;
}

export const isStale = (latestUpdateMs: number | null, now: number) => {
  const age = minutesAgo(latestUpdateMs, now);
  return age === null || age >= STALE_AFTER_MINUTES;
};

// Open/closed right now plus today's hours, or null when the place hasn't
// set its hours.
export function openNow(place: Pick<Place, "hours" | "timezone">, now: number) {
  const status = getOpenStatus(place.hours, place.timezone, now);
  if (!status) return null;

  const today = place.hours?.[status.day];
  const todayLabel = !today
    ? null
    : today.closed
      ? "Closed today"
      : `${formatHour(today.open)} – ${formatHour(today.close)}`;

  return { open: status.open, day: status.day, todayLabel };
}

// "88 Mission St, Sacramento, CA 95814" -> "Sacramento".
export function cityOf(address: string) {
  const parts = address.split(",").map((part) => part.trim()).filter(Boolean);
  const stateIndex = parts.findIndex((part) => /^[A-Z]{2}(\s+\d{5}(-\d{4})?)?$/.test(part));
  const name = stateIndex >= 1 ? parts[stateIndex - 1] : "";
  return name && !/\d/.test(name) ? name : "";
}

// First line of an address, for compact cards.
export const street = (address: string) => address.split(",")[0]?.trim() || address;

export function greeting(now: number) {
  const hour = new Date(now).getHours();
  if (hour < 5) return "Up late";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}
