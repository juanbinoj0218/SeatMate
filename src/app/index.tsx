import { useEffect, useRef, useState } from "react";

import {
  ActivityIndicator,
  Animated,
  FlatList,
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { useRouter } from "expo-router";

import { Ionicons } from "@expo/vector-icons";

import {
  collection,
  getDocs,
  limit,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";

import { db } from "../lib/firebase";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const splashIcon = require("../../assets/images/splash-icon.png");

// -------------------------
// TYPES
// -------------------------

type Place = {
  slug: string;
  businessId: string;
  name: string;
  type: string;
  address: string;
  zipcode: string;
};

type SeatCounts = {
  total: number;
  available: number;
  // Free seats at each table (used for party size)
  tableFree: number[];
};

type Availability = {
  label: string;
  color: string;
  background: string;
  percentage: number;
};

// Party size options (4 means "4 or more")
const PARTY_SIZES = [1, 2, 3, 4];

// Same thresholds as the place page so the card and the page always agree
function getAvailability(counts: SeatCounts | undefined): Availability {
  if (!counts || counts.total === 0) {
    return {
      label: "No seating data",
      color: "#6B7280",
      background: "#F3F4F6",
      percentage: 0,
    };
  }

  const percentage = Math.round((counts.available / counts.total) * 100);

  if (percentage >= 60) {
    return {
      label: "Plenty of seating",
      color: "#16A34A",
      background: "#DCFCE7",
      percentage,
    };
  }

  if (percentage >= 25) {
    return {
      label: "Some seats available",
      color: "#CA8A04",
      background: "#FEF9C3",
      percentage,
    };
  }

  if (percentage > 0) {
    return {
      label: "Limited seating",
      color: "#EA580C",
      background: "#FFEDD5",
      percentage,
    };
  }

  return {
    label: "Currently full",
    color: "#DC2626",
    background: "#FEE2E2",
    percentage,
  };
}

// Does one table have enough free seats for the whole group?
function fitsParty(counts: SeatCounts | undefined, party: number) {
  if (!counts) {
    return false;
  }

  return counts.tableFree.some((free) => free >= party);
}

// -------------------------
// SCREEN
// -------------------------

export default function HomeScreen() {
  const router = useRouter();

  const [places, setPlaces] = useState<Place[]>([]);

  // Live seat counts, keyed by businessId
  const [counts, setCounts] = useState<Record<string, SeatCounts>>({});

  // Which businesses have outlets, keyed by businessId
  const [outlets, setOutlets] = useState<Record<string, boolean>>({});

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  // Filters
  const [party, setParty] = useState(1);
  const [availableOnly, setAvailableOnly] = useState(false);
  const [outletsOnly, setOutletsOnly] = useState(false);
  const [typeFilter, setTypeFilter] = useState<string | null>(null);

  // One live table listener per business
  const tableListeners = useRef(new Map<string, () => void>());

  // Businesses we've already checked for outlets
  const outletChecked = useRef(new Set<string>());

  // Load approved businesses (live)
  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "publicBusinesses"),

      (snapshot) => {
        const list: Place[] = snapshot.docs
          .filter((placeDoc) => placeDoc.data().verified !== false)
          .map((placeDoc) => {
            const data = placeDoc.data();

            return {
              slug: placeDoc.id,
              businessId: String(data.businessId ?? ""),
              name: String(data.name ?? "SeatMate location"),
              type: String(data.type ?? "Restaurant"),
              address: String(data.address ?? ""),
              zipcode: String(data.zipcode ?? ""),
            };
          })
          .filter((place) => place.businessId !== "")
          // A–Z keeps cards from jumping around while seats change live
          .sort((a, b) => a.name.localeCompare(b.name));

        setPlaces(list);
        setError("");
        setLoading(false);
      },

      (firebaseError) => {
        console.error("Business listener error:", firebaseError);
        setError("Could not load SeatMate locations.");
        setLoading(false);
      },
    );

    return unsubscribe;
  }, []);

  // Keep one live tables listener per business
  useEffect(() => {
    const listeners = tableListeners.current;

    const currentIds = new Set(places.map((place) => place.businessId));

    currentIds.forEach((businessId) => {
      if (listeners.has(businessId)) {
        return;
      }

      const unsubscribe = onSnapshot(
        collection(db, "businesses", businessId, "tables"),

        (snapshot) => {
          let total = 0;
          let available = 0;
          const tableFree: number[] = [];

          snapshot.docs.forEach((tableDoc) => {
            const seats = tableDoc.data().seats;

            if (!Array.isArray(seats)) {
              return;
            }

            let free = 0;

            seats.forEach((seat: { status?: string }) => {
              total += 1;

              if (seat?.status !== "occupied") {
                available += 1;
                free += 1;
              }
            });

            tableFree.push(free);
          });

          setCounts((previous) => ({
            ...previous,
            [businessId]: { total, available, tableFree },
          }));
        },

        (firebaseError) => {
          console.error(
            `Tables listener error (${businessId}):`,
            firebaseError,
          );
        },
      );

      listeners.set(businessId, unsubscribe);
    });

    // Stop listening to businesses that disappeared from the list
    listeners.forEach((unsubscribe, businessId) => {
      if (!currentIds.has(businessId)) {
        unsubscribe();
        listeners.delete(businessId);
      }
    });
  }, [places]);

  // Check once per business whether it has any outlets on its floor plan
  useEffect(() => {
    places.forEach((place) => {
      const id = place.businessId;

      if (outletChecked.current.has(id)) {
        return;
      }

      outletChecked.current.add(id);

      getDocs(
        query(
          collection(db, "businesses", id, "floorMarkers"),
          where("type", "==", "outlet"),
          limit(1),
        ),
      )
        .then((snapshot) => {
          setOutlets((previous) => ({ ...previous, [id]: !snapshot.empty }));
        })
        .catch((outletError) => {
          console.error(`Outlet check error (${id}):`, outletError);
        });
    });
  }, [places]);

  // Clean up every table listener when leaving the screen
  useEffect(() => {
    const listeners = tableListeners.current;

    return () => {
      listeners.forEach((unsubscribe) => unsubscribe());
      listeners.clear();
    };
  }, []);

  function openPlace(place: Place) {
    router.push({
      pathname: "/place/[slug]",
      params: { slug: place.slug, party: String(party) },
    });
  }

  // -------------------------
  // SEARCH + FILTERS
  // -------------------------

  const queryText = search.trim().toLowerCase();

  // Place types that actually exist (Café, Restaurant, ...)
  const placeTypes = Array.from(
    new Map(
      places.map((place) => [place.type.toLowerCase(), place.type]),
    ).values(),
  ).sort((a, b) => a.localeCompare(b));

  const visiblePlaces = places.filter((place) => {
    if (
      queryText !== "" &&
      ![place.name, place.type, place.address, place.zipcode].some((value) =>
        value.toLowerCase().includes(queryText),
      )
    ) {
      return false;
    }

    if (availableOnly && !fitsParty(counts[place.businessId], party)) {
      return false;
    }

    if (outletsOnly && !outlets[place.businessId]) {
      return false;
    }

    if (typeFilter && place.type.toLowerCase() !== typeFilter.toLowerCase()) {
      return false;
    }

    return true;
  });

  const filtersActive =
    queryText !== "" || availableOnly || outletsOnly || typeFilter !== null;

  function clearFilters() {
    setSearch("");
    setAvailableOnly(false);
    setOutletsOnly(false);
    setTypeFilter(null);
  }

  // -------------------------
  // LOADING
  // -------------------------

  if (loading) {
    return (
      <SafeAreaView style={styles.centerPage}>
        <View style={styles.logoBoxLarge}>
          <Image
            source={splashIcon}
            alt=""
            style={{ width: 44, height: 44, tintColor: "#FFFFFF" }}
            resizeMode="contain"
          />
        </View>

        <ActivityIndicator
          size="small"
          color="#6B7280"
          style={{ marginTop: 22 }}
        />

        <Text style={styles.loadingText}>Finding open seats…</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <FlatList
        data={visiblePlaces}
        keyExtractor={(place) => place.slug}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View>
            {/* HERO */}

            <View style={styles.hero}>
              <View style={styles.heroTop}>
                <View style={styles.brandRow}>
                  <View style={styles.logoBox}>
                    <Image
                      source={splashIcon}
                      alt=""
                      style={{ width: 28, height: 28, tintColor: "#FFFFFF" }}
                      resizeMode="contain"
                    />
                  </View>

                  <Text style={styles.brandName}>SeatMate</Text>
                </View>

                <View style={styles.livePill}>
                  <PulsingDot />
                  <Text style={styles.livePillText}>LIVE</Text>
                </View>
              </View>

              <Text style={styles.heroTitle}>
                Find a seat{"\n"}
                <Text style={styles.heroTitleAccent}>right now.</Text>
              </Text>

              <Text style={styles.heroSubtitle}>
                Live seating from local cafés and restaurants, updated by their
                staff.
              </Text>
            </View>

            {/* SEARCH */}

            <View style={styles.searchBar}>
              <Ionicons name="search" size={18} color="#9CA3AF" />

              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Search name, type, address or ZIP"
                placeholderTextColor="#9CA3AF"
                style={styles.searchInput}
                autoCorrect={false}
                autoCapitalize="none"
                returnKeyType="search"
              />

              {search !== "" && (
                <Pressable onPress={() => setSearch("")} hitSlop={10}>
                  <Ionicons name="close-circle" size={18} color="#9CA3AF" />
                </Pressable>
              )}
            </View>

            {/* PARTY SIZE */}

            <View style={styles.partyRow}>
              <View style={styles.partyLabelWrap}>
                <Ionicons name="people-outline" size={16} color="#6B7280" />
                <Text style={styles.partyLabel}>Group size</Text>
              </View>

              <View style={styles.partySegment}>
                {PARTY_SIZES.map((size) => {
                  const active = party === size;

                  return (
                    <Pressable
                      key={size}
                      onPress={() => setParty(size)}
                      style={({ pressed }) => [
                        styles.partyOption,
                        active ? styles.partyOptionActive : null,
                        pressed && !active ? { opacity: 0.6 } : null,
                      ]}
                    >
                      <Text
                        style={[
                          styles.partyOptionText,
                          active ? styles.partyOptionTextActive : null,
                        ]}
                      >
                        {size === 4 ? "4+" : size}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* FILTER CHIPS */}

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              style={styles.chipScroll}
              contentContainerStyle={styles.chipRow}
            >
              <FilterChip
                label={
                  party === 1
                    ? "Available now"
                    : `Table for ${party === 4 ? "4+" : party}`
                }
                icon="checkmark-circle-outline"
                active={availableOnly}
                onPress={() => setAvailableOnly((value) => !value)}
              />

              <FilterChip
                label="Has outlets"
                icon="flash-outline"
                active={outletsOnly}
                onPress={() => setOutletsOnly((value) => !value)}
              />

              {placeTypes.map((type) => (
                <FilterChip
                  key={type}
                  label={type}
                  active={typeFilter?.toLowerCase() === type.toLowerCase()}
                  onPress={() =>
                    setTypeFilter((current) =>
                      current?.toLowerCase() === type.toLowerCase()
                        ? null
                        : type,
                    )
                  }
                />
              ))}
            </ScrollView>

            {/* ERROR */}

            {error !== "" && (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle" size={18} color="#B91C1C" />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            {/* SECTION HEADING */}

            {places.length > 0 && (
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>
                  {filtersActive ? "Results" : "All places"}
                </Text>

                <View style={styles.sectionCount}>
                  <Text style={styles.sectionCountText}>
                    {visiblePlaces.length}
                  </Text>
                </View>

                <View style={{ flex: 1 }} />

                {filtersActive && (
                  <Pressable onPress={clearFilters} hitSlop={8}>
                    <Text style={styles.clearText}>Clear</Text>
                  </Pressable>
                )}
              </View>
            )}
          </View>
        }
        ListEmptyComponent={
          error !== "" ? null : places.length > 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIcon}>
                <Ionicons name="search" size={26} color="#9CA3AF" />
              </View>

              <Text style={styles.emptyTitle}>No matches</Text>

              <Text style={styles.emptyText}>
                {availableOnly && party > 1
                  ? `No place has a free table for ${party === 4 ? "4 or more" : party} right now.`
                  : "Nothing matches these filters right now."}
              </Text>

              <Pressable style={styles.clearButton} onPress={clearFilters}>
                <Text style={styles.clearButtonText}>Clear filters</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.bigEmoji}>🪑</Text>
              <Text style={styles.emptyTitle}>No locations yet</Text>
              <Text style={styles.emptyText}>
                {"SeatMate locations will show up here once they're approved."}
              </Text>
            </View>
          )
        }
        renderItem={({ item: place }) => (
          <PlaceCardView
            place={place}
            counts={counts[place.businessId]}
            hasOutlets={outlets[place.businessId] === true}
            party={party}
            onPress={() => openPlace(place)}
          />
        )}
      />
    </SafeAreaView>
  );
}

// -------------------------
// FILTER CHIP
// -------------------------

function FilterChip({
  label,
  icon,
  active,
  onPress,
}: {
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        active ? styles.chipActive : null,
        pressed ? { opacity: 0.7 } : null,
      ]}
    >
      {icon && (
        <Ionicons
          name={icon}
          size={14}
          color={active ? "#FFFFFF" : "#6B7280"}
          style={{ marginRight: 5 }}
        />
      )}

      <Text style={[styles.chipText, active ? styles.chipTextActive : null]}>
        {label}
      </Text>
    </Pressable>
  );
}

