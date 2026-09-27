import type { NextConfig } from "next";

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
