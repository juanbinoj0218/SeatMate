"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import {
  EmailAuthProvider,
  GoogleAuthProvider,
  OAuthProvider,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  signOut,
  type MultiFactorResolver,
  type User,
} from "firebase/auth";

import { auth } from "@seatmate/shared/firebase";
import TwoFactorPrompt from "@seatmate/shared/components/TwoFactorPrompt";
import { twoFactorResolver } from "@seatmate/shared/two-factor";

// "Delete account" on the Security page. Confirms who you are again (your
// password, Google or Apple, plus the authenticator-app code when two-step
// sign-in is on), then asks the server (/api/delete-account) to delete the
// business, its listing, floor plan, staff and analytics, and the sign-in.

const linked = (user: User, providerId: string) =>
  user.providerData.some((provider) => provider.providerId === providerId);

type Method = "password" | "google" | "apple";

const popupProvider = (method: "google" | "apple") => {
  if (method === "google") return new GoogleAuthProvider();
  const provider = new OAuthProvider("apple.com");
  provider.addScope("email");
  provider.addScope("name");
  return provider;
};

const describe = (error: unknown) => {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String((error as { code: unknown }).code)
      : "";

  switch (code) {
    case "auth/wrong-password":
    case "auth/invalid-credential":
      return "That password isn't right.";
    case "auth/popup-closed-by-user":
    case "auth/cancelled-popup-request":
      return "Confirmation was cancelled.";
    case "auth/popup-blocked":
      return "Your browser blocked the confirmation window. Allow pop-ups and try again.";
    case "auth/user-mismatch":
      return "Confirm with the same account you're signed in with.";
    case "auth/too-many-requests":
      return "Too many attempts. Wait a moment and try again.";
    case "auth/network-request-failed":
      return "Network error. Check your connection and try again.";
    default:
      return "We couldn't delete your account. Please try again, or contact us.";
  }
};

export default function DeleteAccount({ user }: { user: User }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [password, setPassword] = useState("");
  const [twoFactor, setTwoFactor] = useState<MultiFactorResolver | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const needsPassword = linked(user, "password");
  const popupMethods = (["google", "apple"] as const).filter((method) =>
    linked(user, method === "google" ? "google.com" : "apple.com")
  );

  const cancel = () => {
    if (busy) return;
    setOpen(false);
    setConfirmText("");
    setPassword("");
    setTwoFactor(null);
    setError("");
  };

  // Runs once the account is confirmed. A fresh ID token carries the new
  // sign-in time the server checks.
  const removeEverything = async () => {
    setBusy(true);

    try {
      const idToken = await user.getIdToken(true);
      const response = await fetch("/api/delete-account", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
        body: "{}",
      });
      const result = (await response.json().catch(() => null)) as
        | { ok?: boolean; error?: string }
        | null;

      if (!response.ok || !result?.ok) {
        setError(result?.error || "We couldn't delete your account. Please try again, or contact us.");
        setBusy(false);
        return;
      }
    } catch (caught) {
      console.error("Could not delete account:", caught);
      setError(describe(caught));
      setBusy(false);
      return;
    }

    await signOut(auth).catch(() => undefined);
    router.replace("/business/login");
  };

  const confirmAndDelete = async (method: Method) => {
    setError("");

    if (confirmText.trim().toUpperCase() !== "DELETE") {
      setError("Type DELETE to confirm.");
      return;
    }

    if (method === "password" && !password) {
      setError("Enter your password.");
      return;
    }

    setBusy(true);

    try {
      // Nothing is removed if this step fails.
      if (method === "password") {
        await reauthenticateWithCredential(
          user,
          EmailAuthProvider.credential(user.email || "", password)
        );
      } else {
        await reauthenticateWithPopup(user, popupProvider(method));
      }
    } catch (caught) {
      setBusy(false);
      const resolver = twoFactorResolver(caught);
      if (resolver) {
        setTwoFactor(resolver);
        return;
      }
      console.error("Could not confirm account:", caught);
      setError(describe(caught));
      return;
    }

    await removeEverything();
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    void confirmAndDelete(needsPassword ? "password" : (popupMethods[0] ?? "google"));
  };

  return (
    <section className="rounded-3xl border border-gray-200 bg-white p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-md">
          <h2 className="text-lg font-bold text-[#101811]">Delete account</h2>
          <p className="mt-1 text-sm text-gray-500">
            Permanently delete your sign-in and, if you own a business, its SeatMate listing,
            floor plan, staff accounts and invites, hours, cover photo and analytics. It
            can&apos;t be undone.
          </p>
        </div>

        {!open && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="rounded-xl border border-red-200 px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50"
          >
            Delete account…
          </button>
        )}
      </div>

      {open && twoFactor && (
        <div className="mt-5 max-w-md">
          <TwoFactorPrompt
            resolver={twoFactor}
            onSignedIn={async () => {
              setTwoFactor(null);
              await removeEverything();
            }}
            onCancel={() => setTwoFactor(null)}
          />
        </div>
      )}

      {open && !twoFactor && (
        <form onSubmit={submit} className="mt-5 max-w-md space-y-4">
          <div>
            <label htmlFor="delete-confirm" className="mb-1.5 block text-sm font-semibold">
              Type <span className="font-mono">DELETE</span> to confirm
            </label>
            <input
              id="delete-confirm"
              type="text"
              value={confirmText}
              onChange={(event) => setConfirmText(event.target.value)}
              autoComplete="off"
              className="w-full rounded-xl border border-gray-200 px-4 py-3"
            />
          </div>

          {needsPassword ? (
            <div>
              <label htmlFor="delete-password" className="mb-1.5 block text-sm font-semibold">
                Your password
              </label>
              <input
                id="delete-password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                className="w-full rounded-xl border border-gray-200 px-4 py-3"
              />
            </div>
          ) : (
            <p className="rounded-xl bg-[#f7f8f5] px-4 py-3 text-sm text-gray-600">
              You&apos;ll confirm with{" "}
              {popupMethods.length > 1
                ? "Google or Apple"
                : popupMethods[0] === "apple"
                  ? "Apple"
                  : "Google"}{" "}
              in a pop-up window.
            </p>
          )}

          {error && (
            <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </p>
          )}

          <div className="flex flex-col-reverse gap-3 sm:flex-row">
            <button
              type="button"
              onClick={cancel}
              disabled={busy}
              className="h-12 flex-1 rounded-xl border border-gray-200 font-semibold hover:bg-gray-50 disabled:opacity-50"
            >
              Keep my account
            </button>
            {!needsPassword && popupMethods.length > 1 ? (
              popupMethods.map((method) => (
                <button
                  key={method}
                  type="button"
                  onClick={() => void confirmAndDelete(method)}
                  disabled={busy}
                  className="h-12 flex-1 rounded-xl bg-red-600 font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                >
                  {busy ? "Deleting…" : method === "apple" ? "Delete with Apple" : "Delete with Google"}
                </button>
              ))
            ) : (
              <button
                type="submit"
                disabled={busy}
                className="h-12 flex-1 rounded-xl bg-red-600 font-semibold text-white hover:bg-red-700 disabled:opacity-60"
              >
                {busy ? "Deleting…" : "Delete forever"}
              </button>
            )}
          </div>
        </form>
      )}
    </section>
  );
}
