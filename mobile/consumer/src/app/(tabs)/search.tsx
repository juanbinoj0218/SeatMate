import { useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import Animated from "react-native-reanimated";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AnimatedNumber } from "@/components/animated-number";
import { BackIcon, BigIcons, CategoryIcon, CloseIcon, ForwardIcon, SearchIcon } from "@/components/icons";
import { PlaceCard } from "@/components/place-card";
import { PlaceListSkeleton } from "@/components/place-card-skeleton";
import { colors, EmptyState, layoutSpring, PressableScale, readable, RetryPanel, shadow, space } from "@/components/ui";
import { useFeatures } from "@/lib/features";
import { openNow } from "@/lib/format";
import { inCategory, openShare, sortByAvailability, usePlaces, type Category, type PlaceWithSeats } from "@/lib/places";
import { useNow } from "@/lib/use-now";

// Search starts from what you're up to ("Need to study?", "Going out?") and
// shows the places that fit right now. Typing searches every spot by name,
// type, street or ZIP instead.

type Question = {
  id: string;
  category: Exclude<Category, "all">;
  title: string;
  detail: string;
  // What the result count reads as, e.g. "3 with a table open".
  countLabel: string;
  pick: (place: PlaceWithSeats, now: number) => boolean;
  order: (places: PlaceWithSeats[], now: number) => PlaceWithSeats[];
};

const isOpen = (place: PlaceWithSeats, now: number) => openNow(place, now)?.open !== false;
const hasSeat = (place: PlaceWithSeats, now: number) => place.availableSeats > 0 && isOpen(place, now);

// Fullest first, so the liveliest bars lead; places without seat data last.
const busiestFirst = (places: PlaceWithSeats[]) =>
  [...places].sort((a, b) => (openShare(a) ?? 2) - (openShare(b) ?? 2) || a.name.localeCompare(b.name));

const QUESTIONS: Question[] = [
  {
    id: "study",
    category: "cafe",
    title: "Need to study or work?",
    detail: "Cafés with a table open right now",
    countLabel: "with a table open",
    pick: (place, now) => inCategory(place, "cafe") && hasSeat(place, now),
    order: sortByAvailability,
  },
  {
    id: "eat",
    category: "restaurant",
    title: "Grabbing a bite?",
    detail: "Restaurants where you can sit down now",
    countLabel: "with a table open",
    pick: (place, now) => inCategory(place, "restaurant") && hasSeat(place, now),
    order: sortByAvailability,
  },
  {
    id: "out",
    category: "bar",
    title: "Want to go out?",
    detail: "Bars open now, from packed to quiet",
    countLabel: "open now",
    pick: (place, now) => inCategory(place, "bar") && isOpen(place, now),
    order: busiestFirst,
  },
  {
    id: "haircut",
    category: "barbershop",
    title: "Need a haircut?",
    detail: "Barbershops with a chair free for a walk-in",
    countLabel: "with a chair free",
    pick: (place, now) => inCategory(place, "barbershop") && hasSeat(place, now),
    order: sortByAvailability,
  },
  {
    id: "bowling",
    category: "bowling",
    title: "Bowling night?",
    detail: "Bowling alleys open now",
    countLabel: "open now",
    pick: (place, now) => inCategory(place, "bowling") && isOpen(place, now),
    order: sortByAvailability,
  },
  {
    id: "seat",
    category: "available",
    title: "Just need a seat?",
    detail: "Anywhere with a seat open right now",
    countLabel: "with a seat open",
    pick: hasSeat,
    order: sortByAvailability,
  },
];

// Explore's category tiles open the matching question.
const questionFor = (category: string | undefined) => QUESTIONS.find((question) => question.category === category);

