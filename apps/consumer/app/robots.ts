import type { MetadataRoute } from "next";

import { CONSUMER_SITE_URL } from "@seatmate/shared/site-urls";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/account", "/login", "/auth/"] },
    sitemap: `${CONSUMER_SITE_URL}/sitemap.xml`,
  };
}
