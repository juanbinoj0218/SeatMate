"use client";

import { FormEvent, Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  GoogleAuthProvider,
  type MultiFactorResolver,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  updateProfile,
} from "firebase/auth";

import { auth } from "@seatmate/shared/firebase";
import SeatMateMark from "@seatmate/shared/components/SeatMateMark";
import ResetPassword from "@seatmate/shared/components/ResetPassword";
import TwoFactorPrompt from "@seatmate/shared/components/TwoFactorPrompt";
import { safeNextPath } from "@seatmate/shared/safe-next";
import { twoFactorResolver } from "@seatmate/shared/two-factor";

import { useAccount } from "@/components/account-provider";
import { HeartIcon } from "@/components/account-menu";
import { SiteHeader } from "@/components/site-chrome";

type Mode = "signin" | "signup";

const safeNext = (value: string | null) => safeNextPath(value, "/account");

const errorMessage = (error: unknown) => {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String((error as { code: unknown }).code)
      : "";

  switch (code) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "Incorrect email or password.";
    case "auth/email-already-in-use":
      return "An account already exists with this email. Try signing in.";
    case "auth/weak-password":
      return "Use at least 6 characters for your password.";
    case "auth/invalid-email":
      return "Enter a valid email address.";
    case "auth/missing-password":
      return "Enter your password.";
    case "auth/popup-closed-by-user":
    case "auth/cancelled-popup-request":
      return "";
    case "auth/popup-blocked":
      return "Your browser blocked the Google sign-in window. Allow pop-ups and try again.";
    case "auth/unauthorized-domain":
      return "Google sign-in isn't enabled for this web address yet. Use email and password instead.";
    case "auth/account-exists-with-different-credential":
      return "This email already uses a different sign-in method.";
    case "auth/too-many-requests":
      return "Too many attempts. Wait a moment and try again.";
    case "auth/network-request-failed":
      return "Network error. Check your connection and try again.";
    default:
      console.error("Sign-in failed:", error);
      return "Something went wrong. Please try again.";
  }
};

