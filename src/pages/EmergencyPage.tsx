
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "../lib/firebase";

type EmergencyContact = {
  name: string;
  relationship?: string;
  phone: string;
  isPrimary?: boolean;
};

type PublicEmergencyData = {
  qrId: string;
  status: "ACTIVE";
  fullName: string;
  photoUrl?: string;
  homeAddress?: string;
  dateOfBirth?: string;
  bloodGroup?: string;
  allergies?: string[];
  medicalConditions?: string[];
  medications?: string[];
  emergencyContacts?: EmergencyContact[];
  emergencyInstructions?: string;
};

type ScannerLocation = {
  latitude: number;
  longitude: number;
  accuracy: number;
};

type NotificationRequest = {
  qrId: string;
  latitude?: number;
  longitude?: number;
  accuracy?: number;
  message: string;
};

type NotificationResponse = {
  success: boolean;
  acceptedCount: number;
  recipientCount: number;
  partialSuccess: boolean;
  message: string;
};

type NotificationState =
  | "idle"
  | "sending"
  | "accepted"
  | "uncertain"
  | "failed";

const QR_PATTERN = /^[A-Za-z0-9_-]{20,100}$/;
const NOTIFICATION_TIMEOUT_MS = 45000;

function DetailList({
  title,
  values,
}: {
  title: string;
  values?: string[];
}) {
  if (!values?.length) return null;

  return (
    <section className="border-t py-5">
      <h3 className="font-semibold text-slate-900">
        {title}
      </h3>

      <ul className="mt-3 list-disc space-y-1 pl-5 text-slate-700">
        {values.map((value, index) => (
          <li key={`${index}-${value}`}>{value}</li>
        ))}
      </ul>
    </section>
  );
}

function firebaseErrorCode(error: unknown): string {
  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    typeof error.code === "string"
  ) {
    return error.code;
  }

  return "";
}

function notificationError(error: unknown): {
  message: string;
  uncertain: boolean;
} {
  const code = firebaseErrorCode(error);

  if (code === "functions/resource-exhausted") {
    return {
      message:
        "A notification was recently requested. " +
        "Please call an emergency contact directly. " +
        "Another request may be possible after 15 minutes.",
      uncertain: false,
    };
  }

  if (code === "functions/failed-precondition") {
    return {
      message:
        "This emergency QR or its notification settings " +
        "are unavailable. Call an emergency contact directly.",
      uncertain: false,
    };
  }

  if (code === "functions/invalid-argument") {
    return {
      message:
        "The notification request was invalid. " +
        "Please refresh the page and try again.",
      uncertain: false,
    };
  }

  if (code === "functions/unavailable") {
    return {
      message:
        "The email service could not accept the notification. " +
        "Call an emergency contact directly.",
      uncertain: false,
    };
  }

  if (
    code === "functions/deadline-exceeded" ||
    code === "functions/internal" ||
    code === "functions/unknown" ||
    code === "functions/cancelled" ||
    code === "functions/network-request-failed"
  ) {
    return {
      message:
        "The notification result could not be confirmed. " +
        "Some emails may already have been accepted. " +
        "Call an emergency contact directly rather than " +
        "repeatedly submitting the request.",
      uncertain: true,
    };
  }

  return {
    message:
      "The notification result could not be confirmed. " +
      "Call an emergency contact directly.",
    uncertain: true,
  };
}

