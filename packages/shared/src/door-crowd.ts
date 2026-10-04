// How busy a bar is from its door count, without any Firebase calls, so the
// web sites and the mobile business app share it. Writes live in
// door-count.ts (web) and the app's own lib/door.ts.
//
// Bouncer mode for bars. Whoever is on the door taps +1 when someone comes
// in and -1 when they leave; customers see how busy the bar is compared with
// its usual crowd at this hour.
//
// Stored in businesses/{businessId}/live/door (publicly readable):
// - `enabled`: bouncer mode on or off (owner only).
// - `count`: people inside right now.
// - `updatedAt`: last tap.
// - `timezone`: the bar's time zone, so every device files taps under the
//   same hour of the day.
// - `hours`: per hour of the day ("0"–"23"), `sum` of the head count after
//   each tap and `n` taps. sum / n is the usual crowd at that hour.

export type DoorCount = {
  enabled: boolean;
  // People inside, or 0 when nobody has tapped for a long time.
  count: number;
  updatedAtMs: number | null;
  timezone: string;
  hours: Record<string, { sum: number; n: number }>;
};

// A count nobody has touched for this long is last night's, so it starts
// over from zero.
export const DOOR_STALE_MS = 8 * 60 * 60 * 1000;

// Taps needed at an hour (or overall) before we trust its average.
const MIN_SAMPLES = 20;

export const localTimezone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Los_Angeles";
  } catch {
    return "America/Los_Angeles";
  }
};

export function readDoorCount(
  data: Record<string, unknown> | undefined | null,
  nowMs = Date.now()
): DoorCount {
  // A Firestore Timestamp, read by shape so this works with any copy of the
  // Firebase SDK (the web sites' and the mobile app's).
  const updatedAt = data?.updatedAt as { toMillis?: () => number } | undefined;
  const updatedAtMs = typeof updatedAt?.toMillis === "function" ? updatedAt.toMillis() : null;
  const stale = updatedAtMs === null || nowMs - updatedAtMs > DOOR_STALE_MS;
  const rawCount = typeof data?.count === "number" ? Math.max(0, Math.floor(data.count)) : 0;

  const hours: DoorCount["hours"] = {};
  const rawHours = data?.hours;

  if (rawHours && typeof rawHours === "object") {
    Object.entries(rawHours as Record<string, unknown>).forEach(([hour, value]) => {
      const entry = value as { sum?: unknown; n?: unknown } | null;
      if (typeof entry?.sum === "number" && typeof entry?.n === "number" && entry.n > 0) {
        hours[hour] = { sum: entry.sum, n: entry.n };
      }
    });
  }

  return {
    enabled: data?.enabled === true,
    count: stale ? 0 : rawCount,
    updatedAtMs,
    timezone: typeof data?.timezone === "string" && data.timezone ? data.timezone : localTimezone(),
    hours,
  };
}

// Hour of the day (0–23) in the bar's time zone.
export function doorHour(timezone: string, nowMs = Date.now()) {
  try {
    const hour = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(new Date(nowMs))
      .find((part) => part.type === "hour")?.value;

    return Number(hour) % 24;
  } catch {
    return new Date(nowMs).getHours();
  }
}

// The bar's usual head count at this hour, falling back to its usual count
// at any hour. Null until there are enough taps to say.
export function usualCrowd(door: DoorCount, nowMs = Date.now()) {
  const thisHour = door.hours[String(doorHour(door.timezone, nowMs))];

  if (thisHour && thisHour.n >= MIN_SAMPLES) {
    return thisHour.sum / thisHour.n;
  }

  let sum = 0;
  let n = 0;
  Object.values(door.hours).forEach((hour) => {
    sum += hour.sum;
    n += hour.n;
  });

  return n >= MIN_SAMPLES ? sum / n : null;
}

export type CrowdLevel = "quiet" | "usual" | "busy";

export const CROWD_LEVELS: Record<
  CrowdLevel,
  { label: string; detail: string; className: string }
> = {
  quiet: {
    label: "Quiet",
    detail: "Fewer people than usual. Easy to grab a spot.",
    className: "bg-sky-400/15 text-sky-200 ring-sky-300/30",
  },
  usual: {
    label: "The usual crowd",
    detail: "About as busy as it normally is right now.",
    className: "bg-amber-400/15 text-amber-200 ring-amber-300/30",
  },
  busy: {
    label: "Busy",
    detail: "More people than usual. The place is lively.",
    className: "bg-orange-400/15 text-orange-200 ring-orange-300/30",
  },
};

export function crowdLevel(count: number, usual: number | null): CrowdLevel | null {
  if (usual === null || usual <= 0) {
    return null;
  }

  const ratio = count / usual;
  if (ratio < 0.75) return "quiet";
  if (ratio > 1.25) return "busy";
  return "usual";
}
