import { FieldValue } from "firebase-admin/firestore";

import { FEATURE_INFO, FEATURE_KEYS, FEATURES_DOC, readFeatures } from "@seatmate/shared/features";

import { writeLog } from "@/lib/activity-log";
import { adminRoute } from "@/lib/require-admin";

// Feature switches (settings/features). Only this route writes them.

export const GET = adminRoute(async (_request, admin) => {
  const snapshot = await admin.db.doc(FEATURES_DOC.join("/")).get();
  return Response.json({ features: readFeatures(snapshot.data()) }, { headers: { "Cache-Control": "no-store" } });
});

export const PUT = adminRoute(async (request, admin) => {
  const body = await request.json().catch(() => ({}));
  const ref = admin.db.doc(FEATURES_DOC.join("/"));
  const before = readFeatures((await ref.get()).data());
  const after = readFeatures({ ...before, ...(body.features ?? {}) });

  const changed = FEATURE_KEYS.filter((key) => before[key] !== after[key]);

  if (changed.length > 0) {
    await ref.set({ ...after, updatedAt: FieldValue.serverTimestamp(), updatedBy: admin.email }, { merge: true });
    await writeLog(admin, {
      action: "settings.features",
      targetType: "settings",
      targetId: "features",
      targetName: "Feature switches",
      details: changed.map((key) => `${FEATURE_INFO[key].label} ${after[key] ? "on" : "off"}`).join(", "),
    });
  }

  return Response.json({ features: after });
});
