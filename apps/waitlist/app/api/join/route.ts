import { FieldValue } from "firebase-admin/firestore";

import { emailConfigured, escapeHtml, sendEmail } from "@seatmate/shared/email";
import { adminAppCheck, adminDb } from "@seatmate/shared/firebase-admin";
import { sendSms, smsConfigured } from "@seatmate/shared/sms";

import { WAITLIST_SITE_URL } from "@/lib/site";
import { readSignup, type Signup } from "@/lib/waitlist";

// Adds someone to the waitlist, emails them a confirmation and, if they
// gave a phone number and agreed to texts, texts them one too.
//
// Signups go through here instead of straight to Firestore so the
// confirmation email can't be triggered for any address at will:
// - App Check (reCAPTCHA v3) must vouch for the browser once
//   NEXT_PUBLIC_RECAPTCHA_SITE_KEY is set on this site.
// - One signup per email (waitlist/{email}), so each address gets at most
//   one email from us.
// - A hidden "company" field that people never see; bots that fill it in
//   get a normal-looking answer and nothing is saved.

const json = (body: unknown, status = 200) => Response.json(body, { status });

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);

  if (!body || typeof body !== "object") {
    return json({ error: "Something went wrong. Please try again." }, 400);
  }

  if (typeof body.company === "string" && body.company.trim()) {
    return json({ joined: true });
  }

  const signup = readSignup(body);

  if (typeof signup === "string") {
    return json({ error: signup }, 400);
  }

  const db = adminDb();
  const appCheck = adminAppCheck();

  if (!db || !appCheck) {
    console.error("Waitlist: FIREBASE_SERVICE_ACCOUNT_KEY is missing on this site.");
    return json({ error: "The waitlist isn't open yet. Please try again soon." }, 503);
  }

  if (process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY) {
    const token = request.headers.get("x-firebase-appcheck");
    const verified = token ? await appCheck.verifyToken(token).then(() => true, () => false) : false;

    if (!verified) {
      return json({ error: "We couldn't confirm you're not a bot. Refresh the page and try again." }, 403);
    }
  }

  try {
    await db.collection("waitlist").doc(signup.email).create({
      ...signup,
      status: "new",
      createdAt: FieldValue.serverTimestamp(),
    });
  } catch (error) {
    // gRPC ALREADY_EXISTS: this email is on the list already.
    if ((error as { code?: number }).code === 6) {
      return json({ joined: true, already: true });
    }
    throw error;
  }

  if (emailConfigured()) {
    await sendEmail(confirmationEmail(signup)).catch((error) =>
      console.error("Waitlist: confirmation email failed:", error)
    );
  }

  if (signup.phone && signup.smsConsent && smsConfigured()) {
    await sendSms(confirmationText(signup)).catch((error) =>
      console.error("Waitlist: confirmation text failed:", error)
    );
  }

  return json({ joined: true });
}

function confirmationText(signup: Signup) {
  const firstName = signup.name.split(/\s+/)[0];
  return {
    to: signup.phone,
    body: `SeatMate: You're on the waitlist, ${firstName}. We'll text you when SeatMate opens near you. Reply STOP to opt out.`,
  };
}

function confirmationEmail(signup: Signup) {
  const firstName = signup.name.split(/\s+/)[0];
  const spotLine = signup.spotName
    ? `We'll also let ${signup.spotName} know people want live seats there.`
    : "";

  return {
    to: signup.email,
    subject: "You're on the SeatMate waitlist",
    text: [
      `Hi ${firstName},`,
      "",
      "You're on the SeatMate waitlist. We'll email you when SeatMate opens near you, so you can see open seats and wait times before you go.",
      spotLine,
      "",
      `Know someone who hates waiting? Send them ${WAITLIST_SITE_URL}`,
      "",
      "You're getting this because you joined the waitlist. We only email you about SeatMate opening near you.",
    ]
      .filter((line, index, lines) => line || lines[index - 1])
      .join("\n"),
    html: `
<div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;color:#101811">
  <p style="margin:0;font-size:13px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#15803d">SeatMate</p>
  <h1 style="margin:12px 0 8px;font-size:26px;line-height:1.2">You're on the list, ${escapeHtml(firstName)}.</h1>
  <p style="margin:0 0 12px;font-size:16px;color:#4b5563">We'll email you when SeatMate opens near you, so you can see open seats and wait times before you go.</p>
  ${spotLine ? `<p style="margin:0 0 12px;font-size:16px;color:#4b5563">${escapeHtml(spotLine)}</p>` : ""}
  <p style="margin:24px 0 0;font-size:16px;color:#4b5563">Know someone who hates waiting?</p>
  <a href="${escapeHtml(WAITLIST_SITE_URL)}" style="display:inline-block;margin-top:12px;background:#101811;color:#fff;text-decoration:none;font-weight:700;padding:14px 22px;border-radius:12px">Send them the waitlist</a>
  <p style="margin:28px 0 0;font-size:13px;color:#9ca3af">You're getting this because you joined the SeatMate waitlist. We only email you about SeatMate opening near you.</p>
</div>`,
  };
}
