import { Alert, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import Constants from "expo-constants";
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  BellIcon,
  DocIcon,
  HeartIcon,
  MailIcon,
  PinIcon,
  PlusIcon,
  SeatMateMark,
  ShieldIcon,
  SignOutIcon,
  StorefrontIcon,
  UserIcon,
} from "@/components/icons";
import { PlaceRow } from "@/components/place-card";
import { Banner, Button, colors, ListRow } from "@/components/ui";
import { firstName, useAccount } from "@/lib/account";
import { useFeatures } from "@/lib/features";
import { businessUrl, consumerUrl } from "@/lib/site-urls";

const openSite = (url: string) => WebBrowser.openBrowserAsync(url).catch(() => {});

// Confirm with a native dialog on phones and the browser's on the web.
function confirm(title: string, message: string, action: string, onConfirm: () => void) {
  if (Platform.OS === "web") {
    if (window.confirm(`${title}\n\n${message}`)) onConfirm();
    return;
  }
  Alert.alert(title, message, [
    { text: "Cancel", style: "cancel" },
    { text: action, style: "destructive", onPress: onConfirm },
  ]);
}

export default function AccountScreen() {
  const insets = useSafeAreaInsets();
  const features = useFeatures();
  const { user, profile, favorites, syncError, signOut, clearRecentlyViewed, showToast } = useAccount();
  const name = firstName(profile, user);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.pad, { paddingTop: insets.top + 12, paddingBottom: 40 }]}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.title}>Account</Text>

      {user ? (
        <>
          <View style={styles.profile}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{(name[0] || user.email?.[0] || "?").toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.name} numberOfLines={1}>
                {profile.displayName || user.displayName || "SeatMate member"}
              </Text>
              <Text style={styles.email} numberOfLines={1}>
                {user.email}
              </Text>
            </View>
          </View>

          <View style={styles.stats}>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{favorites.length}</Text>
              <Text style={styles.statLabel}>Saved</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.stat}>
              <Text style={styles.statValue}>{profile.recentlyViewed.length}</Text>
              <Text style={styles.statLabel}>Viewed</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.stat}>
              <Text style={styles.statValue}>{profile.homeZip || "—"}</Text>
              <Text style={styles.statLabel}>Home ZIP</Text>
            </View>
          </View>

          {syncError ? <Banner tone="error">{syncError}</Banner> : null}

          {profile.recentlyViewed.length > 0 && (
            <>
              <View style={styles.groupHeader}>
                <Text style={styles.groupTitle}>Recently viewed</Text>
                <Text
                  accessibilityRole="button"
                  style={styles.groupAction}
                  onPress={() =>
                    clearRecentlyViewed()
                      .then(() => showToast("Cleared your history"))
                      .catch(() => showToast("Couldn't clear your history. Try again."))
                  }
                >
                  Clear
                </Text>
              </View>
              <View style={[styles.group, { paddingHorizontal: 14, paddingVertical: 6 }]}>
                {profile.recentlyViewed.map((item) => (
                  <PlaceRow key={item.slug} {...item} />
                ))}
              </View>
            </>
          )}

          <Text style={styles.groupTitleAlone}>Your account</Text>
          <View style={styles.group}>
            <ListRow
              title="Your details"
              detail="Name and home ZIP"
              icon={<UserIcon size={19} />}
              onPress={() => router.push("/profile")}
            />
            <ListRow
              title="Saved places"
              detail={`${favorites.length} ${favorites.length === 1 ? "place" : "places"}`}
              icon={<HeartIcon size={19} />}
              onPress={() => router.navigate("/saved")}
            />
            <ListRow
              title="Security"
              detail="Password and two-step sign-in, on the website"
              icon={<ShieldIcon size={19} />}
              onPress={() => openSite(consumerUrl("/account"))}
              last
            />
          </View>
        </>
      ) : (
        <View style={styles.signIn}>
          <SeatMateMark size={44} color="#fff" />
          <Text style={styles.signInTitle}>Make SeatMate yours</Text>
          <Text style={styles.signInText}>
            Save places, pick up where you left off and get an email the moment a seat opens at a full spot.
          </Text>
          <Button title="Sign in or create account" variant="green" onPress={() => router.push("/login")} style={{ marginTop: 18 }} />
          <View style={styles.perks}>
            <Perk icon={<HeartIcon size={16} color="#fff" />} text="Saved places" />
            <Perk icon={<BellIcon size={16} color="#fff" />} text="Seat alerts" />
            <Perk icon={<PinIcon size={16} color="#fff" />} text="Your area" />
          </View>
        </View>
      )}

      <Text style={styles.groupTitleAlone}>SeatMate</Text>
      <View style={styles.group}>
        {features.suggestPlace && (
          <ListRow title="Suggest a place" detail="Ask for live seats somewhere new" icon={<PlusIcon size={19} />} onPress={() => router.push("/suggest")} />
        )}
        <ListRow title="Contact us" detail="Questions, feedback, problems" icon={<MailIcon size={19} />} onPress={() => router.push("/contact")} />
        <ListRow
          title="Own a business?"
          detail="Put your seats on SeatMate"
          icon={<StorefrontIcon size={19} />}
          onPress={() => openSite(businessUrl("/"))}
        />
        <ListRow title="How SeatMate works" icon={<SeatMateMark size={19} />} onPress={() => openSite(consumerUrl("/about"))} />
        <ListRow title="Privacy" icon={<ShieldIcon size={19} />} onPress={() => openSite(consumerUrl("/privacy"))} />
        <ListRow title="Terms" icon={<DocIcon size={19} />} onPress={() => openSite(consumerUrl("/terms"))} last />
      </View>

      {user && (
        <>
          <View style={[styles.group, { marginTop: 22 }]}>
            <ListRow
              title="Sign out"
              icon={<SignOutIcon size={19} />}
              onPress={() => confirm("Sign out?", "You can sign back in any time.", "Sign out", () => signOut())}
            />
            <ListRow title="Delete account" danger onPress={() => router.push("/delete-account")} last />
          </View>
        </>
      )}

      <Text style={styles.version}>SeatMate {Constants.expoConfig?.version ?? ""}</Text>
    </ScrollView>
  );
}

