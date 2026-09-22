"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import {
  onAuthStateChanged,
  signOut,
  User,
} from "firebase/auth";

import {
  doc,
  getDoc,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";

import { auth, db } from "@/lib/firebase";

export default function BusinessSetupPage() {
  const router = useRouter();

  const [user, setUser] = useState<User | null>(null);

  const [name, setName] = useState("");
  const [type, setType] = useState("Cafe");
  const [address, setAddress] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      auth,
      async (currentUser) => {
        if (!currentUser) {
          router.replace("/business/login");
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

          // If they already created a business,
          // don't make them do setup again.
          if (businessSnap.exists()) {
            router.replace("/business");
            return;
          }

          setLoading(false);
        } catch (err) {
          console.error(err);
          setError(
            "Could not load your account. Please try again."
          );
          setLoading(false);
        }
      }
    );

    return () => unsubscribe();
  }, [router]);

  const createSlug = (businessName: string) => {
    return businessName
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  };

  const handleCreateBusiness = async (
    event: React.FormEvent
  ) => {
    event.preventDefault();

    if (!user) return;

    if (!name.trim()) {
      setError("Enter your business name.");
      return;
    }

    if (!address.trim()) {
      setError("Enter your business address.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const slug = createSlug(name);

      if (!slug) {
        setError("Please enter a valid business name.");
        setSaving(false);
        return;
      }

      const businessRef = doc(
        db,
        "businesses",
        user.uid
      );

      const publicBusinessRef = doc(
        db,
        "publicBusinesses",
        slug
      );

      const batch = writeBatch(db);

      // Private owner/business data
      batch.set(businessRef, {
        ownerId: user.uid,
        name: name.trim(),
        type,
        address: address.trim(),
        slug,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // Public searchable business data
      batch.set(publicBusinessRef, {
        businessId: user.uid,
        name: name.trim(),
        type,
        address: address.trim(),
        slug,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      await batch.commit();

      // IMPORTANT:
      // New owner now goes directly to the grid
      router.push("/business/floor-plan");
    } catch (err) {
      console.error(
        "Error creating business:",
        err
      );

      setError(
        "Something went wrong creating your business."
      );

      setSaving(false);
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

  return (
    <main className="min-h-screen bg-[#f7f8f5]">

      {/* HEADER */}
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
                Business Setup
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="border border-gray-200 bg-white hover:bg-gray-50 px-4 py-2 rounded-xl font-semibold transition"
          >
            Log Out
          </button>

        </div>
      </header>

      {/* PAGE */}
      <div className="max-w-5xl mx-auto px-6 py-14">

        <div className="grid lg:grid-cols-2 gap-12 items-start">

          {/* LEFT SIDE */}
          <div className="pt-4">

            <p className="text-green-600 font-bold text-sm">
              STEP 1 OF 2
            </p>

            <h1 className="text-5xl font-bold tracking-tight mt-4">
              Add your business.
            </h1>

            <p className="text-gray-500 text-lg mt-5 max-w-md">
              Tell us about your restaurant or café.
              After this, you&apos;ll build your live
              seating floor plan.
            </p>

            <div className="mt-10 space-y-5">

              <div className="flex items-center gap-4">
                <div className="w-9 h-9 rounded-full bg-green-600 text-white flex items-center justify-center font-bold">
                  1
                </div>

                <div>
                  <p className="font-semibold">
                    Business details
                  </p>

                  <p className="text-sm text-gray-500">
                    Name, type and address
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="w-9 h-9 rounded-full border border-gray-300 bg-white text-gray-500 flex items-center justify-center font-bold">
                  2
                </div>

                <div>
                  <p className="font-semibold">
                    Build your floor plan
                  </p>

                  <p className="text-sm text-gray-500">
                    Add tables and seats to the grid
                  </p>
                </div>
              </div>

            </div>

          </div>

          {/* FORM */}
          <form
            onSubmit={handleCreateBusiness}
            className="bg-white border border-gray-200 rounded-[28px] p-8 shadow-sm"
          >

            <h2 className="text-2xl font-bold">
              Create your location
            </h2>

            <p className="text-gray-500 mt-2">
              This information will appear to SeatMate
              customers.
            </p>

            {error && (
              <div className="mt-5 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
                {error}
              </div>
            )}

            {/* BUSINESS NAME */}
            <div className="mt-7">
              <label className="block text-sm font-semibold mb-2">
                Business name
              </label>

              <input
                type="text"
                value={name}
                onChange={(e) =>
                  setName(e.target.value)
                }
                placeholder="Temple Coffee"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>

            {/* BUSINESS TYPE */}
            <div className="mt-5">
              <label className="block text-sm font-semibold mb-2">
                Business type
              </label>

              <select
                value={type}
                onChange={(e) =>
                  setType(e.target.value)
                }
                className="w-full border border-gray-200 rounded-xl px-4 py-3 bg-white outline-none focus:ring-2 focus:ring-green-500"
              >
                <option value="Cafe">
                  Café
                </option>

                <option value="Restaurant">
                  Restaurant
                </option>

                <option value="Coffee Shop">
                  Coffee Shop
                </option>

                <option value="Bakery">
                  Bakery
                </option>

                <option value="Food Hall">
                  Food Hall
                </option>

                <option value="Other">
                  Other
                </option>
              </select>
            </div>

            {/* ADDRESS */}
            <div className="mt-5">
              <label className="block text-sm font-semibold mb-2">
                Business address
              </label>

              <input
                type="text"
                value={address}
                onChange={(e) =>
                  setAddress(e.target.value)
                }
                placeholder="123 Main Street, Folsom, CA"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full mt-7 bg-[#101811] hover:bg-black text-white font-bold py-4 rounded-xl transition disabled:opacity-50"
            >
              {saving
                ? "Creating business..."
                : "Continue to Floor Plan →"}
            </button>

          </form>

        </div>
      </div>
    </main>
  );
}