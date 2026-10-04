import "server-only";

import { adminAuth, adminDb } from "@seatmate/shared/firebase-admin";

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

  let uid: string;
  let email: string;

  try {
    // checkRevoked: a disabled account or one signed out everywhere loses
    // access straight away, not when its token expires.
    const decoded = await auth.verifyIdToken(token, true);
    uid = decoded.uid;
    email = decoded.email || "";
  } catch (error) {
    console.error("Admin token check failed:", error);
    return jsonError("Your sign-in has expired. Please sign in again.", 401);
  }

  try {
    const admin = await db.collection("admins").doc(uid).get();

    if (admin.get("active") !== true) {
      return jsonError("Admins only.", 403);
    }
  } catch (error) {
    console.error("Admin lookup failed:", error);
    return jsonError(`Couldn't read Firestore with the service account key: ${describe(error)}`, 500);
  }

  return { uid, email, db, auth };
}

const describe = (error: unknown) =>
  error instanceof Error ? error.message.split("\n")[0].slice(0, 300) : String(error);

// Wraps an /api/admin route: checks the caller is an admin, then turns any
// unexpected error into a readable message instead of a blank 500.
export function adminRoute<Params = Record<string, never>>(
  handler: (request: Request, admin: AdminContext, context: { params: Promise<Params> }) => Promise<Response>
) {
  return async (request: Request, context: { params: Promise<Params> }) => {
    try {
      const admin = await requireAdmin(request);
      if (admin instanceof Response) return admin;
      return await handler(request, admin, context);
    } catch (error) {
      console.error(`Admin route ${new URL(request.url).pathname} failed:`, error);
      return jsonError(`Server error: ${describe(error)}`, 500);
    }
  };
}
