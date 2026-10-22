
import { useState, type FormEvent } from "react";
import { FirebaseError } from "firebase/app";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

type AuthMode = "login" | "register" | "reset";

function authErrorMessage(error: unknown): string {
  if (error instanceof FirebaseError) {
    switch (error.code) {
      case "auth/email-already-in-use":
        return "An account already exists with this email.";
      case "auth/invalid-email":
        return "Enter a valid email address.";
      case "auth/weak-password":
        return "Choose a stronger password.";
      case "auth/invalid-credential":
        return "The sign-in details are incorrect.";
      case "auth/popup-closed-by-user":
        return "Google Sign-In was cancelled.";
      case "auth/too-many-requests":
        return "Too many attempts. Please try again later.";
      case "auth/network-request-failed":
        return "Network error. Check your connection and try again.";
      case "functions/not-found":
        return "Referral validation is not available yet. Please try again later.";
      case "functions/failed-precondition":
        return "The referral code cannot be used. Check the code and try again.";
      case "functions/invalid-argument":
        return "Enter a valid 8-character referral code.";
      case "functions/unavailable":
        return "The service is temporarily unavailable. Please try again.";
      default:
        return "Authentication failed. Please try again.";
    }
  }

  return error instanceof Error ? error.message : "Something went wrong.";
}

const inputClass =
  "mt-1.5 min-h-11 w-full rounded-lg border border-slate-300 " +
  "bg-white px-3 py-2.5 text-sm text-slate-900 outline-none " +
  "transition placeholder:text-slate-400 focus:border-blue-600 " +
  "focus:ring-2 focus:ring-blue-100";

const buttonClass =
  "inline-flex min-h-11 w-full items-center justify-center rounded-lg " +
  "bg-[#185abc] px-4 py-2.5 text-sm font-bold text-white " +
  "transition hover:bg-[#124a9e] focus-visible:outline-none " +
  "focus-visible:ring-2 focus-visible:ring-blue-500 " +
  "focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

