// Customer accounts, shared with the SeatMate website.
//
// This mirrors the website's account-provider.tsx so both read and write the
// exact same data:
//
//   users/{uid}                    displayName, homeZip, recentlyViewed
//   users/{uid}/favorites/{slug}   one document per saved place
//
// A place saved on the website shows up here, and the other way around.

import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { onAuthStateChanged, signOut as firebaseSignOut, User } from "firebase/auth";

import {
  collection,
  deleteDoc,
  doc,
  increment,
  onSnapshot,
  serverTimestamp,
  setDoc,
  Timestamp,
} from "firebase/firestore";

import { auth } from "./auth";
import { db } from "./firebase";

// -------------------------
// TYPES (same shape as the website)
// -------------------------

export type PlaceSummary = {
  slug: string;
  name: string;
  address: string;
  type: string;
  imageUrl: string;
};

export type SavedPlace = PlaceSummary & {
  savedAtMs: number | null;
};

export type RecentPlace = PlaceSummary & {
  viewedAtMs: number;
};

export type Profile = {
  displayName: string;
  homeZip: string;
  recentlyViewed: RecentPlace[];
};

const EMPTY_PROFILE: Profile = {
  displayName: "",
  homeZip: "",
  recentlyViewed: [],
};

const MAX_RECENT = 8;

type AccountContextValue = {
  user: User | null;
  // False until Firebase has told us whether someone is signed in
  authReady: boolean;
  profile: Profile;
  profileReady: boolean;
  favorites: SavedPlace[];
  syncError: string;
  isFavorite: (slug: string) => boolean;
  // Returns false if the person needs to sign in first
  toggleFavorite: (place: PlaceSummary) => Promise<boolean>;
  recordView: (place: PlaceSummary) => Promise<void>;
  clearRecentlyViewed: () => Promise<void>;
  saveProfile: (changes: Partial<Pick<Profile, "displayName" | "homeZip">>) => Promise<void>;
  signOut: () => Promise<void>;
};

const AccountContext = createContext<AccountContextValue | null>(null);

// -------------------------
// HELPERS
// -------------------------

