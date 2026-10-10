"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, limit, onSnapshot, orderBy, query, Timestamp } from "firebase/firestore";
import { Download, Search } from "lucide-react";

import { db } from "@seatmate/shared/firebase";

import { PageHeader } from "@/components/admin-shell";

// Waitlist signups from the waitlist site: who joined, what they wait at,
// and which spots they want on SeatMate first (sales leads, most asked
// for on top).

type Signup = {
  id: string;
  name: string;
  email: string;
  // Places they'd use SeatMate at. Early signups picked just one.
  venueTypes: string[];
  // How often each place's problem bugs them: often, sometimes or rarely.
  feelings: Record<string, string>;
  spotName: string;
  spotArea: string;
  phone: string;
  createdMs: number;
};

const VENUE_LABELS: Record<string, string> = {
  cafe: "Café",
  restaurant: "Restaurant",
  bar: "Bar",
  barbershop: "Barbershop",
};

const FEELING_LABELS: Record<string, string> = {
  often: "all the time",
  sometimes: "sometimes",
  rarely: "not really",
};

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

const when = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

const toMs = (value: unknown) => (value instanceof Timestamp ? value.toMillis() : 0);
const key = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const venueLabel = (type: string) => VENUE_LABELS[type] ?? type;
const placesLabel = (signup: Signup) =>
  signup.venueTypes
    .map((type) => {
      const feeling = FEELING_LABELS[signup.feelings[type]];
      return feeling ? `${venueLabel(type)} (${feeling})` : venueLabel(type);
    })
    .join(", ");

