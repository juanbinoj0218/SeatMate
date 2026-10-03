import { useEffect, useMemo, useRef, useState } from "react";
import { FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BigIcons, CategoryIcon, CloseIcon, SearchIcon } from "@/components/icons";
import { PlaceCard } from "@/components/place-card";
import { Banner, Chip, colors, EmptyState, Loading } from "@/components/ui";
import { useFeatures } from "@/lib/features";
import { openNow } from "@/lib/format";
import { tap } from "@/lib/haptics";
import { CATEGORIES, inCategory, sortByAvailability, usePlaces, type Category } from "@/lib/places";
import { useNow } from "@/lib/use-now";

type Sort = "availability" | "recent" | "name";

const SORTS: { value: Sort; label: string }[] = [
  { value: "availability", label: "Most open" },
  { value: "recent", label: "Just updated" },
  { value: "name", label: "A–Z" },
];

const isCategory = (value: unknown): value is Category => CATEGORIES.some((option) => option.value === value);

// Every SeatMate spot with live seats: search by name, type, street or ZIP,
// filter by category or "open now", and sort.
export default function SearchScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ category?: string; focus?: string }>();
  const now = useNow();
  const features = useFeatures();
  const { places, loading, error } = usePlaces();
  const input = useRef<TextInput>(null);

  const [text, setText] = useState("");
  const [category, setCategory] = useState<Category>(isCategory(params.category) ? params.category : "all");
  const [openOnly, setOpenOnly] = useState(false);
  const [sort, setSort] = useState<Sort>("availability");

  // Coming from a category tile or the search bar on Explore.
  const [lastCategoryParam, setLastCategoryParam] = useState(params.category);
  if (params.category !== lastCategoryParam) {
    setLastCategoryParam(params.category);
    if (isCategory(params.category)) setCategory(params.category);
  }

  useEffect(() => {
    if (params.focus) input.current?.focus();
  }, [params.focus]);

  const results = useMemo(() => {
    const words = text.trim().toLowerCase().split(/\s+/).filter(Boolean);

    let list = places.filter((place) => {
      if (!inCategory(place, category)) return false;
      if (openOnly && openNow(place, now)?.open === false) return false;
      const haystack = `${place.name} ${place.type} ${place.address} ${place.zipcode}`.toLowerCase();
      return words.every((word) => haystack.includes(word));
    });

    if (sort === "availability") list = sortByAvailability(list, now);
    if (sort === "recent") list = [...list].sort((a, b) => (b.latestUpdateMs ?? 0) - (a.latestUpdateMs ?? 0));
    if (sort === "name") list = [...list].sort((a, b) => a.name.localeCompare(b.name));

    return list;
  }, [places, text, category, openOnly, sort, now]);

  const filtered = text.trim() !== "" || category !== "all" || openOnly;

  const header = (
    <View>
      <Text style={styles.title}>Search</Text>

      <View style={styles.searchBox}>
        <SearchIcon size={20} color={colors.muted} />
        <TextInput
          ref={input}
          value={text}
          onChangeText={setText}
          placeholder="Name, type, street or ZIP"
          placeholderTextColor={colors.faint}
          returnKeyType="search"
          autoCorrect={false}
          style={styles.searchInput}
          accessibilityLabel="Search places"
        />
        {text ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Clear search" hitSlop={10} onPress={() => setText("")}>
            <View style={styles.clear}>
              <CloseIcon size={12} color="#fff" />
            </View>
          </Pressable>
        ) : null}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} style={styles.chipsRow}>
        {CATEGORIES.map((option) => (
          <Chip
            key={option.value}
            label={option.label}
            icon={<CategoryIcon category={option.value} size={16} color={category === option.value ? "#fff" : colors.ink} strokeWidth={2.1} />}
            active={category === option.value}
            onPress={() => setCategory(option.value)}
          />
        ))}
      </ScrollView>

      <View style={styles.toolbar}>
        <Pressable
          accessibilityRole="switch"
          accessibilityState={{ checked: openOnly }}
          onPress={() => {
            tap();
            setOpenOnly((value) => !value);
          }}
          style={[styles.toggle, openOnly && styles.toggleOn]}
        >
          <View style={[styles.toggleDot, openOnly && { backgroundColor: colors.greenBright }]} />
          <Text style={[styles.toggleText, openOnly && { color: "#fff" }]}>Open now</Text>
        </Pressable>

        <View style={styles.sorts}>
          {SORTS.map((option) => (
            <Pressable
              key={option.value}
              accessibilityRole="button"
              accessibilityState={{ selected: sort === option.value }}
              onPress={() => {
                tap();
                setSort(option.value);
              }}
              style={[styles.sort, sort === option.value && styles.sortActive]}
            >
              <Text style={[styles.sortText, sort === option.value && { color: colors.ink }]}>{option.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      {!loading && !error && (
        <Text style={styles.count}>
          {results.length} {results.length === 1 ? "place" : "places"}
          {filtered ? " match" : ""}
        </Text>
      )}
      {error ? <Banner tone="error">{error}</Banner> : null}
    </View>
  );

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {loading ? (
        <View style={styles.pad}>
          {header}
          <View style={{ height: 240 }}>
            <Loading label="Finding open seats…" />
          </View>
        </View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={(place) => place.slug}
          renderItem={({ item }) => <PlaceCard place={item} now={now} />}
          ItemSeparatorComponent={() => <View style={{ height: 16 }} />}
          ListHeaderComponent={header}
          ListEmptyComponent={
            error ? null : (
              <EmptyState
                icon={<BigIcons.noResults color={colors.muted} />}
                title="Nothing matches yet"
                text={
                  features.suggestPlace
                    ? "Try another search, or ask for the place you had in mind."
                    : "Try another search or a different filter."
                }
                action={features.suggestPlace ? "Suggest a place" : undefined}
                onAction={() =>
                  router.push({ pathname: "/suggest", params: text.trim() ? { name: text.trim() } : {} })
                }
              />
            )
          }
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={[styles.pad, { paddingBottom: 32 }]}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.page },
  pad: { paddingHorizontal: 20 },
  title: { fontSize: 32, fontWeight: "900", color: colors.ink, letterSpacing: -1, marginTop: 12 },
  searchBox: {
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    height: 52,
  },
  searchInput: { flex: 1, fontSize: 16, color: colors.ink, height: "100%" },
  clear: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.faint,
    alignItems: "center",
    justifyContent: "center",
  },
  chipsRow: { marginHorizontal: -20, marginTop: 14 },
  chips: { paddingHorizontal: 20, gap: 8 },
  toolbar: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 14, flexWrap: "wrap" },
  toggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#fff",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  toggleOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  toggleDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.faint },
  toggleText: { fontSize: 13, fontWeight: "800", color: colors.ink },
  sorts: { flexDirection: "row", backgroundColor: "#eceee9", borderRadius: 12, padding: 3, marginLeft: "auto" },
  sort: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 9 },
  sortActive: { backgroundColor: "#fff" },
  sortText: { fontSize: 12, fontWeight: "800", color: colors.muted },
  count: { fontSize: 13, fontWeight: "700", color: colors.muted, marginTop: 16, marginBottom: 12 },
});
