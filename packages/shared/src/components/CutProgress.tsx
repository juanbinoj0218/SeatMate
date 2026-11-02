"use client";

import { Timer } from "lucide-react";
import { useEffect, useState } from "react";

import {
  type Barber,
  chairProgress,
  PROGRESS_STOPS,
  progressTextColor,
  progressLabel,
  usualLabel,
} from "../barbers";
import { elapsed, type TableSeat } from "../table-geometry";

const GRADIENT = `linear-gradient(90deg, ${PROGRESS_STOPS.join(", ")})`;

// How far along the cut in a barber chair is: a ticking timer, "about 6 min
// left" and a bar that fills from red through orange and yellow to green as
// the cut nears its usual length. Green and full while the chair is open.
// Used on the customer place page and the business barbers page.
export default function CutProgress({
  seat,
  barber,
  className = "",
}: {
  seat: TableSeat | undefined;
  barber?: Pick<Barber, "cutMinutes"> | null;
  className?: string;
}) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const progress = chairProgress(seat, barber, now);
  const cutting = progress.state === "cutting";
  const fraction = cutting ? Math.max(0.03, progress.fraction) : 1;
  const percent = Math.round((cutting ? progress.fraction : 1) * 100);

  return (
    <div className={className}>
      <div className="flex items-baseline justify-between gap-3">
        <p className="inline-flex items-center gap-1.5 text-sm font-bold text-[#101811]">
          {progress.state === "open" ? (
            <>
              <span aria-hidden className="h-2 w-2 rounded-full bg-green-500" />
              Chair open
            </>
          ) : (
            <>
              <Timer aria-hidden className="h-4 w-4 text-gray-400" />
              <span>In the chair</span>
              {cutting && seat?.occupiedSince !== undefined && (
                <span className="tabular-nums">{elapsed(seat.occupiedSince, Math.max(now, seat.occupiedSince))}</span>
              )}
            </>
          )}
        </p>
        <p className="text-sm font-semibold tabular-nums" style={{ color: cutting ? progressTextColor(progress.fraction) : "#15803d" }}>
          {progressLabel(progress)}
        </p>
      </div>

      <div
        className="mt-2.5 h-2.5 overflow-hidden rounded-full bg-gray-100"
        role="progressbar"
        aria-label="How far along the current cut is"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-valuetext={progressLabel(progress)}
      >
        {progress.state === "taken" ? null : cutting ? (
          <div className="h-full overflow-hidden rounded-full transition-[width] duration-1000 ease-linear" style={{ width: `${fraction * 100}%` }}>
            {/* The whole red-to-green gradient, revealed as the cut goes on. */}
            <div className="h-full" style={{ width: `${100 / fraction}%`, backgroundImage: GRADIENT }} />
          </div>
        ) : (
          <div className="h-full w-full rounded-full bg-green-500" />
        )}
      </div>

      {cutting && <p className="mt-2 text-xs text-gray-500">{usualLabel(progress)}</p>}
    </div>
  );
}

