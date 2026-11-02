import { useState } from "react";
import { Linking, Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { Image } from "expo-image";
import { AtSign, ChevronLeft, ChevronRight, X } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { type Barber, barberPhotoPath, initials, instagramUrl } from "@seatmate/shared/barbers";

import CutProgress from "@/components/cut-progress";
import { colors, PressableScale } from "@/components/ui";
import type { Table } from "@/lib/floor";
import { tap } from "@/lib/haptics";
import { absoluteImage } from "@/lib/places";

const photoUrl = (businessId: string, barber: Barber, index: number) =>
  absoluteImage(barberPhotoPath(businessId, barber.id, barber.photos[index]));

// The barbers at a barbershop, each with their chair's live cut progress and
// photos of their work, plus any chair nobody is linked to.
export default function Barbers({
  businessId,
  barbers,
  chairs,
}: {
  businessId: string;
  barbers: Barber[];
  chairs: Table[];
}) {
  const [viewer, setViewer] = useState<{ barber: Barber; index: number } | null>(null);
  const chairById = new Map(chairs.map((chair) => [chair.id, chair]));
  const linked = new Set(barbers.map((barber) => barber.chairId));
  const freeChairs = chairs.filter((chair) => !linked.has(chair.id));

  return (
    <View style={{ gap: 14, marginTop: 16 }}>
      {barbers.map((barber) => (
        <BarberCard
          key={barber.id}
          businessId={businessId}
          barber={barber}
          chair={chairById.get(barber.chairId)}
          onPhoto={(index) => setViewer({ barber, index })}
        />
      ))}
      {freeChairs.map((chair) => (
        <View key={chair.id} style={styles.card}>
          <Text style={styles.name}>{chair.name}</Text>
          <CutProgress seat={chair.seats[0]} style={{ marginTop: 14 }} />
        </View>
      ))}
      <PhotoViewer businessId={businessId} viewer={viewer} onChange={setViewer} />
    </View>
  );
}

function BarberCard({
  businessId,
  barber,
  chair,
  onPhoto,
  closeSpace = false,
}: {
  businessId: string;
  barber: Barber;
  chair: Table | undefined;
  onPhoto: (index: number) => void;
  // Leaves room at the top right for a close button.
  closeSpace?: boolean;
}) {
  return (
    <View style={styles.card}>
      <View style={[styles.head, closeSpace && { paddingRight: 40 }]}>
        {barber.photos.length > 0 ? (
          <Image source={{ uri: photoUrl(businessId, barber, 0) }} style={styles.avatar} transition={200} />
        ) : (
          <View style={[styles.avatar, styles.initials]}>
            <Text style={styles.initialsText}>{initials(barber.name)}</Text>
          </View>
        )}
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.name} numberOfLines={1}>
            {barber.name}
          </Text>
          {barber.instagram ? (
            <PressableScale
              accessibilityRole="link"
              accessibilityLabel={`${barber.name} on Instagram, ${barber.instagram}`}
              onPress={() => {
                tap();
                void Linking.openURL(instagramUrl(barber.instagram));
              }}
              hitSlop={6}
              style={styles.handle}
            >
              <AtSign size={14} color={colors.muted} />
              <Text style={styles.handleText} numberOfLines={1}>
                {barber.instagram}
              </Text>
            </PressableScale>
          ) : null}
        </View>
        {chair && !closeSpace && <Text style={styles.chair}>{chair.name}</Text>}
      </View>

      {barber.bio ? <Text style={styles.bio}>{barber.bio}</Text> : null}

      {chair ? (
        <CutProgress seat={chair.seats[0]} barber={barber} style={{ marginTop: 18 }} />
      ) : (
        <Text style={styles.away}>Not at a chair right now.</Text>
      )}

      {barber.photos.length > 0 && (
        <>
          <Text style={styles.photosLabel}>Recent cuts</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {barber.photos.map((photo, index) => (
              <PressableScale
                key={photo.id}
                accessibilityLabel={`Photo ${index + 1} of ${barber.photos.length} by ${barber.name}`}
                onPress={() => {
                  tap();
                  onPhoto(index);
                }}
                scaleTo={0.94}
              >
                <Image source={{ uri: photoUrl(businessId, barber, index) }} style={styles.thumb} transition={200} />
              </PressableScale>
            ))}
          </ScrollView>
        </>
      )}
    </View>
  );
}

