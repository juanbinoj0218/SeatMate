"use client";

import { ChangeEvent, useEffect, useRef, useState } from "react";
import {
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  writeBatch,
} from "firebase/firestore";

import { db } from "@seatmate/shared/firebase";
import {
  MAX_PHOTO_DATA_LENGTH,
  PHOTO_COLLECTION,
  placePhotoPath,
} from "@seatmate/shared/place-photos";

// "Cover photo" card on the floor plan page: the photo customers see on
// search results and at the top of the place page.

const MAX_WIDTH = 1600;
const ASPECT = 3 / 2;

// Center-crops to 3:2, scales down to at most 1600px wide and compresses to
// JPEG, lowering quality/size until it fits in a Firestore document.
async function prepareImage(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);

  let sw = bitmap.width;
  let sh = bitmap.height;
  let sx = 0;
  let sy = 0;

  if (sw / sh > ASPECT) {
    sw = Math.round(sh * ASPECT);
    sx = Math.round((bitmap.width - sw) / 2);
  } else {
    sh = Math.round(sw / ASPECT);
    sy = Math.round((bitmap.height - sh) / 2);
  }

  let width = Math.min(MAX_WIDTH, sw);

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = Math.round(width / ASPECT);

    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas is not available.");
    context.drawImage(bitmap, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);

    const quality = attempt < 4 ? 0.85 - attempt * 0.08 : 0.6;
    const dataUrl = canvas.toDataURL("image/jpeg", quality);

    if (dataUrl.length <= MAX_PHOTO_DATA_LENGTH) {
      bitmap.close();
      return dataUrl;
    }

    if (attempt >= 3) width = Math.round(width * 0.8);
  }

  bitmap.close();
  throw new Error("This photo is too large even after compressing.");
}

export default function CoverPhoto({ businessId }: { businessId: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [current, setCurrent] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  useEffect(() => {
    getDoc(doc(db, PHOTO_COLLECTION, businessId))
      .then((snapshot) => setCurrent(snapshot.exists() ? String(snapshot.data().data || "") || null : null))
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, [businessId]);

  const choose = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setMessage(null);

    if (!file.type.startsWith("image/")) {
      setMessage({ tone: "error", text: "Choose an image file (JPG, PNG, HEIC or WebP)." });
      return;
    }

    try {
      setBusy(true);
      setPending(await prepareImage(file));
    } catch (error) {
      console.error("Could not read photo:", error);
      setMessage({ tone: "error", text: "We couldn't read that photo. Try a JPG or PNG." });
    } finally {
      setBusy(false);
    }
  };

  // Saves the photo and points both the private and (if live) public
  // business documents at it.
  const updateListing = async (imageUrl: string | null) => {
    const businessRef = doc(db, "businesses", businessId);
    const business = (await getDoc(businessRef)).data() ?? {};
    const batch = writeBatch(db);
    const fields = imageUrl
      ? { imageUrl, imageUpdatedAt: serverTimestamp(), updatedAt: serverTimestamp() }
      : { imageUrl: deleteField(), imageUpdatedAt: serverTimestamp(), updatedAt: serverTimestamp() };

    batch.update(businessRef, fields);

    let live = false;

    if (business.status === "approved" && business.slug) {
      const publicRef = doc(db, "publicBusinesses", business.slug);
      if ((await getDoc(publicRef)).exists()) {
        batch.update(publicRef, fields);
        live = true;
      }
    }

    await batch.commit();
    return live;
  };

  const save = async () => {
    if (!pending) return;
    setBusy(true);
    setMessage(null);

    try {
      await setDoc(doc(db, PHOTO_COLLECTION, businessId), {
        data: pending,
        contentType: "image/jpeg",
        updatedAt: serverTimestamp(),
      });
      const live = await updateListing(placePhotoPath(businessId, Date.now()));

      setCurrent(pending);
      setPending(null);
      setMessage({
        tone: "ok",
        text: live
          ? "Photo saved. Customers will see it on your page and in search."
          : "Photo saved. It will show on your customer page once you're approved.",
      });
    } catch (error) {
      console.error("Could not save photo:", error);
      setMessage({ tone: "error", text: "We couldn't save the photo. Please try again." });
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    setMessage(null);

    try {
      await updateListing(null);
      await deleteDoc(doc(db, PHOTO_COLLECTION, businessId));
      setCurrent(null);
      setMessage({ tone: "ok", text: "Photo removed. Your page will use a stock photo." });
    } catch (error) {
      console.error("Could not remove photo:", error);
      setMessage({ tone: "error", text: "We couldn't remove the photo. Please try again." });
    } finally {
      setBusy(false);
    }
  };

  const shown = pending ?? current;

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-4 mt-8 flex flex-col sm:flex-row gap-5 sm:items-center">
      <div className="relative w-full sm:w-56 aspect-[3/2] shrink-0 overflow-hidden rounded-xl bg-gray-100">
        {shown ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={shown} alt="Cover photo preview" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-gray-400">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="h-7 w-7" aria-hidden="true">
              <rect x="3" y="5" width="18" height="14" rx="2" />
              <circle cx="8.5" cy="10" r="1.5" />
              <path d="m21 16-5-5-8 8" />
            </svg>
            <span className="text-xs font-semibold">{loaded ? "No photo yet" : "Loading…"}</span>
          </div>
        )}
        {pending && (
          <span className="absolute left-2 top-2 rounded-full bg-amber-400 px-2 py-0.5 text-[11px] font-bold text-amber-950">
            Not saved
          </span>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold tracking-wider text-gray-400">COVER PHOTO</p>
        <p className="font-bold mt-1">The photo customers see for your place</p>
        <p className="text-sm text-gray-500 mt-1">
          Shown in search results and at the top of your SeatMate page. A bright, wide shot of
          your space works best. We crop it to 3:2.
        </p>

        {message && (
          <p
            role={message.tone === "error" ? "alert" : "status"}
            className={`mt-3 text-sm font-medium ${message.tone === "error" ? "text-red-600" : "text-green-700"}`}
          >
            {message.text}
          </p>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          <input ref={inputRef} type="file" accept="image/*" onChange={choose} className="hidden" />

          {pending ? (
            <>
              <button
                type="button"
                onClick={save}
                disabled={busy}
                className="h-10 px-4 rounded-xl bg-green-600 hover:bg-green-700 text-white text-sm font-semibold disabled:opacity-50"
              >
                {busy ? "Saving…" : "Save photo"}
              </button>
              <button
                type="button"
                onClick={() => setPending(null)}
                disabled={busy}
                className="h-10 px-4 rounded-xl border border-gray-200 text-sm font-semibold hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                disabled={busy}
                className="h-10 px-4 rounded-xl bg-[#101811] hover:bg-black text-white text-sm font-semibold disabled:opacity-50"
              >
                {busy ? "Preparing…" : current ? "Change photo" : "Upload photo"}
              </button>
              {current && (
                <button
                  type="button"
                  onClick={remove}
                  disabled={busy}
                  className="h-10 px-4 rounded-xl border border-red-200 text-red-600 text-sm font-semibold hover:bg-red-50 disabled:opacity-50"
                >
                  Remove
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
