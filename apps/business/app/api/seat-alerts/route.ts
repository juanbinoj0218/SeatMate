import { FieldValue, Timestamp } from "firebase-admin/firestore";

import { FEATURES_DOC, readFeatures } from "@seatmate/shared/features";
import { SEAT_ALERT_TTL_MS, SEAT_ALERTS } from "@seatmate/shared/seat-alerts";
import { consumerUrl } from "@seatmate/shared/site-urls";

import { emailConfigured, escapeHtml, sendEmail } from "@seatmate/shared/email";
import { adminAuth, adminDb } from "@seatmate/shared/firebase-admin";

// Emails customers waiting on a place once it has an open seat.
//
// Only the business's owner or active staff may call this (with their
// Firebase ID token). It re-reads the seats itself and only emails when a
// seat really is open, and each alert is sent at most once.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const businessId = body?.businessId;

  if (typeof businessId !== "string" || !/^[\w-]{1,128}$/.test(businessId)) {
    return Response.json({ error: "Missing businessId." }, { status: 400 });
  }

  const db = adminDb();
  const auth = adminAuth();

  if (!db || !auth || !emailConfigured()) {
    return Response.json({ sent: 0, skipped: "Seat alerts are not configured." }, { status: 503 });
  }

  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const uid = token ? await auth.verifyIdToken(token).then((decoded) => decoded.uid, () => null) : null;

  if (!uid) {
    return Response.json({ error: "Sign in first." }, { status: 401 });
  }

  if (uid !== businessId) {
    const staff = await db.collection("staffUsers").doc(uid).get();

    if (staff.get("businessId") !== businessId || staff.get("active") !== true) {
      return Response.json({ error: "Only this business's team can send seat alerts." }, { status: 403 });
    }
  }

  const features = readFeatures((await db.doc(FEATURES_DOC.join("/")).get()).data());

  if (!features.seatAlerts) {
    return Response.json({ sent: 0, skipped: "Seat alerts are turned off." });
  }

  const tables = await db.collection("businesses").doc(businessId).collection("tables").get();

  let openSeats = 0;
  tables.forEach((table) => {
    const seats: { status?: string }[] = table.get("seats") || [];
    openSeats += seats.filter((seat) => seat.status === "available").length;
  });

  if (openSeats === 0) {
    return Response.json({ sent: 0 });
  }

  const alerts = await db
    .collection(SEAT_ALERTS)
    .where("businessId", "==", businessId)
    .where("active", "==", true)
    .get();

  // The place name and link come from the published listing, never from
  // what the customer's alert document says.
  const listing = (
    await db.collection("publicBusinesses").where("businessId", "==", businessId).limit(1).get()
  ).docs[0];

  if (!listing) {
    return Response.json({ sent: 0 });
  }

  const placeName = String(listing.get("name") || "your place");
  const placeUrl = consumerUrl(`/place/${listing.id}`);
  let sent = 0;

  for (const alertDoc of alerts.docs) {
    const createdAt = alertDoc.get("createdAt");

    if (
      !(createdAt instanceof Timestamp) ||
      Date.now() - createdAt.toMillis() > SEAT_ALERT_TTL_MS
    ) {
      await alertDoc.ref.delete();
      continue;
    }

    // Claim the alert first so two seat updates can't send it twice.
    const claimed = await db.runTransaction(async (transaction) => {
      const fresh = await transaction.get(alertDoc.ref);

      if (!fresh.exists || fresh.get("active") !== true) {
        return false;
      }

      transaction.update(alertDoc.ref, {
        active: false,
        sentAt: FieldValue.serverTimestamp(),
      });
      return true;
    });

    if (!claimed) {
      continue;
    }

    const email = String(alertDoc.get("email") || "");

    if (!email) {
      continue;
    }

    try {
      await sendEmail(seatOpenEmail(email, placeName, placeUrl, openSeats));
      sent += 1;
    } catch (error) {
      console.error(`Could not email seat alert ${alertDoc.id}:`, error);
      // Put it back so the next seat update can try again.
      await alertDoc.ref.update({ active: true, sentAt: FieldValue.delete() });
    }
  }

  return Response.json({ sent });
}

function seatOpenEmail(to: string, placeName: string, url: string, openSeats: number) {
  const seats = `${openSeats} seat${openSeats === 1 ? "" : "s"} open right now`;
  const name = escapeHtml(placeName);

  return {
    to,
    subject: `A seat just opened at ${placeName}`,
    text: `Good news: ${placeName} has ${seats}.\n\nSee the live floor plan: ${url}\n\nYou asked SeatMate to tell you when a seat opened. This alert is now off.`,
    html: `
<div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;color:#101811">
  <p style="margin:0;font-size:13px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#15803d">SeatMate</p>
  <h1 style="margin:12px 0 8px;font-size:26px;line-height:1.2">A seat just opened at ${name}</h1>
  <p style="margin:0 0 24px;font-size:16px;color:#4b5563">${escapeHtml(seats)}. Seats go fast, so head over soon.</p>
  <a href="${escapeHtml(url)}" style="display:inline-block;background:#101811;color:#fff;text-decoration:none;font-weight:700;padding:14px 22px;border-radius:12px">See live seats</a>
  <p style="margin:28px 0 0;font-size:13px;color:#9ca3af">You asked SeatMate to tell you when a seat opened here. This alert is now off.</p>
</div>`,
  };
}
