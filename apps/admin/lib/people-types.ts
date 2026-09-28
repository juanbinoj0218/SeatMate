// Shapes returned by the customers and admins API routes.

export type Role = "admin" | "owner" | "staff" | "customer";

export type Person = {
  uid: string;
  email: string;
  name: string;
  photoUrl: string;
  providers: string[];
  disabled: boolean;
  createdMs: number | null;
  lastSignInMs: number | null;
  roles: Role[];
  businessName: string;
  savedCount: number;
  homeZip: string;
};

export type AdminEntry = {
  uid: string;
  email: string;
  name: string;
  addedMs: number | null;
  addedBy: string;
};
