import "server-only";

import { adminAuth, adminDb } from "@/lib/firebase-admin";

// Every /api/admin route starts with this: it checks the caller's Firebase
// ID token and that they're an active admin (admins/{uid}.active == true).

export type AdminContext = {
  uid: string;
  email: string;
  db: NonNullable<ReturnType<typeof adminDb>>;
  auth: NonNullable<ReturnType<typeof adminAuth>>;
};

export const jsonError = (error: string, status: number) =>
  Response.json({ error }, { status });

export async function requireAdmin(request: Request): Promise<AdminContext | Response> {
  const db = adminDb();
  const auth = adminAuth();

  if (!db || !auth) {
    return jsonError(
      "The admin site isn't connected to Firebase yet. Add FIREBASE_SERVICE_ACCOUNT_KEY to this Vercel project.",
      503
    );
  }

  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

  if (!token) {
    return jsonError("Sign in first.", 401);
  }

  try {
    const decoded = await auth.verifyIdToken(token);
    const admin = await db.collection("admins").doc(decoded.uid).get();

    if (admin.get("active") !== true) {
      return jsonError("Admins only.", 403);
    }

    return { uid: decoded.uid, email: decoded.email || "", db, auth };
  } catch {
    return jsonError("Your session expired. Sign in again.", 401);
  }
}
