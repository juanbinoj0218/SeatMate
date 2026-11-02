import { BARBER_PHOTOS, BARBERS } from "@seatmate/shared/barbers";

// Serves a photo of a barber's past cut (stored as a data URL in Firestore)
// as a normal image, like /api/place-photo. Photos never change once saved
// (a new photo gets a new id), so each can be cached for a year.

const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
const emulator = process.env.FIRESTORE_EMULATOR_HOST;

const ID = /^[\w-]{1,128}$/;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ businessId: string; barberId: string; photoId: string }> }
) {
  const { businessId, barberId, photoId } = await params;

  if (!projectId || ![businessId, barberId, photoId].every((id) => ID.test(id))) {
    return new Response("Not found", { status: 404 });
  }

  const url = new URL(
    `${emulator ? `http://${emulator}/v1` : "https://firestore.googleapis.com/v1"}/projects/${projectId}/databases/(default)/documents/businesses/${businessId}/${BARBERS}/${barberId}/${BARBER_PHOTOS}/${photoId}`
  );
  if (apiKey && !emulator) url.searchParams.set("key", apiKey);

  const response = await fetch(url, { cache: "no-store" }).catch(() => null);

  if (!response?.ok) {
    return new Response("Not found", { status: 404 });
  }

  const document = (await response.json()) as { fields?: { data?: { stringValue?: string } } };
  const match = document.fields?.data?.stringValue?.match(/^data:(image\/jpeg);base64,(.+)$/);

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
