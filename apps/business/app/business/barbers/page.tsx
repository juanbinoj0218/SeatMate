"use client";

import { AtSign, ImagePlus, Pencil, Plus, Trash2, X } from "lucide-react";
import Link from "next/link";
import { ChangeEvent, useEffect, useRef, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from "firebase/firestore";

import {
  type Barber,
  BARBER_PHOTOS,
  BARBERS,
  cleanInstagram,
  CUT_MINUTE_CHOICES,
  DEFAULT_CUT_MINUTES,
  initials,
  MAX_BARBER_PHOTOS,
  MAX_BIO_LENGTH,
  MAX_NAME_LENGTH,
  readBarber,
  sortBarbers,
} from "@seatmate/shared/barbers";
import CutProgress from "@seatmate/shared/components/CutProgress";
import { db } from "@seatmate/shared/firebase";
import { readTable, type TableBase } from "@seatmate/shared/floor-docs";

import PortalHeader from "@/components/portal-header";
import { prepareSquarePhoto } from "@/lib/square-photo";
import { useOwnedBusiness } from "@/lib/use-business";

type Draft = { name: string; instagram: string; bio: string; chairId: string; cutMinutes: number };

const EMPTY: Draft = { name: "", instagram: "", bio: "", chairId: "", cutMinutes: DEFAULT_CUT_MINUTES };

const input =
  "w-full h-11 rounded-xl border border-gray-200 bg-white px-3 text-[15px] outline-none focus:border-[#101811] focus:ring-2 focus:ring-[#101811]/10";

// Barbers: one profile per barber (name, Instagram, a short bio, photos of
// past cuts), each linked to the chair they work at. Customers see these on
// the shop's page with a live bar of how far along each cut is.
export default function BarbersPage() {
  const { business, loading, error } = useOwnedBusiness();
  const businessId = business?.id;
  const [barbers, setBarbers] = useState<Barber[] | null>(null);
  const [chairs, setChairs] = useState<TableBase[]>([]);
  // "new", a barber's id, or null when nothing is being edited.
  const [editing, setEditing] = useState<string | null>(null);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    if (!businessId) return;
    const stopBarbers = onSnapshot(
      collection(db, "businesses", businessId, BARBERS),
      (snapshot) => setBarbers(sortBarbers(snapshot.docs.map((item) => readBarber(item.id, item.data())))),
      (caught) => {
        console.error("Could not load barbers:", caught);
        setLoadError("Couldn't load your barbers. Check your connection and refresh the page.");
        setBarbers([]);
      }
    );
    const stopChairs = onSnapshot(
      collection(db, "businesses", businessId, "tables"),
      (snapshot) =>
        setChairs(
          snapshot.docs
            .map((item, index) => readTable(item.id, item.data(), index))
            .filter((table) => table.shape === "barberChair")
            .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
        ),
      (caught) => console.error("Could not load chairs:", caught)
    );
    return () => {
      stopBarbers();
      stopChairs();
    };
  }, [businessId]);

  if (loading || (business && barbers === null)) {
    return (
      <main className="min-h-screen bg-[#f7f8f5]">
        <PortalHeader section="Barbers" />
        <p className="py-24 text-center text-gray-500">Loading barbers…</p>
      </main>
    );
  }

  if (!business || !businessId) {
    return (
      <main className="min-h-screen bg-[#f7f8f5] flex items-center justify-center p-6">
        <p className="text-gray-500 text-center">{error || "Couldn't load your business."}</p>
      </main>
    );
  }

  const list = barbers ?? [];
  const chairById = new Map(chairs.map((chair) => [chair.id, chair]));

  return (
    <main className="min-h-screen bg-[#f7f8f5]">
      <PortalHeader section="Barbers" />

      <div className="max-w-4xl mx-auto px-5 sm:px-8 py-10 sm:py-12">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">Barbers</h1>
            <p className="mt-2 max-w-xl text-gray-500">
              Give each barber a profile and link it to their chair. Customers see who&apos;s cutting, their work,
              and how far along each cut is.
            </p>
          </div>
          {editing !== "new" && (
            <button
              type="button"
              onClick={() => setEditing("new")}
              className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#101811] px-5 text-sm font-semibold text-white hover:bg-black"
            >
              <Plus aria-hidden className="h-4 w-4" />
              Add barber
            </button>
          )}
        </div>

        {loadError && (
          <p role="alert" className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {loadError}
          </p>
        )}

        {chairs.length === 0 && (
          <p className="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            You haven&apos;t added any barber chairs yet. Add them on the{" "}
            <Link href="/business/floor-plan" className="font-semibold underline underline-offset-2">
              shop layout
            </Link>{" "}
            so each barber can be linked to one.
          </p>
        )}

        <div className="mt-8 space-y-4">
          {editing === "new" && (
            <BarberEditor
              businessId={businessId}
              barber={null}
              barbers={list}
              chairs={chairs}
              onDone={(id) => setEditing(id)}
            />
          )}

          {list.map((barber) =>
            editing === barber.id ? (
              <BarberEditor
                key={barber.id}
                businessId={businessId}
                barber={barber}
                barbers={list}
                chairs={chairs}
                onDone={() => setEditing(null)}
              />
            ) : (
              <BarberRow
                key={barber.id}
                businessId={businessId}
                barber={barber}
                chair={chairById.get(barber.chairId)}
                onEdit={() => setEditing(barber.id)}
              />
            )
          )}

          {list.length === 0 && editing !== "new" && (
            <div className="rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-12 text-center">
              <p className="font-bold">No barbers yet</p>
              <p className="mt-1 text-sm text-gray-500">Add your first barber to show them on your SeatMate page.</p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

// Photos of a barber's cuts, read straight from Firestore (data URLs).
function usePhotoData(businessId: string, barberId: string | null) {
  const [data, setData] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!barberId) return;
    return onSnapshot(
      collection(db, "businesses", businessId, BARBERS, barberId, BARBER_PHOTOS),
      (snapshot) => {
        const next: Record<string, string> = {};
        snapshot.docs.forEach((item) => {
          const value = item.data().data;
          if (typeof value === "string") next[item.id] = value;
        });
        setData(next);
      },
      (caught) => console.error("Could not load photos:", caught)
    );
  }, [businessId, barberId]);

  return data;
}

