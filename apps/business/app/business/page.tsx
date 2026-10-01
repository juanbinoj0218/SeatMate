"use client";

import SeatMateMark from "@seatmate/shared/components/SeatMateMark";
import { useEffect, useState } from "react";
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
} from "firebase/firestore";

import { auth, db } from "@seatmate/shared/firebase";
import { isBar } from "@seatmate/shared/floor-plan";
import { consumerUrl } from "@seatmate/shared/site-urls";

import BouncerCard from "@/components/bouncer-card";
import UpdateReminder from "@/components/update-reminder";
import {
  ChartIcon,
  ChevronRightIcon,
  ClockIcon,
  FloorPlanIcon,
  QrIcon,
  ShieldIcon,
  StaffIcon,
  StorefrontIcon,
} from "@/components/portal-icons";

type BusinessStatus =
  | "draft"
  | "pending"
  | "approved"
  | "suspended"
  | "rejected";

type SeatCount = {
  open: number;
  total: number;
};

const STATUS_BADGES: Record<BusinessStatus, { label: string; className: string }> = {
  approved: { label: "Live on SeatMate", className: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  pending: { label: "Pending approval", className: "bg-amber-50 text-amber-700 ring-amber-200" },
  draft: { label: "Draft", className: "bg-gray-100 text-gray-600 ring-gray-200" },
  suspended: { label: "Suspended", className: "bg-rose-50 text-rose-700 ring-rose-200" },
  rejected: { label: "Declined", className: "bg-gray-100 text-gray-600 ring-gray-200" },
};

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

  const [businessId, setBusinessId] = useState("");

  const [loading, setLoading] = useState(true);

  const [seats, setSeats] =
    useState<SeatCount | null>(null);

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

          setBusinessId(currentUser.uid);

          setLoading(false);

          // Live seat count across all tables. The dashboard still works
          // without it.
          try {
            const tables = await getDocs(
              collection(db, "businesses", currentUser.uid, "tables")
            );

            const count = { open: 0, total: 0 };

            tables.docs.forEach((tableDoc) => {
              const tableSeats: { status?: string }[] =
                tableDoc.data().seats || [];

              count.total += tableSeats.length;
              count.open += tableSeats.filter(
                (seat) => seat.status === "available"
              ).length;
            });

            setSeats(count);
          } catch (seatError) {
            console.error("Error loading seats:", seatError);
          }
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
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ring-1 ${STATUS_BADGES[businessStatus].className}`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-current" />
          {STATUS_BADGES[businessStatus].label}
        </span>

        <h1 className="text-4xl font-bold tracking-tight mt-4">
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

        {seats && seats.total > 0 && (
          <>
            <div className="mt-8">
              <UpdateReminder businessId={businessId} />
            </div>
            <SeatSummary seats={seats} />
          </>
        )}

        {isBar(business.type) && <BouncerCard businessId={businessId} />}

        <ul className="mt-6 bg-white border border-gray-200 rounded-2xl divide-y divide-gray-200 overflow-hidden">
          <DashboardLink
            title="Floor plan"
            Icon={FloorPlanIcon}
            tile="bg-emerald-100 text-emerald-700"
            description="Arrange tables and update seat occupancy in real time."
            onClick={() => router.push("/business/floor-plan")}
          />

          <DashboardLink
            title="Staff"
            Icon={StaffIcon}
            tile="bg-violet-100 text-violet-700"
            description="Invite staff and manage who can update seats."
            onClick={() => router.push("/business/staff")}
          />

          <DashboardLink
            title="Business hours"
            Icon={ClockIcon}
            tile="bg-amber-100 text-amber-700"
            description="Set the hours customers see on your page."
            onClick={() => router.push("/business/hours")}
          />

          <DashboardLink
            title="Analytics"
            Icon={ChartIcon}
            tile="bg-rose-100 text-rose-600"
            description="Page views, saves and your busiest hours."
            onClick={() => router.push("/business/analytics")}
          />

          {businessStatus === "approved" && business.slug && (
            <DashboardLink
              title="QR code"
              Icon={QrIcon}
              tile="bg-slate-200 text-slate-700"
              description="Print a sign so customers can check seats from their phone."
              onClick={() => router.push("/business/qr")}
            />
          )}

          {businessStatus === "approved" && business.slug && (
            <DashboardLink
              title="Customer page"
              Icon={StorefrontIcon}
              tile="bg-sky-100 text-sky-700"
              description="See your place the way customers do on SeatMate."
              onClick={() =>
                window.location.assign(
                  consumerUrl(`/place/${business.slug}?from=business`)
                )
              }
            />
          )}

          <DashboardLink
            title="Security"
            Icon={ShieldIcon}
            tile="bg-emerald-100 text-emerald-700"
            description="Turn on two-factor sign-in to protect your account."
            onClick={() => router.push("/business/security")}
          />
        </ul>
      </div>
    </main>
  );
}

function SeatSummary({ seats }: { seats: SeatCount }) {
  const percent = Math.round((seats.open / seats.total) * 100);

  return (
    <div className="mt-8 bg-white border border-gray-200 rounded-2xl p-6">
      <div className="flex items-baseline justify-between gap-4">
        <p className="text-sm font-semibold text-gray-500">Seats right now</p>
        <p className="text-sm text-gray-500">{percent}% open</p>
      </div>

      <p className="mt-2 text-3xl font-bold tracking-tight">
        <span className="text-emerald-600">{seats.open}</span>
        <span className="text-gray-400 text-xl font-semibold">
          {" "}/ {seats.total} open
        </span>
      </p>

      <div className="mt-4 h-2.5 rounded-full bg-rose-100 overflow-hidden">
        <div
          className="h-full rounded-full bg-emerald-500 transition-[width]"
          style={{ width: `${percent}%` }}
        />
      </div>

      <div className="mt-3 flex gap-4 text-xs text-gray-500">
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          Open
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-rose-300" />
          Taken
        </span>
      </div>
    </div>
  );
}

function DashboardLink({
  title,
  description,
  Icon,
  tile,
  onClick,
}: {
  title: string;
  description: string;
  Icon: (props: { className?: string }) => React.ReactNode;
  tile: string;
  onClick: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className="group w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-gray-50 transition"
      >
        <span className={`w-11 h-11 shrink-0 rounded-xl flex items-center justify-center ${tile}`}>
          <Icon className="w-5 h-5" />
        </span>

        <span className="flex-1 min-w-0">
          <span className="block font-semibold">{title}</span>
          <span className="block text-sm text-gray-500 mt-0.5">
            {description}
          </span>
        </span>

        <ChevronRightIcon className="w-5 h-5 shrink-0 text-gray-300 group-hover:text-[#101811] group-hover:translate-x-0.5 transition" />
      </button>
    </li>
  );
}
