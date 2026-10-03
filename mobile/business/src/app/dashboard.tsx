import { useEffect, useState, type ComponentType, type ReactNode } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { router, type Href } from "expo-router";
import { signOut } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";

import {
  businessTypeLabel,
  isBar,
  isBarbershop,
  isBowlingAlley,
  isGameMarker,
  MARKERS,
  type FloorMarker,
} from "@seatmate/shared/floor-plan";

import BouncerCard from "@/components/bouncer-card";
import WrongAccount from "@/components/gate";
import {
  ChartIcon,
  ChevronRightIcon,
  ClockIcon,
  DoorIcon,
  FloorPlanIcon,
  QrIcon,
  ShieldIcon,
  StaffIcon,
  StorefrontIcon,
} from "@/components/icons";
import { ChairTimer } from "@/components/table-with-seats";
import UpdateReminder from "@/components/update-reminder";
import { Banner, Button, Card, colors, Muted, Screen, StatTile, Title } from "@/components/ui";
import { auth, db } from "@/lib/firebase";
import { seatCounts, toggleGame, watchMarkers, watchTables, type Table } from "@/lib/floor";
import { dayKey, toggleSeat } from "@/lib/seat-updates";
import type { BusinessStatus } from "@/lib/session";
import { useOwner } from "@/lib/session";
import { businessUrl, consumerUrl } from "@/lib/site-urls";

const STATUS_BADGES: Record<BusinessStatus, { label: string; background: string; text: string }> = {
  approved: { label: "Live on SeatMate", background: "#ecfdf5", text: "#047857" },
  pending: { label: "Pending approval", background: "#fffbeb", text: "#b45309" },
  draft: { label: "Draft", background: "#f3f4f6", text: "#4b5563" },
  suspended: { label: "Suspended", background: "#fff1f2", text: "#be123c" },
  rejected: { label: "Declined", background: "#f3f4f6", text: "#4b5563" },
};

