import { PHOTO_COLLECTION } from "@seatmate/shared/place-photos";

// Serves a business's uploaded cover photo (stored as a data URL in
// Firestore) as a normal image. Links carry ?v=<save time>, so each version
// can be cached for a year by browsers and the CDN.

const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
const emulator = process.env.FIRESTORE_EMULATOR_HOST;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ businessId: string }> }
) {
  const { businessId } = await params;

  if (!projectId || !/^[\w-]{1,128}$/.test(businessId)) {
    return new Response("Not found", { status: 404 });
  }

  const url = new URL(
    `${emulator ? `http://${emulator}/v1` : "https://firestore.googleapis.com/v1"}/projects/${projectId}/databases/(default)/documents/${PHOTO_COLLECTION}/${businessId}`
  );
  if (apiKey && !emulator) url.searchParams.set("key", apiKey);

  const response = await fetch(url, { cache: "no-store" }).catch(() => null);

  if (!response?.ok) {
    return new Response("Not found", { status: 404 });
  }

  const document = (await response.json()) as { fields?: { data?: { stringValue?: string } } };
  const match = document.fields?.data?.stringValue?.match(/^data:(image\/(?:jpeg|png|webp));base64,(.+)$/);

  if (!match) {
    return new Response("Not found", { status: 404 });
  }

  return new Response(Buffer.from(match[2], "base64"), {
    headers: {
      "Content-Type": match[1],
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
