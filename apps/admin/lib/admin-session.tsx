"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";

import { auth, db } from "@seatmate/shared/firebase";

// Who is using the admin site: signed out, signed in but not an admin, or
// an active admin (admins/{uid} with active: true).

type Session =
  | { state: "loading" }
  | { state: "signedOut" }
  | { state: "denied"; user: User }
  | { state: "admin"; user: User };

const SessionContext = createContext<Session>({ state: "loading" });

export function AdminSessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session>({ state: "loading" });

  useEffect(
    () =>
      onAuthStateChanged(auth, async (user) => {
        if (!user) {
          setSession({ state: "signedOut" });
          return;
        }

        const admin = await getDoc(doc(db, "admins", user.uid)).catch(() => null);
        setSession(
          admin?.exists() && admin.data().active === true
            ? { state: "admin", user }
            : { state: "denied", user }
        );
      }),
    []
  );

  return <SessionContext.Provider value={session}>{children}</SessionContext.Provider>;
}

export const useAdminSession = () => useContext(SessionContext);

// The signed-in admin; only use inside the console (which guarantees it).
export function useAdmin() {
  const session = useAdminSession();
  if (session.state !== "admin") {
    throw new Error("useAdmin() used outside the admin console.");
  }
  return session.user;
}

export const signOutAdmin = () => signOut(auth);

// Calls one of this site's /api/admin routes with the admin's ID token.
export async function adminFetch<T>(user: User, path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      ...init.headers,
      "Content-Type": "application/json",
      Authorization: `Bearer ${await user.getIdToken()}`,
    },
  });

  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(body.error || `Request failed (${response.status}).`);
  }

  return body as T;
}
