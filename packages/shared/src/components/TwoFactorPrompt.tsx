"use client";

import { FormEvent, useState } from "react";
import type { MultiFactorResolver, UserCredential } from "firebase/auth";

import { finishTwoFactorSignIn, twoFactorMessage } from "../two-factor";

// Second sign-in step: asks for the code from the person's authenticator app.
export default function TwoFactorPrompt({
  resolver,
  onSignedIn,
  onCancel,
}: {
  resolver: MultiFactorResolver;
  onSignedIn: (credential: UserCredential) => void | Promise<void>;
  onCancel: () => void;
}) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");

    if (!/^\d{6}$/.test(code.trim())) {
      setError("Enter the 6-digit code from your authenticator app.");
      return;
    }

    setBusy(true);
    try {
      await onSignedIn(await finishTwoFactorSignIn(resolver, code));
    } catch (caught) {
      setError(twoFactorMessage(caught));
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-[#101811]">Enter your code</h2>
        <p className="mt-1 text-sm text-gray-500">
          Open your authenticator app and type the 6-digit code for SeatMate.
        </p>
      </div>

      <div>
        <label htmlFor="two-factor-signin-code" className="mb-1.5 block text-sm font-semibold">
          Code
        </label>
        <input
          id="two-factor-signin-code"
          inputMode="numeric"
          autoComplete="one-time-code"
          autoFocus
          maxLength={6}
          value={code}
          onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
          placeholder="123456"
          className="h-12 w-full rounded-xl border border-gray-200 bg-white px-4 text-center font-mono text-xl tracking-[0.4em] text-black"
        />
      </div>

      {error && (
        <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={busy}
        className="h-12 w-full rounded-xl bg-[#101811] font-semibold text-white hover:bg-black disabled:opacity-60"
      >
        {busy ? "Checking…" : "Verify and sign in"}
      </button>
      <button
        type="button"
        onClick={onCancel}
        className="w-full text-sm font-semibold text-gray-500 hover:text-[#101811]"
      >
        Use a different account
      </button>
    </form>
  );
}
