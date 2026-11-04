// src/pages/HomePage.tsx

import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import BrandLogo from "../components/BrandLogo";

function ArrowIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </svg>
  );
}

function ShieldIcon({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

const steps = [
  {
    number: "01",
    title: "Create your emergency profile",
    description:
      "Add essential personal, medical and emergency-contact information.",
  },
  {
    number: "02",
    title: "Create your QR card",
    description:
      "Generate your personal emergency QR and keep it accessible when needed.",
  },
  {
    number: "03",
    title: "Get help when it matters",
    description:
      "Someone who scans your QR can view your permitted emergency details and use the available emergency actions.",
  },
];

export default function HomePage() {
  const { user } = useAuth();
  const primaryDestination = user ? "/dashboard" : "/register";

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <BrandLogo to="/" showTagline={false} />

          <nav
            className="flex shrink-0 items-center gap-2 sm:gap-3"
            aria-label="Main navigation"
          >
            {user ? (
              <Link
                to="/dashboard"
                className="hp-btn-primary inline-flex min-h-10 items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
              >
                Dashboard
              </Link>
            ) : (
              <>
                <Link
                  to="/login"
                  className="inline-flex min-h-10 items-center justify-center rounded-lg px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 sm:px-4"
                >
                  Log in
                </Link>

                <Link
                  to="/register"
                  className="hp-btn-primary inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-white transition hover:opacity-90 sm:px-4"
                >
                  Get started
                  <ArrowIcon className="hidden h-4 w-4 sm:block" />
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="overflow-hidden bg-white">
        <div className="mx-auto grid max-w-7xl items-center gap-8 px-4 py-9 sm:px-6 sm:py-12 lg:grid-cols-2 lg:gap-12 lg:px-8 lg:py-14">
          <div className="max-w-2xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 sm:text-sm">
              <ShieldIcon className="h-4 w-4" />
              Emergency information, within reach
            </div>

            <h1 className="text-3xl font-bold leading-tight tracking-tight text-slate-950 sm:text-4xl lg:text-5xl">
              A simple QR code.
              <span className="mt-1 block text-blue-700">
                A safer way to get help.
              </span>
            </h1>

            <p className="mt-4 max-w-xl text-base leading-7 text-slate-600 sm:text-lg">
              SafehealthQR helps you make essential emergency information
              accessible through a personal QR code, so a person assisting you
              can quickly find the information you choose to share.
            </p>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Link
                to={primaryDestination}
                className="hp-btn-primary inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 sm:text-base"
              >
                {user ? "Go to dashboard" : "Create your emergency QR"}
                <ArrowIcon className="h-5 w-5" />
              </Link>

              {!user && (
                <Link
                  to="/login"
                  className="hp-btn-secondary inline-flex min-h-12 items-center justify-center rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 sm:text-base"
                >
                  Already registered? Log in
                </Link>
              )}
            </div>

            <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-600">
              <span className="inline-flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                Personal emergency profile
              </span>
              <span className="inline-flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                Emergency contacts
              </span>
              <span className="inline-flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                QR-based access
              </span>
            </div>
          </div>

          {/* Emergency readiness card */}
          <div className="mx-auto w-full max-w-lg lg:ml-auto">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm sm:p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-700">
                    SafehealthQR
                  </p>
                  <h2 className="mt-1 text-xl font-bold text-slate-900 sm:text-2xl">
                    Emergency readiness
                  </h2>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    Keep essential information ready when every moment counts.
                  </p>
                </div>

                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-700">
                  <ShieldIcon className="h-6 w-6" />
                </div>
              </div>

              <div className="mt-4 space-y-3">
                <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
                    <svg
                      className="h-5 w-5"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <circle cx="12" cy="8" r="4" />
                      <path d="M5 21v-2a7 7 0 0 1 14 0v2" />
                    </svg>
                  </div>

                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-slate-900">
                      Emergency profile
                    </h3>
                    <p className="mt-0.5 text-sm leading-5 text-slate-600">
                      Share important personal and medical details.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                    <svg
                      className="h-5 w-5"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <rect x="3" y="4" width="18" height="16" rx="2" />
                      <path d="m3 6 9 7 9-7" />
                    </svg>
                  </div>

                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-slate-900">
                      Emergency contacts
                    </h3>
                    <p className="mt-0.5 text-sm leading-5 text-slate-600">
                      Keep contact information available for assistance.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-50 text-violet-700">
                    <svg
                      className="h-5 w-5"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <rect x="3" y="3" width="6" height="6" rx="1" />
                      <rect x="15" y="3" width="6" height="6" rx="1" />
                      <rect x="3" y="15" width="6" height="6" rx="1" />
                      <path d="M15 15h2v2h-2zM19 15h2M15 19v2M19 19h2v2h-2z" />
                    </svg>
                  </div>

                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-slate-900">
                      Personal emergency QR
                    </h3>
                    <p className="mt-0.5 text-sm leading-5 text-slate-600">
                      Make your emergency profile accessible by scanning your
                      QR code.
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3">
                <p className="text-sm font-semibold text-blue-950">
                  Be prepared. Help others help you.
                </p>
                <p className="mt-1 text-xs leading-5 text-blue-800">
                  Keep your information accurate and review what is shared on
                  your public emergency page.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-7xl px-4 py-9 sm:px-6 sm:py-11 lg:px-8">
        <div className="mb-5 flex flex-col gap-2 sm:mb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-700">
              How it works
            </p>
            <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
              Three simple steps
            </h2>
          </div>

          <p className="max-w-xl text-sm leading-6 text-slate-600 sm:text-base">
            Set up your profile once and keep your emergency QR available when
            you need it.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
          {steps.map((step) => (
            <article
              key={step.number}
              className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-sm font-bold text-blue-700">
                {step.number}
              </div>

              <h3 className="mt-3 text-base font-bold text-slate-900">
                {step.title}
              </h3>

              <p className="mt-1.5 text-sm leading-6 text-slate-600">
                {step.description}
              </p>
            </article>
          ))}
        </div>
      </section>

      {/* Call to action */}
      <section className="mx-auto max-w-7xl px-4 pb-9 sm:px-6 sm:pb-11 lg:px-8">
        <div className="flex flex-col gap-4 rounded-2xl bg-slate-900 px-5 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-7 sm:py-7">
          <div className="max-w-2xl">
            <h2 className="text-xl font-bold text-white sm:text-2xl">
              Take a simple step towards emergency preparedness.
            </h2>
            <p className="mt-1.5 text-sm leading-6 text-slate-300">
              Create your profile, add your emergency contacts and prepare your
              personal QR code.
            </p>
          </div>

          <Link
            to={primaryDestination}
            className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-bold text-slate-900 transition hover:bg-slate-100"
          >
            {user ? "Open dashboard" : "Get started"}
            <ArrowIcon className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-4 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <p>
            © {new Date().getFullYear()} SafehealthQR. All rights reserved.
          </p>

          <p className="text-xs leading-5 sm:text-right">
            Emergency information can assist responders and bystanders but does
            not replace professional medical care or emergency services.
          </p>
        </div>
      </footer>
    </main>
  );
}