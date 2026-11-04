// src/pages/VerifyEmailPage.tsx

import { useCallback, useEffect, useRef, useState } from "react";
import { httpsCallable } from "firebase/functions";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import BrandLogo from "../components/BrandLogo";
import { functions } from "../lib/firebase";

const completeReferralSetup = httpsCallable<
  Record<string, never>,
  { code: string }
>(functions, "completeReferralSetup");

export default function VerifyEmailPage() {
  const navigate = useNavigate();

  const {
    user,
    loading,
    refreshUser,
    resendVerification,
    logout,
  } = useAuth();

  const [resending, setResending] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const checkingRef = useRef(false);
  const completedRef = useRef(false);

  const checkVerification = useCallback(async () => {
    if (!user || checkingRef.current || completedRef.current) {
      return;
    }

    checkingRef.current = true;
    setCheckingStatus(true);
    setError("");
    setMessage("");

    try {
      const verified = await refreshUser();

      if (!verified) {
        setMessage(
          "Your email is not verified yet. Open the verification link in your inbox.",
        );
        return;
      }

      // Finalize referral setup through the existing backend function.
      // The backend is responsible for validating the authenticated user
      // and handling referral attribution idempotently.
      await completeReferralSetup({});

      completedRef.current = true;
      navigate("/dashboard", { replace: true });
    } catch (err) {
      console.error("Email verification or referral setup failed:", err);

      setError(
        "We could not finish setting up your account. Please try checking again.",
      );
    } finally {
      checkingRef.current = false;
      setCheckingStatus(false);
    }
  }, [user, refreshUser, navigate]);

  useEffect(() => {
    if (loading) {
      return;
    }

    if (!user) {
      navigate("/login", { replace: true });
      return;
    }

    // Check immediately when the page loads, including when Firebase
    // already reports that the email has been verified.
    const initialTimer = window.setTimeout(() => {
      void checkVerification();
    }, 0);

    // Continue checking while the email is unverified.
    const interval = window.setInterval(() => {
      void checkVerification();
    }, 3000);

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        void checkVerification();
      }
    }

    function handleFocus() {
      void checkVerification();
    }

    document.addEventListener(
      "visibilitychange",
      handleVisibilityChange,
    );
    window.addEventListener("focus", handleFocus);

    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(interval);

      document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange,
      );
      window.removeEventListener("focus", handleFocus);
    };
  }, [user, loading, navigate, checkVerification]);

  async function handleResend() {
    if (resending) {
      return;
    }

    setResending(true);
    setError("");
    setMessage("");

    try {
      await resendVerification();

      setMessage(
        "A new verification email has been sent. Check your inbox and spam folder.",
      );
    } catch (err) {
      console.error("Resending verification email failed:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Could not send the verification email. Please try again.",
      );
    } finally {
      setResending(false);
    }
  }

  async function handleSignOut() {
    try {
      await logout();
      navigate("/login", { replace: true });
    } catch (err) {
      console.error("Sign-out failed:", err);
      setError("Could not sign out. Please try again.");
    }
  }

  if (loading || !user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f5f8fc] px-4">
        <p className="text-sm text-slate-600">
          Loading your account…
        </p>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col bg-[#f5f8fc]">
      {/* Compact branded header */}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-2.5 sm:px-6">
          <BrandLogo to="/" showTagline={false} />

          <button
            type="button"
            onClick={() => void handleSignOut()}
            className="inline-flex min-h-9 items-center justify-center rounded-lg px-3 py-2 text-sm font-semibold text-[#185abc] transition hover:bg-blue-50"
          >
            Sign out
          </button>
        </div>
      </header>

      {/* Verification content */}
      <div className="flex flex-1 items-center justify-center px-4 py-5 sm:py-7">
        <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          {/* Email icon */}
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-[#185abc]">
            <svg
              className="h-6 w-6"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <rect x="3" y="5" width="18" height="14" rx="2" />
              <path d="m3 7 9 6 9-6" />
            </svg>
          </div>

          <p className="mt-3 text-center text-[11px] font-bold uppercase tracking-[0.14em] text-[#185abc]">
            One last step
          </p>

          <h1 className="mt-1.5 text-center text-2xl font-extrabold tracking-tight text-[#142d50]">
            Verify your email
          </h1>

          <p className="mt-2.5 text-center text-sm leading-6 text-slate-600">
            We sent a verification link to{" "}
            <span className="break-words font-semibold text-[#183657]">
              {user.email}
            </span>
            . Open that email and follow the link to continue.
          </p>

          <div className="mt-4 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2.5">
            <p className="text-sm leading-5 text-blue-900">
              Keep this page open. We will check your verification status
              automatically.
            </p>
          </div>

          {/* Verification progress */}
          {checkingStatus && (
            <p
              role="status"
              className="mt-3 flex items-center justify-center gap-2 text-sm text-slate-500"
            >
              <span
                className="h-4 w-4 animate-spin rounded-full border-2 border-blue-200 border-t-blue-600"
                aria-hidden="true"
              />
              Checking your verification status…
            </p>
          )}

          {/* Error message */}
          {error && (
            <p
              role="alert"
              className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm leading-5 text-red-800"
            >
              {error}
            </p>
          )}

          {/* Success or information message */}
          {message && (
            <p
              role="status"
              className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm leading-5 text-slate-700"
            >
              {message}
            </p>
          )}

          {/* Manual verification check */}
          <button
            type="button"
            onClick={() => void checkVerification()}
            disabled={checkingStatus}
            className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-[#185abc] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#124a9e] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {checkingStatus
              ? "Checking…"
              : "I have verified my email"}
          </button>

          {/* Resend verification email */}
          <button
            type="button"
            onClick={() => void handleResend()}
            disabled={resending}
            className="mt-2.5 inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-[#183657] transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {resending ? "Sending…" : "Resend verification email"}
          </button>

          <p className="mt-4 border-t border-slate-100 pt-3 text-center text-xs leading-5 text-slate-500">
            If the email is missing, check your spam or junk folder. Make
            sure you open the link for the same email address shown above.
          </p>

          <div className="mt-3 text-center">
            <Link
              to="/"
              className="text-sm font-semibold text-[#185abc] hover:underline"
            >
              Return to home
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}