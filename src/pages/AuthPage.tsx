import {
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { FirebaseError } from "firebase/app";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

type AuthMode = "login" | "register" | "reset";

const countries = [
  { name: "India", code: "+91" },
  { name: "United States", code: "+1" },
  { name: "United Kingdom", code: "+44" },
  { name: "United Arab Emirates", code: "+971" },
  { name: "Australia", code: "+61" },
  { name: "Canada", code: "+1" },
  { name: "Singapore", code: "+65" },
  { name: "Germany", code: "+49" },
  { name: "France", code: "+33" },
  { name: "Nepal", code: "+977" },
  { name: "Sri Lanka", code: "+94" },
  { name: "Bangladesh", code: "+880" },
];

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
        return "The referral code was not found. Check the code and try again.";

      case "functions/failed-precondition":
        return error.message || "This referral code cannot be used.";

      case "functions/permission-denied":
        return error.message || "This action is not permitted.";

      case "functions/unavailable":
        return "The service is temporarily unavailable. Please try again.";

      default:
        return error.message || "Authentication failed. Please try again.";
    }
  }

  return error instanceof Error
    ? error.message
    : "Something went wrong. Please try again.";
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

function PasswordRequirement({
  valid,
  children,
}: {
  valid: boolean;
  children: ReactNode;
}) {
  return (
    <li className={valid ? "text-green-700" : "text-slate-500"}>
      <span aria-hidden="true" className="mr-2">
        {valid ? "✓" : "○"}
      </span>
      {children}
    </li>
  );
}

