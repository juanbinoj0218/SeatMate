// What a waitlist signup may contain. Shared by the form and /api/join.

export const VENUE_TYPES = ["barbershop", "bar", "cafe", "restaurant"] as const;

export const EMAIL_PATTERN = /^[^@\s/]+@[^@\s/]+\.[^@\s/]+$/;

export const MAX_WAIT_MINUTES = 60;

export type Signup = {
  name: string;
  email: string;
  venueType: (typeof VENUE_TYPES)[number];
  waitMinutes: number;
  spotName: string;
  spotArea: string;
};

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
  };
}