// -------------------------
// PULSING LIVE DOT
// -------------------------

function PulsingDot() {
  const [opacity] = useState(() => new Animated.Value(1));

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.25,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
      ]),
    );

    loop.start();

    return () => loop.stop();
  }, [opacity]);

  return <Animated.View style={[styles.liveDot, { opacity }]} />;
}

// -------------------------
// CARD
// -------------------------

function PlaceCardView({
  place,
  counts,
  hasOutlets,
  party,
  onPress,
}: {
  place: Place;
  counts: SeatCounts | undefined;
  hasOutlets: boolean;
  party: number;
  onPress: () => void;
}) {
  const baseAvailability = getAvailability(counts);

  const hasSeats = counts !== undefined && counts.total > 0;

  const fits = fitsParty(counts, party);

  const partyLabel = party === 4 ? "4+" : String(party);

  // For groups, the status is about finding one table for everyone
  const availability: Availability =
    party > 1 && counts !== undefined && hasSeats && !fits
      ? {
          label: `No table for ${partyLabel}`,
          color: "#9CA3AF",
          background: "#F3F4F6",
          percentage: baseAvailability.percentage,
        }
      : baseAvailability;

  const bestTable =
    counts && counts.tableFree.length > 0 ? Math.max(...counts.tableFree) : 0;

  let bottomText = "Checking seats…";

  if (counts !== undefined) {
    if (party === 1) {
      bottomText = `${counts.available} of ${counts.total} seats available`;
    } else if (fits) {
      bottomText = `Table for ${partyLabel} free · best table has ${bestTable}`;
    } else {
      bottomText = `${counts.available} seats free, but not together`;
    }
  }

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        pressed ? { opacity: 0.85, transform: [{ scale: 0.99 }] } : null,
      ]}
    >
      <View style={styles.cardTop}>
        {/* Seat badge */}

        <View
          style={[
            styles.seatBadge,
            {
              backgroundColor:
                counts === undefined ? "#F3F4F6" : availability.background,
            },
          ]}
        >
          {counts === undefined ? (
            <ActivityIndicator size="small" color="#9CA3AF" />
          ) : (
            <>
              <Text
                style={[styles.seatBadgeNumber, { color: availability.color }]}
              >
                {party === 1 ? counts.available : bestTable}
              </Text>

              <Text
                style={[styles.seatBadgeLabel, { color: availability.color }]}
              >
                {party === 1 ? "FREE" : "AT 1 TABLE"}
              </Text>
            </>
          )}
        </View>

        {/* Details */}

        <View style={styles.cardDetails}>
          <Text style={styles.cardName} numberOfLines={1}>
            {place.name}
          </Text>

          <View style={styles.cardMetaRow}>
            <View style={styles.typeChip}>
              <Text style={styles.typeChipText}>{place.type}</Text>
            </View>

            {hasOutlets && (
              <View style={styles.outletChip}>
                <Ionicons name="flash" size={10} color="#B08A2E" />
                <Text style={styles.outletChipText}>Outlets</Text>
              </View>
            )}

            {place.zipcode !== "" && (
              <Text style={styles.cardZip}>{place.zipcode}</Text>
            )}
          </View>

          {place.address !== "" && (
            <View style={styles.addressRow}>
              <Ionicons name="location-outline" size={13} color="#9CA3AF" />

              <Text style={styles.cardAddress} numberOfLines={1}>
                {place.address}
              </Text>
            </View>
          )}
        </View>

        <Ionicons name="chevron-forward" size={20} color="#D1D5DB" />
      </View>

      {/* Availability bar */}

      <View style={styles.progressTrack}>
        <View
          style={[
            styles.progressFill,
            {
              width: `${hasSeats ? Math.max(availability.percentage, 3) : 0}%`,
              backgroundColor: availability.color,
            },
          ]}
        />
      </View>

      <View style={styles.cardBottom}>
        <Text style={styles.seatCount} numberOfLines={1}>
          {bottomText}
        </Text>

        {counts !== undefined && (
          <Text style={[styles.statusText, { color: availability.color }]}>
            {availability.label}
          </Text>
        )}
      </View>
    </Pressable>
  );
}

