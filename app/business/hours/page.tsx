"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import BackButton from "@/components/BackButton";

import {
  onAuthStateChanged,
  User,
} from "firebase/auth";

import HomeButton from "@/components/HomeButton";
<HomeButton />

import {
  doc,
  getDoc,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";

import { auth, db } from "@/lib/firebase";

type DayHours = {
  closed: boolean;
  open: string;
  close: string;
};

type Hours = {
  monday: DayHours;
  tuesday: DayHours;
  wednesday: DayHours;
  thursday: DayHours;
  friday: DayHours;
  saturday: DayHours;
  sunday: DayHours;
};

const defaultHours: Hours = {
  monday: {
    closed: false,
    open: "07:00",
    close: "18:00",
  },

  tuesday: {
    closed: false,
    open: "07:00",
    close: "18:00",
  },

  wednesday: {
    closed: false,
    open: "07:00",
    close: "18:00",
  },

  thursday: {
    closed: false,
    open: "07:00",
    close: "18:00",
  },

  friday: {
    closed: false,
    open: "07:00",
    close: "18:00",
  },

  saturday: {
    closed: false,
    open: "08:00",
    close: "18:00",
  },

  sunday: {
    closed: false,
    open: "08:00",
    close: "17:00",
  },
};

const days = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

type DayName = (typeof days)[number];

export default function BusinessHoursPage() {
  const router = useRouter();

  const [user, setUser] =
    useState<User | null>(null);

  const [businessName, setBusinessName] =
    useState("");

  const [slug, setSlug] =
    useState("");

  const [hours, setHours] =
    useState<Hours>(defaultHours);

  const [timezone, setTimezone] =
    useState("");

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [message, setMessage] =
    useState("");

  useEffect(() => {
    const unsubscribe =
      onAuthStateChanged(
        auth,
        async (currentUser) => {
          if (!currentUser) {
            router.push(
              "/business/login"
            );

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
              await getDoc(
                businessRef
              );

            if (
              !businessSnap.exists()
            ) {
              router.push(
                "/business/setup"
              );

              return;
            }

            const data =
              businessSnap.data();

            setBusinessName(
              data.name ||
                "Your Business"
            );

            setSlug(
              data.slug || ""
            );

            if (data.hours) {
              setHours(
                data.hours as Hours
              );
            }

            setTimezone(
              data.timezone ||
                Intl.DateTimeFormat()
                  .resolvedOptions()
                  .timeZone ||
                "America/Los_Angeles"
            );
          } catch (error) {
            console.error(error);

            setMessage(
              "Could not load business hours."
            );
          } finally {
            setLoading(false);
          }
        }
      );

    return unsubscribe;
  }, [router]);

  const updateDay = (
    day: DayName,
    field: keyof DayHours,
    value: string | boolean
  ) => {
    setHours((current) => ({
      ...current,

      [day]: {
        ...current[day],
        [field]: value,
      },
    }));
  };

  const saveHours = async () => {
    if (!user || !slug) return;

    try {
      setSaving(true);
      setMessage("");

      const businessRef = doc(
        db,
        "businesses",
        user.uid
      );

      const businessSnap =
        await getDoc(businessRef);

      if (!businessSnap.exists()) {
        setMessage("Business not found.");
        return;
      }

      const businessData =
        businessSnap.data();

      const batch =
        writeBatch(db);

      // Always save hours on the private business document.
      // Draft and pending businesses do not have a public listing yet.
      batch.update(
        businessRef,
        {
          hours,
          timezone,
          hoursUpdatedAt:
            serverTimestamp(),
          updatedAt:
            serverTimestamp(),
        }
      );

      // Once the business is approved, also sync hours
      // to the public document customers read.
      if (
        businessData.status === "approved" &&
        businessData.slug
      ) {
        const publicRef = doc(
          db,
          "publicBusinesses",
          businessData.slug
        );

        const publicSnap =
          await getDoc(publicRef);

        if (publicSnap.exists()) {
          batch.update(
            publicRef,
            {
              hours,
              timezone,
              hoursUpdatedAt:
                serverTimestamp(),
              updatedAt:
                serverTimestamp(),
            }
          );
        }
      }

      await batch.commit();

      setMessage(
        businessData.status === "approved"
          ? "Business hours saved and synced to your customer page."
          : "Business hours saved. They will appear publicly after approval."
      );
    } catch (error) {
      console.error(error);

      setMessage(
        "Could not save business hours."
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f7f8f5] flex items-center justify-center">
        <p className="text-gray-500">
          Loading business hours...
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f7f8f5]">

      <header className="bg-white border-b border-gray-200">

        <div className="max-w-5xl mx-auto px-6 h-20 flex items-center justify-between">

          <div className="flex items-center gap-3">

            <div className="w-10 h-10 bg-green-600 text-white rounded-xl flex items-center justify-center font-bold">
              S
            </div>

            <div>
              <p className="font-bold">
                SeatMate
              </p>

              <p className="text-xs text-gray-400">
                Business Hours
              </p>
            </div>

          </div>

          <BackButton fallback="/business" />

        </div>

      </header>

      <div className="max-w-4xl mx-auto px-6 py-12">

        <p className="text-green-600 font-semibold text-sm">
          {businessName}
        </p>

        <h1 className="text-4xl font-bold text-[#101811] mt-2">
          Business hours
        </h1>

        <p className="text-gray-500 mt-3">
          These hours will be shown to
          customers on SeatMate.
        </p>

        <div className="bg-white border border-gray-200 rounded-3xl p-7 mt-8">

          <div className="space-y-4">

            {days.map((day) => {

              const dayHours =
                hours[day];

              return (
                <div
                  key={day}
                  className="flex flex-col md:flex-row md:items-center gap-4 border-b border-gray-100 pb-4 last:border-0"
                >

                  <div className="w-32">

                    <p className="font-semibold capitalize">
                      {day}
                    </p>

                  </div>

                  <label className="flex items-center gap-2 text-sm">

                    <input
                      type="checkbox"
                      checked={
                        dayHours.closed
                      }
                      onChange={(event) =>
                        updateDay(
                          day,
                          "closed",
                          event.target
                            .checked
                        )
                      }
                    />

                    Closed

                  </label>

                  {!dayHours.closed && (
                    <>

                      <input
                        type="time"
                        value={
                          dayHours.open
                        }
                        onChange={(
                          event
                        ) =>
                          updateDay(
                            day,
                            "open",
                            event.target
                              .value
                          )
                        }
                        className="border border-gray-200 rounded-xl px-4 py-2 text-black"
                      />

                      <span className="text-gray-400">
                        to
                      </span>

                      <input
                        type="time"
                        value={
                          dayHours.close
                        }
                        onChange={(
                          event
                        ) =>
                          updateDay(
                            day,
                            "close",
                            event.target
                              .value
                          )
                        }
                        className="border border-gray-200 rounded-xl px-4 py-2 text-black"
                      />

                    </>
                  )}

                </div>
              );
            })}

          </div>

        </div>

        <div className="bg-white border border-gray-200 rounded-3xl p-7 mt-6">

          <label className="font-semibold">
            Time zone
          </label>

          <p className="text-sm text-gray-500 mt-1">
            SeatMate uses this to calculate
            whether your location is open.
          </p>

          <select
            value={timezone}
            onChange={(event) =>
              setTimezone(
                event.target.value
              )
            }
            className="border border-gray-200 rounded-xl px-4 py-3 mt-4 text-black w-full"
          >

            <option value="America/Los_Angeles">
              Pacific Time
            </option>

            <option value="America/Denver">
              Mountain Time
            </option>

            <option value="America/Chicago">
              Central Time
            </option>

            <option value="America/New_York">
              Eastern Time
            </option>

          </select>

        </div>

        {message && (
          <div className="bg-green-50 border border-green-100 text-green-700 rounded-xl p-4 mt-6">
            {message}
          </div>
        )}

        <button
          onClick={saveHours}
          disabled={saving}
          className="bg-[#101811] hover:bg-black text-white font-semibold px-7 py-3 rounded-xl mt-6 disabled:opacity-50"
        >
          {saving
            ? "Saving..."
            : "Save Business Hours"}
        </button>

      </div>

    </main>
  );
}