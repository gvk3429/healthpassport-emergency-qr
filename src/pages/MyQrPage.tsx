// File: src/pages/MyQrPage.tsx

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { Link } from "react-router-dom";
import { QRCodeCanvas } from "qrcode.react";

import { useAuth } from "../auth/AuthContext";

import { getEmergencyProfile } from "../repositories/emergencyProfileRepository";


import {
  createPersonalEmergencyQr,
  getPersonalEmergencyQr,
  deletePersonalEmergencyQr,
} from "../repositories/emergencyQrRepository";

import {
  activateEmergencyQr,
  deactivateEmergencyQr,
} from "../services/emergencyQrFunctions";

import type {
  EmergencyProfile,
} from "../types/emergencyProfile";

import type {
  EmergencyQr,
} from "../types/emergencyQr";

type TemplateId =
  | "pulse"
  | "neo"
  | "street"
  | "active"
  | "essential"
  | "executive"
  | "corporate"
  | "travel"
  | "classic"
  | "senior-care"
  | "family-care"
  | "high-visibility";

type PrintSizeId =
  | "wallet"
  | "credit-card"
  | "id-badge"
  | "keychain"
  | "sticker"
  | "large-card";

type Orientation = "landscape" | "portrait";

interface EmergencyTemplate {
  id: TemplateId;
  name: string;
  category: string;
  headline: string;
  description: string;
  background: string;
  foreground: string;
  accent: string;
  headlineSize: number;
  bodySize: number;
}

interface PrintSize {
  id: PrintSizeId;
  name: string;
  width: number;
  height: number;
  description: string;
  minimumQr: number;
}

const DEFAULT_HEADLINE =
  "IF I NEED HELP, PLEASE SCAN";

const DEFAULT_MESSAGE =
  "Scan this QR to access my emergency information.";

const SENIOR_HEADLINE = "PLEASE HELP ME";



const MAX_HEADLINE_LENGTH = 65;
const MAX_MESSAGE_LENGTH = 180;

const TEMPLATES: EmergencyTemplate[] = [
  {
    id: "pulse",
    name: "Pulse",
    category: "Youth",
    headline: DEFAULT_HEADLINE,
    description: "Modern and energetic",
    background: "#101827",
    foreground: "#ffffff",
    accent: "#45e3b5",
    headlineSize: 22,
    bodySize: 12,
  },
  {
    id: "neo",
    name: "Neo",
    category: "Youth",
    headline: DEFAULT_HEADLINE,
    description: "Contemporary and minimal",
    background: "#e9f4ff",
    foreground: "#102a56",
    accent: "#1671e8",
    headlineSize: 22,
    bodySize: 12,
  },
  {
    id: "street",
    name: "Street",
    category: "Youth",
    headline: DEFAULT_HEADLINE,
    description: "Bold and expressive",
    background: "#171717",
    foreground: "#ffffff",
    accent: "#ffca28",
    headlineSize: 22,
    bodySize: 12,
  },
  {
    id: "active",
    name: "Active",
    category: "Youth",
    headline: "SCAN IF I NEED HELP",
    description: "For sports and outdoor use",
    background: "#073b32",
    foreground: "#ffffff",
    accent: "#b9f45b",
    headlineSize: 22,
    bodySize: 12,
  },
  {
    id: "essential",
    name: "Essential",
    category: "Professional",
    headline: DEFAULT_HEADLINE,
    description: "Clean professional styling",
    background: "#ffffff",
    foreground: "#142d50",
    accent: "#185abc",
    headlineSize: 20,
    bodySize: 11,
  },
  {
    id: "executive",
    name: "Executive",
    category: "Professional",
    headline: "EMERGENCY INFORMATION",
    description: "Understated and premium",
    background: "#182235",
    foreground: "#ffffff",
    accent: "#d9c49a",
    headlineSize: 19,
    bodySize: 11,
  },
  {
    id: "corporate",
    name: "Corporate",
    category: "Professional",
    headline: "IN CASE OF EMERGENCY",
    description: "Suitable for ID cards",
    background: "#edf3fb",
    foreground: "#142d50",
    accent: "#185abc",
    headlineSize: 19,
    bodySize: 11,
  },
  {
    id: "travel",
    name: "Travel",
    category: "Professional",
    headline: "EMERGENCY? SCAN HERE",
    description: "For travel and luggage",
    background: "#ffffff",
    foreground: "#17324d",
    accent: "#008b8b",
    headlineSize: 20,
    bodySize: 11,
  },
  {
    id: "classic",
    name: "Classic",
    category: "Senior",
    headline: SENIOR_HEADLINE,
    description: "Traditional and clear",
    background: "#fffdf6",
    foreground: "#202020",
    accent: "#8a382c",
    headlineSize: 22,
    bodySize: 13,
  },
  {
    id: "senior-care",
    name: "Senior Care",
    category: "Senior",
    headline: SENIOR_HEADLINE,
    description: "Large text and high contrast",
    background: "#ffffff",
    foreground: "#111827",
    accent: "#b42318",
    headlineSize: 25,
    bodySize: 14,
  },
  {
    id: "family-care",
    name: "Family Care",
    category: "Family",
    headline: "PLEASE SCAN TO HELP ME",
    description: "Friendly and reassuring",
    background: "#fff7ed",
    foreground: "#492b20",
    accent: "#c2410c",
    headlineSize: 21,
    bodySize: 12,
  },
  {
    id: "high-visibility",
    name: "High Visibility",
    category: "High visibility",
    headline: "MEDICAL EMERGENCY?",
    description: "Prominent emergency message",
    background: "#ffffff",
    foreground: "#111111",
    accent: "#c1121f",
    headlineSize: 24,
    bodySize: 13,
  },
];

