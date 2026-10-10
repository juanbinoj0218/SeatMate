// The consumer site and the business portal are separate deployments,
// so links between them must be absolute. In development they default to
// `npm run dev:consumer` (port 3000) and `npm run dev:business` (port 3001).
// NEXT_PUBLIC_CONSUMER_SITE_URL / NEXT_PUBLIC_BUSINESS_SITE_URL override them.

const isDev = process.env.NODE_ENV === "development";

const trimTrailingSlash = (url: string) => url.replace(/\/+$/, "");

export const CONSUMER_SITE_URL = trimTrailingSlash(
  process.env.NEXT_PUBLIC_CONSUMER_SITE_URL ||
    (isDev ? "http://localhost:3000" : "https://seatmate360.com")
);

export const BUSINESS_SITE_URL = trimTrailingSlash(
  process.env.NEXT_PUBLIC_BUSINESS_SITE_URL ||
    (isDev ? "http://localhost:3001" : "https://seatmate360.net")
);

// The admin site (seatmate360.info). NEXT_PUBLIC_ADMIN_SITE_URL overrides it.
export const ADMIN_SITE_URL = trimTrailingSlash(
  process.env.NEXT_PUBLIC_ADMIN_SITE_URL ||
    (isDev ? "http://localhost:3002" : "https://seatmate360.info")
);

// The waitlist site (seatmate360.store). NEXT_PUBLIC_WAITLIST_SITE_URL overrides it.
export const WAITLIST_SITE_URL = trimTrailingSlash(
  process.env.NEXT_PUBLIC_WAITLIST_SITE_URL ||
    (isDev ? "http://localhost:3003" : "https://seatmate360.store")
);

export const consumerUrl = (path: string) =>
  `${CONSUMER_SITE_URL}${path}`;

export const businessUrl = (path: string) =>
  `${BUSINESS_SITE_URL}${path}`;

export const adminUrl = (path: string) =>
  `${ADMIN_SITE_URL}${path}`;
