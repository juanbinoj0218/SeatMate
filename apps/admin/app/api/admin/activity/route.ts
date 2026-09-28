import { Timestamp } from "firebase-admin/firestore";

import { writeLog } from "@/lib/activity-log";
import { CLIENT_ACTIONS, type ActionKey, type LogEntry } from "@/lib/activity-types";
import { adminRoute, jsonError } from "@/lib/require-admin";

// GET: the latest activity (optionally for one target). POST: record an
// action the browser performed directly (approvals, inbox updates).

export const GET = adminRoute(async (request, admin) => {
  const targetId = new URL(request.url).searchParams.get("targetId");

  // Filtering by target is done here rather than in the query, so no
  // composite index is needed.
  const snapshot = await admin.db.collection("adminLog").orderBy("createdAt", "desc").limit(targetId ? 1000 : 300).get();

  const entries: LogEntry[] = snapshot.docs
    .map((item) => {
      const createdAt = item.get("createdAt");
      return {
        id: item.id,
        action: item.get("action"),
        actorUid: String(item.get("actorUid") || ""),
        actorEmail: String(item.get("actorEmail") || ""),
        targetType: item.get("targetType"),
        targetId: String(item.get("targetId") || ""),
        targetName: String(item.get("targetName") || ""),
        details: String(item.get("details") || ""),
        createdMs: createdAt instanceof Timestamp ? createdAt.toMillis() : null,
      };
    })
    .filter((entry) => !targetId || entry.targetId === targetId)
    .slice(0, targetId ? 50 : 300);

  return Response.json({ entries }, { headers: { "Cache-Control": "no-store" } });
});

export const POST = adminRoute(async (request, admin) => {
  const body = await request.json().catch(() => ({}));
  const action = body.action as ActionKey;

  if (!CLIENT_ACTIONS.includes(action)) {
    return jsonError("Unknown action.", 400);
  }

  await writeLog(admin, {
    action,
    targetType: action.startsWith("inbox.") ? "inbox" : "business",
    targetId: String(body.targetId || "").slice(0, 200),
    targetName: String(body.targetName || "").slice(0, 200),
    details: String(body.details || ""),
  });

  return Response.json({ ok: true });
});
