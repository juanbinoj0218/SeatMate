import { FieldValue } from "firebase-admin/firestore";

import { PHOTO_COLLECTION } from "@seatmate/shared/place-photos";

import { writeLog } from "@/lib/activity-log";
import { adminRoute, jsonError } from "@/lib/require-admin";

// Removes a business's cover photo (e.g. if it's inappropriate); their
// page falls back to a stock photo.
export const DELETE = adminRoute<{ id: string }>(async (_request, admin, { params }) => {
  const { id } = await params;
  const ref = admin.db.collection("businesses").doc(id);
  const business = await ref.get();

  if (!business.exists) return jsonError("Business not found.", 404);

  const fields = { imageUrl: FieldValue.delete(), imageUpdatedAt: FieldValue.serverTimestamp() };
  const batch = admin.db.batch();
  batch.update(ref, fields);

  const slug = String(business.get("slug") || "");
  if (slug) {
    const publicRef = admin.db.collection("publicBusinesses").doc(slug);
    const listing = await publicRef.get();
    if (listing.exists && listing.get("businessId") === id) batch.update(publicRef, fields);
  }

  batch.delete(admin.db.collection(PHOTO_COLLECTION).doc(id));
  await batch.commit();

  await writeLog(admin, {
    action: "business.removePhoto",
    targetType: "business",
    targetId: id,
    targetName: String(business.get("name") || ""),
  });

  return Response.json({ ok: true });
});
