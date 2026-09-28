// Feature switches admins can flip on the admin site's Settings page.
// Stored in settings/features (publicly readable, written only by the
// admin site's server). Anything missing counts as on.

export const FEATURES_DOC = ["settings", "features"] as const;

export type FeatureKey = "seatAlerts" | "suggestPlace" | "contactForm" | "shareButton" | "appBadges";

export type Features = Record<FeatureKey, boolean>;

export const DEFAULT_FEATURES: Features = {
  seatAlerts: true,
  suggestPlace: true,
  contactForm: true,
  shareButton: true,
  appBadges: true,
};

export const FEATURE_INFO: Record<FeatureKey, { label: string; description: string }> = {
  seatAlerts: {
    label: "Seat-open alerts",
    description: "“Email me when a seat opens” on full places, and the alert emails themselves.",
  },
  suggestPlace: {
    label: "Suggest a place",
    description: "The /suggest form, its footer link, and “Ask for it” on empty searches and city pages.",
  },
  contactForm: {
    label: "Contact form",
    description: "The form on /contact. When off, the page only shows your email address.",
  },
  shareButton: {
    label: "Share button",
    description: "The Share button on place pages.",
  },
  appBadges: {
    label: "App download buttons",
    description: "App Store / Google Play buttons in the footer and the “Take SeatMate with you” section on the home page.",
  },
};

export const FEATURE_KEYS = Object.keys(DEFAULT_FEATURES) as FeatureKey[];

export function readFeatures(data: Record<string, unknown> | undefined | null): Features {
  const features = { ...DEFAULT_FEATURES };
  FEATURE_KEYS.forEach((key) => {
    if (typeof data?.[key] === "boolean") features[key] = data[key] as boolean;
  });
  return features;
}
