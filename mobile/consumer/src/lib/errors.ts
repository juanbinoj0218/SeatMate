// Plain-language messages for Firebase Authentication errors.
export function friendlyAuthError(error: unknown) {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String((error as { code: unknown }).code)
      : "";

  switch (code) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "Incorrect email or password.";
    case "auth/email-already-in-use":
      return "An account already exists with this email.";
    case "auth/weak-password":
      return "Choose a stronger password.";
    case "auth/invalid-email":
      return "Enter a valid email address.";
    case "auth/user-disabled":
      return "This account has been disabled.";
    case "auth/too-many-requests":
      return "Too many attempts. Try again later.";
    case "auth/network-request-failed":
      return "Network error. Check your connection and try again.";
    case "auth/invalid-api-key":
      return "The app can't reach Firebase: the API key is missing or invalid.";
    case "":
      return error instanceof Error ? error.message : "Something went wrong. Please try again.";
    default:
      return `Something went wrong (${code}).`;
  }
}
