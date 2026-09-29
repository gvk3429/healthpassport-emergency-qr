
import {
  useState,
  type FormEvent,
} from "react";

import { FirebaseError } from "firebase/app";

import {
  Link,
  useLocation,
  useNavigate,
} from "react-router-dom";

import { useAuth } from "../auth/AuthContext";

type AuthMode =
  | "login"
  | "register"
  | "reset";

function authErrorMessage(
  error: unknown
): string {
  if (error instanceof FirebaseError) {
    switch (error.code) {
      case "auth/email-already-in-use":
        return "An account already exists with this email.";
      case "auth/invalid-email":
        return "Enter a valid email address.";
      case "auth/weak-password":
        return "Choose a stronger password.";
      case "auth/invalid-credential":
        return "Incorrect email or password.";
      case "auth/popup-closed-by-user":
        return "Google Sign-In was cancelled.";
      case "auth/too-many-requests":
        return "Too many attempts. Try again later.";
      default:
        return "Authentication failed. Please try again.";
    }
  }

  return error instanceof Error
    ? error.message
    : "Something went wrong.";
}

const inputClass =
  "mt-2 w-full rounded-xl border border-slate-300 " +
  "bg-white px-4 py-3.5 text-sm text-slate-900 " +
  "outline-none transition placeholder:text-slate-400 " +
  "focus:border-blue-600 focus:ring-4 focus:ring-blue-100";

