import { Timestamp } from "firebase-admin/firestore";

import type { DayPoint, Overview, PlaceRow } from "@/lib/overview-types";
import { requireAdmin } from "@/lib/require-admin";

// Everything the admin Overview page shows, gathered on the server with the
// Admin SDK: business counts, live seats, page views/saves/QR scans, seat
// updates, new customers, alerts and inbox counts.

const DAY_MS = 24 * 60 * 60 * 1000;

const dayKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

const num = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : 0);
const ms = (value: unknown) => (value instanceof Timestamp ? value.toMillis() : null);

export async function GET(request: Request) {
  const admin = await requireAdmin(request);
  if (admin instanceof Response) return admin;
  const { db } = admin;

  const rangeDays = [7, 30, 90].includes(Number(new URL(request.url).searchParams.get("days")))
    ? Number(new URL(request.url).searchParams.get("days"))
    : 30;

  const now = new Date();
  const days: DayPoint[] = Array.from({ length: rangeDays }, (_, index) => {
    const date = new Date(now.getTime() - (rangeDays - 1 - index) * DAY_MS);
    return { day: dayKey(date), views: 0, saves: 0, scans: 0, updates: 0, customers: 0, businesses: 0 };
  });
  const byDay = new Map(days.map((point) => [point.day, point]));
  const firstDay = days[0].day;
  const since = Timestamp.fromMillis(now.getTime() - rangeDays * DAY_MS);

  const [businesses, publicPlaces, tables, stats, customerCount, newCustomers, activeAlerts, sentAlerts, requests, messages] =
    await Promise.all([
      db.collection("businesses").get(),
      db.collection("publicBusinesses").get(),
      db.collectionGroup("tables").get(),
      db.collectionGroup("stats").get(),
      db.collection("users").count().get(),
      db.collection("users").where("createdAt", ">=", since).select("createdAt").get(),
      db.collection("seatAlerts").where("active", "==", true).count().get(),
      db.collection("seatAlerts").where("sentAt", ">=", since).count().get(),
      db.collection("placeRequests").where("status", "==", "new").count().get(),
      db.collection("contactMessages").where("status", "==", "new").count().get(),
    ]);

  // Businesses by status, new sign-ups per day, and the approval queue.
  const businessCounts: Record<string, number> = { draft: 0, pending: 0, approved: 0, suspended: 0, rejected: 0 };
  const pending: Overview["pending"] = [];

  businesses.forEach((business) => {
    const status = String(business.get("status") || "approved");
    businessCounts[status] = (businessCounts[status] || 0) + 1;

    const created = ms(business.get("createdAt"));
    if (created) {
      const point = byDay.get(dayKey(new Date(created)));
      if (point) point.businesses += 1;
    }

    if (status === "pending") {
      pending.push({
        id: business.id,
        name: String(business.get("name") || "Unnamed business"),
        type: String(business.get("type") || ""),
        submittedMs: ms(business.get("submittedAt")) ?? ms(business.get("updatedAt")),
      });
    }
  });

  newCustomers.forEach((user) => {
    const created = ms(user.get("createdAt"));
    const point = created ? byDay.get(dayKey(new Date(created))) : undefined;
    if (point) point.customers += 1;
  });

  // Live seats per business.
  const seatsByBusiness = new Map<string, { open: number; total: number; last: number | null }>();
  tables.forEach((table) => {
    const businessId = table.ref.parent.parent?.id;
    if (!businessId) return;
    const entry = seatsByBusiness.get(businessId) ?? { open: 0, total: 0, last: null };
    const seats: { status?: string }[] = table.get("seats") || [];
    entry.total += seats.length;
    entry.open += seats.filter((seat) => seat.status === "available").length;
    const updated = ms(table.get("occupancyUpdatedAt"));
    if (updated && (entry.last === null || updated > entry.last)) entry.last = updated;
    seatsByBusiness.set(businessId, entry);
  });

  // Per-place rows for the live listings.
  const placeRows = new Map<string, PlaceRow>();
  publicPlaces.forEach((place) => {
    const seats = seatsByBusiness.get(String(place.get("businessId") || ""));
    placeRows.set(place.id, {
      slug: place.id,
      name: String(place.get("name") || place.id),
      type: String(place.get("type") || ""),
      views: 0,
      saves: 0,
      scans: 0,
      openSeats: seats?.open ?? 0,
      totalSeats: seats?.total ?? 0,
      lastUpdateMs: seats?.last ?? null,
    });
  });

  // Daily stats: publicBusinesses/{slug}/stats/{day} (views, saves, scans)
  // and businesses/{id}/stats/{day} (seat updates).
  stats.forEach((stat) => {
    if (stat.id < firstDay) return;
    const point = byDay.get(stat.id);
    const parent = stat.ref.parent.parent;
    if (!point || !parent) return;

    if (parent.parent.id === "publicBusinesses") {
      const row = placeRows.get(parent.id);
      const views = num(stat.get("views"));
      const saves = num(stat.get("saves"));
      const scans = num(stat.get("scans"));
      point.views += views;
      point.saves += saves;
      point.scans += scans;
      if (row) {
        row.views += views;
        row.saves += saves;
        row.scans += scans;
      }
    } else {
      point.updates += num(stat.get("updates"));
    }
  });

  const places = [...placeRows.values()];
  const sum = (key: keyof DayPoint) => days.reduce((total, point) => total + (point[key] as number), 0);

  const overview: Overview = {
    rangeDays,
    generatedAtMs: now.getTime(),
    totals: {
      customers: customerCount.data().count,
      newCustomers: sum("customers"),
      businesses: businessCounts,
      livePlaces: publicPlaces.size,
      seatsTotal: places.reduce((total, place) => total + place.totalSeats, 0),
      seatsOpen: places.reduce((total, place) => total + place.openSeats, 0),
      views: sum("views"),
      saves: sum("saves"),
      scans: sum("scans"),
      seatUpdates: sum("updates"),
      activeAlerts: activeAlerts.data().count,
      alertsSent: sentAlerts.data().count,
      openRequests: requests.data().count,
      openMessages: messages.data().count,
    },
    days,
    places,
    pending: pending.sort((a, b) => (a.submittedMs ?? 0) - (b.submittedMs ?? 0)),
  };

  return Response.json(overview, { headers: { "Cache-Control": "no-store" } });
}
