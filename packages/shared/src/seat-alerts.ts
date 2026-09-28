// "Tell me when a seat opens" alerts.
//
// A signed-in customer creates seatAlerts/{uid}_{slug}. When staff mark a
// seat open, the business site calls its /api/seat-alerts route, which
// emails everyone waiting on that place and turns their alert off.

export const SEAT_ALERTS = "seatAlerts";

// Alerts are for "right now"; older ones are ignored and cleaned up.
export const SEAT_ALERT_TTL_MS = 12 * 60 * 60 * 1000;

export const seatAlertId = (uid: string, slug: string) => `${uid}_${slug}`;

export type SeatAlert = {
  uid: string;
  email: string;
  slug: string;
  businessId: string;
  placeName: string;
  active: boolean;
};

// Called by the business site after a seat is marked open. Fire and forget:
// seat updates never wait on (or fail because of) alert emails.
export function notifySeatAlerts(businessId: string) {
  if (typeof window === "undefined" || !businessId) {
    return;
  }

  void fetch("/api/seat-alerts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ businessId }),
    keepalive: true,
  }).catch(() => {});
}
