// Shape of GET /api/admin/businesses/[id], shared by the route and page.

export type BusinessDay = { day: string; views: number; saves: number; scans: number; updates: number };

export type BusinessDetail = {
  id: string;
  name: string;
  type: string;
  address: string;
  zipcode: string;
  slug: string;
  status: string;
  googlePlaceId: string;
  imageUrl: string;
  createdMs: number | null;
  reviewedMs: number | null;
  lastNudgedMs: number | null;
  isPublic: boolean;
  owner: { email: string; name: string; lastSignInMs: number | null; disabled: boolean } | null;
  seats: { open: number; total: number; tables: number; lastUpdateMs: number | null };
  days: BusinessDay[];
  hourly: { hour: number; pct: number | null }[];
  savedBy: number;
  activeAlerts: number;
  staff: { uid: string; name: string; email: string; active: boolean }[];
  generatedAtMs: number;
};

export { BUSINESS_TYPES } from "@seatmate/shared/floor-plan";
