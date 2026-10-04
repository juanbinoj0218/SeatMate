import { StyleSheet, View } from "react-native";

import { colors, shadow, Skeleton, space } from "@/components/ui";

// Stand-ins for PlaceCard and PlaceTile (place-card.tsx) while places load,
// with the same outline so nothing jumps when the real cards arrive.

export function PlaceCardSkeleton() {
  return (
    <View style={styles.card} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Skeleton style={styles.photo} />
      <View style={styles.body}>
        <Skeleton style={{ height: 22, width: "62%", borderRadius: 8 }} />
        <Skeleton style={{ height: 15, width: "48%", borderRadius: 6, marginTop: 12 }} />
        <View style={styles.footer}>
          <Skeleton style={{ height: 15, width: 110, borderRadius: 6 }} />
          <Skeleton style={{ height: 13, width: 80, borderRadius: 6 }} />
        </View>
        <Skeleton style={{ height: 8, borderRadius: 4, marginTop: 12 }} />
      </View>
    </View>
  );
}

export function PlaceTileSkeleton() {
  return (
    <View style={styles.tile} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Skeleton style={styles.tilePhoto} />
      <View style={styles.tileFooter}>
        <Skeleton style={{ height: 30, width: 120, borderRadius: 999 }} />
      </View>
    </View>
  );
}

// A few cards in a column, for a list that's still loading.
export function PlaceListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <View accessibilityLabel="Loading places" accessibilityRole="progressbar" style={{ gap: space.item + 8 }}>
      {Array.from({ length: count }, (_, index) => (
        <PlaceCardSkeleton key={index} />
      ))}
    </View>
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
  photo: { height: 196, borderRadius: 0 },
  body: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 20 },
  footer: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 22 },
  tile: {
    width: 284,
    backgroundColor: colors.card,
    borderRadius: 24,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow,
  },
  tilePhoto: { height: 176, borderRadius: 0 },
  tileFooter: { paddingHorizontal: 16, paddingVertical: 14 },
});
