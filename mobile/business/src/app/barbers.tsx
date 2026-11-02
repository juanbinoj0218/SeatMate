import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { router } from "expo-router";
import { AtSign, Pencil, Plus } from "lucide-react-native";

import type { Barber } from "@seatmate/shared/barbers";

import Avatar from "@/components/barber-avatar";
import CutProgress from "@/components/cut-progress";
import WrongAccount from "@/components/gate";
import { Banner, Button, Card, colors, Loading, Muted, PressableScale, Screen, Title } from "@/components/ui";
import { useBarberPhotos, useBarbers } from "@/lib/barbers";
import { watchTables, type Table } from "@/lib/floor";
import { useOwner } from "@/lib/session";

// Barbers: one profile per barber, linked to their chair. Customers see
// these on the shop's page with a live bar of how far along each cut is.
export default function BarbersScreen() {
  const owner = useOwner();
  const businessId = owner?.business.id;
  const { barbers, error } = useBarbers(businessId);
  const [chairs, setChairs] = useState<Table[]>([]);

  useEffect(() => {
    if (!businessId) return;
    return watchTables(
      businessId,
      (tables) => setChairs(tables.filter((table) => table.shape === "barberChair")),
      (caught) => console.error("Could not load chairs:", caught)
    );
  }, [businessId]);

  if (!owner) return <WrongAccount />;
  if (!barbers) return <Loading label="Loading barbers…" />;

  const chairById = new Map(chairs.map((chair) => [chair.id, chair]));

  return (
    <Screen>
      <Title>Barbers</Title>
      <Muted style={{ marginTop: 6 }}>
        Give each barber a profile and link it to their chair. Customers see who&apos;s cutting, their work, and how far
        along each cut is.
      </Muted>

      <Button
        title="Add barber"
        onPress={() => router.push("/barber")}
        style={{ marginTop: 18 }}
      />

      {error ? <Banner tone="error">{error}</Banner> : null}
      {chairs.length === 0 && (
        <Banner tone="warning">
          You haven&apos;t added any barber chairs yet. Add them in Shop layout so each barber can be linked to one.
        </Banner>
      )}

      {barbers.length === 0 ? (
        <Card style={styles.empty}>
          <Plus size={26} color={colors.faint} />
          <Text style={styles.emptyTitle}>No barbers yet</Text>
          <Muted style={{ textAlign: "center" }}>Add your first barber to show them on your SeatMate page.</Muted>
        </Card>
      ) : (
        barbers.map((barber) => (
          <BarberCard key={barber.id} businessId={owner.business.id} barber={barber} chair={chairById.get(barber.chairId)} />
        ))
      )}
    </Screen>
  );
}

function BarberCard({ businessId, barber, chair }: { businessId: string; barber: Barber; chair: Table | undefined }) {
  const photos = useBarberPhotos(businessId, barber.id);
  const first = barber.photos[0];

  return (
    <Card style={{ marginTop: 14 }}>
      <View style={styles.head}>
        <Avatar name={barber.name} uri={first ? photos[first.id] : undefined} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.name} numberOfLines={1}>
            {barber.name}
          </Text>
          {barber.instagram ? (
            <View style={styles.handle}>
              <AtSign size={13} color={colors.muted} />
              <Text style={styles.handleText} numberOfLines={1}>
                {barber.instagram}
              </Text>
            </View>
          ) : null}
          <Text style={styles.chair}>{chair ? chair.name : "No chair"}</Text>
        </View>
        <PressableScale
          accessibilityLabel={`Edit ${barber.name}`}
          haptic
          onPress={() => router.push({ pathname: "/barber", params: { id: barber.id } })}
          style={styles.edit}
        >
          <Pencil size={16} color={colors.ink} />
          <Text style={styles.editText}>Edit</Text>
        </PressableScale>
      </View>

      {barber.bio ? <Text style={styles.bio}>{barber.bio}</Text> : null}
      {chair && <CutProgress seat={chair.seats[0]} barber={barber} style={{ marginTop: 16 }} />}

      {barber.photos.length > 0 && (
        <View style={styles.photos}>
          {barber.photos.slice(0, 4).map((photo) => (
            <Image key={photo.id} source={photos[photo.id] ? { uri: photos[photo.id] } : undefined} style={styles.photo} />
          ))}
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  empty: { marginTop: 18, alignItems: "center", gap: 6, paddingVertical: 32 },
  emptyTitle: { fontWeight: "800", fontSize: 16, color: colors.ink },
  head: { flexDirection: "row", alignItems: "center", gap: 12 },
  name: { fontSize: 17, fontWeight: "800", color: colors.ink },
  handle: { flexDirection: "row", alignItems: "center", gap: 3, marginTop: 2 },
  handleText: { color: colors.muted, fontSize: 14 },
  chair: { color: colors.faint, fontSize: 13, fontWeight: "700", marginTop: 2 },
  edit: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  editText: { fontWeight: "700", color: colors.ink },
  bio: { marginTop: 12, color: "#4b5563", fontSize: 15, lineHeight: 21 },
  photos: { flexDirection: "row", gap: 8, marginTop: 16 },
  photo: { flex: 1, aspectRatio: 1, borderRadius: 12, backgroundColor: "#f3f4f6" },
});