function readReferralCode(search: string): string {
  return (
    new URLSearchParams(search)
      .get("ref")
      ?.trim()
      .toUpperCase()
      .slice(0, 8) ?? ""
  );
}

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
    location.pathname === "/register" ? "register" : "login";

  const [resetMode, setResetMode] = useState(false);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [countryCode, setCountryCode] = useState("+91");
  const [mobileNumber, setMobileNumber] = useState("");

  const [referralCode, setReferralCode] = useState(() =>
    readReferralCode(location.search)
  );

  /*
   * Track the previous query string so referral links opened after
   * the page loads can update the referral field without useEffect.
   */
  const [previousSearch, setPreviousSearch] = useState(location.search);

  if (location.search !== previousSearch) {
    setPreviousSearch(location.search);

    const incomingCode = readReferralCode(location.search);

    if (incomingCode) {
      setReferralCode(incomingCode);
    }
  }

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const mode: AuthMode = resetMode ? "reset" : initialMode;
  const isRegister = mode === "register";

  const passwordRequirements = {
    length: password.length >= 8 && password.length <= 128,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /\d/.test(password),
    special: /[^A-Za-z0-9]/.test(password),
  };

  const passwordValid = Object.values(passwordRequirements).every(Boolean);

  const passwordsMatch =
    confirmPassword.length > 0 && password === confirmPassword;

  function clearMessages() {
    setError("");
    setMessage("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (busy) return;

    clearMessages();

    if (mode === "register") {
      if (!firstName.trim() || !lastName.trim()) {
        setError("Enter your first name and last name.");
        return;
      }

      if (
        firstName.trim().length > 60 ||
        lastName.trim().length > 60
      ) {
        setError("Each name must be 60 characters or fewer.");
        return;
      }

      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
        setError("Enter a valid email address.");
        return;
      }

      const digits = mobileNumber.replace(/\D/g, "");

      if (digits.length < 6 || digits.length > 14) {
        setError(
          "Enter a valid mobile number with the selected country code."
        );
        return;
      }

      if (!passwordValid) {
        setError(
          "Meet all password requirements before creating your account."
        );
        return;
      }

      if (password !== confirmPassword) {
        setError("The passwords do not match.");
        return;
      }

      if (
        referralCode &&
        !/^[A-Z0-9]{8}$/.test(referralCode.trim().toUpperCase())
      ) {
        setError(
          "Referral codes must contain exactly 8 letters or numbers."
        );
        return;
      }
    }

    setBusy(true);

    try {
      if (mode === "register") {
        await register({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim().toLowerCase(),
          countryCode,
          mobileNumber,
          password,
          referralCode: referralCode.trim().toUpperCase(),
        });

        navigate("/verify-email", { replace: true });
      } else if (mode === "login") {
        await login(email.trim().toLowerCase(), password);

        navigate("/dashboard", { replace: true });
      } else {
        await resetPassword(email.trim().toLowerCase());

        setMessage(
          "If an account exists for this email, a password reset link has been sent."
        );
      }
    } catch (err) {
      console.error("Authentication form submission failed:", err);
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

  const heading = isRegister
    ? "Create your account"
    : mode === "reset"
      ? "Reset your password"
      : "Welcome back";

  const description = isRegister
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

      <div className="mx-auto grid w-full max-w-5xl flex-1 items-center gap-5 px-4 py-5 sm:px-6 sm:py-7 lg:grid-cols-[1fr_460px] lg:gap-10">
        <section className="hidden lg:block">
          <span className="inline-flex rounded-full bg-blue-50 px-3 py-1.5 text-xs font-bold text-[#185abc]">
            HealthPassport Emergency QR
          </span>

          <h1 className="mt-4 max-w-md text-4xl font-extrabold leading-tight tracking-tight text-[#142d50]">
            Emergency information, ready when needed.
          </h1>

          <p className="mt-3 max-w-md text-sm leading-6 text-slate-600">
            Maintain essential emergency information through your personal
            QR and control which details are shared publicly.
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

        <section className="mx-auto w-full max-w-[460px] rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
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
              <>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="firstName"
                      className="block text-sm font-semibold text-[#183657]"
                    >
                      First name
                    </label>

                    <input
                      id="firstName"
                      type="text"
                      required
                      autoComplete="given-name"
                      maxLength={60}
                      value={firstName}
                      onChange={(event) => setFirstName(event.target.value)}
                      placeholder="First name"
                      className={inputClass}
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="lastName"
                      className="block text-sm font-semibold text-[#183657]"
                    >
                      Last name
                    </label>

                    <input
                      id="lastName"
                      type="text"
                      required
                      autoComplete="family-name"
                      maxLength={60}
                      value={lastName}
                      onChange={(event) => setLastName(event.target.value)}
                      placeholder="Last name"
                      className={inputClass}
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="mobileNumber"
                    className="block text-sm font-semibold text-[#183657]"
                  >
                    Mobile number
                  </label>

                  <div className="mt-1.5 grid grid-cols-[minmax(120px,0.85fr)_minmax(0,1.4fr)] gap-2">
                    <select
                      aria-label="Mobile country code"
                      value={countryCode}
                      onChange={(event) => setCountryCode(event.target.value)}
                      className="min-h-11 rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
                    >
                      {countries.map((country) => (
                        <option
                          key={`${country.name}-${country.code}`}
                          value={country.code}
                        >
                          {country.code} — {country.name}
                        </option>
                      ))}
                    </select>

                    <input
                      id="mobileNumber"
                      type="tel"
                      required
                      autoComplete="tel-national"
                      inputMode="tel"
                      maxLength={20}
                      value={mobileNumber}
                      onChange={(event) => setMobileNumber(event.target.value)}
                      placeholder="Mobile number"
                      className={inputClass}
                    />
                  </div>

                  <p className="mt-1.5 text-xs leading-5 text-slate-500">
                    Enter the number without the country code. Mobile
                    verification is separate and is not completed by
                    registration alone.
                  </p>
                </div>

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
                    name="referralCode"
                    type="text"
                    autoComplete="off"
                    maxLength={8}
                    spellCheck={false}
                    value={referralCode}
                    onChange={(event) => {
                      setReferralCode(
                        event.target.value
                          .toUpperCase()
                          .replace(/[^A-Z0-9]/g, "")
                          .slice(0, 8)
                      );
                    }}
                    placeholder="Enter 8-character referral code"
                    aria-describedby="referralHelp"
                    className={inputClass}
                  />

                  <p
                    id="referralHelp"
                    className="mt-1.5 text-xs leading-5 text-slate-500"
                  >
                    Have a referral code? Enter it here. Codes from referral
                    links are filled in automatically.
                  </p>
                </div>
              </>
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

                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    required
                    autoComplete={
                      isRegister ? "new-password" : "current-password"
                    }
                    maxLength={128}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder={
                      isRegister ? "Create a strong password" : "Your password"
                    }
                    className={`${inputClass} pr-20`}
                  />

                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    className="absolute inset-y-0 right-3 my-auto h-8 text-xs font-semibold text-[#185abc]"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>

                {isRegister && (
                  <div className="mt-3 rounded-lg bg-slate-50 p-3">
                    <p className="mb-2 text-xs font-bold text-[#183657]">
                      Password requirements
                    </p>

                    <ul className="space-y-1.5 text-xs">
                      <PasswordRequirement valid={passwordRequirements.length}>
                        8–128 characters
                      </PasswordRequirement>

                      <PasswordRequirement valid={passwordRequirements.uppercase}>
                        At least one uppercase letter (A–Z)
                      </PasswordRequirement>

                      <PasswordRequirement valid={passwordRequirements.lowercase}>
                        At least one lowercase letter (a–z)
                      </PasswordRequirement>

                      <PasswordRequirement valid={passwordRequirements.number}>
                        At least one number (0–9)
                      </PasswordRequirement>

                      <PasswordRequirement valid={passwordRequirements.special}>
                        At least one special character (such as @, #, ! or %)
                      </PasswordRequirement>
                    </ul>
                  </div>
                )}
              </div>
            )}

            {isRegister && (
              <div>
                <label
                  htmlFor="confirmPassword"
                  className="block text-sm font-semibold text-[#183657]"
                >
                  Confirm password
                </label>

                <div className="relative">
                  <input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    required
                    autoComplete="new-password"
                    maxLength={128}
                    value={confirmPassword}
                    onChange={(event) =>
                      setConfirmPassword(event.target.value)
                    }
                    placeholder="Re-enter your password"
                    aria-invalid={
                      confirmPassword.length > 0 && !passwordsMatch
                    }
                    className={`${inputClass} pr-20`}
                  />

                  <button
                    type="button"
                    onClick={() =>
                      setShowConfirmPassword((value) => !value)
                    }
                    className="absolute inset-y-0 right-3 my-auto h-8 text-xs font-semibold text-[#185abc]"
                    aria-label={
                      showConfirmPassword
                        ? "Hide confirmation password"
                        : "Show confirmation password"
                    }
                  >
                    {showConfirmPassword ? "Hide" : "Show"}
                  </button>
                </div>

                {confirmPassword.length > 0 && (
                  <p
                    className={`mt-1.5 text-xs ${
                      passwordsMatch ? "text-green-700" : "text-red-600"
                    }`}
                    role="status"
                  >
                    {passwordsMatch
                      ? "Passwords match."
                      : "Passwords do not match."}
                  </p>
                )}
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

            <button
              type="submit"
              disabled={
                busy ||
                (isRegister &&
                  (!passwordValid ||
                    password !== confirmPassword ||
                    !firstName.trim() ||
                    !lastName.trim() ||
                    !mobileNumber.trim()))
              }
              className={buttonClass}
            >
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
            Manage the emergency information associated with your account
            and review your public-sharing settings regularly.
          </p>
        </section>
      </div>
    </main>
  );
}