// Full-screen photos of a barber's cuts, with arrows to page through them.
function PhotoViewer({
  businessId,
  viewer,
  onChange,
}: {
  businessId: string;
  viewer: { barber: Barber; index: number } | null;
  onChange: (viewer: { barber: Barber; index: number } | null) => void;
}) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const count = viewer?.barber.photos.length ?? 0;
  const step = (by: number) => viewer && onChange({ ...viewer, index: (viewer.index + by + count) % count });

  return (
    <Modal visible={viewer !== null} animationType="fade" transparent onRequestClose={() => onChange(null)}>
      {viewer && (
        <View style={[styles.viewer, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.viewerTop}>
            <Text style={styles.viewerTitle}>
              {viewer.barber.name}
              <Text style={styles.viewerCount}>{`   ${viewer.index + 1} / ${count}`}</Text>
            </Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={() => onChange(null)} style={styles.viewerButton}>
              <X size={22} color="#fff" />
            </Pressable>
          </View>
          <View style={styles.viewerBody}>
            <Image
              source={{ uri: photoUrl(businessId, viewer.barber, viewer.index) }}
              style={{ width: width - 32, height: width - 32, maxHeight: "100%", borderRadius: 18 }}
              contentFit="contain"
              accessibilityLabel={`Haircut by ${viewer.barber.name}`}
            />
          </View>
          {count > 1 && (
            <View style={styles.viewerNav}>
              <PressableScale accessibilityLabel="Previous photo" onPress={() => step(-1)} style={styles.navButton}>
                <ChevronLeft size={24} color={colors.ink} />
              </PressableScale>
              <PressableScale accessibilityLabel="Next photo" onPress={() => step(1)} style={styles.navButton}>
                <ChevronRight size={24} color={colors.ink} />
              </PressableScale>
            </View>
          )}
        </View>
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: "#fff", borderRadius: 24, borderWidth: 1, borderColor: colors.border, padding: 20 },
  head: { flexDirection: "row", alignItems: "center", gap: 14 },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.chip },
  initials: { backgroundColor: colors.ink, alignItems: "center", justifyContent: "center" },
  initialsText: { color: "#fff", fontWeight: "900", fontSize: 18 },
  name: { fontSize: 19, fontWeight: "900", color: colors.ink, letterSpacing: -0.3 },
  handle: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 3, alignSelf: "flex-start" },
  handleText: { fontSize: 15, fontWeight: "700", color: colors.muted },
  chair: {
    overflow: "hidden",
    backgroundColor: colors.chip,
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 5,
    fontSize: 13,
    fontWeight: "800",
    color: "#4b5563",
  },
  bio: { marginTop: 14, fontSize: 15, lineHeight: 22, color: "#4b5563" },
  away: { marginTop: 16, fontSize: 15, color: colors.faint },
  photosLabel: { marginTop: 20, marginBottom: 10, fontSize: 14, fontWeight: "800", color: colors.muted },
  thumb: { width: 92, height: 92, borderRadius: 14, backgroundColor: colors.chip },
  viewer: { flex: 1, backgroundColor: "rgba(0,0,0,0.94)" },
  viewerTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 18 },
  viewerTitle: { color: "#fff", fontSize: 17, fontWeight: "800" },
  viewerCount: { color: "rgba(255,255,255,0.6)", fontWeight: "600" },
  viewerButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(255,255,255,0.12)", alignItems: "center", justifyContent: "center" },
  viewerBody: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 16 },
  viewerNav: { flexDirection: "row", justifyContent: "center", gap: 18 },
  navButton: { width: 52, height: 52, borderRadius: 26, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" },
});

// One barber's card with its own photo viewer, for the floor plan's chair
// card (tap a chair to see who's cutting there).
export function BarberProfile({ businessId, barber, chair }: { businessId: string; barber: Barber; chair: Table | undefined }) {
  const [viewer, setViewer] = useState<{ barber: Barber; index: number } | null>(null);
  return (
    <>
      <BarberCard businessId={businessId} barber={barber} chair={chair} onPhoto={(index) => setViewer({ barber, index })} closeSpace />
      <PhotoViewer businessId={businessId} viewer={viewer} onChange={setViewer} />
    </>
  );
}
