// The waitlist site's own address, for link previews and the share button.
// NEXT_PUBLIC_WAITLIST_SITE_URL overrides it per deployment.
export const WAITLIST_SITE_URL = (
  process.env.NEXT_PUBLIC_WAITLIST_SITE_URL ||
  (process.env.NODE_ENV === "development" ? "http://localhost:3003" : "https://seatmate360.store")
).replace(/\/+$/, "");
