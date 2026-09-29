
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { defineSecret } from "firebase-functions/params";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import nodemailer, {
  type Transporter,
} from "nodemailer";

const db = getFirestore();

const emailUser = defineSecret("HP_EMAIL_USER");
const emailPassword = defineSecret("HP_EMAIL_APP_PASSWORD");

const QR_PATTERN = /^[A-Za-z0-9_-]{20,100}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const COOLDOWN_MS = 15 * 60 * 1000;
const SMTP_TIMEOUT_MS = 12_000;

type RequestData = {
  qrId?: unknown;
  latitude?: unknown;
  longitude?: unknown;
  accuracy?: unknown;
  message?: unknown;
};

type Location = {
  latitude: number;
  longitude: number;
  accuracy: number;
};

type Contact = {
  email?: unknown;
};

function parseLocation(data: RequestData): Location | null {
  const fields = [
    data.latitude,
    data.longitude,
    data.accuracy,
  ];

  const supplied = fields.filter(
    (value) => value !== undefined
  ).length;

  if (supplied === 0) {
    return null;
  }

  if (supplied !== 3) {
    throw new HttpsError(
      "invalid-argument",
      "Provide all GPS fields or omit all GPS fields."
    );
  }

  const { latitude, longitude, accuracy } = data;

  if (
    typeof latitude !== "number" ||
    !Number.isFinite(latitude) ||
    latitude < -90 ||
    latitude > 90 ||
    typeof longitude !== "number" ||
    !Number.isFinite(longitude) ||
    longitude < -180 ||
    longitude > 180 ||
    typeof accuracy !== "number" ||
    !Number.isFinite(accuracy) ||
    accuracy < 0 ||
    accuracy > 100000
  ) {
    throw new HttpsError(
      "invalid-argument",
      "Invalid GPS data."
    );
  }

  return { latitude, longitude, accuracy };
}

function validEmail(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length <= 254 &&
    EMAIL_PATTERN.test(value)
  );
}

function cleanLine(value: string): string {
  return value.replace(/[\r\n\t]+/g, " ").trim();
}

function emailBody(
  patientName: string,
  location: Location | null,
  scannerMessage: string
): string {
  const lines = [
    "HEALTHPASSPORT EMERGENCY ALERT",
    "",
    `Emergency profile: ${patientName}`,
    "",
    "Someone has scanned this person's emergency QR and requested assistance.",
    "",
  ];

  if (location) {
    const coordinates =
      `${location.latitude},${location.longitude}`;

    lines.push(
      "SCANNER-REPORTED LOCATION",
      `Latitude: ${location.latitude}`,
      `Longitude: ${location.longitude}`,
      `Reported accuracy: ${location.accuracy} metres`,
      "",
      `Google Maps: https://www.google.com/maps?q=${coordinates}`,
      `Apple Maps: https://maps.apple.com/?ll=${coordinates}`,
      "",
      "This location has not been independently verified.",
      ""
    );
  } else {
    lines.push(
      "LOCATION UNAVAILABLE",
      "The scanner did not provide GPS coordinates.",
      "Contact the scanner or emergency services for location information.",
      ""
    );
  }

  if (scannerMessage) {
    lines.push(
      "SCANNER MESSAGE",
      scannerMessage,
      ""
    );
  }

  lines.push(
    "If this is an emergency, contact emergency services immediately.",
    "",
    "This is an automated HealthPassport notification."
  );

  return lines.join("\n");
}

