"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { PageHeader } from "@/components/admin-shell";
import BarChart from "@/components/bar-chart";
import NudgeButton from "@/components/nudge-button";
import { adminFetch, useAdmin } from "@/lib/admin-session";
import type { DayPoint, Overview } from "@/lib/overview-types";

type Metric = { key: keyof Omit<DayPoint, "day">; label: string; bar: string; unit: string };

const METRICS: Metric[] = [
  { key: "views", label: "Page views", bar: "bg-sky-500", unit: "views" },
  { key: "saves", label: "Saves", bar: "bg-rose-500", unit: "saves" },
  { key: "scans", label: "QR scans", bar: "bg-slate-600", unit: "scans" },
  { key: "updates", label: "Seat updates", bar: "bg-emerald-500", unit: "updates" },
  { key: "customers", label: "New customers", bar: "bg-violet-500", unit: "sign-ups" },
  { key: "businesses", label: "New businesses", bar: "bg-amber-500", unit: "sign-ups" },
];

const STALE_MS = 24 * 60 * 60 * 1000;

const short = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", timeZone: "UTC" });
const dateOf = (day: string) => new Date(`${day}T12:00:00Z`);

const ago = (ms: number, now: number) => {
  const minutes = Math.round((now - ms) / 60000);
  if (minutes < 60) return `${minutes} min ago`;
  if (minutes < 48 * 60) return `${Math.round(minutes / 60)} h ago`;
  return `${Math.round(minutes / 1440)} days ago`;
};

