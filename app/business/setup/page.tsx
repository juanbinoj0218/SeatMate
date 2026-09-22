"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import BackButton from "@/components/BackButton";
<BackButton fallback ="/business" />

import {
  onAuthStateChanged,
  User,
} from "firebase/auth";

import {
  doc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";

import { auth, db } from "@/lib/firebase";

export default function BusinessSetupPage() {
  const router = useRouter();

  const [user, setUser] = useState<User | null>(null);

  const [businessName, setBusinessName] =
    useState("");

  const [address, setAddress] =
    useState("");

  const [businessType, setBusinessType] =
    useState("Cafe");

  const [loading, setLoading] =
    useState(false);

  const [message, setMessage] =
    useState("");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      auth,
      (currentUser) => {
        if (!currentUser) {
          router.push("/business/login");
          return;
        }

        setUser(currentUser);
      }
    );

    return unsubscribe;
  }, [router]);

  const createBusiness = async () => {
    if (!user) return;

    if (!businessName.trim()) {
      setMessage("Enter your business name.");
      return;
    }

    if (!address.trim()) {
      setMessage("Enter your business address.");
      return;
    }

    try {
      setLoading(true);
      setMessage("");

      const slug = businessName
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");

      await setDoc(
        doc(
          db,
          "businesses",
          user.uid
        ),
        {
          name: businessName.trim(),
          address: address.trim(),
          type: businessType,
          ownerId: user.uid,
          ownerEmail: user.email,
          slug,
          createdAt: serverTimestamp(),
        }
      );

      await setDoc(
        doc(
          db,
          "publicBusinesses",
          slug
        ),
        {
          businessId: user.uid,
          name: businessName.trim(),
          address: address.trim(),
          type: businessType,
        }
      );

      router.push("/business");
    } catch (error) {
      console.error(error);

      setMessage(
        "Could not create your business."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#f7f8f5]">

      {/* HEADER */}

      <header className="bg-white border-b border-[#e3e7e2]">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">

          <button
            onClick={() =>
              router.push("/business")
            }
            className="flex items-center gap-3"
          >
            <div className="w-10 h-10 rounded-xl bg-green-600 flex items-center justify-center text-white font-bold text-lg">
              S
            </div>

            <span className="text-xl font-bold text-[#101811]">
              SeatMate
            </span>
          </button>

          <button
            onClick={() =>
              router.push("/business")
            }
            className="text-sm text-gray-500 hover:text-black transition"
          >
            Cancel
          </button>

        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-12 md:py-16">

        <div className="grid lg:grid-cols-[0.8fr_1.2fr] gap-12">

          {/* LEFT */}

          <div>
            <p className="text-sm font-semibold text-green-600">
              STEP 1 OF 2
            </p>

            <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-[#101811] mt-4 leading-tight">
              Add your location.
            </h1>

            <p className="text-gray-500 text-lg mt-5 leading-8">
              This information appears on the customer
              side of SeatMate, so visitors know exactly
              which location they&apos;re viewing.
            </p>

            <div className="mt-10 border-t border-gray-200 pt-8">

              <p className="font-semibold text-[#101811]">
                What happens next?
              </p>

              <div className="space-y-5 mt-5">

                <SetupStep
                  number="1"
                  text="Create your business profile"
                  active
                />

                <SetupStep
                  number="2"
                  text="Build your seating layout"
                />

                <SetupStep
                  number="3"
                  text="Start sharing live availability"
                />

              </div>

            </div>
          </div>

          {/* FORM */}

          <div className="bg-white border border-[#e3e7e2] rounded-[28px] p-7 md:p-10 shadow-[0_20px_60px_rgba(0,0,0,0.04)]">

            <h2 className="text-2xl font-bold text-[#101811]">
              Business details
            </h2>

            <p className="text-gray-500 mt-2">
              You can refine these details later.
            </p>

            <div className="mt-8">

              <label className="text-sm font-semibold text-gray-700">
                Business name
              </label>

              <input
                value={businessName}
                onChange={(e) =>
                  setBusinessName(
                    e.target.value
                  )
                }
                placeholder="e.g. Temple Coffee"
                className="w-full h-13 border border-gray-200 rounded-xl px-4 mt-2 text-black outline-none focus:border-green-500 focus:ring-4 focus:ring-green-50 transition"
              />

            </div>

            <div className="mt-6">

              <label className="text-sm font-semibold text-gray-700">
                Address
              </label>

              <input
                value={address}
                onChange={(e) =>
                  setAddress(
                    e.target.value
                  )
                }
                placeholder="123 Main Street, Folsom, CA"
                className="w-full h-13 border border-gray-200 rounded-xl px-4 mt-2 text-black outline-none focus:border-green-500 focus:ring-4 focus:ring-green-50 transition"
              />

            </div>

            <div className="mt-6">

              <label className="text-sm font-semibold text-gray-700">
                Business type
              </label>

              <select
                value={businessType}
                onChange={(e) =>
                  setBusinessType(
                    e.target.value
                  )
                }
                className="w-full h-13 border border-gray-200 rounded-xl px-4 mt-2 text-black bg-white outline-none focus:border-green-500 focus:ring-4 focus:ring-green-50 transition"
              >
                <option>Cafe</option>
                <option>Restaurant</option>
              </select>

            </div>

            {message && (
              <div className="bg-red-50 border border-red-100 text-red-600 rounded-xl p-3 text-sm mt-6">
                {message}
              </div>
            )}

            <button
              onClick={createBusiness}
              disabled={loading}
              className="w-full bg-[#101811] hover:bg-black text-white h-13 rounded-xl font-semibold mt-8 transition disabled:opacity-50"
            >
              {loading
                ? "Creating..."
                : "Create Business →"}
            </button>

            <p className="text-xs text-gray-400 text-center mt-4">
              SeatMate automatically creates your
              customer-facing page.
            </p>

          </div>

        </div>

      </div>
    </main>
  );
}

function SetupStep({
  number,
  text,
  active = false,
}: {
  number: string;
  text: string;
  active?: boolean;
}) {
  return (
    <div className="flex items-center gap-4">

      <div
        className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold ${
          active
            ? "bg-green-600 text-white"
            : "bg-white border border-gray-200 text-gray-400"
        }`}
      >
        {number}
      </div>

      <p
        className={
          active
            ? "font-semibold text-[#101811]"
            : "text-gray-400"
        }
      >
        {text}
      </p>

    </div>
  );
}