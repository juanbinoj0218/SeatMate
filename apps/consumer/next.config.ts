import type { NextConfig } from "next";

import { BUSINESS_SITE_URL } from "../../packages/shared/src/site-urls";

const nextConfig: NextConfig = {
  // The business portal lives on its own site now. Forward old links
  // (bookmarks, staff invite links already sent) to the same path there.
  async redirects() {
    return ["/business/:path*", "/staff/:path*", "/admin"].map(
      (source) => ({
        source,
        destination: `${BUSINESS_SITE_URL}${source}`,
        permanent: false,
      })
    );
  },
};

export default nextConfig;
