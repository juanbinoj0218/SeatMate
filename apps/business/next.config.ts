import type { NextConfig } from "next";

import { ADMIN_SITE_URL } from "../../packages/shared/src/site-urls";

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
      // Admin tools moved to their own site.
      { source: "/admin", destination: `${ADMIN_SITE_URL}/businesses`, permanent: false },
      { source: "/admin/inbox", destination: `${ADMIN_SITE_URL}/inbox`, permanent: false },
    ];
  },
};

export default nextConfig;
