import { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BigIcons, CategoryIcon, SearchIcon, SeatMateMark } from "@/components/icons";
import LiveDot from "@/components/live-dot";
import { PlaceCard, PlaceRow, PlaceTile } from "@/components/place-card";
import { Banner, Button, colors, EmptyState, Loading, SectionHeader, shadow } from "@/components/ui";
import { firstName, useAccount } from "@/lib/account";
import { useFeatures } from "@/lib/features";
import { greeting, openNow } from "@/lib/format";
import { tap } from "@/lib/haptics";
import { CATEGORIES, sortByAvailability, usePlaces } from "@/lib/places";
import { useNow } from "@/lib/use-now";

// The opening tab: live open seats around town, categories, recently viewed
// places and every SeatMate spot.
export default function ExploreScreen() {
  const insets = useSafeAreaInsets();
  const now = useNow();
  const { places, loading, error } = usePlaces();
  const { user, profile } = useAccount();
  const features = useFeatures();

  const sorted = useMemo(() => sortByAvailability(places, now), [places, now]);

  // Places with a seat free that aren't closed right now.
  const openSeats = useMemo(
    () => sorted.filter((place) => place.availableSeats > 0 && openNow(place, now)?.open !== false).slice(0, 8),
    [sorted, now]
  );

  const totalOpen = places.reduce((total, place) => total + place.availableSeats, 0);
  const name = firstName(profile, user);
  const recent = user ? profile.recentlyViewed.slice(0, 4) : [];

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: 32 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.pad}>
        <View style={styles.topBar}>
          <View style={styles.brand}>
            <SeatMateMark size={30} />
            <Text style={styles.brandText}>SeatMate</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={user ? "Your account" : "Sign in"}
            onPress={() => (user ? router.navigate("/account") : router.push("/login"))}
            style={({ pressed }) => [styles.avatar, pressed && { opacity: 0.8 }]}
          >
            <Text style={styles.avatarText}>{user ? (name[0] || user.email?.[0] || "?").toUpperCase() : "Sign in"}</Text>
          </Pressable>
        </View>

        <Text style={styles.hello}>
          {greeting(now)}
          {name ? `, ${name}` : ""}
        </Text>
        <Text style={styles.headline}>Find a seat{"\n"}before you go.</Text>

        <Pressable
          accessibilityRole="search"
          accessibilityLabel="Search places"
          onPress={() => {
            tap();
            router.navigate({ pathname: "/search", params: { focus: String(Date.now()) } });
          }}
          style={({ pressed }) => [styles.search, pressed && { opacity: 0.9 }]}
        >
          <SearchIcon size={20} color={colors.muted} />
          <Text style={styles.searchText}>Cafés, bars, barbershops…</Text>
        </Pressable>

        {!loading && !error && places.length > 0 && (
          <View style={styles.liveStrip}>
            <LiveDot />
            <Text style={styles.liveText}>
              <Text style={{ fontWeight: "900", color: colors.ink }}>{totalOpen} open seats</Text> across{" "}
              {places.length} {places.length === 1 ? "place" : "places"} right now
            </Text>
          </View>
        )}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categories}>
        {CATEGORIES.filter((category) => category.value !== "all").map((category) => (
          <Pressable
            key={category.value}
            accessibilityRole="button"
            onPress={() => {
              tap();
              router.navigate({ pathname: "/search", params: { category: category.value } });
            }}
            style={({ pressed }) => [styles.category, pressed && { transform: [{ scale: 0.96 }] }]}
          >
            <View style={styles.categoryIcon}>
              <CategoryIcon category={category.value} size={22} />
            </View>
            <Text style={styles.categoryLabel}>{category.label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {loading ? (
        <View style={{ height: 260 }}>
          <Loading label="Finding open seats…" />
        </View>
      ) : error ? (
        <View style={styles.pad}>
          <Banner tone="error">{error}</Banner>
        </View>
      ) : places.length === 0 ? (
        <EmptyState icon={<BigIcons.chair color={colors.muted} />} title="No places yet" text="SeatMate spots will show up here as soon as they go live." />
      ) : (
        <>
          <View style={styles.pad}>
            <SectionHeader
              title="Open seats right now"
              action="See all"
              onAction={() => router.navigate({ pathname: "/search", params: { category: "available" } })}
            />
          </View>
          {openSeats.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.carousel}>
              {openSeats.map((place) => (
                <PlaceTile key={place.slug} place={place} now={now} />
              ))}
            </ScrollView>
          ) : (
            <View style={styles.pad}>
              <View style={styles.fullCard}>
                <Text style={styles.fullTitle}>Everywhere is full right now</Text>
                <Text style={styles.fullText}>
                  Open a place and tap “Email me when a seat opens” to hear the moment one frees up.
                </Text>
              </View>
            </View>
          )}

          {recent.length > 0 && (
            <View style={styles.pad}>
              <SectionHeader title="Jump back in" action="Account" onAction={() => router.navigate("/account")} />
              <View style={styles.recentCard}>
                {recent.map((item) => (
                  <PlaceRow key={item.slug} {...item} />
                ))}
              </View>
            </View>
          )}

          <View style={styles.pad}>
            <SectionHeader title="Every SeatMate spot" />
            <View style={{ gap: 16 }}>
              {sorted.map((place) => (
                <PlaceCard key={place.slug} place={place} now={now} />
              ))}
            </View>
          </View>
        </>
      )}

      {features.suggestPlace && (
        <View style={[styles.pad, { marginTop: 28 }]}>
          <View style={styles.suggest}>
            <Text style={styles.suggestTitle}>Don&apos;t see your spot?</Text>
            <Text style={styles.suggestText}>Tell us where you&apos;d like live seats next and we&apos;ll ask them to join.</Text>
            <Button title="Suggest a place" variant="green" onPress={() => router.push("/suggest")} style={{ marginTop: 16 }} />
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.page },
  pad: { paddingHorizontal: 20 },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  brand: { flexDirection: "row", alignItems: "center", gap: 8 },
  brandText: { fontSize: 20, fontWeight: "900", color: colors.ink, letterSpacing: -0.4 },
  avatar: {
    minWidth: 40,
    height: 40,
    borderRadius: 20,
    paddingHorizontal: 12,
    backgroundColor: colors.ink,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: "#fff", fontWeight: "900", fontSize: 14 },
  hello: { marginTop: 26, fontSize: 15, fontWeight: "700", color: colors.green },
  headline: { marginTop: 6, fontSize: 36, lineHeight: 40, fontWeight: "900", color: colors.ink, letterSpacing: -1.2 },
  search: {
    marginTop: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#fff",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 16,
    height: 54,
    ...shadow,
  },
  searchText: { fontSize: 16, color: colors.faint, fontWeight: "600" },
  liveStrip: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 16 },
  liveText: { fontSize: 14, color: colors.muted, flex: 1 },
  categories: { paddingHorizontal: 20, gap: 10, paddingTop: 20, paddingBottom: 4 },
  category: {
    width: 92,
    paddingVertical: 14,
    borderRadius: 20,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
  },
  categoryIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.chip,
    alignItems: "center",
    justifyContent: "center",
  },
  categoryLabel: { fontSize: 12, fontWeight: "800", color: colors.ink, marginTop: 6 },
  carousel: { paddingHorizontal: 20, gap: 14, paddingBottom: 8 },
  fullCard: { backgroundColor: colors.ink, borderRadius: 22, padding: 20 },
  fullTitle: { color: "#fff", fontSize: 18, fontWeight: "900" },
  fullText: { color: "rgba(255,255,255,0.65)", fontSize: 14, lineHeight: 20, marginTop: 6 },
  recentCard: {
    backgroundColor: "#fff",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  suggest: { backgroundColor: colors.ink, borderRadius: 26, padding: 22 },
  suggestTitle: { color: "#fff", fontSize: 22, fontWeight: "900", letterSpacing: -0.4 },
  suggestText: { color: "rgba(255,255,255,0.65)", fontSize: 15, lineHeight: 21, marginTop: 6 },
});