function Avatar({ name, src, size = 56 }: { name: string; src?: string; size?: number }) {
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" className="shrink-0 rounded-full object-cover" style={{ width: size, height: size }} />
  ) : (
    <span
      className="flex shrink-0 items-center justify-center rounded-full bg-[#101811] font-bold text-white"
      style={{ width: size, height: size, fontSize: size * 0.32 }}
    >
      {initials(name)}
    </span>
  );
}

function BarberRow({
  businessId,
  barber,
  chair,
  onEdit,
}: {
  businessId: string;
  barber: Barber;
  chair: TableBase | undefined;
  onEdit: () => void;
}) {
  const photos = usePhotoData(businessId, barber.id);
  const first = barber.photos[0];

  return (
    <article className="rounded-2xl border border-gray-200 bg-white p-5">
      <div className="flex items-start gap-4">
        <Avatar name={barber.name} src={first ? photos[first.id] : undefined} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h2 className="text-lg font-bold">{barber.name}</h2>
            <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-semibold text-gray-600">
              {chair ? chair.name : "No chair"}
            </span>
          </div>
          {barber.instagram && (
            <p className="mt-0.5 inline-flex items-center gap-1 text-sm text-gray-500">
              <AtSign aria-hidden className="h-3.5 w-3.5" />
              {barber.instagram}
            </p>
          )}
          {barber.bio && <p className="mt-2 text-sm leading-6 text-gray-600">{barber.bio}</p>}
        </div>
        <button
          type="button"
          onClick={onEdit}
          className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-xl border border-gray-200 px-3.5 text-sm font-semibold hover:bg-gray-50"
        >
          <Pencil aria-hidden className="h-4 w-4" />
          Edit
        </button>
      </div>

      {chair && <CutProgress seat={chair.seats[0]} barber={barber} className="mt-5" />}

      {barber.photos.length > 0 && (
        <div className="mt-5 flex gap-2 overflow-x-auto">
          {barber.photos.map((photo) =>
            photos[photo.id] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={photo.id} src={photos[photo.id]} alt="" className="h-20 w-20 shrink-0 rounded-xl object-cover" />
            ) : (
              <span key={photo.id} className="h-20 w-20 shrink-0 rounded-xl bg-gray-100" />
            )
          )}
        </div>
      )}
    </article>
  );
}

