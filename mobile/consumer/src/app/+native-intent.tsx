import { bumpPlaceStat } from "@/lib/analytics";

// Links from outside the app (universal links like
// https://seatmate360.com/place/blue-door?ref=qr, or seatmate:// links).
// Expo Router already sends /place/{slug} to the place screen; this only
// counts QR code scans, which the website counts when the link opens in a
// browser instead, so a business's Analytics include scans that open the app.
export function redirectSystemPath({ path }: { path: string; initial: boolean }) {
  try {
    const url = new URL(path, "https://seatmate360.com");
    // A custom-scheme link (seatmate://place/x) parses "place" as the host.
    const pathname = url.protocol === "seatmate:" ? `/${url.host}${url.pathname}` : url.pathname;
    const slug = pathname.match(/^\/place\/([^/]+)\/?$/)?.[1];

    if (slug && url.searchParams.get("ref") === "qr") {
      bumpPlaceStat(decodeURIComponent(slug), "scans");
    }
  } catch {
    // Never block a link over analytics.
  }

  return path;
}
