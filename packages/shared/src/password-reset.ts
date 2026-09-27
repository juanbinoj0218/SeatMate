import { sendPasswordResetEmail } from "firebase/auth";

import { auth } from "./firebase";

// Sends Firebase's password reset email. The link brings the person back to
// `continueUrl` (the sign-in page they came from) after they choose a new
// password. Firebase only accepts continue URLs on an Authorized domain, so
// on other addresses (e.g. Vercel previews) the email is sent without one.
export async function sendResetLink(email: string, continueUrl: string) {
  try {
    await sendPasswordResetEmail(auth, email, {
      url: continueUrl,
      handleCodeInApp: false,
    });
  } catch (error) {
    const code =
      typeof error === "object" && error !== null && "code" in error
        ? String((error as { code: unknown }).code)
        : "";

    if (
      code === "auth/unauthorized-continue-uri" ||
      code === "auth/invalid-continue-uri"
    ) {
      await sendPasswordResetEmail(auth, email);
      return;
    }

    throw error;
  }
}

// Shown after a reset request. Firebase doesn't reveal whether an account
// exists for the address, so the message can't either.
export const resetSentMessage = (email: string) =>
  `If there's an account for ${email}, a reset link is on its way. ` +
  `It can take a minute — check your spam or junk folder too.`;
