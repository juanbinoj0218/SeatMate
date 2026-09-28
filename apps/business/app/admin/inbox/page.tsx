"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
  updateDoc,
} from "firebase/firestore";

import SeatMateMark from "@seatmate/shared/components/SeatMateMark";
import { auth, db } from "@seatmate/shared/firebase";

// Admin inbox: "suggest a place" requests (grouped, so the most-wanted
// places float to the top as sales leads) and contact form messages.

type PlaceRequest = {
  id: string;
  placeName: string;
  location: string;
  type: string;
  note: string;
  email: string;
  status: string;
  createdMs: number;
};

type ContactMessage = {
  id: string;
  name: string;
  email: string;
  topic: string;
  message: string;
  status: string;
  createdMs: number;
};

const when = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

const toMs = (value: unknown) => (value instanceof Timestamp ? value.toMillis() : 0);
const key = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

export default function AdminInboxPage() {
  const router = useRouter();
  const [state, setState] = useState<"loading" | "denied" | "ready">("loading");
  const [tab, setTab] = useState<"requests" | "messages">("requests");
  const [requests, setRequests] = useState<PlaceRequest[]>([]);
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [showDone, setShowDone] = useState(false);

  useEffect(() => {
    const stops: (() => void)[] = [];

    const stopAuth = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.replace("/business/login?next=/admin/inbox");
        return;
      }

      const admin = await getDoc(doc(db, "admins", user.uid)).catch(() => null);

      if (!admin?.exists() || admin.data().active !== true) {
        setState("denied");
        return;
      }

      setState("ready");

      stops.push(
        onSnapshot(query(collection(db, "placeRequests"), orderBy("createdAt", "desc"), limit(500)), (snapshot) =>
          setRequests(
            snapshot.docs.map((item) => {
              const data = item.data();
              return {
                id: item.id,
                placeName: String(data.placeName || ""),
                location: String(data.location || ""),
                type: String(data.type || ""),
                note: String(data.note || ""),
                email: String(data.email || ""),
                status: String(data.status || "new"),
                createdMs: toMs(data.createdAt),
              };
            })
          )
        ),
        onSnapshot(query(collection(db, "contactMessages"), orderBy("createdAt", "desc"), limit(200)), (snapshot) =>
          setMessages(
            snapshot.docs.map((item) => {
              const data = item.data();
              return {
                id: item.id,
                name: String(data.name || ""),
                email: String(data.email || ""),
                topic: String(data.topic || ""),
                message: String(data.message || ""),
                status: String(data.status || "new"),
                createdMs: toMs(data.createdAt),
              };
            })
          )
        )
      );
    });

    return () => {
      stopAuth();
      stops.forEach((stop) => stop());
    };
  }, [router]);

  // Group requests for the same place so demand is visible.
  const groups = useMemo(() => {
    const map = new Map<string, PlaceRequest[]>();

    requests
      .filter((request) => showDone || request.status !== "done")
      .forEach((request) => {
        const groupKey = `${key(request.placeName)}|${key(request.location)}`;
        map.set(groupKey, [...(map.get(groupKey) ?? []), request]);
      });

    return [...map.values()].sort((a, b) => b.length - a.length || b[0].createdMs - a[0].createdMs);
  }, [requests, showDone]);

  const visibleMessages = messages.filter((message) => showDone || message.status !== "done");

  const markDone = (collectionName: string, ids: string[], done: boolean) =>
    Promise.all(ids.map((id) => updateDoc(doc(db, collectionName, id), { status: done ? "done" : "new" }))).catch(
      (error) => console.error("Could not update:", error)
    );

  if (state !== "ready") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f7f8f5] p-6 text-gray-500">
        {state === "denied" ? "This area is only for SeatMate administrators." : "Loading inbox…"}
      </main>
    );
  }

  const openRequests = requests.filter((request) => request.status !== "done").length;
  const openMessages = messages.filter((message) => message.status !== "done").length;

  return (
    <main className="min-h-screen bg-[#f7f8f5]">
      <header className="bg-[#101811] text-white">
        <div className="max-w-5xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 flex items-center justify-center">
              <SeatMateMark className="h-[85%] w-[85%]" />
            </div>
            <div>
              <p className="font-bold">SeatMate</p>
              <p className="text-xs text-white/50">Admin Inbox</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => router.push("/admin")}
            className="border border-white/20 px-4 py-2 rounded-xl text-sm font-semibold hover:bg-white/10"
          >
            ← Control Center
          </button>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-10">
        <h1 className="text-4xl font-bold tracking-tight">Inbox</h1>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
          <div role="tablist" className="inline-flex rounded-xl border border-gray-200 bg-white p-1">
            {(
              [
                ["requests", `Place requests (${openRequests})`],
                ["messages", `Messages (${openMessages})`],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                role="tab"
                aria-selected={tab === value}
                type="button"
                onClick={() => setTab(value)}
                className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                  tab === value ? "bg-[#101811] text-white" : "text-gray-500 hover:text-[#101811]"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} />
            Show handled
          </label>
        </div>

        {tab === "requests" ? (
          groups.length === 0 ? (
            <Empty text="No place requests yet." />
          ) : (
            <ul className="mt-6 space-y-3">
              {groups.map((group) => {
                // Newest first: show when it was last asked for, but the
                // name and place as the first person typed them.
                const first = group[0];
                const original = group[group.length - 1];
                const emails = [...new Set(group.map((request) => request.email).filter(Boolean))];
                const notes = group.map((request) => request.note).filter(Boolean);
                const done = group.every((request) => request.status === "done");

                return (
                  <li key={first.id} className={`rounded-2xl border border-gray-200 bg-white p-5 ${done ? "opacity-60" : ""}`}>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-bold text-rose-700">
                            {group.length} {group.length === 1 ? "request" : "requests"}
                          </span>
                          <span className="text-xs text-gray-400">{first.createdMs ? `latest ${when.format(first.createdMs)}` : "just now"}</span>
                        </div>
                        <p className="mt-2 text-lg font-bold">{original.placeName}</p>
                        <p className="text-sm text-gray-500">
                          {original.type} · {original.location}
                        </p>
                        {notes.length > 0 && (
                          <ul className="mt-2 space-y-1 text-sm text-gray-600">
                            {notes.slice(0, 3).map((note, index) => (
                              <li key={index}>&ldquo;{note}&rdquo;</li>
                            ))}
                          </ul>
                        )}
                        {emails.length > 0 && (
                          <p className="mt-2 text-xs text-gray-400">
                            Notify when live: {emails.join(", ")}
                          </p>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => markDone("placeRequests", group.map((request) => request.id), !done)}
                        className="shrink-0 rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold hover:bg-gray-50"
                      >
                        {done ? "Reopen" : "Mark handled"}
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )
        ) : visibleMessages.length === 0 ? (
          <Empty text="No messages yet." />
        ) : (
          <ul className="mt-6 space-y-3">
            {visibleMessages.map((message) => (
              <li key={message.id} className={`rounded-2xl border border-gray-200 bg-white p-5 ${message.status === "done" ? "opacity-60" : ""}`}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-sky-100 px-2.5 py-0.5 text-xs font-bold text-sky-700">{message.topic}</span>
                      <span className="text-xs text-gray-400">{message.createdMs ? when.format(message.createdMs) : "just now"}</span>
                    </div>
                    <p className="mt-2 font-semibold">
                      {message.name || "No name"} <span className="font-normal text-gray-500">· {message.email}</span>
                    </p>
                    <p className="mt-2 whitespace-pre-wrap text-sm text-gray-700">{message.message}</p>
                  </div>

                  <div className="flex shrink-0 gap-2">
                    <a
                      href={`mailto:${message.email}?subject=${encodeURIComponent(`Re: ${message.topic}`)}`}
                      className="rounded-xl bg-[#101811] px-4 py-2 text-sm font-semibold text-white"
                    >
                      Reply
                    </a>
                    <button
                      type="button"
                      onClick={() => markDone("contactMessages", [message.id], message.status !== "done")}
                      className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold hover:bg-gray-50"
                    >
                      {message.status === "done" ? "Reopen" : "Done"}
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <p className="mt-6 rounded-2xl border border-dashed border-gray-300 bg-white/60 px-6 py-12 text-center text-gray-500">
      {text}
    </p>
  );
}
