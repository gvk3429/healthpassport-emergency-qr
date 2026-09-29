
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
      width="22"
      height="22"
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
      "Add your emergency information and decide which details can be viewed publicly.",
  },
  {
    number: "02",
    title: "Activate your QR",
    description:
      "Generate your personal QR and place it on a card or another accessible item.",
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

  const primaryDestination = user
    ? "/dashboard"
    : "/register";

  return (
    <main className="min-h-screen bg-[#f7f9fd] text-slate-900">
      <header className="border-b border-slate-200/80 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <Link
            to="/"
            className="flex items-center gap-3"
            aria-label="HealthPassport home"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#143d75] text-xl font-extrabold text-white">
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

          <nav
            aria-label="Main navigation"
            className="flex items-center gap-2 sm:gap-3"
          >
            {user ? (
              <Link
                to="/dashboard"
                className="rounded-xl bg-[#185abc] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#124a9e]"
              >
                Dashboard
              </Link>
            ) : (
              <>
                <Link
                  to="/login"
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-[#183657] transition hover:bg-slate-50"
                >
                  Log in
                </Link>

                <Link
                  to="/register"
className="rounded-xl bg-[#185abc] px-4 py-2.5 text-sm font-bold !text-white shadow-sm transition hover:bg-[#124a9e] hover:!text-white"                >
                  Register
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      <section className="relative overflow-hidden">
        <div
          className="pointer-events-none absolute -right-32 -top-40 h-[500px] w-[500px] rounded-full bg-blue-100/60 blur-3xl"
          aria-hidden="true"
        />

        <div className="relative mx-auto grid max-w-7xl items-center gap-14 px-5 py-16 sm:px-8 lg:grid-cols-[1.1fr_0.9fr] lg:gap-20 lg:py-24">
          <div>
            <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-4 py-2 text-xs font-bold uppercase tracking-wide text-[#185abc]">
              <ShieldIcon />
              Emergency identification
            </div>

            <h1 className="max-w-2xl text-4xl font-extrabold leading-[1.12] tracking-tight text-[#142d50] sm:text-5xl lg:text-[3.65rem]">
              Your medical information.
              <span className="mt-2 block text-[#185abc]">
                Available when it matters.
              </span>
            </h1>

            <p className="mt-7 max-w-xl text-base leading-8 text-slate-600 sm:text-lg">
              Create a personal Emergency QR that gives
              responders access to the essential medical
              details and emergency contacts you choose
              to share.
            </p>

            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link
                to={primaryDestination}
                className="inline-flex min-h-14 items-center justify-center gap-3 rounded-xl bg-[#185abc] px-7 py-4 text-base font-bold text-white shadow-lg shadow-blue-900/10 transition hover:bg-[#124a9e] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-700"
              >
                Create your Emergency QR
                <ArrowIcon />
              </Link>

              <a
                href="#how-it-works"
                className="inline-flex min-h-14 items-center justify-center rounded-xl border border-slate-300 bg-white px-7 py-4 text-base font-semibold text-[#183657] transition hover:border-blue-300 hover:bg-blue-50"
              >
                See how it works
              </a>
            </div>

            <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-sm text-slate-600">
              <span className="flex items-center gap-2">
                <span className="font-bold text-green-700">
                  ✓
                </span>
                You control what is shared
              </span>

              <span className="flex items-center gap-2">
                <span className="font-bold text-green-700">
                  ✓
                </span>
                No scanner app required
              </span>
            </div>
          </div>

          <div className="mx-auto w-full max-w-[460px]">
            <div className="rounded-[30px] border border-blue-100 bg-white p-4 shadow-2xl shadow-[#143d75]/10 sm:p-6">
              <div className="mb-5 flex items-center justify-between gap-3">
                <span className="text-xs font-bold uppercase tracking-[0.16em] text-[#185abc]">
                  Emergency profile
                </span>

                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                  Example preview
                </span>
              </div>

              <div className="flex items-center gap-4 border-b border-slate-100 pb-6">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-2xl font-extrabold text-[#185abc]">
                  P
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Patient information
                  </p>

                  <h2 className="mt-1 text-xl font-extrabold text-[#142d50]">
                    Patient Name
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    Personal Emergency QR
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 py-6">
                <div className="rounded-2xl bg-[#f2f6fc] p-5">
                  <p className="text-xs font-medium text-slate-500">
                    Blood group
                  </p>

                  <p className="mt-2 text-2xl font-extrabold text-[#142d50]">
                    O+
                  </p>
                </div>

                <div className="rounded-2xl bg-[#f2f6fc] p-5">
                  <p className="text-xs font-medium text-slate-500">
                    Allergies
                  </p>

                  <p className="mt-2 text-xl font-extrabold text-[#142d50]">
                    None reported
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="rounded-xl bg-[#dc2635] px-5 py-4 text-center text-sm font-bold text-white">
                  Call emergency services
                </div>

                <div className="rounded-xl border border-slate-200 px-5 py-4 text-center text-sm font-semibold text-[#183657]">
                  Notify emergency contacts
                </div>

                <div className="rounded-xl border border-slate-200 px-5 py-4 text-center text-sm font-semibold text-[#183657]">
                  Share emergency location
                </div>
              </div>

              <p className="mt-5 text-center text-xs leading-5 text-slate-500">
                Illustrative preview. Contact notifications
                and location sharing are upcoming features.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section
        id="how-it-works"
        className="scroll-mt-10 border-t border-slate-200 bg-white py-16 sm:py-20"
      >
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <div className="max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#185abc]">
              Simple by design
            </p>

            <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-[#142d50] sm:text-4xl">
              How HealthPassport works
            </h2>

            <p className="mt-4 leading-7 text-slate-600">
              Three steps to make your selected emergency
              information accessible when needed.
            </p>
          </div>

          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {steps.map((step) => (
              <div
                key={step.number}
                className="rounded-2xl border border-slate-200 bg-white p-7 shadow-sm"
              >
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-sm font-extrabold text-[#185abc]">
                  {step.number}
                </span>

                <h3 className="mt-6 text-lg font-bold text-[#142d50]">
                  {step.title}
                </h3>

                <p className="mt-3 text-sm leading-7 text-slate-600">
                  {step.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-white py-7">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-3 px-5 text-sm text-slate-500 sm:flex-row sm:px-8">
          <span>
            © HealthPassport Emergency QR
          </span>

          <span>
            Emergency information does not replace
            professional medical assessment.
          </span>
        </div>
      </footer>
    </main>
  );
}