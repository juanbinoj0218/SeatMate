import { jsonError, requireAdmin } from "@/lib/require-admin";

// Account actions: disable/enable sign-in, or create a password reset link
// to send to someone who's locked out.
export async function POST(request: Request, { params }: { params: Promise<{ uid: string }> }) {
  const admin = await requireAdmin(request);
  if (admin instanceof Response) return admin;

  const { uid } = await params;
  const body = await request.json().catch(() => ({}));

  try {
    if (body.action === "disable" || body.action === "enable") {
      if (uid === admin.uid) {
        return jsonError("You can't disable your own account.", 400);
      }
      await admin.auth.updateUser(uid, { disabled: body.action === "disable" });
      if (body.action === "disable") {
        await admin.auth.revokeRefreshTokens(uid);
      }
      return Response.json({ ok: true });
    }

    if (body.action === "resetLink") {
      const user = await admin.auth.getUser(uid);
      if (!user.email) return jsonError("This account has no email address.", 400);
      const link = await admin.auth.generatePasswordResetLink(user.email);
      return Response.json({ link });
    }

    return jsonError("Unknown action.", 400);
  } catch (error) {
    console.error("Customer action failed:", error);
    return jsonError("That didn't work. The account may no longer exist.", 400);
  }
}
