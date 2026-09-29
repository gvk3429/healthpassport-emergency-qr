
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  Link,
  useNavigate,
} from "react-router-dom";

import { useAuth } from "../auth/AuthContext";

export default function VerifyEmailPage() {
  const navigate = useNavigate();

  const {
    user,
    loading,
    refreshUser,
    resendVerification,
    logout,
  } = useAuth();

  const checking = false;

  const [resending, setResending] =
    useState(false);

  const [message, setMessage] =
    useState("");

  const [error, setError] =
    useState("");

  const checkingRef = useRef(false);
  const completedRef = useRef(false);

  const checkVerification =
    useCallback(async () => {
      if (
        !user ||
        checkingRef.current ||
        completedRef.current
      ) {
        return;
      }

      checkingRef.current = true;

      try {
        const verified = await refreshUser();

        if (verified) {
          completedRef.current = true;

          navigate("/dashboard", {
            replace: true,
          });
        }
      } catch (err) {
        console.error(
          "Verification status check failed:",
          err
        );
      } finally {
        checkingRef.current = false;
      }
    }, [user, refreshUser, navigate]);

  useEffect(() => {
    if (loading) return;

    if (!user) {
      navigate("/login", {
        replace: true,
      });
      return;
    }

    if (user.emailVerified) {
      navigate("/dashboard", {
        replace: true,
      });
      return;
    }

    // Check immediately on opening the page.
    void checkVerification();

    // Check automatically every three seconds.
    const interval = window.setInterval(() => {
      void checkVerification();
    }, 3000);

    // Check when the user returns from their email.
    function handleVisibilityChange() {
      if (
        document.visibilityState === "visible"
      ) {
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

    window.addEventListener(
      "focus",
      handleFocus
    );

    return () => {
      window.clearInterval(interval);

      document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange
      );

      window.removeEventListener(
        "focus",
        handleFocus
      );
    };
  }, [
    user,
    loading,
    navigate,
    checkVerification,
  ]);

  async function handleResend() {
    if (resending) return;

    setResending(true);
    setError("");
    setMessage("");

    try {
      await resendVerification();

      setMessage(
        "A new verification email has been sent. " +
        "Check your inbox and spam folder."
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to resend verification email."
      );
    } finally {
      setResending(false);
    }
  }

  async function handleSignOut() {
    try {
      await logout();

      navigate("/login", {
        replace: true,
      });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to sign out."
      );
    }
  }

  if (loading || !user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f7f9fd]">
        <p className="text-slate-600">
          Loading...
        </p>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f7f9fd] px-4 py-10">
      <section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-7 text-center shadow-xl shadow-slate-900/5 sm:p-10">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50">
          <svg
            width="34"
            height="34"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#185abc"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <rect
              x="2"
              y="5"
              width="20"
              height="14"
              rx="2"
            />
            <path d="m3 7 9 6 9-6" />
          </svg>
        </div>

        <h1 className="mt-6 text-2xl font-extrabold tracking-tight text-[#142d50]">
          Verify your email
        </h1>

        <p className="mt-4 text-sm leading-7 text-slate-600">
          We've sent a verification link to
        </p>

        <p className="mt-1 break-all font-bold text-[#142d50]">
          {user.email}
        </p>

        <div className="mt-7 rounded-2xl border border-blue-100 bg-blue-50 p-5">
          <p className="text-sm font-semibold text-[#142d50]">
            Check your email
          </p>

          <p className="mt-2 text-sm leading-6 text-slate-600">
            Open the verification email and
            click the link. Return to this
            page afterward.
          </p>

          <p className="mt-3 text-sm font-medium text-[#185abc]">
            We'll automatically sign you in
            once your email is verified.
          </p>
        </div>

        <div
          role="status"
          aria-live="polite"
          className="mt-6 flex items-center justify-center gap-3 text-sm text-slate-600"
        >
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-blue-200 border-t-[#185abc]" />

          {checking
            ? "Checking verification..."
            : "Waiting for email verification..."}
        </div>

        {message && (
          <p
            role="status"
            className="mt-5 rounded-xl bg-green-50 p-4 text-sm text-green-800"
          >
            {message}
          </p>
        )}

        {error && (
          <p
            role="alert"
            className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-800"
          >
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={handleResend}
          disabled={resending}
          className="mt-7 w-full rounded-xl border border-blue-200 bg-white px-5 py-3.5 text-sm font-bold text-[#185abc] transition hover:bg-blue-50 disabled:opacity-50"
        >
          {resending
            ? "Sending..."
            : "Resend verification email"}
        </button>

        <button
          type="button"
          onClick={handleSignOut}
          className="mt-6 block w-full text-sm font-semibold text-slate-500 hover:text-[#142d50]"
        >
          Sign out
        </button>

        <Link
          to="/"
          className="mt-5 inline-block text-xs text-slate-400 hover:text-[#185abc]"
        >
          Back to homepage
        </Link>
      </section>
    </main>
  );
}