import { connection } from "next/server";

import { appleAppSiteAssociation, BUSINESS_APP_LINKS } from "@seatmate/shared/app-links";

// iOS universal links: lets the SeatMate app open links on this site.
// Read at request time so setting APPLE_TEAM_ID needs no rebuild.
export async function GET() {
  await connection();
  return appleAppSiteAssociation(BUSINESS_APP_LINKS);
}
