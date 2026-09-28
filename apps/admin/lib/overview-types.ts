// Shape of GET /api/admin/overview, shared by the route and the page.

export type DayPoint = { day: string; views: number; saves: number; scans: number; updates: number; customers: number; businesses: number };

export type PlaceRow = {
  slug: string;
  name: string;
  type: string;
  views: number;
  saves: number;
  scans: number;
  openSeats: number;
  totalSeats: number;
  lastUpdateMs: number | null;
};

export type Overview = {
  rangeDays: number;
  generatedAtMs: number;
  totals: {
    customers: number;
    newCustomers: number;
    businesses: Record<string, number>;
    livePlaces: number;
    seatsTotal: number;
    seatsOpen: number;
    views: number;
    saves: number;
    scans: number;
    seatUpdates: number;
    activeAlerts: number;
    alertsSent: number;
    openRequests: number;
    openMessages: number;
  };
  days: DayPoint[];
  places: PlaceRow[];
  pending: { id: string; name: string; type: string; submittedMs: number | null }[];
};
