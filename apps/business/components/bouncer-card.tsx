"use client";

import { ArrowRight } from "lucide-react";

import { useEffect, useState } from "react";
import Link from "next/link";
import { onSnapshot } from "firebase/firestore";

import {
  type DoorCount,
  doorRef,
  readDoorCount,
  setBouncerMode,
} from "@seatmate/shared/door-count";

// Dashboard card for bars: turn bouncer mode on or off and open the door
// counter.
export default function BouncerCard({ businessId }: { businessId: string }) {
  const [door, setDoor] = useState<DoorCount | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(
    () =>
      onSnapshot(
        doorRef(businessId),
        (snapshot) => setDoor(readDoorCount(snapshot.data({ serverTimestamps: "estimate" }))),
        (snapshotError) => console.error(snapshotError)
      ),
    [businessId]
  );

  const enabled = door?.enabled === true;

  const toggle = async () => {
    try {
      setSaving(true);
      setError("");
      await setBouncerMode(businessId, !enabled);
    } catch (toggleError) {
      console.error(toggleError);
      setError("Could not change bouncer mode.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-6 bg-white border border-gray-200 rounded-2xl p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-bold">Bouncer mode</p>
          <p className="text-sm text-gray-500 mt-1 max-w-md">
            Count people at the door from a tablet. Customers see how busy you are
            compared with a normal night.
          </p>
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label="Bouncer mode"
          disabled={!door || saving}
          onClick={() => void toggle()}
          className={`relative h-7 w-12 shrink-0 rounded-full transition disabled:opacity-50 ${
            enabled ? "bg-emerald-500" : "bg-gray-300"
          }`}
        >
          <span
            className={`absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${
              enabled ? "translate-x-5" : ""
            }`}
          />
        </button>
      </div>

      {enabled && door && (
        <div className="mt-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-t border-gray-100 pt-5">
          <p className="text-3xl font-bold tracking-tight">
            {door.count}
            <span className="text-gray-400 text-xl font-semibold"> inside</span>
          </p>

          <Link
            href="/business/door"
            className="shrink-0 bg-[#101811] text-white px-5 py-3 rounded-xl font-semibold text-center"
          >
            Open door counter
            <ArrowRight aria-hidden className="ml-1 inline h-4 w-4 align-[-3px]" />
          </Link>
        </div>
      )}

      {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}
    </div>
  );
}
