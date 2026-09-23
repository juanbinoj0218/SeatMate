"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  updateProfile,
} from "firebase/auth";

import HomeButton from "@/components/HomeButton";
<HomeButton />

import {
  doc,
  getDoc,
} from "firebase/firestore";

import { auth, db } from "@/lib/firebase";
import BackButton from "@/components/BackButton";

type Mode = "signin" | "signup";

export default function BusinessLoginPage() {
  const router = useRouter();

  const [mode, setMode] =
    useState<Mode>("signin");

  const [firstName, setFirstName] =
    useState("");

  const [lastName, setLastName] =
    useState("");

  const [email, setEmail] =
    useState("");

  const [password, setPassword] =
    useState("");

  const [confirmPassword, setConfirmPassword] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState("");

  const [message, setMessage] =
    useState("");

  // --------------------------------
  // CHECK FOR A SAFE "NEXT" URL
  // --------------------------------

  const getNextDestination = () => {
    const params =
      new URLSearchParams(
        window.location.search
      );

    const next =
      params.get("next");

    if (
      next &&
      next.startsWith("/") &&
      !next.startsWith("//")
    ) {
      return next;
    }

    return null;
  };

  // --------------------------------
  // DETERMINE WHERE USER GOES
  // AFTER LOGIN
  // --------------------------------

  const getPostLoginDestination =
    async (userId: string) => {

      // If they came from something like
      // a staff invite, respect that first.
      const next =
        getNextDestination();

      if (next) {
        return next;
      }

      // Check whether this account is
      // a SeatMate admin.
      //
      // IMPORTANT:
      // If this Firestore check fails,
      // do not block a normal business user
      // from signing into SeatMate.
      try {
        const adminRef = doc(
          db,
          "admins",
          userId
        );

        const adminSnap =
          await getDoc(adminRef);

        if (
          adminSnap.exists() &&
          adminSnap.data().active === true
        ) {
          return "/admin";
        }
      } catch (adminError) {
        console.error(
          "Error checking admin status:",
          adminError
        );
      }

      // Everyone else goes through
      // the normal business flow.
      return "/business";
    };

  // --------------------------------
  // FRIENDLY FIREBASE ERRORS
  // --------------------------------

  const getFriendlyError = (
    firebaseError: unknown
  ) => {
    if (
      typeof firebaseError === "object" &&
      firebaseError !== null &&
      "code" in firebaseError
    ) {
      const code = String(
        firebaseError.code
      );

      console.error(
        "Firebase error code:",
        code
      );

      if (
        code === "auth/invalid-credential" ||
        code === "auth/wrong-password" ||
        code === "auth/user-not-found"
      ) {
        return "Incorrect email or password.";
      }

      if (
        code ===
        "auth/email-already-in-use"
      ) {
        return "An account already exists with this email.";
      }

      if (
        code ===
        "auth/weak-password"
      ) {
        return "Choose a stronger password.";
      }

      if (
        code ===
        "auth/invalid-email"
      ) {
        return "Enter a valid email address.";
      }

      if (
        code ===
        "auth/operation-not-allowed"
      ) {
        return "Email/password sign-in is not enabled for this Firebase project.";
      }

      if (
        code ===
        "auth/configuration-not-found"
      ) {
        return "Firebase Authentication is not configured correctly.";
      }

      if (
        code ===
        "auth/invalid-api-key"
      ) {
        return "SeatMate cannot connect to Firebase because the Firebase API key is missing or invalid.";
      }

      if (
        code ===
        "auth/unauthorized-domain"
      ) {
        return "This website domain is not authorized in Firebase Authentication.";
      }

      if (
        code ===
        "auth/user-disabled"
      ) {
        return "This account has been disabled.";
      }

      if (
        code ===
        "auth/popup-closed-by-user"
      ) {
        return "Google sign-in was cancelled.";
      }

      if (
        code ===
        "auth/popup-blocked"
      ) {
        return "Your browser blocked the Google sign-in popup.";
      }

      if (
        code ===
        "auth/account-exists-with-different-credential"
      ) {
        return "An account already exists with this email using a different sign-in method.";
      }

      if (
        code ===
        "auth/too-many-requests"
      ) {
        return "Too many attempts. Try again later.";
      }

      if (
        code ===
        "auth/network-request-failed"
      ) {
        return "Network error. Check your connection and try again.";
      }

      return `Firebase error: ${code}`;
    }

    if (
      firebaseError instanceof Error
    ) {
      console.error(
        "Firebase error message:",
        firebaseError.message
      );

      return firebaseError.message;
    }

    return "Something went wrong. Please try again.";
  };

  // --------------------------------
  // EMAIL SIGN IN
  // --------------------------------

  const handleSignIn = async (
    event: React.FormEvent
  ) => {
    event.preventDefault();

    setError("");
    setMessage("");

    if (!email.trim()) {
      setError("Enter your email.");
      return;
    }

    if (!password) {
      setError("Enter your password.");
      return;
    }

    try {
      setLoading(true);

      const credential =
        await signInWithEmailAndPassword(
          auth,
          email.trim(),
          password
        );

      const destination =
        await getPostLoginDestination(
          credential.user.uid
        );

      router.push(destination);
    } catch (err) {
      console.error(
        "Sign in error:",
        err
      );

      setError(
        getFriendlyError(err)
      );
    } finally {
      setLoading(false);
    }
  };

  // --------------------------------
  // CREATE ACCOUNT
  // --------------------------------

  const handleCreateAccount = async (
    event: React.FormEvent
  ) => {
    event.preventDefault();

    setError("");
    setMessage("");

    if (!firstName.trim()) {
      setError(
        "Enter your first name."
      );
      return;
    }

    if (!lastName.trim()) {
      setError(
        "Enter your last name."
      );
      return;
    }

    if (!email.trim()) {
      setError(
        "Enter your email."
      );
      return;
    }

    if (password.length < 6) {
      setError(
        "Password must be at least 6 characters."
      );
      return;
    }

    if (
      password !== confirmPassword
    ) {
      setError(
        "Passwords do not match."
      );
      return;
    }

    try {
      setLoading(true);

      const credential =
        await createUserWithEmailAndPassword(
          auth,
          email.trim(),
          password
        );

      await updateProfile(
        credential.user,
        {
          displayName:
            `${firstName.trim()} ${lastName.trim()}`,
        }
      );

      // Staff invite signup?
      const next =
        getNextDestination();

      if (next) {
        router.push(next);
        return;
      }

      // Brand-new business accounts
      // go to /business.
      //
      // /business checks whether
      // a business exists.
      //
      // If not, it should redirect
      // them to /business/setup.
      router.push("/business");

    } catch (err) {
      console.error(
        "Create account error:",
        err
      );

      setError(
        getFriendlyError(err)
      );
    } finally {
      setLoading(false);
    }
  };

  // --------------------------------
  // GOOGLE LOGIN
  // --------------------------------

  const handleGoogleSignIn =
    async () => {
      setError("");
      setMessage("");

      try {
        setLoading(true);

        const provider =
          new GoogleAuthProvider();

        const result =
          await signInWithPopup(
            auth,
            provider
          );

        const destination =
          await getPostLoginDestination(
            result.user.uid
          );

        router.push(destination);
      } catch (err) {
        console.error(
          "Google sign-in error:",
          err
        );

        setError(
          getFriendlyError(err)
        );
      } finally {
        setLoading(false);
      }
    };

  // --------------------------------
  // PASSWORD RESET
  // --------------------------------

  const handleForgotPassword =
    async () => {
      setError("");
      setMessage("");

      if (!email.trim()) {
        setError(
          "Enter your email first, then press Forgot password."
        );
        return;
      }

      try {
        await sendPasswordResetEmail(
          auth,
          email.trim()
        );

        setMessage(
          "Password reset email sent."
        );
      } catch (err) {
        console.error(
          "Password reset error:",
          err
        );

        setError(
          getFriendlyError(err)
        );
      }
    };

  return (
    <main className="min-h-screen bg-[#f7f8f5]">

      {/* HEADER */}

      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">

          <BackButton fallback="/" />

          <div className="flex items-center gap-3">

            <div className="w-10 h-10 bg-green-600 text-white rounded-xl flex items-center justify-center font-bold">
              S
            </div>

            <div>

              <p className="font-bold">
                SeatMate
              </p>

              <p className="text-xs text-gray-400">
                Business Portal
              </p>

            </div>

          </div>

          <div className="w-16" />

        </div>
      </header>

      {/* PAGE */}

      <div className="max-w-6xl mx-auto px-6 py-12">

        <div className="grid lg:grid-cols-2 gap-12 items-center">

          {/* LEFT SIDE */}

          <div>

            <div className="inline-flex items-center gap-2 bg-green-50 border border-green-100 text-green-700 rounded-full px-3 py-1.5 text-sm font-semibold">

              <span className="w-2 h-2 bg-green-500 rounded-full" />

              SeatMate for Business

            </div>

            <h1 className="text-5xl md:text-6xl font-bold tracking-tight mt-6 leading-[1.05]">

              Manage your
              <br />
              space in real time.

            </h1>

            <p className="text-gray-500 text-lg mt-6 max-w-lg leading-8">

              Create your business, build your
              floor plan, manage staff and keep
              customers updated on live seating
              availability.

            </p>

            <div className="mt-10 bg-[#101811] text-white rounded-[28px] p-7 max-w-md">

              <p className="text-green-400 text-sm font-bold">
                BUSINESS PORTAL
              </p>

              <h2 className="text-2xl font-bold mt-3">

                One dashboard.
                Everything live.

              </h2>

              <div className="mt-6 space-y-4 text-white/70">

                <p>
                  ✓ Build your restaurant or
                  café floor plan
                </p>

                <p>
                  ✓ Update live seat occupancy
                </p>

                <p>
                  ✓ Invite staff members
                </p>

                <p>
                  ✓ Manage business hours
                </p>

              </div>

            </div>

          </div>

          {/* AUTH CARD */}

          <div className="bg-white border border-gray-200 rounded-[30px] p-7 md:p-9 shadow-sm">

            {/* MODE SWITCH */}

            <div className="grid grid-cols-2 bg-gray-100 rounded-xl p-1">

              <button
                type="button"
                onClick={() => {
                  setMode("signin");
                  setError("");
                  setMessage("");
                }}
                className={`py-3 rounded-lg font-semibold text-sm transition ${
                  mode === "signin"
                    ? "bg-white shadow-sm text-black"
                    : "text-gray-500"
                }`}
              >
                Sign In
              </button>

              <button
                type="button"
                onClick={() => {
                  setMode("signup");
                  setError("");
                  setMessage("");
                }}
                className={`py-3 rounded-lg font-semibold text-sm transition ${
                  mode === "signup"
                    ? "bg-white shadow-sm text-black"
                    : "text-gray-500"
                }`}
              >
                Create Account
              </button>

            </div>

            <div className="mt-7">

              <h2 className="text-3xl font-bold">

                {mode === "signin"
                  ? "Welcome back."
                  : "Create your account."}

              </h2>

              <p className="text-gray-500 mt-2">

                {mode === "signin"
                  ? "Sign in to manage your SeatMate business."
                  : "Create an account to register and manage your business."}

              </p>

            </div>

            {/* GOOGLE */}

            <button
              type="button"
              onClick={
                handleGoogleSignIn
              }
              disabled={loading}
              className="w-full mt-7 border border-gray-200 hover:bg-gray-50 rounded-xl py-3.5 px-4 font-semibold flex items-center justify-center gap-3 transition disabled:opacity-50"
            >

              {/* GOOGLE LOGO */}

              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >

                <path
                  fill="#4285F4"
                  d="M21.6 12.227c0-.709-.064-1.391-.182-2.045H12v3.868h5.382a4.6 4.6 0 0 1-1.996 3.018v2.509h3.232c1.891-1.741 2.982-4.305 2.982-7.35Z"
                />

                <path
                  fill="#34A853"
                  d="M12 22c2.7 0 4.964-.895 6.618-2.423l-3.232-2.509c-.895.6-2.041.955-3.386.955-2.605 0-4.809-1.759-5.595-4.123H3.064v2.591A9.997 9.997 0 0 0 12 22Z"
                />

                <path
                  fill="#FBBC05"
                  d="M6.405 13.9A6.01 6.01 0 0 1 6.091 12c0-.659.114-1.3.314-1.9V7.509H3.064A10.005 10.005 0 0 0 2 12c0 1.614.386 3.141 1.064 4.491L6.405 13.9Z"
                />

                <path
                  fill="#EA4335"
                  d="M12 5.977c1.468 0 2.786.505 3.823 1.496l2.868-2.868C16.959 2.991 14.695 2 12 2a9.997 9.997 0 0 0-8.936 5.509L6.405 10.1C7.191 7.736 9.395 5.977 12 5.977Z"
                />

              </svg>

              Continue with Google

            </button>

            <div className="flex items-center gap-4 my-6">

              <div className="h-px bg-gray-200 flex-1" />

              <span className="text-xs text-gray-400 font-semibold">
                OR
              </span>

              <div className="h-px bg-gray-200 flex-1" />

            </div>

            {/* FORM */}

            <form
              onSubmit={
                mode === "signin"
                  ? handleSignIn
                  : handleCreateAccount
              }
            >

              {/* SIGNUP NAMES */}

              {mode === "signup" && (

                <div className="grid sm:grid-cols-2 gap-4 mb-4">

                  <div>

                    <label className="block text-sm font-semibold mb-2">
                      First name
                    </label>

                    <input
                      type="text"
                      value={firstName}
                      onChange={(e) =>
                        setFirstName(
                          e.target.value
                        )
                      }
                      placeholder="John"
                      autoComplete="given-name"
                      className="w-full border border-gray-200 rounded-xl px-4 py-3"
                    />

                  </div>

                  <div>

                    <label className="block text-sm font-semibold mb-2">
                      Last name
                    </label>

                    <input
                      type="text"
                      value={lastName}
                      onChange={(e) =>
                        setLastName(
                          e.target.value
                        )
                      }
                      placeholder="Smith"
                      autoComplete="family-name"
                      className="w-full border border-gray-200 rounded-xl px-4 py-3"
                    />

                  </div>

                </div>

              )}

              {/* EMAIL */}

              <div>

                <label className="block text-sm font-semibold mb-2">
                  Email
                </label>

                <input
                  type="email"
                  value={email}
                  onChange={(e) =>
                    setEmail(
                      e.target.value
                    )
                  }
                  placeholder="you@example.com"
                  autoComplete="email"
                  className="w-full border border-gray-200 rounded-xl px-4 py-3"
                />

              </div>

              {/* PASSWORD */}

              <div className="mt-4">

                <div className="flex items-center justify-between mb-2">

                  <label className="block text-sm font-semibold">
                    Password
                  </label>

                  {mode === "signin" && (

                    <button
                      type="button"
                      onClick={
                        handleForgotPassword
                      }
                      className="text-sm text-green-700 font-semibold hover:underline"
                    >
                      Forgot password?
                    </button>

                  )}

                </div>

                <input
                  type="password"
                  value={password}
                  onChange={(e) =>
                    setPassword(
                      e.target.value
                    )
                  }
                  placeholder="••••••••"
                  autoComplete={
                    mode === "signin"
                      ? "current-password"
                      : "new-password"
                  }
                  className="w-full border border-gray-200 rounded-xl px-4 py-3"
                />

              </div>

              {/* CONFIRM PASSWORD */}

              {mode === "signup" && (

                <div className="mt-4">

                  <label className="block text-sm font-semibold mb-2">
                    Confirm password
                  </label>

                  <input
                    type="password"
                    value={
                      confirmPassword
                    }
                    onChange={(e) =>
                      setConfirmPassword(
                        e.target.value
                      )
                    }
                    placeholder="••••••••"
                    autoComplete="new-password"
                    className="w-full border border-gray-200 rounded-xl px-4 py-3"
                  />

                </div>

              )}

              {/* ERRORS */}

              {error && (

                <div className="mt-5 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
                  {error}
                </div>

              )}

              {message && (

                <div className="mt-5 bg-green-50 border border-green-200 text-green-700 rounded-xl px-4 py-3 text-sm">
                  {message}
                </div>

              )}

              {/* SUBMIT */}

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-6 bg-[#101811] hover:bg-black text-white font-bold py-3.5 rounded-xl transition disabled:opacity-50"
              >

                {loading
                  ? "Please wait..."
                  : mode === "signin"
                    ? "Sign In →"
                    : "Create Account →"}

              </button>

            </form>

            {mode === "signup" && (

              <p className="text-xs text-gray-400 mt-5 text-center leading-5">

                After creating your account,
                you&apos;ll add your business
                details and build your live
                floor plan.

              </p>

            )}

          </div>

        </div>

      </div>

    </main>
  );
}