
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

function ArrowIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

const steps = [
  {
    number: "01",
    title: "Create your profile",
    description:
      "Add your emergency information and choose which details can be viewed publicly.",
  },
  {
    number: "02",
    title: "Activate your QR",
    description:
      "Create your personal Emergency QR and keep it accessible when needed.",
  },
  {
    number: "03",
    title: "Make information accessible",
    description:
      "A responder can scan your active QR without installing an app or signing in.",
  },
];

export default function HomePage() {
  const { user } = useAuth();
  const primaryDestination = user ? "/dashboard" : "/register";

  return (
    <main className="min-h-screen bg-[#f7f9fd] text-[#142d50]">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-2.5 sm:px-6">
          <Link
            to="/"
            className="flex min-w-0 items-center gap-2.5"
            aria-label="HealthPassport home"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#143d75] text-lg font-extrabold text-white">
              H
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-extrabold tracking-tight">
                HealthPassport
              </span>
              <span className="block text-xs text-slate-500">
                Emergency QR
              </span>
            </span>
          </Link>

          <nav
            aria-label="Main navigation"
            className="flex shrink-0 items-center gap-2"
          >
            {user ? (
              <Link to="/dashboard" className="hp-btn-primary">
                Dashboard
              </Link>
            ) : (
              <>
                <Link to="/login" className="hp-btn-secondary">
                  Log in
                </Link>
                <Link to="/register" className="hp-btn-primary">
                  Register
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      <section className="relative overflow-hidden">
        <div
          className="pointer-events-none absolute -right-24 -top-28 h-80 w-80 rounded-full bg-blue-100/60 blur-3xl"
          aria-hidden="true"
        />

        <div className="relative mx-auto grid max-w-7xl items-center gap-8 px-4 py-8 sm:px-6 sm:py-10 lg:grid-cols-[1.1fr_0.9fr] lg:gap-12 lg:py-14">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-[#185abc]">
              <ShieldIcon />
              Emergency identification
            </div>

            <h1 className="max-w-2xl text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl lg:text-5xl">
              Your medical information.
              <span className="mt-1 block text-[#185abc]">
                Available when it matters.
              </span>
            </h1>

            <p className="mt-4 max-w-xl text-sm leading-6 text-slate-600 sm:text-base sm:leading-7">
              Create a personal Emergency QR that gives responders
              access to essential medical details and emergency
              contacts you choose to share.
            </p>

            <div className="mt-5 flex flex-col gap-2.5 sm:flex-row">
              <Link
                to={primaryDestination}
                className="hp-btn-primary gap-2"
              >
                {user ? "Open dashboard" : "Get started"}
                <ArrowIcon />
              </Link>

              {!user && (
                <Link to="/login" className="hp-btn-secondary">
                  Already registered? Log in
                </Link>
              )}
            </div>

            <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-xs font-medium text-slate-600 sm:text-sm">
              <span className="inline-flex items-center gap-2">
                <span className="text-emerald-600">✓</span>
                No app required for responders
              </span>
              <span className="inline-flex items-center gap-2">
                <span className="text-emerald-600">✓</span>
                You control shared information
              </span>
            </div>
          </div>

          <div className="mx-auto w-full max-w-md">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-lg shadow-slate-200/60 sm:p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-[#185abc]">
                    Emergency readiness
                  </p>
                  <h2 className="mt-1 text-xl font-extrabold">
                    Your essential details
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Information for emergency situations
                  </p>
                </div>
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-[#185abc]">
                  <ShieldIcon />
                </span>
              </div>

              <div className="mt-4 space-y-2.5">
                {[
                  ["Medical profile", "Important health details"],
                  ["Emergency contacts", "People who can be contacted"],
                  ["Privacy controls", "Choose what is shared"],
                ].map(([title, description]) => (
                  <div
                    key={title}
                    className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-emerald-700 shadow-sm">
                      <svg
                        width="17"
                        height="17"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="m5 12 4 4L19 6" />
                      </svg>
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-bold">{title}</p>
                      <p className="text-xs leading-5 text-slate-500">
                        {description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50 p-3">
                <p className="text-sm font-bold text-[#183f75]">
                  Designed for emergencies
                </p>
                <p className="mt-1 text-xs leading-5 text-slate-600">
                  Keep important information accessible while retaining
                  control over the details you choose to disclose.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
          <div className="mb-4 max-w-2xl">
            <h2 className="text-xl font-extrabold sm:text-2xl">
              How it works
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Three simple steps to prepare your emergency profile.
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            {steps.map((step) => (
              <article
                key={step.number}
                className="rounded-xl border border-slate-200 bg-[#f9fbff] p-4"
              >
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 text-xs font-extrabold text-[#185abc]">
                  {step.number}
                </span>
                <h3 className="mt-3 text-base font-bold">
                  {step.title}
                </h3>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  {step.description}
                </p>
              </article>
            ))}
          </div>

          <div className="mt-5 flex flex-col items-start justify-between gap-3 rounded-xl bg-[#143d75] p-4 text-white sm:flex-row sm:items-center">
            <div>
              <h2 className="text-lg font-bold">
                Prepare before an emergency happens.
              </h2>
              <p className="mt-1 text-sm text-blue-100">
                Create your profile and manage your Emergency QR.
              </p>
            </div>
            <Link
              to={primaryDestination}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-bold text-[#143d75] transition hover:bg-blue-50"
            >
              {user ? "Go to dashboard" : "Create account"}
              <ArrowIcon />
            </Link>
          </div>
        </div>
      </section>

      <footer className="bg-[#f7f9fd]">
        <div className="mx-auto flex max-w-7xl flex-col gap-1 px-4 py-4 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <span>HealthPassport Emergency QR</span>
          <span>Emergency information made accessible.</span>
        </div>
      </footer>
    </main>
  );
}
