import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";

import { auth, db } from "@/lib/firebase";

export type BusinessStatus = "draft" | "pending" | "approved" | "suspended" | "rejected";

export type Business = {
  id: string;
  name: string;
  type: string;
  address: string;
  zipcode?: string;
  slug?: string;
  status: BusinessStatus;
};

export type StaffAccount = {
  businessId: string;
  businessName: string;
  role: string;
  active: boolean;
  email?: string;
};

// Who is signed in and what they can do, like the web portal:
// - owner: businesses/{uid} exists
// - staff: staffUsers/{uid} exists (updates seats for one business)
// - new:   signed in with neither, so they set up a business or join as staff
export type Session =
  | { state: "loading" }
  | { state: "signedOut" }
  | { state: "owner"; user: User; business: Business }
  | { state: "staff"; user: User; staff: StaffAccount }
  | { state: "new"; user: User }
  | { state: "error"; user: User; message: string };

const STATUSES: BusinessStatus[] = ["draft", "pending", "approved", "suspended", "rejected"];

const SessionContext = createContext<Session>({ state: "loading" });

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session>({ state: "loading" });

  useEffect(() => {
    let stopDocs: (() => void) | undefined;

    const stopAuth = onAuthStateChanged(auth, (user) => {
      stopDocs?.();
      stopDocs = undefined;

      if (!user) {
        setSession({ state: "signedOut" });
        return;
      }

      setSession({ state: "loading" });

      // Both documents are watched so approval, new staff access or a
      // disabled staff account show up without signing in again.
      let business: Business | null | undefined;
      let staff: StaffAccount | null | undefined;

      const resolve = () => {
        if (business) {
          setSession({ state: "owner", user, business });
        } else if (business === null && staff) {
          setSession({ state: "staff", user, staff });
        } else if (business === null && staff === null) {
          setSession({ state: "new", user });
        }
      };

      const fail = (error: unknown) => {
        console.error("Could not load account:", error);
        setSession({ state: "error", user, message: "Could not load your account. Check your connection and try again." });
      };

      const stopBusiness = onSnapshot(
        doc(db, "businesses", user.uid),
        (snapshot) => {
          const data = snapshot.data();
          business = data
            ? {
                id: snapshot.id,
                name: data.name || "Your business",
                type: data.type || "",
                address: data.address || "",
                zipcode: data.zipcode,
                slug: data.slug,
                // Older businesses were created before approval existed.
                status: STATUSES.includes(data.status) ? data.status : "approved",
              }
            : null;
          resolve();
        },
        fail
      );

      const stopStaff = onSnapshot(
        doc(db, "staffUsers", user.uid),
        (snapshot) => {
          staff = snapshot.exists() ? (snapshot.data() as StaffAccount) : null;
          resolve();
        },
        fail
      );

      stopDocs = () => {
        stopBusiness();
        stopStaff();
      };
    });

    return () => {
      stopAuth();
      stopDocs?.();
    };
  }, []);

  return <SessionContext.Provider value={session}>{children}</SessionContext.Provider>;
}

export const useSession = () => useContext(SessionContext);

// For screens only owners use: the owner session, or null while loading or
// for anyone else (the screen then sends them back to "/").
export function useOwner() {
  const session = useSession();
  return session.state === "owner" ? session : null;
}
