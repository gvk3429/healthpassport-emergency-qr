
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
    useState(false);

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

    const confirmed = window.confirm(
      "Deactivate this QR?\n\n" +
      "Its public emergency information will " +
      "become unavailable until you reactivate it."
    );

    if (!confirmed) return;

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
      const confirmed = window.confirm(
        "Permanently delete this draft QR?\n\n" +
        "This action cannot be undone."
      );

      if (!confirmed) return;

      void performAction(
        () => deletePersonalEmergencyQr(uid),
        "Your draft QR has been deleted."
      );

      return;
    }

    if (qr.status === "INACTIVE") {
      const confirmed = window.confirm(
        "PERMANENTLY DELETE THIS QR?\n\n" +
        "Your current QR identifier will be retired " +
        "and can never be reactivated.\n\n" +
        "Any previously printed cards, wristbands " +
        "or stickers containing this QR will stop " +
        "working permanently.\n\n" +
        "If you create another QR, it will have " +
        "a completely different identifier.\n\n" +
        "Continue?"
      );

      if (!confirmed) return;

      // A second confirmation reduces the risk
      // of accidentally retiring a printed QR.
      const finalConfirmation = window.confirm(
        "Final confirmation:\n\n" +
        "Delete this inactive QR permanently?"
      );

      if (!finalConfirmation) return;

      void performAction(
        () => deletePersonalEmergencyQr(uid),
        "Your QR has been permanently deleted. " +
        "Its identifier has been retired and " +
        "cannot be reused."
      );
    }
  }

  const qrUrl = qr
    ? `${window.location.origin}${
        import.meta.env.BASE_URL
      }#/e/${encodeURIComponent(qr.id)}`
    : "";

  function handleDownload() {
    if (!qr || busy) return;

    const canvas =
      qrContainerRef.current?.querySelector(
        "canvas"
      );

    if (!canvas) {
      setError("QR image is unavailable.");
      return;
    }

    try {
      const anchor =
        document.createElement("a");

      anchor.download =
        "healthpassport-emergency-qr.png";

      anchor.href =
        canvas.toDataURL("image/png");

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
          ← Back to Dashboard
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
            {/* EMERGENCY PROFILE */}

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

            {/* PERSONAL QR */}

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
                        <div className="mt-5 border-t pt-5">
                          <button
                            type="button"
                            onClick={handleDelete}
                            disabled={busy}
                            className="rounded-lg border border-red-300 px-5 py-3 font-semibold text-red-700 disabled:opacity-50"
                          >
                            Delete Draft
                          </button>
                        </div>
                      )}

                      {qr.status === "INACTIVE" && (
                        <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-5">
                          <h3 className="font-bold text-red-900">
                            Permanently delete QR
                          </h3>

                          <p className="mt-2 text-sm text-red-800">
                            Deleting this QR permanently
                            retires its identifier.
                            Previously printed copies
                            will never work again.
                            You can create a new QR
                            afterward.
                          </p>

                          <button
                            type="button"
                            onClick={handleDelete}
                            disabled={busy}
                            className="mt-4 rounded-lg bg-red-700 px-5 py-3 font-semibold text-white disabled:opacity-50"
                          >
                            {busy
                              ? "Processing..."
                              : "Delete QR Permanently"}
                          </button>
                        </div>
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

                      <p className="mt-3 text-sm text-slate-500">
                        To permanently delete this
                        QR, deactivate it first.
                      </p>
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