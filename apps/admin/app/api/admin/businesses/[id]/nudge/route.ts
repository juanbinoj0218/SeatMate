import { FieldValue, Timestamp } from "firebase-admin/firestore";

import { businessUrl } from "@seatmate/shared/site-urls";

import { writeLog } from "@/lib/activity-log";
import { escapeHtml, sendEmail } from "@seatmate/shared/email";
import { adminRoute, jsonError } from "@/lib/require-admin";

// Reminds a business to update their seats. Emails the owner through
// Resend when it's set up; otherwise returns a ready-to-send mailto: link
// so the admin can send it from their own email.

const COOLDOWN_MS = 12 * 60 * 60 * 1000;

const ago = (lastMs: number | null) => {
  if (lastMs === null) return "yet";
  const hours = Math.round((Date.now() - lastMs) / 3600000);
  return hours < 48 ? `in ${hours} hours` : `in ${Math.round(hours / 24)} days`;
};

export const POST = adminRoute<{ id: string }>(async (request, admin, { params }) => {
  const { id } = await params;
  const force = new URL(request.url).searchParams.get("force") === "1";
  const ref = admin.db.collection("businesses").doc(id);
  const business = await ref.get();

  if (!business.exists) return jsonError("Business not found.", 404);

  const lastNudged = business.get("lastNudgedAt");
  if (!force && lastNudged instanceof Timestamp && Date.now() - lastNudged.toMillis() < COOLDOWN_MS) {
    return jsonError("A reminder was already sent in the last 12 hours.", 429);
  }

  const owner = await admin.auth.getUser(id).catch(() => null);
  if (!owner?.email) return jsonError("This business's owner has no email address.", 400);

  // Latest seat update across their tables.
  let lastUpdateMs: number | null = null;
  (await ref.collection("tables").get()).forEach((table) => {
    const updated = table.get("occupancyUpdatedAt");
    if (updated instanceof Timestamp && (lastUpdateMs === null || updated.toMillis() > lastUpdateMs)) {
      lastUpdateMs = updated.toMillis();
    }
  });

  const name = String(business.get("name") || "your place");
  const floorPlan = businessUrl("/business/floor-plan");
  const subject = `Quick reminder: update live seats at ${name}`;
  const text = `Hi${owner.displayName ? ` ${owner.displayName.split(" ")[0]}` : ""},

Customers checking ${name} on SeatMate haven't seen a seat update ${ago(lastUpdateMs)}, so your page shows as out of date.

It takes a few seconds: open your floor plan and tap any seats that changed, or press "Seats are still accurate" if nothing has.

${floorPlan}

Tip: staff can turn on reminders on the staff screen so this happens automatically.

Thanks,
The SeatMate team`;

  const html = `
<div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;color:#101811">
  <p style="margin:0;font-size:13px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#15803d">SeatMate</p>
  <h1 style="margin:12px 0 8px;font-size:24px;line-height:1.25">Time to update your seats</h1>
  <p style="margin:0 0 16px;font-size:16px;color:#4b5563">Customers checking ${escapeHtml(name)} haven't seen a seat update ${escapeHtml(ago(lastUpdateMs))}, so your page shows as out of date.</p>
  <p style="margin:0 0 24px;font-size:16px;color:#4b5563">Tap any seats that changed, or press <strong>Seats are still accurate</strong> if nothing has.</p>
  <a href="${escapeHtml(floorPlan)}" style="display:inline-block;background:#101811;color:#fff;text-decoration:none;font-weight:700;padding:14px 22px;border-radius:12px">Open floor plan</a>
  <p style="margin:28px 0 0;font-size:13px;color:#9ca3af">Tip: staff can turn on reminders on the staff screen so this happens automatically.</p>
</div>`;

  const canSend = Boolean(process.env.RESEND_API_KEY) || process.env.NODE_ENV === "development";

  if (canSend) {
    await sendEmail({ to: owner.email, subject, html, text });
  }

  await ref.update({ lastNudgedAt: FieldValue.serverTimestamp() });
  await writeLog(admin, {
    action: "business.nudge",
    targetType: "business",
    targetId: id,
    targetName: name,
    details: canSend ? `Emailed ${owner.email}` : `Opened in email app for ${owner.email}`,
  });

  return Response.json(
    canSend
      ? { sent: true, to: owner.email }
      : { sent: false, to: owner.email, mailto: `mailto:${owner.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}` }
  );
});