export default function SearchScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ category?: string; focus?: string }>();
  const now = useNow();
  const features = useFeatures();
  const { places, loading, error, retry } = usePlaces();
  const input = useRef<TextInput>(null);

  const [text, setText] = useState("");
  const [questionId, setQuestionId] = useState(questionFor(params.category)?.id ?? "");

  // Coming from a category tile or the search bar on Explore.
  const [lastCategoryParam, setLastCategoryParam] = useState(params.category);
  if (params.category !== lastCategoryParam) {
    setLastCategoryParam(params.category);
    const question = questionFor(params.category);
    if (question) {
      setQuestionId(question.id);
      setText("");
    }
  }

  useEffect(() => {
    if (params.focus) input.current?.focus();
  }, [params.focus]);

  const question = QUESTIONS.find((item) => item.id === questionId);
  const searching = text.trim() !== "";

  // Bowling only shows up once there's a bowling alley on SeatMate.
  const questions = useMemo(
    () => QUESTIONS.filter((item) => item.category !== "bowling" || places.some((place) => inCategory(place, "bowling"))),
    [places]
  );

  const counts = useMemo(
    () => Object.fromEntries(QUESTIONS.map((item) => [item.id, places.filter((place) => item.pick(place, now)).length])),
    [places, now]
  );

  const results = useMemo(() => {
    if (searching) {
      const words = text.trim().toLowerCase().split(/\s+/);
      return sortByAvailability(
        places.filter((place) => {
          const haystack = `${place.name} ${place.type} ${place.address} ${place.zipcode}`.toLowerCase();
          return words.every((word) => haystack.includes(word));
        }),
        now
      );
    }
    if (question) return question.order(places.filter((place) => question.pick(place, now)), now);
    return [];
  }, [places, text, searching, question, now]);

  const showList = searching || Boolean(question);

  const header = (
    <View>
      <Text style={styles.title}>Search</Text>

      <View style={styles.searchBox}>
        <SearchIcon size={22} color={colors.muted} />
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
          <PressableScale accessibilityLabel="Clear search" hitSlop={10} scaleTo={0.85} haptic onPress={() => setText("")}>
            <View style={styles.clear}>
              <CloseIcon size={14} color="#fff" />
            </View>
          </PressableScale>
        ) : null}
      </View>

      {error ? <RetryPanel title="Couldn't load places" text={error} onRetry={retry} style={{ marginTop: 24 }} /> : null}

      {!searching && !question && !error && (
        <>
          <Text style={styles.ask}>What are you up to?</Text>
          <View style={styles.questions}>
            {questions.map((item) => (
              <PressableScale
                key={item.id}
                accessibilityRole="button"
                accessibilityLabel={`${item.title} ${item.detail}. ${counts[item.id]} ${counts[item.id] === 1 ? "place" : "places"}.`}
                haptic
                scaleTo={0.98}
                onPress={() => setQuestionId(item.id)}
                style={styles.question}
              >
                <View style={styles.questionIcon}>
                  <CategoryIcon category={item.category} size={24} color={colors.ink} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.questionTitle}>{item.title}</Text>
                  <Text style={styles.questionDetail}>{item.detail}</Text>
                </View>
                {!loading && (
                  <Text style={[styles.questionCount, counts[item.id] > 0 && { color: colors.greenText }]}>
                    {counts[item.id]}
                  </Text>
                )}
                <ForwardIcon size={20} color={colors.faint} />
              </PressableScale>
            ))}
          </View>
        </>
      )}

      {showList && !error && (
        <View style={styles.resultsHead}>
          {question && !searching && (
            <>
              <PressableScale
                accessibilityLabel="Back to questions"
                haptic
                hitSlop={8}
                onPress={() => setQuestionId("")}
                style={styles.back}
              >
                <BackIcon size={18} color={colors.ink} />
                <Text style={styles.backText}>All questions</Text>
              </PressableScale>
              <Text style={styles.resultsTitle}>{question.title}</Text>
            </>
          )}
          {!loading && (
            <View
              style={styles.countRow}
              accessible
              accessibilityLabel={`${results.length} ${results.length === 1 ? "place" : "places"}`}
            >
              <AnimatedNumber value={results.length} style={styles.count} />
              <Text style={styles.count}>
                {` ${results.length === 1 ? "place" : "places"} ${searching ? "match" : question?.countLabel ?? ""}`}
              </Text>
            </View>
          )}
        </View>
      )}
    </View>
  );

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {loading && showList ? (
        <View style={[styles.pad, readable]}>
          {header}
          <PlaceListSkeleton count={2} />
        </View>
      ) : (
        // Cards glide to their new places as seats open and fill.
        <Animated.FlatList
          data={showList ? results : []}
          itemLayoutAnimation={layoutSpring}
          keyExtractor={(place) => place.slug}
          renderItem={({ item }) => <PlaceCard place={item} now={now} />}
          ItemSeparatorComponent={() => <View style={{ height: space.item + 8 }} />}
          ListHeaderComponent={header}
          ListEmptyComponent={
            !showList || error ? null : (
              <EmptyState
                icon={<BigIcons.noResults color={colors.muted} />}
                title={searching ? "Nothing matches yet" : "Nothing open right now"}
                text={
                  searching
                    ? features.suggestPlace
                      ? "Try another search, or ask for the place you had in mind."
                      : "Try another search."
                    : "Check back soon, or pick another question."
                }
                action={searching && features.suggestPlace ? "Suggest a place" : !searching ? "All questions" : undefined}
                onAction={() =>
                  searching
                    ? router.push({ pathname: "/suggest", params: { name: text.trim() } })
                    : setQuestionId("")
                }
              />
            )
          }
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={[styles.pad, readable, { paddingBottom: 48 }]}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.page },
  pad: { paddingHorizontal: space.gutter },
  title: { fontSize: 36, fontWeight: "900", color: colors.ink, letterSpacing: -1.2, marginTop: 24 },
  searchBox: {
    marginTop: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#fff",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 18,
    height: 60,
    ...shadow,
  },
  searchInput: { flex: 1, fontSize: 17, color: colors.ink, height: "100%" },
  clear: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.faint,
    alignItems: "center",
    justifyContent: "center",
  },
  ask: { fontSize: 22, fontWeight: "900", color: colors.ink, letterSpacing: -0.4, marginTop: 32, marginBottom: 14 },
  questions: { gap: 10 },
  question: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: "#fff",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  questionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.chip,
    alignItems: "center",
    justifyContent: "center",
  },
  questionTitle: { fontSize: 17, fontWeight: "900", color: colors.ink },
  questionDetail: { fontSize: 14, lineHeight: 19, color: colors.muted, marginTop: 3 },
  questionCount: { fontSize: 17, fontWeight: "900", color: colors.faint, fontVariant: ["tabular-nums"] },
  resultsHead: { marginTop: 24, marginBottom: 20 },
  back: { flexDirection: "row", alignItems: "center", gap: 2, alignSelf: "flex-start", marginLeft: -4, paddingVertical: 4 },
  backText: { fontSize: 15, fontWeight: "800", color: colors.ink },
  resultsTitle: { fontSize: 26, fontWeight: "900", color: colors.ink, letterSpacing: -0.6, marginTop: 10 },
  countRow: { flexDirection: "row", alignItems: "center", marginTop: 6 },
  count: { fontSize: 15, lineHeight: 20, fontWeight: "700", color: colors.muted },
});
