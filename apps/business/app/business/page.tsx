"use client";

import SeatMateMark from "@seatmate/shared/components/SeatMateMark";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import BackButton from "@seatmate/shared/components/BackButton";

import {
  onAuthStateChanged,
  signOut,
} from "firebase/auth";

import {
  doc,
  getDoc,
} from "firebase/firestore";

import { auth, db } from "@seatmate/shared/firebase";
import { consumerUrl } from "@seatmate/shared/site-urls";

type BusinessStatus =
  | "draft"
  | "pending"
  | "approved"
  | "suspended"
  | "rejected";

type Business = {
  name: string;
  address: string;
  type: string;
  slug?: string;
  status?: BusinessStatus;
};

export default function BusinessDashboard() {
  const router = useRouter();

  const [business, setBusiness] =
    useState<Business | null>(null);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      auth,
      async (currentUser) => {
        if (!currentUser) {
          router.replace("/business/login");
          return;
        }

        try {
          const businessRef = doc(
            db,
            "businesses",
            currentUser.uid
          );

          const businessSnap =
            await getDoc(businessRef);

          if (!businessSnap.exists()) {
            router.replace("/business/setup");
            return;
          }

          setBusiness(
            businessSnap.data() as Business
          );

          setLoading(false);
        } catch (error) {
          console.error(
            "Error loading business:",
            error
          );

          setLoading(false);
        }
      }
    );

    return () => unsubscribe();
  }, [router]);

  const handleLogout = async () => {
    await signOut(auth);
    router.push("/business/login");
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f7f8f5] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 flex items-center justify-center mx-auto text-[#101811]">
            <SeatMateMark className="h-[85%] w-[85%]" />
          </div>
          <p className="text-gray-500 mt-4">
            Loading SeatMate...
          </p>
        </div>
      </main>
    );
  }

  if (!business) {
    return null;
  }

  const businessStatus: BusinessStatus =
    business.status ?? "approved";

  return (
    <main className="min-h-screen bg-[#f7f8f5]">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-5">
            <BackButton fallback="/" />

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 flex items-center justify-center text-[#101811]">
                <SeatMateMark className="h-[85%] w-[85%]" />
              </div>

              <div>
                <p className="font-bold">SeatMate</p>
                <p className="text-xs text-gray-400">Business</p>
              </div>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="border border-gray-200 bg-white hover:bg-gray-50 px-4 py-2 rounded-xl font-semibold transition"
          >
            Log Out
          </button>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="text-4xl font-bold tracking-tight">
          {business.name}
        </h1>

        <p className="text-gray-500 mt-2">
          {business.type} · {business.address}
        </p>

        {businessStatus === "draft" && (
          <div className="mt-8 bg-white border border-gray-200 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <p className="font-bold">Setup not submitted</p>
              <p className="text-gray-500 text-sm mt-1">
                Finish your floor plan and submit your business for SeatMate approval.
              </p>
            </div>

            <button
              type="button"
              onClick={() =>
                router.push("/business/floor-plan")
              }
              className="shrink-0 bg-[#101811] text-white px-5 py-3 rounded-xl font-semibold"
            >
              Continue Setup →
            </button>
          </div>
        )}

        {businessStatus === "pending" && (
          <div className="mt-8 bg-amber-50 border border-amber-200 rounded-2xl p-5">
            <p className="font-bold text-amber-800">
              Pending approval
            </p>
            <p className="text-amber-700 text-sm mt-1">
              SeatMate is reviewing your business. Your customer page will become available after approval.
            </p>
          </div>
        )}

        {businessStatus === "suspended" && (
          <div className="mt-8 bg-red-50 border border-red-200 rounded-2xl p-5">
            <p className="font-bold text-red-700">
              Business suspended
            </p>
            <p className="text-red-600 text-sm mt-1">
              This location is currently hidden from SeatMate customers.
            </p>
          </div>
        )}

        {businessStatus === "rejected" && (
          <div className="mt-8 bg-gray-100 border border-gray-200 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <p className="font-bold">Approval declined</p>
              <p className="text-gray-500 text-sm mt-1">
                Update your business or floor plan, then submit it again for review.
              </p>
            </div>

            <button
              type="button"
              onClick={() =>
                router.push("/business/floor-plan")
              }
              className="shrink-0 bg-[#101811] text-white px-5 py-3 rounded-xl font-semibold"
            >
              Update & Resubmit →
            </button>
          </div>
        )}

        <ul className="mt-10 bg-white border border-gray-200 rounded-2xl divide-y divide-gray-200 overflow-hidden">
          <DashboardLink
            title="Floor plan"
            description="Arrange tables and update seat occupancy in real time."
            onClick={() => router.push("/business/floor-plan")}
          />

          <DashboardLink
            title="Staff"
            description="Invite staff and manage who can update seats."
            onClick={() => router.push("/business/staff")}
          />

          <DashboardLink
            title="Business hours"
            description="Set the hours customers see on your page."
            onClick={() => router.push("/business/hours")}
          />

          {businessStatus === "approved" && business.slug && (
            <DashboardLink
              title="Customer page"
              description="See your place the way customers do on SeatMate."
              onClick={() =>
                window.location.assign(
                  consumerUrl(`/place/${business.slug}?from=business`)
                )
              }
            />
          )}
        </ul>
      </div>
    </main>
  );
}

function DashboardLink({
  title,
  description,
  onClick,
}: {
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className="group w-full flex items-center justify-between gap-4 px-6 py-5 text-left hover:bg-gray-50 transition"
      >
        <span>
          <span className="block font-semibold">{title}</span>
          <span className="block text-sm text-gray-500 mt-0.5">
            {description}
          </span>
        </span>

        <span
          aria-hidden="true"
          className="text-gray-400 group-hover:text-[#101811] group-hover:translate-x-0.5 transition"
        >
          →
        </span>
      </button>
    </li>
  );
}
