import { useEffect, useMemo, useState } from "react";
import { Animated, Linking, Platform, Share, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { ScrollView as GestureScrollView } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { isBar, isBarbershop, isBowlingAlley, isGameMarker, type FloorMarker } from "@seatmate/shared/floor-plan";
import { elapsed } from "@seatmate/shared/table-geometry";

import { AnimatedNumber, SpringFill } from "@/components/animated-number";
import CrowdMeter from "@/components/crowd-meter";
import FloorView from "@/components/floor-view";
import { BackIcon, BigIcons, ClockIcon, DirectionsIcon, FloorPlanIcon, HeartIcon, PinIcon, PlaceTypeIcon, ScissorsIcon, ShareIcon } from "@/components/icons";
import LiveDot from "@/components/live-dot";
import SeatAlertButton from "@/components/seat-alert-button";
import { Button, colors, EmptyState, Loading, PressableScale, shadow, Skeleton, space } from "@/components/ui";
import { useAccount } from "@/lib/account";
import { countView } from "@/lib/analytics";
import { useFeatures } from "@/lib/features";
import { watchMarkers, watchTables, type Table } from "@/lib/floor";
import {
  availabilityLabel,
  availabilityTone,
  DAY_LABELS,
  formatHour,
  freshnessLabel,
  isStale,
  openNow,
  TONE_COLORS,
} from "@/lib/format";
import { tap } from "@/lib/haptics";
import { fallbackImageFor, placeImage, usePlace } from "@/lib/places";
import { consumerUrl } from "@/lib/site-urls";
import { useNow } from "@/lib/use-now";

// The page scroller takes part in gesture handling, so dragging a zoomed-in
// floor plan moves the map instead of scrolling the page.
const PageScroll = Animated.createAnimatedComponent(GestureScrollView);

// One place: live seat count, crowd and games, hours, and the business's
// live floor plan. Everything updates as staff change seats.
export default function PlaceScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const insets = useSafeAreaInsets();
  const { width, height: windowHeight } = useWindowDimensions();
  const now = useNow(15000);
  const features = useFeatures();
  const { place, loading, error } = usePlace(slug);
  const { profileReady, recordView, isFavorite, toggleFavorite, showToast } = useAccount();

  const [tables, setTables] = useState<Table[]>([]);
  const [markers, setMarkers] = useState<FloorMarker[]>([]);
  const [floorLoaded, setFloorLoaded] = useState(false);
  // Scroll position, for the header bar that fades in over the photo.
  const [scrollY] = useState(() => new Animated.Value(0));
  const businessId = place?.businessId ?? "";

  useEffect(() => {
    if (!businessId) return;
    const stopTables = watchTables(
      businessId,
      (next) => {
        setTables(next);
        setFloorLoaded(true);
      },
      (caught) => {
        console.error("Could not load tables:", caught);
        setFloorLoaded(true);
      }
    );
    const stopMarkers = watchMarkers(businessId, setMarkers, (caught) =>
      console.error("Could not load floor markers:", caught)
    );
    return () => {
      stopTables();
      stopMarkers();
    };
  }, [businessId]);

  const summary = useMemo(() => {
    let available = 0;
    let total = 0;
    let latest: number | null = null;
    tables.forEach((table) => {
      total += table.seats.length;
      available += table.seats.filter((seat) => seat.status === "available").length;
      if (table.occupancyUpdatedMs !== null && (latest === null || table.occupancyUpdatedMs > latest)) {
        latest = table.occupancyUpdatedMs;
      }
    });
    return { availableSeats: available, totalSeats: total, latestUpdateMs: latest as number | null };
  }, [tables]);

  const placeSummary = useMemo(
    () =>
      place
        ? { slug: place.slug, name: place.name, address: place.address, type: place.type || "Restaurant", imageUrl: place.imageUrl }
        : null,
    [place]
  );

  // Add to "Recently viewed" for signed-in customers.
  useEffect(() => {
    if (placeSummary && profileReady) recordView(placeSummary);
  }, [placeSummary, profileReady, recordView]);

  // Count one view per place per launch for the business's analytics.
  useEffect(() => {
    if (place?.slug) countView(place.slug);
  }, [place?.slug]);

  if (!place) {
    if (loading) return <PlaceSkeleton />;
    return (
      <View style={[styles.screen, { paddingTop: insets.top + 60 }]}>
        <EmptyState
          icon={<BigIcons.chair color={colors.muted} />}
          title={error ? "Couldn't load this place" : "Location not found"}
          text={error || "This SeatMate location doesn't exist or isn't listed right now."}
          action="Back to Explore"
          onAction={() => (router.canGoBack() ? router.back() : router.replace("/"))}
        />
      </View>
    );
  }

  const saved = isFavorite(place.slug);
  const status = openNow(place, now);
  const tone = availabilityTone(summary);
  const percentage = summary.totalSeats ? Math.round((summary.availableSeats / summary.totalSeats) * 100) : 0;
  const stale = isStale(summary.latestUpdateMs, now);
  const games = markers.filter((marker) => isGameMarker(marker.type));
  const chairs = isBarbershop(place.type) ? tables.filter((table) => table.shape === "barberChair") : [];
  const contentWidth = Math.min(width, 760) - space.gutter * 2;
  const pageUrl = consumerUrl(`/place/${place.slug}`);
  const heroHeight = 250 + insets.top;
  // The map may take most of the screen, leaving room for the header and seat count.
  const floorHeight = Math.max(240, Math.round(windowHeight * 0.6));

  const share = async () => {
    tap();
    const message = `See open seats at ${place.name} right now on SeatMate.`;
    try {
      await Share.share(Platform.OS === "ios" ? { message, url: pageUrl } : { message: `${message} ${pageUrl}`, title: place.name });
    } catch {
      // No share sheet (most desktop browsers): copy the link instead.
      await Clipboard.setStringAsync(pageUrl).catch(() => {});
      showToast("Link copied");
    }
  };

  const directions = () => {
    tap();
    const destination = encodeURIComponent(place.address || place.name);
    const url =
      Platform.OS === "ios"
        ? `http://maps.apple.com/?daddr=${destination}`
        : `https://www.google.com/maps/dir/?api=1&destination=${destination}`;
    Linking.openURL(url).catch(() => showToast("Couldn't open maps."));
  };

  return (
    <View style={styles.screen}>
      <PageScroll
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 48 }}
        scrollEventThrottle={16}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })}
      >
        <View style={[styles.hero, { height: heroHeight }]}>
          <Image
            source={{ uri: placeImage(place) }}
            placeholder={{ uri: fallbackImageFor(place.slug) }}
            contentFit="cover"
            transition={250}
            style={StyleSheet.absoluteFill}
            accessibilityLabel={`${place.name} interior`}
          />
          <LinearGradient
            colors={["rgba(0,0,0,0.45)", "rgba(0,0,0,0.05)", "rgba(0,0,0,0.8)"]}
            locations={[0, 0.4, 1]}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.heroText}>
            <View style={styles.heroBadges}>
              <View style={styles.liveBadge}>
                <LiveDot size={8} />
                <Text style={styles.liveBadgeText}>LIVE</Text>
              </View>
              <View style={styles.typeBadge}>
                <PlaceTypeIcon type={place.type} size={14} color={colors.ink} strokeWidth={2.2} />
                <Text style={styles.typeBadgeText}>{place.type || "Restaurant"}</Text>
              </View>
            </View>
            <Text style={styles.name}>{place.name}</Text>
            {place.address ? (
              <View style={styles.addressRow}>
                <PinIcon size={16} color="rgba(255,255,255,0.85)" />
                <Text style={styles.address}>{place.address}</Text>
              </View>
            ) : null}
          </View>
        </View>

        <View style={styles.body}>
          {status && (
            <View style={styles.hoursStrip}>
              <View style={[styles.openPill, { backgroundColor: status.open ? colors.greenSoft : colors.redSoft }]}>
                <View style={[styles.openDot, { backgroundColor: status.open ? colors.greenBright : colors.red }]} />
                <Text style={[styles.openText, { color: status.open ? colors.greenText : colors.redText }]}>
                  {status.open ? "Open now" : "Closed now"}
                </Text>
              </View>
              {status.todayLabel ? (
                <Text style={styles.todayText}>{status.todayLabel === "Closed today" ? status.todayLabel : `Today ${status.todayLabel}`}</Text>
              ) : null}
            </View>
          )}

          <View style={[styles.sectionHead, { marginTop: 24 }]}>
            <FloorPlanIcon size={22} />
            <Text style={styles.sectionTitle}>Find your seat</Text>
          </View>
          {floorLoaded && summary.totalSeats > 0 ? (
            <View style={styles.floorSummary}>
              <View style={[styles.legendDot, { backgroundColor: TONE_COLORS[tone].dot, marginTop: 6 }]} />
              <View
                style={styles.floorSummaryLine}
                accessible
                accessibilityLabel={`${summary.availableSeats} of ${summary.totalSeats} seats open, ${freshnessLabel(summary.latestUpdateMs, now)}`}
              >
                <AnimatedNumber value={summary.availableSeats} style={[styles.floorSummaryText, styles.floorSummaryStrong]} />
                <Text style={[styles.floorSummaryText, { flex: 1 }]}>
                  <Text style={styles.floorSummaryStrong}>{` of ${summary.totalSeats} seats open`}</Text>
                  {" · "}
                  {freshnessLabel(summary.latestUpdateMs, now)}
                </Text>
              </View>
            </View>
          ) : (
            <Text style={styles.sectionText}>The live floor plan, straight from the staff. Green seats are open.</Text>
          )}
          <View style={{ marginTop: 16 }}>
            {floorLoaded ? (
              <FloorView tables={tables} markers={markers} width={contentWidth} maxHeight={floorHeight} />
            ) : (
              <Skeleton style={{ height: 260, borderRadius: 24 }} />
            )}
          </View>

          <View style={styles.actions}>
            <Button
              title="Get directions"
              variant="green"
              icon={<DirectionsIcon size={20} color={colors.ink} />}
              onPress={directions}
              style={{ flex: 1 }}
            />
            <ActionButton
              label={saved ? "Remove from saved" : "Save"}
              active={saved}
              icon={<HeartIcon size={22} color={saved ? colors.red : colors.ink} filled={saved} />}
              onPress={() => {
                tap();
                if (placeSummary) toggleFavorite(placeSummary);
              }}
            />
            {features.shareButton && <ActionButton label="Share" icon={<ShareIcon size={22} />} onPress={share} />}
          </View>

          <View style={styles.liveCard}>
            {!floorLoaded ? (
              <View style={{ height: 200 }}>
                <Loading label="Checking seats…" />
              </View>
            ) : (
              <>
                <View style={styles.liveTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.liveEyebrow}>Available now</Text>
                    <View
                      style={styles.bigRow}
                      accessible
                      accessibilityLabel={`${summary.availableSeats} of ${summary.totalSeats} seats available`}
                      accessibilityLiveRegion="polite"
                    >
                      <AnimatedNumber value={summary.availableSeats} style={styles.big} />
                      <Text style={styles.bigOf}>of {summary.totalSeats} seats</Text>
                    </View>
                  </View>
                  <Ring percentage={percentage} color={TONE_COLORS[tone].dot} />
                </View>

                <Text style={styles.availability}>{availabilityLabel(summary)}</Text>

                {summary.totalSeats > 0 && (
                  <View style={styles.seatBarWrap}>
                    <View style={styles.seatBar}>
                      <SpringFill percent={percentage} color={TONE_COLORS[tone].dot} style={styles.seatBarFill} />
                    </View>
                    <View style={styles.legend}>
                      <View style={styles.legendItem}>
                        <View style={[styles.legendDot, { backgroundColor: TONE_COLORS[tone].dot }]} />
                        <Text style={styles.legendText}>{summary.availableSeats} open</Text>
                      </View>
                      <View style={styles.legendItem}>
                        <View style={[styles.legendDot, { backgroundColor: "rgba(255,255,255,0.25)" }]} />
                        <Text style={styles.legendText}>{summary.totalSeats - summary.availableSeats} taken</Text>
                      </View>
                    </View>
                  </View>
                )}

                <View style={[styles.fresh, stale ? styles.freshStale : styles.freshOk]}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <View style={[styles.freshDot, { backgroundColor: stale ? "#fbbf24" : "#4ade80" }]} />
                    <Text style={[styles.freshText, { color: stale ? "#fef3c7" : "#dcfce7" }]}>
                      {freshnessLabel(summary.latestUpdateMs, now)}
                    </Text>
                  </View>
                  {stale && <Text style={styles.freshNote}>Current availability may have changed since the last update.</Text>}
                </View>

                {isBar(place.type) && status?.open !== false && <CrowdMeter businessId={place.businessId} now={now} />}

                {summary.totalSeats > 0 && summary.availableSeats === 0 && (
                  <SeatAlertButton slug={place.slug} businessId={place.businessId} placeName={place.name} />
                )}
              </>
            )}
          </View>

          {chairs.length > 0 && (
            <Section title="Chairs" icon={<ScissorsIcon />}>
              {chairs.map((chair) => {
                const seat = chair.seats[0];
                const taken = seat?.status === "occupied";
                return (
                  <View key={chair.id} style={styles.listItem}>
                    <Text style={styles.listName}>{chair.name}</Text>
                    <Text style={[styles.statusPill, taken ? styles.statusTaken : styles.statusOpen]}>
                      {!taken
                        ? "Free"
                        : typeof seat?.occupiedSince === "number"
                          ? `In chair ${elapsed(seat.occupiedSince, Math.max(now, seat.occupiedSince))}`
                          : "In chair"}
                    </Text>
                  </View>
                );
              })}
            </Section>
          )}

          {games.length > 0 && (
            <Section title={isBowlingAlley(place.type) ? "Lanes" : "Games"} icon={isBowlingAlley(place.type) ? <BigIcons.disc /> : <BigIcons.target />}>
              {games.map((game) => (
                <View key={game.id} style={styles.listItem}>
                  <Text style={styles.listName}>{game.label}</Text>
                  <Text style={[styles.statusPill, game.status === "occupied" ? styles.statusTaken : styles.statusOpen]}>
                    {game.status === "occupied" ? "In use" : "Open"}
                  </Text>
                </View>
              ))}
            </Section>
          )}

          {place.hours && (
            <>
              <View style={styles.sectionHead}>
                <ClockIcon size={22} />
                <Text style={styles.sectionTitle}>Hours</Text>
              </View>
              <View style={styles.hoursCard}>
                {DAY_LABELS.map(({ key, label }, index) => {
                  const day = place.hours?.[key];
                  const today = status?.day === key;
                  return (
                    <View key={key} style={[styles.hoursRow, index < DAY_LABELS.length - 1 && styles.hoursBorder]}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                        <Text style={[styles.day, today && styles.dayToday]}>{label}</Text>
                        {today && <Text style={styles.todayTag}>TODAY</Text>}
                      </View>
                      <Text style={[styles.day, today && styles.dayToday]}>
                        {!day || day.closed ? "Closed" : `${formatHour(day.open)} – ${formatHour(day.close)}`}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </>
          )}

          <Text style={styles.footnote}>Seats and the floor plan update live as the business makes changes.</Text>
        </View>
      </PageScroll>

      <Animated.View
        pointerEvents="none"
        style={[
          styles.headerBar,
          {
            height: insets.top + 58,
            opacity: scrollY.interpolate({ inputRange: [heroHeight - 160, heroHeight - 90], outputRange: [0, 1], extrapolate: "clamp" }),
          },
        ]}
      >
        <Text numberOfLines={1} style={[styles.headerTitle, { top: insets.top + 18 }]}>
          {place.name}
        </Text>
      </Animated.View>

      <View style={[styles.topButtons, { top: insets.top + 10 }]}>
        <RoundButton
          label="Back"
          onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))}
          icon={<BackIcon size={22} />}
        />
        <View style={{ flex: 1 }} />
        {features.shareButton && <RoundButton label="Share" onPress={share} icon={<ShareIcon size={20} />} />}
        <RoundButton
          label={saved ? "Remove from saved" : "Save"}
          onPress={() => {
            tap();
            if (placeSummary) toggleFavorite(placeSummary);
          }}
          icon={<HeartIcon size={21} color={saved ? colors.red : colors.ink} filled={saved} />}
        />
      </View>
    </View>
  );
}

