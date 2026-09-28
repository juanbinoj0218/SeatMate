// Cover photos that businesses upload for their customer page.
//
// The photo is resized and compressed in the owner's browser and saved as a
// JPEG data URL in businessPhotos/{businessId} (no separate file storage
// needed). The customer site serves it from /api/place-photo/{businessId},
// cached by the CDN; `?v=` changes whenever a new photo is saved, so
// browsers pick it up straight away.

export const PHOTO_COLLECTION = "businessPhotos";

// Firestore documents max out at 1 MB; stay well under it.
export const MAX_PHOTO_DATA_LENGTH = 900_000;

export const placePhotoPath = (businessId: string, version: number) =>
  `/api/place-photo/${businessId}?v=${version}`;
