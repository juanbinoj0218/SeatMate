"use client";

import { ArrowLeft, DoorClosed } from "lucide-react";

import { CrowdIcon } from "@seatmate/shared/components/Icons";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, onSnapshot } from "firebase/firestore";

import SeatMateMark from "@seatmate/shared/components/SeatMateMark";
import {
  CROWD_LEVELS,
  crowdLevel,
  type DoorCount,
  doorRef,
  readDoorCount,
  resetDoorCount,
  setBouncerMode,
  stepDoorCount,
  usualCrowd,
} from "@seatmate/shared/door-count";
import { auth, db } from "@seatmate/shared/firebase";

type DoorAccess = {
  businessId: string;
  businessName: string;
  isOwner: boolean;
};

// Bouncer mode: a tablet page for whoever is on the door. +1 when someone
// comes in, -1 when they leave. Customers see the crowd update live.
export default function DoorCounterPage() {
  const router = useRouter();

  const [access, setAccess] = useState<DoorAccess | null>(null);
  const [door, setDoor] = useState<DoorCount | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [confirmReset, setConfirmReset] = useState(false);

  // Owners and staff both use this page.
  useEffect(
    () =>
      onAuthStateChanged(auth, async (currentUser) => {
        if (!currentUser) {
          router.replace("/business/login");
          return;
        }

        try {
          const owned = await getDoc(doc(db, "businesses", currentUser.uid));

          if (owned.exists()) {
            setAccess({
              businessId: owned.id,
              businessName: owned.data().name || "Your bar",
              isOwner: true,
            });
            return;
          }

          const staff = await getDoc(doc(db, "staffUsers", currentUser.uid));

          if (!staff.exists() || staff.data().active !== true) {
            setError("Your account can't use the door counter.");
            setLoading(false);
            return;
          }

          setAccess({
            businessId: staff.data().businessId,
            businessName: staff.data().businessName || "Your bar",
            isOwner: false,
          });
        } catch (loadError) {
          console.error(loadError);
          setError("Could not load your account.");
          setLoading(false);
        }
      }),
    [router]
  );

  useEffect(() => {
    if (!access) {
      return;
    }

    return onSnapshot(
      doorRef(access.businessId),
      (snapshot) => {
        setDoor(readDoorCount(snapshot.data({ serverTimestamps: "estimate" })));
        setLoading(false);
      },
      (snapshotError) => {
        console.error(snapshotError);
        setError("Could not load the door count.");
        setLoading(false);
      }
    );
  }, [access]);

  const step = async (delta: 1 | -1) => {
    if (!access || !door) return;

    try {
      setError("");
      await stepDoorCount(access.businessId, door, delta);
    } catch (stepError) {
      console.error(stepError);
      setError("That tap didn't go through. Try again.");
    }
  };

  const reset = async () => {
    if (!access) return;

    try {
      setError("");
      await resetDoorCount(access.businessId);
      setConfirmReset(false);
    } catch (resetError) {
      console.error(resetError);
      setError("Could not reset the count.");
    }
  };

  const turnOn = async () => {
    if (!access) return;

    try {
      setError("");
      await setBouncerMode(access.businessId, true);
    } catch (toggleError) {
      console.error(toggleError);
      setError("Could not turn on bouncer mode.");
    }
  };

  const backHref = access?.isOwner === false ? "/staff" : "/business";

  if (loading) {
    return (
      <main className="min-h-screen bg-[#101811] flex items-center justify-center">
        <p className="text-white/60">{error || "Loading door counter..."}</p>
      </main>
    );
  }

  const usual = door ? usualCrowd(door) : null;
  const level = door ? crowdLevel(door.count, usual) : null;

  return (
    <main className="min-h-screen bg-[#101811] text-white flex flex-col select-none">
      <header className="border-b border-white/10">
        <div className="max-w-5xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 flex items-center justify-center">
              <SeatMateMark className="h-[85%] w-[85%]" />
            </div>
            <div>
              <p className="font-bold">{access?.businessName}</p>
              <p className="text-xs text-white/45">Door counter</p>
            </div>
          </div>

          <Link
            href={backHref}
            className="rounded-xl border border-white/15 px-4 py-2.5 text-sm font-semibold hover:bg-white/10 transition"
          >
            <ArrowLeft aria-hidden className="mr-1 inline h-4 w-4 align-[-3px]" />
            {access?.isOwner === false ? "Staff console" : "Dashboard"}
          </Link>
        </div>
      </header>

      {!door?.enabled ? (
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-md text-center">
            <DoorClosed aria-hidden className="mx-auto h-12 w-12" strokeWidth={1.6} />
            <h1 className="mt-5 text-3xl font-bold">Bouncer mode is off</h1>
            <p className="mt-3 text-white/60">
              {access?.isOwner
                ? "Turn it on to count people at the door and show customers how busy you are."
                : "Ask the owner to turn on bouncer mode from their dashboard."}
            </p>
            {access?.isOwner && (
              <button
                type="button"
                onClick={() => void turnOn()}
                className="mt-6 rounded-xl bg-green-500 px-6 py-3 font-bold text-[#101811] hover:bg-green-400 transition"
              >
                Turn on bouncer mode
              </button>
            )}
            {error && <p className="mt-4 text-rose-300">{error}</p>}
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col max-w-5xl w-full mx-auto px-6 py-8">
          <div className="text-center">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-green-400">
              Inside right now
            </p>
            <p
              className="mt-2 text-[96px] sm:text-[140px] font-black leading-none tabular-nums"
              aria-live="polite"
            >
              {door.count}
            </p>
            <p className="mt-3 text-sm text-white/55">
              {level ? (
                <>
                  <CrowdIcon level={level} className="mr-1 inline h-4 w-4 align-[-3px]" />
                  Customers see: {CROWD_LEVELS[level].label}
                  {usual !== null && ` (usually about ${Math.round(usual)})`}
                </>
              ) : (
                "Customers see the count. Once you've counted a few nights, they'll also see whether it's quieter or busier than usual."
              )}
            </p>
          </div>

          {error && (
            <p className="mt-4 rounded-xl bg-rose-500/15 px-4 py-3 text-center text-rose-200">
              {error}
            </p>
          )}

          <div className="mt-8 grid flex-1 grid-cols-2 gap-4 min-h-[280px]">
            <button
              type="button"
              onClick={() => void step(-1)}
              disabled={door.count === 0}
              aria-label="Someone left: minus one"
              className="rounded-[28px] bg-white/10 text-6xl sm:text-8xl font-black transition active:scale-[0.97] active:bg-white/20 disabled:opacity-30"
            >
              −1
              <span className="block mt-2 text-base font-semibold text-white/60">Left</span>
            </button>

            <button
              type="button"
              onClick={() => void step(1)}
              aria-label="Someone came in: plus one"
              className="rounded-[28px] bg-green-500 text-[#101811] text-6xl sm:text-8xl font-black transition active:scale-[0.97] active:bg-green-400"
            >
              +1
              <span className="block mt-2 text-base font-semibold text-[#101811]/70">Came in</span>
            </button>
          </div>

          <div className="mt-6 flex items-center justify-center gap-3 text-sm">
            {confirmReset ? (
              <>
                <span className="text-white/60">Set the count back to 0?</span>
                <button
                  type="button"
                  onClick={() => void reset()}
                  className="rounded-xl bg-rose-500 px-4 py-2 font-semibold hover:bg-rose-400 transition"
                >
                  Reset
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmReset(false)}
                  className="rounded-xl border border-white/15 px-4 py-2 font-semibold hover:bg-white/10 transition"
                >
                  Cancel
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmReset(true)}
                className="rounded-xl border border-white/15 px-4 py-2 font-semibold text-white/70 hover:bg-white/10 transition"
              >
                Reset to 0
              </button>
            )}
          </div>

          <p className="mt-4 text-center text-xs text-white/35">
            The count starts over on its own if nobody taps for 8 hours.
          </p>
        </div>
      )}
    </main>
  );
}
