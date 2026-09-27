import type { NextConfig } from "next";

const businessSiteUrl =
  process.env.NEXT_PUBLIC_BUSINESS_SITE_URL?.replace(/\/+$/, "");

// Without this the "Business Portal" buttons would point at localhost.
if (process.env.VERCEL && !businessSiteUrl) {
  throw new Error(
    "Set NEXT_PUBLIC_BUSINESS_SITE_URL in this Vercel project (e.g. https://your-business-domain.com)."
  );
}

const nextConfig: NextConfig = {
  // The business portal lives on its own site now. Forward old links
  // (bookmarks, staff invite links already sent) to the same path there.
  async redirects() {
    if (!businessSiteUrl) {
      return [];
    }

    return ["/business/:path*", "/staff/:path*", "/admin"].map(
      (source) => ({
        source,
        destination: `${businessSiteUrl}${source}`,
        permanent: false,
      })
    );
  },
};

export default nextConfig;
