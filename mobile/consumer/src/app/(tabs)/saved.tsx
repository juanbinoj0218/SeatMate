import { ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import ReanimatedSwipeable from "react-native-gesture-handler/ReanimatedSwipeable";
import Animated, { SlideOutLeft, useAnimatedStyle, type SharedValue } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Trash2 } from "lucide-react-native";

import { BigIcons, HeartIcon } from "@/components/icons";
import { PlaceCard, PlaceRow } from "@/components/place-card";
import { PlaceListSkeleton } from "@/components/place-card-skeleton";
import { Banner, Button, colors, EmptyState, layoutSpring, PressableScale, readable, RetryPanel, space } from "@/components/ui";
import { useAccount, type SavedPlace } from "@/lib/account";
import { impact } from "@/lib/haptics";
import { usePlaces } from "@/lib/places";
import { useNow } from "@/lib/use-now";

// Places the customer saved, with live seats. The same list as "Saved" on
// seatmate360.com.
export default function SavedScreen() {
  const insets = useSafeAreaInsets();
  const now = useNow();
  const { user, authReady, favorites, profileReady, syncError, toggleFavorite } = useAccount();
  const { places, loading, error, retry } = usePlaces();

  const header = (
    <View>
      <Text style={styles.title}>Saved</Text>
      <Text style={styles.subtitle}>Your go-to spots, with live seats.</Text>
    </View>
  );

  if (!authReady) {
    return (
      <View style={[styles.screen, styles.pad, readable, { paddingTop: insets.top + 24 }]}>
        {header}
        <View style={{ marginTop: 28 }}>
          <PlaceListSkeleton count={2} />
        </View>
      </View>
    );
  }

  if (!user) {
    return (
      <ScrollView style={styles.screen} contentContainerStyle={[styles.pad, readable, { paddingTop: insets.top + 24, paddingBottom: 48 }]}>
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
    <ScrollView style={styles.screen} contentContainerStyle={[styles.pad, readable, { paddingTop: insets.top + 24, paddingBottom: 48 }]}>
      {header}
      {syncError ? <Banner tone="error">{syncError}</Banner> : null}

      {!profileReady || (loading && favorites.length > 0) ? (
        <View style={{ marginTop: 28 }}>
          <PlaceListSkeleton count={Math.min(Math.max(favorites.length, 1), 3)} />
        </View>
      ) : favorites.length === 0 ? (
        <EmptyState
          icon={<BigIcons.heart color={colors.red} />}
          title="Nothing saved yet"
          text="Tap the heart on any place to keep it here."
          action="Explore places"
          onAction={() => router.navigate("/")}
        />
      ) : error && places.length === 0 ? (
        <RetryPanel
          title="Couldn't load places"
          text={error}
          onRetry={retry}
          style={{ marginTop: 28 }}
        />
      ) : (
        <View style={{ marginTop: 28 }}>
          <Text style={styles.swipeHint}>Swipe a place to the left to remove it.</Text>
          {favorites.map((saved) => {
            const live = places.find((place) => place.slug === saved.slug);
            return (
              // The rest of the list closes the gap on a spring when one is removed.
              <Animated.View key={saved.slug} layout={layoutSpring} exiting={SlideOutLeft.duration(220)} style={styles.item}>
                <SwipeToRemove saved={saved} onRemove={() => toggleFavorite(saved)}>
                  {live ? (
                    <PlaceCard place={live} now={now} />
                  ) : (
                    <View style={styles.gone}>
                      <PlaceRow {...saved} />
                      <Text style={styles.goneText}>This place isn&apos;t on SeatMate right now.</Text>
                      <Button title="Remove" variant="secondary" onPress={() => toggleFavorite(saved)} style={{ marginTop: 16 }} />
                    </View>
                  )}
                </SwipeToRemove>
              </Animated.View>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

const ACTION_WIDTH = 104;

// Swipe a saved place left to show a red Remove button.
function SwipeToRemove({
  saved,
  onRemove,
  children,
}: {
  saved: SavedPlace;
  onRemove: () => void;
  children: React.ReactNode;
}) {
  return (
    <ReanimatedSwipeable
      friction={1.6}
      rightThreshold={ACTION_WIDTH / 2}
      overshootRight={false}
      // Room under the card so its shadow isn't clipped by the swipe area.
      containerStyle={{ paddingBottom: 18, marginBottom: -18, borderRadius: 24 }}
      onSwipeableWillOpen={() => impact()}
      renderRightActions={(_progress, translation, methods) => (
        <RemoveAction
          translation={translation}
          name={saved.name}
          onPress={() => {
            methods.close();
            onRemove();
          }}
        />
      )}
    >
      {children}
    </ReanimatedSwipeable>
  );
}

function RemoveAction({
  translation,
  name,
  onPress,
}: {
  translation: SharedValue<number>;
  name: string;
  onPress: () => void;
}) {
  // The button rides in with the card instead of sitting still behind it.
  const follow = useAnimatedStyle(() => ({
    transform: [{ translateX: Math.max(0, ACTION_WIDTH + translation.get()) }],
  }));

  return (
    <Animated.View style={[styles.actionWrap, follow]}>
      <PressableScale accessibilityLabel={`Remove ${name} from saved`} haptic onPress={onPress} style={styles.removeAction}>
        <Trash2 size={22} color="#fff" strokeWidth={2.2} />
        <Text style={styles.removeText}>Remove</Text>
      </PressableScale>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  item: { marginBottom: space.item + 8 },
  swipeHint: { fontSize: 14, color: colors.faint, marginBottom: 14 },
  actionWrap: { width: ACTION_WIDTH, paddingLeft: 12 },
  removeAction: {
    flex: 1,
    borderRadius: 24,
    backgroundColor: colors.red,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  removeText: { color: "#fff", fontSize: 14, fontWeight: "800" },
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
