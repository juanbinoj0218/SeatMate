"use client";

import { getApp } from "firebase/app";
import { getToken, initializeAppCheck, ReCaptchaV3Provider, type AppCheck } from "firebase/app-check";

// Must come first: it sets up the Firebase app this file reads.
import "@seatmate/shared/firebase";

// App Check proves signups come from this site in a real browser (via an
// invisible reCAPTCHA v3 check). Off until NEXT_PUBLIC_RECAPTCHA_SITE_KEY
// is set, and /api/join only insists on it once the key is set.

const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;
let appCheck: AppCheck | null = null;

export function startAppCheck() {
  if (!siteKey || appCheck || typeof window === "undefined") return;
  appCheck = initializeAppCheck(getApp(), {
    provider: new ReCaptchaV3Provider(siteKey),
    isTokenAutoRefreshEnabled: true,
  });
}

// Headers for /api/join: the App Check token when App Check is on.
export async function appCheckHeaders(): Promise<Record<string, string>> {
  startAppCheck();
  if (!appCheck) return {};
  const { token } = await getToken(appCheck, false);
  return { "X-Firebase-AppCheck": token };
}
