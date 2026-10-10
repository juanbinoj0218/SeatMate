// What a waitlist signup may contain. Shared by the form and /api/join.

export const VENUE_TYPES = ["cafe", "restaurant", "bar", "barbershop"] as const;

export const EMAIL_PATTERN = /^[^@\s/]+@[^@\s/]+\.[^@\s/]+$/;

// How much each place's problem bugs them. Asked once per place they pick.
export const FEELINGS = ["often", "sometimes", "rarely"] as const;

export type VenueType = (typeof VENUE_TYPES)[number];
export type Feeling = (typeof FEELINGS)[number];

export type Signup = {
  name: string;
  email: string;
  // The places they'd use SeatMate at, in VENUE_TYPES order.
  venueTypes: VenueType[];
  // Their answer to each place's question.
  feelings: Partial<Record<VenueType, Feeling>>;
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
  const picked = Array.isArray(body.venueTypes) ? body.venueTypes : [];
  const venueTypes = VENUE_TYPES.filter((type) => picked.includes(type));
  const sent = (body.feelings && typeof body.feelings === "object" ? body.feelings : {}) as Record<string, unknown>;
  const feelings: Partial<Record<VenueType, Feeling>> = {};
  for (const type of venueTypes) {
    const feeling = FEELINGS.find((value) => value === sent[type]);
    if (feeling) feelings[type] = feeling;
  }

  if (!name) return "Add your name.";
  if (!EMAIL_PATTERN.test(email)) return "That email doesn't look right.";
  if (venueTypes.length === 0) return "Pick at least one place.";
  if (Object.keys(feelings).length !== venueTypes.length) return "Answer the question for each place you picked.";
  const typedPhone = text(body.phone, 30);
  const phone = typedPhone ? normalizePhone(typedPhone) : "";
  if (phone === null) return "That phone number doesn't look right.";
  // We only keep a number we're allowed to text.
  if (phone && body.smsConsent !== true) return "Tick the box to get texts, or leave the number blank.";

  return {
    name,
    email,
    venueTypes,
    feelings,
    spotName: text(body.spotName, 120),
    spotArea: text(body.spotArea, 160),
    phone,
    smsConsent: Boolean(phone),
  };
}
