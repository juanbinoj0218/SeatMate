"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import BackButton from "@/components/BackButton";

import {
  onAuthStateChanged,
  signOut,
} from "firebase/auth";

import {
  doc,
  getDoc,
} from "firebase/firestore";

import { auth, db } from "@/lib/firebase";

type Business = {
  name: string;
  address: string;
  type: string;
  slug?: string;
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
        // Not logged in
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

          // Logged in, but they have NOT created
          // a restaurant/cafe yet
          if (!businessSnap.exists()) {
            router.replace("/business/setup");
            return;
          }

          // They already have a business
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
          <div className="w-12 h-12 bg-green-600 text-white rounded-xl flex items-center justify-center font-bold mx-auto">
            S
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

  return (
    <main className="min-h-screen bg-[#f7f8f5]">

      {/* HEADER */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">

          <div className="flex items-center gap-5">

            <BackButton fallback="/" />

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-600 text-white rounded-xl flex items-center justify-center font-bold">
                S
              </div>

              <div>
                <p className="font-bold">
                  SeatMate
                </p>

                <p className="text-xs text-gray-400">
                  Business
                </p>
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

      {/* PAGE */}
      <div className="max-w-7xl mx-auto px-6 py-12">

        <div>
          <div className="flex items-center gap-2 text-green-600 font-semibold text-sm">
            <span className="w-2 h-2 bg-green-500 rounded-full" />
            LIVE
          </div>

          <h1 className="text-5xl font-bold mt-3">
            {business.name}
          </h1>

          <p className="text-gray-500 mt-2">
            {business.type} · {business.address}
          </p>
        </div>

        {/* MANAGEMENT CARD */}
        <div className="bg-[#101811] text-white rounded-3xl p-10 mt-10">

          <p className="text-green-400 text-sm font-bold">
            FLOOR PLAN
          </p>

          <h2 className="text-3xl font-bold mt-3">
            Manage live seating
          </h2>

          <p className="text-white/60 mt-3">
            Arrange tables and update seat occupancy
            in real time.
          </p>

          <div className="flex flex-wrap gap-3 mt-7">

            <button
              type="button"
              onClick={() =>
                router.push("/business/floor-plan")
              }
              className="bg-green-500 hover:bg-green-400 text-black font-bold px-6 py-3 rounded-xl transition"
            >
              Open Floor Plan →
            </button>

            <button
              type="button"
              onClick={() =>
                router.push("/business/staff")
              }
              className="bg-white/10 hover:bg-white/20 border border-white/20 text-white font-semibold px-6 py-3 rounded-xl transition"
            >
              Manage Staff
            </button>

            <button
              type="button"
              onClick={() =>
                router.push("/business/hours")
              }
              className="bg-white/10 hover:bg-white/20 border border-white/20 text-white font-semibold px-6 py-3 rounded-xl transition"
            >
              Business Hours
            </button>

          </div>
        </div>

        {/* CUSTOMER PAGE */}
        {business.slug && (
          <button
            type="button"
            onClick={() =>
              router.push(
                `/place/${business.slug}?from=business`
              )
            }
            className="border border-gray-200 bg-white hover:bg-gray-50 px-6 py-3 rounded-xl mt-5 font-semibold transition"
          >
            View Customer Page →
          </button>
        )}

      </div>
    </main>
  );
}