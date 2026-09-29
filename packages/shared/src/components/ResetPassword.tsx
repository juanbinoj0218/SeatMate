"use client";

import { FormEvent, useState } from "react";

import { resetSentMessage, sendResetLink } from "../password-reset";

// "Forgot password?" screen: asks for an email and sends a reset link.
export default function ResetPassword({
  initialEmail = "",
  continueUrl,
  onBack,
}: {
  initialEmail?: string;
  // Where the reset email's link sends the person after they pick a new
  // password (usually this sign-in page).
  continueUrl: string;
  onBack: () => void;
}) {
  const [email, setEmail] = useState(initialEmail);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState("");

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");

    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError("Enter the email you sign in with.");
      return;
    }

    setBusy(true);
    try {
      await sendResetLink(email.trim(), continueUrl);
      setSent(resetSentMessage(email.trim()));
    } catch (caught) {
      const code =
        typeof caught === "object" && caught !== null && "code" in caught
          ? String((caught as { code: unknown }).code)
          : "";
      setError(
        code === "auth/invalid-email"
          ? "That email address doesn't look right."
          : code === "auth/too-many-requests"
            ? "Too many requests. Wait a few minutes and try again."
            : "Couldn't send the reset email. Please try again."
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-[#101811]">Reset your password</h2>
        <p className="mt-1 text-sm text-gray-500">
          Enter your email and we&apos;ll send you a link to choose a new password.
        </p>
      </div>

      <div>
        <label htmlFor="reset-email" className="mb-1.5 block text-sm font-semibold">
          Email
        </label>
        <input
          id="reset-email"
          type="email"
          autoComplete="email"
          autoFocus
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
          className="h-12 w-full rounded-xl border border-gray-200 bg-white px-4 text-black"
        />
      </div>

      {error && (
        <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}
      {sent && (
        <p role="status" className="rounded-xl bg-green-50 px-4 py-3 text-sm text-green-800">
          {sent}
        </p>
      )}

      <button
        type="submit"
        disabled={busy}
        className="h-12 w-full rounded-xl bg-[#101811] font-semibold text-white hover:bg-black disabled:opacity-60"
      >
        {busy ? "Sending…" : sent ? "Send again" : "Send reset link"}
      </button>
      <button
        type="button"
        onClick={onBack}
        className="w-full text-sm font-semibold text-gray-500 hover:text-[#101811]"
      >
        ← Back to sign in
      </button>
    </form>
  );
}
