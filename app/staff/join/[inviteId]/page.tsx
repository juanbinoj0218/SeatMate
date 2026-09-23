"use client";

import { useEffect, useState } from "react";
import {
  useParams,
  useRouter,
} from "next/navigation";

import BackButton from "@/components/BackButton";
<BackButton fallback="/business" />

import HomeButton from "@/components/HomeButton";
<HomeButton />

import {
  onAuthStateChanged,
  User,
} from "firebase/auth";

import {
  doc,
  getDoc,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";

import { auth, db } from "@/lib/firebase";

type Invite = {
  businessId: string;
  businessName: string;
  active: boolean;
};

export default function JoinStaffPage() {
  const router = useRouter();

  const params =
    useParams<{ inviteId: string }>();

  const inviteId = params.inviteId;

  const [user, setUser] =
    useState<User | null>(null);

  const [invite, setInvite] =
    useState<Invite | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [message, setMessage] =
    useState("");

  useEffect(() => {
    const unsubscribe =
      onAuthStateChanged(
        auth,
        async (currentUser) => {
          setUser(currentUser);

          // User must sign in before Firebase
          // allows them to read the invite.
          if (!currentUser) {
            setLoading(false);
            return;
          }

          try {
            setLoading(true);

            const inviteRef = doc(
              db,
              "staffInvites",
              inviteId
            );

            const inviteSnap =
              await getDoc(inviteRef);

            if (!inviteSnap.exists()) {
              setMessage(
                "This staff invite does not exist."
              );

              setLoading(false);
              return;
            }

            setInvite(
              inviteSnap.data() as Invite
            );

            setLoading(false);
          } catch (error) {
            console.error(error);

            setMessage(
              "Could not load this invitation."
            );

            setLoading(false);
          }
        }
      );

    return unsubscribe;
  }, [inviteId]);

  const signIn = () => {
    router.push(
      `/business/login?next=${encodeURIComponent(
        `/staff/join/${inviteId}`
      )}`
    );
  };

  const acceptInvite = async () => {
  if (!user || !invite) return;

  try {
    setMessage("");

    const inviteRef = doc(
      db,
      "staffInvites",
      inviteId
    );

    const staffRef = doc(
      db,
      "staffUsers",
      user.uid
    );

    await runTransaction(
      db,
      async (transaction) => {
        const inviteSnap =
          await transaction.get(
            inviteRef
          );

        if (!inviteSnap.exists()) {
          throw new Error(
            "Invite does not exist."
          );
        }

        const inviteData =
          inviteSnap.data();

        if (!inviteData.active) {
          throw new Error(
            "Invite already used."
          );
        }

        // Check whether this person
        // is already a staff member.
        const staffSnap =
          await transaction.get(
            staffRef
          );

        if (staffSnap.exists()) {
          const existingStaff =
            staffSnap.data();

          // Already works here
          if (
            existingStaff.businessId ===
              inviteData.businessId &&
            existingStaff.active === true
          ) {
            transaction.update(
              inviteRef,
              {
                active: false,
                claimedBy:
                  user.uid,
                claimedAt:
                  serverTimestamp(),
              }
            );

            return;
          }

          // Do NOT let disabled staff
          // reactivate themselves.
          if (
            existingStaff.businessId ===
              inviteData.businessId &&
            existingStaff.active === false
          ) {
            throw new Error(
              "Your staff access was disabled by the business owner."
            );
          }

          // MVP: one staff account
          // belongs to one business.
          throw new Error(
            "This account already belongs to another business."
          );
        }

        // Brand-new staff member
        transaction.set(
          staffRef,
          {
            businessId:
              inviteData.businessId,

            businessName:
              inviteData.businessName,

            inviteId,

            role: "staff",

            active: true,

            email:
              user.email || "",

            joinedAt:
              serverTimestamp(),
          }
        );

        transaction.update(
          inviteRef,
          {
            active: false,

            claimedBy:
              user.uid,

            claimedAt:
              serverTimestamp(),
          }
        );
      }
    );

    router.push("/staff");

  } catch (error) {
    console.error(error);

    if (
      error instanceof Error
    ) {
      setMessage(
        error.message
      );
    } else {
      setMessage(
        "This invite could not be accepted."
      );
    }
  }
};

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f7f8f5] flex items-center justify-center">
        <p className="text-gray-500">
          Loading invitation...
        </p>
      </main>
    );
  }

  // NOT SIGNED IN

  if (!user) {
    return (
      <main className="min-h-screen bg-[#f7f8f5] flex items-center justify-center p-6">

        <div className="w-full max-w-md bg-white border border-gray-200 rounded-3xl p-8 shadow-sm">

          <div className="w-12 h-12 bg-green-600 rounded-xl text-white font-bold flex items-center justify-center">
            S
          </div>

          <p className="text-green-600 text-sm font-semibold mt-7">
            STAFF INVITATION
          </p>

          <h1 className="text-3xl font-bold mt-2">
            Join SeatMate Staff
          </h1>

          <p className="text-gray-500 mt-3 leading-6">
            Sign in first to accept your
            staff invitation.
          </p>

          <button
            onClick={signIn}
            className="w-full bg-[#101811] hover:bg-black text-white rounded-xl py-3 font-semibold mt-7 transition"
          >
            Sign In to Continue
          </button>

        </div>

      </main>
    );
  }

  // ERROR / INVITE NOT FOUND

  if (!invite) {
    return (
      <main className="min-h-screen bg-[#f7f8f5] flex items-center justify-center p-6">

        <div className="max-w-md bg-white border border-gray-200 rounded-3xl p-8 text-center">

          <h1 className="text-2xl font-bold">
            Invite unavailable
          </h1>

          <p className="text-gray-500 mt-3">
            {message ||
              "This invitation could not be loaded."}
          </p>

        </div>

      </main>
    );
  }

  // SIGNED IN + INVITE FOUND

  return (
    <main className="min-h-screen bg-[#f7f8f5] flex items-center justify-center p-6">

      <div className="w-full max-w-md bg-white border border-gray-200 rounded-3xl p-8 shadow-sm">

        <div className="w-12 h-12 bg-green-600 rounded-xl text-white font-bold flex items-center justify-center">
          S
        </div>

        <p className="text-green-600 font-semibold text-sm mt-7">
          STAFF INVITATION
        </p>

        <h1 className="text-3xl font-bold mt-2">
          Join {invite.businessName}
        </h1>

        <p className="text-gray-500 mt-3 leading-6">
          You&apos;ll be able to update live
          seat availability for this location.
        </p>

        <div className="bg-gray-50 rounded-xl p-4 mt-6">
          <p className="text-xs text-gray-400">
            SIGNED IN AS
          </p>

          <p className="font-semibold mt-1">
            {user.email}
          </p>
        </div>

        {invite.active ? (
          <button
            onClick={acceptInvite}
            className="w-full bg-green-600 hover:bg-green-700 text-white rounded-xl py-3 font-semibold mt-7 transition"
          >
            Accept Staff Invite
          </button>
        ) : (
          <div className="bg-red-50 border border-red-100 text-red-600 p-4 rounded-xl mt-7">
            This invitation has already been used.
          </div>
        )}

        {message && invite.active && (
          <p className="text-red-500 text-sm mt-4">
            {message}
          </p>
        )}

      </div>

    </main>
  );
}