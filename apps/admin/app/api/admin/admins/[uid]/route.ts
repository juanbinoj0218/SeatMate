import { FieldValue } from "firebase-admin/firestore";

import { adminRoute, jsonError } from "@/lib/require-admin";

// Remove someone's admin access (their account itself stays).
export const DELETE = adminRoute<{ uid: string }>(async (request, admin, { params }) => {
  const { uid } = await params;

  if (uid === admin.uid) {
    return jsonError("You can't remove your own admin access.", 400);
  }

  await admin.db.collection("admins").doc(uid).set(
    { active: false, removedAt: FieldValue.serverTimestamp(), removedBy: admin.uid },
    { merge: true }
  );

  return Response.json({ ok: true });
});
