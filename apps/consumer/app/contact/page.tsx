"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";

import { db } from "@seatmate/shared/firebase";

import { useAccount } from "@/components/account-provider";
import { FormDone, FormField } from "@/components/form-bits";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { CONTACT_EMAIL } from "@/lib/site-info";
import { useFeatures } from "@/lib/use-features";

const TOPICS = ["General question", "I run a business", "Report a problem", "Press", "Other"];

export default function ContactPage() {
  const { user } = useAccount();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [topic, setTopic] = useState(TOPICS[0]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const { contactForm } = useFeatures();

  const replyTo = email.trim() || user?.email || "";

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");

    if (!/^\S+@\S+\.\S+$/.test(replyTo)) {
      setError("Add an email so we can reply.");
      return;
    }

    if (message.trim().length < 5) {
      setError("Write a short message.");
      return;
    }

    setBusy(true);

    try {
      await addDoc(collection(db, "contactMessages"), {
        name: name.trim().slice(0, 100),
        email: replyTo.slice(0, 200),
        topic,
        message: message.trim().slice(0, 3000),
        uid: user?.uid ?? null,
        status: "new",
        createdAt: serverTimestamp(),
      });
      setDone(true);
    } catch (caught) {
      console.error("Could not send message:", caught);
      setError(`We couldn't send that. You can also email ${CONTACT_EMAIL}.`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen bg-paper text-ink">
      <SiteHeader />

      <section className="mx-auto grid max-w-6xl gap-12 px-5 py-12 sm:px-8 md:py-20 lg:grid-cols-[1fr_480px] lg:gap-20">
        <div>
          <p className="text-sm font-medium text-moss">Contact</p>
          <h1 className="font-display mt-3 text-5xl leading-[1.02] sm:text-6xl">Say hello.</h1>
          <p className="mt-5 max-w-md text-lg text-gray-600">
            Questions, ideas, a place that should be on SeatMate, or something not working — we read
            everything and usually reply within a day or two.
          </p>

          <dl className="mt-10 max-w-md space-y-5 text-sm">
            <div>
              <dt className="font-semibold">Email</dt>
              <dd className="mt-1">
                <a href={`mailto:${CONTACT_EMAIL}`} className="text-gray-600 hover:text-ink">
                  {CONTACT_EMAIL}
                </a>
              </dd>
            </div>
            <div>
              <dt className="font-semibold">Quick answers</dt>
              <dd className="mt-1 text-gray-600">
                Check the <Link href="/faq" className="font-semibold text-ink underline decoration-line underline-offset-4">FAQ</Link> first — it covers most questions.
              </dd>
            </div>
          </dl>
        </div>

        {!contactForm ? (
          <FormDone title="Email us" body={`The contact form is off right now. Write to ${CONTACT_EMAIL} and we'll get back to you.`}>
            <a href={`mailto:${CONTACT_EMAIL}`} className="inline-flex rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-white hover:bg-black">
              Email {CONTACT_EMAIL}
            </a>
          </FormDone>
        ) : done ? (
          <FormDone title="Message sent" body={`Thanks${name.trim() ? `, ${name.trim().split(" ")[0]}` : ""}! We'll reply to ${replyTo}.`} />
        ) : (
          <form onSubmit={submit} className="space-y-5 rounded-3xl border border-line bg-white p-7 sm:p-9">
            <FormField id="contact-name" label="Name (optional)">
              <input id="contact-name" type="text" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} autoComplete="name" className="w-full" />
            </FormField>

            {!user?.email && (
              <FormField id="contact-email" label="Email">
                <input id="contact-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={200} autoComplete="email" placeholder="you@example.com" className="w-full" />
              </FormField>
            )}

            <FormField id="contact-topic" label="Topic">
              <select id="contact-topic" value={topic} onChange={(e) => setTopic(e.target.value)} className="w-full">
                {TOPICS.map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </select>
            </FormField>

            <FormField id="contact-message" label="Message">
              <textarea id="contact-message" value={message} onChange={(e) => setMessage(e.target.value)} maxLength={3000} rows={6} className="w-full" />
            </FormField>

            {error && (
              <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </p>
            )}

            <button type="submit" disabled={busy} className="h-12 w-full rounded-xl bg-ink font-semibold text-white transition hover:bg-black disabled:opacity-60">
              {busy ? "Sending…" : "Send message"}
            </button>
          </form>
        )}
      </section>

      <SiteFooter />
    </main>
  );
}
