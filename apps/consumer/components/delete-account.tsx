"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  deleteUser,
  EmailAuthProvider,
  GoogleAuthProvider,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  type User,
} from "firebase/auth";
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  where,
  writeBatch,
} from "firebase/firestore";

import { db } from "@seatmate/shared/firebase";
import { SEAT_ALERTS } from "@seatmate/shared/seat-alerts";

import { useAccount } from "@/components/account-provider";

// "Delete account" on the account page. Confirms who you are again (your
// password, or Google), then removes saved places, seat alerts, your
// profile and finally the sign-in account itself.

const usesPassword = (user: User) =>
  user.providerData.some((provider) => provider.providerId === "password");

async function deleteCustomerData(uid: string) {
  const favorites = await getDocs(collection(db, "users", uid, "favorites"));
  const alerts = await getDocs(query(collection(db, SEAT_ALERTS), where("uid", "==", uid)));

  // Batches hold up to 500 writes.
  const refs = [...favorites.docs, ...alerts.docs].map((item) => item.ref);
  for (let start = 0; start < refs.length; start += 450) {
    const batch = writeBatch(db);
    refs.slice(start, start + 450).forEach((ref) => batch.delete(ref));
    await batch.commit();
  }

  await deleteDoc(doc(db, "users", uid));
}

const describe = (error: unknown) => {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String((error as { code: unknown }).code)
      : "";

  switch (code) {
    case "auth/wrong-password":
    case "auth/invalid-credential":
      return "That password isn't right.";
    case "auth/popup-closed-by-user":
    case "auth/cancelled-popup-request":
      return "Google confirmation was cancelled.";
    case "auth/user-mismatch":
      return "Confirm with the same Google account you're signed in with.";
    case "auth/too-many-requests":
      return "Too many attempts. Wait a moment and try again.";
    case "auth/network-request-failed":
      return "Network error. Check your connection and try again.";
    default:
      return "We couldn't delete your account. Please try again, or contact us.";
  }
};

export default function DeleteAccount({
  user,
  onDeleting,
}: {
  user: User;
  onDeleting: (deleting: boolean) => void;
}) {
  const router = useRouter();
  const { pauseSync } = useAccount();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const needsPassword = usesPassword(user);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const close = () => {
    if (busy) return;
    setOpen(false);
    setConfirmText("");
    setPassword("");
    setError("");
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");

    if (confirmText.trim().toUpperCase() !== "DELETE") {
      setError("Type DELETE to confirm.");
      return;
    }

    if (needsPassword && !password) {
      setError("Enter your password.");
      return;
    }

    setBusy(true);

    try {
      // Firebase only deletes accounts that signed in recently, so confirm
      // first; nothing is removed if this step fails.
      if (needsPassword) {
        await reauthenticateWithCredential(
          user,
          EmailAuthProvider.credential(user.email || "", password)
        );
      } else {
        await reauthenticateWithPopup(user, new GoogleAuthProvider());
      }

      onDeleting(true);
      pauseSync();
      await deleteCustomerData(user.uid);
      await deleteUser(user);

      router.replace("/?account=deleted");
    } catch (caught) {
      console.error("Could not delete account:", caught);
      onDeleting(false);
      setError(describe(caught));
      setBusy(false);
    }
  };

  return (
    <>
      <div className="mt-6 rounded-3xl border border-line bg-white p-6 sm:p-7">
        <h2 className="text-lg font-semibold">Delete account</h2>
        <p className="mt-1.5 text-sm text-gray-600">
          Permanently remove your account, saved places, history and seat alerts.
        </p>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-4 h-11 w-full rounded-xl border border-red-200 font-semibold text-red-600 transition hover:bg-red-50"
        >
          Delete account…
        </button>
      </div>

      <dialog
        ref={dialogRef}
        onClose={close}
        onCancel={(event) => {
          if (busy) event.preventDefault();
        }}
        aria-labelledby="delete-account-title"
        className="m-auto w-[calc(100%-2rem)] max-w-md rounded-3xl p-0 text-ink backdrop:bg-black/40"
      >
        <form onSubmit={submit} className="space-y-5 p-7">
          <div>
            <h2 id="delete-account-title" className="font-display text-3xl">
              Delete your account?
            </h2>
            <p className="mt-2 text-gray-600">
              This permanently deletes <strong>{user.email}</strong>, your saved places, recently
              viewed places, home ZIP and any seat alerts. It can&apos;t be undone.
            </p>
          </div>

          <div>
            <label htmlFor="delete-confirm" className="mb-1.5 block text-sm font-medium">
              Type <span className="font-mono font-semibold">DELETE</span> to confirm
            </label>
            <input
              id="delete-confirm"
              type="text"
              value={confirmText}
              onChange={(event) => setConfirmText(event.target.value)}
              autoComplete="off"
              className="w-full"
            />
          </div>

          {needsPassword ? (
            <div>
              <label htmlFor="delete-password" className="mb-1.5 block text-sm font-medium">
                Your password
              </label>
              <input
                id="delete-password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                className="w-full"
              />
            </div>
          ) : (
            <p className="rounded-xl bg-paper px-4 py-3 text-sm text-gray-600">
              You&apos;ll confirm with Google in a pop-up window.
            </p>
          )}

          {error && (
            <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </p>
          )}

          <div className="flex flex-col-reverse gap-3 sm:flex-row">
            <button
              type="button"
              onClick={close}
              disabled={busy}
              className="h-12 flex-1 rounded-xl border border-line font-semibold transition hover:border-gray-300 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy}
              className="h-12 flex-1 rounded-xl bg-red-600 font-semibold text-white transition hover:bg-red-700 disabled:opacity-60"
            >
              {busy ? "Deleting…" : "Delete forever"}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