function BarberEditor({
  businessId,
  barber,
  barbers,
  chairs,
  onDone,
}: {
  businessId: string;
  barber: Barber | null;
  barbers: Barber[];
  chairs: TableBase[];
  // The saved barber's id after creating one (to keep editing), else null.
  onDone: (createdId: string | null) => void;
}) {
  const [draft, setDraft] = useState<Draft>(() =>
    barber
      ? { name: barber.name, instagram: barber.instagram, bio: barber.bio, chairId: barber.chairId, cutMinutes: barber.cutMinutes }
      : { ...EMPTY, chairId: chairs.find((chair) => !barbers.some((item) => item.chairId === chair.id))?.id ?? "" }
  );
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const photos = usePhotoData(businessId, barber?.id ?? null);
  const fileRef = useRef<HTMLInputElement>(null);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((current) => ({ ...current, [key]: value }));
  const holder = barbers.find((item) => item.id !== barber?.id && item.chairId && item.chairId === draft.chairId);

  const save = async () => {
    const name = draft.name.trim();
    const instagram = cleanInstagram(draft.instagram);
    if (!name) return setMessage({ tone: "error", text: "Add the barber's name." });
    if (instagram === null) return setMessage({ tone: "error", text: "That doesn't look like an Instagram handle." });

    setBusy(true);
    setMessage(null);
    try {
      const barbersRef = collection(db, "businesses", businessId, BARBERS);
      const ref = barber ? doc(barbersRef, barber.id) : doc(barbersRef);
      const batch = writeBatch(db);
      const fields = {
        name,
        instagram,
        bio: draft.bio.trim().slice(0, MAX_BIO_LENGTH),
        chairId: draft.chairId,
        cutMinutes: draft.cutMinutes,
        updatedAt: serverTimestamp(),
      };

      if (barber) batch.update(ref, fields);
      else
        batch.set(ref, {
          ...fields,
          photos: [],
          order: barbers.reduce((max, item) => Math.max(max, item.order + 1), 0),
          createdAt: serverTimestamp(),
        });

      // A chair has one barber: moving someone here frees it from the other.
      if (holder) batch.update(doc(barbersRef, holder.id), { chairId: "", updatedAt: serverTimestamp() });

      await batch.commit();

      if (barber) onDone(null);
      else {
        onDone(ref.id);
        setMessage({ tone: "ok", text: "Saved. Now add a few photos of their cuts." });
      }
    } catch (caught) {
      console.error("Could not save barber:", caught);
      setMessage({ tone: "error", text: "We couldn't save that. Please try again." });
    } finally {
      setBusy(false);
    }
  };

  const addPhotos = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (!barber || files.length === 0) return;

    const room = MAX_BARBER_PHOTOS - barber.photos.length;
    if (room <= 0) return setMessage({ tone: "error", text: `Up to ${MAX_BARBER_PHOTOS} photos per barber. Remove one first.` });

    setBusy(true);
    setMessage(null);
    let list = barber.photos;
    try {
      for (const file of files.slice(0, room)) {
        if (!file.type.startsWith("image/")) continue;
        const data = await prepareSquarePhoto(file);
        const created = await addDoc(collection(db, "businesses", businessId, BARBERS, barber.id, BARBER_PHOTOS), {
          data,
          contentType: "image/jpeg",
          createdAt: serverTimestamp(),
        });
        list = [{ id: created.id, version: Date.now() }, ...list].slice(0, MAX_BARBER_PHOTOS);
        await updateDoc(doc(db, "businesses", businessId, BARBERS, barber.id), { photos: list, updatedAt: serverTimestamp() });
      }
      if (files.length > room) setMessage({ tone: "ok", text: `Added ${room}. Each barber can have up to ${MAX_BARBER_PHOTOS} photos.` });
    } catch (caught) {
      console.error("Could not add photo:", caught);
      setMessage({ tone: "error", text: "We couldn't add that photo. Try a JPG or PNG." });
    } finally {
      setBusy(false);
    }
  };

  const removePhoto = async (photoId: string) => {
    if (!barber) return;
    setBusy(true);
    try {
      await updateDoc(doc(db, "businesses", businessId, BARBERS, barber.id), {
        photos: barber.photos.filter((photo) => photo.id !== photoId),
        updatedAt: serverTimestamp(),
      });
      await deleteDoc(doc(db, "businesses", businessId, BARBERS, barber.id, BARBER_PHOTOS, photoId));
    } catch (caught) {
      console.error("Could not remove photo:", caught);
      setMessage({ tone: "error", text: "We couldn't remove that photo. Please try again." });
    } finally {
      setBusy(false);
    }
  };

  // Photos to the front of the list become the profile picture.
  const makeFirst = async (photoId: string) => {
    if (!barber) return;
    const photo = barber.photos.find((item) => item.id === photoId);
    if (!photo) return;
    await setDoc(
      doc(db, "businesses", businessId, BARBERS, barber.id),
      { photos: [photo, ...barber.photos.filter((item) => item.id !== photoId)], updatedAt: serverTimestamp() },
      { merge: true }
    ).catch((caught) => console.error("Could not reorder photos:", caught));
  };

  const remove = async () => {
    if (!barber || !window.confirm(`Remove ${barber.name}? Their profile and photos will be deleted.`)) return;
    setBusy(true);
    try {
      const photoDocs = await getDocs(collection(db, "businesses", businessId, BARBERS, barber.id, BARBER_PHOTOS));
      await Promise.all(photoDocs.docs.map((item) => deleteDoc(item.ref)));
      await deleteDoc(doc(db, "businesses", businessId, BARBERS, barber.id));
      onDone(null);
    } catch (caught) {
      console.error("Could not remove barber:", caught);
      setMessage({ tone: "error", text: "We couldn't remove this barber. Please try again." });
      setBusy(false);
    }
  };

  return (
    <section className="rounded-2xl border border-[#101811] bg-white p-5 sm:p-6" aria-label={barber ? `Edit ${barber.name}` : "New barber"}>
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-lg font-bold">{barber ? `Edit ${barber.name}` : "New barber"}</h2>
        <button
          type="button"
          onClick={() => onDone(null)}
          className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-gray-100"
          aria-label="Close"
        >
          <X aria-hidden className="h-5 w-5" />
        </button>
      </div>

      <div className="mt-5 grid gap-5 sm:grid-cols-2">
        <label className="block">
          <span className="text-sm font-semibold">Name</span>
          <input
            className={`${input} mt-1.5`}
            value={draft.name}
            maxLength={MAX_NAME_LENGTH}
            onChange={(event) => set("name", event.target.value)}
            placeholder="Marcus Reed"
          />
        </label>

        <label className="block">
          <span className="text-sm font-semibold">Instagram</span>
          <span className="relative mt-1.5 block">
            <AtSign aria-hidden className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              className={`${input} pl-9`}
              value={draft.instagram}
              maxLength={60}
              onChange={(event) => set("instagram", event.target.value)}
              placeholder="fades.by.marcus"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
            />
          </span>
        </label>

        <label className="block sm:col-span-2">
          <span className="flex items-baseline justify-between text-sm font-semibold">
            About
            <span className="text-xs font-normal text-gray-400 tabular-nums">
              {draft.bio.length}/{MAX_BIO_LENGTH}
            </span>
          </span>
          <textarea
            className={`${input} mt-1.5 h-24 resize-none py-2.5 leading-6`}
            value={draft.bio}
            maxLength={MAX_BIO_LENGTH}
            onChange={(event) => set("bio", event.target.value)}
            placeholder="Skin fades, tapers and beard work. 8 years behind the chair."
          />
        </label>

        <label className="block">
          <span className="text-sm font-semibold">Chair</span>
          <select className={`${input} mt-1.5`} value={draft.chairId} onChange={(event) => set("chairId", event.target.value)}>
            <option value="">No chair</option>
            {chairs.map((chair) => {
              const taken = barbers.find((item) => item.id !== barber?.id && item.chairId === chair.id);
              return (
                <option key={chair.id} value={chair.id}>
                  {chair.name}
                  {taken ? ` (now ${taken.name})` : ""}
                </option>
              );
            })}
          </select>
          {holder && <span className="mt-1.5 block text-xs text-amber-700">Saving moves {holder.name} off this chair.</span>}
        </label>

        <label className="block">
          <span className="text-sm font-semibold">Usual cut length</span>
          <select
            className={`${input} mt-1.5`}
            value={draft.cutMinutes}
            onChange={(event) => set("cutMinutes", Number(event.target.value))}
          >
            {CUT_MINUTE_CHOICES.map((value) => (
              <option key={value} value={value}>
                {value} minutes
              </option>
            ))}
          </select>
          <span className="mt-1.5 block text-xs text-gray-500">
            Used until SeatMate has timed a few cuts at their chair.
          </span>
        </label>
      </div>

      <div className="mt-6 border-t border-gray-100 pt-5">
        <div className="flex items-baseline justify-between gap-4">
          <p className="text-sm font-semibold">Photos of their cuts</p>
          <p className="text-xs text-gray-400 tabular-nums">
            {barber?.photos.length ?? 0}/{MAX_BARBER_PHOTOS}
          </p>
        </div>

        {!barber ? (
          <p className="mt-2 text-sm text-gray-500">Save the barber first, then add photos of their work.</p>
        ) : (
          <>
            <p className="mt-1 text-xs text-gray-500">The first photo is their profile picture. Photos are cropped square.</p>
            <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
              {barber.photos.map((photo, index) => (
                <div key={photo.id} className="group relative aspect-square overflow-hidden rounded-xl bg-gray-100">
                  {photos[photo.id] && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={photos[photo.id]} alt="" className="h-full w-full object-cover" />
                  )}
                  {index === 0 ? (
                    <span className="absolute bottom-1.5 left-1.5 rounded-full bg-white px-2 py-0.5 text-[11px] font-bold">Profile</span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void makeFirst(photo.id)}
                      disabled={busy}
                      className="absolute bottom-1.5 left-1.5 rounded-full bg-white/90 px-2 py-0.5 text-[11px] font-semibold opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100"
                    >
                      Use as profile
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => void removePhoto(photo.id)}
                    disabled={busy}
                    className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-white text-red-600 shadow-sm"
                    aria-label={`Remove photo ${index + 1}`}
                  >
                    <Trash2 aria-hidden className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}

              {barber.photos.length < MAX_BARBER_PHOTOS && (
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={busy}
                  className="flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-gray-300 text-gray-500 hover:border-gray-400 hover:text-[#101811] disabled:opacity-50"
                >
                  <ImagePlus aria-hidden className="h-6 w-6" />
                  <span className="text-xs font-semibold">{busy ? "Adding…" : "Add photos"}</span>
                </button>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/*" multiple onChange={addPhotos} className="hidden" />
          </>
        )}
      </div>

      {message && (
        <p
          role={message.tone === "error" ? "alert" : "status"}
          className={`mt-5 text-sm font-medium ${message.tone === "error" ? "text-red-600" : "text-green-700"}`}
        >
          {message.text}
        </p>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void save()}
          disabled={busy}
          className="h-11 rounded-xl bg-[#101811] px-5 text-sm font-semibold text-white hover:bg-black disabled:opacity-50"
        >
          {busy ? "Saving…" : barber ? "Save changes" : "Save barber"}
        </button>
        <button
          type="button"
          onClick={() => onDone(null)}
          disabled={busy}
          className="h-11 rounded-xl border border-gray-200 px-5 text-sm font-semibold hover:bg-gray-50 disabled:opacity-50"
        >
          Cancel
        </button>
        {barber && (
          <button
            type="button"
            onClick={() => void remove()}
            disabled={busy}
            className="ml-auto inline-flex h-11 items-center gap-1.5 rounded-xl px-4 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
          >
            <Trash2 aria-hidden className="h-4 w-4" />
            Remove barber
          </button>
        )}
      </div>
    </section>
  );
}