export const notifyEmergencyContacts = onCall(
  {
    region: "asia-south1",
    secrets: [emailUser, emailPassword],
    maxInstances: 5,
    timeoutSeconds: 120,
  },
  async (request) => {
    const data = (request.data ?? {}) as RequestData;

    if (
      typeof data.qrId !== "string" ||
      !QR_PATTERN.test(data.qrId)
    ) {
      throw new HttpsError(
        "invalid-argument",
        "Invalid emergency QR."
      );
    }

    const qrId = data.qrId;
    const location = parseLocation(data);

    if (
      data.message !== undefined &&
      typeof data.message !== "string"
    ) {
      throw new HttpsError(
        "invalid-argument",
        "Invalid emergency message."
      );
    }

    const message =
      typeof data.message === "string"
        ? cleanLine(data.message)
        : "";

    if (message.length > 500) {
      throw new HttpsError(
        "invalid-argument",
        "Emergency message exceeds 500 characters."
      );
    }

    const publicRef = db.doc(
      `publicEmergencyQrs/${qrId}`
    );

    const registryRef = db.doc(
      `emergencyQrRegistry/${qrId}`
    );

    const cooldownRef = db.doc(
      `emergencyNotificationLimits/${qrId}`
    );

    let recipients: string[] = [];
    let patientName = "Emergency QR holder";

    // All security checks and cooldown reservation happen
    // in one Firestore transaction.
    await db.runTransaction(async (tx) => {
      const [
        publicSnap,
        registrySnap,
        cooldownSnap,
      ] = await Promise.all([
        tx.get(publicRef),
        tx.get(registryRef),
        tx.get(cooldownRef),
      ]);

      if (
        !publicSnap.exists ||
        !registrySnap.exists
      ) {
        throw new HttpsError(
          "failed-precondition",
          "This emergency QR is not active."
        );
      }

      const publicData = publicSnap.data();
      const registryData = registrySnap.data();
      const ownerId = registryData?.ownerId;

      if (
        publicData?.status !== "ACTIVE" ||
        publicData?.qrId !== qrId ||
        typeof ownerId !== "string" ||
        !ownerId ||
        registryData?.qrId !== qrId ||
        registryData?.profileId !== ownerId ||
        publicData?.ownerId !== ownerId ||
        registryData?.retiredAt
      ) {
        throw new HttpsError(
          "failed-precondition",
          "This emergency QR is not active."
        );
      }

      const profileRef = db.doc(
        `emergencyProfiles/${ownerId}`
      );

      const personalQrRef = db.doc(
        `personalEmergencyQrs/${ownerId}`
      );

      const [
        profileSnap,
        personalQrSnap,
      ] = await Promise.all([
        tx.get(profileRef),
        tx.get(personalQrRef),
      ]);

      if (
        !profileSnap.exists ||
        !personalQrSnap.exists
      ) {
        throw new HttpsError(
          "failed-precondition",
          "The emergency profile is unavailable."
        );
      }

      const profile = profileSnap.data();
      const personalQr = personalQrSnap.data();

      if (
        profile?.ownerId !== ownerId ||
        profile?.consentGiven !== true ||
        personalQr?.id !== qrId ||
        personalQr?.ownerId !== ownerId ||
        personalQr?.profileId !== ownerId ||
        personalQr?.status !== "ACTIVE" ||
        typeof profile?.updatedAt !== "string" ||
        profile.updatedAt !== publicData.sourceUpdatedAt
      ) {
        throw new HttpsError(
          "failed-precondition",
          "The emergency profile is not currently available."
        );
      }

      const contacts = Array.isArray(
        profile.emergencyContacts
      )
        ? (profile.emergencyContacts as Contact[])
        : [];

      const emails = new Set<string>();

      for (const contact of contacts) {
        if (validEmail(contact?.email)) {
          emails.add(
            contact.email.trim().toLowerCase()
          );
        }
      }

      if (emails.size === 0) {
        throw new HttpsError(
          "failed-precondition",
          "No valid emergency contact email addresses are registered."
        );
      }

      const previous = cooldownSnap.data();

      if (
        previous?.lastAttemptAt instanceof Timestamp &&
        Date.now() -
          previous.lastAttemptAt.toMillis() <
          COOLDOWN_MS
      ) {
        throw new HttpsError(
          "resource-exhausted",
          "An emergency notification was recently requested. Contact emergency services or registered contacts directly."
        );
      }

      recipients = [...emails];

      patientName =
        typeof profile.fullName === "string" &&
        profile.fullName.trim()
          ? cleanLine(profile.fullName)
          : "Emergency QR holder";

      // This write is atomic with the checks above.
      // Competing first-time requests must retry the
      // transaction and then encounter this cooldown.
      tx.set(
        cooldownRef,
        {
          qrId,
          lastAttemptAt: Timestamp.now(),
          lastAttemptStatus: "PENDING",
          acceptedCount: 0,
          failedCount: 0,
          recipientCount: recipients.length,
          locationProvided: location !== null,
        },
        { merge: true }
      );
    });

    // The test transport is available ONLY inside the
    // Firebase Functions emulator.
    const isEmulator =
      process.env.FUNCTIONS_EMULATOR === "true";

let transporter: Transporter;
    if (isEmulator) {
      transporter = nodemailer.createTransport({
        host: "127.0.0.1",
        port: 2525,
        secure: false,
        ignoreTLS: true,
        connectionTimeout: SMTP_TIMEOUT_MS,
        greetingTimeout: SMTP_TIMEOUT_MS,
        socketTimeout: SMTP_TIMEOUT_MS,
      });

      console.log(
        "Using local SMTP test transport."
      );
    } else {
      const sender = emailUser.value();
      const password = emailPassword.value();

      if (!sender || !password) {
        await cooldownRef.update({
          lastAttemptStatus: "FAILED",
          completedAt: Timestamp.now(),
        });

        throw new HttpsError(
          "unavailable",
          "Emergency email notification is temporarily unavailable."
        );
      }

      transporter = nodemailer.createTransport({
        host: "smtp.gmail.com",
        port: 465,
        secure: true,
        auth: {
          user: sender,
          pass: password,
        },
        connectionTimeout: SMTP_TIMEOUT_MS,
        greetingTimeout: SMTP_TIMEOUT_MS,
        socketTimeout: SMTP_TIMEOUT_MS,
      });
    }

    const senderAddress = isEmulator
      ? "healthpassport-test@example.com"
      : emailUser.value();

    const body = emailBody(
      patientName,
      location,
      message
    );

    let acceptedCount = 0;
    let failedCount = 0;

    try {
      // Individual sends protect recipient privacy.
      for (const recipient of recipients) {
        try {
          const result = await transporter.sendMail({
            from: senderAddress,
            to: recipient,
            subject:
              "HealthPassport Emergency QR — Assistance Requested",
            text: body,
          });

          const accepted = (result.accepted ?? []).some(
  (address: string) =>
    address.toLowerCase() === recipient
);

          if (accepted) {
            acceptedCount++;
          } else {
            failedCount++;
          }
        } catch (error) {
          failedCount++;

          console.error(
            "Emergency SMTP attempt failed:",
            error instanceof Error
              ? error.message
              : "Unknown SMTP error"
          );
        }
      }
    } finally {
      transporter.close();
    }

    const status =
      acceptedCount === 0
        ? "FAILED"
        : failedCount > 0
          ? "PARTIAL"
          : "ACCEPTED";

    try {
      await cooldownRef.update({
        lastAttemptStatus: status,
        acceptedCount,
        failedCount,
        recipientCount: recipients.length,
        completedAt: Timestamp.now(),
      });
    } catch (error) {
      // Email acceptance cannot be rolled back if
      // recording the final status fails.
      console.error(
        "Could not record notification outcome:",
        error
      );
    }

    if (acceptedCount === 0) {
      throw new HttpsError(
        "unavailable",
        "No emergency notification emails were accepted. Contact emergency services or registered contacts directly."
      );
    }

    const partialSuccess = failedCount > 0;

    return {
      success: true,
      acceptedCount,
      recipientCount: recipients.length,
      partialSuccess,
      message: partialSuccess
        ? "Some notification emails were accepted, but others failed."
        : "Notification emails were accepted by the mail server. Inbox delivery is not guaranteed.",
    };
  }
);