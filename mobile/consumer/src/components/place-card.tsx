import { Pressable, StyleSheet, Text, View, type StyleProp, type TextStyle } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";

import { HeartIcon, PlaceTypeIcon } from "@/components/icons";
import { colors, shadow } from "@/components/ui";
import { useAccount } from "@/lib/account";
import {
  availabilityLabel,
  availabilityTone,
  openNow,
  shortAge,
  street,
  TONE_COLORS,
} from "@/lib/format";
import { tap } from "@/lib/haptics";
import { fallbackImageFor, placeImage, type PlaceWithSeats } from "@/lib/places";

export const openPlace = (slug: string) => router.push({ pathname: "/place/[slug]", params: { slug } });

// Live "8 of 12 open" pill, green / amber / red like the website.
export function SeatPill({ place, onDark = false }: { place: PlaceWithSeats; onDark?: boolean }) {
  const tone = availabilityTone(place);
  const look = TONE_COLORS[tone];

  if (!place.seatsLoaded) {
    return (
      <View style={[styles.pill, { backgroundColor: onDark ? "rgba(255,255,255,0.92)" : colors.chip }]}>
        <Text style={[styles.pillText, { color: colors.muted }]}>Checking seats…</Text>
      </View>
    );
  }

  return (
    <View style={[styles.pill, { backgroundColor: onDark ? "rgba(255,255,255,0.95)" : look.soft }]}>
      <View style={[styles.dot, { backgroundColor: look.dot }]} />
      <Text style={[styles.pillText, { color: look.text }]}>
        {place.totalSeats === 0 ? "No seats listed" : `${place.availableSeats} of ${place.totalSeats} open`}
      </Text>
    </View>
  );
}

// Heart in the corner of a photo.
export function SaveHeart({ place, size = 36 }: { place: PlaceWithSeats; size?: number }) {
  const { isFavorite, toggleFavorite } = useAccount();
  const saved = isFavorite(place.slug);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={saved ? `Remove ${place.name} from saved` : `Save ${place.name}`}
      accessibilityState={{ selected: saved }}
      hitSlop={8}
      onPress={() => {
        tap();
        toggleFavorite({
          slug: place.slug,
          name: place.name,
          address: place.address,
          type: place.type || "Restaurant",
          imageUrl: place.imageUrl,
        });
      }}
      style={({ pressed }) => [
        styles.heart,
        { width: size, height: size, borderRadius: size / 2 },
        pressed && { transform: [{ scale: 0.9 }] },
      ]}
    >
      <HeartIcon size={size * 0.55} color={saved ? colors.red : colors.ink} filled={saved} />
    </Pressable>
  );
}

function OpenBadge({ place, now }: { place: PlaceWithSeats; now: number }) {
  const status = openNow(place, now);
  if (!status) return null;

  return (
    <View style={[styles.openBadge, { backgroundColor: status.open ? "rgba(22,163,74,0.95)" : "rgba(17,24,39,0.75)" }]}>
      <Text style={styles.openText}>{status.open ? "Open now" : "Closed"}</Text>
    </View>
  );
}

// "☐ Café · 1815 J St" with the place type's icon.
export function TypeLine({
  type,
  address,
  style,
  color,
  size = 14,
}: {
  type: string;
  address?: string;
  style: StyleProp<TextStyle>;
  color: string;
  size?: number;
}) {
  return (
    <View style={styles.typeLine}>
      <PlaceTypeIcon type={type} size={size} color={color} strokeWidth={2} />
      <Text style={[style, { marginTop: 0, flexShrink: 1 }]} numberOfLines={1}>
        {type || "Restaurant"}
        {address ? `  ·  ${street(address)}` : ""}
      </Text>
    </View>
  );
}

