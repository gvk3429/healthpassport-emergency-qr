
import { useCallback, useEffect, useRef, useState } from "react";
import { httpsCallable } from "firebase/functions";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
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
    if (!user || checkingRef.current || completedRef.current) return;

    checkingRef.current = true;
    setCheckingStatus(true);
    setError("");

    try {
      const verified = await refreshUser();

      if (!verified) {
        setMessage("Your email is not verified yet. Check your inbox.");
        return;
      }

      // The backend verifies the Firebase ID token and account email.
      // It creates the user's referral code and finalizes any pending
      // referral attribution idempotently.
      await completeReferralSetup({});

      completedRef.current = true;
      navigate("/dashboard", { replace: true });
    } catch (err) {
      console.error(
        "Email verification or referral setup failed:",
        err
      );

      setError(
        "We could not finish setting up your account. Please try checking again."
      );
    } finally {
      checkingRef.current = false;
      setCheckingStatus(false);
    }
  }, [user, refreshUser, navigate]);

  useEffect(() => {
    if (loading) return;

    if (!user) {
      navigate("/login", { replace: true });
      return;
    }

    if (user.emailVerified) {
  const timer = window.setTimeout(() => {
    void checkVerification();
  }, 0);

  return () => {
    window.clearTimeout(timer);
  };
}

    const initialTimer = window.setTimeout(() => {
  void checkVerification();
}, 0);

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
      handleVisibilityChange
    );
    window.addEventListener("focus", handleFocus);

    return () => {
  window.clearTimeout(initialTimer);
  window.clearInterval(interval);

  document.removeEventListener(
    "visibilitychange",
    handleVisibilityChange
  );

  window.removeEventListener("focus", handleFocus);
};
  }, [user, loading, navigate, checkVerification]);

  async function handleResend() {
    if (resending) return;

    setResending(true);
    setError("");
    setMessage("");

    try {
      await resendVerification();
      setMessage(
        "A new verification email has been sent. Check your inbox and spam folder."
      );
    } catch (err) {
      console.error("Resending verification email failed:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Could not send the verification email. Please try again."
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
      <main className="flex min-h-screen items-center justify-center bg-[#f7f9fd] px-4">
        <p className="text-sm text-slate-600">
          Loading your account…
        </p>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col bg-[#f7f9fd]">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link to="/" className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#143d75] text-lg font-extrabold text-white">
              H
            </span>
            <span>
              <span className="block text-sm font-extrabold tracking-tight text-[#142d50]">
                HealthPassport
              </span>
              <span className="block text-[11px] text-slate-500">
                Emergency QR
              </span>
            </span>
          </Link>

          <button
            type="button"
            onClick={handleSignOut}
            className="rounded-md px-3 py-2 text-sm font-semibold text-[#185abc] hover:bg-blue-50"
          >
            Sign out
          </button>
        </div>
      </header>

      <div className="flex flex-1 items-center justify-center px-4 py-8">
        <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-blue-50 text-2xl text-[#185abc]">
            ✉
          </div>

          <p className="mt-5 text-center text-[11px] font-bold uppercase tracking-[0.14em] text-[#185abc]">
            One last step
          </p>

          <h1 className="mt-2 text-center text-2xl font-extrabold tracking-tight text-[#142d50]">
            Verify your email
          </h1>

          <p className="mt-3 text-center text-sm leading-6 text-slate-600">
            We sent a verification link to{" "}
            <span className="font-semibold text-[#183657]">
              {user.email}
            </span>
            . Open that email and follow the link to continue.
          </p>

          <p className="mt-4 rounded-lg border border-blue-100 bg-blue-50 px-3 py-3 text-sm leading-5 text-blue-900">
            Keep this page open. We will check your verification status
            automatically.
          </p>

          {checkingStatus && (
            <p
              role="status"
              className="mt-4 text-center text-sm text-slate-500"
            >
              Checking your verification status…
            </p>
          )}

          {error && (
            <p
              role="alert"
              className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-800"
            >
              {error}
            </p>
          )}

          {message && (
            <p
              role="status"
              className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700"
            >
              {message}
            </p>
          )}

          <button
            type="button"
            onClick={() => void checkVerification()}
            disabled={checkingStatus}
            className="mt-5 inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-[#185abc] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#124a9e] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {checkingStatus ? "Checking…" : "I have verified my email"}
          </button>

          <button
            type="button"
            onClick={() => void handleResend()}
            disabled={resending}
            className="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-[#183657] hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {resending ? "Sending…" : "Resend verification email"}
          </button>

          <p className="mt-5 text-center text-xs leading-5 text-slate-500">
            If the email is missing, check your spam or junk folder.
            Make sure you open the link for the same email address shown above.
          </p>
        </section>
      </div>
    </main>
  );
}