export default function AdminWaitlistPage() {
  const [state, setState] = useState<"loading" | "error" | "ready">("loading");
  const [signups, setSignups] = useState<Signup[]>([]);
  const [search, setSearch] = useState("");
  // Read once on load, so "this week" doesn't need a clock during render.
  const [loadedAt] = useState(() => Date.now());

  useEffect(
    () =>
      onSnapshot(
        query(collection(db, "waitlist"), orderBy("createdAt", "desc"), limit(5000)),
        (snapshot) => {
          setSignups(
            snapshot.docs.map((item) => {
              const data = item.data();
              return {
                id: item.id,
                name: String(data.name || ""),
                email: String(data.email || item.id),
                venueTypes: Array.isArray(data.venueTypes)
                  ? data.venueTypes.map(String)
                  : data.venueType
                    ? [String(data.venueType)]
                    : [],
                feelings: data.feelings && typeof data.feelings === "object" ? data.feelings : {},
                spotName: String(data.spotName || ""),
                spotArea: String(data.spotArea || ""),
                phone: String(data.phone || ""),
                createdMs: toMs(data.createdAt),
              };
            })
          );
          setState("ready");
        },
        (error) => {
          console.error("Could not load the waitlist:", error);
          setState("error");
        }
      ),
    []
  );

  const stats = useMemo(() => {
    const thisWeek = signups.filter((signup) => signup.createdMs > loadedAt - WEEK_MS).length;
    // Share of all answers that were "all the time".
    const answers = signups.flatMap((signup) => Object.values(signup.feelings));
    const oftenShare = answers.length
      ? Math.round((answers.filter((feeling) => feeling === "often").length / answers.length) * 100)
      : 0;

    const byType = Object.keys(VENUE_LABELS)
      .map((type) => ({ type, count: signups.filter((signup) => signup.venueTypes.includes(type)).length }))
      .sort((a, b) => b.count - a.count);

    // Group the same spot typed slightly differently ("Fresh Cuts" vs
    // "fresh cuts!") so demand adds up.
    const spots = new Map<string, Signup[]>();
    signups
      .filter((signup) => signup.spotName)
      .forEach((signup) => {
        const spotKey = `${key(signup.spotName)}|${key(signup.spotArea)}`;
        spots.set(spotKey, [...(spots.get(spotKey) ?? []), signup]);
      });
    const topSpots = [...spots.values()]
      .sort((a, b) => b.length - a.length || b[0].createdMs - a[0].createdMs)
      .slice(0, 10);

    return { thisWeek, oftenShare, hasAnswers: answers.length > 0, byType, topSpots };
  }, [signups, loadedAt]);

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return signups;
    return signups.filter((signup) =>
      [signup.name, signup.email, signup.phone, signup.spotName, signup.spotArea, placesLabel(signup)]
        .some((value) => value.toLowerCase().includes(needle))
    );
  }, [signups, search]);

  const exportCsv = () => {
    const cell = (value: string | number) => {
      const text = String(value);
      // A leading = + - @ would run as a formula in Excel or Sheets.
      const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
      return `"${safe.replace(/"/g, '""')}"`;
    };
    const rows = [
      ["Name", "Email", "Phone (agreed to texts)", "Places (how often it bugs them)", "Spot to add", "Spot area", "Joined"],
      ...signups.map((signup) => [
        signup.name,
        signup.email,
        signup.phone,
        placesLabel(signup),
        signup.spotName,
        signup.spotArea,
        signup.createdMs ? new Date(signup.createdMs).toISOString() : "",
      ]),
    ];
    const blob = new Blob([rows.map((row) => row.map(cell).join(",")).join("\n")], { type: "text/csv" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `seatmate-waitlist-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  if (state !== "ready") {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-6 text-gray-500">
        {state === "error"
          ? "Couldn't load the waitlist. Check that the latest Firestore rules are deployed, then refresh."
          : "Loading waitlist…"}
      </div>
    );
  }

  const topCount = Math.max(1, ...stats.byType.map((row) => row.count));

  return (
    <div className="mx-auto max-w-5xl px-5 py-10 sm:px-8">
      <PageHeader title="Waitlist" description="People waiting for SeatMate to open near them.">
        <button
          type="button"
          onClick={exportCsv}
          disabled={signups.length === 0}
          className="inline-flex items-center gap-2 self-start rounded-xl bg-[#101811] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50 sm:self-auto"
        >
          <Download aria-hidden className="h-4 w-4" />
          Export CSV
        </button>
      </PageHeader>

      <dl className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Signups" value={signups.length.toLocaleString()} />
        <Stat label="This week" value={stats.thisWeek.toLocaleString()} />
        <Stat label="Bugs them all the time" value={stats.hasAnswers ? `${stats.oftenShare}%` : "–"} />
        <Stat label="Most common" value={signups.length ? venueLabel(stats.byType[0].type) : "–"} />
      </dl>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <section className="rounded-2xl border border-gray-200 bg-white p-5">
          <h2 className="font-bold">Most asked-for spots</h2>
          {stats.topSpots.length === 0 ? (
            <p className="mt-3 text-sm text-gray-500">Nobody has named a spot yet.</p>
          ) : (
            <ol className="mt-3 divide-y divide-gray-100">
              {stats.topSpots.map((group) => {
                const original = group[group.length - 1];
                return (
                  <li key={original.id} className="flex items-center justify-between gap-4 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{original.spotName}</p>
                      <p className="truncate text-sm text-gray-500">
                        {original.spotArea || "No area given"}
                      </p>
                    </div>
                    <span className="shrink-0 tabular-nums text-sm font-semibold">
                      {group.length} {group.length === 1 ? "vote" : "votes"}
                    </span>
                  </li>
                );
              })}
            </ol>
          )}
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-5">
          <h2 className="font-bold">Where they&rsquo;d use it</h2>
          <ul className="mt-4 space-y-3">
            {stats.byType.map((row) => (
              <li key={row.type}>
                <div className="flex justify-between text-sm">
                  <span>{venueLabel(row.type)}</span>
                  <span className="tabular-nums text-gray-500">{row.count}</span>
                </div>
                <div className="mt-1 h-2 rounded-full bg-gray-100">
                  <div className="h-2 rounded-full bg-emerald-500" style={{ width: `${(row.count / topCount) * 100}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="mt-6 rounded-2xl border border-gray-200 bg-white">
        <div className="flex flex-col gap-3 border-b border-gray-100 p-5 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="font-bold">Everyone on the list</h2>
          <label className="relative block sm:w-72">
            <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search name, email, phone or spot"
              aria-label="Search the waitlist"
              className="w-full !pl-9"
            />
          </label>
        </div>

        {visible.length === 0 ? (
          <p className="px-5 py-12 text-center text-gray-500">
            {signups.length === 0 ? "No signups yet." : "Nobody matches that search."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-gray-400">
                <tr>
                  <th className="px-5 py-3 font-semibold">Name</th>
                  <th className="px-5 py-3 font-semibold">Places</th>
                  <th className="px-5 py-3 font-semibold">Spot to add</th>
                  <th className="px-5 py-3 font-semibold">Joined</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {visible.map((signup) => (
                  <tr key={signup.id}>
                    <td className="px-5 py-3">
                      <p className="font-semibold">{signup.name}</p>
                      <a href={`mailto:${signup.email}`} className="text-gray-500 hover:text-[#101811]">
                        {signup.email}
                      </a>
                      {signup.phone && (
                        <a href={`sms:${signup.phone}`} className="block text-gray-500 hover:text-[#101811]">
                          {signup.phone}
                        </a>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      {signup.venueTypes.map((type) => (
                        <p key={type}>
                          {venueLabel(type)}
                          {FEELING_LABELS[signup.feelings[type]] && (
                            <span className="text-gray-500"> · {FEELING_LABELS[signup.feelings[type]]}</span>
                          )}
                        </p>
                      ))}
                    </td>
                    <td className="px-5 py-3">
                      {signup.spotName ? (
                        <>
                          <p>{signup.spotName}</p>
                          {signup.spotArea && <p className="text-gray-500">{signup.spotArea}</p>}
                        </>
                      ) : (
                        <span className="text-gray-400">None</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-5 py-3 text-gray-500">
                      {signup.createdMs ? when.format(signup.createdMs) : "just now"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5">
      <dt className="text-sm text-gray-500">{label}</dt>
      <dd className="mt-1 text-2xl font-bold tabular-nums">{value}</dd>
    </div>
  );
}