export default function AuthPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const {
    register,
    login,
    loginWithGoogle,
    resetPassword,
  } = useAuth();

  const initialMode: AuthMode =
    location.pathname === "/register"
      ? "register"
      : "login";

  const [resetMode, setResetMode] =
    useState(false);

  const [name, setName] =
    useState("");

  const [email, setEmail] =
    useState("");

  const [password, setPassword] =
    useState("");

  const [busy, setBusy] =
    useState(false);

  const [error, setError] =
    useState("");

  const [message, setMessage] =
    useState("");

  const mode: AuthMode = resetMode
    ? "reset"
    : initialMode;

  function clearMessages() {
    setError("");
    setMessage("");
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (busy) return;

    setBusy(true);
    clearMessages();

    try {
      if (mode === "register") {
        if (!name.trim()) {
          throw new Error(
            "Please enter your full name."
          );
        }

        if (password.length < 8) {
          throw new Error(
            "Your password must contain at least 8 characters."
          );
        }

        await register(
          name,
          email,
          password
        );

        navigate("/verify-email", {
          replace: true,
        });
      } else if (mode === "login") {
        await login(email, password);

        navigate("/dashboard", {
          replace: true,
        });
      } else {
        await resetPassword(email);

        setMessage(
          "If an account exists for this email, " +
          "a password reset link has been sent."
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

      navigate("/dashboard", {
        replace: true,
      });
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const isRegister =
    mode === "register";

  return (
    <main className="flex min-h-screen flex-col bg-[#f7f9fd]">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-5 py-4 sm:px-8">
          <Link
            to="/"
            className="flex items-center gap-3"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#143d75] text-lg font-extrabold text-white">
              H
            </span>

            <span>
              <span className="block font-extrabold tracking-tight text-[#142d50]">
                HealthPassport
              </span>

              <span className="block text-xs text-slate-500">
                Emergency QR
              </span>
            </span>
          </Link>

          <Link
            to="/"
            className="text-sm font-semibold text-[#185abc] hover:underline"
          >
            Back to home
          </Link>
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-6xl flex-1 items-center gap-12 px-5 py-12 sm:px-8 lg:grid-cols-2 lg:gap-20 lg:py-20">
        <div className="hidden lg:block">
          <span className="inline-flex rounded-full bg-blue-50 px-4 py-2 text-xs font-bold uppercase tracking-wide text-[#185abc]">
            HealthPassport Emergency QR
          </span>

          <h1 className="mt-7 max-w-lg text-5xl font-extrabold leading-tight tracking-tight text-[#142d50]">
            Emergency information.
            <span className="block text-[#185abc]">
              Ready when needed.
            </span>
          </h1>

          <p className="mt-6 max-w-md text-lg leading-8 text-slate-600">
            Keep essential emergency details
            accessible through a personal QR,
            with control over the information
            you choose to share.
          </p>

          <div className="mt-10 space-y-5">
            {[
              "Create your personal emergency profile",
              "Choose which information is public",
              "Activate and manage your Emergency QR",
            ].map((item) => (
              <div
                key={item}
                className="flex items-center gap-3 text-sm font-medium text-[#183657]"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-green-50 font-bold text-green-700">
                  ✓
                </span>
                {item}
              </div>
            ))}
          </div>
        </div>

        <section className="mx-auto w-full max-w-[470px] rounded-3xl border border-slate-200 bg-white p-6 shadow-xl shadow-[#143d75]/5 sm:p-9">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#185abc]">
            {isRegister
              ? "Get started"
              : mode === "reset"
                ? "Account recovery"
                : "Welcome back"}
          </p>

          <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-[#142d50]">
            {isRegister
              ? "Create your account"
              : mode === "reset"
                ? "Reset your password"
                : "Sign in"}
          </h2>

          <p className="mt-3 text-sm leading-6 text-slate-600">
            {isRegister
              ? "Register to create and manage your personal Emergency QR."
              : mode === "reset"
                ? "Enter your registered email address to receive a reset link."
                : "Access your HealthPassport dashboard."}
          </p>

          <form
            onSubmit={handleSubmit}
            className="mt-8 space-y-5"
          >
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
                  onChange={(event) =>
                    setName(event.target.value)
                  }
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
                value={email}
                onChange={(event) =>
                  setEmail(event.target.value)
                }
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
                  minLength={
                    isRegister
                      ? 8
                      : undefined
                  }
                  autoComplete={
                    isRegister
                      ? "new-password"
                      : "current-password"
                  }
                  value={password}
                  onChange={(event) =>
                    setPassword(event.target.value)
                  }
                  placeholder={
                    isRegister
                      ? "At least 8 characters"
                      : "Enter your password"
                  }
                  className={inputClass}
                />
              </div>
            )}

            {error && (
              <p
                role="alert"
                className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
              >
                {error}
              </p>
            )}

            {message && (
              <p
                role="status"
                className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800"
              >
                {message}
              </p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-xl bg-[#185abc] px-5 py-4 text-sm font-bold text-white transition hover:bg-[#124a9e] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy
                ? "Please wait..."
                : isRegister
                  ? "Create account"
                  : mode === "reset"
                    ? "Send reset link"
                    : "Sign in"}
            </button>
          </form>

          {mode !== "reset" && (
            <>
              <div className="my-6 flex items-center gap-4">
                <span className="h-px flex-1 bg-slate-200" />
                <span className="text-xs font-medium text-slate-400">
                  OR
                </span>
                <span className="h-px flex-1 bg-slate-200" />
              </div>

              <button
                type="button"
                disabled={busy}
                onClick={handleGoogleLogin}
                className="flex w-full items-center justify-center gap-3 rounded-xl border border-slate-300 bg-white px-5 py-3.5 text-sm font-semibold text-[#183657] transition hover:bg-slate-50 disabled:opacity-50"
              >
                <span className="text-lg font-extrabold text-[#4285f4]">
                  G
                </span>
                Continue with Google
              </button>
            </>
          )}

          <div className="mt-7 space-y-4 text-center text-sm">
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
                  Don't have an account?{" "}
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

          <p className="mt-8 border-t border-slate-100 pt-6 text-center text-xs leading-5 text-slate-500">
            Your emergency information is
            controlled through your account
            and public disclosure settings.
          </p>
        </section>
      </div>
    </main>
  );
}