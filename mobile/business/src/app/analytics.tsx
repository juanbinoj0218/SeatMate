import { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { doc, getDoc } from "firebase/firestore";

import WrongAccount from "@/components/gate";
import { Banner, Card, colors, Muted, Screen, Segmented, Skeleton, SkeletonCard, StatTile, Title } from "@/components/ui";
import { db } from "@/lib/firebase";
import { dayKey } from "@/lib/seat-updates";
import { useOwner } from "@/lib/session";

type Range = 7 | 30;

type Day = {
  key: string;
  date: Date;
  views: number;
  saves: number;
  scans: number;
  updates: number;
  // Per hour of day: summed % taken and number of samples.
  occ: number[];
  samples: number[];
};

const toNumber = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : 0);

const hourLabel = (hour: number) => `${hour % 12 === 0 ? 12 : hour % 12}${hour < 12 ? "a" : "p"}`;
const hourLong = (hour: number) => `${hour % 12 === 0 ? 12 : hour % 12} ${hour < 12 ? "AM" : "PM"}`;

// Same numbers as the web portal's analytics page: page views, saves and QR
// scans from the public listing, seat updates and busiest hours from staff.
export default function AnalyticsScreen() {
  const owner = useOwner();
  const businessId = owner?.business.id;
  const slug = owner?.business.slug;

  const [range, setRange] = useState<Range>(7);
  const [days, setDays] = useState<Day[] | null>(null);

  useEffect(() => {
    if (!businessId) return;

    let cancelled = false;
    const dates = Array.from({ length: 30 }, (_, index) => {
      const date = new Date();
      date.setHours(12, 0, 0, 0);
      date.setDate(date.getDate() - (29 - index));
      return date;
    });

    Promise.all(
      dates.map(async (date) => {
        const key = dayKey(date);
        const [placeStats, seatStats] = await Promise.all([
          slug ? getDoc(doc(db, "publicBusinesses", slug, "stats", key)).catch(() => null) : null,
          getDoc(doc(db, "businesses", businessId, "stats", key)).catch(() => null),
        ]);
        const place = placeStats?.data() ?? {};
        const seats = seatStats?.data() ?? {};

        return {
          key,
          date,
          views: toNumber(place.views),
          saves: toNumber(place.saves),
          scans: toNumber(place.scans),
          updates: toNumber(seats.updates),
          occ: Array.from({ length: 24 }, (_, hour) => toNumber(seats[`occ_${hour}`])),
          samples: Array.from({ length: 24 }, (_, hour) => toNumber(seats[`n_${hour}`])),
        };
      })
    ).then((result) => {
      if (!cancelled) setDays(result);
    });

    return () => {
      cancelled = true;
    };
  }, [businessId, slug]);

  const shown = useMemo(() => (days ? days.slice(-range) : []), [days, range]);

  const totals = useMemo(
    () =>
      shown.reduce(
        (sum, day) => ({
          views: sum.views + day.views,
          saves: sum.saves + day.saves,
          scans: sum.scans + day.scans,
          updates: sum.updates + day.updates,
        }),
        { views: 0, saves: 0, scans: 0, updates: 0 }
      ),
    [shown]
  );

  // Average % of seats taken for each hour, from the first to the last hour
  // with data.
  const hours = useMemo(() => {
    const occ = Array(24).fill(0);
    const samples = Array(24).fill(0);
    shown.forEach((day) => {
      day.occ.forEach((value, hour) => (occ[hour] += value));
      day.samples.forEach((value, hour) => (samples[hour] += value));
    });
    const withData = samples.flatMap((count, hour) => (count > 0 ? [{ hour, pct: Math.round(occ[hour] / count) }] : []));
    if (withData.length === 0) return [];
    const first = withData[0].hour;
    const last = withData[withData.length - 1].hour;
    return Array.from({ length: last - first + 1 }, (_, index) => {
      const hour = first + index;
      return { hour, pct: withData.find((item) => item.hour === hour)?.pct ?? null };
    });
  }, [shown]);

  const peak = hours.reduce<{ hour: number; pct: number } | null>(
    (best, item) => (item.pct !== null && (!best || item.pct > best.pct) ? { hour: item.hour, pct: item.pct } : best),
    null
  );

  if (!owner) {
    return <WrongAccount />;
  }

  if (!days) {
    return (
      <Screen scroll={false}>
        <View accessibilityLabel="Loading analytics" accessibilityRole="progressbar">
          <Title>{owner.business.name}</Title>
          <Skeleton style={{ height: 44, borderRadius: 12, marginTop: 14 }} />
          <View style={[styles.row, { marginTop: 16 }]}>
            <Skeleton style={styles.statSkeleton} />
            <Skeleton style={styles.statSkeleton} />
          </View>
          <View style={[styles.row, { marginTop: 10 }]}>
            <Skeleton style={styles.statSkeleton} />
            <Skeleton style={styles.statSkeleton} />
          </View>
          <SkeletonCard style={{ marginTop: 16, height: 200 }} />
          <SkeletonCard style={{ marginTop: 16, height: 200 }} />
        </View>
      </Screen>
    );
  }

  const live = owner.business.status === "approved" && Boolean(owner.business.slug);
  const weekday = new Intl.DateTimeFormat(undefined, { weekday: "short" });
  const monthDay = new Intl.DateTimeFormat(undefined, { month: "numeric", day: "numeric" });

  return (
    <Screen>
      <Title>{owner.business.name}</Title>
      <View style={{ marginTop: 14 }}>
        <Segmented
          options={[
            { value: 7 as Range, label: "Last 7 days" },
            { value: 30 as Range, label: "Last 30 days" },
          ]}
          value={range}
          onChange={setRange}
        />
      </View>

      {!live && (
        <Banner tone="warning">Page views and saves start counting once your business is approved and live on SeatMate.</Banner>
      )}

      <View style={[styles.row, { marginTop: 16 }]}>
        <StatTile label="Page views" value={totals.views} color="#0369a1" />
        <StatTile label="Saves" value={totals.saves} color="#e11d48" />
      </View>
      <View style={[styles.row, { marginTop: 10 }]}>
        <StatTile label="QR scans" value={totals.scans} color="#334155" />
        <StatTile label="Seat updates" value={totals.updates} color="#047857" />
      </View>

      <Card style={{ marginTop: 16 }}>
        <Text style={styles.heading}>Page views per day</Text>
        <Muted style={{ marginTop: 2 }}>How many people opened your SeatMate page.</Muted>
        {totals.views === 0 ? (
          <Muted style={styles.empty}>No page views yet in this period.</Muted>
        ) : (
          <Bars
            bars={shown.map((day, index) => ({
              key: day.key,
              value: day.views,
              label:
                range === 7 ? weekday.format(day.date) : index % 5 === 0 ? monthDay.format(day.date) : "",
            }))}
            color="#0ea5e9"
          />
        )}
      </Card>

      <Card style={{ marginTop: 16 }}>
        <Text style={styles.heading}>Busiest hours</Text>
        <Muted style={{ marginTop: 2 }}>Average share of seats taken, from your staff&apos;s seat updates.</Muted>
        {peak && (
          <Text style={{ marginTop: 8, color: colors.greenText, fontWeight: "700" }}>
            Busiest around {hourLong(peak.hour)} · {peak.pct}% full
          </Text>
        )}
        {hours.length === 0 ? (
          <Muted style={styles.empty}>No seat updates yet in this period.</Muted>
        ) : (
          <Bars
            bars={hours.map((item, index) => ({
              key: String(item.hour),
              value: item.pct ?? 0,
              label: hours.length <= 8 || index % 2 === 0 ? hourLabel(item.hour) : "",
            }))}
            max={100}
            color="#10b981"
            suffix="%"
          />
        )}
      </Card>
    </Screen>
  );
}