export default function AuthPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const { register, login, loginWithGoogle, resetPassword } = useAuth();

  const initialMode: AuthMode =
    location.pathname === "/register" ? "register" : "login";

  const [resetMode, setResetMode] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const mode: AuthMode = resetMode ? "reset" : initialMode;
  const isRegister = mode === "register";

  function clearMessages() {
    setError("");
    setMessage("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;

    setBusy(true);
    clearMessages();

    try {
      if (mode === "register") {
        if (!name.trim()) {
          throw new Error("Please enter your full name.");
        }

        if (name.trim().length > 120) {
          throw new Error("Your name must be 120 characters or fewer.");
        }

        if (password.length < 8) {
          throw new Error("Your password must contain at least 8 characters.");
        }

        const normalizedReferralCode = referralCode.trim().toUpperCase();

        if (
          normalizedReferralCode &&
          !/^[A-Z0-9]{8}$/.test(normalizedReferralCode)
        ) {
          throw new Error(
            "Referral codes must contain exactly 8 letters or numbers."
          );
        }

        await register(
          name.trim(),
          email.trim(),
          password,
          normalizedReferralCode
        );

        navigate("/verify-email", { replace: true });
      } else if (mode === "login") {
        await login(email.trim(), password);
        navigate("/dashboard", { replace: true });
      } else {
        await resetPassword(email.trim());
        setMessage(
          "If an account exists for this email, a password reset link has been sent."
        );
      }
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogleLogin() {
    if (busy) return;

    setBusy(true);
    clearMessages();

    try {
      await loginWithGoogle();
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const heading =
    isRegister
      ? "Create your account"
      : mode === "reset"
        ? "Reset your password"
        : "Welcome back";

  const description =
    isRegister
      ? "Register to create and manage your Emergency QR."
      : mode === "reset"
        ? "Enter your email to request a password reset link."
        : "Sign in to manage your emergency information.";

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

          <Link
            to="/"
            className="rounded-md px-2 py-2 text-sm font-semibold text-[#185abc] hover:bg-blue-50"
          >
            Home
          </Link>
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-5xl flex-1 items-center gap-5 px-4 py-5 sm:px-6 sm:py-7 lg:grid-cols-[1fr_420px] lg:gap-10">
        <section className="hidden lg:block">
          <span className="inline-flex rounded-full bg-blue-50 px-3 py-1.5 text-xs font-bold text-[#185abc]">
            HealthPassport Emergency QR
          </span>

          <h1 className="mt-4 max-w-md text-4xl font-extrabold leading-tight tracking-tight text-[#142d50]">
            Emergency information, ready when needed.
          </h1>

          <p className="mt-3 max-w-md text-sm leading-6 text-slate-600">
            Maintain essential emergency information through your personal QR
            and control which details are shared publicly.
          </p>

          <ul className="mt-5 space-y-3">
            {[
              "Create and maintain your emergency profile",
              "Manage your personal Emergency QR",
              "Choose which information is publicly visible",
            ].map((item) => (
              <li
                key={item}
                className="flex items-start gap-2.5 text-sm text-[#183657]"
              >
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-green-50 text-xs font-bold text-green-700">
                  ✓
                </span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="mx-auto w-full max-w-[420px] rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#185abc]">
            {isRegister
              ? "Get started"
              : mode === "reset"
                ? "Account recovery"
                : "Secure account access"}
          </p>

          <h2 className="mt-1.5 text-2xl font-extrabold tracking-tight text-[#142d50]">
            {heading}
          </h2>

          <p className="mt-1.5 text-sm leading-5 text-slate-600">
            {description}
          </p>

          <form onSubmit={handleSubmit} className="mt-5 space-y-3.5">
            {isRegister && (
              <div>
                <label
                  htmlFor="fullName"
                  className="block text-sm font-semibold text-[#183657]"
                >
                  Full name
                </label>
                <input
                  id="fullName"
                  type="text"
                  required
                  autoComplete="name"
                  maxLength={120}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Your full name"
                  className={inputClass}
                />
              </div>
            )}

            <div>
              <label
                htmlFor="email"
                className="block text-sm font-semibold text-[#183657]"
              >
                Email address
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                maxLength={254}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                className={inputClass}
              />
            </div>

            {mode !== "reset" && (
              <div>
                <label
                  htmlFor="password"
                  className="block text-sm font-semibold text-[#183657]"
                >
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  required
                  minLength={isRegister ? 8 : undefined}
                  autoComplete={isRegister ? "new-password" : "current-password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder={
                    isRegister ? "At least 8 characters" : "Your password"
                  }
                  className={inputClass}
                />
              </div>
            )}

            {isRegister && (
              <div>
                <label
                  htmlFor="referralCode"
                  className="block text-sm font-semibold text-[#183657]"
                >
                  Referral code{" "}
                  <span className="font-normal text-slate-500">
                    (optional)
                  </span>
                </label>
                <input
                  id="referralCode"
                  type="text"
                  autoComplete="off"
                  maxLength={8}
                  pattern="[A-Za-z0-9]{8}"
                  value={referralCode}
                  onChange={(event) =>
                    setReferralCode(event.target.value.toUpperCase())
                  }
                  placeholder="Enter 8-character code"
                  className={inputClass}
                  aria-describedby="referralHelp"
                />
                <p
                  id="referralHelp"
                  className="mt-1 text-xs text-slate-500"
                >
                  Leave blank if you were not referred by another member.
                </p>
              </div>
            )}

            {error && (
              <p
                role="alert"
                className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-800"
              >
                {error}
              </p>
            )}

            {message && (
              <p
                role="status"
                className="rounded-lg border border-green-200 bg-green-50 px-3 py-2.5 text-sm text-green-800"
              >
                {message}
              </p>
            )}

            <button type="submit" disabled={busy} className={buttonClass}>
              {busy
                ? "Please wait…"
                : isRegister
                  ? "Create account"
                  : mode === "reset"
                    ? "Send reset link"
                    : "Sign in"}
            </button>
          </form>

          {mode !== "reset" && (
            <>
              <div className="my-4 flex items-center gap-3">
                <span className="h-px flex-1 bg-slate-200" />
                <span className="text-[11px] font-medium text-slate-400">
                  OR
                </span>
                <span className="h-px flex-1 bg-slate-200" />
              </div>

              <button
                type="button"
                disabled={busy}
                onClick={handleGoogleLogin}
                className="flex min-h-11 w-full items-center justify-center gap-2.5 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-[#183657] hover:bg-slate-50 disabled:opacity-50"
              >
                <span className="text-base font-extrabold text-[#4285f4]">
                  G
                </span>
                Continue with Google
              </button>
            </>
          )}

          <div className="mt-5 space-y-3 text-center text-sm">
            {mode === "login" && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    clearMessages();
                    setResetMode(true);
                  }}
                  className="font-semibold text-[#185abc] hover:underline"
                >
                  Forgot password?
                </button>

                <p className="text-slate-600">
                  Don&apos;t have an account?{" "}
                  <Link
                    to="/register"
                    className="font-bold text-[#185abc] hover:underline"
                  >
                    Register
                  </Link>
                </p>
              </>
            )}

            {isRegister && (
              <p className="text-slate-600">
                Already registered?{" "}
                <Link
                  to="/login"
                  className="font-bold text-[#185abc] hover:underline"
                >
                  Sign in
                </Link>
              </p>
            )}

            {mode === "reset" && (
              <button
                type="button"
                onClick={() => {
                  clearMessages();
                  setResetMode(false);
                }}
                className="font-bold text-[#185abc] hover:underline"
              >
                Return to login
              </button>
            )}
          </div>

          <p className="mt-5 border-t border-slate-100 pt-4 text-center text-xs leading-5 text-slate-500">
            Manage the emergency information associated with your account and
            review your public-sharing settings regularly.
          </p>
        </section>
      </div>
    </main>
  );
}
