"use client";

import { useEffect, useState } from "react";
import {
  deleteDoc,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  Timestamp,
} from "firebase/firestore";

import { db } from "@seatmate/shared/firebase";
import {
  SEAT_ALERT_TTL_MS,
  SEAT_ALERTS,
  seatAlertId,
} from "@seatmate/shared/seat-alerts";

import { useAccount } from "@/components/account-provider";
import { useFeatures } from "@/lib/use-features";

// "Email me when a seat opens" on a full place.
export default function SeatAlertButton({
  slug,
  businessId,
  placeName,
}: {
  slug: string;
  businessId: string;
  placeName: string;
}) {
  const { user, goToSignIn } = useAccount();
  const { seatAlerts } = useFeatures();
  const [active, setActive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const alertRef = user ? doc(db, SEAT_ALERTS, seatAlertId(user.uid, slug)) : null;
  const alertPath = alertRef?.path;

  useEffect(() => {
    if (!alertPath) {
      return;
    }

    let cancelled = false;

    getDoc(doc(db, alertPath))
      .then((snapshot) => {
        const data = snapshot.data();
        const createdAt = data?.createdAt;
        const fresh =
          createdAt instanceof Timestamp &&
          Date.now() - createdAt.toMillis() < SEAT_ALERT_TTL_MS;

        if (!cancelled) {
          setActive(Boolean(data?.active) && fresh);
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [alertPath]);

  const toggle = async () => {
    if (!user || !alertRef) {
      goToSignIn();
      return;
    }

    setBusy(true);
    setError("");

    try {
      if (active) {
        await deleteDoc(alertRef);
        setActive(false);
      } else {
        await setDoc(alertRef, {
          uid: user.uid,
          email: user.email || "",
          slug,
          businessId,
          placeName,
          active: true,
          createdAt: serverTimestamp(),
        });
        setActive(true);
      }
    } catch (caught) {
      console.error("Could not update seat alert:", caught);
      setError("Couldn't set the alert. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  if (!seatAlerts) {
    return null;
  }

  // Treat a signed-out visitor as not subscribed.
  const on = Boolean(user) && active;

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={toggle}
        disabled={busy}
        aria-pressed={on}
        className={`flex w-full items-center justify-center gap-2 rounded-2xl px-5 py-3.5 font-bold transition disabled:opacity-60 ${
          on
            ? "bg-white/10 text-white ring-1 ring-white/25 hover:bg-white/15"
            : "bg-white text-[#101811] hover:bg-green-50"
        }`}
      >
        <BellIcon className="h-[18px] w-[18px]" filled={on} />
        {on ? "We'll email you when a seat opens" : "Email me when a seat opens"}
      </button>

      {on && (
        <p className="mt-2 text-center text-xs text-white/70">
          For the next 12 hours.{" "}
          <button type="button" onClick={toggle} className="underline underline-offset-2 hover:text-white">
            Cancel
          </button>
        </p>
      )}

      {error && (
        <p role="alert" className="mt-2 text-center text-xs text-red-300">
          {error}
        </p>
      )}
    </div>
  );
}

function BellIcon({ className, filled = false }: { className?: string; filled?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M6 9a6 6 0 1 1 12 0c0 5 2 6.5 2 6.5H4S6 14 6 9" />
      <path d="M10 19a2 2 0 0 0 4 0" />
    </svg>
  );
}