function Bars({
  bars,
  color,
  max,
  suffix = "",
}: {
  bars: { key: string; value: number; label: string }[];
  color: string;
  max?: number;
  suffix?: string;
}) {
  const top = max ?? Math.max(1, ...bars.map((bar) => bar.value));
  const showValues = bars.length <= 12;

  return (
    <View style={styles.chart}>
      {bars.map((bar) => (
        <View key={bar.key} style={styles.barColumn} accessibilityLabel={`${bar.label} ${bar.value}${suffix}`}>
          {showValues && (
            <Text style={styles.barValue}>{bar.value > 0 ? `${bar.value}${suffix}` : ""}</Text>
          )}
          <View style={styles.barTrack}>
            <View
              style={{
                height: `${Math.max(bar.value > 0 ? 3 : 0, (bar.value / top) * 100)}%`,
                backgroundColor: color,
                borderRadius: 4,
              }}
            />
          </View>
          <Text numberOfLines={1} style={styles.barLabel}>
            {bar.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 10 },
  statSkeleton: { flex: 1, height: 78, borderRadius: 16 },
  heading: { fontSize: 17, fontWeight: "800", color: colors.ink },
  empty: { marginTop: 24, marginBottom: 12, textAlign: "center" },
  chart: { flexDirection: "row", alignItems: "flex-end", gap: 3, marginTop: 16, height: 180 },
  barColumn: { flex: 1, alignItems: "center", height: "100%" },
  barValue: { fontSize: 10, color: colors.muted, height: 14 },
  barTrack: { flex: 1, width: "100%", justifyContent: "flex-end" },
  barLabel: { fontSize: 10, color: colors.faint, marginTop: 4, height: 14 },
});
