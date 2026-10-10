import "server-only";

// Sends text messages through Twilio (https://www.twilio.com). Needs
// TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and either
// TWILIO_MESSAGING_SERVICE_SID (recommended, required for US A2P 10DLC)
// or TWILIO_FROM_NUMBER (e.g. "+19165550123").

type Sms = {
  // E.164, e.g. "+19165550123".
  to: string;
  body: string;
};

export const smsConfigured = () =>
  Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) ||
  process.env.NODE_ENV === "development";

export async function sendSms(sms: Sms) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;

  // In `npm run dev` without keys, print the text instead of sending it.
  if (!sid || !token) {
    console.log(`[sms] To: ${sms.to}\n${sms.body}`);
    return;
  }

  const form = new URLSearchParams({ To: sms.to, Body: sms.body });
  const service = process.env.TWILIO_MESSAGING_SERVICE_SID;

  if (service) {
    form.set("MessagingServiceSid", service);
  } else if (process.env.TWILIO_FROM_NUMBER) {
    form.set("From", process.env.TWILIO_FROM_NUMBER);
  } else {
    throw new Error("Set TWILIO_MESSAGING_SERVICE_SID or TWILIO_FROM_NUMBER.");
  }

  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form,
  });

  if (!response.ok) {
    throw new Error(`Twilio returned ${response.status}: ${await response.text()}`);
  }
}
