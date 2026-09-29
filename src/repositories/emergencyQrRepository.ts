
import {
  deleteDoc,
  doc,
  getDoc,
} from "firebase/firestore";

import { getApp } from "firebase/app";

import { getAuth } from "firebase/auth";

import {
  getFunctions,
  httpsCallable,
} from "firebase/functions";

import { db } from "../lib/firebase";

import type {
  EmergencyQr,
} from "../types/emergencyQr";

const COLLECTION = "personalEmergencyQrs";

const functions = getFunctions(
  getApp(),
  "asia-south1"
);

interface CreateQrResponse {
  success: boolean;
  qr: EmergencyQr;
}

interface DeleteQrResponse {
  success: boolean;
}

function requireOwner(ownerId: string): void {
  const currentUser = getAuth(
    getApp()
  ).currentUser;

  if (
    !currentUser ||
    currentUser.uid !== ownerId
  ) {
    throw new Error(
      "You must be signed in as the QR owner."
    );
  }
}

export async function getPersonalEmergencyQr(
  ownerId: string
): Promise<EmergencyQr | null> {
  const reference = doc(
    db,
    COLLECTION,
    ownerId
  );

  const snapshot = await getDoc(reference);

  if (!snapshot.exists()) {
    return null;
  }

  return snapshot.data() as EmergencyQr;
}

export async function createPersonalEmergencyQr(
  ownerId: string
): Promise<EmergencyQr> {
  requireOwner(ownerId);

  const callable = httpsCallable<
    void,
    CreateQrResponse
  >(
    functions,
    "createEmergencyQr"
  );

  const result = await callable();

  if (
    !result.data.success ||
    !result.data.qr
  ) {
    throw new Error(
      "Unable to create your emergency QR."
    );
  }

  return result.data.qr;
}

export async function deletePersonalEmergencyQr(
  ownerId: string
): Promise<void> {
  requireOwner(ownerId);

  const reference = doc(
    db,
    COLLECTION,
    ownerId
  );

  const snapshot = await getDoc(reference);

  if (!snapshot.exists()) {
    throw new Error(
      "Emergency QR not found."
    );
  }

  const qr = snapshot.data() as EmergencyQr;

  if (qr.status === "DRAFT") {
    // Draft deletion is permitted by Firestore rules.
    await deleteDoc(reference);
    return;
  }

  if (qr.status === "INACTIVE") {
    // Previously activated identifiers must be retired
    // by the backend, never deleted directly by clients.
    const callable = httpsCallable<
      void,
      DeleteQrResponse
    >(
      functions,
      "deleteEmergencyQr"
    );

    const result = await callable();

    if (!result.data.success) {
      throw new Error(
        "Unable to delete your inactive QR."
      );
    }

    return;
  }

  throw new Error(
    "Deactivate your QR before deleting it."
  );
}