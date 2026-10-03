"use client";

import { useEffect, useState } from "react";
import { onSnapshot } from "firebase/firestore";

import { CrowdIcon } from "@seatmate/shared/components/Icons";

import {
  CROWD_LEVELS,
  crowdLevel,
  DOOR_STALE_MS,
  doorRef,
  readDoorCount,
  usualCrowd,
} from "@seatmate/shared/door-count";

// How busy a bar is right now, from the bouncer's door count. Shown only
// while the bar has bouncer mode on and is open.
export default function CrowdMeter({ businessId, now }: { businessId: string; now: number }) {
  const [data, setData] = useState<Record<string, unknown> | undefined>();

  useEffect(
    () =>
      onSnapshot(
        doorRef(businessId),
        (snapshot) => setData(snapshot.data({ serverTimestamps: "estimate" })),
        (error) => console.error("Could not load the crowd count:", error)
      ),
    [businessId]
  );

  // Read against the ticking clock so last night's count drops off on its own.
  const door = data ? readDoorCount(data, now) : null;

  if (!door?.enabled || door.updatedAtMs === null || now - door.updatedAtMs > DOOR_STALE_MS) {
    return null;
  }

  const usual = usualCrowd(door, now);
  const level = crowdLevel(door.count, usual);
  const info = level ? CROWD_LEVELS[level] : null;

  return (
    <div className={`mt-5 rounded-2xl px-4 py-3 ring-1 ${info?.className ?? "bg-white/5 text-white ring-white/10"}`}>
      <div className="flex items-center gap-3">
        <CrowdIcon
          level={level}
          className={`h-8 w-8 shrink-0 text-white ${level === "busy" ? "animate-bounce" : ""}`}
          strokeWidth={1.8}
        />
        <div>
          <p className="font-black text-white">
            {info?.label ?? "Crowd right now"}
            <span className="font-semibold text-white/60"> · {door.count} inside</span>
          </p>
          <p className="text-xs text-white/60">
            {info
              ? `${info.detail} Usually about ${Math.round(usual ?? 0)} people.`
              : "Counted live at the door."}
          </p>
        </div>
      </div>
    </div>
  );
}
