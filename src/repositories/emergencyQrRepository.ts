
import {
  deleteDoc,
  doc,
  getDoc,
  setDoc,
} from "firebase/firestore";

import { db } from "../lib/firebase";

import type {
  EmergencyQr,
} from "../types/emergencyQr";

const COLLECTION = "personalEmergencyQrs";

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
  const reference = doc(
    db,
    COLLECTION,
    ownerId
  );

  const existing = await getDoc(reference);

  if (existing.exists()) {
    return existing.data() as EmergencyQr;
  }

  const now = new Date().toISOString();

  const qr: EmergencyQr = {
    id: crypto.randomUUID(),
    ownerId,
    profileId: ownerId,
    status: "DRAFT",
    createdAt: now,
    updatedAt: now,
    activatedAt: null,
    deactivatedAt: null,
  };

  await setDoc(reference, qr);

  return qr;
}

export async function deletePersonalEmergencyQr(
  ownerId: string
): Promise<void> {
  await deleteDoc(
    doc(db, COLLECTION, ownerId)
  );
}