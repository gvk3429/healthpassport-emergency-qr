
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { Link } from "react-router-dom";
import { QRCodeCanvas } from "qrcode.react";

import { useAuth } from "../auth/AuthContext";

import {
  getEmergencyProfile,
} from "../repositories/emergencyProfileRepository";

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

function errorMessage(
  error: unknown,
  fallback: string
): string {
  return error instanceof Error
    ? error.message
    : fallback;
}

export default function MyQrPage() {
  const { user } = useAuth();

  const uid = user?.uid;

  const qrContainerRef =
    useRef<HTMLDivElement>(null);

  const [profile, setProfile] =
    useState<EmergencyProfile | null>(null);

  const [qr, setQr] =
    useState<EmergencyQr | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [busy, setBusy] =
    useState(false);

  const [error, setError] =
    useState("");

  const [message, setMessage] =
    useState("");

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
    if (!uid) return;

let cancelled = false;

    async function initialLoad() {
      setLoading(true);

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
              "Unable to load your QR."
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

  async function performAction(
    action: () => Promise<unknown>,
    successMessage: string
  ) {
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
    if (!uid || !profile) return;

    void performAction(
      () => createPersonalEmergencyQr(uid),
      "Your Emergency QR draft has been created."
    );
  }

  function handleActivate() {
    if (!qr || !profile) return;

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
    if (!qr || qr.status !== "ACTIVE") {
      return;
    }

    if (
      !window.confirm(
        "Deactivate this QR? Its public emergency information will become unavailable."
      )
    ) {
      return;
    }

    void performAction(
      deactivateEmergencyQr,
      "Your Emergency QR has been deactivated."
    );
  }

  function handleDeleteDraft() {
    if (
      !uid ||
      !qr ||
      qr.status !== "DRAFT"
    ) {
      return;
    }

    if (
      !window.confirm(
        "Permanently delete this draft QR?"
      )
    ) {
      return;
    }

    void performAction(
      () => deletePersonalEmergencyQr(uid),
      "Your draft QR has been deleted."
    );
  }

  const qrUrl = qr
  ? `${window.location.origin}${import.meta.env.BASE_URL}#/e/${encodeURIComponent(
      qr.id
    )}`
  : "";

  function handleDownload() {
    const canvas =
      qrContainerRef.current?.querySelector(
        "canvas"
      );

    if (!canvas || !qr) {
      setError("QR image is unavailable.");
      return;
    }

    const anchor =
      document.createElement("a");

    anchor.download =
      "healthpassport-emergency-qr.png";

    anchor.href =
      canvas.toDataURL("image/png");

    anchor.click();
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
      <div className="mx-auto max-w-5xl">
        <Link
          to="/dashboard"
          className="text-sm font-medium text-blue-700"
        >
          â† Back to Dashboard
        </Link>

        <header className="mb-8 mt-6">
          <h1 className="text-3xl font-bold text-slate-900">
            My Emergency QR
          </h1>

          <p className="mt-2 text-slate-600">
            Create, activate and manage your
            personal emergency identifier.
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
              Complete your emergency information
              before creating a QR.
            </p>

            <Link
              to="/profile"
              className="mt-6 inline-flex rounded-lg bg-blue-700 px-5 py-3 font-semibold text-white"
            >
              Create Emergency Profile
            </Link>
          </section>
        ) : (
          <div className="grid gap-6 lg:grid-cols-2">
            <section className="rounded-2xl border bg-white p-6 shadow-sm">
              <h2 className="text-xl font-bold">
                Emergency profile
              </h2>

              <p className="mt-4 text-sm text-slate-500">
                Name
              </p>

              <p className="font-semibold">
                {profile.fullName}
              </p>

              <p className="mt-4 text-sm text-slate-500">
                Blood group
              </p>

              <p className="font-semibold">
                {profile.bloodGroup}
              </p>

              <p className="mt-4 text-sm text-slate-500">
                Emergency contacts
              </p>

              <p className="font-semibold">
                {profile.emergencyContacts.length}
              </p>

              <p className="mt-4 text-sm text-slate-500">
                Public-profile consent
              </p>

              <p
                className={
                  profile.consentGiven
                    ? "font-semibold text-green-700"
                    : "font-semibold text-red-700"
                }
              >
                {profile.consentGiven
                  ? "Granted"
                  : "Not granted"}
              </p>

              <Link
                to="/profile"
                className="mt-6 inline-flex rounded-lg border border-blue-700 px-5 py-3 font-semibold text-blue-700"
              >
                Edit Emergency Profile
              </Link>
            </section>

            <section className="rounded-2xl border bg-white p-6 shadow-sm">
              <h2 className="text-xl font-bold">
                Personal QR
              </h2>

              {!qr ? (
                <>
                  <p className="mt-3 text-slate-600">
                    Create a personal QR. It will
                    remain private until activated.
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
                          : "rounded-full bg-amber-100 px-3 py-1 text-sm font-semibold text-amber-800"
                      }
                    >
                      {qr.status}
                    </span>
                  </div>

                  <div
                    ref={qrContainerRef}
                    className="mt-6 inline-flex rounded-xl border bg-white p-5"
                  >
                    <QRCodeCanvas
                      value={qrUrl}
                      size={220}
                      level="H"
                      marginSize={2}
                    />
                  </div>

                  <p className="mt-4 break-all text-sm text-slate-500">
                    {qrUrl}
                  </p>

                  <div className="mt-6 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={handleDownload}
                      disabled={busy}
                      className="rounded-lg bg-blue-700 px-5 py-3 font-semibold text-white disabled:opacity-50"
                    >
                      Download QR
                    </button>

                    <Link
                      to={`/e/${encodeURIComponent(
                        qr.id
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-lg border px-5 py-3 font-semibold"
                    >
                      Test QR page
                    </Link>
                  </div>

                  {qr.status !== "ACTIVE" ? (
                    <>
                      <p className="mt-5 rounded-lg bg-amber-50 p-4 text-sm text-amber-900">
                        This QR is not active.
                        Do not use it as an
                        emergency identifier yet.
                      </p>

                      <button
                        type="button"
                        onClick={handleActivate}
                        disabled={
                          busy ||
                          !profile.consentGiven
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
                          onClick={handleDeleteDraft}
                          disabled={busy}
                          className="ml-3 mt-5 rounded-lg border border-red-300 px-5 py-3 font-semibold text-red-700 disabled:opacity-50"
                        >
                          Delete Draft
                        </button>
                      )}
                    </>
                  ) : (
                    <>
                      <p className="mt-5 rounded-lg bg-green-50 p-4 text-sm text-green-900">
                        Your QR is active.
                        Its approved emergency
                        information can be viewed
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
                    </>
                  )}
                </>
              )}
            </section>
          </div>
        )}
      </div>
    </main>
  );
}
