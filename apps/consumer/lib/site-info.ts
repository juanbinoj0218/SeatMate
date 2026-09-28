// Contact details and app store links shown on the customer site.
// Override with environment variables in Vercel without touching code.

export const CONTACT_EMAIL =
  process.env.NEXT_PUBLIC_CONTACT_EMAIL || "admin@seatmate360.com";

// Leave empty until the app is live in that store; the site then shows
// "Coming soon" instead of a badge.
export const IOS_APP_URL = process.env.NEXT_PUBLIC_IOS_APP_URL || "";
export const ANDROID_APP_URL = process.env.NEXT_PUBLIC_ANDROID_APP_URL || "";
