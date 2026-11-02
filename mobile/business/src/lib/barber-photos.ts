import * as ImagePicker from "expo-image-picker";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";

import { BARBER_PHOTO_SIZE, MAX_BARBER_PHOTO_DATA_LENGTH } from "@seatmate/shared/barbers";

// Lets the owner pick photos of a barber's cuts and turns each into a
// square JPEG data URL small enough for a Firestore document, the same as
// the web portal (apps/business/lib/square-photo.ts).

export async function pickPhotos(limit: number): Promise<ImagePicker.ImagePickerAsset[] | "denied"> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) return "denied";

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsMultipleSelection: limit > 1,
    selectionLimit: limit,
    quality: 1,
  });
  return result.canceled ? [] : result.assets.slice(0, limit);
}

export async function squarePhoto(asset: ImagePicker.ImagePickerAsset): Promise<string> {
  const side = Math.min(asset.width, asset.height);
  let size = Math.min(BARBER_PHOTO_SIZE, side);

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const context = ImageManipulator.manipulate(asset.uri)
      .crop({
        originX: Math.round((asset.width - side) / 2),
        originY: Math.round((asset.height - side) / 2),
        width: side,
        height: side,
      })
      .resize({ width: size, height: size });
    const image = await context.renderAsync();
    const saved = await image.saveAsync({
      format: SaveFormat.JPEG,
      compress: attempt < 4 ? 0.85 - attempt * 0.08 : 0.6,
      base64: true,
    });
    const dataUrl = `data:image/jpeg;base64,${saved.base64 ?? ""}`;
    if (saved.base64 && dataUrl.length <= MAX_BARBER_PHOTO_DATA_LENGTH) return dataUrl;
    if (attempt >= 3) size = Math.round(size * 0.8);
  }

  throw new Error("This photo is too large even after compressing.");
}
