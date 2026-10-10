// What a waitlist signup may contain. Shared by the form and /api/join.

export const VENUE_TYPES = ["cafe", "restaurant", "bar", "barbershop"] as const;

export const EMAIL_PATTERN = /^[^@\s/]+@[^@\s/]+\.[^@\s/]+$/;

export const MAX_WAIT_MINUTES = 60;

export type Signup = {
  name: string;
  email: string;
  venueType: (typeof VENUE_TYPES)[number];
  waitMinutes: number;
  spotName: string;
  spotArea: string;
  // E.164 ("+19165550123"), or "" when they skipped it.
  phone: string;
  // They agreed to texts. Always true when there's a phone number.
  smsConsent: boolean;
};

// Turns what someone typed into an E.164 number, or null if it isn't one.
// Ten digits are read as a US number.
export function normalizePhone(value: string): string | null {
  const digits = value.replace(/\D/g, "");
  if (value.trim().startsWith("+")) {
    return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : null;
  }
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}

const text = (value: unknown, max: number) =>
  typeof value === "string" ? value.trim().slice(0, max) : "";

// Cleans what the form sent. Returns an error message for the person, or
// the signup to save.
export function readSignup(body: Record<string, unknown>): Signup | string {
  const name = text(body.name, 100);
  const email = text(body.email, 200).toLowerCase();
  const venueType = VENUE_TYPES.find((type) => type === body.venueType);
  const waitMinutes = Number(body.waitMinutes);

  if (!name) return "Add your name.";
  if (!EMAIL_PATTERN.test(email)) return "That email doesn't look right.";
  if (!venueType) return "Pick the kind of place you wait at.";
  const typedPhone = text(body.phone, 30);
  const phone = typedPhone ? normalizePhone(typedPhone) : "";
  if (phone === null) return "That phone number doesn't look right.";
  // We only keep a number we're allowed to text.
  if (phone && body.smsConsent !== true) return "Tick the box to get texts, or leave the number blank.";

  if (!Number.isInteger(waitMinutes) || waitMinutes < 0 || waitMinutes > MAX_WAIT_MINUTES) {
    return "Pick how long you usually wait.";
  }

  return {
    name,
    email,
    venueType,
    waitMinutes,
    spotName: text(body.spotName, 120),
    spotArea: text(body.spotArea, 160),
    phone,
    smsConsent: Boolean(phone),
  };
}
