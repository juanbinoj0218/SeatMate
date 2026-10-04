"use client";

import { FormEvent, Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  GoogleAuthProvider,
  type MultiFactorResolver,
  signInWithEmailAndPassword,
  signInWithPopup,
} from "firebase/auth";

import SeatMateMark from "@seatmate/shared/components/SeatMateMark";
import { auth } from "@seatmate/shared/firebase";
import ResetPassword from "@seatmate/shared/components/ResetPassword";
import TwoFactorPrompt from "@seatmate/shared/components/TwoFactorPrompt";
import { safeNextPath } from "@seatmate/shared/safe-next";
import { twoFactorResolver } from "@seatmate/shared/two-factor";

import { AdminSessionProvider, useAdminSession } from "@/lib/admin-session";

const safeNext = (value: string | null) => safeNextPath(value, "/");

const message = (error: unknown) => {
  const code = typeof error === "object" && error && "code" in error ? String((error as { code: unknown }).code) : "";
  if (["auth/invalid-credential", "auth/wrong-password", "auth/user-not-found"].includes(code)) return "Incorrect email or password.";
  if (code === "auth/popup-closed-by-user") return "";
  if (code === "auth/unauthorized-domain") return "Add this domain to Firebase → Authentication → Authorized domains.";
  if (code === "auth/too-many-requests") return "Too many attempts. Wait a moment and try again.";
  return "Couldn't sign in. Please try again.";
};

export default function LoginPage() {
  return (
    <AdminSessionProvider>
      <Suspense>
        <Login />
      </Suspense>
    </AdminSessionProvider>
  );
}

function Login() {
  const router = useRouter();
  const params = useSearchParams();
  const session = useAdminSession();
  const next = safeNext(params.get("next"));

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [twoFactor, setTwoFactor] = useState<MultiFactorResolver | null>(null);

  useEffect(() => {
    if (session.state === "admin" || session.state === "denied") {
      router.replace(next);
    }
  }, [session.state, next, router]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setNotice("");
    setBusy(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (caught) {
      setBusy(false);
      const resolver = twoFactorResolver(caught);
      if (resolver) {
        setTwoFactor(resolver);
        return;
      }
      setError(message(caught));
    }
  };

  const google = async () => {
    setError("");
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
    } catch (caught) {
      const resolver = twoFactorResolver(caught);
      if (resolver) {
        setTwoFactor(resolver);
        return;
      }
      setError(message(caught));
    }
  };



  return (
    <main className="flex min-h-screen items-center justify-center bg-[#101811] p-6">
      <div className="w-full max-w-sm rounded-3xl bg-white p-8">
        <div className="flex items-center gap-2.5">
          <SeatMateMark className="h-8 w-8 text-[#101811]" />
          <div>
            <p className="font-bold leading-tight">SeatMate</p>
            <p className="text-xs text-gray-400">Admin</p>
          </div>
        </div>

        {twoFactor ? (
          <div className="mt-8">
            <TwoFactorPrompt resolver={twoFactor} onSignedIn={() => undefined} onCancel={() => setTwoFactor(null)} />
          </div>
        ) : resetting ? (
          <div className="mt-8">
            <ResetPassword
              initialEmail={email}
              continueUrl={`${window.location.origin}/login`}
              onBack={() => setResetting(false)}
            />
          </div>
        ) : (
        <>
        <h1 className="mt-8 text-2xl font-bold">Sign in</h1>
        <p className="mt-1 text-sm text-gray-500">For SeatMate administrators only.</p>

        <form onSubmit={submit} className="mt-6 space-y-4">
          <div>
            <label htmlFor="admin-email" className="mb-1.5 block text-sm font-semibold">Email</label>
            <input id="admin-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" className="w-full" />
          </div>
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label htmlFor="admin-password" className="block text-sm font-semibold">Password</label>
              <button type="button" onClick={() => { setError(""); setNotice(""); setResetting(true); }} className="text-sm font-semibold text-gray-500 hover:text-[#101811]">Forgot password?</button>
            </div>
            <input id="admin-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" className="w-full" />
          </div>

          {error && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
          {notice && <p role="status" className="rounded-xl bg-green-50 px-4 py-3 text-sm text-green-800">{notice}</p>}

          <button type="submit" disabled={busy} className="h-12 w-full rounded-xl bg-[#101811] font-semibold text-white hover:bg-black disabled:opacity-60">
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <button type="button" onClick={google} className="mt-3 h-12 w-full rounded-xl border border-gray-200 font-semibold hover:bg-gray-50">
          Continue with Google
        </button>
        </>
        )}
      </div>
    </main>
  );
}
