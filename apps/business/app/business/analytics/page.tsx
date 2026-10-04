"use client";

import { useEffect, useMemo, useState } from "react";
import { doc, getDoc } from "firebase/firestore";

import { dayKey } from "@seatmate/shared/analytics";
import { db } from "@seatmate/shared/firebase";

import PortalHeader from "@/components/portal-header";
import {
  EyeIcon,
  HeartIcon,
  QrIcon,
  SeatIcon,
} from "@/components/portal-icons";
import { useOwnedBusiness } from "@/lib/use-business";

type Range = 7 | 30;

type Day = {
  key: string;
  date: Date;
  views: number;
  saves: number;
  scans: number;
  updates: number;
  // Per hour of day: summed % taken and number of samples.
  occ: number[];
  samples: number[];
};

const dayLabel = new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric" });
const shortDay = new Intl.DateTimeFormat(undefined, { month: "numeric", day: "numeric" });

const hourLabel = (hour: number) =>
  `${hour % 12 === 0 ? 12 : hour % 12}${hour < 12 ? "a" : "p"}`;

const hourLong = (hour: number) =>
  `${hour % 12 === 0 ? 12 : hour % 12} ${hour < 12 ? "AM" : "PM"}`;

const toNumber = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : 0);

export default function AnalyticsPage() {
  const { business, loading, error } = useOwnedBusiness();
  const [range, setRange] = useState<Range>(7);
  const [days, setDays] = useState<Day[] | null>(null);

  const businessId = business?.id;
  const slug = business?.slug;

  useEffect(() => {
    if (!businessId) {
      return;
    }

    let cancelled = false;

    const dates = Array.from({ length: 30 }, (_, index) => {
      const date = new Date();
      date.setHours(12, 0, 0, 0);
      date.setDate(date.getDate() - (29 - index));
      return date;
    });

    Promise.all(
      dates.map(async (date) => {
        const key = dayKey(date);
        const [placeStats, seatStats] = await Promise.all([
          slug ? getDoc(doc(db, "publicBusinesses", slug, "stats", key)).catch(() => null) : null,
          getDoc(doc(db, "businesses", businessId, "stats", key)).catch(() => null),
        ]);

        const place = placeStats?.data() ?? {};
        const seats = seatStats?.data() ?? {};

        return {
          key,
          date,
          views: toNumber(place.views),
          saves: toNumber(place.saves),
          scans: toNumber(place.scans),
          updates: toNumber(seats.updates),
          occ: Array.from({ length: 24 }, (_, hour) => toNumber(seats[`occ_${hour}`])),
          samples: Array.from({ length: 24 }, (_, hour) => toNumber(seats[`n_${hour}`])),
        };
      })
    ).then((result) => {
      if (!cancelled) setDays(result);
    });

    return () => {
      cancelled = true;
    };
  }, [businessId, slug]);

  const shown = useMemo(() => (days ? days.slice(-range) : []), [days, range]);

  const totals = useMemo(
    () =>
      shown.reduce(
        (sum, day) => ({
          views: sum.views + day.views,
          saves: sum.saves + day.saves,
          scans: sum.scans + day.scans,
          updates: sum.updates + day.updates,
        }),
        { views: 0, saves: 0, scans: 0, updates: 0 }
      ),
    [shown]
  );

  // Average % of seats taken for each hour that has data.
  const hours = useMemo(() => {
    const occ = Array(24).fill(0);
    const samples = Array(24).fill(0);

    shown.forEach((day) => {
      day.occ.forEach((value, hour) => (occ[hour] += value));
      day.samples.forEach((value, hour) => (samples[hour] += value));
    });

    const withData = samples
      .map((count, hour) => (count > 0 ? { hour, pct: Math.round(occ[hour] / count) } : null))
      .filter((value): value is { hour: number; pct: number } => value !== null);

    if (withData.length === 0) {
      return [];
    }

    // Show a continuous run of hours from the first to the last with data.
    const first = withData[0].hour;
    const last = withData[withData.length - 1].hour;

    return Array.from({ length: last - first + 1 }, (_, index) => {
      const hour = first + index;
      return { hour, pct: withData.find((item) => item.hour === hour)?.pct ?? null };
    });
  }, [shown]);

  const peak = hours.reduce<{ hour: number; pct: number } | null>(
    (best, item) => (item.pct !== null && (!best || item.pct > best.pct) ? { hour: item.hour, pct: item.pct } : best),
    null
  );

  if (loading || !business) {
    return (
      <main className="min-h-screen bg-[#f7f8f5]">
        <PortalHeader section="Analytics" />
        <p className="max-w-4xl mx-auto px-5 sm:px-8 py-12 text-gray-500">{error || "Loading analytics…"}</p>
      </main>
    );
  }

  const live = business.status === "approved" && Boolean(business.slug);

  return (
    <main className="min-h-screen bg-[#f7f8f5]">
      <PortalHeader section="Analytics" />

      <div className="max-w-4xl mx-auto px-5 sm:px-8 py-12">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-4xl font-bold tracking-tight">{business.name}</h1>
          </div>

          <div role="group" aria-label="Date range" className="inline-flex self-start rounded-xl bg-white border border-gray-200 p-1 sm:self-auto">
            {([7, 30] as Range[]).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setRange(value)}
                aria-pressed={range === value}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${
                  range === value ? "bg-[#101811] text-white" : "text-gray-500 hover:text-[#101811]"
                }`}
              >
                Last {value} days
              </button>
            ))}
          </div>
        </div>

        {!live && (
          <p className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">
            Page views and saves start counting once your business is approved and live on SeatMate.
          </p>
        )}

        <div className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatTile label="Page views" value={totals.views} Icon={EyeIcon} loading={!days} />
          <StatTile label="Saves" value={totals.saves} Icon={HeartIcon} loading={!days} />
          <StatTile label="QR scans" value={totals.scans} Icon={QrIcon} loading={!days} />
          <StatTile label="Seat updates" value={totals.updates} Icon={SeatIcon} loading={!days} />
        </div>

        <section className="mt-6 bg-white border border-gray-200 rounded-2xl p-6">
          <h2 className="font-semibold">Page views per day</h2>
          <p className="text-sm text-gray-500 mt-1">
            How many people opened your SeatMate page.
          </p>

          {days && totals.views === 0 ? (
            <EmptyChart text="No page views yet in this period." />
          ) : (
            <BarChart
              bars={shown.map((day) => ({
                key: day.key,
                value: day.views,
                label: range === 7 ? dayLabel.format(day.date).split(",")[0] : shortDay.format(day.date),
                tooltip: `${dayLabel.format(day.date)}: ${day.views} view${day.views === 1 ? "" : "s"}`,
              }))}
              labelEvery={range === 7 ? 1 : 5}
              barClass="bg-sky-500"
              format={(value) => String(value)}
            />
          )}
        </section>

        <section className="mt-6 bg-white border border-gray-200 rounded-2xl p-6">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
            <div>
              <h2 className="font-semibold">Busiest hours</h2>
              <p className="text-sm text-gray-500 mt-1">
                Average share of seats taken, from your staff&apos;s seat updates.
              </p>
            </div>

            {peak && (
              <p className="text-sm font-semibold text-emerald-700">
                Busiest around {hourLong(peak.hour)} · {peak.pct}% full
              </p>
            )}
          </div>

          {days && hours.length === 0 ? (
            <EmptyChart text="Update seats on your floor plan and your busiest hours will show up here." />
          ) : (
            <BarChart
              bars={hours.map((item) => ({
                key: String(item.hour),
                value: item.pct ?? 0,
                missing: item.pct === null,
                label: hourLabel(item.hour),
                tooltip:
                  item.pct === null
                    ? `${hourLong(item.hour)}: no updates`
                    : `${hourLong(item.hour)}: ${item.pct}% of seats taken`,
              }))}
              max={100}
              labelEvery={hours.length > 12 ? 2 : 1}
              barClass="bg-emerald-500"
              format={(value) => `${value}%`}
            />
          )}
        </section>

        <p className="mt-6 text-xs text-gray-400">
          Views count once per visitor session. Hours use the local time of whoever updated the seats.
        </p>
      </div>
    </main>
  );
}

function StatTile({
  label,
  value,
  Icon,
  loading,
}: {
  label: string;
  value: number;
  Icon: (props: { className?: string }) => React.ReactNode;
  loading: boolean;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-4 sm:p-5 flex items-center gap-3 sm:gap-4">
      <span className="w-11 h-11 shrink-0 rounded-xl flex items-center justify-center bg-gray-100 text-[#101811]">
        <Icon className="w-5 h-5" />
      </span>
      <div>
        <p className="text-sm text-gray-500 whitespace-nowrap">{label}</p>
        <p className="text-2xl font-bold tracking-tight tabular-nums">{loading ? "–" : value.toLocaleString()}</p>
      </div>
    </div>
  );
}

function EmptyChart({ text }: { text: string }) {
  return (
    <div className="mt-6 flex h-40 items-center justify-center rounded-xl border border-dashed border-gray-200 px-6 text-center text-sm text-gray-400">
      {text}
    </div>
  );
}

type Bar = {
  key: string;
  value: number;
  label: string;
  tooltip: string;
  missing?: boolean;
};

// Simple vertical bar chart: one series, hover or focus a bar for its value.
function BarChart({
  bars,
  max,
  labelEvery,
  barClass,
  format,
}: {
  bars: Bar[];
  max?: number;
  labelEvery: number;
  barClass: string;
  format: (value: number) => string;
}) {
  const top = max ?? Math.max(1, ...bars.map((bar) => bar.value));
  const niceTop = max ?? Math.max(4, Math.ceil(top / 4) * 4);

  return (
    <div className="mt-6">
      <div className="relative h-44">
        {/* Gridlines */}
        {[0, 0.5, 1].map((fraction) => (
          <div
            key={fraction}
            className="absolute inset-x-0 border-t border-gray-100"
            style={{ bottom: `${fraction * 100}%` }}
          >
            <span className="absolute -top-2.5 right-0 bg-white pl-1 text-[11px] text-gray-400 tabular-nums">
              {format(Math.round(niceTop * fraction))}
            </span>
          </div>
        ))}

        <div className="absolute inset-0 right-9 flex items-end gap-[2px]">
          {bars.map((bar) => (
            <div key={bar.key} className="group relative flex h-full flex-1 items-end justify-center">
              <div
                tabIndex={0}
                aria-label={bar.tooltip}
                className={`w-full max-w-10 rounded-t-[4px] outline-none transition-opacity group-hover:opacity-80 focus-visible:ring-2 focus-visible:ring-[#101811] ${
                  bar.missing ? "bg-gray-100" : barClass
                }`}
                style={{ height: bar.missing ? "3px" : `${Math.max(bar.value > 0 ? 3 : 1, (bar.value / niceTop) * 100)}%` }}
              />
              <span className="pointer-events-none absolute bottom-full z-10 mb-2 hidden whitespace-nowrap rounded-lg bg-[#101811] px-2.5 py-1.5 text-xs font-medium text-white shadow-lg group-hover:block group-focus-within:block">
                {bar.tooltip}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="mr-9 mt-2 flex gap-[2px]" aria-hidden="true">
        {bars.map((bar, index) => (
          <span key={bar.key} className="flex-1 text-center text-[11px] text-gray-400 tabular-nums">
            {index % labelEvery === 0 ? bar.label : ""}
          </span>
        ))}
      </div>

      <details className="mt-4 text-sm">
        <summary className="cursor-pointer text-gray-500 hover:text-[#101811]">View as table</summary>
        <table className="mt-3 w-full text-left">
          <tbody>
            {bars.map((bar) => (
              <tr key={bar.key} className="border-t border-gray-100">
                <td className="py-1.5 text-gray-500">{bar.tooltip.split(":")[0]}</td>
                <td className="py-1.5 text-right tabular-nums">{bar.missing ? "No data" : format(bar.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