export default function DashboardScreen() {
  const owner = useOwner();
  const businessId = owner?.business.id;
  const slug = owner?.business.slug;
  const [tables, setTables] = useState<Table[]>([]);
  const [markers, setMarkers] = useState<FloorMarker[]>([]);
  const [today, setToday] = useState({ views: 0, scans: 0, updates: 0 });
  const [error, setError] = useState("");

  useEffect(() => {
    if (!businessId) return;
    // The dashboard still works without seat counts.
    const stopTables = watchTables(businessId, setTables, (err) => console.error("Error loading seats:", err));
    const stopMarkers = watchMarkers(businessId, setMarkers, (err) => console.error(err));
    return () => {
      stopTables();
      stopMarkers();
    };
  }, [businessId]);

  // Today's numbers, live: customer page views and QR scans (public listing)
  // and seat updates (the business's own stats), same documents as Analytics.
  useEffect(() => {
    if (!businessId) return;
    const key = dayKey();
    const stopSeats = onSnapshot(
      doc(db, "businesses", businessId, "stats", key),
      (snapshot) => setToday((current) => ({ ...current, updates: toNumber(snapshot.data()?.updates) })),
      () => {}
    );
    const stopPlace = slug
      ? onSnapshot(
          doc(db, "publicBusinesses", slug, "stats", key),
          (snapshot) =>
            setToday((current) => ({
              ...current,
              views: toNumber(snapshot.data()?.views),
              scans: toNumber(snapshot.data()?.scans),
            })),
          () => {}
        )
      : undefined;
    return () => {
      stopSeats();
      stopPlace?.();
    };
  }, [businessId, slug]);

  if (!owner) {
    return <WrongAccount />;
  }

  const { business } = owner;
  const badge = STATUS_BADGES[business.status];
  const live = business.status === "approved" && Boolean(business.slug);
  const seats = seatCounts(tables);
  const kind = businessKind(business.type);
  const chairs = tables.filter((table) => table.shape === "barberChair");
  const games = markers.filter((marker) => isGameMarker(marker.type));

  const run = async (work: () => Promise<unknown>, failure: string) => {
    try {
      setError("");
      await work();
    } catch (err) {
      console.error(err);
      setError(failure);
    }
  };

  return (
    <Screen>
      <View style={[styles.badge, { backgroundColor: badge.background }]}>
        <View style={[styles.badgeDot, { backgroundColor: badge.text }]} />
        <Text style={{ color: badge.text, fontWeight: "700", fontSize: 12 }}>{badge.label}</Text>
      </View>
      <Title>{business.name}</Title>
      <Muted style={{ marginTop: 4 }}>
        {[business.type ? businessTypeLabel(business.type) : "", business.address].filter(Boolean).join(" · ")}
      </Muted>

      {business.status === "draft" && (
        <Notice
          title="Setup not submitted"
          text="Finish your floor plan and submit your business for SeatMate approval."
          action="Continue setup"
          onPress={() => router.push("/floor-plan")}
        />
      )}
      {business.status === "pending" && (
        <Notice
          tone="amber"
          title="Pending approval"
          text="SeatMate is reviewing your business. Your customer page will become available after approval."
        />
      )}
      {business.status === "suspended" && (
        <Notice tone="red" title="Business suspended" text="This location is currently hidden from SeatMate customers." />
      )}
      {business.status === "rejected" && (
        <Notice
          title="Approval declined"
          text="Update your business or floor plan, then submit it again for review."
          action="Update & resubmit"
          onPress={() => router.push("/floor-plan")}
        />
      )}

      {error ? <Banner tone="error">{error}</Banner> : null}

      {seats.total > 0 && (
        <View style={{ marginTop: 20 }}>
          <UpdateReminder businessId={business.id} tables={tables} />
          <SeatSummary open={seats.open} total={seats.total} noun={kind.seatNoun} />
        </View>
      )}

      <View style={[styles.row, { marginTop: 12 }]}>
        <StatTile label={`${kind.seatNoun} open`} value={seats.total > 0 ? seats.open : "–"} color={colors.green} />
        <StatTile label="Views today" value={live ? today.views : "–"} />
        <StatTile label="Updates today" value={today.updates} />
      </View>

      {kind.bar && <BouncerCard businessId={business.id} />}

      {chairs.length > 0 && (
        <QuickPanel
          title="Chairs"
          hint="Tap a chair when a cut starts or finishes. The timer shows how long it's been taken."
        >
          {chairs.map((chair) => {
            const seat = chair.seats[0];
            if (!seat) return null;
            const open = seat.status === "available";
            return (
              <Pressable
                key={chair.id}
                accessibilityRole="button"
                accessibilityLabel={`${chair.name}: ${open ? "open" : "taken"}`}
                onPress={() => void run(() => toggleSeat(business.id, chair.id, seat.id, tables), "Could not update that chair.")}
                style={({ pressed }) => [styles.quick, pressed && { opacity: 0.7 }]}
              >
                <Text style={styles.quickName}>{chair.name}</Text>
                <ChairTimer seat={seat} fontSize={13} />
              </Pressable>
            );
          })}
        </QuickPanel>
      )}

      {games.length > 0 && (
        <QuickPanel
          title={kind.bowling ? "Lanes and games" : "Games"}
          hint="Tap to switch between open and in use. Customers see it right away."
        >
          {[...games]
            .sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }))
            .map((marker) => {
              const open = marker.status !== "occupied";
              return (
                <Pressable
                  key={marker.id}
                  accessibilityRole="button"
                  accessibilityLabel={`${marker.label}: ${open ? "open" : "in use"}`}
                  onPress={() => void run(() => toggleGame(business.id, marker), "Could not update that game.")}
                  style={({ pressed }) => [
                    styles.quick,
                    { backgroundColor: open ? colors.greenSoft : colors.redSoft, borderColor: open ? "#a7f3d0" : "#fecaca" },
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <Text style={styles.quickName}>
                    {MARKERS[marker.type].icon} {marker.label}
                  </Text>
                  <Text style={{ fontWeight: "800", color: open ? colors.greenText : colors.redText }}>
                    {open ? "Open" : "In use"}
                  </Text>
                </Pressable>
              );
            })}
        </QuickPanel>
      )}

      <Card style={{ marginTop: 16, padding: 0, overflow: "hidden" }}>
        <MenuLink
          Icon={FloorPlanIcon}
          tile={["#d1fae5", "#047857"]}
          title={kind.floorTitle}
          text={kind.floorText}
          href="/floor-plan"
        />
        {kind.bar && (
          <MenuLink
            Icon={DoorIcon}
            tile={["#dcfce7", "#15803d"]}
            title="Door counter"
            text="Tap +1 and −1 at the door. Customers see how busy you are."
            href="/door"
          />
        )}
        <MenuLink
          Icon={StaffIcon}
          tile={["#ede9fe", "#6d28d9"]}
          title="Staff"
          text={kind.staffText}
          href="/team"
        />
        <MenuLink
          Icon={ClockIcon}
          tile={["#fef3c7", "#b45309"]}
          title="Business hours"
          text="Set the hours customers see on your page."
          href="/hours"
        />
        <MenuLink
          Icon={ChartIcon}
          tile={["#ffe4e6", "#e11d48"]}
          title="Analytics"
          text="Page views, saves and your busiest hours."
          href="/analytics"
        />
        {live && (
          <MenuLink
            Icon={QrIcon}
            tile={["#e2e8f0", "#334155"]}
            title="QR code"
            text="Show a code so customers can check seats from their phone."
            href="/qr"
          />
        )}
        {live && (
          <MenuLink
            Icon={StorefrontIcon}
            tile={["#e0f2fe", "#0369a1"]}
            title="Customer page"
            text="See your place the way customers do on SeatMate."
            onPress={() => void Linking.openURL(consumerUrl(`/place/${business.slug}?from=business`))}
          />
        )}
        <MenuLink
          Icon={ShieldIcon}
          tile={["#d1fae5", "#047857"]}
          title="Security"
          text="Turn on two-factor sign-in on the website. The app asks for the code too."
          onPress={() => void Linking.openURL(businessUrl("/business/security"))}
          last
        />
      </Card>

      <Button title="Log out" variant="secondary" onPress={() => void signOut(auth)} style={{ marginTop: 24 }} />
    </Screen>
  );
}

