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

import { auth } from "@/lib/firebase";
import BackButton from "@/components/BackButton";
<BackButton fallback="/business" />

type AuthMode =
  | "signin"
  | "signup";

export default function BusinessLoginPage() {
  const router = useRouter();

  const [mode, setMode] =
    useState<AuthMode>("signin");

  const [firstName, setFirstName] =
    useState("");

  const [lastName, setLastName] =
    useState("");

  const [email, setEmail] =
    useState("");

  const [password, setPassword] =
    useState("");

  const [
    confirmPassword,
    setConfirmPassword,
  ] = useState("");

  const [message, setMessage] =
    useState("");

  const [success, setSuccess] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  const getDestination = () => {
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

    return "/business";
  };

  const getFriendlyError = (
    error: unknown
  ) => {
    const code =
      (
        error as {
          code?: string;
        }
      )?.code;

    switch (code) {
      case "auth/invalid-email":
        return "Enter a valid email address.";

      case "auth/invalid-credential":
        return "The email or password is incorrect.";

      case "auth/email-already-in-use":
        return "An account with this email already exists.";

      case "auth/weak-password":
        return "Choose a stronger password.";

      case "auth/popup-closed-by-user":
        return "Google sign-in was canceled.";

      case "auth/too-many-requests":
        return "Too many attempts. Try again in a little while.";

      default:
        return "Something went wrong. Please try again.";
    }
  };

  const clearMessages = () => {
    setMessage("");
    setSuccess("");
  };

  const switchMode = (
    nextMode: AuthMode
  ) => {
    setMode(nextMode);

    clearMessages();

    setPassword("");
    setConfirmPassword("");
  };

  const handleGoogle = async () => {
    try {
      setLoading(true);
      clearMessages();

      const provider =
        new GoogleAuthProvider();

      await signInWithPopup(
        auth,
        provider
      );

      router.push(
        getDestination()
      );
    } catch (error) {
      console.error(error);

      setMessage(
        getFriendlyError(error)
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSignIn = async (
    event: React.FormEvent
  ) => {
    event.preventDefault();

    clearMessages();

    if (!email.trim()) {
      setMessage(
        "Enter your email address."
      );

      return;
    }

    if (!password) {
      setMessage(
        "Enter your password."
      );

      return;
    }

    try {
      setLoading(true);

      await signInWithEmailAndPassword(
        auth,
        email.trim(),
        password
      );

      router.push(
        getDestination()
      );
    } catch (error) {
      console.error(error);

      setMessage(
        getFriendlyError(error)
      );
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAccount =
    async (
      event: React.FormEvent
    ) => {
      event.preventDefault();

      clearMessages();

      if (!firstName.trim()) {
        setMessage(
          "Enter your first name."
        );

        return;
      }

      if (!lastName.trim()) {
        setMessage(
          "Enter your last name."
        );

        return;
      }

      if (!email.trim()) {
        setMessage(
          "Enter your email address."
        );

        return;
      }

      if (password.length < 6) {
        setMessage(
          "Password must be at least 6 characters."
        );

        return;
      }

      if (
        password !==
        confirmPassword
      ) {
        setMessage(
          "Your passwords do not match."
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

        router.push(
          getDestination()
        );
      } catch (error) {
        console.error(error);

        setMessage(
          getFriendlyError(error)
        );
      } finally {
        setLoading(false);
      }
    };

  const handleForgotPassword =
    async () => {
      clearMessages();

      if (!email.trim()) {
        setMessage(
          "Enter your email first, then press Forgot password."
        );

        return;
      }

      try {
        setLoading(true);

        await sendPasswordResetEmail(
          auth,
          email.trim()
        );

        setSuccess(
          "Password reset email sent."
        );
      } catch (error) {
        console.error(error);

        setMessage(
          getFriendlyError(error)
        );
      } finally {
        setLoading(false);
      }
    };

  return (
    <main className="min-h-screen bg-[#f7f8f5]">

      {/* HEADER */}

      <header className="max-w-7xl mx-auto px-6 py-6 flex items-center justify-between">

        <button
          type="button"
          onClick={() =>
            router.push("/")
          }
          className="flex items-center gap-3"
        >
          <div className="w-10 h-10 bg-green-600 rounded-xl text-white flex items-center justify-center font-bold">
            S
          </div>

          <span className="font-bold text-xl text-[#101811]">
            SeatMate
          </span>
        </button>

        <BackButton fallback="/" />

      </header>

      <div className="max-w-7xl mx-auto px-6 py-8 md:py-16 grid lg:grid-cols-[1fr_480px] gap-16 items-center">

        {/* LEFT SIDE */}

        <div className="hidden lg:block">

          <div className="inline-flex items-center gap-2 border border-green-100 bg-green-50 text-green-700 rounded-full px-4 py-2 text-sm font-semibold">

            <span className="w-2 h-2 rounded-full bg-green-500" />

            SeatMate for Business

          </div>

          <h1 className="text-6xl font-bold tracking-[-0.05em] text-[#101811] leading-[1.02] mt-7">
            Seating,
            <br />
            without the
            <br />
            guesswork.
          </h1>

          <p className="text-lg text-gray-500 leading-8 max-w-lg mt-7">
            Manage your floor plan,
            give staff secure access,
            and keep customers updated
            with live seating
            availability.
          </p>

          <div className="grid grid-cols-3 gap-4 max-w-lg mt-10">

            <div className="bg-white border border-[#e3e7e2] rounded-2xl p-4">
              <p className="text-2xl">
                ◉
              </p>

              <p className="font-semibold mt-2">
                Live
              </p>

              <p className="text-xs text-gray-400 mt-1">
                Real-time seating
              </p>
            </div>

            <div className="bg-white border border-[#e3e7e2] rounded-2xl p-4">
              <p className="text-2xl">
                ◫
              </p>

              <p className="font-semibold mt-2">
                Simple
              </p>

              <p className="text-xs text-gray-400 mt-1">
                One-tap updates
              </p>
            </div>

            <div className="bg-white border border-[#e3e7e2] rounded-2xl p-4">
              <p className="text-2xl">
                ✓
              </p>

              <p className="font-semibold mt-2">
                Reliable
              </p>

              <p className="text-xs text-gray-400 mt-1">
                Staff verified
              </p>
            </div>

          </div>

        </div>

        {/* AUTH CARD */}

        <div className="w-full">

          <div className="bg-white border border-[#e3e7e2] rounded-[30px] p-7 md:p-9 shadow-[0_20px_60px_rgba(16,24,17,0.07)]">

            {/* MODE TOGGLE */}

            <div className="bg-[#f4f6f2] rounded-xl p-1 grid grid-cols-2">

              <button
                type="button"
                onClick={() =>
                  switchMode(
                    "signin"
                  )
                }
                className={`h-11 rounded-lg text-sm font-semibold transition ${
                  mode === "signin"
                    ? "bg-white text-[#101811] shadow-sm"
                    : "text-gray-500 hover:text-[#101811]"
                }`}
              >
                Sign In
              </button>

              <button
                type="button"
                onClick={() =>
                  switchMode(
                    "signup"
                  )
                }
                className={`h-11 rounded-lg text-sm font-semibold transition ${
                  mode === "signup"
                    ? "bg-white text-[#101811] shadow-sm"
                    : "text-gray-500 hover:text-[#101811]"
                }`}
              >
                Create Account
              </button>

            </div>

            <div className="mt-8">

              <p className="text-xs text-green-600 font-bold tracking-[0.16em]">
                {mode === "signin"
                  ? "WELCOME BACK"
                  : "GET STARTED"}
              </p>

              <h2 className="text-3xl font-bold tracking-tight text-[#101811] mt-2">
                {mode === "signin"
                  ? "Sign in to SeatMate"
                  : "Create your account"}
              </h2>

              <p className="text-gray-500 mt-2 leading-6">
                {mode === "signin"
                  ? "Manage your business or continue to your staff account."
                  : "Create an account to manage a business or join a SeatMate team."}
              </p>

            </div>

            {/* GOOGLE */}

            <button
              type="button"
              onClick={handleGoogle}
              disabled={loading}
              className="w-full h-12 mt-7 border border-[#dde2dc] hover:bg-gray-50 rounded-xl flex items-center justify-center gap-3 font-semibold text-[#101811] disabled:opacity-50"
            >

              <img
                src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
                alt=""
                className="w-5 h-5"
              />

              Continue with Google

            </button>

            {/* DIVIDER */}

            <div className="flex items-center gap-4 my-6">

              <div className="h-px bg-gray-200 flex-1" />

              <span className="text-xs font-semibold text-gray-400">
                OR
              </span>

              <div className="h-px bg-gray-200 flex-1" />

            </div>

            <form
              onSubmit={
                mode === "signin"
                  ? handleSignIn
                  : handleCreateAccount
              }
            >

              {/* SIGNUP NAME FIELDS */}

              {mode === "signup" && (
                <div className="grid sm:grid-cols-2 gap-4 mb-5">

                  <div>
                    <label className="block text-sm font-semibold text-[#344038] mb-2">
                      First name
                    </label>

                    <input
                      type="text"
                      autoComplete="given-name"
                      value={firstName}
                      onChange={(
                        event
                      ) =>
                        setFirstName(
                          event.target
                            .value
                        )
                      }
                      placeholder="Juan"
                      className="w-full"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-[#344038] mb-2">
                      Last name
                    </label>

                    <input
                      type="text"
                      autoComplete="family-name"
                      value={lastName}
                      onChange={(
                        event
                      ) =>
                        setLastName(
                          event.target
                            .value
                        )
                      }
                      placeholder="Smith"
                      className="w-full"
                    />
                  </div>

                </div>
              )}

              {/* EMAIL */}

              <div className="mb-5">

                <label className="block text-sm font-semibold text-[#344038] mb-2">
                  Email
                </label>

                <input
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(
                    event
                  ) =>
                    setEmail(
                      event.target.value
                    )
                  }
                  placeholder="you@example.com"
                  className="w-full"
                />

              </div>

              {/* PASSWORD */}

              <div>

                <div className="flex items-center justify-between mb-2">

                  <label className="text-sm font-semibold text-[#344038]">
                    Password
                  </label>

                  {mode ===
                    "signin" && (
                    <button
                      type="button"
                      onClick={
                        handleForgotPassword
                      }
                      className="text-xs font-semibold text-green-700 hover:text-green-800"
                    >
                      Forgot password?
                    </button>
                  )}

                </div>

                <input
                  type="password"
                  autoComplete={
                    mode ===
                    "signin"
                      ? "current-password"
                      : "new-password"
                  }
                  value={password}
                  onChange={(
                    event
                  ) =>
                    setPassword(
                      event.target.value
                    )
                  }
                  placeholder={
                    mode ===
                    "signin"
                      ? "Enter your password"
                      : "At least 6 characters"
                  }
                  className="w-full"
                />

              </div>

              {/* CONFIRM PASSWORD */}

              {mode === "signup" && (
                <div className="mt-5">

                  <label className="block text-sm font-semibold text-[#344038] mb-2">
                    Confirm password
                  </label>

                  <input
                    type="password"
                    autoComplete="new-password"
                    value={
                      confirmPassword
                    }
                    onChange={(
                      event
                    ) =>
                      setConfirmPassword(
                        event.target
                          .value
                      )
                    }
                    placeholder="Enter password again"
                    className="w-full"
                  />

                </div>
              )}

              {/* ERRORS */}

              {message && (
                <div className="bg-red-50 border border-red-100 text-red-700 rounded-xl p-4 text-sm mt-5">
                  {message}
                </div>
              )}

              {success && (
                <div className="bg-green-50 border border-green-100 text-green-700 rounded-xl p-4 text-sm mt-5">
                  {success}
                </div>
              )}

              {/* SUBMIT */}

              <button
                type="submit"
                disabled={loading}
                className="w-full h-12 bg-[#101811] hover:bg-black text-white rounded-xl font-semibold mt-6 disabled:opacity-50"
              >
                {loading
                  ? "Please wait..."
                  : mode ===
                      "signin"
                    ? "Sign In"
                    : "Create Account"}
              </button>

            </form>

            {/* BOTTOM SWITCH */}

            <p className="text-sm text-gray-500 text-center mt-7">

              {mode === "signin"
                ? "New to SeatMate?"
                : "Already have an account?"}

              <button
                type="button"
                onClick={() =>
                  switchMode(
                    mode ===
                      "signin"
                      ? "signup"
                      : "signin"
                  )
                }
                className="font-semibold text-green-700 ml-1 hover:text-green-800"
              >
                {mode === "signin"
                  ? "Create an account"
                  : "Sign in"}
              </button>

            </p>

            {mode === "signup" && (
              <p className="text-[11px] text-gray-400 text-center leading-5 mt-4">
                By creating an account,
                you agree to use SeatMate
                responsibly and keep
                business information
                accurate.
              </p>
            )}

          </div>

        </div>

      </div>

    </main>
  );
}