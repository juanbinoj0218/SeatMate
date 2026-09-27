"use client";

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
import { useRouter } from "next/navigation";
import {
  onAuthStateChanged,
  signOut as firebaseSignOut,
  type User,
} from "firebase/auth";
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  Timestamp,
} from "firebase/firestore";

import { auth, db } from "@seatmate/shared/firebase";

// Customer accounts are optional. Everything a signed-in customer adds lives
// under users/{uid}: the profile fields and recentlyViewed on the document,
// saved places in the favorites subcollection (one document per place slug).

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
  // False until Firebase has told us whether someone is signed in.
  authReady: boolean;
  profile: Profile;
  profileReady: boolean;
  favorites: SavedPlace[];
  // Set when the account data could not be read or written (for example
  // missing Firestore rules), so pages can say so instead of looking empty.
  syncError: string;
  isFavorite: (slug: string) => boolean;
  toggleFavorite: (place: PlaceSummary) => Promise<void>;
  recordView: (place: PlaceSummary) => Promise<void>;
  clearRecentlyViewed: () => Promise<void>;
  saveProfile: (
    changes: Partial<Pick<Profile, "displayName" | "homeZip">>
  ) => Promise<void>;
  signOut: () => Promise<void>;
  // Sends signed-out visitors to /login and brings them back afterwards.
  goToSignIn: () => void;
};

const AccountContext = createContext<AccountContextValue | null>(null);

// Turns a Firestore error into a message that says what actually went wrong.
const describeError = (error: unknown, fallback: string) => {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String((error as { code: unknown }).code)
      : "";

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
  const router = useRouter();

  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [profile, setProfile] = useState<Profile>(EMPTY_PROFILE);
  const [profileReady, setProfileReady] = useState(false);
  const [favorites, setFavorites] = useState<SavedPlace[]>([]);
  const [syncError, setSyncError] = useState("");
  const [toast, setToast] = useState("");
  const toastTimer = useRef<number | undefined>(undefined);

  // Brief message at the bottom of the screen, e.g. when a save fails.
  const showToast = useCallback((message: string) => {
    window.clearTimeout(toastTimer.current);
    setToast(message);
    toastTimer.current = window.setTimeout(() => setToast(""), 6000);
  }, []);

  // Latest profile for callbacks, so they don't need to be recreated (and
  // re-trigger effects) every time the profile document changes.
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
            // First visit with this account: create the profile document.
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
              setSyncError(
                describeError(error, "We couldn't set up your account data.")
              );
            });
          }

          const data = snapshot.data() || {};

          setProfile({
            displayName: String(
              data.displayName || nextUser.displayName || ""
            ),
            homeZip: String(data.homeZip || ""),
            recentlyViewed: Array.isArray(data.recentlyViewed)
              ? data.recentlyViewed.map(
                  (item: Record<string, unknown>) => ({
                    ...toPlaceSummary(item),
                    viewedAtMs: Number(item.viewedAtMs) || 0,
                  })
                )
              : [],
          });
          setProfileReady(true);
        },
        (error) => {
          console.error("Could not load SeatMate profile:", error);
          setSyncError(
            describeError(error, "We couldn't load your account data.")
          );
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
              savedAtMs:
                data.savedAt instanceof Timestamp
                  ? data.savedAt.toMillis()
                  : null,
            };
          });

          // Newest first; ones still being written (no timestamp yet) on top.
          saved.sort(
            (a, b) =>
              (b.savedAtMs ?? Number.MAX_SAFE_INTEGER) -
              (a.savedAtMs ?? Number.MAX_SAFE_INTEGER)
          );

          setFavorites(saved);
        },
        (error) => {
          console.error("Could not load saved places:", error);
          setSyncError(
            describeError(error, "We couldn't load your saved places.")
          );
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

  const isFavorite = useCallback(
    (slug: string) => favoriteSlugs.has(slug),
    [favoriteSlugs]
  );

  const goToSignIn = useCallback(() => {
    const next = `${window.location.pathname}${window.location.search}`;
    router.push(`/login?next=${encodeURIComponent(next)}`);
  }, [router]);

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
        } else {
          await setDoc(favoriteRef, {
            ...place,
            savedAt: serverTimestamp(),
          });
        }
      } catch (error) {
        console.error("Could not update saved places:", error);
        const message = describeError(
          error,
          "We couldn't update your saved places."
        );
        setSyncError(message);
        showToast(message);
      }
    },
    [user, favoriteSlugs, goToSignIn, showToast]
  );

  const recordView = useCallback(
    async (place: PlaceSummary) => {
      if (!user) {
        return;
      }

      const current = profileRef.current.recentlyViewed;

      // Already the most recent entry; nothing to change.
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
      goToSignIn,
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
    ]
  );

  return (
    <AccountContext.Provider value={value}>
      {children}

      {toast && (
        <div
          role="alert"
          className="fixed inset-x-4 bottom-5 z-50 mx-auto max-w-md rounded-2xl bg-ink px-5 py-4 text-sm text-white shadow-[0_20px_40px_-16px_rgba(16,24,17,0.5)]"
        >
          {toast}
        </div>
      )}
    </AccountContext.Provider>
  );
}

export function useAccount() {
  const value = useContext(AccountContext);

  if (!value) {
    throw new Error("useAccount must be used inside <AccountProvider>.");
  }

  return value;
}

// Shown on pages that need a first name, e.g. "Hi, Maya".
export function firstName(profile: Profile, user: User | null) {
  const name = profile.displayName || user?.displayName || "";
  return name.trim().split(/\s+/)[0] || "";
}
