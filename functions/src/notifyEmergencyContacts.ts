
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { defineSecret } from "firebase-functions/params";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import nodemailer from "nodemailer";

const db = getFirestore();

const emailUser = defineSecret("HP_EMAIL_USER");
const emailPassword = defineSecret("HP_EMAIL_APP_PASSWORD");

const COOLDOWN_MS = 15 * 60 * 1000;
const QR_PATTERN = /^[A-Za-z0-9_-]{20,100}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type RequestData = {
  qrId?: unknown;
  latitude?: unknown;
  longitude?: unknown;
  accuracy?: unknown;
  message?: unknown;
};

type Contact = {
  name?: unknown;
  email?: unknown;
};

function validCoordinate(
  value: unknown,
  min: number,
  max: number
): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= min &&
    value <= max
  );
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

export const notifyEmergencyContacts = onCall(
  {
    region: "asia-south1",
    secrets: [emailUser, emailPassword],
    maxInstances: 5,
    timeoutSeconds: 60,
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

    if (
      !validCoordinate(data.latitude, -90, 90) ||
      !validCoordinate(data.longitude, -180, 180)
    ) {
      throw new HttpsError(
        "invalid-argument",
        "Valid GPS coordinates are required."
      );
    }

    if (
      typeof data.accuracy !== "number" ||
      !Number.isFinite(data.accuracy) ||
      data.accuracy < 0 ||
      data.accuracy > 100000
    ) {
      throw new HttpsError(
        "invalid-argument",
        "Invalid GPS accuracy."
      );
    }

    if (
      data.message !== undefined &&
      (
        typeof data.message !== "string" ||
        data.message.length > 500
      )
    ) {
      throw new HttpsError(
        "invalid-argument",
        "The message must be 500 characters or fewer."
      );
    }

    const qrId = data.qrId;
    const latitude = data.latitude;
    const longitude = data.longitude;
    const accuracy = Math.round(data.accuracy);
    const message =
      typeof data.message === "string"
        ? data.message.trim()
        : "";

    const publicRef = db.doc(`publicEmergencyQrs/${qrId}`);
    const registryRef = db.doc(`emergencyQrRegistry/${qrId}`);

    // One cooldown document per QR.
    // Client SDK access must remain denied by Firestore rules.
    const cooldownRef = db.doc(
      `emergencyNotificationLimits/${qrId}`
    );

    let recipientEmails: string[] = [];
    let patientName = "";

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

      const publicData = publicSnap.data();
      const registry = registrySnap.data();

      if (
        !publicSnap.exists ||
        !registrySnap.exists ||
        publicData?.status !== "ACTIVE" ||
        publicData.qrId !== qrId ||
        typeof publicData.ownerId !== "string" ||
        registry?.qrId !== qrId ||
        registry.ownerId !== publicData.ownerId ||
        registry.profileId !== publicData.ownerId
      ) {
        throw new HttpsError(
          "failed-precondition",
          "This emergency QR is not active."
        );
      }

      const ownerId = publicData.ownerId as string;

      const profileRef = db.doc(
        `emergencyProfiles/${ownerId}`
      );

      const personalQrRef = db.doc(
        `personalEmergencyQrs/${ownerId}`
      );

      const [profileSnap, personalQrSnap] =
        await Promise.all([
          tx.get(profileRef),
          tx.get(personalQrRef),
        ]);

      const profile = profileSnap.data();
      const personalQr = personalQrSnap.data();

      if (
        !profileSnap.exists ||
        !personalQrSnap.exists ||
        profile?.ownerId !== ownerId ||
        profile.consentGiven !== true ||
        profile.updatedAt !== publicData.sourceUpdatedAt ||
        personalQr?.id !== qrId ||
        personalQr.ownerId !== ownerId ||
        personalQr.profileId !== ownerId ||
        personalQr.status !== "ACTIVE"
      ) {
        throw new HttpsError(
          "failed-precondition",
          "This emergency profile is unavailable."
        );
      }

      const contacts = Array.isArray(
        profile.emergencyContacts
      )
        ? (profile.emergencyContacts as Contact[])
        : [];

      recipientEmails = [
        ...new Set(
          contacts
            .filter(
              (contact) =>
                contact &&
                validEmail(contact.email)
            )
            .map(
              (contact) =>
                (contact.email as string)
                  .trim()
                  .toLowerCase()
            )
        ),
      ];

      if (recipientEmails.length === 0) {
        throw new HttpsError(
          "failed-precondition",
          "No notification email addresses are registered."
        );
      }

      const now = Date.now();
      const previous = cooldownSnap.data()?.lastAttemptAt;

      if (
        previous instanceof Timestamp &&
        now - previous.toMillis() < COOLDOWN_MS
      ) {
        throw new HttpsError(
          "resource-exhausted",
          "A notification was recently requested. " +
          "Please call the emergency contacts directly " +
          "or try again later."
        );
      }

      patientName =
        typeof profile.fullName === "string"
          ? cleanLine(profile.fullName).slice(0, 120)
          : "HealthPassport user";

      // Reserve the cooldown atomically before SMTP delivery.
      // This prevents concurrent requests from sending duplicates.
      tx.set(cooldownRef, {
        qrId,
        lastAttemptAt: Timestamp.fromMillis(now),
        lastAttemptStatus: "PENDING",
      });
    });

    const googleMapsUrl =
      "https://www.google.com/maps/search/?api=1&query=" +
      encodeURIComponent(`${latitude},${longitude}`);

    const appleMapsUrl =
      "https://maps.apple.com/?ll=" +
      encodeURIComponent(`${latitude},${longitude}`);

    const emailText = [
      "HEALTHPASSPORT EMERGENCY NOTIFICATION",
      "",
      `Emergency profile: ${patientName}`,
      "",
      "Someone scanned this person's emergency QR " +
        "and requested that their emergency contacts be notified.",
      "",
      "SCANNER'S REPORTED LOCATION",
      `Latitude: ${latitude}`,
      `Longitude: ${longitude}`,
      `Reported GPS accuracy: approximately ${accuracy} metres`,
      "",
      `Google Maps: ${googleMapsUrl}`,
      `Apple Maps: ${appleMapsUrl}`,
      "",
      "MESSAGE FROM THE SCANNER",
      message || "No additional message provided.",
      "",
      "IMPORTANT",
      "These coordinates are from the scanner's device. " +
        "They are not independently verified and may not " +
        "represent the patient's exact location.",
      "",
      "If this is an emergency, contact local emergency " +
        "services immediately. Do not rely solely on email.",
    ].join("\n");

    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: {
        user: emailUser.value(),
        pass: emailPassword.value(),
      },
    });

    let acceptedCount = 0;

    // Send separately so recipients cannot see one another's
    // email addresses.
    for (const recipient of recipientEmails) {
      try {
        const result = await transporter.sendMail({
          from: {
            name: "HealthPassport Emergency QR",
            address: emailUser.value(),
          },
          to: recipient,
          subject:
            `Emergency QR notification: ${patientName}`,
          text: emailText,
        });

        if (
          result.accepted.some(
            (address) =>
              address.toLowerCase() === recipient
          )
        ) {
          acceptedCount++;
        }
      } catch (error) {
        // Do not expose SMTP errors or recipient addresses
        // to an anonymous scanner.
        console.error(
          "Emergency notification SMTP failure:",
          error instanceof Error ? error.message : "Unknown error"
        );
      }
    }

    await cooldownRef.update({
      lastAttemptStatus:
        acceptedCount > 0 ? "ACCEPTED" : "FAILED",
      acceptedCount,
    });

    if (acceptedCount === 0) {
      throw new HttpsError(
        "unavailable",
        "The notification could not be accepted by the email service. " +
        "Please call an emergency contact directly."
      );
    }

    return {
      success: true,
      acceptedCount,
      message:
        "The email service accepted the emergency notification. " +
        "Inbox delivery is not guaranteed.",
    };
  }
);