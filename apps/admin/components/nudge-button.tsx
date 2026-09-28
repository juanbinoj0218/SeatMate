"use client";

import { useState } from "react";

import { adminFetch, useAdmin } from "@/lib/admin-session";

// "Send reminder" to a business whose seats are out of date.
export default function NudgeButton({
  businessId,
  onSent,
  className = "",
}: {
  businessId: string;
  onSent?: (message: string) => void;
  className?: string;
}) {
  const user = useAdmin();
  const [state, setState] = useState<"idle" | "sending" | "done">("idle");
  const [error, setError] = useState("");

  const send = async (force = false) => {
    setState("sending");
    setError("");
    try {
      const result = await adminFetch<{ sent: boolean; to: string; mailto?: string }>(
        user,
        `/api/admin/businesses/${businessId}/nudge${force ? "?force=1" : ""}`,
        { method: "POST" }
      );
      if (!result.sent && result.mailto) {
        window.location.assign(result.mailto);
      }
      setState("done");
      onSent?.(result.sent ? `Reminder emailed to ${result.to}.` : `Reminder opened in your email app for ${result.to}.`);
    } catch (caught) {
      const message = (caught as Error).message;
      if (message.includes("last 12 hours") && window.confirm(`${message} Send another one anyway?`)) {
        return send(true);
      }
      setState("idle");
      setError(message);
    }
  };

  return (
    <span className="inline-flex flex-col items-start">
      <button
        type="button"
        onClick={() => send()}
        disabled={state !== "idle"}
        className={`rounded-lg border border-orange-200 bg-orange-50 px-2.5 py-1 text-xs font-semibold text-orange-800 transition hover:bg-orange-100 disabled:opacity-60 ${className}`}
      >
        {state === "sending" ? "Sending…" : state === "done" ? "Reminder sent ✓" : "Send reminder"}
      </button>
      {error && <span className="mt-1 text-xs text-red-600">{error}</span>}
    </span>
  );
}
