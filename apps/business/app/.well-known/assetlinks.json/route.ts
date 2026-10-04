import { connection } from "next/server";

import { androidAssetLinks, BUSINESS_APP_LINKS } from "@seatmate/shared/app-links";

// Android App Links: lets the SeatMate app open links on this site.
// Read at request time so setting ANDROID_CERT_SHA256 needs no rebuild.
export async function GET() {
  await connection();
  return androidAssetLinks(BUSINESS_APP_LINKS);
}