export default function OverviewPage() {
  const user = useAdmin();
  const [range, setRange] = useState(30);
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState("");
  const [metric, setMetric] = useState<Metric>(METRICS[0]);
  const [sortBy, setSortBy] = useState<"views" | "saves" | "scans">("views");

  useEffect(() => {
    let cancelled = false;
    adminFetch<Overview>(user, `/api/admin/overview?days=${range}`)
      .then((result) => {
        if (!cancelled) {
          setData(result);
          setError("");
        }
      })
      .catch((caught: Error) => {
        if (!cancelled) setError(caught.message);
      });
    return () => {
      cancelled = true;
    };
  }, [user, range]);

  const topPlaces = useMemo(
    () => (data ? [...data.places].sort((a, b) => b[sortBy] - a[sortBy] || a.name.localeCompare(b.name)).slice(0, 10) : []),
    [data, sortBy]
  );

  const stale = useMemo(
    () =>
      data
        ? data.places.filter((place) => place.totalSeats > 0 && (place.lastUpdateMs === null || data.generatedAtMs - place.lastUpdateMs > STALE_MS))
        : [],
    [data]
  );

  const noSeats = data ? data.places.filter((place) => place.totalSeats === 0) : [];

  return (
    <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8 lg:py-10">
      <PageHeader title="Overview" description="How SeatMate is doing across every place and customer.">
        <div role="group" aria-label="Date range" className="inline-flex self-start rounded-xl border border-gray-200 bg-white p-1 sm:self-auto">
          {[7, 30, 90].map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setRange(value)}
              aria-pressed={range === value}
              className={`rounded-lg px-3.5 py-2 text-sm font-semibold transition ${range === value ? "bg-[#101811] text-white" : "text-gray-500 hover:text-[#101811]"}`}
            >
              {value} days
            </button>
          ))}
        </div>
      </PageHeader>

      {error && <p role="alert" className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">{error}</p>}

      {/* KPIs */}
      <div className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi label="Customers" value={data?.totals.customers} sub={data ? `+${data.totals.newCustomers} in ${range} days` : ""} tone="bg-violet-100 text-violet-700" />
        <Kpi label="Live places" value={data?.totals.livePlaces} sub={data ? `${data.totals.businesses.pending ?? 0} waiting for approval` : ""} tone="bg-amber-100 text-amber-700" />
        <Kpi
          label="Seats open now"
          value={data?.totals.seatsOpen}
          sub={data ? `of ${data.totals.seatsTotal.toLocaleString()} across all places` : ""}
          tone="bg-emerald-100 text-emerald-700"
        />
        <Kpi label="Page views" value={data?.totals.views} sub={data ? `${data.totals.saves} saves · ${data.totals.scans} QR scans` : ""} tone="bg-sky-100 text-sky-700" />
      </div>

      {/* CHART */}
      <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-semibold">{metric.label} per day</h2>
            <p className="mt-1 text-sm text-gray-500">
              {data ? `${data.days.reduce((total, point) => total + point[metric.key], 0).toLocaleString()} ${metric.unit} in the last ${range} days` : "Loading…"}
            </p>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <span className="text-gray-500">Show</span>
            <select value={metric.key} onChange={(event) => setMetric(METRICS.find((item) => item.key === event.target.value) ?? METRICS[0])} className="!min-h-0 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold">
              {METRICS.map((item) => (
                <option key={item.key} value={item.key}>{item.label}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-6">
          {data ? (
            <BarChart
              barClass={metric.bar}
              labelEvery={range === 7 ? 1 : range === 30 ? 5 : 15}
              bars={data.days.map((point) => ({
                key: point.day,
                value: point[metric.key],
                label: short.format(dateOf(point.day)),
                tooltip: `${short.format(dateOf(point.day))}: ${point[metric.key].toLocaleString()} ${metric.unit}`,
              }))}
            />
          ) : (
            <div className="h-52 animate-pulse rounded-xl bg-gray-50" />
          )}
        </div>
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        {/* TOP PLACES */}
        <section className="rounded-2xl border border-gray-200 bg-white p-6">
          <div className="flex items-center justify-between gap-4">
            <h2 className="font-semibold">Top places</h2>
            <select value={sortBy} onChange={(event) => setSortBy(event.target.value as typeof sortBy)} className="!min-h-0 rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-sm font-semibold">
              <option value="views">By views</option>
              <option value="saves">By saves</option>
              <option value="scans">By QR scans</option>
            </select>
          </div>

          {data && topPlaces.length === 0 ? (
            <p className="mt-6 text-sm text-gray-400">No live places yet.</p>
          ) : (
            <table className="mt-4 w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-gray-400">
                  <th className="py-2 font-semibold">Place</th>
                  <th className="py-2 text-right font-semibold">Views</th>
                  <th className="py-2 text-right font-semibold">Saves</th>
                  <th className="hidden py-2 text-right font-semibold sm:table-cell">Scans</th>
                  <th className="py-2 text-right font-semibold">Seats</th>
                </tr>
              </thead>
              <tbody>
                {topPlaces.map((place) => (
                  <tr key={place.slug} className="border-t border-gray-100">
                    <td className="py-2.5 pr-2">
                      <Link href={`/businesses/${place.businessId}`} className="font-semibold hover:underline">{place.name}</Link>
                      <span className="block text-xs text-gray-400">{place.type}</span>
                    </td>
                    <td className="py-2.5 text-right tabular-nums">{place.views.toLocaleString()}</td>
                    <td className="py-2.5 text-right tabular-nums">{place.saves.toLocaleString()}</td>
                    <td className="hidden py-2.5 text-right tabular-nums sm:table-cell">{place.scans.toLocaleString()}</td>
                    <td className="py-2.5 text-right tabular-nums">
                      {place.totalSeats ? (
                        <span className={place.openSeats > 0 ? "font-semibold text-emerald-700" : "font-semibold text-rose-600"}>
                          {place.openSeats}/{place.totalSeats}
                        </span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        {/* NEEDS ATTENTION */}
        <section className="rounded-2xl border border-gray-200 bg-white p-6">
          <h2 className="font-semibold">Needs attention</h2>

          <ul className="mt-4 space-y-3 text-sm">
            <Attention
              href="/businesses"
              count={data?.pending.length}
              tone="bg-amber-100 text-amber-800"
              label="waiting for approval"
              detail={data?.pending.slice(0, 3).map((item) => item.name).join(", ")}
            />
            <Attention
              href="/inbox"
              count={data ? data.totals.openRequests : undefined}
              tone="bg-rose-100 text-rose-700"
              label="new place requests"
            />
            <Attention href="/inbox" count={data ? data.totals.openMessages : undefined} tone="bg-sky-100 text-sky-700" label="unanswered messages" />
            <Attention count={data ? stale.length : undefined} tone="bg-orange-100 text-orange-700" label="live places with no seat update in 24 h" />
            {data && stale.length > 0 && (
              <li>
                <ul className="ml-11 space-y-2">
                  {stale.slice(0, 6).map((place) => (
                    <li key={place.slug} className="flex items-center justify-between gap-2">
                      <span className="min-w-0">
                        <Link href={`/businesses/${place.businessId}`} className="block truncate font-medium hover:underline">{place.name}</Link>
                        <span className="block text-xs text-gray-400">
                          {place.lastUpdateMs ? `Updated ${ago(place.lastUpdateMs, data.generatedAtMs)}` : "Never updated"}
                          {place.lastNudgedMs ? ` · reminded ${ago(place.lastNudgedMs, data.generatedAtMs)}` : ""}
                        </span>
                      </span>
                      <NudgeButton businessId={place.businessId} />
                    </li>
                  ))}
                </ul>
              </li>
            )}
            <Attention
              count={data ? noSeats.length : undefined}
              tone="bg-gray-100 text-gray-700"
              label="live places with no tables set up"
              detail={noSeats.slice(0, 4).map((place) => place.name).join(", ")}
            />
          </ul>

          {data && (
            <div className="mt-6 grid grid-cols-2 gap-3 border-t border-gray-100 pt-5 text-sm">
              <MiniStat label="Seat alerts waiting" value={data.totals.activeAlerts} />
              <MiniStat label={`Alerts sent (${range}d)`} value={data.totals.alertsSent} />
              <MiniStat label={`Seat updates (${range}d)`} value={data.totals.seatUpdates} />
              <MiniStat label="Suspended places" value={data.totals.businesses.suspended ?? 0} />
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function Kpi({ label, value, sub, tone }: { label: string; value?: number; sub: string; tone: string }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5">
      <div className="flex items-center gap-2">
        <span className={`h-2.5 w-2.5 rounded-full ${tone.split(" ")[0]}`} />
        <p className="text-sm text-gray-500">{label}</p>
      </div>
      <p className="mt-2 text-3xl font-bold tracking-tight tabular-nums">{value === undefined ? "–" : value.toLocaleString()}</p>
      <p className="mt-1 truncate text-xs text-gray-400">{sub}</p>
    </div>
  );
}

function Attention({ count, label, tone, detail, href }: { count?: number; label: string; tone: string; detail?: string; href?: string }) {
  const body = (
    <div className="flex items-start gap-3">
      <span className={`min-w-8 rounded-lg px-2 py-1 text-center text-sm font-bold tabular-nums ${count ? tone : "bg-gray-50 text-gray-400"}`}>{count ?? "–"}</span>
      <div className="min-w-0">
        <p className={count ? "font-semibold" : "text-gray-400"}>{label}</p>
        {count ? detail ? <p className="mt-0.5 truncate text-xs text-gray-500">{detail}</p> : null : null}
      </div>
    </div>
  );

  return <li>{href && count ? <Link href={href} className="block rounded-xl transition hover:bg-gray-50">{body}</Link> : body}</li>;
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-xs text-gray-400">{label}</p>
      <p className="mt-0.5 text-lg font-bold tabular-nums">{value.toLocaleString()}</p>
    </div>
  );
}
