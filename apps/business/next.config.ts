import type { NextConfig } from "next";

// Without this the "View Customer Page" links would point at localhost.
if (process.env.VERCEL && !process.env.NEXT_PUBLIC_CONSUMER_SITE_URL) {
  throw new Error(
    "Set NEXT_PUBLIC_CONSUMER_SITE_URL in this Vercel project (e.g. https://seatmate360.com)."
  );
}

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
    ];
  },
};

export default nextConfig;