export default function EmergencyPage() {
  const { qrId } = useParams<{ qrId: string }>();

  const [data, setData] =
    useState<PublicEmergencyData | null>(null);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [unavailable, setUnavailable] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const [location, setLocation] =
    useState<ScannerLocation | null>(null);

  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState("");

  const [message, setMessage] = useState("");
  const [notificationState, setNotificationState] =
    useState<NotificationState>("idle");

  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  // A ref prevents rapid duplicate submissions before React
  // has committed its next state update.
  const submittingRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setLoadError("");
      setUnavailable(false);
      setData(null);

      if (!qrId || !QR_PATTERN.test(qrId)) {
        setUnavailable(true);
        setLoading(false);
        return;
      }

      try {
        const snapshot = await getDoc(
          doc(db, "publicEmergencyQrs", qrId)
        );

        if (cancelled) return;

        if (!snapshot.exists()) {
          setUnavailable(true);
          return;
        }

        const profile =
          snapshot.data() as PublicEmergencyData;

        if (
          profile.status !== "ACTIVE" ||
          profile.qrId !== qrId
        ) {
          setUnavailable(true);
          return;
        }

        setData(profile);
      } catch {
        if (!cancelled) {
          setLoadError(
            "Unable to load emergency information. " +
            "Check your internet connection and try again."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [qrId, reloadKey]);

  const captureLocation = useCallback(() => {
    if (locating || submittingRef.current) return;

    setLocationError("");
    setLocation(null);

    if (!navigator.geolocation) {
      setLocationError(
        "GPS is not supported on this device. " +
        "You can still notify emergency contacts without location."
      );
      return;
    }

    setLocating(true);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude, accuracy } =
          position.coords;

        if (
          !Number.isFinite(latitude) ||
          !Number.isFinite(longitude) ||
          !Number.isFinite(accuracy) ||
          latitude < -90 ||
          latitude > 90 ||
          longitude < -180 ||
          longitude > 180 ||
          accuracy < 0 ||
          accuracy > 100000
        ) {
          setLocationError(
            "Your device returned invalid GPS data. " +
            "You can notify contacts without location."
          );
          setLocating(false);
          return;
        }

        setLocation({
          latitude,
          longitude,
          accuracy,
        });

        setLocating(false);
      },
      (geoError) => {
        let description =
          "Unable to obtain your GPS location.";

        if (geoError.code === 1) {
          description = "Location permission was denied.";
        } else if (geoError.code === 2) {
          description =
            "Your device could not determine its location.";
        } else if (geoError.code === 3) {
          description = "The GPS request timed out.";
        }

        setLocationError(
          description +
            " You can retry or notify contacts without GPS."
        );

        setLocating(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      }
    );
  }, [locating]);

  async function sendNotification() {
    if (
      !qrId ||
      !data ||
      submittingRef.current ||
      notificationState !== "idle" ||
      locating
    ) {
      return;
    }

    submittingRef.current = true;

    setNotificationState("sending");
    setError("");
    setNotice("");

    const payload: NotificationRequest = {
      qrId,
      message: message.trim(),
    };

    if (location) {
      payload.latitude = location.latitude;
      payload.longitude = location.longitude;
      payload.accuracy = location.accuracy;
    }

    try {
      const notify = httpsCallable<
        NotificationRequest,
        NotificationResponse
      >(
        functions,
        "notifyEmergencyContacts",
        {
          timeout: NOTIFICATION_TIMEOUT_MS,
        }
      );

      const result = await notify(payload);

      if (!result.data.success) {
        setNotificationState("uncertain");
        setError(
          "The notification result could not be confirmed. " +
          "Call an emergency contact directly."
        );
        return;
      }

      setNotificationState("accepted");

      if (result.data.partialSuccess) {
        setNotice(
          "Partial success: the email service accepted " +
          `${result.data.acceptedCount} of ` +
          `${result.data.recipientCount} notifications. ` +
          "Some contacts may not receive an email. " +
          "Call emergency contacts directly as well."
        );
      } else {
        setNotice(result.data.message);
      }
    } catch (err) {
      const result = notificationError(err);

      setNotificationState(
        result.uncertain ? "uncertain" : "failed"
      );

      setError(result.message);
    } finally {
      submittingRef.current = false;
    }
  }

  const googleMapsUrl = location
    ? "https://www.google.com/maps/search/?api=1&query=" +
      encodeURIComponent(
        `${location.latitude},${location.longitude}`
      )
    : "";

  const sending = notificationState === "sending";
  const sent = notificationState === "accepted";
  const uncertain = notificationState === "uncertain";
  const failed = notificationState === "failed";

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto max-w-xl">
        <header className="mb-6 text-center">
          <div
            className="mb-3 text-5xl text-red-700"
            aria-hidden="true"
          >
            ✚
          </div>

          <h1 className="text-2xl font-bold text-slate-900">
            HealthPassport Emergency QR
          </h1>

          <p className="mt-2 text-sm text-slate-600">
            Emergency identification
          </p>
        </header>

        <section className="mb-6 rounded-xl border border-red-200 bg-red-50 p-5 text-center">
          <h2 className="font-bold text-red-900">
            Is someone in immediate danger?
          </h2>

          <p className="mt-2 text-sm text-red-800">
            Contact emergency services immediately.
            Do not delay medical assistance while using
            this page.
          </p>

          <a
            href="tel:112"
            className="mt-4 inline-flex rounded-lg bg-red-700 px-6 py-3 font-bold text-white"
          >
            Call 112 (India)
          </a>
        </section>

        {loading && (
          <section
            role="status"
            className="rounded-xl border bg-white p-8 text-center"
          >
            Loading emergency information...
          </section>
        )}

        {!loading && loadError && (
          <section
            role="alert"
            className="rounded-xl border bg-white p-8 text-center"
          >
            <h2 className="text-xl font-bold">
              Connection problem
            </h2>

            <p className="mt-3 text-slate-600">
              {loadError}
            </p>

            <button
              type="button"
              onClick={() => setReloadKey((key) => key + 1)}
              className="mt-5 rounded-lg bg-blue-700 px-5 py-3 font-semibold text-white"
            >
              Retry loading
            </button>
          </section>
        )}

        {!loading && unavailable && (
          <section
            role="alert"
            className="rounded-xl border bg-white p-8 text-center"
          >
            <h2 className="text-xl font-bold text-slate-900">
              Emergency information unavailable
            </h2>

            <p className="mt-3 text-slate-600">
              This QR may be invalid or inactive.
            </p>
          </section>
        )}

        {!loading && data && (
          <>
            <article className="rounded-2xl border bg-white p-6 shadow-sm">
              <div className="text-center">
                {data.photoUrl && (
                  <img
                    src={data.photoUrl}
                    alt={`Emergency profile of ${data.fullName}`}
                    className="mx-auto mb-4 h-32 w-32 rounded-full border object-cover"
                  />
                )}

                <span className="rounded-full bg-green-100 px-3 py-1 text-sm font-semibold text-green-800">
                  Active emergency profile
                </span>

                <h2 className="mt-4 text-2xl font-bold text-slate-900">
                  {data.fullName}
                </h2>
              </div>

              {data.bloodGroup && (
                <section className="mt-6 rounded-xl bg-red-50 p-5 text-center">
                  <p className="text-sm text-red-800">
                    Reported blood group
                  </p>

                  <p className="mt-2 text-3xl font-bold text-red-900">
                    {data.bloodGroup}
                  </p>

                  <p className="mt-2 text-xs text-red-700">
                    Verify clinically before transfusion.
                  </p>
                </section>
              )}

              {data.homeAddress && (
                <section className="mt-6 border-t pt-5">
                  <h3 className="font-semibold">Home address</h3>
                  <p className="mt-2 whitespace-pre-wrap text-slate-700">
                    {data.homeAddress}
                  </p>
                </section>
              )}

              {data.dateOfBirth && (
                <section className="mt-6 border-t pt-5">
                  <h3 className="font-semibold">
                    Date of birth
                  </h3>

                  <p className="mt-2 text-slate-700">
                    {data.dateOfBirth}
                  </p>
                </section>
              )}

              <DetailList
                title="Reported allergies"
                values={data.allergies}
              />

              <DetailList
                title="Medical conditions"
                values={data.medicalConditions}
              />

              <DetailList
                title="Current medications"
                values={data.medications}
              />

              {data.emergencyInstructions && (
                <section className="border-t py-5">
                  <h3 className="font-semibold">
                    Emergency instructions
                  </h3>

                  <p className="mt-3 whitespace-pre-wrap text-slate-700">
                    {data.emergencyInstructions}
                  </p>
                </section>
              )}

              {!!data.emergencyContacts?.length && (
                <section className="border-t py-5">
                  <h3 className="font-semibold">
                    Emergency contacts
                  </h3>

                  <div className="mt-4 space-y-3">
                    {data.emergencyContacts.map(
                      (contact, index) => (
                        <div
                          key={`${index}-${contact.phone}`}
                          className="rounded-xl border p-4"
                        >
                          <p className="font-semibold">
                            {contact.name}
                          </p>

                          {contact.relationship && (
                            <p className="mt-1 text-sm text-slate-600">
                              {contact.relationship}
                            </p>
                          )}

                          <a
                            href={`tel:${contact.phone.replace(
                              /[^\d+]/g,
                              ""
                            )}`}
                            className="mt-3 inline-flex rounded-lg bg-blue-700 px-4 py-2 font-semibold text-white"
                          >
                            Call {contact.phone}
                          </a>
                        </div>
                      )
                    )}
                  </div>
                </section>
              )}
            </article>

            <section className="mt-6 rounded-2xl border border-blue-200 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-bold text-slate-900">
                Notify Emergency Contacts
              </h2>

              <p className="mt-3 text-sm leading-6 text-slate-600">
                Request an email notification to this
                person's registered emergency contacts.
                Sharing your GPS location is optional.
              </p>

              <button
                type="button"
                onClick={captureLocation}
                disabled={
                  locating ||
                  sending ||
                  sent ||
                  uncertain
                }
                className="mt-5 w-full rounded-lg bg-blue-700 px-5 py-3 font-semibold text-white disabled:opacity-50"
              >
                {locating
                  ? "Getting your location..."
                  : location
                    ? "Refresh my GPS location"
                    : "Share my GPS location"}
              </button>

              {locationError && (
                <p
                  role="alert"
                  className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900"
                >
                  {locationError}
                </p>
              )}

              {location && (
                <div className="mt-5 rounded-xl bg-slate-50 p-4 text-sm text-slate-700">
                  <p>
                    <strong>Latitude:</strong>{" "}
                    {location.latitude}
                  </p>

                  <p className="mt-1">
                    <strong>Longitude:</strong>{" "}
                    {location.longitude}
                  </p>

                  <p className="mt-1">
                    <strong>Reported accuracy:</strong>{" "}
                    {Math.round(location.accuracy)} m
                  </p>

                  <a
                    href={googleMapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-block font-semibold text-blue-700 underline"
                  >
                    Preview location in Google Maps
                  </a>

                  {!sending && !sent && !uncertain && (
                    <button
                      type="button"
                      onClick={() => setLocation(null)}
                      className="mt-3 block text-sm font-semibold text-slate-600 underline"
                    >
                      Remove shared location
                    </button>
                  )}
                </div>
              )}

              {!location && !locating && (
                <p className="mt-3 text-sm text-slate-600">
                  No GPS location selected. You can still
                  notify emergency contacts.
                </p>
              )}

              <label className="mt-5 block">
                <span className="text-sm font-medium text-slate-900">
                  Optional message
                </span>

                <textarea
                  rows={4}
                  maxLength={500}
                  disabled={sending || sent || uncertain}
                  value={message}
                  onChange={(event) =>
                    setMessage(event.target.value)
                  }
                  placeholder="Example: I found this person near the main entrance."
                  className="mt-2 w-full rounded-lg border border-slate-300 p-3 text-slate-900"
                />
              </label>

              {error && (
                <p
                  role="alert"
                  className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800"
                >
                  {error}
                </p>
              )}

              {notice && (
                <p
                  role="status"
                  className="mt-4 rounded-lg bg-green-50 p-3 text-sm text-green-800"
                >
                  {notice}
                </p>
              )}

              {uncertain && (
                <p className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
                  Do not assume the email failed or succeeded.
                  The request may have reached the server.
                  Call emergency contacts directly.
                </p>
              )}

              <button
                type="button"
                onClick={() => void sendNotification()}
                disabled={
                  locating ||
                  sending ||
                  sent ||
                  uncertain
                }
                className="mt-5 w-full rounded-lg bg-green-700 px-5 py-4 font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {sending
                  ? "Requesting notification..."
                  : sent
                    ? "Notification accepted"
                    : failed
                      ? "Retry notification"
                      : "Notify Emergency Contacts"}
              </button>

              <p className="mt-3 text-xs leading-5 text-slate-500">
                This sends an email request; it does not
                contact emergency services. Email delivery
                may be delayed or unsuccessful. GPS
                coordinates, when shared, come from the
                scanner's device and may not represent
                the patient's exact location.
              </p>
            </section>
          </>
        )}

        <section className="mt-6 rounded-xl border bg-white p-5 text-center">
          <p className="text-sm text-slate-600">
            Protect your emergency information
            with your own HealthPassport QR.
          </p>

          <Link
            to="/"
            className="mt-3 inline-flex rounded-lg border border-blue-700 px-5 py-3 font-semibold text-blue-700"
          >
            Get HealthPassport
          </Link>
        </section>
      </div>
    </main>
  );
}