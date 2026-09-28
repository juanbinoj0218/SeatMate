import "server-only";

import { FieldValue } from "firebase-admin/firestore";

import type { ActionKey, LogEntry } from "@/lib/activity-types";
import type { AdminContext } from "@/lib/require-admin";

// Writes one entry to the admin activity log. Never throws: a failed log
// write shouldn't undo or fail the action it describes.
export async function writeLog(
  admin: AdminContext,
  entry: Pick<LogEntry, "action" | "targetType" | "targetId"> & Partial<Pick<LogEntry, "targetName" | "details">>
) {
  try {
    await admin.db.collection("adminLog").add({
      action: entry.action satisfies ActionKey,
      targetType: entry.targetType,
      targetId: entry.targetId,
      targetName: entry.targetName ?? "",
      details: (entry.details ?? "").slice(0, 500),
      actorUid: admin.uid,
      actorEmail: admin.email,
      createdAt: FieldValue.serverTimestamp(),
    });
  } catch (error) {
    console.error("Could not write admin log:", error);
  }
}
