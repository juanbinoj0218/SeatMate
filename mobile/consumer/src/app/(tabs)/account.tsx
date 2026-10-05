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
import { Banner, Button, colors, ListRow, readable, space } from "@/components/ui";
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
      contentContainerStyle={[styles.pad, readable, { paddingTop: insets.top + 24, paddingBottom: 56 }]}
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
              <Text style={styles.statValue}>{profile.homeZip || "None"}</Text>
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
              <View style={[styles.group, { paddingHorizontal: 18, paddingVertical: 8 }]}>
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
              icon={<UserIcon size={21} />}
              onPress={() => router.push("/profile")}
            />
            <ListRow
              title="Saved places"
              detail={`${favorites.length} ${favorites.length === 1 ? "place" : "places"}`}
              icon={<HeartIcon size={21} />}
              onPress={() => router.navigate("/saved")}
            />
            <ListRow
              title="Security"
              detail="Password and two-step sign-in, on the website"
              icon={<ShieldIcon size={21} />}
              onPress={() => openSite(consumerUrl("/account"))}
              last
            />
          </View>
        </>
      ) : (
        <View style={styles.signIn}>
          <SeatMateMark size={48} color="#fff" />
          <Text style={styles.signInTitle}>Make SeatMate yours</Text>
          <Text style={styles.signInText}>
            Save places, pick up where you left off and get an email the moment a seat opens at a full spot.
          </Text>
          <Button title="Sign in or create account" variant="green" onPress={() => router.push("/login")} style={{ marginTop: 24 }} />
          <View style={styles.perks}>
            <Perk icon={<HeartIcon size={17} color="#fff" />} text="Saved places" />
            <Perk icon={<BellIcon size={17} color="#fff" />} text="Seat alerts" />
            <Perk icon={<PinIcon size={17} color="#fff" />} text="Your area" />
          </View>
        </View>
      )}

      <Text style={styles.groupTitleAlone}>SeatMate</Text>
      <View style={styles.group}>
        {features.suggestPlace && (
          <ListRow title="Suggest a place" detail="Ask for live seats somewhere new" icon={<PlusIcon size={21} />} onPress={() => router.push("/suggest")} />
        )}
        <ListRow title="Contact us" detail="Questions, feedback, problems" icon={<MailIcon size={21} />} onPress={() => router.push("/contact")} />
        <ListRow
          title="Own a business?"
          detail="Put your seats on SeatMate"
          icon={<StorefrontIcon size={21} />}
          onPress={() => openSite(businessUrl("/"))}
        />
        <ListRow title="How SeatMate works" icon={<SeatMateMark size={21} />} onPress={() => openSite(consumerUrl("/about"))} />
        <ListRow title="Privacy" icon={<ShieldIcon size={21} />} onPress={() => openSite(consumerUrl("/privacy"))} />
        <ListRow title="Terms" icon={<DocIcon size={21} />} onPress={() => openSite(consumerUrl("/terms"))} last />
      </View>

      {user && (
        <>
          <View style={[styles.group, { marginTop: 32 }]}>
            <ListRow
              title="Sign out"
              icon={<SignOutIcon size={21} />}
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
  pad: { paddingHorizontal: space.gutter },
  title: { fontSize: 36, fontWeight: "900", color: colors.ink, letterSpacing: -1.2 },
  profile: { flexDirection: "row", alignItems: "center", gap: 16, marginTop: 28 },
  avatar: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: colors.ink,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: "#fff", fontSize: 28, fontWeight: "900" },
  name: { fontSize: 23, fontWeight: "900", color: colors.ink, letterSpacing: -0.4 },
  email: { fontSize: 16, color: colors.muted, marginTop: 4 },
  stats: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: 24,
    paddingVertical: 20,
  },
  stat: { flex: 1, alignItems: "center" },
  statValue: { fontSize: 24, fontWeight: "900", color: colors.ink },
  statLabel: { fontSize: 14, fontWeight: "700", color: colors.muted, marginTop: 4 },
  statDivider: { width: 1, backgroundColor: colors.line },
  groupHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginTop: space.section, marginBottom: 14 },
  groupTitle: { fontSize: 14, fontWeight: "900", color: colors.muted, textTransform: "uppercase", letterSpacing: 1 },
  groupAction: { fontSize: 15, fontWeight: "800", color: colors.green },
  groupTitleAlone: {
    fontSize: 14,
    fontWeight: "900",
    color: colors.muted,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginTop: space.section,
    marginBottom: 14,
  },
  group: { backgroundColor: "#fff", borderRadius: 24, borderWidth: 1, borderColor: colors.border, overflow: "hidden" },
  signIn: { backgroundColor: colors.ink, borderRadius: 28, padding: 28, marginTop: 28 },
  signInTitle: { color: "#fff", fontSize: 26, fontWeight: "900", marginTop: 20, letterSpacing: -0.5 },
  signInText: { color: "rgba(255,255,255,0.7)", fontSize: 16, lineHeight: 24, marginTop: 10 },
  perks: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 20 },
  perk: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 999,
    paddingHorizontal: 13,
    paddingVertical: 8,
  },
  perkText: { color: "#fff", fontSize: 14, fontWeight: "700" },
  version: { textAlign: "center", color: colors.faint, fontSize: 13, marginTop: space.section },
});
