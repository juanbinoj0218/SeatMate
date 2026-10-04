"use client";

import { ArrowLeft, ArrowUpRight } from "lucide-react";

import Link from "next/link";
import { useParams } from "next/navigation";
import { FormEvent, useCallback, useEffect, useState } from "react";

import { consumerUrl } from "@seatmate/shared/site-urls";

import ActivityList from "@/components/activity-list";
import BarChart from "@/components/bar-chart";
import NudgeButton from "@/components/nudge-button";
import { adminFetch, useAdmin } from "@/lib/admin-session";
import type { LogEntry } from "@/lib/activity-types";
import { BUSINESS_TYPES, type BusinessDay, type BusinessDetail } from "@/lib/business-types";

const date = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" });
const short = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", timeZone: "UTC" });
const STALE_MS = 24 * 60 * 60 * 1000;

const STATUS: Record<string, string> = {
  approved: "bg-emerald-100 text-emerald-800",
  pending: "bg-amber-100 text-amber-800",
  draft: "bg-gray-100 text-gray-600",
  suspended: "bg-rose-100 text-rose-700",
  rejected: "bg-gray-100 text-gray-600",
};

const METRICS: { key: keyof Omit<BusinessDay, "day">; label: string; bar: string }[] = [
  { key: "views", label: "Page views", bar: "bg-sky-500" },
  { key: "saves", label: "Saves", bar: "bg-rose-500" },
  { key: "scans", label: "QR scans", bar: "bg-slate-600" },
  { key: "updates", label: "Seat updates", bar: "bg-emerald-500" },
];

const ago = (ms: number, now: number) => {
  const minutes = Math.round((now - ms) / 60000);
  if (minutes < 60) return `${minutes} min ago`;
  if (minutes < 48 * 60) return `${Math.round(minutes / 60)} h ago`;
  return `${Math.round(minutes / 1440)} days ago`;
};

const hourLabel = (hour: number) => `${hour % 12 === 0 ? 12 : hour % 12}${hour < 12 ? "a" : "p"}`;