// Words and extras that fit each kind of business.
function businessKind(type: string) {
  const bar = isBar(type);
  const barbershop = isBarbershop(type);
  const bowling = isBowlingAlley(type);

  return {
    bar,
    bowling,
    seatNoun: barbershop ? "Chairs" : "Seats",
    floorTitle: barbershop ? "Shop layout" : bowling ? "Lanes and seating" : "Floor plan",
    floorText: barbershop
      ? "Arrange your chairs and mark them open or taken."
      : bowling
        ? "Lay out lanes and tables, and mark lanes in use."
        : bar
          ? "Arrange tables, stools, pool tables and darts."
          : "Arrange tables and update seat occupancy in real time.",
    staffText: barbershop
      ? "Invite your barbers so they can update their chairs."
      : bar
        ? "Invite bartenders and door staff."
        : "Invite staff and manage who can update seats.",
  };
}

const toNumber = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : 0);

function QuickPanel({ title, hint, children }: { title: string; hint: string; children: ReactNode }) {
  return (
    <Card style={{ marginTop: 16 }}>
      <Text style={{ fontWeight: "800", fontSize: 16, color: colors.ink }}>{title}</Text>
      <Muted style={{ marginTop: 4, fontSize: 14 }}>{hint}</Muted>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 }}>{children}</View>
    </Card>
  );
}

function Notice({
  title,
  text,
  action,
  onPress,
  tone = "gray",
}: {
  title: string;
  text: string;
  action?: string;
  onPress?: () => void;
  tone?: "gray" | "amber" | "red";
}) {
  const look =
    tone === "amber"
      ? { background: colors.amberSoft, border: colors.amberBorder, title: colors.amberText, text: "#b45309" }
      : tone === "red"
        ? { background: colors.redSoft, border: "#fecaca", title: colors.redText, text: "#dc2626" }
        : { background: "#fff", border: "#e5e7eb", title: colors.ink, text: colors.muted };

  return (
    <View style={[styles.notice, { backgroundColor: look.background, borderColor: look.border }]}>
      <Text style={{ fontWeight: "800", color: look.title, fontSize: 16 }}>{title}</Text>
      <Text style={{ color: look.text, marginTop: 4, lineHeight: 20 }}>{text}</Text>
      {action && onPress ? <Button title={action} onPress={onPress} style={{ marginTop: 12 }} /> : null}
    </View>
  );
}

function SeatSummary({ open, total, noun }: { open: number; total: number; noun: string }) {
  const percent = Math.round((open / total) * 100);

  return (
    <Card>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Text style={{ color: colors.muted, fontWeight: "700" }}>{noun} right now</Text>
        <Text style={{ color: colors.muted }}>{percent}% open</Text>
      </View>
      <Text style={{ marginTop: 6, fontSize: 30, fontWeight: "800", color: "#059669" }}>
        {open}
        <Text style={{ color: colors.faint, fontSize: 20, fontWeight: "700" }}> / {total} open</Text>
      </Text>
      <View style={styles.meter}>
        <View style={[styles.meterFill, { width: `${percent}%` }]} />
      </View>
    </Card>
  );
}

function MenuLink({
  Icon,
  tile,
  title,
  text,
  href,
  onPress,
  last = false,
}: {
  Icon: ComponentType<{ size?: number; color?: string }>;
  tile: [string, string];
  title: string;
  text: string;
  href?: Href;
  onPress?: () => void;
  last?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress ?? (() => href && router.push(href))}
      style={({ pressed }) => [styles.link, !last && styles.linkBorder, pressed && { backgroundColor: "#f9fafb" }]}
    >
      <View style={[styles.tile, { backgroundColor: tile[0] }]}>
        <Icon size={21} color={tile[1]} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontWeight: "700", fontSize: 16, color: colors.ink }}>{title}</Text>
        <Text style={{ color: colors.muted, marginTop: 2 }}>{text}</Text>
      </View>
      <ChevronRightIcon size={20} color="#d1d5db" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 10,
  },
  badgeDot: { width: 6, height: 6, borderRadius: 3 },
  notice: { marginTop: 20, borderWidth: 1, borderRadius: 16, padding: 16 },
  meter: { marginTop: 12, height: 10, borderRadius: 5, backgroundColor: "#ffe4e6", overflow: "hidden" },
  meterFill: { height: "100%", borderRadius: 5, backgroundColor: "#10b981" },
  link: { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 16, paddingVertical: 14 },
  linkBorder: { borderBottomWidth: 1, borderBottomColor: "#e5e7eb" },
  tile: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  row: { flexDirection: "row", gap: 10 },
  quick: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minWidth: 104,
    gap: 6,
    alignItems: "flex-start",
    backgroundColor: "#fff",
  },
  quickName: { fontWeight: "800", color: colors.ink, fontSize: 15 },
});
