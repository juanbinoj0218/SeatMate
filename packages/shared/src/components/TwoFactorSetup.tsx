"use client";

import { useState } from "react";
import QRCode from "qrcode";
import type { TotpSecret, User } from "firebase/auth";

import {
  finishTwoFactorSetup,
  hasTwoFactor,
  refreshEmailVerified,
  sendVerifyEmail,
  startTwoFactorSetup,
  turnOffTwoFactor,
  twoFactorMessage,
  twoFactorQrUrl,
} from "../two-factor";

type Step = "idle" | "verify-email" | "scan";

// Card for turning two-factor sign-in (authenticator app) on or off. Used
// on the customer account page, the business portal and the admin site.
export default function TwoFactorSetup({ user }: { user: User }) {
  const [enabled, setEnabled] = useState(() => hasTwoFactor(user));
  const [step, setStep] = useState<Step>("idle");
  const [secret, setSecret] = useState<TotpSecret | null>(null);
  const [qr, setQr] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const run = async (work: () => Promise<void>) => {
    setError("");
    setNotice("");
    setBusy(true);
    try {
      await work();
    } catch (caught) {
      console.error(caught);
      setError(twoFactorMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  const begin = () =>
    run(async () => {
      if (!(await refreshEmailVerified(user))) {
        setStep("verify-email");
        return;
      }

      const next = await startTwoFactorSetup(user);
      setSecret(next);
      setQr(
        await QRCode.toDataURL(twoFactorQrUrl(next, user.email || "SeatMate"), {
          margin: 1,
          width: 200,
        })
      );
      setCode("");
      setStep("scan");
    });

  const confirm = () =>
    run(async () => {
      if (!secret) return;
      if (!/^\d{6}$/.test(code.trim())) {
        setError("Enter the 6-digit code from your app.");
        return;
      }
      await finishTwoFactorSetup(user, secret, code);
      setEnabled(true);
      setStep("idle");
      setSecret(null);
      setNotice("Two-factor sign-in is on. You'll enter a code from your app each time you sign in.");
    });

  const turnOff = () => {
    if (!window.confirm("Turn off two-factor sign-in? Your account will only need your password.")) {
      return;
    }
    void run(async () => {
      await turnOffTwoFactor(user);
      setEnabled(false);
      setNotice("Two-factor sign-in is off.");
    });
  };

  const cancel = () => {
    setStep("idle");
    setSecret(null);
    setError("");
  };

  return (
    <section className="rounded-3xl border border-gray-200 bg-white p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-md">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-[#101811]">Two-factor sign-in</h2>
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                enabled ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-500"
              }`}
            >
              {enabled ? "On" : "Off"}
            </span>
          </div>
          <p className="mt-1 text-sm text-gray-500">
            Sign in with your password plus a 6-digit code from an authenticator app such as
            Google Authenticator, Microsoft Authenticator or 1Password.
          </p>
        </div>

        {step === "idle" &&
          (enabled ? (
            <button
              type="button"
              onClick={turnOff}
              disabled={busy}
              className="rounded-xl border border-red-200 px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
            >
              Turn off
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void begin()}
              disabled={busy}
              className="rounded-xl bg-[#101811] px-4 py-2.5 text-sm font-semibold text-white hover:bg-black disabled:opacity-50"
            >
              {busy ? "Starting…" : "Turn on"}
            </button>
          ))}
      </div>

      {step === "verify-email" && (
        <div className="mt-5 rounded-2xl bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-semibold">Verify your email first</p>
          <p className="mt-1">
            We need to know {user.email || "your email"} is yours before adding a second step.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  await sendVerifyEmail(user);
                  setNotice(`Verification email sent to ${user.email}. Open the link, then press “I've verified”.`);
                })
              }
              className="rounded-xl bg-[#101811] px-4 py-2 font-semibold text-white disabled:opacity-50"
            >
              Send verification email
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void begin()}
              className="rounded-xl border border-amber-300 bg-white px-4 py-2 font-semibold disabled:opacity-50"
            >
              I&apos;ve verified
            </button>
            <button type="button" onClick={cancel} className="px-2 py-2 font-semibold text-amber-800">
              Cancel
            </button>
          </div>
        </div>
      )}

      {step === "scan" && secret && (
        <div className="mt-5 grid gap-5 rounded-2xl bg-gray-50 p-5 sm:grid-cols-[200px_1fr]">
          {qr && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={qr}
              alt="QR code to add SeatMate to your authenticator app"
              width={200}
              height={200}
              className="rounded-xl border border-gray-200 bg-white"
            />
          )}
          <div className="text-sm">
            <p className="font-semibold text-[#101811]">1. Scan this with your authenticator app</p>
            <p className="mt-1 text-gray-500">Can&apos;t scan? Enter this key instead:</p>
            <code className="mt-1 block break-all rounded-lg bg-white px-3 py-2 font-mono text-xs text-[#101811]">
              {secret.secretKey}
            </code>

            <label htmlFor="two-factor-code" className="mt-4 block font-semibold text-[#101811]">
              2. Enter the 6-digit code it shows
            </label>
            <div className="mt-2 flex flex-wrap gap-2">
              <input
                id="two-factor-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
                onKeyDown={(event) => {
                  if (event.key === "Enter") void confirm();
                }}
                placeholder="123456"
                className="h-11 w-36 rounded-xl border border-gray-200 bg-white px-3 text-center font-mono text-lg tracking-[0.3em] text-black"
              />
              <button
                type="button"
                onClick={() => void confirm()}
                disabled={busy}
                className="h-11 rounded-xl bg-[#101811] px-5 font-semibold text-white disabled:opacity-50"
              >
                {busy ? "Checking…" : "Turn on"}
              </button>
              <button type="button" onClick={cancel} className="h-11 px-2 font-semibold text-gray-500">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="mt-4 rounded-xl bg-green-50 px-4 py-3 text-sm text-green-800">
          {notice}
        </p>
      )}
    </section>
  );
}
