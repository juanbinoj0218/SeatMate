// Sends email through Resend (https://resend.com). Needs RESEND_API_KEY and,
// once your domain is verified in Resend, ALERT_EMAIL_FROM
// (e.g. "SeatMate <alerts@seatmate360.com>").

type Email = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

export const emailConfigured = () =>
  Boolean(process.env.RESEND_API_KEY) ||
  process.env.NODE_ENV === "development";

export async function sendEmail(email: Email) {
  const apiKey = process.env.RESEND_API_KEY;

  // In `npm run dev` without a key, print the email instead of sending it.
  if (!apiKey) {
    console.log(`[email] To: ${email.to}\n[email] Subject: ${email.subject}\n${email.text}`);
    return;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.ALERT_EMAIL_FROM || "SeatMate <onboarding@resend.dev>",
      to: email.to,
      subject: email.subject,
      html: email.html,
      text: email.text,
    }),
  });

  if (!response.ok) {
    throw new Error(`Resend returned ${response.status}: ${await response.text()}`);
  }
}

export const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
