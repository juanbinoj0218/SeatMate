import { useEffect, useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { Image } from "expo-image";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { AtSign, ImagePlus, Minus, Plus, Trash2 } from "lucide-react-native";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  serverTimestamp,
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
  MAX_BARBER_PHOTOS,
  MAX_BIO_LENGTH,
  MAX_NAME_LENGTH,
} from "@seatmate/shared/barbers";

import WrongAccount from "@/components/gate";
import { Banner, Button, Card, colors, Field, Loading, Muted, PressableScale, Screen } from "@/components/ui";
import { pickPhotos, squarePhoto } from "@/lib/barber-photos";
import { useBarberPhotos, useBarbers } from "@/lib/barbers";
import { db } from "@/lib/firebase";
import { watchTables, type Table } from "@/lib/floor";
import { success, tap, warning } from "@/lib/haptics";
import { useOwner } from "@/lib/session";

// A new photo's entry on the barber; the version busts image caches.
const newPhoto = (id: string) => ({ id, version: Date.now() });

type Draft = { name: string; instagram: string; bio: string; chairId: string; cutMinutes: number };

// Add or edit one barber: name, Instagram, a short bio, their chair, their
// usual cut length and photos of their work. Photos save as soon as they're
// added; the rest saves with the button.
export default function BarberScreen() {
  const owner = useOwner();
  const businessId = owner?.business.id;
  const params = useLocalSearchParams<{ id?: string }>();
  const { barbers } = useBarbers(businessId);
  const [chairs, setChairs] = useState<Table[] | null>(null);

  useEffect(() => {
    if (!businessId) return;
    return watchTables(
      businessId,
      (tables) =>
        setChairs(
          tables
            .filter((table) => table.shape === "barberChair")
            .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
        ),
      (caught) => {
        console.error("Could not load chairs:", caught);
        setChairs([]);
      }
    );
  }, [businessId]);

  if (!owner || !businessId) return <WrongAccount />;
  if (!barbers || !chairs) return <Loading label="Loading barber…" />;
  if (params.id && !barbers.some((item) => item.id === params.id)) {
    return <Loading label="Loading barber…" />;
  }

  return <BarberForm businessId={businessId} startId={params.id} barbers={barbers} chairs={chairs} />;
}

