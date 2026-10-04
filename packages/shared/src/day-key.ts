// The id of a daily stats document: YYYY-MM-DD. Browsers and the apps use
// the device's local day. Pass a time zone to get that zone's day instead,
// e.g. on a server (Vercel runs in UTC) reading documents those devices
// wrote.
export function dayKey(date = new Date(), timeZone?: string) {
  if (!timeZone) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }

  try {
    // en-CA formats dates as YYYY-MM-DD.
    return new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(date);
  } catch {
    return dayKey(date);
  }
}

// SeatMate's home time zone, for server-side reports that span businesses.
export const SEATMATE_TIMEZONE = "America/Los_Angeles";
