import {
  getMultiFactorResolver,
  multiFactor,
  reload,
  sendEmailVerification,
  TotpMultiFactorGenerator,
  type MultiFactorError,
  type MultiFactorResolver,
  type TotpSecret,
  type User,
  type UserCredential,
} from "firebase/auth";

import { auth } from "./firebase";

// Two-factor sign-in with an authenticator app (Google Authenticator,
// 1Password, Authy…). Firebase calls this TOTP. It has to be switched on for
// the Firebase project once (admin site → Settings) before anyone can use it.

const errorCode = (error: unknown) =>
  typeof error === "object" && error !== null && "code" in error
    ? String((error as { code: unknown }).code)
    : "";

export const hasTwoFactor = (user: User) =>
  multiFactor(user).enrolledFactors.length > 0;

// Firebase only lets people with a verified email add a second step.
export async function sendVerifyEmail(user: User) {
  await sendEmailVerification(user);
}

export async function refreshEmailVerified(user: User) {
  await reload(user);
  return user.emailVerified;
}

// Step 1: a new secret to show as a QR code (and as text for typing in).
export async function startTwoFactorSetup(user: User) {
  const session = await multiFactor(user).getSession();
  return TotpMultiFactorGenerator.generateSecret(session);
}

export const twoFactorQrUrl = (secret: TotpSecret, accountName: string) =>
  secret.generateQrCodeUrl(accountName, "SeatMate");

// Step 2: the person types the 6-digit code their app shows.
export async function finishTwoFactorSetup(
  user: User,
  secret: TotpSecret,
  code: string
) {
  const assertion = TotpMultiFactorGenerator.assertionForEnrollment(
    secret,
    code.trim()
  );
  await multiFactor(user).enroll(assertion, "Authenticator app");
}

export async function turnOffTwoFactor(user: User) {
  for (const factor of multiFactor(user).enrolledFactors) {
    await multiFactor(user).unenroll(factor);
  }
}

// When a sign-in fails only because a code is needed, this returns what's
// needed to finish it; otherwise null.
export function twoFactorResolver(error: unknown): MultiFactorResolver | null {
  if (errorCode(error) !== "auth/multi-factor-auth-required") return null;
  return getMultiFactorResolver(auth, error as MultiFactorError);
}

export async function finishTwoFactorSignIn(
  resolver: MultiFactorResolver,
  code: string
): Promise<UserCredential> {
  const hint = resolver.hints.find(
    (factor) => factor.factorId === TotpMultiFactorGenerator.FACTOR_ID
  );

  if (!hint) {
    throw Object.assign(new Error("No authenticator app on this account."), {
      code: "auth/unsupported-second-factor",
    });
  }

  const assertion = TotpMultiFactorGenerator.assertionForSignIn(
    hint.uid,
    code.trim()
  );
  return resolver.resolveSignIn(assertion);
}

export function twoFactorMessage(error: unknown) {
  switch (errorCode(error)) {
    case "auth/invalid-verification-code":
    case "auth/missing-code":
    case "auth/invalid-argument":
      return "That code didn't work. Check your authenticator app and try the newest code.";
    case "auth/totp-challenge-timeout":
    case "auth/code-expired":
      return "That took too long. Start again.";
    case "auth/requires-recent-login":
      return "For your security, sign out and sign back in, then try again.";
    case "auth/unverified-email":
      return "Verify your email address first.";
    case "auth/operation-not-allowed":
    case "auth/admin-restricted-operation":
      return "Two-factor sign-in isn't switched on for SeatMate yet. An admin can turn it on in the admin site under Settings.";
    case "auth/maximum-second-factor-count-exceeded":
      return "This account already has the most second steps allowed.";
    case "auth/unsupported-second-factor":
      return "This account uses a second step this site doesn't support.";
    case "auth/too-many-requests":
      return "Too many tries. Wait a minute and try again.";
    default:
      return "Something went wrong. Please try again.";
  }
}