// Percentage of seats open, as a ring.
function Ring({ percentage, color }: { percentage: number; color: string }) {
  return (
    <View style={[styles.ring, { borderColor: `${color}55` }]} accessible accessibilityLabel={`${percentage}% open`}>
      <View style={{ flexDirection: "row" }}>
        <AnimatedNumber value={percentage} style={styles.ringValue} />
        <Text style={styles.ringValue}>%</Text>
      </View>
      <Text style={styles.ringLabel}>OPEN</Text>
    </View>
  );
}

function RoundButton({ label, icon, onPress }: { label: string; icon: React.ReactNode; onPress: () => void }) {
  return (
    <PressableScale accessibilityLabel={label} onPress={onPress} hitSlop={6} scaleTo={0.9} style={styles.round}>
      {icon}
    </PressableScale>
  );
}

function ActionButton({
  label,
  icon,
  onPress,
  active = false,
}: {
  label: string;
  icon: React.ReactNode;
  onPress: () => void;
  active?: boolean;
}) {
  return (
    <PressableScale
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[styles.action, active && { borderColor: "#fecaca", backgroundColor: colors.redSoft }]}
    >
      {icon}
    </PressableScale>
  );
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <>
      <View style={styles.sectionHead}>
        {icon}
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      <View style={styles.listCard}>{children}</View>
    </>
  );
}

