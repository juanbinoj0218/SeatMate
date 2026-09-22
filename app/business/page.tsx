"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import BackButton from "@/components/BackButton";
<BackButton fallback="/business" />


import {
  onAuthStateChanged,
  signOut,
  User,
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

  const [user, setUser] = useState<User | null>(null);
  const [business, setBusiness] =
    useState<Business | null>(null);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
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

          if (businessSnap.exists()) {
            setBusiness(
              businessSnap.data() as Business
            );
          }
        } catch (error) {
          console.error(error);
        } finally {
          setLoading(false);
        }
      }
    );

    return unsubscribe;
  }, [router]);

  const handleLogout = async () => {
    await signOut(auth);
    router.push("/business/login");
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f7f8f5] flex items-center justify-center">
        <p>Loading SeatMate...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f7f8f5]">

      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">

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

          <button
            onClick={handleLogout}
            className="border border-gray-200 px-4 py-2 rounded-xl"
          >
            Log Out
          </button>

        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-12">

        {!business ? (
          <div className="bg-white border border-gray-200 rounded-3xl p-8">

            <h1 className="text-3xl font-bold">
              Welcome to SeatMate
            </h1>

            <p className="text-gray-500 mt-2">
              Create your restaurant or café first.
            </p>

            <Link
  href="/business/staff"
  className="inline-block border border-gray-200 bg-white hover:bg-gray-50 px-6 py-3 rounded-xl mt-5 mr-3 font-semibold transition"
>
  Manage Staff
</Link>

          </div>
        ) : (
          <>
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

            <div className="bg-[#101811] text-white rounded-3xl p-10 mt-10">

              <p className="text-green-400 text-sm font-bold">
                FLOOR PLAN
              </p>

              <h2 className="text-3xl font-bold mt-3">
                Manage live seating
              </h2>

              <p className="text-white/60 mt-3">
                Arrange tables and update seat occupancy in real time.
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
            

            {business.slug && (
              <button
                onClick={() =>
                  router.push(`/place/${business.slug}?from=business`)
                }
                className="border border-gray-200 bg-white px-6 py-3 rounded-xl mt-5"
              >
                View Customer Page
              </button>
            )}

          </>
        )}

      </div>
    </main>
  );
}