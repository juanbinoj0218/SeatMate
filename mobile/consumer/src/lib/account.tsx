import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { onAuthStateChanged, signOut as firebaseSignOut, type User } from "firebase/auth";
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  where,
  writeBatch,
} from "firebase/firestore";

import { SEAT_ALERTS } from "@seatmate/shared/seat-alerts";

import { colors } from "@/components/ui";
import { bumpPlaceStat } from "@/lib/analytics";
import { auth, db, firebaseConfigured } from "@/lib/firebase";
import { success } from "@/lib/haptics";

// Customer accounts, exactly as on the website: the profile fields and
// recentlyViewed on users/{uid}, saved places in users/{uid}/favorites (one
// document per place slug). Saving a place in the app shows up on
// seatmate360.com and the other way round.

export type PlaceSummary = {
  slug: string;
  name: string;
  address: string;
  type: string;
  imageUrl: string;
};

export type SavedPlace = PlaceSummary & { savedAtMs: number | null };

export type RecentPlace = PlaceSummary & { viewedAtMs: number };

export type Profile = {
  displayName: string;
  homeZip: string;
  recentlyViewed: RecentPlace[];
};

const EMPTY_PROFILE: Profile = { displayName: "", homeZip: "", recentlyViewed: [] };

const MAX_RECENT = 8;

type AccountValue = {
  user: User | null;
  // False until Firebase has said whether someone is signed in.
  authReady: boolean;
  profile: Profile;
  profileReady: boolean;
  favorites: SavedPlace[];
  // Set when account data can't be read or written, so screens can say so.
  syncError: string;
  isFavorite: (slug: string) => boolean;
  toggleFavorite: (place: PlaceSummary) => Promise<void>;
  recordView: (place: PlaceSummary) => Promise<void>;
  clearRecentlyViewed: () => Promise<void>;
  saveProfile: (changes: Partial<Pick<Profile, "displayName" | "homeZip">>) => Promise<void>;
  signOut: () => Promise<void>;
  goToSignIn: () => void;
  // Removes saved places, seat alerts and the profile (before the sign-in
  // account itself is deleted).
  deleteCustomerData: () => Promise<void>;
  showToast: (message: string) => void;
};

const AccountContext = createContext<AccountValue | null>(null);

export const describeAccountError = (error: unknown, fallback: string) => {
  const code =
    typeof error === "object" && error !== null && "code" in error ? String((error as { code: unknown }).code) : "";

  if (code === "permission-denied") {
    return "Your account data is blocked by the database's security rules, so nothing can be saved yet.";
  }
  if (code === "unavailable") {
    return "SeatMate can't reach the database right now. Check your connection.";
  }
  return code ? `${fallback} (${code})` : fallback;
};

const toPlaceSummary = (value: Record<string, unknown>): PlaceSummary => ({
  slug: String(value.slug || ""),
  name: String(value.name || "SeatMate location"),
  address: String(value.address || ""),
  type: String(value.type || "Restaurant"),
  imageUrl: String(value.imageUrl || ""),
});

