// The consumer site and the business portal are separate deployments,
// so links between them must be absolute. Set both variables in each
// Vercel project; the localhost defaults match `npm run dev:consumer`
// (port 3000) and `npm run dev:business` (port 3001).

const trimTrailingSlash = (url: string) => url.replace(/\/+$/, "");

export const CONSUMER_SITE_URL = trimTrailingSlash(
  process.env.NEXT_PUBLIC_CONSUMER_SITE_URL || "http://localhost:3000"
);

export const BUSINESS_SITE_URL = trimTrailingSlash(
  process.env.NEXT_PUBLIC_BUSINESS_SITE_URL || "http://localhost:3001"
);

export const consumerUrl = (path: string) =>
  `${CONSUMER_SITE_URL}${path}`;

export const businessUrl = (path: string) =>
  `${BUSINESS_SITE_URL}${path}`;