// -------------------------
// STYLES
// -------------------------

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#F6F7F4" },

  listContent: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 50 },

  centerPage: {
    flex: 1,
    backgroundColor: "#F6F7F4",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },

  logoBoxLarge: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: "#000000",
    alignItems: "center",
    justifyContent: "center",
  },

  loadingText: { marginTop: 10, color: "#6B7280", fontSize: 14 },

  // HERO

  hero: {
    backgroundColor: "#101811",
    borderRadius: 30,
    padding: 22,
    paddingBottom: 20,
  },

  heroTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  brandRow: { flexDirection: "row", alignItems: "center" },

  logoBox: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: "#000000",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },

  brandName: {
    color: "#FFFFFF",
    fontSize: 19,
    fontWeight: "900",
    letterSpacing: -0.3,
  },

  livePill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(34,197,94,0.14)",
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },

  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#22C55E",
    marginRight: 6,
  },

  livePillText: {
    color: "#4ADE80",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.2,
  },

  heroTitle: {
    marginTop: 22,
    color: "#FFFFFF",
    fontSize: 40,
    lineHeight: 43,
    fontWeight: "900",
    letterSpacing: -1,
  },

  heroTitleAccent: { color: "#4ADE80" },

  heroSubtitle: {
    marginTop: 12,
    color: "#AEB6B0",
    fontSize: 14,
    lineHeight: 20,
  },

  heroStats: { flexDirection: "row", marginTop: 22 },

  heroStat: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 15,
  },

  heroStatNumber: { color: "#FFFFFF", fontSize: 26, fontWeight: "900" },

  heroStatLabel: {
    marginTop: 3,
    color: "rgba(255,255,255,0.45)",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.8,
  },

  // SEARCH

  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    paddingHorizontal: 15,
    height: 52,
    marginTop: 14,
  },

  searchInput: { flex: 1, marginLeft: 10, fontSize: 15, color: "#101811" },

  // PARTY SIZE

  partyRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    paddingLeft: 15,
    paddingRight: 6,
    height: 52,
  },

  partyLabelWrap: { flex: 1, flexDirection: "row", alignItems: "center" },

  partyLabel: {
    marginLeft: 8,
    color: "#374151",
    fontSize: 15,
    fontWeight: "600",
  },

  partySegment: {
    flexDirection: "row",
    backgroundColor: "#F3F4F1",
    borderRadius: 12,
    padding: 3,
  },

  partyOption: {
    width: 40,
    height: 34,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },

  partyOptionActive: { backgroundColor: "#101811" },

  partyOptionText: { color: "#4B5563", fontSize: 14, fontWeight: "700" },

  partyOptionTextActive: { color: "#FFFFFF" },

  // CHIPS

  chipScroll: { marginHorizontal: -16, marginTop: 12 },

  chipRow: { paddingHorizontal: 16 },

  chip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 999,
    paddingHorizontal: 13,
    paddingVertical: 8,
    marginRight: 8,
  },

  chipActive: { backgroundColor: "#101811", borderColor: "#101811" },

  chipText: { color: "#374151", fontSize: 13, fontWeight: "600" },

  chipTextActive: { color: "#FFFFFF" },

  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEF2F2",
    borderRadius: 16,
    padding: 14,
    marginTop: 14,
  },

  errorText: { marginLeft: 8, color: "#B91C1C", fontWeight: "700", flex: 1 },

  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 24,
    marginBottom: 2,
    paddingHorizontal: 4,
  },

  sectionTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: "#101811",
    letterSpacing: -0.3,
  },

  sectionCount: {
    marginLeft: 8,
    backgroundColor: "#E7EAE5",
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },

  sectionCountText: { fontSize: 12, fontWeight: "800", color: "#4B5563" },

  clearText: { color: "#16A34A", fontSize: 14, fontWeight: "700" },

  // CARD

  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#ECECE8",
    padding: 16,
    marginTop: 12,
  },

  cardTop: { flexDirection: "row", alignItems: "center" },

  seatBadge: {
    width: 64,
    height: 60,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },

  seatBadgeNumber: { fontSize: 24, lineHeight: 26, fontWeight: "900" },

  seatBadgeLabel: {
    fontSize: 7,
    fontWeight: "900",
    letterSpacing: 0.6,
    marginTop: 1,
  },

  cardDetails: { flex: 1, marginLeft: 14, marginRight: 6 },

  cardName: {
    fontSize: 18,
    fontWeight: "900",
    color: "#101811",
    letterSpacing: -0.2,
  },

  cardMetaRow: { flexDirection: "row", alignItems: "center", marginTop: 5 },

  typeChip: {
    backgroundColor: "#F0FDF4",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },

  typeChipText: { color: "#15803D", fontSize: 11, fontWeight: "800" },

  outletChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FBF6E6",
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 3,
    marginLeft: 6,
  },

  outletChipText: {
    marginLeft: 3,
    color: "#9C7318",
    fontSize: 11,
    fontWeight: "700",
  },

  cardZip: { marginLeft: 8, color: "#9CA3AF", fontSize: 12, fontWeight: "700" },

  addressRow: { flexDirection: "row", alignItems: "center", marginTop: 6 },

  cardAddress: { flex: 1, marginLeft: 4, color: "#6B7280", fontSize: 13 },

  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: "#F1F2EF",
    marginTop: 16,
    overflow: "hidden",
  },

  progressFill: { height: 6, borderRadius: 3 },

  cardBottom: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 9,
  },

  seatCount: {
    flex: 1,
    marginRight: 8,
    color: "#4B5563",
    fontSize: 12,
    fontWeight: "600",
  },

  statusText: { fontSize: 12, fontWeight: "800" },

  // EMPTY

  emptyState: { alignItems: "center", paddingTop: 40, paddingHorizontal: 20 },

  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: "#EEF0ED",
    alignItems: "center",
    justifyContent: "center",
  },

  bigEmoji: { fontSize: 48 },

  emptyTitle: {
    marginTop: 14,
    fontSize: 20,
    fontWeight: "900",
    color: "#101811",
  },

  emptyText: {
    marginTop: 6,
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 20,
  },

  clearButton: {
    marginTop: 16,
    backgroundColor: "#101811",
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 11,
  },

  clearButtonText: { color: "#FFFFFF", fontWeight: "700" },
});
