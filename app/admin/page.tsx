"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import {
  onAuthStateChanged,
  signOut,
} from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  where,
  writeBatch,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

type BusinessStatus =
  | "draft"
  | "pending"
  | "approved"
  | "suspended"
  | "rejected";

type Business = {
  id: string;
  ownerId: string;
  name: string;
  address: string;
  zipcode: string;
  type: string;
  slug: string;
  status: BusinessStatus;
  hours?: Record<string, unknown>;
  timezone?: string;
  googlePlaceId?: string;
};

export default function AdminPage() {
  const router = useRouter();

  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [adminUid, setAdminUid] = useState("");
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [filter, setFilter] =
    useState<"all" | BusinessStatus>("all");
  const [deleteTarget, setDeleteTarget] =
    useState<Business | null>(null);

  const [googlePlaceInputs, setGooglePlaceInputs] =
    useState<Record<string, string>>({});

  const [googlePlaceSaving, setGooglePlaceSaving] =
    useState<string | null>(null);

  useEffect(() => {
    let unsubscribeBusinesses:
      | (() => void)
      | undefined;

    const unsubscribeAuth = onAuthStateChanged(
      auth,
      async (currentUser) => {
        if (!currentUser) {
          router.replace("/business/login?next=/admin");
          return;
        }

        try {
          const adminRef = doc(
            db,
            "admins",
            currentUser.uid
          );

          const adminSnap = await getDoc(adminRef);

          if (
            !adminSnap.exists() ||
            adminSnap.data().active !== true
          ) {
            setAccessDenied(true);
            setLoading(false);
            return;
          }

          setAdminUid(currentUser.uid);

          unsubscribeBusinesses = onSnapshot(
            collection(db, "businesses"),
            (snapshot) => {
              const data = snapshot.docs.map(
                (businessDoc) => {
                  const business = businessDoc.data();
                  const rawStatus = business.status;

                  const status: BusinessStatus =
                    rawStatus === "draft" ||
                    rawStatus === "pending" ||
                    rawStatus === "approved" ||
                    rawStatus === "suspended" ||
                    rawStatus === "rejected"
                      ? rawStatus
                      : "approved";

                  return {
                    id: businessDoc.id,
                    ownerId:
                      business.ownerId || businessDoc.id,
                    name:
                      business.name || "Unnamed business",
                    address: business.address || "",
                    zipcode:
                      business.zipcode ||
                      String(business.address || "")
                        .match(/\b\d{5}(?:-\d{4})?\b/)?.[0]
                        ?.slice(0, 5) ||
                      "",
                    type: business.type || "Business",
                    slug: business.slug || "",
                    status,
                    hours: business.hours,
                    timezone: business.timezone,
                    googlePlaceId:
                      typeof business.googlePlaceId === "string"
                        ? business.googlePlaceId
                        : "",
                  };
                }
              );

              setBusinesses(data);

              setGooglePlaceInputs((current) => {
                const next = { ...current };

                data.forEach((business) => {
                  if (next[business.id] === undefined) {
                    next[business.id] =
                      business.googlePlaceId || "";
                  }
                });

                return next;
              });

              setLoading(false);
            },
            (error) => {
              console.error(error);
              setMessage("Could not load businesses.");
              setLoading(false);
            }
          );
        } catch (error) {
          console.error(error);
          setAccessDenied(true);
          setLoading(false);
        }
      }
    );

    return () => {
      unsubscribeAuth();
      unsubscribeBusinesses?.();
    };
  }, [router]);

  const counts = useMemo(() => {
    return {
      total: businesses.length,
      pending: businesses.filter(
        (business) => business.status === "pending"
      ).length,
      approved: businesses.filter(
        (business) => business.status === "approved"
      ).length,
      suspended: businesses.filter(
        (business) => business.status === "suspended"
      ).length,
    };
  }, [businesses]);

  const filteredBusinesses = useMemo(() => {
    if (filter === "all") return businesses;

    return businesses.filter(
      (business) => business.status === filter
    );
  }, [businesses, filter]);

  const approveBusiness = async (business: Business) => {
    if (!adminUid) return;

    if (!business.slug) {
      setMessage("This business does not have a valid slug.");
      return;
    }

    try {
      setActionLoading(business.id);
      setMessage("");

      const googlePlaceId =
        (
          googlePlaceInputs[business.id] ??
          business.googlePlaceId ??
          ""
        ).trim();

      const batch = writeBatch(db);
      const businessRef = doc(db, "businesses", business.id);
      const publicRef = doc(
        db,
        "publicBusinesses",
        business.slug
      );

      batch.update(businessRef, {
        status: "approved",
        reviewedAt: serverTimestamp(),
        reviewedBy: adminUid,
        googlePlaceId:
          googlePlaceId || null,
      });

      batch.set(
        publicRef,
        {
          businessId: business.id,
          name: business.name,
          address: business.address,
          zipcode: business.zipcode,
          type: business.type,
          slug: business.slug,
          verified: true,
          approvedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          googlePlaceId:
            googlePlaceId || null,
          ...(business.hours
            ? { hours: business.hours }
            : {}),
          ...(business.timezone
            ? { timezone: business.timezone }
            : {}),
        },
        { merge: true }
      );

      await batch.commit();
      setMessage(
        `${business.name} is now approved and public.`
      );
    } catch (error) {
      console.error(error);
      setMessage("Could not approve this business.");
    } finally {
      setActionLoading(null);
    }
  };

  const saveGooglePlaceId = async (
    business: Business
  ) => {
    const googlePlaceId =
      (
        googlePlaceInputs[business.id] ??
        business.googlePlaceId ??
        ""
      ).trim();

    try {
      setGooglePlaceSaving(business.id);
      setMessage("");

      const batch = writeBatch(db);

      batch.update(
        doc(db, "businesses", business.id),
        {
          googlePlaceId:
            googlePlaceId || null,
          updatedAt: serverTimestamp(),
        }
      );

      if (
        business.status === "approved" &&
        business.slug
      ) {
        batch.set(
          doc(
            db,
            "publicBusinesses",
            business.slug
          ),
          {
            googlePlaceId:
              googlePlaceId || null,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      }

      await batch.commit();

      setMessage(
        googlePlaceId
          ? `${business.name} is linked to Google Places.`
          : `${business.name} is no longer linked to a Google Place.`
      );
    } catch (error) {
      console.error(error);
      setMessage(
        "Could not save the Google Place ID."
      );
    } finally {
      setGooglePlaceSaving(null);
    }
  };

  const removeFromPublic = async (
    business: Business,
    newStatus: "suspended" | "rejected"
  ) => {
    if (!adminUid) return;

    try {
      setActionLoading(business.id);
      setMessage("");

      const batch = writeBatch(db);

      batch.update(
        doc(db, "businesses", business.id),
        {
          status: newStatus,
          reviewedAt: serverTimestamp(),
          reviewedBy: adminUid,
        }
      );

      if (business.slug) {
        batch.delete(
          doc(db, "publicBusinesses", business.slug)
        );
      }

      await batch.commit();

      setMessage(
        newStatus === "suspended"
          ? `${business.name} has been suspended.`
          : `${business.name} has been rejected.`
      );
    } catch (error) {
      console.error(error);
      setMessage("Could not update this business.");
    } finally {
      setActionLoading(null);
    }
  };

  const permanentlyDeleteBusiness = async () => {
    if (!deleteTarget) return;

    const business = deleteTarget;

    try {
      setActionLoading(business.id);
      setMessage("");

      const tablesSnapshot = await getDocs(
        collection(
          db,
          "businesses",
          business.id,
          "tables"
        )
      );

      const staffSnapshot = await getDocs(
        query(
          collection(db, "staffUsers"),
          where("businessId", "==", business.id)
        )
      );

      const invitesSnapshot = await getDocs(
        query(
          collection(db, "staffInvites"),
          where("businessId", "==", business.id)
        )
      );

      const refsToDelete = [
        ...tablesSnapshot.docs.map((item) => item.ref),
        ...staffSnapshot.docs.map((item) => item.ref),
        ...invitesSnapshot.docs.map((item) => item.ref),
      ];

      for (
        let index = 0;
        index < refsToDelete.length;
        index += 400
      ) {
        const cleanupBatch = writeBatch(db);
        const chunk = refsToDelete.slice(index, index + 400);

        chunk.forEach((ref) => {
          cleanupBatch.delete(ref);
        });

        await cleanupBatch.commit();
      }

      const finalBatch = writeBatch(db);

      if (business.slug) {
        finalBatch.delete(
          doc(db, "publicBusinesses", business.slug)
        );
      }

      finalBatch.delete(
        doc(db, "businesses", business.id)
      );

      await finalBatch.commit();

      setDeleteTarget(null);
      setMessage(
        `${business.name} was permanently deleted.`
      );
    } catch (error) {
      console.error(error);
      setMessage("Could not delete this business.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    router.push("/business/login");
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f7f8f5] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 rounded-xl bg-green-600 text-white flex items-center justify-center font-bold mx-auto">
            S
          </div>
          <p className="text-gray-500 mt-4">
            Loading SeatMate Admin...
          </p>
        </div>
      </main>
    );
  }

  if (accessDenied) {
    return (
      <main className="min-h-screen bg-[#f7f8f5] flex items-center justify-center px-6">
        <div className="bg-white border border-gray-200 rounded-3xl p-10 max-w-md w-full text-center">
          <div className="w-14 h-14 rounded-2xl bg-[#101811] text-white flex items-center justify-center font-bold mx-auto">
            S
          </div>
          <h1 className="text-2xl font-bold mt-6">
            Admin access required
          </h1>
          <p className="text-gray-500 mt-3">
            This area is only available to authorized SeatMate administrators.
          </p>
          <button
            type="button"
            onClick={() => router.push("/")}
            className="mt-6 bg-[#101811] text-white px-6 py-3 rounded-xl font-semibold"
          >
            Return Home
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f7f8f5]">
      <header className="bg-[#101811] text-white">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-500 text-black rounded-xl flex items-center justify-center font-black">
              S
            </div>
            <div>
              <p className="font-bold">SeatMate</p>
              <p className="text-xs text-white/50">
                Admin Control Center
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => router.push("/")}
              className="border border-white/20 px-4 py-2 rounded-xl text-sm font-semibold hover:bg-white/10"
            >
              View SeatMate
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="bg-white text-black px-4 py-2 rounded-xl text-sm font-semibold"
            >
              Log Out
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-10">
        <div>
          <p className="text-green-700 text-sm font-bold">
            SEATMATE ADMIN
          </p>
          <h1 className="text-4xl md:text-5xl font-bold mt-2">
            Control Center
          </h1>
          <p className="text-gray-500 mt-3">
            Review businesses and control what appears publicly on SeatMate.
          </p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-8">
          <AdminStat label="Total" value={counts.total} />
          <AdminStat label="Pending" value={counts.pending} />
          <AdminStat label="Approved" value={counts.approved} />
          <AdminStat label="Suspended" value={counts.suspended} />
        </div>

        <div className="flex flex-wrap gap-2 mt-8">
          {(
            [
              ["all", "All"],
              ["draft", "Draft"],
              ["pending", "Pending"],
              ["approved", "Approved"],
              ["suspended", "Suspended"],
              ["rejected", "Rejected"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setFilter(value)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold border transition ${
                filter === value
                  ? "bg-[#101811] text-white border-[#101811]"
                  : "bg-white border-gray-200 hover:bg-gray-50"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {message && (
          <div className="mt-6 bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm">
            {message}
          </div>
        )}

        <div className="mt-6 space-y-4">
          {filteredBusinesses.length === 0 && (
            <div className="bg-white border border-gray-200 rounded-3xl p-10 text-center">
              <p className="font-semibold">No businesses here.</p>
              <p className="text-gray-500 text-sm mt-2">
                Businesses will appear here when owners register.
              </p>
            </div>
          )}

          {filteredBusinesses.map((business) => (
            <div
              key={business.id}
              className="bg-white border border-gray-200 rounded-3xl p-6"
            >
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-xl font-bold">
                      {business.name}
                    </h2>
                    <StatusBadge status={business.status} />
                  </div>

                  <p className="text-gray-500 mt-2">
                    {business.type}
                    {business.address
                      ? ` · ${business.address}`
                      : ""}
                    {business.zipcode
                      ? ` · ZIP ${business.zipcode}`
                      : ""}
                  </p>

                  <p className="text-xs text-gray-400 mt-2">
                    Business ID: {business.id}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  {business.status === "pending" && (
                    <>
                      <button
                        type="button"
                        disabled={actionLoading === business.id}
                        onClick={() =>
                          approveBusiness(business)
                        }
                        className="bg-green-600 hover:bg-green-500 text-white px-4 py-2.5 rounded-xl font-semibold disabled:opacity-50"
                      >
                        Approve
                      </button>

                      <button
                        type="button"
                        disabled={actionLoading === business.id}
                        onClick={() =>
                          removeFromPublic(
                            business,
                            "rejected"
                          )
                        }
                        className="border border-gray-200 px-4 py-2.5 rounded-xl font-semibold hover:bg-gray-50 disabled:opacity-50"
                      >
                        Reject
                      </button>
                    </>
                  )}

                  {business.status === "approved" && (
                    <button
                      type="button"
                      disabled={actionLoading === business.id}
                      onClick={() =>
                        removeFromPublic(
                          business,
                          "suspended"
                        )
                      }
                      className="border border-amber-200 bg-amber-50 text-amber-700 px-4 py-2.5 rounded-xl font-semibold disabled:opacity-50"
                    >
                      Suspend
                    </button>
                  )}

                  {(business.status === "suspended" ||
                    business.status === "rejected") && (
                    <button
                      type="button"
                      disabled={actionLoading === business.id}
                      onClick={() =>
                        approveBusiness(business)
                      }
                      className="bg-green-600 text-white px-4 py-2.5 rounded-xl font-semibold disabled:opacity-50"
                    >
                      Restore
                    </button>
                  )}

                  <button
                    type="button"
                    disabled={actionLoading === business.id}
                    onClick={() => setDeleteTarget(business)}
                    className="border border-red-200 bg-red-50 text-red-600 px-4 py-2.5 rounded-xl font-semibold disabled:opacity-50"
                  >
                    Delete
                  </button>
                </div>
              </div>

              <div className="border-t border-gray-100 mt-6 pt-5">
                <div className="flex flex-col lg:flex-row lg:items-end gap-3">
                  <div className="flex-1">
                    <label className="text-sm font-bold text-[#101811]">
                      Google Place ID
                    </label>

                    <p className="text-xs text-gray-500 mt-1">
                      Optional for test locations. Add the real Google Place ID when a restaurant joins to enable live Google ratings and reviews.
                    </p>

                    <input
                      value={
                        googlePlaceInputs[business.id] ??
                        business.googlePlaceId ??
                        ""
                      }
                      onChange={(event) =>
                        setGooglePlaceInputs(
                          (current) => ({
                            ...current,
                            [business.id]:
                              event.target.value,
                          })
                        )
                      }
                      placeholder="ChIJ..."
                      className="w-full border border-gray-200 rounded-xl px-4 py-3 mt-3 outline-none focus:border-green-500"
                    />
                  </div>

                  <button
                    type="button"
                    disabled={
                      googlePlaceSaving === business.id ||
                      actionLoading === business.id
                    }
                    onClick={() =>
                      void saveGooglePlaceId(business)
                    }
                    className="bg-[#101811] text-white px-5 py-3 rounded-xl font-semibold disabled:opacity-50"
                  >
                    {googlePlaceSaving === business.id
                      ? "Saving..."
                      : "Save Google Link"}
                  </button>

                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                      `${business.name} ${business.address}`
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="border border-gray-200 bg-white hover:bg-gray-50 px-5 py-3 rounded-xl font-semibold text-center"
                  >
                    Search on Maps ↗
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {deleteTarget && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center px-4">
          <div className="bg-white max-w-md w-full rounded-3xl p-7">
            <p className="text-red-600 text-sm font-bold">
              PERMANENT DELETE
            </p>
            <h2 className="text-2xl font-bold mt-2">
              Delete {deleteTarget.name}?
            </h2>
            <p className="text-gray-500 mt-3">
              This removes the business, floor plan, staff memberships,
              invites, and public listing. This cannot be undone.
            </p>

            <div className="flex gap-3 mt-7">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="flex-1 border border-gray-200 py-3 rounded-xl font-semibold"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={actionLoading === deleteTarget.id}
                onClick={permanentlyDeleteBusiness}
                className="flex-1 bg-red-600 hover:bg-red-500 text-white py-3 rounded-xl font-bold disabled:opacity-50"
              >
                Delete Forever
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function AdminStat({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-5">
      <p className="text-xs uppercase tracking-wider text-gray-400 font-bold">
        {label}
      </p>
      <p className="text-3xl font-bold mt-2">{value}</p>
    </div>
  );
}

function StatusBadge({
  status,
}: {
  status: BusinessStatus;
}) {
  const styles = {
    draft:
      "bg-gray-100 text-gray-600 border-gray-200",
    pending:
      "bg-amber-50 text-amber-700 border-amber-200",
    approved:
      "bg-green-50 text-green-700 border-green-200",
    suspended:
      "bg-red-50 text-red-700 border-red-200",
    rejected:
      "bg-gray-100 text-gray-600 border-gray-200",
  };

  return (
    <span
      className={`border px-2.5 py-1 rounded-full text-xs font-bold uppercase ${styles[status]}`}
    >
      {status}
    </span>
  );
}
