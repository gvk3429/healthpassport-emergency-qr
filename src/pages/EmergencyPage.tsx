
import {
  useEffect,
  useState,
} from "react";

import {
  Link,
  useParams,
} from "react-router-dom";

import {
  doc,
  getDoc,
} from "firebase/firestore";

import {
  httpsCallable,
} from "firebase/functions";

import {
  db,
  functions,
} from "../lib/firebase";

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

type NotificationResponse = {
  success: boolean;
  acceptedCount: number;
  message: string;
};

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
          <li key={`${index}-${value}`}>
            {value}
          </li>
        ))}
      </ul>
    </section>
  );
}

function errorMessage(error: unknown): string {
  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    error.code === "functions/resource-exhausted"
  ) {
    return (
      "A notification was recently requested. " +
      "Please call an emergency contact directly " +
      "or try again after 15 minutes."
    );
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Unable to send the notification.";
}

export default function EmergencyPage() {
  const { qrId } = useParams<{ qrId: string }>();

  const [data, setData] =
    useState<PublicEmergencyData | null>(null);

  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);

  const [location, setLocation] =
    useState<ScannerLocation | null>(null);

  const [locating, setLocating] = useState(false);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setUnavailable(false);
      setData(null);

      if (
        !qrId ||
        !/^[A-Za-z0-9_-]{20,100}$/.test(qrId)
      ) {
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
          setUnavailable(true);
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
  }, [qrId]);

  function captureLocation() {
    setError("");
    setNotice("");
    setLocation(null);

    if (!navigator.geolocation) {
      setError(
        "Location sharing is not supported on this device."
      );
      return;
    }

    setLocating(true);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        });

        setLocating(false);
      },
      () => {
        setError(
          "Unable to obtain your location. " +
          "Enable location permission and try again."
        );
        setLocating(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      }
    );
  }

  async function sendNotification() {
    if (
      !qrId ||
      !data ||
      !location ||
      sending ||
      sent
    ) {
      return;
    }

    setSending(true);
    setError("");
    setNotice("");

    try {
      const notify = httpsCallable<
        {
          qrId: string;
          latitude: number;
          longitude: number;
          accuracy: number;
          message: string;
        },
        NotificationResponse
      >(
        functions,
        "notifyEmergencyContacts"
      );

      const result = await notify({
        qrId,
        latitude: location.latitude,
        longitude: location.longitude,
        accuracy: location.accuracy,
        message: message.trim(),
      });

      if (!result.data.success) {
        throw new Error(
          "The notification was not accepted."
        );
      }

      setSent(true);
      setNotice(result.data.message);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSending(false);
    }
  }

  const googleMapsUrl = location
    ? "https://www.google.com/maps/search/?api=1&query=" +
      encodeURIComponent(
        `${location.latitude},${location.longitude}`
      )
    : "";

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
            Do not delay medical assistance while
            using this page.
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

        {!loading && unavailable && (
          <section
            role="alert"
            className="rounded-xl border bg-white p-8 text-center"
          >
            <h2 className="text-xl font-bold text-slate-900">
              Emergency information unavailable
            </h2>

            <p className="mt-3 text-slate-600">
              This QR may be invalid, inactive or
              temporarily unavailable.
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
                Share your device's current GPS
                coordinates and an optional message
                with this person's registered
                emergency contacts by email.
                Your location is requested only
                when you choose to share it.
              </p>

              <button
                type="button"
                onClick={captureLocation}
                disabled={locating || sending || sent}
                className="mt-5 w-full rounded-lg bg-blue-700 px-5 py-3 font-semibold text-white hover:bg-blue-800 disabled:opacity-50"
              >
                {locating
                  ? "Getting your location..."
                  : location
                    ? "Refresh my GPS location"
                    : "Share my GPS location"}
              </button>

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
                </div>
              )}

              <label className="mt-5 block">
                <span className="text-sm font-medium text-slate-900">
                  Optional message
                </span>

                <textarea
                  rows={4}
                  maxLength={500}
                  disabled={sending || sent}
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

              <button
                type="button"
                onClick={() => void sendNotification()}
                disabled={
                  !location ||
                  locating ||
                  sending ||
                  sent
                }
                className="mt-5 w-full rounded-lg bg-green-700 px-5 py-4 font-bold text-white hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {sending
                  ? "Sending notification..."
                  : sent
                    ? "Notification accepted"
                    : "Notify Emergency Contacts"}
              </button>

              <p className="mt-3 text-xs leading-5 text-slate-500">
                This sends an email request; it does
                not contact emergency services.
                Email delivery may be delayed.
                Your GPS location may differ from
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