// Full-width card with a photo, for lists.
export function PlaceCard({ place, now }: { place: PlaceWithSeats; now: number }) {
  const age = shortAge(place.latestUpdateMs, now);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${place.name}, ${availabilityLabel(place)}`}
      onPress={() => openPlace(place.slug)}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.photoWrap}>
        <Image
          source={{ uri: placeImage(place) }}
          placeholder={{ uri: fallbackImageFor(place.slug) }}
          contentFit="cover"
          transition={200}
          style={StyleSheet.absoluteFill}
          accessibilityIgnoresInvertColors
        />
        <LinearGradient colors={["rgba(0,0,0,0.25)", "transparent", "rgba(0,0,0,0.35)"]} style={StyleSheet.absoluteFill} />
        <View style={styles.photoTop}>
          <OpenBadge place={place} now={now} />
          <View style={{ flex: 1 }} />
          <SaveHeart place={place} size={40} />
        </View>
        <View style={styles.photoBottom}>
          <SeatPill place={place} onDark />
        </View>
      </View>

      <View style={styles.body}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Text style={styles.name} numberOfLines={1}>
            {place.name || "SeatMate location"}
          </Text>
        </View>
        <TypeLine type={place.type} address={place.address} style={styles.meta} color={colors.muted} size={15} />
        <View style={styles.footer}>
          <Text style={[styles.label, { color: TONE_COLORS[availabilityTone(place)].text }]}>
            {place.seatsLoaded ? availabilityLabel(place) : " "}
          </Text>
          {age ? <Text style={styles.age}>Updated {age}</Text> : null}
        </View>
        {place.totalSeats > 0 ? <SeatBar place={place} /> : null}
      </View>
    </Pressable>
  );
}

// Thin bar of open vs taken seats.
export function SeatBar({ place, dark = false }: { place: PlaceWithSeats; dark?: boolean }) {
  const share = place.totalSeats > 0 ? place.availableSeats / place.totalSeats : 0;
  const look = TONE_COLORS[availabilityTone(place)];

  return (
    <View style={[styles.bar, dark && { backgroundColor: "rgba(255,255,255,0.12)" }]}>
      <View style={[styles.barFill, { width: `${Math.round(share * 100)}%`, backgroundColor: look.dot }]} />
    </View>
  );
}

// Smaller card for horizontal carousels on the Explore tab.
export function PlaceTile({ place, now }: { place: PlaceWithSeats; now: number }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${place.name}, ${availabilityLabel(place)}`}
      onPress={() => openPlace(place.slug)}
      style={({ pressed }) => [styles.tile, pressed && styles.pressed]}
    >
      <View style={styles.tilePhoto}>
        <Image
          source={{ uri: placeImage(place) }}
          placeholder={{ uri: fallbackImageFor(place.slug) }}
          contentFit="cover"
          transition={200}
          style={StyleSheet.absoluteFill}
        />
        <LinearGradient colors={["transparent", "rgba(0,0,0,0.65)"]} style={StyleSheet.absoluteFill} />
        <View style={styles.photoTop}>
          <OpenBadge place={place} now={now} />
          <View style={{ flex: 1 }} />
          <SaveHeart place={place} size={36} />
        </View>
        <View style={styles.tileText}>
          <Text style={styles.tileName} numberOfLines={1}>
            {place.name || "SeatMate location"}
          </Text>
          <TypeLine type={place.type} style={styles.tileMeta} color="rgba(255,255,255,0.85)" size={14} />
        </View>
      </View>
      <View style={styles.tileFooter}>
        <SeatPill place={place} />
      </View>
    </Pressable>
  );
}

// Compact row without live data (recently viewed, saved places that are no
// longer listed).
export function PlaceRow({
  name,
  type,
  address,
  imageUrl,
  slug,
  right,
}: {
  name: string;
  type: string;
  address: string;
  imageUrl: string;
  slug: string;
  right?: React.ReactNode;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => openPlace(slug)}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.chip }]}
    >
      <Image
        source={{ uri: imageUrl || fallbackImageFor(name || slug) }}
        contentFit="cover"
        style={styles.rowPhoto}
      />
      <View style={{ flex: 1 }}>
        <Text style={styles.rowName} numberOfLines={1}>
          {name}
        </Text>
        <TypeLine type={type} address={address} style={styles.rowMeta} color={colors.muted} size={14} />
      </View>
      {right}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: 26,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow,
  },
  pressed: { transform: [{ scale: 0.985 }] },
  photoWrap: { height: 196, backgroundColor: "#e5e7eb" },
  photoTop: { position: "absolute", top: 14, left: 14, right: 14, flexDirection: "row", alignItems: "center" },
  photoBottom: { position: "absolute", left: 14, bottom: 14 },
  body: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 20 },
  name: { flex: 1, fontSize: 21, fontWeight: "900", color: colors.ink, letterSpacing: -0.4 },
  meta: { fontSize: 15, color: colors.muted },
  typeLine: { flexDirection: "row", alignItems: "center", gap: 7, marginTop: 6 },
  footer: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 18 },
  label: { fontSize: 15, fontWeight: "800" },
  age: { fontSize: 13, color: colors.faint, fontWeight: "600" },
  bar: { height: 8, borderRadius: 4, backgroundColor: colors.chip, marginTop: 12, overflow: "hidden" },
  barFill: { height: 8, borderRadius: 4 },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 7,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  pillText: { fontSize: 14, fontWeight: "800" },
  heart: {
    backgroundColor: "rgba(255,255,255,0.95)",
    alignItems: "center",
    justifyContent: "center",
    ...shadow,
  },
  openBadge: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  openText: { color: "#fff", fontSize: 13, fontWeight: "800" },
  tile: {
    width: 284,
    backgroundColor: colors.card,
    borderRadius: 24,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow,
  },
  tilePhoto: { height: 176, backgroundColor: "#e5e7eb" },
  tileText: { position: "absolute", left: 18, right: 18, bottom: 16 },
  tileName: { color: "#fff", fontSize: 20, fontWeight: "900", letterSpacing: -0.4 },
  tileMeta: { color: "rgba(255,255,255,0.85)", fontSize: 14, marginTop: 2, fontWeight: "600" },
  tileFooter: { paddingHorizontal: 16, paddingVertical: 14 },
  row: { flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 10 },
  rowPhoto: { width: 60, height: 60, borderRadius: 16, backgroundColor: "#e5e7eb" },
  rowName: { fontSize: 17, fontWeight: "800", color: colors.ink },
  rowMeta: { fontSize: 14, color: colors.muted, marginTop: 2 },
});
