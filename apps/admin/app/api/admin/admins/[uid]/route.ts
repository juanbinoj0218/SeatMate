import { FieldValue } from "firebase-admin/firestore";

import { jsonError, requireAdmin } from "@/lib/require-admin";

// Remove someone's admin access (their account itself stays).
export async function DELETE(request: Request, { params }: { params: Promise<{ uid: string }> }) {
  const admin = await requireAdmin(request);
  if (admin instanceof Response) return admin;

  const { uid } = await params;

  if (uid === admin.uid) {
    return jsonError("You can't remove your own admin access.", 400);
  }

  await admin.db.collection("admins").doc(uid).set(
    { active: false, removedAt: FieldValue.serverTimestamp(), removedBy: admin.uid },
    { merge: true }
  );

  return Response.json({ ok: true });
}
