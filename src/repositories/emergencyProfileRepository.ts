
import {
  doc,
  getDoc,
  setDoc,
} from "firebase/firestore";

import { db } from "../lib/firebase";

import type {
  EmergencyProfile,
} from "../types/emergencyProfile";

const COLLECTION = "emergencyProfiles";

export async function getEmergencyProfile(
  ownerId: string
): Promise<EmergencyProfile | null> {
  const reference = doc(
    db,
    COLLECTION,
    ownerId
  );

  const snapshot = await getDoc(reference);

  if (!snapshot.exists()) {
    return null;
  }

  return snapshot.data() as EmergencyProfile;
}

export async function saveEmergencyProfile(
  profile: EmergencyProfile
): Promise<void> {
  const reference = doc(
    db,
    COLLECTION,
    profile.ownerId
  );

  await setDoc(reference, profile);
}