function Perk({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <View style={styles.perk}>
      {icon}
      <Text style={styles.perkText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.page },
  pad: { paddingHorizontal: 20 },
  title: { fontSize: 32, fontWeight: "900", color: colors.ink, letterSpacing: -1 },
  profile: { flexDirection: "row", alignItems: "center", gap: 14, marginTop: 18 },
  avatar: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: colors.ink,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: "#fff", fontSize: 26, fontWeight: "900" },
  name: { fontSize: 21, fontWeight: "900", color: colors.ink },
  email: { fontSize: 14, color: colors.muted, marginTop: 2 },
  stats: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: 18,
    paddingVertical: 14,
  },
  stat: { flex: 1, alignItems: "center" },
  statValue: { fontSize: 20, fontWeight: "900", color: colors.ink },
  statLabel: { fontSize: 12, fontWeight: "700", color: colors.muted, marginTop: 2 },
  statDivider: { width: 1, backgroundColor: colors.line },
  groupHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginTop: 26, marginBottom: 10 },
  groupTitle: { fontSize: 13, fontWeight: "900", color: colors.muted, textTransform: "uppercase", letterSpacing: 1 },
  groupAction: { fontSize: 14, fontWeight: "800", color: colors.green },
  groupTitleAlone: {
    fontSize: 13,
    fontWeight: "900",
    color: colors.muted,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginTop: 26,
    marginBottom: 10,
  },
  group: { backgroundColor: "#fff", borderRadius: 20, borderWidth: 1, borderColor: colors.border, overflow: "hidden" },
  signIn: { backgroundColor: colors.ink, borderRadius: 26, padding: 22, marginTop: 18 },
  signInTitle: { color: "#fff", fontSize: 24, fontWeight: "900", marginTop: 14, letterSpacing: -0.5 },
  signInText: { color: "rgba(255,255,255,0.65)", fontSize: 15, lineHeight: 21, marginTop: 6 },
  perks: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 16 },
  perk: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  perkText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  version: { textAlign: "center", color: colors.faint, fontSize: 12, marginTop: 26 },
});