const PRINT_SIZES: PrintSize[] = [
  {
    id: "wallet",
    name: "Mini Wallet Card",
    width: 54,
    height: 86,
    description: "54 × 86 mm",
    minimumQr: 25,
  },
  {
    id: "credit-card",
    name: "Credit Card",
    width: 85.6,
    height: 54,
    description: "85.6 × 54 mm",
    minimumQr: 25,
  },
  {
    id: "id-badge",
    name: "ID Badge",
    width: 54,
    height: 86,
    description: "54 × 86 mm",
    minimumQr: 25,
  },
  {
    id: "keychain",
    name: "Keychain Tag",
    width: 35,
    height: 35,
    description: "35 × 35 mm",
    minimumQr: 21,
  },
  {
    id: "sticker",
    name: "Sticker",
    width: 50,
    height: 50,
    description: "50 × 50 mm",
    minimumQr: 25,
  },
  {
    id: "large-card",
    name: "Large Emergency Card",
    width: 90,
    height: 140,
    description: "90 × 140 mm",
    minimumQr: 30,
  },
];

const MESSAGE_PRESETS = [
  {
    name: "Personal Safety",
    headline: "IF I NEED HELP, PLEASE SCAN",
    message:
      "Scan this QR to access my emergency information.",
  },
  {
    name: "Senior Citizen",
    headline: "PLEASE HELP ME",
    message:
      "Scan to view my emergency information and contact my family.",
  },
  {
    name: "Medical Emergency",
    headline: "MEDICAL EMERGENCY? SCAN HERE",
    message:
      "Scan to view my medical information and emergency contacts.",
  },
  {
    name: "Universal",
    headline: "IN CASE OF EMERGENCY",
    message:
      "Scan to view my emergency information.",
  },
  {
    name: "Family Contact",
    headline: "PLEASE SCAN TO HELP ME",
    message:
      "Scan to view my emergency details and available family contacts.",
  },
];

function errorMessage(
  error: unknown,
  fallback: string
): string {
  return error instanceof Error
    ? error.message
    : fallback;
}



function getTemplate(
  id: TemplateId
): EmergencyTemplate {
  return (
    TEMPLATES.find((item) => item.id === id) ??
    TEMPLATES[4]
  );
}

function getPrintSize(
  id: PrintSizeId
): PrintSize {
  return (
    PRINT_SIZES.find((item) => item.id === id) ??
    PRINT_SIZES[1]
  );
}

