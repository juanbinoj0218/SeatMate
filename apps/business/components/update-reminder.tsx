"use client";

import { useEffect, useRef, useState } from "react";
import {
  collection,
  doc,
  getDocs,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  Timestamp,
  where,
  writeBatch,
} from "firebase/firestore";

import { getOpenStatus, type Hours } from "@seatmate/shared/business-hours";
import { db } from "@seatmate/shared/firebase";

import { BellIcon } from "@/components/portal-icons";

// Nudge staff when seats haven't been updated for a while during opening
// hours, so customers don't see stale availability. Shows a banner, and a
// browser notification if the person turns reminders on.
export const REMIND_AFTER_MINUTES = 30;

const minutesAgo = (ms: number, now: number) => Math.max(0, Math.round((now - ms) / 60000));

const describeAge = (minutes: number) =>
  minutes >= 120 ? `${Math.floor(minutes / 60)} hours` : `${minutes} min`;

export default function UpdateReminder({ businessId }: { businessId: string }) {
  const [latestMs, setLatestMs] = useState<number | null>(null);
  const [tableIds, setTableIds] = useState<string[]>([]);
  const [hours, setHours] = useState<{ hours?: Hours; timezone?: string }>({});
  const [now, setNow] = useState(() => Date.now());
  // Only rendered after sign-in, so this runs in the browser.
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">(() =>
    typeof window !== "undefined" && "Notification" in window ? Notification.permission : "unsupported"
  );
  const [confirming, setConfirming] = useState(false);
  const notifiedFor = useRef<number | null | undefined>(undefined);

  // Latest seat update across all tables, live.
  useEffect(
    () =>
      onSnapshot(collection(db, "businesses", businessId, "tables"), (snapshot) => {
        let latest: number | null = null;

        snapshot.docs.forEach((tableDoc) => {
          const updatedAt = tableDoc.data().occupancyUpdatedAt;

          if (updatedAt instanceof Timestamp && (latest === null || updatedAt.toMillis() > latest)) {
            latest = updatedAt.toMillis();
          }
        });

        setTableIds(snapshot.docs.map((tableDoc) => tableDoc.id));
        setLatestMs(latest);
      }),
    [businessId]
  );

  // Opening hours from the public listing (readable by owner and staff).
  useEffect(() => {
    getDocs(query(collection(db, "publicBusinesses"), where("businessId", "==", businessId), limit(1)))
      .then((snapshot) => {
        const data = snapshot.docs[0]?.data();
        if (data) setHours({ hours: data.hours, timezone: data.timezone });
      })
      .catch(() => {});
  }, [businessId]);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 30000);
    return () => window.clearInterval(interval);
  }, []);

  // Unknown hours count as open.
  const open = getOpenStatus(hours.hours, hours.timezone, now)?.open ?? true;
  const age = latestMs === null ? null : minutesAgo(latestMs, now);
  const stale = tableIds.length > 0 && open && (age === null || age >= REMIND_AFTER_MINUTES);

  // One browser notification per stale stretch.
  useEffect(() => {
    if (!stale || permission !== "granted" || notifiedFor.current === latestMs) {
      return;
    }

    notifiedFor.current = latestMs;

    try {
      new Notification("SeatMate: time to update seats", {
        body:
          age === null
            ? "Seats haven't been updated yet. Customers are seeing old availability."
            : `No seat updates in ${describeAge(age)}. Customers are seeing old availability.`,
        tag: `seatmate-reminder-${businessId}`,
      });
    } catch {
      // Some mobile browsers only allow notifications from a service worker.
    }
  }, [stale, permission, latestMs, age, businessId]);

  const enableReminders = async () => {
    if (!("Notification" in window)) return;
    setPermission(await Notification.requestPermission());
  };

  // Staff can say "nothing changed" without tapping every seat.
  const confirmAccurate = async () => {
    setConfirming(true);

    try {
      const batch = writeBatch(db);
      tableIds.forEach((tableId) =>
        batch.update(doc(db, "businesses", businessId, "tables", tableId), {
          occupancyUpdatedAt: serverTimestamp(),
        })
      );
      await batch.commit();
    } catch (error) {
      console.error("Could not confirm seats:", error);
    } finally {
      setConfirming(false);
    }
  };

  if (!stale) {
    return permission === "default" && tableIds.length > 0 ? (
      <button
        type="button"
        onClick={enableReminders}
        className="mb-6 inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-600 transition hover:text-[#101811] print:hidden"
      >
        <BellIcon className="w-4 h-4" />
        Remind me when seats need updating
      </button>
    ) : null;
  }

  return (
    <div role="status" className="mb-6 flex flex-col gap-4 rounded-2xl border border-amber-200 bg-amber-50 p-5 sm:flex-row sm:items-center sm:justify-between print:hidden">
      <div className="flex gap-3">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
          <BellIcon className="w-5 h-5" />
        </span>
        <div>
          <p className="font-bold text-amber-900">
            {age === null ? "Seats haven't been updated yet" : `No seat updates in ${describeAge(age)}`}
          </p>
          <p className="mt-0.5 text-sm text-amber-800">
            Customers see this as out of date. Tap any seats that changed, or confirm they&apos;re still right.
          </p>
        </div>
      </div>

      <div className="flex shrink-0 flex-wrap gap-2">
        {permission === "default" && (
          <button
            type="button"
            onClick={enableReminders}
            className="rounded-xl border border-amber-300 bg-white px-4 py-2.5 text-sm font-semibold text-amber-900 transition hover:bg-amber-100"
          >
            Turn on reminders
          </button>
        )}

        <button
          type="button"
          onClick={confirmAccurate}
          disabled={confirming}
          className="rounded-xl bg-[#101811] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-black disabled:opacity-50"
        >
          {confirming ? "Saving…" : "Seats are still accurate"}
        </button>
      </div>
    </div>
  );
}
