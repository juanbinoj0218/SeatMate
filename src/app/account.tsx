import { useEffect, useMemo, useState } from "react";

import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
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

import { collection, doc, getDoc, getDocs } from "firebase/firestore";

import { db } from "../lib/firebase";
import {
  firstName,
  initialFor,
  PlaceSummary,
  Profile,
  SavedPlace,
  useAccount,
} from "../lib/account";

// -------------------------
// COLORS (same calm palette as the place page)
// -------------------------

const C = {
  page: "#F6F6F3",
  card: "#FFFFFF",
  border: "#ECECE8",
  divider: "#F1F1EE",
  text: "#1F2522",
  textSoft: "#5F6763",
  textMuted: "#9AA09D",
  free: "#34A869",
  freeText: "#23804F",
  taken: "#E07A7A",
  takenText: "#B55353",
  dark: "#1F2522",
};

type SeatSummary = { available: number; total: number } | null;

// Live-ish seat count for a saved place (read once when the page opens)
async function fetchPlaceSeats(slug: string): Promise<SeatSummary> {
  const placeSnapshot = await getDoc(doc(db, "publicBusinesses", slug));

  if (!placeSnapshot.exists()) {
    return null;
  }

  const businessId = String(placeSnapshot.data().businessId ?? "");

  if (!businessId) {
    return null;
  }

  const tablesSnapshot = await getDocs(collection(db, "businesses", businessId, "tables"));

  let total = 0;
  let available = 0;

  tablesSnapshot.docs.forEach((tableDoc) => {
    const seats = tableDoc.data().seats;

    if (!Array.isArray(seats)) {
      return;
    }

    seats.forEach((seat: { status?: string }) => {
      total += 1;

      if (seat?.status !== "occupied") {
        available += 1;
      }
    });
  });

  return { available, total };
}

