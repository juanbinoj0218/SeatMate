// The files that let iOS and Android open SeatMate links in the apps
// (universal links / Android App Links). Each site serves them under
// /.well-known. The Apple Team ID and the Android signing certificate's
// SHA-256 fingerprint come from the environment (APPLE_TEAM_ID,
// ANDROID_CERT_SHA256); until both are set the files return 404, so the
// phone keeps opening links in the browser.

type AppLinkTarget = {
  // iOS bundle ID and Android package name (the same for each SeatMate app).
  appId: string;
  // URL paths the app handles, as patterns like "/place/*".
  paths: string[];
};

const appleTeamId = () => process.env.APPLE_TEAM_ID?.trim() || "";

// One or more fingerprints, comma separated (e.g. the Play App Signing key
// and an upload key), in the AA:BB:... form Play Console shows.
const androidFingerprints = () =>
  (process.env.ANDROID_CERT_SHA256 || "")
    .split(",")
    .map((value) => value.trim().toUpperCase())
    .filter(Boolean);

const json = (body: unknown) =>
  new Response(JSON.stringify(body), {
    headers: {
      "Content-Type": "application/json",
      // Apple's CDN fetches this file and caches it itself; keep ours short so
      // a fixed value takes effect quickly.
      "Cache-Control": "public, max-age=3600",
    },
  });

const notFound = () => new Response("Not found", { status: 404 });

export function appleAppSiteAssociation({ appId, paths }: AppLinkTarget) {
  const teamId = appleTeamId();
  if (!teamId) return notFound();

  return json({
    applinks: {
      details: [
        {
          appIDs: [`${teamId}.${appId}`],
          components: paths.map((path) => ({ "/": path })),
        },
      ],
    },
  });
}

export function androidAssetLinks({ appId }: AppLinkTarget) {
  const fingerprints = androidFingerprints();
  if (fingerprints.length === 0) return notFound();

  return json([
    {
      relation: ["delegate_permission/common.handle_all_urls"],
      target: {
        namespace: "android_app",
        package_name: appId,
        sha256_cert_fingerprints: fingerprints,
      },
    },
  ]);
}

export const CONSUMER_APP_LINKS: AppLinkTarget = {
  appId: "com.seatmate360.app",
  paths: ["/place/*"],
};

export const BUSINESS_APP_LINKS: AppLinkTarget = {
  appId: "com.seatmate360.business",
  paths: ["/staff/join/*"],
};
