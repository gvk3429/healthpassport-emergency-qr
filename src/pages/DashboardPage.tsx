
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

function Icon({
  name,
  size = 22,
}: {
  name: "qr" | "user" | "shield" | "arrow" | "family";
  size?: number;
}) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true as const,
  };

  if (name === "qr") {
    return (
      <svg {...common}>
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <path d="M14 14h3v3h-3zM21 14v3M17 21h4M14 21v-3" />
      </svg>
    );
  }

  if (name === "user") {
    return (
      <svg {...common}>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21a8 8 0 0 1 16 0" />
      </svg>
    );
  }

  if (name === "shield") {
    return (
      <svg {...common}>
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
        <path d="m9 12 2 2 4-4" />
      </svg>
    );
  }

  if (name === "family") {
    return (
      <svg {...common}>
        <circle cx="9" cy="8" r="3" />
        <path d="M3 20v-2a6 6 0 0 1 12 0v2" />
        <circle cx="18" cy="9" r="2" />
        <path d="M17 15a5 5 0 0 1 4 5" />
      </svg>
    );
  }

  return (
    <svg {...common}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

function Brand() {
  return (
    <Link
      to="/"
      className="flex items-center gap-3"
      aria-label="HealthPassport homepage"
    >
      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#143d75] text-xl font-extrabold !text-white">
        H
      </span>

      <span>
        <span className="block text-base font-extrabold tracking-tight text-[#142d50]">
          HealthPassport
        </span>

        <span className="block text-xs font-medium text-slate-500">
          Emergency QR
        </span>
      </span>
    </Link>
  );
}

export default function DashboardPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState("");

  const displayName =
    user?.displayName?.trim() ||
    user?.email?.split("@")[0] ||
    "HealthPassport User";

  async function handleSignOut() {
    if (signingOut) return;

    setSigningOut(true);
    setError("");

    try {
      await logout();
      navigate("/login", { replace: true });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to sign out. Please try again."
      );
      setSigningOut(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#f7f9fd] text-[#142d50]">
      {/* Navigation */}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <Brand />

          <nav
            aria-label="Dashboard navigation"
            className="flex flex-wrap items-center gap-2"
          >
            <Link
              to="/dashboard"
              aria-current="page"
              className="rounded-xl bg-blue-50 px-4 py-2.5 text-sm font-bold text-[#185abc]"
            >
              Dashboard
            </Link>

            <Link
              to="/profile"
              className="rounded-xl px-4 py-2.5 text-sm font-semibold text-[#183657] transition hover:bg-slate-100"
            >
              My Profile
            </Link>

            <Link
              to="/my-qr"
              className="rounded-xl px-4 py-2.5 text-sm font-semibold text-[#183657] transition hover:bg-slate-100"
            >
              My QR
            </Link>

            <button
              type="button"
              onClick={handleSignOut}
              disabled={signingOut}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-[#183657] transition hover:bg-slate-50 disabled:opacity-50"
            >
              {signingOut ? "Signing out..." : "Sign out"}
            </button>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-5 py-10 sm:px-8 lg:py-14">
        {error && (
          <div
            role="alert"
            className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
          >
            {error}
          </div>
        )}

        {/* Welcome */}
        <section className="mb-10">
          <span className="inline-flex rounded-full border border-blue-100 bg-blue-50 px-4 py-2 text-xs font-extrabold uppercase tracking-wider text-[#185abc]">
            Your emergency dashboard
          </span>

          <h1 className="mt-5 text-3xl font-extrabold tracking-tight text-[#142d50] sm:text-4xl">
            Welcome, {displayName}
          </h1>

          <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">
            Manage your emergency information, control what
            responders can see and access your personal
            Emergency QR.
          </p>
        </section>

        {/* Main cards */}
        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="flex items-start gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-[#185abc]">
                <Icon name="user" size={25} />
              </span>

              <div>
                <h2 className="text-xl font-extrabold text-[#142d50]">
                  Account information
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Your HealthPassport account
                </p>
              </div>
            </div>

            <div className="mt-7 divide-y divide-slate-100">
              <div className="py-4">
                <p className="text-sm font-medium text-slate-500">
                  Full name
                </p>

                <p className="mt-1 break-words font-semibold text-[#142d50]">
                  {displayName}
                </p>
              </div>

              <div className="py-4">
                <p className="text-sm font-medium text-slate-500">
                  Email address
                </p>

                <p className="mt-1 break-all font-semibold text-[#142d50]">
                  {user?.email || "Not available"}
                </p>
              </div>

              <div className="py-4">
                <p className="text-sm font-medium text-slate-500">
                  Email verification
                </p>

                <span
                  className={
                    user?.emailVerified
                      ? "mt-2 inline-flex rounded-full bg-green-50 px-3 py-1.5 text-xs font-bold text-green-700"
                      : "mt-2 inline-flex rounded-full bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-700"
                  }
                >
                  {user?.emailVerified
                    ? "Verified"
                    : "Verification required"}
                </span>
              </div>
            </div>

            <Link
              to="/profile"
              className="mt-6 inline-flex items-center justify-center gap-2 rounded-xl border border-blue-200 bg-white px-5 py-3 text-sm font-bold text-[#185abc] transition hover:bg-blue-50"
            >
              Manage emergency profile
              <Icon name="arrow" size={17} />
            </Link>
          </section>

          <section className="relative overflow-hidden rounded-3xl border border-blue-100 bg-white p-6 shadow-sm sm:p-8">
            <div
              className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-blue-50"
              aria-hidden="true"
            />

            <div className="relative">
              <div className="flex items-start gap-4">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-[#185abc]">
                  <Icon name="qr" size={25} />
                </span>

                <div>
                  <h2 className="text-xl font-extrabold text-[#142d50]">
                    My Emergency QR
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    Your personal emergency identifier
                  </p>
                </div>
              </div>

              <p className="mt-7 max-w-md text-sm leading-7 text-slate-600">
                Create and manage your personal QR. Once
                activated, anyone who scans it can access
                the emergency information you have approved
                for public viewing.
              </p>

              <div className="mt-6 rounded-2xl border border-blue-100 bg-[#f2f6fc] p-5">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 text-[#185abc]">
                    <Icon name="shield" size={21} />
                  </span>

                  <div>
                    <h3 className="text-sm font-bold text-[#142d50]">
                      Privacy-controlled sharing
                    </h3>

                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      Your public QR displays only the
                      information permitted by your
                      emergency-profile settings.
                    </p>
                  </div>
                </div>
              </div>

              <Link
                to="/my-qr"
                className="mt-7 inline-flex min-h-12 items-center justify-center gap-3 rounded-xl bg-[#185abc] px-6 py-3 text-sm font-bold !text-white shadow-sm transition hover:bg-[#124a9e] hover:!text-white"
              >
                Open My QR
                <Icon name="arrow" size={18} />
              </Link>
            </div>
          </section>
        </div>

        {/* Quick actions */}
        <section className="mt-12">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#185abc]">
              Quick access
            </p>

            <h2 className="mt-2 text-2xl font-extrabold tracking-tight text-[#142d50]">
              What would you like to do?
            </h2>
          </div>

          <div className="mt-6 grid gap-5 md:grid-cols-3">
            <Link
              to="/profile"
              className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-blue-200 hover:shadow-md"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-[#185abc]">
                <Icon name="user" size={25} />
              </span>

              <h3 className="mt-6 text-lg font-bold text-[#142d50]">
                Emergency profile
              </h3>

              <p className="mt-3 min-h-14 text-sm leading-7 text-slate-600">
                Add or update your medical information,
                emergency contacts and privacy settings.
              </p>

              <span className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-[#185abc]">
                Manage profile
                <Icon name="arrow" size={17} />
              </span>
            </Link>

            <Link
              to="/my-qr"
              className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-blue-200 hover:shadow-md"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-[#185abc]">
                <Icon name="qr" size={25} />
              </span>

              <h3 className="mt-6 text-lg font-bold text-[#142d50]">
                My Emergency QR
              </h3>

              <p className="mt-3 min-h-14 text-sm leading-7 text-slate-600">
                Create, activate, download, test or
                deactivate your personal Emergency QR.
              </p>

              <span className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-[#185abc]">
                Manage my QR
                <Icon name="arrow" size={17} />
              </span>
            </Link>

            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
                <Icon name="family" size={25} />
              </span>

              <h3 className="mt-6 text-lg font-bold text-[#142d50]">
                Family Emergency QRs
              </h3>

              <p className="mt-3 min-h-14 text-sm leading-7 text-slate-600">
                Independently manage emergency profiles
                and QRs for consenting family members
                and dependants.
              </p>

              <span className="mt-5 inline-flex rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-600">
                Planned feature
              </span>
            </div>
          </div>
        </section>

        {/* Privacy notice */}
        <section className="mt-10 flex flex-col gap-4 rounded-2xl border border-blue-100 bg-blue-50 p-6 sm:flex-row sm:items-start">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-[#185abc]">
            <Icon name="shield" size={23} />
          </span>

          <div>
            <h2 className="text-base font-bold text-[#142d50]">
              Your information. Your choice.
            </h2>

            <p className="mt-2 max-w-4xl text-sm leading-7 text-slate-600">
              Only information you explicitly authorize
              should appear on your public Emergency QR.
              You can edit your profile and deactivate
              your QR when needed. Emergency information
              is self-reported and should be independently
              verified by medical professionals.
            </p>
          </div>
        </section>
      </main>

      <footer className="mt-8 border-t border-slate-200 bg-white py-6">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-2 px-5 text-xs text-slate-500 sm:flex-row sm:px-8">
          <span>HealthPassport Emergency QR</span>
          <span>
            Emergency information does not replace
            professional medical assessment.
          </span>
        </div>
      </footer>
    </div>
  );
}