function formatViewedAt(ms: number) {
  if (!ms) {
    return "";
  }

  const date = new Date(ms);

  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// -------------------------
// SCREEN
// -------------------------

export default function AccountScreen() {
  const router = useRouter();

  const {
    user,
    authReady,
    profile,
    profileReady,
    favorites,
    syncError,
    clearRecentlyViewed,
    signOut,
  } = useAccount();

  function openPlace(slug: string) {
    router.push({ pathname: "/place/[slug]", params: { slug } });
  }

  function goBack() {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/");
    }
  }

  // -------------------------
  // LOADING / SIGNED OUT
  // -------------------------

  if (!authReady) {
    return (
      <SafeAreaView style={styles.centerPage}>
        <ActivityIndicator color={C.textSoft} />
      </SafeAreaView>
    );
  }

  if (!user) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.page}>
          <TopBar onBack={goBack} />

          <View style={styles.signedOut}>
            <View style={styles.signedOutIcon}>
              <Ionicons name="person-outline" size={28} color={C.textSoft} />
            </View>

            <Text style={styles.signedOutTitle}>Your places, one tap away</Text>

            <Text style={styles.signedOutText}>
              Save your favorite cafés and restaurants, set a home ZIP, and pick up where you
              left off. Same account as the SeatMate website.
            </Text>

            <Pressable
              onPress={() => router.push("/login")}
              style={({ pressed }) => [styles.primaryButton, pressed ? { opacity: 0.8 } : null]}
            >
              <Text style={styles.primaryButtonText}>Sign in</Text>
            </Pressable>

            <Pressable
              onPress={() => router.push({ pathname: "/login", params: { mode: "signup" } })}
              hitSlop={8}
              style={{ marginTop: 14 }}
            >
              <Text style={styles.linkText}>Create an account</Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const name = firstName(profile, user);

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.page}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <TopBar onBack={goBack} />

          {/* GREETING */}

          <View style={styles.greetingRow}>
            <Avatar photoUrl={user.photoURL} letter={initialFor(profile, user)} size={60} />

            <View style={{ flex: 1, marginLeft: 14 }}>
              <Text style={styles.greeting} numberOfLines={1}>
                {name ? `Hi, ${name}` : "Your account"}
              </Text>

              <Text style={styles.email} numberOfLines={1}>
                {user.email}
              </Text>
            </View>
          </View>

          {syncError !== "" && (
            <View style={styles.warningBox}>
              <Text style={styles.warningText}>{syncError}</Text>
            </View>
          )}

          {/* SAVED PLACES */}

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Saved places</Text>

            {favorites.length > 0 && (
              <Text style={styles.sectionMeta}>{favorites.length} saved</Text>
            )}
          </View>

          {favorites.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="heart-outline" size={30} color="#D2D4D0" />

              <Text style={styles.emptyTitle}>No saved places yet</Text>

              <Text style={styles.emptyText}>
                Tap the heart on any café or restaurant to keep it here, with its live seat
                count.
              </Text>

              <Pressable
                onPress={() => router.replace("/")}
                style={({ pressed }) => [styles.smallDarkButton, pressed ? { opacity: 0.8 } : null]}
              >
                <Text style={styles.smallDarkButtonText}>Browse places</Text>
              </Pressable>
            </View>
          ) : (
            <SavedList favorites={favorites} onOpen={openPlace} />
          )}

          {/* RECENTLY VIEWED */}

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recently viewed</Text>

            {profile.recentlyViewed.length > 0 && (
              <Pressable onPress={clearRecentlyViewed} hitSlop={8}>
                <Text style={styles.sectionAction}>Clear</Text>
              </Pressable>
            )}
          </View>

          {profile.recentlyViewed.length === 0 ? (
            <Text style={styles.mutedText}>Places you open will show up here.</Text>
          ) : (
            <View style={styles.listCard}>
              {profile.recentlyViewed.map((place, index) => (
                <Pressable
                  key={place.slug}
                  onPress={() => openPlace(place.slug)}
                  style={({ pressed }) => [
                    styles.listRow,
                    index > 0 ? styles.listRowBorder : null,
                    pressed ? { backgroundColor: "#F7F8F5" } : null,
                  ]}
                >
                  <PlaceThumb place={place} size={44} />

                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.rowTitle} numberOfLines={1}>
                      {place.name}
                    </Text>

                    <Text style={styles.rowSub} numberOfLines={1}>
                      {place.type}
                      {place.address ? ` · ${place.address}` : ""}
                    </Text>
                  </View>

                  <Text style={styles.rowTime}>{formatViewedAt(place.viewedAtMs)}</Text>
                </Pressable>
              ))}
            </View>
          )}

          {/* PROFILE */}

          <Text style={[styles.sectionTitle, { marginTop: 30 }]}>Profile</Text>

          {profileReady && <ProfileForm key={user.uid} initial={profile} />}

          {/* SIGN OUT */}

          <Pressable
            onPress={async () => {
              await signOut();
              router.replace("/");
            }}
            style={({ pressed }) => [styles.signOutButton, pressed ? { opacity: 0.7 } : null]}
          >
            <Ionicons name="log-out-outline" size={18} color={C.takenText} />
            <Text style={styles.signOutText}>Sign out</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// -------------------------
// PIECES
// -------------------------

function TopBar({ onBack }: { onBack: () => void }) {
  return (
    <View style={styles.topBar}>
      <Pressable
        onPress={onBack}
        hitSlop={10}
        style={({ pressed }) => [styles.backButton, pressed ? { opacity: 0.6 } : null]}
      >
        <Ionicons name="chevron-back" size={20} color={C.text} />
      </Pressable>

      <Text style={styles.topBarTitle}>Account</Text>

      <View style={{ width: 38 }} />
    </View>
  );
}

function Avatar({
  photoUrl,
  letter,
  size,
}: {
  photoUrl: string | null;
  letter: string;
  size: number;
}) {
  if (photoUrl) {
    return (
      <Image
        alt=""
        source={{ uri: photoUrl }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
      />
    );
  }

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: "#E4EFE7",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text style={{ color: C.freeText, fontSize: size * 0.42, fontWeight: "700" }}>{letter}</Text>
    </View>
  );
}

function PlaceThumb({ place, size }: { place: PlaceSummary; size: number }) {
  if (place.imageUrl) {
    return (
      <Image
        alt=""
        source={{ uri: place.imageUrl }}
        style={{ width: size, height: size, borderRadius: 12 }}
      />
    );
  }

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: 12,
        backgroundColor: "#EEF2EC",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text style={{ color: "#5E8A6A", fontSize: size * 0.42, fontWeight: "700" }}>
        {place.name.trim().charAt(0).toUpperCase() || "S"}
      </Text>
    </View>
  );
}

