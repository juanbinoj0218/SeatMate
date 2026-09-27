"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, type User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";

import { auth, db } from "@seatmate/shared/firebase";

export type OwnedBusiness = {
  id: string;
  name: string;
  slug?: string;
  status?: string;
  address?: string;
  type?: string;
};

// The signed-in owner's business. Sends signed-out visitors to the login
// page and owners without a business to setup.
export function useOwnedBusiness() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [business, setBusiness] = useState<OwnedBusiness | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(
    () =>
      onAuthStateChanged(auth, async (currentUser) => {
        if (!currentUser) {
          router.replace("/business/login");
          return;
        }

        try {
          const snapshot = await getDoc(doc(db, "businesses", currentUser.uid));

          if (!snapshot.exists()) {
            router.replace("/business/setup");
            return;
          }

          setUser(currentUser);
          setBusiness({ id: snapshot.id, ...(snapshot.data() as Omit<OwnedBusiness, "id">) });
        } catch (error) {
          console.error("Error loading business:", error);
        } finally {
          setLoading(false);
        }
      }),
    [router]
  );

  return { user, business, loading };
}
