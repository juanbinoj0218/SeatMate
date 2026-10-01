"use client";

import { FormEvent, Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";

import { db } from "@seatmate/shared/firebase";
import { businessUrl } from "@seatmate/shared/site-urls";

import { useAccount } from "@/components/account-provider";
import { FormDone, FormField } from "@/components/form-bits";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { useFeatures } from "@/lib/use-features";

const TYPES = ["Café", "Restaurant", "Bar", "Barbershop", "Bakery", "Other"];

export default function SuggestPage() {
  return (
    <main className="min-h-screen bg-paper text-ink">
      <SiteHeader />
      <section className="mx-auto grid max-w-6xl gap-12 px-5 py-12 sm:px-8 md:py-20 lg:grid-cols-[1fr_480px] lg:gap-20">
        <div>
          <p className="text-sm font-medium text-moss">Suggest a place</p>
          <h1 className="font-display mt-3 text-5xl leading-[1.02] sm:text-6xl">
            Want live seats at your go-to spot?
          </h1>
          <p className="mt-5 max-w-md text-lg text-gray-600">
            Tell us where. We reach out to places people ask for most, and let them know
            customers are waiting.
          </p>

          <div className="mt-10 max-w-md rounded-2xl border border-line bg-white p-5">
            <p className="font-semibold">Own or run the place?</p>
            <p className="mt-1 text-sm text-gray-600">
              You can set it up yourself in a few minutes, free.
            </p>
            <a
              href={businessUrl("/business/login")}
              className="mt-3 inline-block text-sm font-semibold text-moss hover:underline"
            >
              Create a business account →
            </a>
          </div>
        </div>

        <Suspense>
          <SuggestForm />
        </Suspense>
      </section>
      <SiteFooter />
    </main>
  );
}

function SuggestForm() {
  const params = useSearchParams();
  const { user } = useAccount();

  const [placeName, setPlaceName] = useState(params.get("name") || "");
  const [location, setLocation] = useState(params.get("location") || "");
  const [type, setType] = useState("Café");
  const [note, setNote] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const { suggestPlace } = useFeatures();

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");

    if (!placeName.trim() || !location.trim()) {
      setError("Add the place's name and where it is.");
      return;
    }

    setBusy(true);

    try {
      await addDoc(collection(db, "placeRequests"), {
        placeName: placeName.trim().slice(0, 120),
        location: location.trim().slice(0, 160),
        type,
        note: note.trim().slice(0, 500),
        email: (email.trim() || user?.email || "").slice(0, 200),
        uid: user?.uid ?? null,
        status: "new",
        createdAt: serverTimestamp(),
      });
      setDone(true);
    } catch (caught) {
      console.error("Could not send suggestion:", caught);
      setError("We couldn't send that. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  if (!suggestPlace) {
    return (
      <FormDone
        title="Suggestions are paused"
        body="We're not taking new place suggestions right now. Check back soon, or browse the places already on SeatMate."
      >
        <Link href="/search" className="rounded-full border border-line px-4 py-2 text-sm font-semibold transition hover:border-gray-300">
          Browse places
        </Link>
      </FormDone>
    );
  }

  if (done) {
    return (
      <FormDone
        title="Thanks, noted!"
        body={`We'll let ${placeName.trim()} know people want live seats there.`}
      >
        <button
          type="button"
          onClick={() => {
            setDone(false);
            setPlaceName("");
            setLocation("");
            setNote("");
          }}
          className="rounded-full border border-line px-4 py-2 text-sm font-semibold transition hover:border-gray-300"
        >
          Suggest another place
        </button>
      </FormDone>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-5 rounded-3xl border border-line bg-white p-7 sm:p-9">
      <FormField id="suggest-name" label="Place name">
        <input id="suggest-name" type="text" value={placeName} onChange={(e) => setPlaceName(e.target.value)} maxLength={120} placeholder="e.g. Blue Door Café" className="w-full" />
      </FormField>

      <FormField id="suggest-location" label="Where is it?" hint="Street, neighborhood or city is enough.">
        <input id="suggest-location" type="text" value={location} onChange={(e) => setLocation(e.target.value)} maxLength={160} placeholder="e.g. J St, Midtown" className="w-full" />
      </FormField>

      <FormField id="suggest-type" label="Type">
        <select id="suggest-type" value={type} onChange={(e) => setType(e.target.value)} className="w-full">
          {TYPES.map((option) => (
            <option key={option}>{option}</option>
          ))}
        </select>
      </FormField>

      <FormField id="suggest-note" label="Anything else? (optional)">
        <textarea id="suggest-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} rows={3} placeholder="e.g. Always packed at lunch" className="w-full" />
      </FormField>

      {!user && (
        <FormField id="suggest-email" label="Your email (optional)" hint="We'll tell you when it's live on SeatMate.">
          <input id="suggest-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={200} autoComplete="email" placeholder="you@example.com" className="w-full" />
        </FormField>
      )}

      {error && (
        <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <button type="submit" disabled={busy} className="h-12 w-full rounded-xl bg-ink font-semibold text-white transition hover:bg-black disabled:opacity-60">
        {busy ? "Sending…" : "Send suggestion"}
      </button>

      <p className="text-center text-xs text-gray-400">
        See our <Link href="/privacy" className="underline">privacy policy</Link>.
      </p>
    </form>
  );
}
