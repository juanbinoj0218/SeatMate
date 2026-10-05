import type { DocumentReference, Firestore, Query } from "firebase-admin/firestore";

import { adminAuth, adminDb } from "@seatmate/shared/firebase-admin";
import { SEAT_ALERTS } from "@seatmate/shared/seat-alerts";

// Permanently deletes the signed-in account, from the business portal or
// the business app ("Delete account"). Firestore's rules only let admins
// remove businesses and listings, so this runs on the server.
//
// The caller sends their Firebase ID token, and must have signed in (or
// confirmed their password, Google, Apple or two-factor code) in the last
// five minutes. Then, in this order:
// - an owner's business (businesses/{uid} with its tables, floor markers,
//   live counts and stats), its published listing(s) and their stats, the
//   cover photo, staff invites, staff accounts and seat alerts for it
// - a staff member's staffUsers doc
// - users/{uid} (customer profile, saved places) and their own seat alerts
// - finally the sign-in account itself.

const RECENT_SIGN_IN_SECONDS = 5 * 60;

// Called from the Expo app's web build on another origin. The route only
// trusts the bearer token (no cookies), so any origin may call it.
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Access-Control-Max-Age": "600",
};

const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: CORS_HEADERS });

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(request: Request) {
  const db = adminDb();
  const auth = adminAuth();

  if (!db || !auth) {
    return json({ error: "Account deletion isn't available right now. Contact us and we'll delete it for you." }, 503);
  }

  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  // checkRevoked: a token from before a password change or sign-out
  // everywhere can't delete the account.
  const decoded = token ? await auth.verifyIdToken(token, true).catch(() => null) : null;

  if (!decoded) {
    return json({ error: "Sign in first." }, 401);
  }

  const signedInAgo = Date.now() / 1000 - Number(decoded.auth_time || 0);

  if (!(signedInAgo >= -60 && signedInAgo <= RECENT_SIGN_IN_SECONDS)) {
    return json(
      { error: "For your security, confirm it's you again, then delete your account.", code: "requires-recent-login" },
      401
    );
  }

  const uid = decoded.uid;

  try {
    await deleteBusiness(db, uid);

    // Staff of another business: just their staff access.
    await db.collection("staffUsers").doc(uid).delete();

    // The same sign-in also works on the customer site and app.
    await deleteQuery(db.collection(SEAT_ALERTS).where("uid", "==", uid));
    await db.recursiveDelete(db.collection("users").doc(uid));
  } catch (error) {
    console.error(`Could not delete data for ${uid}:`, error);
    return json({ error: "We couldn't delete your account. Please try again, or contact us." }, 500);
  }

  try {
    await auth.deleteUser(uid);
  } catch (error) {
    const code = (error as { code?: unknown })?.code;
    if (code !== "auth/user-not-found") {
      console.error(`Deleted data but not the sign-in account for ${uid}:`, error);
      return json(
        { error: "Your data was deleted, but we couldn't remove your sign-in. Please try again, or contact us." },
        500
      );
    }
  }

  return json({ ok: true });
}

async function deleteBusiness(db: Firestore, businessId: string) {
  const business = db.collection("businesses").doc(businessId);
  const slug = (await business.get()).get("slug");

  // Listings point back with businessId; older ones may only match the slug.
  const listings = new Map<string, DocumentReference>();
  (await db.collection("publicBusinesses").where("businessId", "==", businessId).get()).docs.forEach((item) =>
    listings.set(item.id, item.ref)
  );
  if (typeof slug === "string" && slug) {
    const listing = await db.collection("publicBusinesses").doc(slug).get();
    if (listing.exists && listing.get("businessId") === businessId) {
      listings.set(listing.id, listing.ref);
    }
  }

  // Seat alerts for this place, then the listing (with its stats) so
  // customers stop seeing it, then the business and everything under it.
  await deleteQuery(db.collection(SEAT_ALERTS).where("businessId", "==", businessId));
  for (const ref of listings.values()) {
    await db.recursiveDelete(ref);
  }

  await db.collection("businessPhotos").doc(businessId).delete();
  await deleteQuery(db.collection("staffInvites").where("businessId", "==", businessId));
  await deleteQuery(db.collection("staffUsers").where("businessId", "==", businessId));

  // tables, floorMarkers, live, stats and any other subcollections.
  await db.recursiveDelete(business);
}

async function deleteQuery(query: Query) {
  const snapshot = await query.get();
  // Batches hold up to 500 writes.
  for (let start = 0; start < snapshot.docs.length; start += 400) {
    const batch = query.firestore.batch();
    snapshot.docs.slice(start, start + 400).forEach((item) => batch.delete(item.ref));
    await batch.commit();
  }
}
