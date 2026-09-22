"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import {
  onAuthStateChanged,
  User,
} from "firebase/auth";

import {
  addDoc,
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";

import { auth, db } from "@/lib/firebase";

type StaffMember = {
  id: string;
  email: string;
  active: boolean;
};

export default function StaffManagementPage() {
  const router = useRouter();

  const [user, setUser] =
    useState<User | null>(null);

  const [businessName, setBusinessName] =
    useState("");

  const [staff, setStaff] =
    useState<StaffMember[]>([]);

  const [latestLink, setLatestLink] =
    useState("");

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  useEffect(() => {
    let stopStaff: (() => void) | undefined;

    const stopAuth = onAuthStateChanged(
      auth,
      async (currentUser) => {
        if (!currentUser) {
          router.push("/business/login");
          return;
        }

        setUser(currentUser);

        try {
          const businessRef = doc(
            db,
            "businesses",
            currentUser.uid
          );

          const businessSnap =
            await getDoc(businessRef);

          if (!businessSnap.exists()) {
            setError(
              "No business was found for this account."
            );

            setLoading(false);
            return;
          }

          const businessData =
            businessSnap.data();

          setBusinessName(
            businessData.name || "Your Business"
          );

          const staffQuery = query(
            collection(db, "staffUsers"),
            where(
              "businessId",
              "==",
              currentUser.uid
            )
          );

          stopStaff = onSnapshot(
            staffQuery,
            (snapshot) => {
              const members =
                snapshot.docs.map((item) => ({
                  id: item.id,
                  email:
                    item.data().email || "",
                  active:
                    item.data().active ??
                    false,
                }));

              setStaff(members);
              setLoading(false);
            },
            (snapshotError) => {
              console.error(snapshotError);

              setError(
                "Could not load staff members."
              );

              setLoading(false);
            }
          );
        } catch (err) {
          console.error(err);

          setError(
            "Could not load staff management."
          );

          setLoading(false);
        }
      }
    );

    return () => {
      stopAuth();
      stopStaff?.();
    };
  }, [router]);

  const createInvite = async () => {
    if (!user) return;

    try {
      setError("");

      const invite = await addDoc(
        collection(
          db,
          "staffInvites"
        ),
        {
          businessId: user.uid,
          businessName,
          role: "staff",
          active: true,
          createdAt: serverTimestamp(),
        }
      );

      const link =
        `${window.location.origin}/staff/join/${invite.id}`;

      setLatestLink(link);

      try {
        await navigator.clipboard.writeText(
          link
        );
      } catch {
        // Link still appears on screen
        // even if clipboard access fails.
      }
    } catch (err) {
      console.error(err);

      setError(
        "Could not create the invite link."
      );
    }
  };

  const toggleStaff = async (
    member: StaffMember
  ) => {
    try {
      await updateDoc(
        doc(
          db,
          "staffUsers",
          member.id
        ),
        {
          active: !member.active,
        }
      );
    } catch (err) {
      console.error(err);

      setError(
        "Could not update this staff member."
      );
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f7f8f5] flex items-center justify-center">
        <p className="text-gray-500">
          Loading staff management...
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f7f8f5]">

      <header className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto h-20 px-6 flex items-center justify-between">

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-600 rounded-xl text-white font-bold flex items-center justify-center">
              S
            </div>

            <div>
              <p className="font-bold">
                SeatMate
              </p>

              <p className="text-xs text-gray-400">
                Staff Management
              </p>
            </div>
          </div>

          <button
            onClick={() =>
              router.push("/business")
            }
            className="border border-gray-200 bg-white hover:bg-gray-50 px-4 py-2.5 rounded-xl text-sm font-semibold"
          >
            ← Dashboard
          </button>

        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-12">

        {error && (
          <div className="bg-red-50 border border-red-100 text-red-600 rounded-xl p-4 mb-6">
            {error}
          </div>
        )}

        <p className="text-green-600 font-semibold text-sm">
          {businessName || "SeatMate Business"}
        </p>

        <h1 className="text-4xl font-bold mt-2">
          Staff access
        </h1>

        <p className="text-gray-500 mt-3">
          Give employees access to update live
          occupancy without sharing your owner account.
        </p>

        <div className="bg-white border border-gray-200 rounded-3xl p-7 mt-8">

          <h2 className="text-xl font-bold">
            Invite an employee
          </h2>

          <p className="text-gray-500 text-sm mt-2">
            Create a private link for an employee
            to join this location.
          </p>

          <button
            onClick={createInvite}
            className="bg-[#101811] text-white font-semibold px-6 py-3 rounded-xl mt-6"
          >
            Create Invite Link
          </button>

          {latestLink && (
            <div className="bg-green-50 border border-green-100 rounded-xl p-4 mt-5">

              <p className="text-green-700 font-semibold text-sm">
                Invite created
              </p>

              <p className="text-xs text-gray-500 mt-2 break-all">
                {latestLink}
              </p>

              <button
                onClick={() =>
                  navigator.clipboard.writeText(
                    latestLink
                  )
                }
                className="text-sm font-semibold text-green-700 mt-3"
              >
                Copy Link
              </button>

            </div>
          )}

        </div>

        <div className="bg-white border border-gray-200 rounded-3xl p-7 mt-6">

          <h2 className="text-xl font-bold">
            Staff members
          </h2>

          {staff.length === 0 ? (
            <p className="text-gray-400 mt-5">
              No employees have joined yet.
            </p>
          ) : (
            <div className="divide-y divide-gray-100 mt-5">

              {staff.map((member) => (
                <div
                  key={member.id}
                  className="py-4 flex items-center justify-between"
                >

                  <div>
                    <p className="font-semibold">
                      {member.email ||
                        "Staff member"}
                    </p>

                    <p
                      className={`text-xs mt-1 ${
                        member.active
                          ? "text-green-600"
                          : "text-red-500"
                      }`}
                    >
                      ●{" "}
                      {member.active
                        ? "Active"
                        : "Disabled"}
                    </p>
                  </div>

                  <button
                    onClick={() =>
                      toggleStaff(member)
                    }
                    className="border border-gray-200 px-4 py-2 rounded-xl text-sm font-semibold"
                  >
                    {member.active
                      ? "Disable"
                      : "Enable"}
                  </button>

                </div>
              ))}

            </div>
          )}

        </div>

      </div>

    </main>
  );
}