// Same daily stats the website records (publicBusinesses/{slug}/stats/{day})
function dayKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`;
}

export function bumpPlaceStat(slug: string, stat: "views" | "saves") {
  if (!slug) {
    return;
  }

  // Fire and forget: stats never block or break the app
  setDoc(
    doc(db, "publicBusinesses", slug, "stats", dayKey()),
    { [stat]: increment(1) },
    { merge: true }
  ).catch(() => {});
}

function describeError(error: unknown, fallback: string) {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String((error as { code: unknown }).code)
      : "";

  if (code === "permission-denied") {
    return "Your account data is blocked by the database's security rules.";
  }

  if (code === "unavailable") {
    return "SeatMate can't reach the database right now. Check your connection.";
  }

  return code ? `${fallback} (${code})` : fallback;
}

function toPlaceSummary(value: Record<string, unknown>): PlaceSummary {
  return {
    slug: String(value.slug || ""),
    name: String(value.name || "SeatMate location"),
    address: String(value.address || ""),
    type: String(value.type || "Restaurant"),
    imageUrl: String(value.imageUrl || ""),
  };
}

// First name for greetings, e.g. "Hi, Maya"
export function firstName(profile: Profile, user: User | null) {
  const name = profile.displayName || user?.displayName || "";
  return name.trim().split(/\s+/)[0] || "";
}

// One letter for the round account button
export function initialFor(profile: Profile, user: User | null) {
  const source = profile.displayName || user?.displayName || user?.email || "";
  return source.trim().charAt(0).toUpperCase() || "S";
}

// -------------------------
// PROVIDER
// -------------------------

export function AccountProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [profile, setProfile] = useState<Profile>(EMPTY_PROFILE);
  const [profileReady, setProfileReady] = useState(false);
  const [favorites, setFavorites] = useState<SavedPlace[]>([]);
  const [syncError, setSyncError] = useState("");

  // Latest profile for callbacks
  const profileRef = useRef(profile);

  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);

  useEffect(() => {
    let stopProfile: (() => void) | undefined;
    let stopFavorites: (() => void) | undefined;

    const stopAuth = onAuthStateChanged(auth, (nextUser) => {
      stopProfile?.();
      stopFavorites?.();

      setUser(nextUser);
      setAuthReady(true);
      setProfile(EMPTY_PROFILE);
      setProfileReady(false);
      setFavorites([]);
      setSyncError("");

      if (!nextUser) {
        return;
      }

      const userRef = doc(db, "users", nextUser.uid);

      stopProfile = onSnapshot(
        userRef,
        (snapshot) => {
          if (!snapshot.exists()) {
            // First time with this account: create the profile document
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
              setSyncError(describeError(error, "We couldn't set up your account data."));
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
          setSyncError(describeError(error, "We couldn't load your account data."));
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

          // Newest first; ones still being written (no timestamp yet) on top
          saved.sort(
            (a, b) =>
              (b.savedAtMs ?? Number.MAX_SAFE_INTEGER) - (a.savedAtMs ?? Number.MAX_SAFE_INTEGER)
          );

          setFavorites(saved);
        },
        (error) => {
          console.error("Could not load saved places:", error);
          setSyncError(describeError(error, "We couldn't load your saved places."));
        }
      );
    });

    return () => {
      stopAuth();
      stopProfile?.();
      stopFavorites?.();
    };
  }, []);

  const favoriteSlugs = useMemo(
    () => new Set(favorites.map((place) => place.slug)),
    [favorites]
  );

  const isFavorite = useCallback((slug: string) => favoriteSlugs.has(slug), [favoriteSlugs]);

  const toggleFavorite = useCallback(
    async (place: PlaceSummary) => {
      if (!user) {
        return false;
      }

      const favoriteRef = doc(db, "users", user.uid, "favorites", place.slug);

      try {
        if (favoriteSlugs.has(place.slug)) {
          await deleteDoc(favoriteRef);
        } else {
          await setDoc(favoriteRef, { ...place, savedAt: serverTimestamp() });
          bumpPlaceStat(place.slug, "saves");
        }
      } catch (error) {
        console.error("Could not update saved places:", error);
        setSyncError(describeError(error, "We couldn't update your saved places."));
      }

      return true;
    },
    [user, favoriteSlugs]
  );

  const recordView = useCallback(
    async (place: PlaceSummary) => {
      if (!user) {
        return;
      }

      const current = profileRef.current.recentlyViewed;

      // Already the most recent entry; nothing to change
      if (current[0]?.slug === place.slug) {
        return;
      }

      const next = [
        { ...place, viewedAtMs: Date.now() },
        ...current.filter((item) => item.slug !== place.slug),
      ].slice(0, MAX_RECENT);

      try {
        await setDoc(
          doc(db, "users", user.uid),
          { recentlyViewed: next, updatedAt: serverTimestamp() },
          { merge: true }
        );
      } catch (error) {
        console.error("Could not save recently viewed place:", error);
      }
    },
    [user]
  );

  const clearRecentlyViewed = useCallback(async () => {
    if (!user) {
      return;
    }

    await setDoc(
      doc(db, "users", user.uid),
      { recentlyViewed: [], updatedAt: serverTimestamp() },
      { merge: true }
    );
  }, [user]);

  const saveProfile = useCallback(
    async (changes: Partial<Pick<Profile, "displayName" | "homeZip">>) => {
      if (!user) {
        return;
      }

      await setDoc(
        doc(db, "users", user.uid),
        { ...changes, updatedAt: serverTimestamp() },
        { merge: true }
      );
    },
    [user]
  );

  const signOut = useCallback(async () => {
    await firebaseSignOut(auth);
  }, []);

  const value = useMemo<AccountContextValue>(
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
    ]
  );

  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>;
}

export function useAccount() {
  const value = useContext(AccountContext);

  if (!value) {
    throw new Error("useAccount must be used inside <AccountProvider>.");
  }

  return value;
}
