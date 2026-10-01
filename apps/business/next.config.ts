import type { NextConfig } from "next";

import {
  ADMIN_SITE_URL,
  CONSUMER_SITE_URL,
} from "../../packages/shared/src/site-urls";

// Customer pages that people sometimes open on the business domain
// (e.g. seatmate360.net/place/...). Send them to the customer site instead
// of a 404.
const CUSTOMER_PATHS = [
  "/place/:path*",
  "/places/:path*",
  "/search",
  "/suggest",
  "/account",
  "/faq",
  "/contact",
];

const nextConfig: NextConfig = {
  // The business site has no landing page of its own; /business sends
  // signed-out visitors to the login page.
  async redirects() {
    return [
      {
        source: "/",
        destination: "/business",
        permanent: false,
      },
      // Business sign-in lives under /business.
      { source: "/login", destination: "/business/login", permanent: false },
      // Admin tools moved to their own site.
      { source: "/admin", destination: `${ADMIN_SITE_URL}/businesses`, permanent: false },
      { source: "/admin/inbox", destination: `${ADMIN_SITE_URL}/inbox`, permanent: false },
      ...CUSTOMER_PATHS.map((source) => ({
        source,
        destination: `${CONSUMER_SITE_URL}${source}`,
        permanent: false,
      })),
    ];
  },
};

export default nextConfig;
