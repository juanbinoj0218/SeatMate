"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

import { PageHeader } from "@/components/admin-shell";
import { adminFetch, useAdmin } from "@/lib/admin-session";
import type { AdminEntry } from "@/lib/people-types";

const when = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" });

export default function AdminsPage() {
  const user = useAdmin();
  const [admins, setAdmins] = useState<AdminEntry[] | null>(null);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(
    () =>
      adminFetch<{ admins: AdminEntry[] }>(user, "/api/admin/admins")
        .then((result) => setAdmins(result.admins))
        .catch((caught: Error) => setError(caught.message)),
    [user]
  );

  useEffect(() => {
    void load();
  }, [load]);

  const add = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await adminFetch(user, "/api/admin/admins", { method: "POST", body: JSON.stringify({ email }) });
      setNotice(`${email.trim()} is now an admin.`);
      setEmail("");
      await load();
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (entry: AdminEntry) => {
    if (!window.confirm(`Remove admin access for ${entry.email}? Their account stays.`)) return;
    setError("");
    setNotice("");
    try {
      await adminFetch(user, `/api/admin/admins/${entry.uid}`, { method: "DELETE" });
      setNotice(`${entry.email} is no longer an admin.`);
      await load();
    } catch (caught) {
      setError((caught as Error).message);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-5 py-8 sm:px-8 lg:py-10">
      <PageHeader title="Admins" description="People who can use this site. They need a SeatMate account first." />

      <form onSubmit={add} className="mt-8 flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-5 sm:flex-row">
        <label htmlFor="new-admin" className="sr-only">Email</label>
        <input id="new-admin" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="teammate@example.com" className="w-full sm:flex-1" />
        <button type="submit" disabled={busy || !email.trim()} className="h-12 rounded-xl bg-[#101811] px-5 font-semibold text-white hover:bg-black disabled:opacity-50">
          {busy ? "Adding…" : "Add admin"}
        </button>
      </form>

      {error && <p role="alert" className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">{error}</p>}
      {notice && <p role="status" className="mt-4 rounded-2xl border border-green-200 bg-green-50 px-5 py-4 text-sm text-green-800">{notice}</p>}

      <ul className="mt-6 divide-y divide-gray-100 rounded-2xl border border-gray-200 bg-white">
        {admins === null ? (
          <li className="px-5 py-8 text-center text-gray-400">Loading…</li>
        ) : (
          admins.map((entry) => (
            <li key={entry.uid} className="flex items-center justify-between gap-4 px-5 py-4">
              <div className="min-w-0">
                <p className="truncate font-semibold">
                  {entry.name || entry.email}
                  {entry.uid === user.uid && <span className="ml-2 rounded bg-gray-100 px-1.5 py-0.5 text-[11px] font-bold text-gray-500">You</span>}
                </p>
                <p className="truncate text-sm text-gray-500">
                  {entry.name ? entry.email : ""}
                  {entry.addedMs ? `${entry.name ? " · " : ""}added ${when.format(entry.addedMs)}${entry.addedBy ? ` by ${entry.addedBy}` : ""}` : ""}
                </p>
              </div>
              {entry.uid !== user.uid && (
                <button type="button" onClick={() => remove(entry)} className="shrink-0 rounded-xl border border-red-200 px-3.5 py-2 text-sm font-semibold text-red-600 hover:bg-red-50">
                  Remove
                </button>
              )}
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