function SavedList({
  favorites,
  onOpen,
}: {
  favorites: SavedPlace[];
  onOpen: (slug: string) => void;
}) {
  const { toggleFavorite } = useAccount();

  const [seats, setSeats] = useState<Record<string, SeatSummary>>({});

  const slugs = useMemo(() => favorites.map((place) => place.slug).join(","), [favorites]);

  // Seat counts for each saved place
  useEffect(() => {
    let cancelled = false;

    slugs
      .split(",")
      .filter(Boolean)
      .forEach((slug) => {
        fetchPlaceSeats(slug)
          .then((summary) => {
            if (!cancelled) {
              setSeats((previous) => ({ ...previous, [slug]: summary }));
            }
          })
          .catch((error) => console.error(`Could not load seats for ${slug}:`, error));
      });

    return () => {
      cancelled = true;
    };
  }, [slugs]);

  return (
    <View style={styles.listCard}>
      {favorites.map((place, index) => {
        const summary = seats[place.slug];

        let seatText = "Checking seats…";
        let seatColor = C.textMuted;

        if (summary === null) {
          seatText = "No longer listed";
        } else if (summary !== undefined) {
          if (summary.total === 0) {
            seatText = "No seating data yet";
          } else {
            seatText = `${summary.available} of ${summary.total} seats open`;
            seatColor = summary.available > 0 ? C.freeText : C.takenText;
          }
        }

        return (
          <Pressable
            key={place.slug}
            onPress={() => onOpen(place.slug)}
            style={({ pressed }) => [
              styles.listRow,
              index > 0 ? styles.listRowBorder : null,
              pressed ? { backgroundColor: "#F7F8F5" } : null,
            ]}
          >
            <PlaceThumb place={place} size={52} />

            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.rowTitle} numberOfLines={1}>
                {place.name}
              </Text>

              <Text style={styles.rowSub} numberOfLines={1}>
                {place.type}
              </Text>

              <Text style={[styles.rowSeats, { color: seatColor }]}>{seatText}</Text>
            </View>

            <Pressable
              onPress={() => toggleFavorite(place)}
              hitSlop={10}
              style={({ pressed }) => [styles.heartButton, pressed ? { opacity: 0.6 } : null]}
            >
              <Ionicons name="heart" size={20} color={C.taken} />
            </Pressable>
          </Pressable>
        );
      })}
    </View>
  );
}

function ProfileForm({ initial }: { initial: Profile }) {
  const { saveProfile } = useAccount();

  const [displayName, setDisplayName] = useState(initial.displayName);
  const [homeZip, setHomeZip] = useState(initial.homeZip);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState("");

  const changed = displayName.trim() !== initial.displayName || homeZip !== initial.homeZip;

  async function submit() {
    setError("");

    if (homeZip && !/^\d{5}$/.test(homeZip)) {
      setError("Enter a 5-digit ZIP code, or leave it blank.");
      return;
    }

    setStatus("saving");

    try {
      await saveProfile({ displayName: displayName.trim(), homeZip });
      setStatus("saved");
    } catch (caught) {
      console.error("Could not save profile:", caught);
      setStatus("error");
      setError("We couldn't save your profile. Please try again.");
    }
  }

  return (
    <View style={styles.formCard}>
      <Text style={styles.fieldLabel}>Name</Text>

      <TextInput
        value={displayName}
        onChangeText={(value) => {
          setDisplayName(value);
          setStatus("idle");
        }}
        placeholder="Your name"
        placeholderTextColor={C.textMuted}
        autoComplete="name"
        style={styles.input}
      />

      <Text style={[styles.fieldLabel, { marginTop: 14 }]}>Home ZIP code</Text>

      <TextInput
        value={homeZip}
        onChangeText={(value) => {
          setHomeZip(value.replace(/\D/g, "").slice(0, 5));
          setStatus("idle");
        }}
        placeholder="e.g. 94110"
        placeholderTextColor={C.textMuted}
        keyboardType="number-pad"
        autoComplete="postal-code"
        style={styles.input}
      />

      <Text style={styles.fieldHint}>Used for “Open seats near you” when location is off.</Text>

      {error !== "" && <Text style={styles.formError}>{error}</Text>}

      <Pressable
        onPress={submit}
        disabled={!changed || status === "saving"}
        style={({ pressed }) => [
          styles.primaryButton,
          { marginTop: 16, width: "100%" },
          !changed || status === "saving" ? { opacity: 0.35 } : null,
          pressed ? { opacity: 0.8 } : null,
        ]}
      >
        <Text style={styles.primaryButtonText}>
          {status === "saving" ? "Saving…" : "Save changes"}
        </Text>
      </Pressable>

      {status === "saved" && !changed && <Text style={styles.savedText}>Saved</Text>}
    </View>
  );
}

