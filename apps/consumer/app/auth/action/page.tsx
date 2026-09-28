"use client";

import { FormEvent, Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  applyActionCode,
  confirmPasswordReset,
  verifyPasswordResetCode,
} from "firebase/auth";

import { auth } from "@seatmate/shared/firebase";
import { BUSINESS_SITE_URL, CONSUMER_SITE_URL } from "@seatmate/shared/site-urls";

import { SiteHeader } from "@/components/site-chrome";

// Handles the links in Firebase's account emails (password reset, email
// verification). To use it, set Firebase → Authentication → Templates →
// "Customize action URL" to https://seatmate360.com/auth/action.

type State =
  | { step: "checking" }
  | { step: "reset"; email: string }
  | { step: "done"; title: string; body: string }
  | { step: "error"; body: string };

// Only send people on to a SeatMate site after they finish.
function safeContinueUrl(value: string | null) {
  if (!value) {
    return "/login";
  }

  try {
    const url = new URL(value, window.location.origin);
    const allowed = [
      window.location.origin,
      new URL(CONSUMER_SITE_URL).origin,
      new URL(BUSINESS_SITE_URL).origin,
    ];

    return allowed.includes(url.origin) ? url.toString() : "/login";
  } catch {
    return "/login";
  }
}

export default function AuthActionPage() {
  return (
    <Suspense>
      <AuthAction />
    </Suspense>
  );
}

function AuthAction() {
  const params = useSearchParams();
  const mode = params.get("mode");
  const code = params.get("oobCode") || "";
  const rawContinueUrl = params.get("continueUrl");

  const [state, setState] = useState<State>({ step: "checking" });
  const [continueUrl, setContinueUrl] = useState("/login");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setContinueUrl(safeContinueUrl(rawContinueUrl));

      if (!code) {
        setState({ step: "error", body: "This link is incomplete. Request a new one from the sign-in page." });
        return;
      }

      try {
        if (mode === "resetPassword") {
          const email = await verifyPasswordResetCode(auth, code);
          if (!cancelled) setState({ step: "reset", email });
          return;
        }

        if (mode === "verifyEmail" || mode === "recoverEmail") {
          await applyActionCode(auth, code);
          if (!cancelled) {
            setState({
              step: "done",
              title: mode === "verifyEmail" ? "Email verified" : "Email restored",
              body: "You're all set. You can sign in now.",
            });
          }
          return;
        }

        setState({ step: "error", body: "We don't recognize this link." });
      } catch {
        if (!cancelled) {
          setState({
            step: "error",
            body: "This link has expired or was already used. Request a new one from the sign-in page.",
          });
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [mode, code, rawContinueUrl]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");

    if (password.length < 6) {
      setError("Use at least 6 characters.");
      return;
    }

    if (password !== confirm) {
      setError("The passwords don't match.");
      return;
    }

    setBusy(true);

    try {
      await confirmPasswordReset(auth, code, password);
      setState({
        step: "done",
        title: "Password updated",
        body: "Sign in with your new password.",
      });
    } catch {
      setError("This link has expired. Request a new one from the sign-in page.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen bg-paper text-ink">
      <SiteHeader showAccount={false} />

      <section className="mx-auto max-w-md px-5 py-16 sm:py-24">
        <div className="rounded-3xl border border-line bg-white p-7 sm:p-9">
          {state.step === "checking" && (
            <p className="text-gray-500">Checking your link…</p>
          )}

          {state.step === "reset" && (
            <form onSubmit={submit} className="space-y-5">
              <div>
                <h1 className="font-display text-3xl">Choose a new password</h1>
                <p className="mt-2 text-gray-600">For {state.email}</p>
              </div>

              <label className="block">
                <span className="mb-1.5 block text-sm font-medium">New password</span>
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="new-password"
                  placeholder="At least 6 characters"
                  className="w-full"
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-sm font-medium">Confirm password</span>
                <input
                  type="password"
                  value={confirm}
                  onChange={(event) => setConfirm(event.target.value)}
                  autoComplete="new-password"
                  className="w-full"
                />
              </label>

              {error && (
                <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={busy}
                className="h-12 w-full rounded-xl bg-ink font-semibold text-white transition hover:bg-black disabled:opacity-60"
              >
                {busy ? "Saving…" : "Save new password"}
              </button>
            </form>
          )}

          {state.step === "done" && (
            <div>
              <h1 className="font-display text-3xl">{state.title}</h1>
              <p className="mt-2 text-gray-600">{state.body}</p>
              <a
                href={continueUrl}
                className="mt-6 inline-flex h-12 w-full items-center justify-center rounded-xl bg-ink font-semibold text-white transition hover:bg-black"
              >
                Continue to sign in
              </a>
            </div>
          )}

          {state.step === "error" && (
            <div>
              <h1 className="font-display text-3xl">Link not valid</h1>
              <p className="mt-2 text-gray-600">{state.body}</p>
              <a
                href={continueUrl}
                className="mt-6 inline-flex h-12 w-full items-center justify-center rounded-xl border border-line font-semibold transition hover:border-gray-300"
              >
                Back to sign in
              </a>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
