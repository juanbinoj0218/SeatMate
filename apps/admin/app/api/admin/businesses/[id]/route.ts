import { FieldValue, Timestamp } from "firebase-admin/firestore";

import { writeLog } from "@/lib/activity-log";
import type { BusinessDay, BusinessDetail } from "@/lib/business-types";
import { adminRoute, jsonError } from "@/lib/require-admin";

// GET: everything about one business for its admin page.
// PATCH: edit its details (also updates the public listing if it's live).

const DAY_MS = 24 * 60 * 60 * 1000;
const RANGE_DAYS = 30;

const dayKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const ms = (value: unknown) => (value instanceof Timestamp ? value.toMillis() : null);
const num = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : 0);

export const GET = adminRoute<{ id: string }>(async (_request, admin, { params }) => {
  const { id } = await params;
  const { db, auth } = admin;

  const business = await db.collection("businesses").doc(id).get();
  if (!business.exists) return jsonError("Business not found.", 404);

  const slug = String(business.get("slug") || "");
  const now = new Date();
  const days: BusinessDay[] = Array.from({ length: RANGE_DAYS }, (_, index) => ({
    day: dayKey(new Date(now.getTime() - (RANGE_DAYS - 1 - index) * DAY_MS)),
    views: 0,
    saves: 0,
    scans: 0,
    updates: 0,
  }));
  const byDay = new Map(days.map((point) => [point.day, point]));

  const [publicDoc, tables, placeStats, seatStats, favorites, alerts, staff, owner] = await Promise.all([
    slug ? db.collection("publicBusinesses").doc(slug).get() : null,
    db.collection("businesses").doc(id).collection("tables").get(),
    slug ? db.collection("publicBusinesses").doc(slug).collection("stats").get() : null,
    db.collection("businesses").doc(id).collection("stats").get(),
    slug ? db.collectionGroup("favorites").select().get() : null,
    db.collection("seatAlerts").where("businessId", "==", id).get(),
    db.collection("staffUsers").where("businessId", "==", id).get(),
    auth.getUser(id).catch(() => null),
  ]);

  const seats = { open: 0, total: 0, tables: tables.size, lastUpdateMs: null as number | null };
  tables.forEach((table) => {
    const list: { status?: string }[] = table.get("seats") || [];
    seats.total += list.length;
    seats.open += list.filter((seat) => seat.status === "available").length;
    const updated = ms(table.get("occupancyUpdatedAt"));
    if (updated && (seats.lastUpdateMs === null || updated > seats.lastUpdateMs)) seats.lastUpdateMs = updated;
  });

  placeStats?.forEach((stat) => {
    const point = byDay.get(stat.id);
    if (!point) return;
    point.views += num(stat.get("views"));
    point.saves += num(stat.get("saves"));
    point.scans += num(stat.get("scans"));
  });

  // Busiest hours over the same 30 days.
  const occ = Array(24).fill(0);
  const samples = Array(24).fill(0);
  seatStats.forEach((stat) => {
    const point = byDay.get(stat.id);
    if (!point) return;
    point.updates += num(stat.get("updates"));
    for (let hour = 0; hour < 24; hour += 1) {
      occ[hour] += num(stat.get(`occ_${hour}`));
      samples[hour] += num(stat.get(`n_${hour}`));
    }
  });
  const withData = samples.map((count, hour) => (count ? hour : -1)).filter((hour) => hour >= 0);
  const hourly =
    withData.length === 0
      ? []
      : Array.from({ length: withData[withData.length - 1] - withData[0] + 1 }, (_, index) => {
          const hour = withData[0] + index;
          return { hour, pct: samples[hour] ? Math.round(occ[hour] / samples[hour]) : null };
        });

  const detail: BusinessDetail = {
    id,
    name: String(business.get("name") || ""),
    type: String(business.get("type") || ""),
    address: String(business.get("address") || ""),
    zipcode: String(business.get("zipcode") || ""),
    slug,
    status: String(business.get("status") || "approved"),
    googlePlaceId: String(business.get("googlePlaceId") || ""),
    imageUrl: String(business.get("imageUrl") || ""),
    createdMs: ms(business.get("createdAt")),
    reviewedMs: ms(business.get("reviewedAt")),
    lastNudgedMs: ms(business.get("lastNudgedAt")),
    isPublic: Boolean(publicDoc?.exists),
    owner: owner
      ? {
          email: owner.email || "",
          name: owner.displayName || "",
          lastSignInMs: owner.metadata.lastSignInTime ? Date.parse(owner.metadata.lastSignInTime) : null,
          disabled: owner.disabled,
        }
      : null,
    seats,
    days,
    hourly,
    savedBy: favorites ? favorites.docs.filter((item) => item.id === slug).length : 0,
    activeAlerts: alerts.docs.filter((item) => item.get("active") === true).length,
    staff: staff.docs.map((item) => ({
      uid: item.id,
      name: String(item.get("name") || item.get("displayName") || ""),
      email: String(item.get("email") || ""),
      active: item.get("active") === true,
    })),
    generatedAtMs: now.getTime(),
  };

  return Response.json(detail, { headers: { "Cache-Control": "no-store" } });
});

const EDITABLE = ["name", "type", "address", "zipcode", "googlePlaceId"] as const;
const LIMITS: Record<(typeof EDITABLE)[number], number> = { name: 120, type: 40, address: 200, zipcode: 10, googlePlaceId: 200 };

export const PATCH = adminRoute<{ id: string }>(async (request, admin, { params }) => {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const ref = admin.db.collection("businesses").doc(id);
  const business = await ref.get();

  if (!business.exists) return jsonError("Business not found.", 404);

  const changes: Record<string, string> = {};
  const summary: string[] = [];

  for (const field of EDITABLE) {
    if (typeof body[field] !== "string") continue;
    const value = body[field].trim().slice(0, LIMITS[field]);
    if (field === "name" && !value) return jsonError("The name can't be empty.", 400);
    if (field === "zipcode" && value && !/^\d{5}$/.test(value)) return jsonError("ZIP code must be 5 digits.", 400);
    const before = String(business.get(field) || "");
    if (value !== before) {
      changes[field] = value;
      summary.push(`${field}: "${before}" → "${value}"`);
    }
  }

  if (summary.length === 0) {
    return Response.json({ ok: true, changed: false });
  }

  const batch = admin.db.batch();
  batch.update(ref, { ...changes, updatedAt: FieldValue.serverTimestamp() });

  const slug = String(business.get("slug") || "");
  if (slug) {
    const publicRef = admin.db.collection("publicBusinesses").doc(slug);
    if ((await publicRef.get()).exists) {
      batch.update(publicRef, { ...changes, updatedAt: FieldValue.serverTimestamp() });
    }
  }

  await batch.commit();
  await writeLog(admin, {
    action: "business.edit",
    targetType: "business",
    targetId: id,
    targetName: changes.name || String(business.get("name") || ""),
    details: summary.join("; "),
  });

  return Response.json({ ok: true, changed: true });
});
