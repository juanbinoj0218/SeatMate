// SeatMate app: "Notify me when a seat opens".
//
// Runs on Firebase (not on the phone) so it works even when the app is closed.
//
// How it works:
// 1. In the app, a signed-in customer taps "Notify me when a seat opens".
//    The app saves on users/{uid}:
//      pushTokens            this phone's Expo push address
//      seatWatches.{slug}    { businessId, placeName, party, createdAtMs }
//      seatWatchBusinessIds  list of businessIds being watched (for lookups)
// 2. Staff mark a seat open on the business site, which updates
//    businesses/{businessId}/tables/{tableId}.
// 3. This function sees the change, finds everyone watching that place, and
//    sends each a notification through Expo's free push service. Each watch
//    is sent once and then removed. Watches older than 12 hours are dropped.
//
// The website's email alerts (seatAlerts collection) are separate and unchanged.

const { setGlobalOptions } = require("firebase-functions/v2");
const { onDocumentWritten } = require("firebase-functions/v2/firestore");
const { logger } = require("firebase-functions");
const { initializeApp } = require("firebase-admin/app");
const { FieldPath, FieldValue, getFirestore } = require("firebase-admin/firestore");

initializeApp();

const db = getFirestore();

// Keeps costs predictable: at most 10 copies of this function at once
setGlobalOptions({ maxInstances: 10 });

// Same as the website's email alerts
const WATCH_TTL_MS = 12 * 60 * 60 * 1000;

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

// Free seats at one table (same rule as the app: anything not "occupied")
function freeSeats(table) {
  const seats = Array.isArray(table && table.seats) ? table.seats : [];
  return seats.filter((seat) => seat && seat.status !== "occupied").length;
}

exports.notifyWhenSeatOpens = onDocumentWritten(
  "businesses/{businessId}/tables/{tableId}",
  async (event) => {
    const before = event.data && event.data.before.exists ? event.data.before.data() : null;
    const after = event.data && event.data.after.exists ? event.data.after.data() : null;

    // Table deleted, or no seat opened at this table: nothing to do
    if (!after || freeSeats(after) <= freeSeats(before)) {
      return;
    }

    const businessId = event.params.businessId;

    // Everyone watching this place
    const watchers = await db
      .collection("users")
      .where("seatWatchBusinessIds", "array-contains", businessId)
      .get();

    if (watchers.empty) {
      return;
    }

    // Free seats at each table, for group sizes ("a table for 3")
    const tables = await db.collection("businesses").doc(businessId).collection("tables").get();
    const tableFree = tables.docs.map((tableDoc) => freeSeats(tableDoc.data()));
    const totalFree = tableFree.reduce((sum, free) => sum + free, 0);
    const bestTable = tableFree.length > 0 ? Math.max(...tableFree) : 0;

    const messages = [];

    for (const userDoc of watchers.docs) {
      const watches = userDoc.get("seatWatches") || {};

      const matching = Object.entries(watches).filter(
        ([, watch]) => watch && watch.businessId === businessId
      );

      // Listed as watching but no watch left: tidy up
      if (matching.length === 0) {
        await userDoc.ref.update({ seatWatchBusinessIds: FieldValue.arrayRemove(businessId) });
        continue;
      }

      for (const [slug, watch] of matching) {
        const expired = Date.now() - Number(watch.createdAtMs || 0) > WATCH_TTL_MS;
        const party = Math.max(1, Number(watch.party) || 1);

        // Not enough seats together for their group yet: keep waiting
        if (!expired && bestTable < party) {
          continue;
        }

        // Claim the watch first, so two seat updates can't notify twice
        const claimed = await db.runTransaction(async (transaction) => {
          const fresh = await transaction.get(userDoc.ref);
          const current = fresh.get(new FieldPath("seatWatches", slug));

          if (!current || current.businessId !== businessId) {
            return false;
          }

          transaction.update(
            userDoc.ref,
            new FieldPath("seatWatches", slug),
            FieldValue.delete(),
            "seatWatchBusinessIds",
            FieldValue.arrayRemove(businessId)
          );

          return true;
        });

        if (!claimed || expired) {
          continue;
        }

        const tokens = userDoc.get("pushTokens") || [];
        const placeName = String(watch.placeName || "your place");

        const body =
          party > 1
            ? `A table for ${party >= 4 ? "4+" : party} is free right now. Tap to see the live floor plan.`
            : `${totalFree} seat${totalFree === 1 ? "" : "s"} open right now. Tap to see the live floor plan.`;

        tokens.forEach((token) => {
          messages.push({
            to: token,
            title: `A seat just opened at ${placeName}`,
            body,
            sound: "default",
            channelId: "seat-alerts",
            data: { slug },
            // Not sent to Expo; used below to clean up dead tokens
            uid: userDoc.id,
          });
        });
      }
    }

    if (messages.length === 0) {
      return;
    }

    // Expo accepts up to 100 notifications per request
    for (let start = 0; start < messages.length; start += 100) {
      const batch = messages.slice(start, start + 100);

      try {
        const response = await fetch(EXPO_PUSH_URL, {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify(batch.map(({ uid, ...message }) => message)),
        });

        const result = await response.json();
        const tickets = Array.isArray(result.data) ? result.data : [];

        // Remove tokens for phones that uninstalled the app or turned notifications off
        await Promise.all(
          tickets.map((ticket, index) => {
            if (
              ticket &&
              ticket.status === "error" &&
              ticket.details &&
              ticket.details.error === "DeviceNotRegistered"
            ) {
              const message = batch[index];

              return db
                .collection("users")
                .doc(message.uid)
                .update({ pushTokens: FieldValue.arrayRemove(message.to) })
                .catch(() => {});
            }

            return null;
          })
        );

        logger.info(`Sent ${batch.length} seat notification(s) for ${businessId}`);
      } catch (error) {
        logger.error("Could not send seat notifications:", error);
      }
    }
  }
);