export default function BusinessDetailPage() {
  const user = useAdmin();
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<BusinessDetail | null>(null);
  const [activity, setActivity] = useState<LogEntry[] | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [metric, setMetric] = useState(METRICS[0]);

  const load = useCallback(() => {
    adminFetch<BusinessDetail>(user, `/api/admin/businesses/${id}`)
      .then(setData)
      .catch((caught: Error) => setError(caught.message));
    adminFetch<{ entries: LogEntry[] }>(user, `/api/admin/activity?targetId=${id}`)
      .then((result) => setActivity(result.entries))
      .catch(() => setActivity([]));
  }, [user, id]);

  useEffect(() => {
    load();
  }, [load]);

  const flash = (message: string) => {
    setNotice(message);
    setError("");
    load();
  };

  if (!data) {
    return (
      <div className="mx-auto max-w-6xl px-5 py-10 sm:px-8">
        <Link href="/businesses" className="text-sm font-semibold text-gray-500 hover:text-[#101811]"><ArrowLeft aria-hidden className="mr-1 inline h-4 w-4 align-[-3px]" />Businesses</Link>
        {error ? <p role="alert" className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">{error}</p> : <p className="mt-6 text-gray-400">Loading…</p>}
      </div>
    );
  }

  const now = data.generatedAtMs;
  const stale = data.seats.total > 0 && (data.seats.lastUpdateMs === null || now - data.seats.lastUpdateMs > STALE_MS);
  const total = (key: keyof Omit<BusinessDay, "day">) => data.days.reduce((sum, point) => sum + point[key], 0);
  const peak = data.hourly.reduce<{ hour: number; pct: number } | null>(
    (best, item) => (item.pct !== null && (!best || item.pct > best.pct) ? { hour: item.hour, pct: item.pct } : best),
    null
  );

  return (
    <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8 lg:py-10">
      <Link href="/businesses" className="text-sm font-semibold text-gray-500 hover:text-[#101811]"><ArrowLeft aria-hidden className="mr-1 inline h-4 w-4 align-[-3px]" />Businesses</Link>

      <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{data.name}</h1>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold capitalize ${STATUS[data.status] ?? STATUS.draft}`}>{data.status}</span>
          </div>
          <p className="mt-1 text-gray-500">
            {data.type} · {data.address}
          </p>
          <p className="mt-1 text-xs text-gray-400">
            Joined {data.createdMs ? date.format(data.createdMs) : "date unknown"}
            {data.reviewedMs ? ` · reviewed ${date.format(data.reviewedMs)}` : ""} · ID {data.id}
          </p>
        </div>
        {data.isPublic && (
          <a href={consumerUrl(`/place/${data.slug}`)} target="_blank" rel="noreferrer" className="self-start rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold hover:bg-gray-50 sm:self-auto">
            View customer page
            <ArrowUpRight aria-hidden className="ml-0.5 inline h-4 w-4 align-[-3px]" />
          </a>
        )}
      </div>

      {error && <p role="alert" className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">{error}</p>}
      {notice && <p role="status" className="mt-5 rounded-2xl border border-green-200 bg-green-50 px-5 py-4 text-sm text-green-800">{notice}</p>}

      {/* KPIs */}
      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Tile label="Seats open now" value={data.seats.total ? `${data.seats.open} / ${data.seats.total}` : "None"} sub={`${data.seats.tables} tables`} />
        <div className={`rounded-2xl border p-5 ${stale ? "border-orange-200 bg-orange-50" : "border-gray-200 bg-white"}`}>
          <p className="text-sm text-gray-500">Last seat update</p>
          <p className={`mt-2 text-2xl font-bold tracking-tight ${stale ? "text-orange-800" : ""}`}>
            {data.seats.lastUpdateMs ? ago(data.seats.lastUpdateMs, now) : "Never"}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {stale && <NudgeButton businessId={data.id} onSent={flash} />}
            {data.lastNudgedMs && <span className="text-xs text-gray-400">Reminded {ago(data.lastNudgedMs, now)}</span>}
          </div>
        </div>
        <Tile label="Saved by" value={String(data.savedBy)} sub={`${data.activeAlerts} waiting on a seat alert`} />
        <Tile label="Page views (30d)" value={total("views").toLocaleString()} sub={`${total("saves")} saves · ${total("scans")} QR scans`} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-6">
          {/* DAILY CHART */}
          <section className="rounded-2xl border border-gray-200 bg-white p-6">
            <div className="flex items-center justify-between gap-4">
              <h2 className="font-semibold">{metric.label}, last 30 days</h2>
              <select
                value={metric.key}
                onChange={(event) => setMetric(METRICS.find((item) => item.key === event.target.value) ?? METRICS[0])}
                className="!min-h-0 rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-sm font-semibold"
              >
                {METRICS.map((item) => (
                  <option key={item.key} value={item.key}>{item.label}</option>
                ))}
              </select>
            </div>
            <div className="mt-6">
              <BarChart
                barClass={metric.bar}
                labelEvery={5}
                bars={data.days.map((point) => ({
                  key: point.day,
                  value: point[metric.key],
                  label: short.format(new Date(`${point.day}T12:00:00Z`)),
                  tooltip: `${short.format(new Date(`${point.day}T12:00:00Z`))}: ${point[metric.key]}`,
                }))}
              />
            </div>
          </section>

          {/* BUSIEST HOURS */}
          <section className="rounded-2xl border border-gray-200 bg-white p-6">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-semibold">Busiest hours</h2>
              {peak && <p className="text-sm font-semibold text-emerald-700">Peak around {hourLabel(peak.hour)} · {peak.pct}% full</p>}
            </div>
            <div className="mt-6">
              {data.hourly.length === 0 ? (
                <p className="rounded-xl border border-dashed border-gray-200 px-6 py-10 text-center text-sm text-gray-400">No seat updates in the last 30 days.</p>
              ) : (
                <BarChart
                  barClass="bg-emerald-500"
                  labelEvery={data.hourly.length > 12 ? 2 : 1}
                  bars={data.hourly.map((item) => ({
                    key: String(item.hour),
                    value: item.pct ?? 0,
                    label: hourLabel(item.hour),
                    tooltip: item.pct === null ? `${hourLabel(item.hour)}: no updates` : `${hourLabel(item.hour)}: ${item.pct}% of seats taken`,
                  }))}
                />
              )}
            </div>
          </section>

          {/* ACTIVITY */}
          <section>
            <h2 className="mb-3 font-semibold">Admin activity</h2>
            {activity === null ? <p className="text-sm text-gray-400">Loading…</p> : <ActivityList entries={activity} compact />}
          </section>
        </div>

        <div className="space-y-6">
          <EditForm data={data} onSaved={flash} onError={setError} />
          <PhotoCard data={data} onChanged={flash} onError={setError} />

          {/* PEOPLE */}
          <section className="rounded-2xl border border-gray-200 bg-white p-6">
            <h2 className="font-semibold">People</h2>
            <div className="mt-4 text-sm">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Owner</p>
              {data.owner ? (
                <p className="mt-1">
                  <span className="font-semibold">{data.owner.name || data.owner.email}</span>
                  {data.owner.name && <span className="block text-gray-500">{data.owner.email}</span>}
                  <span className="block text-xs text-gray-400">
                    Last sign-in {data.owner.lastSignInMs ? date.format(data.owner.lastSignInMs) : "never"}
                    {data.owner.disabled ? " · account disabled" : ""}
                  </span>
                </p>
              ) : (
                <p className="mt-1 text-gray-400">Owner account not found.</p>
              )}

              <p className="mt-5 text-xs font-semibold uppercase tracking-wider text-gray-400">Staff ({data.staff.length})</p>
              {data.staff.length === 0 ? (
                <p className="mt-1 text-gray-400">No staff yet.</p>
              ) : (
                <ul className="mt-1 space-y-1.5">
                  {data.staff.map((member) => (
                    <li key={member.uid} className={member.active ? "" : "text-gray-400"}>
                      <span className="font-medium">{member.name || member.email || member.uid}</span>
                      {member.name && member.email && <span className="text-gray-500"> · {member.email}</span>}
                      {!member.active && <span className="text-xs"> (inactive)</span>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function Tile({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="mt-2 text-2xl font-bold tracking-tight tabular-nums">{value}</p>
      <p className="mt-1 truncate text-xs text-gray-400">{sub}</p>
    </div>
  );
}

function EditForm({ data, onSaved, onError }: { data: BusinessDetail; onSaved: (message: string) => void; onError: (message: string) => void }) {
  const user = useAdmin();
  const [form, setForm] = useState({ name: data.name, type: data.type, address: data.address, zipcode: data.zipcode, googlePlaceId: data.googlePlaceId, slug: data.slug });
  const [busy, setBusy] = useState(false);

  const changed = (Object.keys(form) as (keyof typeof form)[]).some((key) => form[key] !== data[key]);

  const save = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      await adminFetch(user, `/api/admin/businesses/${data.id}`, { method: "PATCH", body: JSON.stringify(form) });
      onSaved(data.isPublic ? "Saved. The customer page is updated too." : "Saved.");
    } catch (caught) {
      onError((caught as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const field = (key: keyof typeof form, label: string, extra: Record<string, string> = {}) => (
    <div>
      <label htmlFor={`edit-${key}`} className="mb-1 block text-xs font-semibold text-gray-500">{label}</label>
      <input id={`edit-${key}`} type="text" value={form[key]} onChange={(event) => setForm({ ...form, [key]: event.target.value })} className="w-full" {...extra} />
    </div>
  );

  const types = BUSINESS_TYPES.includes(form.type) ? BUSINESS_TYPES : [form.type, ...BUSINESS_TYPES];

  return (
    <form onSubmit={save} className="space-y-3 rounded-2xl border border-gray-200 bg-white p-6">
      <h2 className="font-semibold">Details</h2>
      {field("name", "Name")}
      <div>
        <label htmlFor="edit-type" className="mb-1 block text-xs font-semibold text-gray-500">Type</label>
        <select id="edit-type" value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })} className="w-full">
          {types.map((type) => (
            <option key={type} value={type}>{type === "Cafe" ? "Café" : type}</option>
          ))}
        </select>
      </div>
      {field("address", "Address")}
      {field("zipcode", "ZIP code", { inputMode: "numeric" })}
      {field("googlePlaceId", "Google Place ID (for reviews)", { placeholder: "ChIJ…" })}
      {data.isPublic ? null : field("slug", "Page address (seatmate360.com/place/…)", { placeholder: "joes-bar" })}
      <button type="submit" disabled={!changed || busy} className="h-11 w-full rounded-xl bg-[#101811] font-semibold text-white hover:bg-black disabled:opacity-40">
        {busy ? "Saving…" : "Save changes"}
      </button>
      <p className="text-xs text-gray-400">Changes are recorded in Activity.</p>
    </form>
  );
}

function PhotoCard({ data, onChanged, onError }: { data: BusinessDetail; onChanged: (message: string) => void; onError: (message: string) => void }) {
  const user = useAdmin();
  const [busy, setBusy] = useState(false);

  const remove = async () => {
    if (!window.confirm(`Remove ${data.name}'s cover photo? Their page will use a stock photo.`)) return;
    setBusy(true);
    try {
      await adminFetch(user, `/api/admin/businesses/${data.id}/photo`, { method: "DELETE" });
      onChanged("Cover photo removed.");
    } catch (caught) {
      onError((caught as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-6">
      <h2 className="font-semibold">Cover photo</h2>
      {data.imageUrl ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={data.imageUrl.startsWith("/") ? consumerUrl(data.imageUrl) : data.imageUrl} alt={`${data.name} cover photo`} className="mt-3 aspect-[3/2] w-full rounded-xl object-cover" />
          <button type="button" onClick={remove} disabled={busy} className="mt-3 rounded-xl border border-red-200 px-3.5 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50">
            {busy ? "Removing…" : "Remove photo"}
          </button>
        </>
      ) : (
        <p className="mt-2 text-sm text-gray-400">No photo uploaded. Their page uses a stock photo.</p>
      )}
    </section>
  );
}
