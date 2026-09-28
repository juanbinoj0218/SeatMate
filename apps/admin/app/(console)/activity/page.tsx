"use client";

import { useEffect, useMemo, useState } from "react";

import ActivityList from "@/components/activity-list";
import { PageHeader } from "@/components/admin-shell";
import { adminFetch, useAdmin } from "@/lib/admin-session";
import type { LogEntry } from "@/lib/activity-types";

const FILTERS: { value: "all" | LogEntry["targetType"]; label: string }[] = [
  { value: "all", label: "Everything" },
  { value: "business", label: "Businesses" },
  { value: "account", label: "Accounts" },
  { value: "admin", label: "Admins" },
  { value: "settings", label: "Settings" },
  { value: "inbox", label: "Inbox" },
];

export default function ActivityPage() {
  const user = useAdmin();
  const [entries, setEntries] = useState<LogEntry[] | null>(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["value"]>("all");
  const [query, setQuery] = useState("");

  useEffect(() => {
    adminFetch<{ entries: LogEntry[] }>(user, "/api/admin/activity")
      .then((result) => setEntries(result.entries))
      .catch((caught: Error) => setError(caught.message));
  }, [user]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (entries ?? []).filter(
      (entry) =>
        (filter === "all" || entry.targetType === filter) &&
        (!q || [entry.targetName, entry.actorEmail, entry.details, entry.action].some((field) => field.toLowerCase().includes(q)))
    );
  }, [entries, filter, query]);

  return (
    <div className="mx-auto max-w-4xl px-5 py-8 sm:px-8 lg:py-10">
      <PageHeader title="Activity" description="Everything admins have done, newest first." />

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => setFilter(item.value)}
              aria-pressed={filter === item.value}
              className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition ${
                filter === item.value ? "bg-[#101811] text-white" : "border border-gray-200 bg-white text-gray-600 hover:text-[#101811]"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
        <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search" aria-label="Search activity" className="w-full sm:w-64" />
      </div>

      {error && <p role="alert" className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">{error}</p>}

      <div className="mt-6">{entries === null && !error ? <p className="text-gray-400">Loading…</p> : <ActivityList entries={shown} />}</div>
    </div>
  );
}
