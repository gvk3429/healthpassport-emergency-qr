
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";

const db = getFirestore();

const validQrId = (value: unknown): value is string =>
  typeof value === "string" &&
  /^[A-Za-z0-9_-]{20,100}$/.test(value);

export const deleteEmergencyQr = onCall(
  {
    region: "asia-south1",
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError(
        "unauthenticated",
        "Please sign in."
      );
    }

    if (request.auth.token.email_verified !== true) {
      throw new HttpsError(
        "permission-denied",
        "Email verification is required."
      );
    }

    const uid = request.auth.uid;

    const qrRef = db.doc(`personalEmergencyQrs/${uid}`);

    await db.runTransaction(async (tx) => {
      const qrSnap = await tx.get(qrRef);

      if (!qrSnap.exists) {
        throw new HttpsError(
          "not-found",
          "Emergency QR not found."
        );
      }

      const qr = qrSnap.data();

      if (
        qr?.ownerId !== uid ||
        qr?.profileId !== uid ||
        !validQrId(qr?.id)
      ) {
        throw new HttpsError(
          "permission-denied",
          "QR ownership or identifier is invalid."
        );
      }

      if (qr.status !== "INACTIVE") {
        throw new HttpsError(
          "failed-precondition",
          "Deactivate your QR before deleting it."
        );
      }

      const registryRef = db.doc(
        `emergencyQrRegistry/${qr.id}`
      );

      const publicRef = db.doc(
        `publicEmergencyQrs/${qr.id}`
      );

      // All transaction reads precede writes.
      const [registrySnap, publicSnap] =
        await Promise.all([
          tx.get(registryRef),
          tx.get(publicRef),
        ]);

      if (
        !registrySnap.exists ||
        registrySnap.data()?.ownerId !== uid ||
        registrySnap.data()?.profileId !== uid ||
        registrySnap.data()?.qrId !== qr.id
      ) {
        throw new HttpsError(
          "failed-precondition",
          "QR registry verification failed."
        );
      }

      if (
        publicSnap.exists &&
        (
          publicSnap.data()?.ownerId !== uid ||
          publicSnap.data()?.qrId !== qr.id
        )
      ) {
        throw new HttpsError(
          "permission-denied",
          "Public QR ownership mismatch."
        );
      }

      if (publicSnap.exists) {
        tx.delete(publicRef);
      }

      // Retain the permanent reservation.
      // This identifier must never be reassigned.
      tx.update(registryRef, {
        retiredAt: FieldValue.serverTimestamp(),
      });

      tx.delete(qrRef);
    });

    return {
      success: true,
    };
  }
);