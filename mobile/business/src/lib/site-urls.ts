// The web sites the app links to (customer pages, staff invite links and
// the seat-alert emailer). EXPO_PUBLIC_*_SITE_URL override the live sites.

const trimTrailingSlash = (url: string) => url.replace(/\/+$/, "");

export const CONSUMER_SITE_URL = trimTrailingSlash(
  process.env.EXPO_PUBLIC_CONSUMER_SITE_URL || "https://seatmate360.com"
);

export const BUSINESS_SITE_URL = trimTrailingSlash(
  process.env.EXPO_PUBLIC_BUSINESS_SITE_URL || "https://seatmate360.net"
);

export const consumerUrl = (path: string) => `${CONSUMER_SITE_URL}${path}`;

export const businessUrl = (path: string) => `${BUSINESS_SITE_URL}${path}`;
