import Link from "next/link";

import { ACTIONS, type LogEntry } from "@/lib/activity-types";

const time = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });
const day = new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric" });

const TONES: Record<LogEntry["targetType"], string> = {
  business: "bg-amber-100 text-amber-800",
  account: "bg-violet-100 text-violet-700",
  admin: "bg-[#101811] text-white",
  settings: "bg-sky-100 text-sky-700",
  inbox: "bg-rose-100 text-rose-700",
};

const isDanger = (action: string) => /delete|suspend|reject|disable|remove/.test(action);

// Log entries grouped by day, newest first.
export default function ActivityList({ entries, compact = false }: { entries: LogEntry[]; compact?: boolean }) {
  const groups = new Map<string, LogEntry[]>();
  entries.forEach((entry) => {
    const key = entry.createdMs ? day.format(entry.createdMs) : "Just now";
    groups.set(key, [...(groups.get(key) ?? []), entry]);
  });

  if (entries.length === 0) {
    return <p className="rounded-2xl border border-dashed border-gray-300 bg-white/60 px-6 py-10 text-center text-sm text-gray-400">No activity yet.</p>;
  }

  return (
    <div className="space-y-6">
      {[...groups.entries()].map(([label, items]) => (
        <section key={label}>
          {!compact && <h2 className="mb-2 text-sm font-semibold text-gray-500">{label}</h2>}
          <ul className="divide-y divide-gray-100 rounded-2xl border border-gray-200 bg-white">
            {items.map((entry) => (
              <li key={entry.id} className="flex items-start gap-3 px-5 py-3.5 text-sm">
                <span className={`mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold capitalize ${TONES[entry.targetType] ?? "bg-gray-100 text-gray-600"}`}>
                  {entry.targetType}
                </span>
                <div className="min-w-0 flex-1">
                  <p>
                    <span className={isDanger(entry.action) ? "font-semibold text-red-700" : "font-semibold"}>
                      {ACTIONS[entry.action] ?? entry.action}
                    </span>{" "}
                    {entry.targetType === "business" && entry.action !== "business.delete" ? (
                      <Link href={`/businesses/${entry.targetId}`} className="font-semibold underline decoration-gray-300 underline-offset-2 hover:decoration-[#101811]">
                        {entry.targetName || entry.targetId}
                      </Link>
                    ) : (
                      <span className="text-gray-700">{entry.targetName}</span>
                    )}
                  </p>
                  {entry.details && <p className="mt-0.5 truncate text-xs text-gray-500">{entry.details}</p>}
                </div>
                <div className="shrink-0 text-right text-xs text-gray-400">
                  <p>{entry.actorEmail}</p>
                  <p>{entry.createdMs ? (compact ? `${day.format(entry.createdMs).split(",").slice(1).join(",").trim()} · ` : "") + time.format(entry.createdMs) : "just now"}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
