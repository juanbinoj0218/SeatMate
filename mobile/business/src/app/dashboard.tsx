import { useEffect, useState } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { router, type Href } from "expo-router";
import { signOut } from "firebase/auth";

import WrongAccount from "@/components/gate";
import UpdateReminder from "@/components/update-reminder";
import { Button, Card, colors, Muted, Screen, Title } from "@/components/ui";
import { auth } from "@/lib/firebase";
import { seatCounts, watchTables, type Table } from "@/lib/floor";
import type { BusinessStatus } from "@/lib/session";
import { useOwner } from "@/lib/session";
import { consumerUrl } from "@/lib/site-urls";

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
  const [tables, setTables] = useState<Table[]>([]);

  useEffect(() => {
    if (!businessId) return;
    // The dashboard still works without seat counts.
    return watchTables(businessId, setTables, (error) => console.error("Error loading seats:", error));
  }, [businessId]);

  if (!owner) {
    return <WrongAccount />;
  }

  const { business } = owner;
  const badge = STATUS_BADGES[business.status];
  const live = business.status === "approved" && Boolean(business.slug);
  const seats = seatCounts(tables);

  return (
    <Screen>
      <View style={[styles.badge, { backgroundColor: badge.background }]}>
        <View style={[styles.badgeDot, { backgroundColor: badge.text }]} />
        <Text style={{ color: badge.text, fontWeight: "700", fontSize: 12 }}>{badge.label}</Text>
      </View>
      <Title>{business.name}</Title>
      <Muted style={{ marginTop: 4 }}>
        {[business.type, business.address].filter(Boolean).join(" · ")}
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

      {seats.total > 0 && (
        <View style={{ marginTop: 20 }}>
          <UpdateReminder businessId={business.id} tables={tables} />
          <SeatSummary open={seats.open} total={seats.total} />
        </View>
      )}

      <Card style={{ marginTop: 16, padding: 0, overflow: "hidden" }}>
        <MenuLink
          icon="▦"
          tile={["#d1fae5", "#047857"]}
          title="Floor plan"
          text="Arrange tables and update seat occupancy in real time."
          href="/floor-plan"
        />
        <MenuLink
          icon="👥"
          tile={["#ede9fe", "#6d28d9"]}
          title="Staff"
          text="Invite staff and manage who can update seats."
          href="/team"
        />
        <MenuLink
          icon="🕒"
          tile={["#fef3c7", "#b45309"]}
          title="Business hours"
          text="Set the hours customers see on your page."
          href="/hours"
        />
        <MenuLink
          icon="📊"
          tile={["#ffe4e6", "#e11d48"]}
          title="Analytics"
          text="Page views, saves and your busiest hours."
          href="/analytics"
        />
        {live && (
          <MenuLink
            icon="▣"
            tile={["#e2e8f0", "#334155"]}
            title="QR code"
            text="Show a code so customers can check seats from their phone."
            href="/qr"
          />
        )}
        {live && (
          <MenuLink
            icon="🏪"
            tile={["#e0f2fe", "#0369a1"]}
            title="Customer page"
            text="See your place the way customers do on SeatMate."
            onPress={() => void Linking.openURL(consumerUrl(`/place/${business.slug}?from=business`))}
            last
          />
        )}
      </Card>

      <Button title="Log out" variant="secondary" onPress={() => void signOut(auth)} style={{ marginTop: 24 }} />
    </Screen>
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

function SeatSummary({ open, total }: { open: number; total: number }) {
  const percent = Math.round((open / total) * 100);

  return (
    <Card>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Text style={{ color: colors.muted, fontWeight: "700" }}>Seats right now</Text>
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
  icon,
  tile,
  title,
  text,
  href,
  onPress,
  last = false,
}: {
  icon: string;
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
        <Text style={{ fontSize: 18, color: tile[1] }}>{icon}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontWeight: "700", fontSize: 16, color: colors.ink }}>{title}</Text>
        <Text style={{ color: colors.muted, marginTop: 2 }}>{text}</Text>
      </View>
      <Text style={{ fontSize: 22, color: "#d1d5db" }}>›</Text>
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
});