export function AccountProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(!firebaseConfigured);
  const [profile, setProfile] = useState<Profile>(EMPTY_PROFILE);
  const [profileReady, setProfileReady] = useState(false);
  const [favorites, setFavorites] = useState<SavedPlace[]>([]);
  const [syncError, setSyncError] = useState("");
  const [toast, setToast] = useState("");
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const profileRef = useRef(profile);
  const stopSyncRef = useRef<() => void>(() => {});

  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);

  const showToast = useCallback((message: string) => {
    clearTimeout(toastTimer.current);
    setToast(message);
    toastTimer.current = setTimeout(() => setToast(""), 4000);
  }, []);

  useEffect(() => {
    if (!firebaseConfigured) return;

    let stopProfile: (() => void) | undefined;
    let stopFavorites: (() => void) | undefined;

    const stopSync = () => {
      stopProfile?.();
      stopFavorites?.();
      stopProfile = undefined;
      stopFavorites = undefined;
    };
    stopSyncRef.current = stopSync;

    const stopAuth = onAuthStateChanged(auth, (nextUser) => {
      stopSync();
      setUser(nextUser);
      setAuthReady(true);
      setProfile(EMPTY_PROFILE);
      setProfileReady(false);
      setFavorites([]);
      setSyncError("");

      if (!nextUser) return;

      const userRef = doc(db, "users", nextUser.uid);

      stopProfile = onSnapshot(
        userRef,
        (snapshot) => {
          if (!snapshot.exists()) {
            // First time with this account: create the profile document.
            setDoc(
              userRef,
              {
                displayName: nextUser.displayName || "",
                homeZip: "",
                recentlyViewed: [],
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
              },
              { merge: true }
            ).catch((error) => {
              console.error("Could not create SeatMate profile:", error);
              setSyncError(describeAccountError(error, "We couldn't set up your account data."));
            });
          }

          const data = snapshot.data() || {};
          setProfile({
            displayName: String(data.displayName || nextUser.displayName || ""),
            homeZip: String(data.homeZip || ""),
            recentlyViewed: Array.isArray(data.recentlyViewed)
              ? data.recentlyViewed.map((item: Record<string, unknown>) => ({
                  ...toPlaceSummary(item),
                  viewedAtMs: Number(item.viewedAtMs) || 0,
                }))
              : [],
          });
          setProfileReady(true);
        },
        (error) => {
          console.error("Could not load SeatMate profile:", error);
          setSyncError(describeAccountError(error, "We couldn't load your account data."));
          setProfileReady(true);
        }
      );

      stopFavorites = onSnapshot(
        collection(db, "users", nextUser.uid, "favorites"),
        (snapshot) => {
          const saved = snapshot.docs.map((favoriteDoc) => {
            const data = favoriteDoc.data();
            return {
              ...toPlaceSummary({ ...data, slug: favoriteDoc.id }),
              savedAtMs: data.savedAt instanceof Timestamp ? data.savedAt.toMillis() : null,
            };
          });

          // Newest first; ones still being written (no timestamp yet) on top.
          saved.sort(
            (a, b) => (b.savedAtMs ?? Number.MAX_SAFE_INTEGER) - (a.savedAtMs ?? Number.MAX_SAFE_INTEGER)
          );
          setFavorites(saved);
        },
        (error) => {
          console.error("Could not load saved places:", error);
          setSyncError(describeAccountError(error, "We couldn't load your saved places."));
        }
      );
    });

    return () => {
      stopAuth();
      stopSync();
    };
  }, []);

  const favoriteSlugs = useMemo(() => new Set(favorites.map((place) => place.slug)), [favorites]);
  const isFavorite = useCallback((slug: string) => favoriteSlugs.has(slug), [favoriteSlugs]);

  const goToSignIn = useCallback(() => router.push("/login"), []);

  const toggleFavorite = useCallback(
    async (place: PlaceSummary) => {
      if (!user) {
        goToSignIn();
        return;
      }

      const favoriteRef = doc(db, "users", user.uid, "favorites", place.slug);

      try {
        if (favoriteSlugs.has(place.slug)) {
          await deleteDoc(favoriteRef);
          showToast(`Removed ${place.name} from Saved`);
        } else {
          await setDoc(favoriteRef, { ...place, savedAt: serverTimestamp() });
          bumpPlaceStat(place.slug, "saves");
          success();
          showToast(`Saved ${place.name}`);
        }
      } catch (error) {
        console.error("Could not update saved places:", error);
        const message = describeAccountError(error, "We couldn't update your saved places.");
        setSyncError(message);
        showToast(message);
      }
    },
    [user, favoriteSlugs, goToSignIn, showToast]
  );

  const recordView = useCallback(
    async (place: PlaceSummary) => {
      if (!user) return;

      const current = profileRef.current.recentlyViewed;
      if (current[0]?.slug === place.slug) return;

      const next = [
        { ...place, viewedAtMs: Date.now() },
        ...current.filter((item) => item.slug !== place.slug),
      ].slice(0, MAX_RECENT);

      try {
        await setDoc(doc(db, "users", user.uid), { recentlyViewed: next, updatedAt: serverTimestamp() }, { merge: true });
      } catch (error) {
        console.error("Could not save recently viewed place:", error);
      }
    },
    [user]
  );

  const clearRecentlyViewed = useCallback(async () => {
    if (!user) return;
    await setDoc(doc(db, "users", user.uid), { recentlyViewed: [], updatedAt: serverTimestamp() }, { merge: true });
  }, [user]);

  const saveProfile = useCallback(
    async (changes: Partial<Pick<Profile, "displayName" | "homeZip">>) => {
      if (!user) return;
      await setDoc(doc(db, "users", user.uid), { ...changes, updatedAt: serverTimestamp() }, { merge: true });
    },
    [user]
  );

  const signOut = useCallback(async () => {
    await firebaseSignOut(auth);
  }, []);

  const deleteCustomerData = useCallback(async () => {
    if (!user) return;
    const uid = user.uid;

    // Stop live syncing first, so the profile isn't recreated as it's removed.
    stopSyncRef.current();

    const saved = await getDocs(collection(db, "users", uid, "favorites"));
    const alerts = await getDocs(query(collection(db, SEAT_ALERTS), where("uid", "==", uid)));
    const refs = [...saved.docs, ...alerts.docs].map((item) => item.ref);

    // Batches hold up to 500 writes.
    for (let start = 0; start < refs.length; start += 450) {
      const batch = writeBatch(db);
      refs.slice(start, start + 450).forEach((ref) => batch.delete(ref));
      await batch.commit();
    }

    await deleteDoc(doc(db, "users", uid));
  }, [user]);

  const value = useMemo<AccountValue>(
    () => ({
      user,
      authReady,
      profile,
      profileReady,
      favorites,
      syncError,
      isFavorite,
      toggleFavorite,
      recordView,
      clearRecentlyViewed,
      saveProfile,
      signOut,
      goToSignIn,
      deleteCustomerData,
      showToast,
    }),
    [
      user,
      authReady,
      profile,
      profileReady,
      favorites,
      syncError,
      isFavorite,
      toggleFavorite,
      recordView,
      clearRecentlyViewed,
      saveProfile,
      signOut,
      goToSignIn,
      deleteCustomerData,
      showToast,
    ]
  );

  return (
    <AccountContext.Provider value={value}>
      {children}
      {toast ? (
        <View pointerEvents="none" style={styles.toastWrap}>
          <View accessibilityRole="alert" style={styles.toast}>
            <Text style={styles.toastText}>{toast}</Text>
          </View>
        </View>
      ) : null}
    </AccountContext.Provider>
  );
}

export function useAccount() {
  const value = useContext(AccountContext);
  if (!value) throw new Error("useAccount must be used inside <AccountProvider>.");
  return value;
}

// "Hi, Maya".
export function firstName(profile: Profile, user: User | null) {
  const name = profile.displayName || user?.displayName || "";
  return name.trim().split(/\s+/)[0] || "";
}

const styles = StyleSheet.create({
  toastWrap: { position: "absolute", left: 16, right: 16, bottom: 100, alignItems: "center" },
  toast: {
    maxWidth: 420,
    backgroundColor: colors.ink,
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 13,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  toastText: { color: "#fff", fontSize: 14, fontWeight: "700", textAlign: "center" },
});
