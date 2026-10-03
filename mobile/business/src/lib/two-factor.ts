import {
  getMultiFactorResolver,
  TotpMultiFactorGenerator,
  type MultiFactorError,
  type MultiFactorResolver,
} from "firebase/auth";

import { auth } from "@/lib/firebase";

// Accounts that turned on two-factor sign-in on the website (an
// authenticator app, Firebase "TOTP") need their 6-digit code here too.
// Setting it up or turning it off stays on the website's Security page.

export function twoFactorResolver(error: unknown): MultiFactorResolver | null {
  const code =
    typeof error === "object" && error !== null && "code" in error ? String((error as { code: unknown }).code) : "";

  return code === "auth/multi-factor-auth-required"
    ? getMultiFactorResolver(auth, error as MultiFactorError)
    : null;
}

export async function finishTwoFactorSignIn(resolver: MultiFactorResolver, code: string) {
  const hint = resolver.hints.find((factor) => factor.factorId === TotpMultiFactorGenerator.FACTOR_ID);

  if (!hint) {
    throw new Error("This account uses a kind of two-factor sign-in the app doesn't support yet.");
  }

  const assertion = TotpMultiFactorGenerator.assertionForSignIn(hint.uid, code.trim());
  return resolver.resolveSignIn(assertion);
}
