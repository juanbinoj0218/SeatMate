"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { PageHeader } from "@/components/admin-shell";
import { adminFetch, useAdmin } from "@/lib/admin-session";
import type { Person, Role } from "@/lib/people-types";

const when = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" });

const ROLE_STYLES: Record<Role, string> = {
  admin: "bg-[#101811] text-white",
  owner: "bg-amber-100 text-amber-800",
  staff: "bg-sky-100 text-sky-700",
  customer: "bg-gray-100 text-gray-600",
};

const FILTERS: { value: "all" | Role | "disabled"; label: string }[] = [
  { value: "all", label: "Everyone" },
  { value: "customer", label: "Customers" },
  { value: "owner", label: "Business owners" },
  { value: "staff", label: "Staff" },
  { value: "admin", label: "Admins" },
  { value: "disabled", label: "Disabled" },
];

export default function CustomersPage() {
  const user = useAdmin();
  const [people, setPeople] = useState<Person[] | null>(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["value"]>("all");
  const [busyId, setBusyId] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(
    () =>
      adminFetch<{ people: Person[] }>(user, "/api/admin/customers")
        .then((result) => setPeople(result.people))
        .catch((caught: Error) => setError(caught.message)),
    [user]
  );

  useEffect(() => {
    void load();
  }, [load]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (people ?? []).filter((person) => {
      if (filter === "disabled" ? !person.disabled : filter !== "all" && !person.roles.includes(filter)) return false;
      return !q || [person.email, person.name, person.businessName, person.homeZip].some((field) => field.toLowerCase().includes(q));
    });
  }, [people, query, filter]);

  const act = async (person: Person, action: "disable" | "enable" | "resetLink") => {
    setBusyId(person.uid);
    setNotice("");
    setError("");

    try {
      const result = await adminFetch<{ link?: string }>(user, `/api/admin/customers/${person.uid}`, {
        method: "POST",
        body: JSON.stringify({ action }),
      });

      if (action === "resetLink" && result.link) {
        await navigator.clipboard.writeText(result.link).catch(() => window.prompt("Password reset link:", result.link));
        setNotice(`Password reset link for ${person.email} copied. Send it to them directly.`);
      } else {
        setNotice(`${person.email || person.uid} ${action === "disable" ? "can no longer sign in" : "can sign in again"}.`);
        await load();
      }
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setBusyId("");
    }
  };

  const counts = useMemo(() => {
    const all = people ?? [];
    return {
      all: all.length,
      customer: all.filter((person) => person.roles.includes("customer")).length,
      owner: all.filter((person) => person.roles.includes("owner")).length,
      staff: all.filter((person) => person.roles.includes("staff")).length,
      admin: all.filter((person) => person.roles.includes("admin")).length,
      disabled: all.filter((person) => person.disabled).length,
    };
  }, [people]);

  return (
    <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8 lg:py-10">
      <PageHeader title="Customers" description="Every SeatMate account: customers, business owners, staff and admins." />

      <div className="mt-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
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
              {item.label} <span className="opacity-60">{people ? counts[item.value] : ""}</span>
            </button>
          ))}
        </div>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search email, name, business or ZIP"
          aria-label="Search accounts"
          className="w-full lg:w-80"
        />
      </div>

      {error && <p role="alert" className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">{error}</p>}
      {notice && <p role="status" className="mt-5 rounded-2xl border border-green-200 bg-green-50 px-5 py-4 text-sm text-green-800">{notice}</p>}

      <div className="mt-5 overflow-x-auto rounded-2xl border border-gray-200 bg-white">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-left text-xs uppercase tracking-wider text-gray-400">
              <th className="px-5 py-3 font-semibold">Account</th>
              <th className="px-3 py-3 font-semibold">Role</th>
              <th className="px-3 py-3 font-semibold">Joined</th>
              <th className="px-3 py-3 font-semibold">Last sign-in</th>
              <th className="px-3 py-3 text-right font-semibold">Saved</th>
              <th className="px-5 py-3 text-right font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {people === null && !error ? (
              <tr><td colSpan={6} className="px-5 py-10 text-center text-gray-400">Loading accounts…</td></tr>
            ) : shown.length === 0 ? (
              <tr><td colSpan={6} className="px-5 py-10 text-center text-gray-400">No accounts match.</td></tr>
            ) : (
              shown.map((person) => (
                <tr key={person.uid} className={`border-t border-gray-100 ${person.disabled ? "bg-gray-50 text-gray-400" : ""}`}>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-100 text-sm font-bold text-gray-600">
                        {(person.name || person.email || "?").charAt(0).toUpperCase()}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-semibold">
                          {person.name || person.email || person.uid}
                          {person.disabled && <span className="ml-2 rounded bg-red-100 px-1.5 py-0.5 text-[11px] font-bold text-red-700">Disabled</span>}
                        </p>
                        <p className="truncate text-xs text-gray-400">
                          {person.name ? person.email : ""}
                          {person.providers.includes("google.com") ? " · Google" : ""}
                          {person.homeZip ? ` · ZIP ${person.homeZip}` : ""}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap gap-1">
                      {person.roles.map((role) => (
                        <span key={role} className={`rounded-full px-2 py-0.5 text-[11px] font-bold capitalize ${ROLE_STYLES[role]}`}>{role}</span>
                      ))}
                    </div>
                    {person.businessName && <p className="mt-1 truncate text-xs text-gray-400">{person.businessName}</p>}
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap">{person.createdMs ? when.format(person.createdMs) : "—"}</td>
                  <td className="px-3 py-3 whitespace-nowrap">{person.lastSignInMs ? when.format(person.lastSignInMs) : "—"}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{person.savedCount}</td>
                  <td className="px-5 py-3 text-right whitespace-nowrap">
                    <button
                      type="button"
                      disabled={busyId === person.uid || !person.email}
                      onClick={() => act(person, "resetLink")}
                      className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-100 disabled:opacity-40"
                    >
                      Reset link
                    </button>
                    {person.uid !== user.uid && (
                      <button
                        type="button"
                        disabled={busyId === person.uid}
                        onClick={() => {
                          if (person.disabled || window.confirm(`Disable ${person.email || "this account"}? They'll be signed out and can't sign back in.`)) {
                            void act(person, person.disabled ? "enable" : "disable");
                          }
                        }}
                        className={`ml-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold disabled:opacity-40 ${
                          person.disabled ? "text-emerald-700 hover:bg-emerald-50" : "text-red-600 hover:bg-red-50"
                        }`}
                      >
                        {person.disabled ? "Enable" : "Disable"}
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
