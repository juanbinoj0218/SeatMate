"use client";

import { useEffect, useState } from "react";

import { FEATURE_INFO, FEATURE_KEYS, type FeatureKey, type Features } from "@seatmate/shared/features";

import { PageHeader } from "@/components/admin-shell";
import { adminFetch, useAdmin } from "@/lib/admin-session";

export default function SettingsPage() {
  const user = useAdmin();
  const [features, setFeatures] = useState<Features | null>(null);
  const [saving, setSaving] = useState<FeatureKey | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    adminFetch<{ features: Features }>(user, "/api/admin/settings")
      .then((result) => setFeatures(result.features))
      .catch((caught: Error) => setError(caught.message));
  }, [user]);

  const toggle = async (key: FeatureKey) => {
    if (!features) return;
    const next = !features[key];
    setSaving(key);
    setError("");
    setNotice("");
    try {
      const result = await adminFetch<{ features: Features }>(user, "/api/admin/settings", {
        method: "PUT",
        body: JSON.stringify({ features: { [key]: next } }),
      });
      setFeatures(result.features);
      setNotice(`${FEATURE_INFO[key].label} turned ${next ? "on" : "off"}. Visitors see the change on their next page load.`);
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-5 py-8 sm:px-8 lg:py-10">
      <PageHeader title="Settings" description="Turn customer-site features on or off without a code change." />

      {error && <p role="alert" className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">{error}</p>}
      {notice && <p role="status" className="mt-6 rounded-2xl border border-green-200 bg-green-50 px-5 py-4 text-sm text-green-800">{notice}</p>}

      <ul className="mt-6 divide-y divide-gray-100 rounded-2xl border border-gray-200 bg-white">
        {FEATURE_KEYS.map((key) => {
          const on = features?.[key] ?? true;
          return (
            <li key={key} className="flex items-center justify-between gap-6 px-5 py-4">
              <div>
                <p className="font-semibold">{FEATURE_INFO[key].label}</p>
                <p className="mt-0.5 text-sm text-gray-500">{FEATURE_INFO[key].description}</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={on}
                aria-label={FEATURE_INFO[key].label}
                disabled={!features || saving !== null}
                onClick={() => toggle(key)}
                className={`relative h-7 w-12 shrink-0 rounded-full transition disabled:opacity-50 ${on ? "bg-emerald-500" : "bg-gray-300"}`}
              >
                <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? "left-6" : "left-1"}`} />
              </button>
            </li>
          );
        })}
      </ul>

      <p className="mt-4 text-xs text-gray-400">Every change is recorded in Activity.</p>
    </div>
  );
}