function BarberForm({
  businessId,
  startId,
  barbers,
  chairs,
}: {
  businessId: string;
  startId: string | undefined;
  barbers: Barber[];
  chairs: Table[];
}) {
  // Set once a new barber is first saved, so photos can be added straight away.
  const [createdId, setCreatedId] = useState<string | undefined>();
  const id = startId || createdId;
  const barber = barbers.find((item) => item.id === id) ?? null;
  const photos = useBarberPhotos(businessId, barber?.id);
  const [draft, setDraft] = useState<Draft>(() =>
    barber
      ? { name: barber.name, instagram: barber.instagram, bio: barber.bio, chairId: barber.chairId, cutMinutes: barber.cutMinutes }
      : {
          name: "",
          instagram: "",
          bio: "",
          chairId: chairs.find((chair) => !barbers.some((item) => item.chairId === chair.id))?.id ?? "",
          cutMinutes: DEFAULT_CUT_MINUTES,
        }
  );
  const [busy, setBusy] = useState<"" | "save" | "photos" | "remove">("");
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft({ ...draft, [key]: value });
  const holder = barbers.find((item) => item.id !== barber?.id && item.chairId && item.chairId === draft.chairId);
  const minuteIndex = Math.max(0, CUT_MINUTE_CHOICES.indexOf(draft.cutMinutes));
  const barbersRef = collection(db, "businesses", businessId, BARBERS);

  const save = async () => {
    const name = draft.name.trim();
    const instagram = cleanInstagram(draft.instagram);
    if (!name) return setMessage({ tone: "error", text: "Add the barber's name." });
    if (instagram === null) return setMessage({ tone: "error", text: "That doesn't look like an Instagram handle." });

    setBusy("save");
    setMessage(null);
    try {
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
      success();

      if (barber) router.back();
      else {
        setCreatedId(ref.id);
        setMessage({ tone: "success", text: "Saved. Now add a few photos of their cuts." });
      }
    } catch (caught) {
      console.error("Could not save barber:", caught);
      warning();
      setMessage({ tone: "error", text: "We couldn't save that. Please try again." });
    } finally {
      setBusy("");
    }
  };

  const addPhotos = async () => {
    if (!barber) return;
    const room = MAX_BARBER_PHOTOS - barber.photos.length;
    if (room <= 0) return;

    setMessage(null);
    const picked = await pickPhotos(room).catch((caught) => {
      console.error("Could not open photos:", caught);
      return [] as const;
    });
    if (picked === "denied") {
      return setMessage({ tone: "error", text: "Allow SeatMate Business to use your photos in Settings to add them." });
    }
    if (picked.length === 0) return;

    setBusy("photos");
    let list = barber.photos;
    try {
      for (const asset of picked) {
        const data = await squarePhoto(asset);
        const created = await addDoc(collection(barbersRef, barber.id, BARBER_PHOTOS), {
          data,
          contentType: "image/jpeg",
          createdAt: serverTimestamp(),
        });
        list = [newPhoto(created.id), ...list].slice(0, MAX_BARBER_PHOTOS);
        await updateDoc(doc(barbersRef, barber.id), { photos: list, updatedAt: serverTimestamp() });
      }
      success();
    } catch (caught) {
      console.error("Could not add photo:", caught);
      warning();
      setMessage({ tone: "error", text: "We couldn't add that photo. Please try another." });
    } finally {
      setBusy("");
    }
  };

  const removePhoto = async (photoId: string) => {
    if (!barber) return;
    tap();
    try {
      await updateDoc(doc(barbersRef, barber.id), {
        photos: barber.photos.filter((photo) => photo.id !== photoId),
        updatedAt: serverTimestamp(),
      });
      await deleteDoc(doc(barbersRef, barber.id, BARBER_PHOTOS, photoId));
    } catch (caught) {
      console.error("Could not remove photo:", caught);
      setMessage({ tone: "error", text: "We couldn't remove that photo. Please try again." });
    }
  };

  const remove = async () => {
    if (!barber) return;
    setBusy("remove");
    try {
      const photoDocs = await getDocs(collection(barbersRef, barber.id, BARBER_PHOTOS));
      await Promise.all(photoDocs.docs.map((item) => deleteDoc(item.ref)));
      await deleteDoc(doc(barbersRef, barber.id));
      router.back();
    } catch (caught) {
      console.error("Could not remove barber:", caught);
      warning();
      setMessage({ tone: "error", text: "We couldn't remove this barber. Please try again." });
      setBusy("");
    }
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: barber ? barber.name : "New barber" }} />

      <Card>
        <Field
          label="Name"
          value={draft.name}
          maxLength={MAX_NAME_LENGTH}
          onChangeText={(value) => set("name", value)}
          placeholder="Marcus Reed"
          autoCapitalize="words"
        />

        <View style={{ marginTop: 14 }}>
          <Text style={styles.label}>Instagram</Text>
          <View style={styles.handleInput}>
            <AtSign size={17} color={colors.faint} />
            <TextInput
              value={draft.instagram}
              onChangeText={(value) => set("instagram", value)}
              placeholder="fades.by.marcus"
              placeholderTextColor={colors.faint}
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={60}
              style={styles.handleField}
            />
          </View>
        </View>

        <View style={{ marginTop: 14 }}>
          <View style={styles.labelRow}>
            <Text style={styles.label}>About</Text>
            <Text style={styles.count}>
              {draft.bio.length}/{MAX_BIO_LENGTH}
            </Text>
          </View>
          <TextInput
            value={draft.bio}
            onChangeText={(value) => set("bio", value)}
            placeholder="Skin fades, tapers and beard work. 8 years behind the chair."
            placeholderTextColor={colors.faint}
            maxLength={MAX_BIO_LENGTH}
            multiline
            style={styles.bio}
          />
        </View>
      </Card>

      <Card style={{ marginTop: 14 }}>
        <Text style={styles.label}>Chair</Text>
        {chairs.length === 0 ? (
          <Muted style={{ fontSize: 14 }}>Add barber chairs in Shop layout to link one.</Muted>
        ) : (
          <View style={styles.chips}>
            {[{ id: "", name: "No chair" }, ...chairs].map((chair) => {
              const selected = draft.chairId === chair.id;
              return (
                <PressableScale
                  key={chair.id || "none"}
                  accessibilityState={{ selected }}
                  haptic
                  onPress={() => set("chairId", chair.id)}
                  style={[styles.chip, selected && styles.chipSelected]}
                >
                  <Text style={[styles.chipText, selected && { color: "#fff" }]}>{chair.name}</Text>
                </PressableScale>
              );
            })}
          </View>
        )}
        {holder && <Text style={styles.move}>Saving moves {holder.name} off this chair.</Text>}

        <Text style={[styles.label, { marginTop: 20 }]}>Usual cut length</Text>
        <View style={styles.stepper}>
          <PressableScale
            accessibilityLabel="Shorter"
            haptic
            disabled={minuteIndex === 0}
            onPress={() => set("cutMinutes", CUT_MINUTE_CHOICES[minuteIndex - 1])}
            style={[styles.step, minuteIndex === 0 && { opacity: 0.4 }]}
          >
            <Minus size={18} color={colors.ink} />
          </PressableScale>
          <Text style={styles.minutes}>{draft.cutMinutes} min</Text>
          <PressableScale
            accessibilityLabel="Longer"
            haptic
            disabled={minuteIndex === CUT_MINUTE_CHOICES.length - 1}
            onPress={() => set("cutMinutes", CUT_MINUTE_CHOICES[minuteIndex + 1])}
            style={[styles.step, minuteIndex === CUT_MINUTE_CHOICES.length - 1 && { opacity: 0.4 }]}
          >
            <Plus size={18} color={colors.ink} />
          </PressableScale>
        </View>
        <Muted style={{ fontSize: 13, marginTop: 8 }}>Used until SeatMate has timed a few cuts at their chair.</Muted>
      </Card>

      <Card style={{ marginTop: 14 }}>
        <View style={styles.labelRow}>
          <Text style={styles.label}>Photos of their cuts</Text>
          <Text style={styles.count}>
            {barber?.photos.length ?? 0}/{MAX_BARBER_PHOTOS}
          </Text>
        </View>
        {!barber ? (
          <Muted style={{ fontSize: 14 }}>Save the barber first, then add photos of their work.</Muted>
        ) : (
          <>
            <Muted style={{ fontSize: 13 }}>The first photo is their profile picture. Photos are cropped square.</Muted>
            <View style={styles.grid}>
              {barber.photos.map((photo, index) => (
                <View key={photo.id} style={styles.tile}>
                  <Image source={photos[photo.id] ? { uri: photos[photo.id] } : undefined} style={StyleSheet.absoluteFill} />
                  {index === 0 && <Text style={styles.profileTag}>Profile</Text>}
                  <PressableScale
                    accessibilityLabel={`Remove photo ${index + 1}`}
                    onPress={() => void removePhoto(photo.id)}
                    hitSlop={6}
                    style={styles.removePhoto}
                  >
                    <Trash2 size={14} color={colors.redText} />
                  </PressableScale>
                </View>
              ))}
              {barber.photos.length < MAX_BARBER_PHOTOS && (
                <PressableScale
                  accessibilityLabel="Add photos"
                  haptic
                  disabled={busy !== ""}
                  onPress={() => void addPhotos()}
                  style={[styles.tile, styles.addTile]}
                >
                  <ImagePlus size={24} color={colors.muted} />
                  <Text style={styles.addText}>{busy === "photos" ? "Adding…" : "Add photos"}</Text>
                </PressableScale>
              )}
            </View>
          </>
        )}
      </Card>

      {message ? <Banner tone={message.tone}>{message.text}</Banner> : null}

      <Button
        title={barber ? "Save changes" : "Save barber"}
        onPress={() => void save()}
        busy={busy === "save"}
        disabled={busy !== "" && busy !== "save"}
        style={{ marginTop: 18 }}
      />

      {barber &&
        (confirmRemove ? (
          <View style={styles.confirm}>
            <Text style={styles.confirmText}>Remove {barber.name}? Their profile and photos will be deleted.</Text>
            <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
              <Button title="Keep" variant="secondary" onPress={() => setConfirmRemove(false)} style={{ flex: 1 }} />
              <Button title="Remove" variant="danger" onPress={() => void remove()} busy={busy === "remove"} style={{ flex: 1 }} />
            </View>
          </View>
        ) : (
          <Button title="Remove barber" variant="danger" onPress={() => setConfirmRemove(true)} style={{ marginTop: 10 }} />
        ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 14, fontWeight: "700", color: colors.ink, marginBottom: 6 },
  labelRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  count: { fontSize: 12, color: colors.faint, fontVariant: ["tabular-nums"] },
  handleInput: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    paddingHorizontal: 12,
    backgroundColor: "#fff",
  },
  handleField: { flex: 1, fontSize: 16, color: colors.ink, paddingVertical: 12 },
  bio: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 12,
    minHeight: 96,
    fontSize: 16,
    lineHeight: 22,
    color: colors.ink,
    textAlignVertical: "top",
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9, backgroundColor: "#fff" },
  chipSelected: { backgroundColor: colors.ink, borderColor: colors.ink },
  chipText: { fontWeight: "700", color: colors.ink },
  move: { marginTop: 8, fontSize: 13, color: "#b45309" },
  stepper: { flexDirection: "row", alignItems: "center", gap: 14 },
  step: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  minutes: { fontSize: 18, fontWeight: "800", color: colors.ink, minWidth: 70, textAlign: "center", fontVariant: ["tabular-nums"] },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  tile: { width: "31.5%", aspectRatio: 1, borderRadius: 12, overflow: "hidden", backgroundColor: "#f3f4f6" },
  addTile: {
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: "#d1d5db",
    backgroundColor: "#fff",
  },
  addText: { fontSize: 12, fontWeight: "700", color: colors.muted },
  profileTag: {
    position: "absolute",
    left: 6,
    bottom: 6,
    overflow: "hidden",
    backgroundColor: "#fff",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    fontSize: 11,
    fontWeight: "800",
    color: colors.ink,
  },
  removePhoto: {
    position: "absolute",
    right: 6,
    top: 6,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  confirm: { marginTop: 12, borderWidth: 1, borderColor: "#fecaca", backgroundColor: colors.redSoft, borderRadius: 16, padding: 14 },
  confirmText: { color: colors.redText, lineHeight: 20 },
});