// The page's shape while the place loads: photo, name, then the map.
function PlaceSkeleton() {
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.screen}>
      <Skeleton style={{ height: 250 + insets.top, borderRadius: 0 }} />
      <View style={{ paddingHorizontal: space.gutter, paddingTop: 24, gap: 14 }}>
        <Skeleton style={{ height: 30, width: 130, borderRadius: 999 }} />
        <Skeleton style={{ height: 28, width: 200, borderRadius: 8, marginTop: 12 }} />
        <Skeleton style={{ height: 18, width: 240, borderRadius: 6 }} />
        <Skeleton style={{ height: 260, borderRadius: 24, marginTop: 4 }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.page },
  hero: { backgroundColor: "#d1d5db", justifyContent: "flex-end" },
  heroText: { paddingHorizontal: space.gutter, paddingBottom: 28, width: "100%", maxWidth: 760, alignSelf: "center" },
  heroBadges: { flexDirection: "row", gap: 8 },
  liveBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    backgroundColor: "rgba(255,255,255,0.95)",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  liveBadgeText: { fontSize: 12, fontWeight: "900", color: "#15803d", letterSpacing: 1 },
  typeBadge: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(255,255,255,0.95)", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  typeBadgeText: { fontSize: 13, fontWeight: "800", color: colors.ink },
  name: { color: "#fff", fontSize: 32, lineHeight: 37, fontWeight: "900", letterSpacing: -1, marginTop: 12 },
  addressRow: { flexDirection: "row", alignItems: "center", gap: 7, marginTop: 10 },
  address: { color: "rgba(255,255,255,0.85)", fontSize: 16, flex: 1 },
  body: { paddingHorizontal: space.gutter, width: "100%", maxWidth: 760, alignSelf: "center" },
  hoursStrip: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 24, flexWrap: "wrap" },
  openPill: { flexDirection: "row", alignItems: "center", gap: 7, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  openDot: { width: 9, height: 9, borderRadius: 5 },
  openText: { fontSize: 15, fontWeight: "900" },
  todayText: { fontSize: 16, fontWeight: "700", color: colors.muted },
  liveCard: { backgroundColor: colors.ink, borderRadius: 30, padding: 26, marginTop: space.section },
  liveTop: { flexDirection: "row", alignItems: "flex-start", gap: 16 },
  liveEyebrow: { color: "#4ade80", fontSize: 13, fontWeight: "900", letterSpacing: 1.6, textTransform: "uppercase" },
  bigRow: { flexDirection: "row", alignItems: "flex-end", gap: 10, marginTop: 12 },
  big: { color: "#fff", fontSize: 72, lineHeight: 74, fontWeight: "900", letterSpacing: -2.5 },
  bigOf: { color: "rgba(255,255,255,0.72)", fontSize: 17, fontWeight: "700", paddingBottom: 12 },
  ring: { width: 96, height: 96, borderRadius: 48, borderWidth: 7, alignItems: "center", justifyContent: "center" },
  ringValue: { color: "#fff", fontSize: 24, lineHeight: 29, fontWeight: "900" },
  ringLabel: { color: "rgba(255,255,255,0.72)", fontSize: 11, fontWeight: "900", letterSpacing: 1 },
  availability: { color: "#fff", fontSize: 22, lineHeight: 28, fontWeight: "900", marginTop: 20 },
  seatBarWrap: { marginTop: 20 },
  seatBar: { height: 10, borderRadius: 5, backgroundColor: "rgba(255,255,255,0.12)", overflow: "hidden" },
  seatBarFill: { height: 10, borderRadius: 5 },
  legend: { flexDirection: "row", gap: 20, marginTop: 12 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 8 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { color: "rgba(255,255,255,0.75)", fontSize: 15, fontWeight: "700" },
  fresh: { borderRadius: 18, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 14, marginTop: 22 },
  freshOk: { backgroundColor: "rgba(74,222,128,0.1)", borderColor: "rgba(74,222,128,0.2)" },
  freshStale: { backgroundColor: "rgba(252,211,77,0.1)", borderColor: "rgba(252,211,77,0.3)" },
  freshDot: { width: 9, height: 9, borderRadius: 5 },
  freshText: { fontSize: 15, fontWeight: "700" },
  freshNote: { color: "rgba(254,243,199,0.75)", fontSize: 14, lineHeight: 20, marginTop: 6 },
  actions: { flexDirection: "row", gap: 12, marginTop: 20 },
  floorSummary: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginTop: 10 },
  floorSummaryLine: { flex: 1, flexDirection: "row", alignItems: "flex-start" },
  floorSummaryText: { fontSize: 16, lineHeight: 22, color: colors.muted },
  floorSummaryStrong: { color: colors.ink, fontWeight: "800" },
  action: {
    width: 56,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: colors.border,
  },
  sectionHead: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: space.section + 4 },
  sectionTitle: { fontSize: 23, fontWeight: "900", color: colors.ink, letterSpacing: -0.5 },
  sectionText: { fontSize: 16, lineHeight: 23, color: colors.muted, marginTop: 8 },
  listCard: { backgroundColor: "#fff", borderRadius: 24, borderWidth: 1, borderColor: colors.border, marginTop: 16, paddingHorizontal: 20 },
  listItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  listName: { fontSize: 17, fontWeight: "700", color: colors.ink },
  statusPill: { overflow: "hidden", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, fontSize: 14, fontWeight: "900" },
  statusOpen: { backgroundColor: colors.greenSoft, color: "#15803d" },
  statusTaken: { backgroundColor: colors.redSoft, color: "#dc2626", fontVariant: ["tabular-nums"] },
  hoursCard: { backgroundColor: "#fff", borderRadius: 24, borderWidth: 1, borderColor: colors.border, marginTop: 16, paddingHorizontal: 20 },
  hoursRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 16 },
  hoursBorder: { borderBottomWidth: 1, borderBottomColor: colors.line },
  day: { fontSize: 16, color: colors.muted },
  dayToday: { color: colors.ink, fontWeight: "800" },
  todayTag: {
    overflow: "hidden",
    fontSize: 11,
    fontWeight: "900",
    color: colors.greenText,
    backgroundColor: colors.greenSoft,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  footnote: { textAlign: "center", fontSize: 14, lineHeight: 20, color: colors.faint, marginTop: 32, paddingHorizontal: 20 },
  headerBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(247,248,245,0.97)",
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: { position: "absolute", left: 80, right: 128, textAlign: "center", fontSize: 17, fontWeight: "900", color: colors.ink },
  topButtons: { position: "absolute", left: 18, right: 18, flexDirection: "row", gap: 12 },
  round: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.95)",
    alignItems: "center",
    justifyContent: "center",
    ...shadow,
  },
});
