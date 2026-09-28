import { FieldValue, Timestamp } from "firebase-admin/firestore";

import type { AdminEntry } from "@/lib/people-types";
import { adminRoute, jsonError } from "@/lib/require-admin";

// List admins, and make an existing SeatMate account an admin by email.

export const GET = adminRoute(async (request, admin) => {

  const admins = await admin.db.collection("admins").where("active", "==", true).get();
  const accounts = admins.empty
    ? { users: [] }
    : await admin.auth.getUsers(admins.docs.map((item) => ({ uid: item.id })));
  const byId = new Map(accounts.users.map((user) => [user.uid, user]));

  const entries: AdminEntry[] = admins.docs.map((item) => {
    const addedAt = item.get("addedAt");
    return {
      uid: item.id,
      email: byId.get(item.id)?.email || "",
      name: byId.get(item.id)?.displayName || "",
      addedMs: addedAt instanceof Timestamp ? addedAt.toMillis() : null,
      addedBy: String(item.get("addedByEmail") || ""),
    };
  });

  return Response.json({ admins: entries, you: admin.uid }, { headers: { "Cache-Control": "no-store" } });
});

export const POST = adminRoute(async (request, admin) => {

  const email = String((await request.json().catch(() => ({}))).email || "").trim().toLowerCase();

  if (!/^\S+@\S+\.\S+$/.test(email)) {
    return jsonError("Enter a valid email address.", 400);
  }

  try {
    const user = await admin.auth.getUserByEmail(email);
    await admin.db.collection("admins").doc(user.uid).set(
      { active: true, addedAt: FieldValue.serverTimestamp(), addedBy: admin.uid, addedByEmail: admin.email },
      { merge: true }
    );
    return Response.json({ ok: true });
  } catch {
    return jsonError(`No SeatMate account uses ${email}. They need to sign up first (on any SeatMate site).`, 404);
  }
});