// -------------------------
// STYLES
// -------------------------

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: C.page },

  centerPage: { flex: 1, backgroundColor: C.page, alignItems: "center", justifyContent: "center" },

  page: { paddingHorizontal: 16, paddingBottom: 48 },

  topBar: {
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  backButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: "center",
    justifyContent: "center",
  },

  topBarTitle: { fontSize: 16, fontWeight: "700", color: C.text },

  // SIGNED OUT

  signedOut: { alignItems: "center", paddingTop: 50, paddingHorizontal: 12 },

  signedOutIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: "center",
    justifyContent: "center",
  },

  signedOutTitle: {
    marginTop: 18,
    fontSize: 24,
    fontWeight: "800",
    color: C.text,
    textAlign: "center",
  },

  signedOutText: {
    marginTop: 8,
    fontSize: 15,
    lineHeight: 21,
    color: C.textSoft,
    textAlign: "center",
  },

  // GREETING

  greetingRow: { flexDirection: "row", alignItems: "center", marginTop: 6 },

  greeting: { fontSize: 26, fontWeight: "800", color: C.text, letterSpacing: -0.4 },

  email: { marginTop: 2, fontSize: 14, color: C.textSoft },

  warningBox: { marginTop: 16, backgroundColor: "#FBF4E3", borderRadius: 14, padding: 12 },

  warningText: { color: "#7A5A12", fontSize: 14, lineHeight: 19 },

  // SECTIONS

  sectionHeader: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    marginTop: 30,
    marginBottom: 10,
  },

  sectionTitle: { fontSize: 20, fontWeight: "800", color: C.text, letterSpacing: -0.3 },

  sectionMeta: { fontSize: 13, color: C.textMuted },

  sectionAction: { fontSize: 14, fontWeight: "600", color: C.textSoft },

  mutedText: { fontSize: 14, color: C.textSoft },

  emptyCard: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.6)",
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#D6D8D3",
    borderRadius: 20,
    paddingVertical: 28,
    paddingHorizontal: 20,
  },

  emptyTitle: { marginTop: 10, fontSize: 16, fontWeight: "700", color: C.text },

  emptyText: {
    marginTop: 4,
    fontSize: 14,
    lineHeight: 20,
    color: C.textSoft,
    textAlign: "center",
  },

  smallDarkButton: {
    marginTop: 14,
    backgroundColor: C.dark,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },

  smallDarkButtonText: { color: "#FFFFFF", fontSize: 14, fontWeight: "600" },

  listCard: {
    backgroundColor: C.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.border,
    overflow: "hidden",
  },

  listRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 12 },

  listRowBorder: { borderTopWidth: 1, borderTopColor: C.divider },

  rowTitle: { fontSize: 15, fontWeight: "700", color: C.text },

  rowSub: { marginTop: 1, fontSize: 13, color: C.textSoft },

  rowSeats: { marginTop: 4, fontSize: 13, fontWeight: "600" },

  rowTime: { marginLeft: 8, fontSize: 12, color: C.textMuted },

  heartButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#FBEEEE",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
  },

  // PROFILE

  formCard: {
    marginTop: 10,
    backgroundColor: C.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.border,
    padding: 16,
  },

  fieldLabel: { fontSize: 14, fontWeight: "600", color: C.text, marginBottom: 6 },

  input: {
    height: 46,
    borderWidth: 1,
    borderColor: "#E6E6E2",
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 16,
    color: C.text,
  },

  fieldHint: { marginTop: 6, fontSize: 13, color: C.textMuted },

  formError: { marginTop: 10, fontSize: 14, color: C.takenText },

  savedText: { marginTop: 10, textAlign: "center", fontSize: 14, color: C.freeText },

  // BUTTONS

  primaryButton: {
    marginTop: 22,
    height: 50,
    minWidth: 200,
    borderRadius: 14,
    backgroundColor: C.dark,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },

  primaryButtonText: { color: "#FFFFFF", fontSize: 16, fontWeight: "700" },

  linkText: { color: C.freeText, fontSize: 15, fontWeight: "600" },

  signOutButton: {
    marginTop: 26,
    height: 50,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.card,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },

  signOutText: { marginLeft: 8, color: C.takenText, fontSize: 16, fontWeight: "600" },
});
