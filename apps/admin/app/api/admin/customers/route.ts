import type { UserRecord } from "firebase-admin/auth";

import type { Person, Role } from "@/lib/people-types";
import { requireAdmin } from "@/lib/require-admin";

// Every sign-in account (customers, business owners, staff and admins) with
// their role, saved-place count and home ZIP.

const MAX_USERS = 5000;
const toMs = (value?: string) => (value ? Date.parse(value) || null : null);

export async function GET(request: Request) {
  const admin = await requireAdmin(request);
  if (admin instanceof Response) return admin;
  const { auth, db } = admin;

  const users: UserRecord[] = [];
  let pageToken: string | undefined;

  do {
    const page = await auth.listUsers(1000, pageToken);
    users.push(...page.users);
    pageToken = page.pageToken;
  } while (pageToken && users.length < MAX_USERS);

  const [admins, businesses, staff, profiles, favorites] = await Promise.all([
    db.collection("admins").where("active", "==", true).get(),
    db.collection("businesses").select("name").get(),
    db.collection("staffUsers").where("active", "==", true).select("businessName").get(),
    db.collection("users").select("homeZip").get(),
    db.collectionGroup("favorites").select().get(),
  ]);

  const adminIds = new Set(admins.docs.map((item) => item.id));
  const businessNames = new Map(businesses.docs.map((item) => [item.id, String(item.get("name") || "")]));
  const staffOf = new Map(staff.docs.map((item) => [item.id, String(item.get("businessName") || "")]));
  const zips = new Map(profiles.docs.map((item) => [item.id, String(item.get("homeZip") || "")]));
  const saved = new Map<string, number>();
  favorites.forEach((item) => {
    const uid = item.ref.parent.parent?.id;
    if (uid) saved.set(uid, (saved.get(uid) ?? 0) + 1);
  });

  const people: Person[] = users.map((user) => {
    const roles: Role[] = [];
    if (adminIds.has(user.uid)) roles.push("admin");
    if (businessNames.has(user.uid)) roles.push("owner");
    if (staffOf.has(user.uid)) roles.push("staff");
    if (roles.length === 0 || zips.has(user.uid)) roles.push("customer");

    return {
      uid: user.uid,
      email: user.email || "",
      name: user.displayName || "",
      photoUrl: user.photoURL || "",
      providers: user.providerData.map((provider) => provider.providerId),
      disabled: user.disabled,
      createdMs: toMs(user.metadata.creationTime),
      lastSignInMs: toMs(user.metadata.lastSignInTime),
      roles,
      businessName: businessNames.get(user.uid) || staffOf.get(user.uid) || "",
      savedCount: saved.get(user.uid) ?? 0,
      homeZip: zips.get(user.uid) || "",
    };
  });

  people.sort((a, b) => (b.createdMs ?? 0) - (a.createdMs ?? 0));

  return Response.json({ people, truncated: users.length >= MAX_USERS }, { headers: { "Cache-Control": "no-store" } });
}
