import type { NextConfig } from "next";

import {
  ADMIN_SITE_URL,
  BUSINESS_SITE_URL,
} from "../../packages/shared/src/site-urls";

const nextConfig: NextConfig = {
  // The business portal lives on its own site now. Forward old links
  // (bookmarks, staff invite links already sent) to the same path there.
  async redirects() {
    return [
      ...["/business/:path*", "/staff/:path*"].map((source) => ({
        source,
        destination: `${BUSINESS_SITE_URL}${source}`,
        permanent: false,
      })),
      { source: "/admin", destination: ADMIN_SITE_URL, permanent: false },
    ];
  },
};

export default nextConfig;
