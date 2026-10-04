import { ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BigIcons, HeartIcon } from "@/components/icons";
import { PlaceCard, PlaceRow } from "@/components/place-card";
import { Banner, Button, colors, EmptyState, Loading, space } from "@/components/ui";
import { useAccount } from "@/lib/account";
import { usePlaces } from "@/lib/places";
import { useNow } from "@/lib/use-now";

// Places the customer saved, with live seats. The same list as "Saved" on
// seatmate360.com.
export default function SavedScreen() {
  const insets = useSafeAreaInsets();
  const now = useNow();
  const { user, authReady, favorites, profileReady, syncError, toggleFavorite } = useAccount();
  const { places } = usePlaces();

  const header = (
    <View>
      <Text style={styles.title}>Saved</Text>
      <Text style={styles.subtitle}>Your go-to spots, with live seats.</Text>
    </View>
  );

  if (!authReady) {
    return <Loading />;
  }

  if (!user) {
    return (
      <ScrollView style={styles.screen} contentContainerStyle={[styles.pad, { paddingTop: insets.top + 24, paddingBottom: 48 }]}>
        {header}
        <View style={styles.signedOut}>
          <View style={styles.heartBubble}>
            <HeartIcon size={38} color={colors.red} filled />
          </View>
          <Text style={styles.signedOutTitle}>Keep your favorite spots handy</Text>
          <Text style={styles.signedOutText}>
            Sign in to save places and see their open seats at a glance, here and on seatmate360.com.
          </Text>
          <Button title="Sign in or create account" onPress={() => router.push("/login")} style={{ marginTop: 28, alignSelf: "stretch" }} />
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={[styles.pad, { paddingTop: insets.top + 24, paddingBottom: 48 }]}>
      {header}
      {syncError ? <Banner tone="error">{syncError}</Banner> : null}

      {!profileReady ? (
        <View style={{ height: 240 }}>
          <Loading />
        </View>
      ) : favorites.length === 0 ? (
        <EmptyState
          icon={<BigIcons.heart color={colors.red} />}
          title="Nothing saved yet"
          text="Tap the heart on any place to keep it here."
          action="Explore places"
          onAction={() => router.navigate("/")}
        />
      ) : (
        <View style={{ gap: space.item + 8, marginTop: 28 }}>
          {favorites.map((saved) => {
            const live = places.find((place) => place.slug === saved.slug);
            return live ? (
              <PlaceCard key={saved.slug} place={live} now={now} />
            ) : (
              <View key={saved.slug} style={styles.gone}>
                <PlaceRow {...saved} />
                <Text style={styles.goneText}>This place isn&apos;t on SeatMate right now.</Text>
                <Button title="Remove" variant="secondary" onPress={() => toggleFavorite(saved)} style={{ marginTop: 16 }} />
              </View>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.page },
  pad: { paddingHorizontal: space.gutter },
  title: { fontSize: 36, fontWeight: "900", color: colors.ink, letterSpacing: -1.2 },
  subtitle: { fontSize: 17, lineHeight: 24, color: colors.muted, marginTop: 6 },
  signedOut: {
    marginTop: 32,
    backgroundColor: "#fff",
    borderRadius: 28,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 28,
    paddingVertical: 36,
    alignItems: "center",
  },
  heartBubble: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: colors.redSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  signedOutTitle: { fontSize: 24, lineHeight: 30, fontWeight: "900", color: colors.ink, marginTop: 24, textAlign: "center", letterSpacing: -0.4 },
  signedOutText: { fontSize: 16, color: colors.muted, lineHeight: 24, marginTop: 10, textAlign: "center", maxWidth: 320 },
  gone: { backgroundColor: "#fff", borderRadius: 24, borderWidth: 1, borderColor: colors.border, padding: 20 },
  goneText: { fontSize: 15, lineHeight: 21, color: colors.muted, marginTop: 8 },
});
