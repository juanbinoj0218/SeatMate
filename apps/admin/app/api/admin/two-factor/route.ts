import { writeLog } from "@/lib/activity-log";
import { adminRoute, jsonError } from "@/lib/require-admin";
import type { AdminContext } from "@/lib/require-admin";

// Project-wide switch for two-factor sign-in with authenticator apps (TOTP).
// Firebase only offers this after the project is upgraded to Identity
// Platform (Firebase console → Authentication → Settings).

const TOTP_ADJACENT_INTERVALS = 5;

const explain = (error: unknown) => {
  const text = error instanceof Error ? error.message : String(error);
  if (/identity platform|not enabled|CONFIGURATION_NOT_FOUND|billing/i.test(text)) {
    return "Firebase needs the Identity Platform upgrade first: Firebase console → Authentication → Settings → Upgrade. Then try again.";
  }
  return `Firebase said: ${text.split("\n")[0].slice(0, 240)}`;
};

async function readEnabled(admin: AdminContext) {
  const config = await admin.auth.projectConfigManager().getProjectConfig();
  return (
    config.multiFactorConfig?.providerConfigs?.some(
      (provider) => provider.state === "ENABLED" && provider.totpProviderConfig
    ) ?? false
  );
}

export const GET = adminRoute(async (_request, admin) => {
  try {
    return Response.json({ enabled: await readEnabled(admin) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Two-factor config read failed:", error);
    return Response.json({ enabled: false, problem: explain(error) }, { headers: { "Cache-Control": "no-store" } });
  }
});

export const PUT = adminRoute(async (request, admin) => {
  const body = await request.json().catch(() => ({}));
  if (typeof body.enabled !== "boolean") return jsonError("Send { enabled: true | false }.", 400);

  try {
    await admin.auth.projectConfigManager().updateProjectConfig({
      multiFactorConfig: {
        state: body.enabled ? "ENABLED" : "DISABLED",
        providerConfigs: [
          {
            state: body.enabled ? "ENABLED" : "DISABLED",
            totpProviderConfig: { adjacentIntervals: TOTP_ADJACENT_INTERVALS },
          },
        ],
      },
    });
  } catch (error) {
    console.error("Two-factor config update failed:", error);
    return jsonError(explain(error), 400);
  }

  await writeLog(admin, {
    action: "settings.twoFactor",
    targetType: "settings",
    targetId: "twoFactor",
    targetName: "Two-factor sign-in",
    details: body.enabled ? "Turned on authenticator apps" : "Turned off authenticator apps",
  });

  return Response.json({ enabled: await readEnabled(admin).catch(() => body.enabled) });
});
