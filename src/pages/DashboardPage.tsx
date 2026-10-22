import { useCallback, useEffect, useState } from "react";
import { httpsCallable } from "firebase/functions";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { functions } from "../lib/firebase";

type ReferralSummary = {
  code: string;
  verifiedReferrals: number;
};

const getReferralDashboardSummary = httpsCallable<
  Record<string, never>,
  ReferralSummary
>(functions, "getReferralDashboardSummary");

function Icon({
  name,
  size = 20,
}: {
  name: "qr" | "user" | "shield" | "arrow" | "family" | "share" | "link";
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

  if (name === "share") {
    return (
      <svg {...common}>
        <circle cx="18" cy="5" r="3" />
        <circle cx="6" cy="12" r="3" />
        <circle cx="18" cy="19" r="3" />
        <path d="m8.7 10.6 6.6-4.2M8.7 13.4l6.6 4.2" />
      </svg>
    );
  }

  if (name === "link") {
    return (
      <svg {...common}>
        <path d="M10 13a5 5 0 0 0 7.1 0l2-2a5 5 0 0 0-7.1-7.1l-1.1 1.1" />
        <path d="M14 11a5 5 0 0 0-7.1 0l-2 2A5 5 0 0 0 12 20.1l1.1-1.1" />
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
      aria-label="HealthPassport homepage"
      className="flex min-w-0 items-center gap-2.5"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#143d75] text-lg font-extrabold text-white">
        H
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-extrabold tracking-tight text-[#142d50]">
          HealthPassport
        </span>
        <span className="block text-[11px] text-slate-500">
          Emergency QR
        </span>
      </span>
    </Link>
  );
}

function SectionIcon({
  name,
}: {
  name: "qr" | "user" | "shield" | "family" | "share" | "link";
}) {
  return (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-[#185abc]">
      <Icon name={name} size={21} />
    </span>
  );
}

export default function DashboardPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState("");
  const [referral, setReferral] = useState<ReferralSummary | null>(null);
  const [referralLoading, setReferralLoading] = useState(true);
  const [referralLoadFailed, setReferralLoadFailed] = useState(false);
  const [copyMessage, setCopyMessage] = useState("");

  const displayName =
    user?.displayName?.trim() ||
    user?.email?.split("@")[0] ||
    "HealthPassport User";

  const loadReferralSummary = useCallback(async () => {
    if (!user?.emailVerified) {
      setReferral(null);
      setReferralLoadFailed(false);
      setReferralLoading(false);
      return;
    }

    setReferralLoading(true);
    setReferralLoadFailed(false);

    try {
      const result = await getReferralDashboardSummary({});
      setReferral(result.data);
    } catch (err) {
      console.error("Unable to load referral summary:", err);
      setReferral(null);
      setReferralLoadFailed(true);
    } finally {
      setReferralLoading(false);
    }
  }, [user?.uid, user?.emailVerified]);

  useEffect(() => {
    void loadReferralSummary();
  }, [loadReferralSummary]);

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

  async function copyReferralCode() {
    if (!referral?.code) return;

    try {
      await navigator.clipboard.writeText(referral.code);
      setCopyMessage("Referral code copied.");
    } catch {
      setCopyMessage(`Copy this code manually: ${referral.code}`);
    }
  }

  function getReferralLink(code: string): string {
    const url = new URL(window.location.href);

    // HashRouter routes must remain inside the URL fragment.
    url.hash = `/?ref=${encodeURIComponent(code)}`;

    return url.toString();
  }

  async function copyReferralLink() {
    if (!referral?.code) return;

    const referralLink = getReferralLink(referral.code);

    try {
      await navigator.clipboard.writeText(referralLink);
      setCopyMessage(
        "Referral link copied. You can paste it into any app."
      );
    } catch {
      setCopyMessage(
        `Copy this referral link manually: ${referralLink}`
      );
    }
  }

  async function shareReferralCode() {
    if (!referral?.code) return;

    const referralLink = getReferralLink(referral.code);
    const shareText =
      `Join HealthPassport Emergency QR using my referral code: ${referral.code}`;

    try {
      if (typeof navigator.share === "function") {
        await navigator.share({
          title: "HealthPassport Emergency QR",
          text: shareText,
          url: referralLink,
        });
      } else {
        await navigator.clipboard.writeText(
          `${shareText}\n${referralLink}`
        );
        setCopyMessage("Referral message and link copied.");
      }
    } catch (err) {
      // Closing the native share sheet is not an error.
      if (err instanceof Error && err.name === "AbortError") return;

      try {
        await navigator.clipboard.writeText(
          `${shareText}\n${referralLink}`
        );
        setCopyMessage(
          "Sharing isn't available here. Referral link copied instead."
        );
      } catch {
        setCopyMessage(
          `Share this message and link manually: ${shareText} ${referralLink}`
        );
      }
    }
  }

  const cardClass =
    "rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5";

  const linkClass =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-[#185abc] px-4 py-2 text-sm font-semibold transition hover:bg-[#124a9e] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2";

  const secondaryLinkClass =
    "inline-flex min-h-9 items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-[#185abc] transition hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500";

  return (
    <div className="min-h-screen bg-[#f7f9fd] text-[#142d50]">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Brand />

          <nav
            aria-label="Dashboard navigation"
            className="flex flex-wrap items-center gap-1"
          >
            <Link
              to="/dashboard"
              aria-current="page"
              className="rounded-lg bg-blue-50 px-3 py-2 text-sm font-bold text-[#185abc]"
            >
              Dashboard
            </Link>

            <Link
              to="/profile"
              className="rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              Profile
            </Link>

            <Link
              to="/my-qr"
              className="rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              My QR
            </Link>

            <button
              type="button"
              onClick={handleSignOut}
              disabled={signingOut}
              className="min-h-9 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {signingOut ? "Signing out…" : "Sign out"}
            </button>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-5 sm:px-6 sm:py-7">
        {error && (
          <div
            role="alert"
            className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-800"
          >
            {error}
          </div>
        )}

        <section className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-[#185abc]">
              Emergency dashboard
            </p>

            <h1 className="mt-1 text-2xl font-extrabold tracking-tight sm:text-3xl">
              Welcome, {displayName}
            </h1>

            <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">
              Manage your emergency profile and personal QR from one place.
            </p>
          </div>

          <Link
  to="/my-qr"
  className={linkClass}
  style={{ color: "#ffffff" }}
>
  <Icon name="qr" size={18} />
  Open My QR
</Link>
        </section>

        <div className="grid gap-4 lg:grid-cols-2">
          <section className={cardClass}>
            <div className="flex items-center gap-3">
              <SectionIcon name="user" />

              <div>
                <h2 className="text-base font-bold">
                  Account information
                </h2>
                <p className="text-xs text-slate-500">
                  Your registered account details
                </p>
              </div>
            </div>

            <dl className="mt-4 divide-y divide-slate-100">
              <div className="grid grid-cols-[105px_minmax(0,1fr)] gap-3 py-2.5 text-sm">
                <dt className="text-slate-500">Full name</dt>
                <dd className="break-words font-semibold">
                  {displayName}
                </dd>
              </div>

              <div className="grid grid-cols-[105px_minmax(0,1fr)] gap-3 py-2.5 text-sm">
                <dt className="text-slate-500">Email</dt>
                <dd className="break-all font-medium">
                  {user?.email || "Not available"}
                </dd>
              </div>

              <div className="grid grid-cols-[105px_minmax(0,1fr)] gap-3 py-2.5 text-sm">
                <dt className="text-slate-500">Email status</dt>
                <dd>
                  <span
                    className={
                      user?.emailVerified
                        ? "inline-flex rounded-full bg-green-50 px-2.5 py-1 text-xs font-semibold text-green-700"
                        : "inline-flex rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800"
                    }
                  >
                    {user?.emailVerified
                      ? "Verified"
                      : "Verification required"}
                  </span>
                </dd>
              </div>
            </dl>

            <div className="mt-3 border-t border-slate-100 pt-3">
              <Link to="/profile" className={secondaryLinkClass}>
                Manage emergency profile
                <Icon name="arrow" size={16} />
              </Link>
            </div>
          </section>

          <section className={cardClass}>
            <div className="flex items-center gap-3">
              <SectionIcon name="qr" />

              <div>
                <h2 className="text-base font-bold">My Emergency QR</h2>
                <p className="text-xs text-slate-500">
                  Your personal emergency identifier
                </p>
              </div>
            </div>

            <p className="mt-3 text-sm leading-6 text-slate-600">
              Manage your QR and the emergency information made available to
              someone who scans it. Review your profile before sharing your QR.
            </p>

            <div className="mt-3 flex items-start gap-2 rounded-lg bg-blue-50 p-3">
              <span className="mt-0.5 text-[#185abc]">
                <Icon name="shield" size={18} />
              </span>

              <p className="text-xs leading-5 text-slate-600">
                Only information allowed by your emergency-profile settings
                should be shown on the public QR page.
              </p>
            </div>

            <div className="mt-3">
              <Link
  to="/my-qr"
  className={linkClass}
  style={{ color: "#ffffff" }}
>
  Manage My QR
  <Icon name="arrow" size={17} />
</Link>
            </div>
          </section>
        </div>

        <section className="mt-5">
          <div className="mb-3">
            <h2 className="text-lg font-bold">Referral programme</h2>
            <p className="mt-0.5 text-sm text-slate-500">
              Invite people to join HealthPassport Emergency QR with your code.
            </p>
          </div>

          <div className={cardClass}>
            {!user?.emailVerified ? (
              <p className="text-sm text-amber-800">
                Verify your email to access your referral code.
              </p>
            ) : referralLoading ? (
              <p className="text-sm text-slate-500">
                Loading your referral details…
              </p>
            ) : referral ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-sm font-semibold text-slate-600">
                    Your referral code
                  </p>

                  <p className="mt-2 break-all font-mono text-2xl font-extrabold tracking-widest text-[#185abc]">
                    {referral.code}
                  </p>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
  type="button"
  onClick={() => void copyReferralCode()}
  className={linkClass}
  style={{ color: "#ffffff" }}
>
  Copy code
</button>

                    <button
                      type="button"
                      onClick={() => void copyReferralLink()}
                      className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      <Icon name="link" size={17} />
                      Copy link
                    </button>

                    <button
                      type="button"
                      onClick={() => void shareReferralCode()}
                      className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      <Icon name="share" size={17} />
                      Share
                    </button>
                  </div>

                  {copyMessage && (
                    <p role="status" className="mt-2 text-sm text-slate-600">
                      {copyMessage}
                    </p>
                  )}
                </div>

                <div className="rounded-xl bg-blue-50 p-4">
                  <p className="text-sm font-semibold text-slate-600">
                    Verified referrals
                  </p>

                  <p className="mt-2 text-4xl font-extrabold text-[#185abc]">
                    {referral.verifiedReferrals}
                  </p>

                  {referral.verifiedReferrals === 0 ? (
                    <div className="mt-3 rounded-lg border border-blue-100 bg-white p-3">
                      <p className="text-sm font-semibold text-[#142d50]">
                        Your referral journey starts here!
                      </p>

                      <p className="mt-1 text-sm leading-5 text-slate-600">
                        You haven't referred anyone yet. Share your referral
                        code with friends and family to invite them to
                        HealthPassport Emergency QR. Your verified referrals
                        will appear here once they join successfully.
                      </p>
                    </div>
                  ) : (
                    <p className="mt-1 text-sm leading-5 text-slate-600">
                      Counts accounts whose referral attribution has been
                      verified. Pending registrations are not counted.
                    </p>
                  )}
                </div>
              </div>
            ) : referralLoadFailed ? (
              <div>
                <p className="text-sm text-slate-600">
                  We couldn't load your referral details right now. Please
                  check your connection and try again.
                </p>

                <button
                  type="button"
                  onClick={() => void loadReferralSummary()}
                  className={`${linkClass} mt-3`}
                >
                  Try again
                </button>
              </div>
            ) : (
              <p className="text-sm text-slate-600">
                Your referral details are not available yet.
              </p>
            )}
          </div>
        </section>

        <section className="mt-5">
          <div className="mb-3">
            <h2 className="text-lg font-bold">Quick access</h2>
            <p className="mt-0.5 text-sm text-slate-500">
              Go directly to the task you need.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Link
              to="/profile"
              className={`${cardClass} group transition hover:border-blue-200 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500`}
            >
              <div className="flex items-center gap-3">
                <SectionIcon name="user" />
                <h3 className="text-sm font-bold">Emergency profile</h3>
              </div>

              <p className="mt-3 text-sm leading-5 text-slate-600">
                Update medical details, emergency contacts and sharing settings.
              </p>

              <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-[#185abc]">
                Edit profile <Icon name="arrow" size={15} />
              </span>
            </Link>

            <Link
              to="/my-qr"
              className={`${cardClass} group transition hover:border-blue-200 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500`}
            >
              <div className="flex items-center gap-3">
                <SectionIcon name="qr" />
                <h3 className="text-sm font-bold">My Emergency QR</h3>
              </div>

              <p className="mt-3 text-sm leading-5 text-slate-600">
                Create, test, download or deactivate your personal QR.
              </p>

              <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-[#185abc]">
                Open QR <Icon name="arrow" size={15} />
              </span>
            </Link>

            <div className={cardClass}>
              <div className="flex items-center gap-3">
                <SectionIcon name="family" />
                <h3 className="text-sm font-bold">Family Emergency QRs</h3>
              </div>

              <p className="mt-3 text-sm leading-5 text-slate-600">
                Family and dependant QR management is not yet available in this
                release.
              </p>

              <span className="mt-3 inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                Planned feature
              </span>
            </div>
          </div>
        </section>

        <section className="mt-5 flex items-start gap-3 rounded-xl border border-blue-100 bg-blue-50 p-4">
          <span className="mt-0.5 text-[#185abc]">
            <Icon name="shield" size={20} />
          </span>

          <div>
            <h2 className="text-sm font-bold">
              Your information, your choice
            </h2>

            <p className="mt-1 text-xs leading-5 text-slate-600">
              Keep emergency information accurate and share only what is
              appropriate for public viewing. Self-reported information does not
              replace professional medical assessment.
            </p>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-4 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <span>HealthPassport Emergency QR</span>
          <span>
            Emergency information does not replace professional medical care.
          </span>
        </div>
      </footer>
    </div>
  );
}