export default function MyQrPage() {
  const { user } = useAuth();
  const uid = user?.uid;

  const qrContainerRef =
    useRef<HTMLDivElement>(null);

  const printStyleRef =
    useRef<HTMLStyleElement | null>(null);

  const [profile, setProfile] =
    useState<EmergencyProfile | null>(null);

  const [qr, setQr] =
    useState<EmergencyQr | null>(null);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [templateId, setTemplateId] =
    useState<TemplateId>("essential");

  const [sizeId, setSizeId] =
    useState<PrintSizeId>("credit-card");

  const [orientation, setOrientation] =
    useState<Orientation>("landscape");

  const [messageMode, setMessageMode] =
    useState<"preset" | "custom" | "template">(
      "preset"
    );

  const [selectedPreset, setSelectedPreset] =
    useState("Personal Safety");

  const [headline, setHeadline] =
    useState(DEFAULT_HEADLINE);

  const [supportingMessage, setSupportingMessage] =
    useState(DEFAULT_MESSAGE);

  const load = useCallback(async () => {
    if (!uid) return;

    const [savedProfile, savedQr] =
      await Promise.all([
        getEmergencyProfile(uid),
        getPersonalEmergencyQr(uid),
      ]);

    setProfile(savedProfile);
    setQr(savedQr);
  }, [uid]);

  useEffect(() => {
  if (!uid) {
    return;
  }

    let cancelled = false;

    async function initialLoad() {
      setLoading(true);
      setError("");

      try {
        const [savedProfile, savedQr] =
          await Promise.all([
            getEmergencyProfile(uid!),
            getPersonalEmergencyQr(uid!),
          ]);

        if (!cancelled) {
          setProfile(savedProfile);
          setQr(savedQr);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            errorMessage(
              err,
              "Unable to load your Emergency QR."
            )
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void initialLoad();

    return () => {
      cancelled = true;
    };
  }, [uid]);

  useEffect(() => {
    return () => {
      printStyleRef.current?.remove();
    };
  }, []);

  async function performAction(
    action: () => Promise<unknown>,
    successMessage: string
  ) {
    if (busy) return;

    setBusy(true);
    setError("");
    setMessage("");

    try {
      await action();
      await load();
      setMessage(successMessage);
    } catch (err) {
      setError(
        errorMessage(
          err,
          "The operation could not be completed."
        )
      );
    } finally {
      setBusy(false);
    }
  }

  function handleCreate() {
    if (!uid || !profile || busy) return;

    void performAction(
      () => createPersonalEmergencyQr(uid),
      "Your Emergency QR draft has been created."
    );
  }

  function handleActivate() {
    if (!qr || !profile || busy) return;

    if (!profile.consentGiven) {
      setError(
        "You must give emergency-profile consent before activation."
      );
      return;
    }

    void performAction(
      activateEmergencyQr,
      "Your Emergency QR is now active."
    );
  }

  function handleDeactivate() {
    if (
      !qr ||
      qr.status !== "ACTIVE" ||
      busy
    ) {
      return;
    }

    if (
      !window.confirm(
        "Deactivate this QR?\n\n" +
          "Its public emergency information will become " +
          "unavailable until you reactivate it."
      )
    ) {
      return;
    }

    void performAction(
      deactivateEmergencyQr,
      "Your Emergency QR has been deactivated."
    );
  }

  function handleDelete() {
    if (!uid || !qr || busy) return;

    if (qr.status === "ACTIVE") {
      setError(
        "Deactivate your QR before deleting it."
      );
      return;
    }

    if (qr.status === "DRAFT") {
      if (
        !window.confirm(
          "Permanently delete this draft QR? This cannot be undone."
        )
      ) {
        return;
      }

      void performAction(
        () => deletePersonalEmergencyQr(uid),
        "Your draft QR has been deleted."
      );

      return;
    }

    if (qr.status === "INACTIVE") {
      const confirmed = window.confirm(
        "PERMANENTLY DELETE THIS QR?\n\n" +
          "Its identifier will be retired permanently. " +
          "Previously printed copies will stop working.\n\n" +
          "Continue?"
      );

      if (!confirmed) return;

      if (
        !window.confirm(
          "Final confirmation: delete this inactive QR permanently?"
        )
      ) {
        return;
      }

      void performAction(
        () => deletePersonalEmergencyQr(uid),
        "Your QR has been permanently deleted."
      );
    }
  }

  const qrUrl = qr
    ? `${window.location.origin}${
        import.meta.env.BASE_URL
      }#/e/${encodeURIComponent(qr.id)}`
    : "";

  const template = getTemplate(templateId);
  const printSize = getPrintSize(sizeId);

  const cardWidth =
    orientation === "landscape"
      ? printSize.width
      : printSize.height;

  const cardHeight =
    orientation === "landscape"
      ? printSize.height
      : printSize.width;

  const isSmallFormat =
    sizeId === "keychain" ||
    sizeId === "sticker";

  const headlineTooLong =
    headline.trim().length === 0 ||
    headline.length > MAX_HEADLINE_LENGTH;

  const messageTooLong =
    supportingMessage.length > MAX_MESSAGE_LENGTH;

  const canPrint =
    Boolean(qr) &&
    qr?.status === "ACTIVE" &&
    !headlineTooLong &&
    !messageTooLong;

  const recommendedQrSize = Math.min(
    100,
    Math.max(
      printSize.minimumQr,
      Math.min(cardWidth, cardHeight) * 0.52
    )
  );

  async function handleDownloadPng() {
    const canvas =
      qrContainerRef.current?.querySelector(
        "canvas"
      );

    if (!canvas || !qr) {
      setError("The QR image is unavailable.");
      return;
    }

    try {
      const exportCanvas =
        document.createElement("canvas");

      const scale = 3;
      const padding = 32;

      const width =
        canvas.width + padding * 2;

      const height =
        canvas.height + padding * 2;

      exportCanvas.width = width * scale;
      exportCanvas.height = height * scale;

      const context =
        exportCanvas.getContext("2d");

      if (!context) {
        throw new Error(
          "Unable to prepare the PNG image."
        );
      }

      context.scale(scale, scale);
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, width, height);

      context.drawImage(
        canvas,
        padding,
        padding
      );

      const anchor =
        document.createElement("a");

      anchor.download =
        "healthpassport-emergency-qr.png";

      anchor.href =
        exportCanvas.toDataURL("image/png");

      anchor.click();
    } catch (err) {
      setError(
        errorMessage(
          err,
          "Unable to download your QR."
        )
      );
    }
  }

  function handlePrint() {
    if (!qr) {
      setError("Create your QR before printing.");
      return;
    }

    if (qr.status !== "ACTIVE") {
      setError(
        "Activate your QR before printing an emergency card for use."
      );
      return;
    }

    if (headlineTooLong || messageTooLong) {
      setError(
        "Correct the emergency message before printing."
      );
      return;
    }

    const printStyle =
      document.createElement("style");

    printStyle.id = "hp-emergency-qr-print-style";

    printStyle.textContent = `
      @page {
        size: ${cardWidth}mm ${cardHeight}mm;
        margin: 0;
      }

      @media print {
        body * {
          visibility: hidden !important;
        }

        #hp-emergency-print-card,
        #hp-emergency-print-card * {
          visibility: visible !important;
        }

        #hp-emergency-print-card {
          position: fixed !important;
          inset: 0 auto auto 0 !important;
          width: ${cardWidth}mm !important;
          height: ${cardHeight}mm !important;
          margin: 0 !important;
          padding: 3mm !important;
          border: none !important;
          border-radius: 0 !important;
          box-shadow: none !important;
          overflow: hidden !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }

        #hp-emergency-print-card .hp-print-headline {
          font-size: ${Math.max(
            7,
            Math.min(
              template.headlineSize * cardWidth / 85.6,
              isSmallFormat ? 10 : 18
            )
          )}pt !important;
        }

        #hp-emergency-print-card .hp-print-message {
          font-size: ${Math.max(
            6,
            Math.min(
              template.bodySize * cardWidth / 85.6,
              isSmallFormat ? 7 : 11
            )
          )}pt !important;
        }

        #hp-emergency-print-card .hp-print-qr {
          width: ${recommendedQrSize}mm !important;
          height: ${recommendedQrSize}mm !important;
        }

        #hp-emergency-print-card .hp-print-qr canvas {
          width: 100% !important;
          height: 100% !important;
        }

        #hp-emergency-print-card .hp-print-name {
          font-size: ${isSmallFormat ? 7 : 10}pt !important;
        }

        #hp-emergency-print-card .hp-print-brand {
          font-size: 6pt !important;
        }
      }
    `;

    document
      .getElementById("hp-emergency-qr-print-style")
      ?.remove();

    document.head.appendChild(printStyle);
    printStyleRef.current = printStyle;

    const cleanup = () => {
      printStyle.remove();
      if (printStyleRef.current === printStyle) {
        printStyleRef.current = null;
      }
      window.removeEventListener(
        "afterprint",
        cleanup
      );
    };

    window.addEventListener(
      "afterprint",
      cleanup
    );

    window.print();

    window.setTimeout(cleanup, 3000);
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        Loading your Emergency QR...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto max-w-7xl">
        <Link
          to="/dashboard"
          className="text-sm font-semibold text-blue-700"
        >
          ← Back to Dashboard
        </Link>

        <header className="mb-8 mt-6">
          <h1 className="text-3xl font-bold text-slate-900">
            My Emergency QR
          </h1>

          <p className="mt-2 text-slate-600">
            Manage your emergency QR, customise its design
            and prepare it for printing.
          </p>
        </header>

        {error && (
          <div
            role="alert"
            className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-red-800"
          >
            {error}
          </div>
        )}

        {message && (
          <div
            role="status"
            className="mb-6 rounded-xl border border-green-200 bg-green-50 p-4 text-green-800"
          >
            {message}
          </div>
        )}

        {!profile ? (
          <section className="rounded-2xl border bg-white p-8 shadow-sm">
            <h2 className="text-xl font-bold">
              Create your emergency profile
            </h2>

            <p className="mt-3 text-slate-600">
              Complete your emergency information before
              creating a QR.</p>

            <Link
              to="/profile"
              className="mt-6 inline-flex rounded-lg bg-blue-700 px-5 py-3 font-semibold text-white"
            >
              Create Emergency Profile
            </Link>
          </section>
        ) : (
          <>
            <div className="grid items-stretch gap-5 lg:grid-cols-2">
              <section className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                <h2 className="text-xl font-bold text-slate-900">
                  Emergency profile
                </h2>

                <div className="mt-5 flex items-center gap-4 rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-blue-50 p-4">
                  {profile.photoUrl ? (
                    <img
                      src={profile.photoUrl}
                      alt={`${profile.fullName} profile`}
                      loading="eager"
                      referrerPolicy="no-referrer"
                      onError={(event) => { event.currentTarget.style.display = "none"; }}
                      className="h-20 w-20 shrink-0 rounded-2xl border-2 border-white object-cover shadow-sm"
                    />
                  ) : (
                    <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-blue-100 text-3xl font-bold text-blue-800">
                      {profile.fullName.trim().charAt(0).toUpperCase() || "?"}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-xs font-bold uppercase tracking-wider text-blue-700">
                      HealthPassport Emergency QR
                    </p>
                    <h3 className="mt-1 break-words text-xl font-bold text-slate-900">
                      {profile.fullName}
                    </h3>
                    <p className="mt-1 text-sm text-slate-600">
                      Emergency profile
                    </p>
                  </div>
                </div>

                <dl className="mt-4 grid grid-cols-2 gap-2.5">
                  <div className="rounded-xl border border-slate-200 bg-white p-3">
                    <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Date of birth</dt>
                    <dd className="mt-1 break-words text-sm font-semibold text-slate-900">{profile.dateOfBirth || "Not provided"}</dd>
                  </div>
                  <div className="rounded-xl border border-rose-100 bg-rose-50/70 p-3">
                    <dt className="text-[11px] font-semibold uppercase tracking-wide text-rose-700">Blood group</dt>
                    <dd className="mt-1 text-sm font-bold text-rose-900">{profile.bloodGroup || "Unknown"}</dd>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Emergency contacts</dt>
                    <dd className="mt-1 text-sm font-semibold text-slate-900">{profile.emergencyContacts.length} registered</dd>
                    {profile.emergencyContacts.find((contact) => contact.isPrimary) && (
                      <p className="mt-1 truncate text-xs text-slate-600">Primary: {profile.emergencyContacts.find((contact) => contact.isPrimary)?.name}</p>
                    )}
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Profile consent</dt>
                    <dd className={profile.consentGiven ? "mt-1 text-sm font-bold text-emerald-700" : "mt-1 text-sm font-bold text-red-700"}>
                      {profile.consentGiven ? "Granted" : "Not granted"}
                    </dd>
                  </div>
                  {profile.homeAddress?.trim() && (
                    <div className="col-span-2 rounded-xl border border-indigo-100 bg-indigo-50/70 p-3">
                      <dt className="text-[11px] font-semibold uppercase tracking-wide text-indigo-800">Home address · private summary</dt>
                      <dd className="mt-1 text-sm leading-5 text-slate-800">{profile.homeAddress}</dd>
                    </div>
                  )}
                  <div className="rounded-xl border border-amber-100 bg-amber-50/70 p-3">
                    <dt className="text-[11px] font-semibold uppercase tracking-wide text-amber-800">Allergies</dt>
                    <dd className="mt-1 text-sm leading-5 text-slate-800">{profile.allergies.length ? profile.allergies.join(", ") : "None recorded"}</dd>
                  </div>
                  <div className="rounded-xl border border-orange-100 bg-orange-50/70 p-3">
                    <dt className="text-[11px] font-semibold uppercase tracking-wide text-orange-800">Medical conditions</dt>
                    <dd className="mt-1 text-sm leading-5 text-slate-800">{profile.medicalConditions.length ? profile.medicalConditions.join(", ") : "None recorded"}</dd>
                  </div>
                  <div className="rounded-xl border border-teal-100 bg-teal-50/70 p-3">
                    <dt className="text-[11px] font-semibold uppercase tracking-wide text-teal-800">Current medications</dt>
                    <dd className="mt-1 text-sm leading-5 text-slate-800">{profile.medications.length ? profile.medications.join(", ") : "None recorded"}</dd>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Emergency instructions</dt>
                    <dd className="mt-1 line-clamp-3 text-sm leading-5 text-slate-800">{profile.emergencyInstructions?.trim() || "No special instructions added"}</dd>
                  </div>
                </dl>

                <Link
                  to="/profile"
                  className="mt-4 inline-flex self-start rounded-lg border border-blue-700 px-4 py-2.5 text-sm font-semibold text-blue-700 transition hover:bg-blue-50"
                >
                  Edit Emergency Profile
                </Link>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                <h2 className="text-xl font-bold">
                  Personal QR
                </h2>

                {!qr ? (
                  <>
                    <p className="mt-3 text-slate-600">
                      Create your personal QR. It remains
                      private until activated.
                    </p>

                    <button
                      type="button"
                      onClick={handleCreate}
                      disabled={busy}
                      className="mt-6 rounded-lg bg-blue-700 px-5 py-3 font-semibold text-white disabled:opacity-50"
                    >
                      {busy
                        ? "Creating..."
                        : "Create My QR"}
                    </button>
                  </>
                ) : (
                  <>
                    <div className="mt-4">
                      <span
                        className={
                          qr.status === "ACTIVE"
                            ? "rounded-full bg-green-100 px-3 py-1 text-sm font-semibold text-green-800"
                            : qr.status === "INACTIVE"
                              ? "rounded-full bg-amber-100 px-3 py-1 text-sm font-semibold text-amber-800"
                              : "rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-800"
                        }
                      >
                        {qr.status}
                      </span>
                    </div>

                    <div
                      ref={qrContainerRef}
                      className="mt-5 inline-flex rounded-xl border bg-white p-4"
                    >
                      <QRCodeCanvas
                        value={qrUrl}
                        size={240}
                        level="H"
                        marginSize={4}
                        title="HealthPassport Emergency QR"
                      />
                    </div>

                    <p className="mt-4 break-all text-xs text-slate-500">
                      {qrUrl}
                    </p>

                    {qr.status !== "ACTIVE" ? (
                      <>
                        <p className="mt-5 rounded-lg bg-amber-50 p-4 text-sm text-amber-900">
                          This QR is not active. Do not use
                          it as an emergency identifier yet.
                        </p>

                        <button
                          type="button"
                          onClick={handleActivate}
                          disabled={
                            busy || !profile.consentGiven
                          }
                          className="mt-5 rounded-lg bg-green-700 px-5 py-3 font-semibold text-white disabled:opacity-50"
                        >
                          {busy
                            ? "Processing..."
                            : "Activate Emergency QR"}
                        </button>

                        {qr.status === "DRAFT" && (
                          <button
                            type="button"
                            onClick={handleDelete}
                            disabled={busy}
                            className="mt-4 block rounded-lg border border-red-300 px-5 py-3 font-semibold text-red-700 disabled:opacity-50"
                          >
                            Delete Draft
                          </button>
                        )}

                        {qr.status === "INACTIVE" && (
                          <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-5">
                            <h3 className="font-bold text-red-900">
                              Permanently delete QR
                            </h3>

                            <p className="mt-2 text-sm text-red-800">
                              Deleting this QR retires its
                              identifier. Previously printed
                              copies will stop working.
                            </p>

                            <button
                              type="button"
                              onClick={handleDelete}
                              disabled={busy}
                              className="mt-4 rounded-lg bg-red-700 px-5 py-3 font-semibold text-white disabled:opacity-50"
                            >
                              Delete QR Permanently
                            </button>
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        <p className="mt-5 rounded-lg bg-green-50 p-4 text-sm text-green-900">
                          Your QR is active. Its approved
                          emergency information can be viewed
                          by anyone who scans it.
                        </p>

                        <button
                          type="button"
                          onClick={handleDeactivate}
                          disabled={busy}
                          className="mt-5 rounded-lg border border-red-300 px-5 py-3 font-semibold text-red-700 disabled:opacity-50"
                        >
                          {busy
                            ? "Processing..."
                            : "Deactivate QR"}
                        </button>

                        <p className="mt-3 text-sm text-slate-500">
                          To permanently delete this QR,
                          deactivate it first.
                        </p>
                      </>
                    )}
                  </>
                )}
              </section>
            </div>

            {qr && (
              <section className="mt-8 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_12px_40px_rgba(15,23,42,0.07)]">
                <div className="border-b border-slate-200 bg-gradient-to-r from-slate-950 via-blue-950 to-indigo-950 px-6 py-7 text-white sm:px-8">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-300">HealthPassport · Personal safety</p>
                      <h2 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">Emergency QR Design &amp; Print</h2>
                      <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
                        Create a clear, attractive emergency card. Choose a style, select a message and check the print preview before downloading.
                      </p>
                    </div>
                    <span className={"inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold " + (qr.status === "ACTIVE" ? "bg-emerald-400/15 text-emerald-200 ring-1 ring-emerald-300/30" : "bg-amber-300/15 text-amber-100 ring-1 ring-amber-200/30")}>
                      <span className={"h-2 w-2 rounded-full " + (qr.status === "ACTIVE" ? "bg-emerald-300" : "bg-amber-300")} />
                      QR {qr.status}
                    </span>
                  </div>
                </div>

                {qr.status !== "ACTIVE" && (
                  <div className="mx-6 mt-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-5 text-amber-900 sm:mx-8">
                    Activate your QR before printing it for emergency use. You can still customise and review the design.
                  </div>
                )}

                <div className="grid items-start gap-6 p-5 sm:p-7 xl:grid-cols-[minmax(0,1.08fr)_minmax(360px,0.92fr)]">
                  <div className="min-w-0 space-y-6">
                    <section className="rounded-2xl border border-slate-200 p-5">
                      <div className="mb-4 flex items-center gap-3">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-700 text-sm font-bold text-white">1</span>
                        <div>
                          <h3 className="text-base font-bold text-slate-900">Choose your card style</h3>
                          <p className="mt-0.5 text-sm text-slate-500">Five polished designs. Select one to preview it.</p>
                        </div>
                      </div>

                      <div
                        role="group"
                        aria-label="Choose QR card design"
                        className="grid grid-cols-1 gap-2.5 sm:grid-cols-2"
                      >
                        {(["pulse", "neo", "classic", "executive", "family-care"] as TemplateId[]).map((id) => {
                          const item = getTemplate(id);
                          const selected = templateId === item.id;
                          return (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => setTemplateId(item.id)}
                              aria-pressed={selected}
                              className={
                                "group relative flex min-h-[88px] min-w-0 items-center gap-3 overflow-hidden rounded-xl border p-3 text-left transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 " +
                                (selected
                                  ? "border-blue-600 bg-blue-50/70 ring-2 ring-blue-100 shadow-sm"
                                  : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 hover:shadow-sm")
                              }
                            >
                              <span
                                aria-hidden="true"
                                className="absolute inset-y-0 left-0 w-1"
                                style={{ background: item.accent }}
                              />

                              <span
                                aria-hidden="true"
                                className="relative flex h-[48px] w-[82px] shrink-0 flex-col justify-between overflow-hidden rounded-lg border shadow-sm"
                                style={{
                                  background: item.background,
                                  color: item.foreground,
                                  borderColor: item.accent,
                                }}
                              >
                                <span className="h-1 w-full shrink-0" style={{ background: item.accent }} />
                                <span className="flex min-h-0 flex-1 items-center gap-1.5 px-1.5 py-1">
                                  <span className="flex min-w-0 flex-1 flex-col gap-1">
                                    <span className="block h-1 w-10/12 rounded-full" style={{ background: item.accent }} />
                                    <span className="block h-1 w-8/12 rounded-full" style={{ background: item.foreground, opacity: 0.8 }} />
                                    <span className="block h-1 w-6/12 rounded-full" style={{ background: item.foreground, opacity: 0.55 }} />
                                  </span>
                                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-sm bg-white p-0.5">
                                    <span className="grid h-full w-full grid-cols-3 grid-rows-3 gap-px">
                                      {Array.from({ length: 9 }, (_, cell) => (
                                        <span key={cell} className="block" style={{ background: [0, 2, 3, 4, 6, 8].includes(cell) ? "#111827" : "#d1d5db" }} />
                                      ))}
                                    </span>
                                  </span>
                                </span>
                              </span>

                              <span className="min-w-0 flex-1 py-0.5">
                                <span className="flex items-center gap-2">
                                  <span className="block truncate text-sm font-bold leading-5 text-slate-900">{item.name}</span>
                                  {selected && (
                                    <span className="shrink-0 rounded-full bg-blue-700 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">Selected</span>
                                  )}
                                </span>
                                <span className="mt-1 block text-xs leading-4 text-slate-500">{item.description}</span>
                              </span>

                              <span
                                aria-hidden="true"
                                className={
                                  "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-xs font-bold transition " +
                                  (selected
                                    ? "border-blue-700 bg-blue-700 text-white"
                                    : "border-slate-300 bg-white text-transparent group-hover:border-slate-400")
                                }
                              >
                                ✓
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </section>

                    <section className="rounded-2xl border border-slate-200 p-5">
                      <div className="mb-4 flex items-center gap-3">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-700 text-sm font-bold text-white">2</span>
                        <div>
                          <h3 className="text-base font-bold text-slate-900">Emergency message</h3>
                          <p className="mt-0.5 text-sm text-slate-500">Use the recommended message or write your own.</p>
                        </div>
                      </div>
                      <div className="space-y-3">
                        <div>
                          <label htmlFor="hp-message-preset" className="mb-1.5 block text-sm font-semibold text-slate-700">Select a message</label>
                          <select
                            id="hp-message-preset"
                            className="w-full rounded-xl border-slate-300 bg-white px-3 py-2.5 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
                            value={selectedPreset}
                            disabled={messageMode === "custom"}
                            onChange={(event) => {
                              const nextPreset = event.target.value;
                              const selected = MESSAGE_PRESETS.find(
                                (item) => item.name === nextPreset
                              );
                              setSelectedPreset(nextPreset);
                              setMessageMode("preset");
                              if (selected) {
                                setHeadline(selected.headline);
                                setSupportingMessage(selected.message);
                              }
                            }}
                          >
                            {MESSAGE_PRESETS.map((item) => (
                              <option key={item.name} value={item.name}>{item.name}</option>
                            ))}
                          </select>
                          <p className="mt-1.5 text-xs leading-5 text-slate-500">Default: Personal Safety.</p>
                        </div>
                        <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 transition hover:bg-blue-50">
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded border-slate-300 text-blue-700 focus:ring-blue-600"
                            checked={messageMode === "custom"}
                            onChange={(event) => {
                              if (event.target.checked) setMessageMode("custom");
                              else setMessageMode("preset");
                            }}
                          />
                          <span>
                            <span className="block text-sm font-semibold text-slate-800">Customise my message</span>
                            <span className="mt-0.5 block text-xs text-slate-500">Edit the headline and supporting text.</span>
                          </span>
                        </label>
                        {messageMode === "custom" && (
                          <div className="grid gap-4 border-t border-slate-100 pt-4">
                            <div>
                              <label htmlFor="hp-custom-headline" className="mb-1.5 block text-sm font-semibold text-slate-700">Emergency headline</label>
                              <input className="w-full rounded-xl border-slate-300 px-3 py-2.5 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500" id="hp-custom-headline" value={headline} maxLength={MAX_HEADLINE_LENGTH} onChange={(event) => setHeadline(event.target.value)} aria-describedby="hp-headline-count" />
                              <p id="hp-headline-count" className="mt-1 text-xs text-slate-500">{headline.length}/{MAX_HEADLINE_LENGTH} characters</p>
                              {headlineTooLong && <p className="text-sm text-red-700">Enter a shorter headline.</p>}
                            </div>
                            <div>
                              <label htmlFor="hp-custom-message" className="mb-1.5 block text-sm font-semibold text-slate-700">Supporting instruction</label>
                              <textarea className="w-full rounded-xl border-slate-300 px-3 py-2.5 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500" id="hp-custom-message" rows={3} value={supportingMessage} maxLength={MAX_MESSAGE_LENGTH} onChange={(event) => setSupportingMessage(event.target.value)} aria-describedby="hp-message-count" />
                              <p id="hp-message-count" className="mt-1 text-xs text-slate-500">{supportingMessage.length}/{MAX_MESSAGE_LENGTH} characters</p>
                              {messageTooLong && <p className="text-sm text-red-700">Shorten your message before printing.</p>}
                            </div>
                          </div>
                        )}
                      </div>
                    </section>

                    <section className="rounded-2xl border border-slate-200 p-5">
                      <div className="mb-4 flex items-center gap-3">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-700 text-sm font-bold text-white">3</span>
                        <div>
                          <h3 className="text-base font-bold text-slate-900">Print settings</h3>
                          <p className="mt-0.5 text-sm text-slate-500">Choose the physical card size and orientation.</p>
                        </div>
                      </div>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                          <label htmlFor="hp-print-size" className="mb-1.5 block text-sm font-semibold text-slate-700">Card format</label>
                          <select id="hp-print-size" className="w-full rounded-xl border-slate-300 bg-white px-3 py-2.5 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500" value={sizeId} onChange={(event) => setSizeId(event.target.value as PrintSizeId)}>
                            {PRINT_SIZES.map((item) => <option key={item.id} value={item.id}>{item.name} — {item.description}</option>)}
                          </select>
                        </div>
                        <div>
                          <label htmlFor="hp-print-orientation" className="mb-1.5 block text-sm font-semibold text-slate-700">Orientation</label>
                          <select id="hp-print-orientation" className="w-full rounded-xl border-slate-300 bg-white px-3 py-2.5 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500" value={orientation} onChange={(event) => setOrientation(event.target.value as Orientation)}>
                            <option value="landscape">Landscape</option>
                            <option value="portrait">Portrait</option>
                          </select>
                        </div>
                      </div>
                    </section>
                  </div>

                  <aside className="min-w-0 xl:sticky xl:top-5">
                    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg">
                      <div className="flex items-start justify-between gap-3 border-b border-slate-200 bg-slate-50 px-5 py-4">
                        <div>
                          <h3 className="text-base font-bold text-slate-900">Live print preview</h3>
                          <p className="mt-1 text-xs text-slate-500">Actual proportions · {cardWidth} × {cardHeight} mm</p>
                        </div>
                        <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200">{template.name}</span>
                      </div>
                      <div className="bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-50 via-slate-100 to-slate-100 p-5 sm:p-7">
                        <div
                          id="hp-emergency-print-card"
                          className={"mx-auto grid overflow-hidden rounded-2xl border p-3 text-center shadow-[0_12px_30px_rgba(15,23,42,0.18)] " + (orientation === "landscape" ? "grid-cols-[minmax(0,1fr)_auto] grid-rows-[1fr_auto] items-center gap-x-3 gap-y-2" : "grid-cols-1 grid-rows-[auto_auto_auto_auto_auto] justify-items-center gap-y-2")}
                          style={{
                            width: `${Math.min(cardWidth * 4.4, 560)}px`,
                            aspectRatio: `${cardWidth} / ${cardHeight}`,
                            maxWidth: "100%",
                            background: template.background,
                            color: template.foreground,
                            borderColor: template.accent,
                          }}
                        >
                          <div className={"min-w-0 " + (orientation === "landscape" ? "row-start-1 flex flex-col items-start text-left" : "flex w-full flex-col items-center")}>
                            {profile.photoUrl ? (
                              <img src={profile.photoUrl} alt={`${profile.fullName} profile`} loading="eager" referrerPolicy="no-referrer" onError={(event) => { event.currentTarget.style.display = "none"; }} className="mb-2 h-12 w-12 rounded-full border-2 border-white object-cover shadow-sm" />
                            ) : (
                              <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full border-2 border-white/80 bg-slate-200 text-lg font-bold text-slate-700">{profile.fullName.trim().charAt(0).toUpperCase() || "?"}</div>
                            )}
                            <p className="hp-print-headline font-extrabold leading-tight" style={{ color: template.accent, fontSize: `${Math.max(12, template.headlineSize * 0.75)}px`, overflowWrap: "anywhere" }}>{headline}</p>
                            <p className="hp-print-message mt-1.5 font-medium leading-snug" style={{ fontSize: `${Math.max(10, template.bodySize * 0.85)}px`, overflowWrap: "anywhere" }}>{supportingMessage}</p>
                            <p className="hp-print-name mt-2 w-full break-words font-bold">{profile.fullName}</p>
                          </div>

                          <div className={"hp-print-qr flex shrink-0 items-center justify-center rounded-lg bg-white p-1.5 shadow-sm " + (orientation === "landscape" ? "col-start-2 row-start-1 self-center" : "")} style={{ width: `${Math.min(recommendedQrSize * 4.2, orientation === "landscape" ? 150 : 125)}px`, height: `${Math.min(recommendedQrSize * 4.2, orientation === "landscape" ? 150 : 125)}px` }}>
                            <QRCodeCanvas value={qrUrl} size={320} level="H" marginSize={4} title="Scan for emergency information" style={{ width: "100%", height: "100%" }} />
                          </div>

                          <div className={"hp-print-footer min-w-0 " + (orientation === "landscape" ? "col-span-2 row-start-2 border-t pt-1.5" : "w-full border-t pt-1.5")} style={{ borderColor: `${template.accent}55` }}>
                            <p className="text-[10px] font-semibold leading-tight">Scan to access emergency information</p>
                            <p className="hp-print-brand mt-1 text-[9px] font-extrabold uppercase tracking-[0.12em]" style={{ color: template.accent }}>Powered by HealthPassport</p>
                          </div>
                        </div>
                      </div>

                      {sizeId === "keychain" && (
                        <p className="mx-5 mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm leading-5 text-amber-900">
                          A 35 mm tag has limited space. Test a physical print before relying on it in an emergency.
                        </p>
                      )}

                      <div className="grid gap-3 p-5 sm:grid-cols-2">
                        <button type="button" onClick={handlePrint} disabled={!canPrint} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50">
                          Print / Save as PDF
                        </button>
                        <button type="button" onClick={() => void handleDownloadPng()} disabled={!qr} className="inline-flex min-h-12 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-800 transition hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50">
                          Download QR PNG
                        </button>
                      </div>
                      <p className="px-5 pb-5 text-xs leading-5 text-slate-500">For the cleanest PDF, select “Save as PDF” in the print dialog and disable browser headers and footers. Print at 100% scale where possible.</p>
                    </section>

                    <div className="mt-3 grid grid-cols-2 gap-2" aria-label="Printing guidance">
                      {[
                        { symbol: "✓", tone: "bg-emerald-50 text-emerald-700", title: "Clear QR code", text: "Keep the code clear and leave a white border around it." },
                        { symbol: "↗", tone: "bg-blue-50 text-blue-700", title: "Correct print scale", text: "Use 100% scale when your printer supports it." },
                        { symbol: "⌕", tone: "bg-violet-50 text-violet-700", title: "Test before use", text: "Scan a physical test print with another phone." },
                        { symbol: "●", tone: "bg-amber-50 text-amber-700", title: "Keep it active", text: "An inactive QR cannot open emergency information." },
                      ].map((tip) => (
                        <div key={tip.title} className="flex items-start gap-2.5 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                          <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold ${tip.tone}`}>{tip.symbol}</span>
                          <div className="min-w-0">
                            <h4 className="text-xs font-bold leading-4 text-slate-900 sm:text-sm">{tip.title}</h4>
                            <p className="mt-1 text-xs leading-relaxed text-slate-500">{tip.text}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </aside>
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </main>
  );
}