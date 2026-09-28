// Parses the FIREBASE_SERVICE_ACCOUNT_KEY environment variable. Pasting the
// downloaded JSON into a dashboard often mangles it slightly, so accept:
// the raw JSON, JSON wrapped in quotes, base64-encoded JSON, and private
// keys whose line breaks became "\\n" or real newlines.

export type ServiceAccount = {
  project_id: string;
  client_email: string;
  private_key: string;
};

export function parseServiceAccount(raw: string | undefined): ServiceAccount | null {
  if (!raw?.trim()) {
    return null;
  }

  let text = raw.trim();

  if ((text.startsWith("'") && text.endsWith("'")) || (text.startsWith('"') && text.endsWith('"'))) {
    text = text.slice(1, -1);
  }

  if (!text.startsWith("{")) {
    try {
      text = Buffer.from(text, "base64").toString("utf8");
    } catch {
      // Not base64 either; JSON.parse below reports the problem.
    }
  }

  let parsed: Partial<ServiceAccount>;

  try {
    parsed = JSON.parse(text);
  } catch {
    // Real newlines inside the private key string make the JSON invalid.
    parsed = JSON.parse(text.replace(/\r?\n/g, "\\n"));
  }

  if (!parsed.project_id || !parsed.client_email || !parsed.private_key) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_KEY is missing project_id, client_email or private_key.");
  }

  return {
    project_id: parsed.project_id,
    client_email: parsed.client_email,
    private_key: parsed.private_key.replace(/\\n/g, "\n"),
  };
}