export default function LoginPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-paper" />}>
      <LoginContent />
    </Suspense>
  );
}

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = safeNext(searchParams.get("next"));

  const { user, authReady } = useAccount();

  const [mode, setMode] = useState<Mode>(
    searchParams.get("mode") === "signup" ? "signup" : "signin"
  );
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  // The card shows the form, the reset screen or the two-factor code step.
  const [resetting, setResetting] = useState(false);
  const [twoFactor, setTwoFactor] = useState<MultiFactorResolver | null>(null);

  // Already signed in (or just finished signing in): continue.
  useEffect(() => {
    if (authReady && user) {
      router.replace(next);
    }
  }, [authReady, user, next, router]);

  const switchMode = (nextMode: Mode) => {
    setMode(nextMode);
    setError("");
    setNotice("");
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setNotice("");

    if (mode === "signup" && !name.trim()) {
      setError("Enter your name.");
      return;
    }

    setBusy(true);

    try {
      if (mode === "signup") {
        const credential = await createUserWithEmailAndPassword(
          auth,
          email.trim(),
          password
        );

        await updateProfile(credential.user, {
          displayName: name.trim(),
        });
      } else {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      }
    } catch (caught) {
      setBusy(false);
      const resolver = twoFactorResolver(caught);
      if (resolver) {
        setTwoFactor(resolver);
        return;
      }
      setError(errorMessage(caught));
    }
  };

  const continueWithGoogle = async () => {
    setError("");
    setNotice("");
    setBusy(true);

    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
    } catch (caught) {
      setBusy(false);
      const resolver = twoFactorResolver(caught);
      if (resolver) {
        setTwoFactor(resolver);
        return;
      }
      setError(errorMessage(caught));
    }
  };

  const resetPassword = () => {
    setError("");
    setNotice("");
    setResetting(true);
  };


  const signingUp = mode === "signup";

  return (
    <main className="min-h-screen bg-paper text-ink">
      <SiteHeader showAccount={false} />

      <section className="mx-auto grid max-w-6xl gap-12 px-5 py-12 sm:px-8 md:py-20 lg:grid-cols-[1fr_440px] lg:items-center lg:gap-20">
        <div className="hidden lg:block">
          <SeatMateMark className="h-14 w-14 text-ink" />

          <h1 className="font-display mt-8 text-6xl leading-[1]">
            Your places,
            <br />
            one tap away.
          </h1>

          <ul className="mt-10 space-y-4 text-lg text-gray-600">
            <li className="flex items-center gap-3">
              <HeartIcon filled className="h-5 w-5 text-seat-taken" />
              Save your favorite cafés and restaurants
            </li>
            <li className="flex items-center gap-3">
              <BellIcon className="h-5 w-5 text-moss" />
              Get a heads-up when a seat opens
            </li>
            <li className="flex items-center gap-3">
              <ClockIcon className="h-5 w-5 text-gray-400" />
              Pick up where you left off with recently viewed
            </li>
          </ul>

          <p className="mt-10 text-sm text-gray-500">
            An account is optional. You can always check seats without one.
          </p>
        </div>

        <div className="rounded-3xl border border-line bg-white p-6 shadow-[0_1px_2px_rgba(16,24,17,0.04),0_30px_60px_-30px_rgba(16,24,17,0.25)] sm:p-9">
          {twoFactor ? (
            // Signing in finishes here; the redirect above takes over.
            <TwoFactorPrompt
              resolver={twoFactor}
              onSignedIn={() => undefined}
              onCancel={() => setTwoFactor(null)}
            />
          ) : resetting ? (
            <ResetPassword
              initialEmail={email}
              continueUrl={`${window.location.origin}/login`}
              onBack={() => setResetting(false)}
            />
          ) : (
          <>
          <h2 className="font-display text-4xl">
            {signingUp ? "Create your account" : "Welcome back"}
          </h2>

          <p className="mt-2 text-gray-600">
            {signingUp
              ? "Save places and see what's open near you."
              : "Sign in to see your saved places."}
          </p>

          <button
            type="button"
            onClick={continueWithGoogle}
            disabled={busy}
            className="mt-7 flex h-12 w-full items-center justify-center gap-3 rounded-xl border border-line bg-white font-semibold transition hover:border-gray-300 hover:bg-paper disabled:opacity-60"
          >
            <GoogleIcon className="h-5 w-5" />
            Continue with Google
          </button>

          <div className="my-6 flex items-center gap-4 text-xs uppercase tracking-[0.14em] text-gray-400">
            <span className="h-px flex-1 bg-line" />
            or
            <span className="h-px flex-1 bg-line" />
          </div>

          <form onSubmit={submit} className="space-y-4" noValidate>
            {signingUp && (
              <Field id="login-name" label="Name">
                <input
                  id="login-name"
                  type="text"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  autoComplete="name"
                  placeholder="Your name"
                  className="w-full"
                />
              </Field>
            )}

            <Field id="login-email" label="Email">
              <input
                id="login-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                placeholder="you@example.com"
                className="w-full"
              />
            </Field>

            <Field
              id="login-password"
              label="Password"
              action={
                !signingUp && (
                  <button
                    type="button"
                    onClick={resetPassword}
                    className="text-sm font-medium text-moss hover:text-green-800"
                  >
                    Forgot password?
                  </button>
                )
              }
            >
              <input
                id="login-password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete={signingUp ? "new-password" : "current-password"}
                placeholder={signingUp ? "At least 6 characters" : "Your password"}
                className="w-full"
              />
            </Field>

            {error && (
              <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </p>
            )}

            {notice && (
              <p role="status" className="rounded-xl bg-green-50 px-4 py-3 text-sm text-green-800">
                {notice}
              </p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="h-12 w-full rounded-xl bg-ink font-semibold text-white transition hover:bg-black disabled:opacity-60"
            >
              {busy
                ? "One moment…"
                : signingUp
                  ? "Create account"
                  : "Sign in"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-600">
            {signingUp ? "Already have an account? " : "New to SeatMate? "}
            <button
              type="button"
              onClick={() => switchMode(signingUp ? "signin" : "signup")}
              className="font-semibold text-ink underline decoration-line underline-offset-4 hover:decoration-ink"
            >
              {signingUp ? "Sign in" : "Create an account"}
            </button>
          </p>
          </>
          )}
        </div>
      </section>
    </main>
  );
}

// The label is tied to the input by id, so an action button (e.g. "Forgot
// password?") can sit beside it without becoming the labelled control.
function Field({
  id,
  label,
  action,
  children,
}: {
  id: string;
  label: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between text-sm font-medium">
        <label htmlFor={id}>{label}</label>
        {action}
      </div>
      {children}
    </div>
  );
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path fill="#4285F4" d="M22.6 12.2c0-.8-.1-1.5-.2-2.2H12v4.2h6c-.3 1.4-1 2.5-2.2 3.3v2.7h3.5c2.1-1.9 3.3-4.7 3.3-8Z" />
      <path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.7l-3.5-2.7c-1 .7-2.3 1.1-3.8 1.1-2.9 0-5.4-2-6.3-4.6H2.1v2.8A11 11 0 0 0 12 23Z" />
      <path fill="#FBBC05" d="M5.7 14.1a6.6 6.6 0 0 1 0-4.2V7.1H2.1a11 11 0 0 0 0 9.8l3.6-2.8Z" />
      <path fill="#EA4335" d="M12 5.4c1.6 0 3.1.6 4.2 1.7l3.1-3.1A11 11 0 0 0 2.1 7.1l3.6 2.8C6.6 7.3 9.1 5.4 12 5.4Z" />
    </svg>
  );
}

function BellIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M6 9a6 6 0 1 1 12 0c0 5 2 6.5 2 6.5H4S6 14 6 9" />
      <path d="M10 19a2 2 0 0 0 4 0" />
    </svg>
  );
}

function ClockIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className={className} aria-hidden="true">
      <circle cx="10" cy="10" r="7" />
      <path d="M10 6v4l2.5 2" />
    </svg>
  );
}
