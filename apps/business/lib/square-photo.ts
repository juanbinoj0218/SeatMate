import { BARBER_PHOTO_SIZE, MAX_BARBER_PHOTO_DATA_LENGTH } from "@seatmate/shared/barbers";

// Center-crops a photo to a square, scales it down to at most 1080px and
// compresses it to JPEG, lowering quality/size until it fits in a Firestore
// document. Used for photos of a barber's past cuts.
export async function prepareSquarePhoto(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const sx = Math.round((bitmap.width - side) / 2);
  const sy = Math.round((bitmap.height - side) / 2);
  let size = Math.min(BARBER_PHOTO_SIZE, side);

  try {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;

      const context = canvas.getContext("2d");
      if (!context) throw new Error("Canvas is not available.");
      context.drawImage(bitmap, sx, sy, side, side, 0, 0, size, size);

      const quality = attempt < 4 ? 0.85 - attempt * 0.08 : 0.6;
      const dataUrl = canvas.toDataURL("image/jpeg", quality);
      if (dataUrl.length <= MAX_BARBER_PHOTO_DATA_LENGTH) return dataUrl;

      if (attempt >= 3) size = Math.round(size * 0.8);
    }
  } finally {
    bitmap.close();
  }

  throw new Error("This photo is too large even after compressing.");
}
