"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, type User } from "firebase/auth";

import TwoFactorSetup from "@seatmate/shared/components/TwoFactorSetup";
import { auth } from "@seatmate/shared/firebase";

import PortalHeader from "@/components/portal-header";

// Sign-in security for owners and staff: two-factor sign-in.
export default function SecurityPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);

  useEffect(
    () =>
      onAuthStateChanged(auth, (currentUser) => {
        if (!currentUser) {
          router.replace("/business/login");
          return;
        }
        setUser(currentUser);
      }),
    [router]
  );

  return (
    <main className="min-h-screen bg-[#f7f8f5]">
      <PortalHeader section="Security" />

      <div className="mx-auto max-w-4xl px-6 py-12">
        <p className="text-sm font-semibold text-green-700">Account security</p>
        <h1 className="mt-2 text-4xl font-bold">Security</h1>
        <p className="mt-3 max-w-xl text-gray-500">
          Protect your business account so only you can change your floor plan, staff and
          customer page — even if someone learns your password.
        </p>

        <div className="mt-8">
          {user ? (
            <TwoFactorSetup user={user} />
          ) : (
            <p className="text-gray-500">Loading…</p>
          )}
        </div>

        {user && (
          <p className="mt-6 text-sm text-gray-500">
            Signed in as <span className="font-semibold text-[#101811]">{user.email}</span>.
            Forgot your password? Sign out and choose “Forgot password?” on the sign-in page.
          </p>
        )}
      </div>
    </main>
  );
}
