import { randomUUID } from "node:crypto";

import { initializeApp } from "firebase-admin/app";

import {
  FieldValue,
  getFirestore,
  Transaction,
} from "firebase-admin/firestore";

import {
  HttpsError,
  onCall,
} from "firebase-functions/v2/https";

import {
  onDocumentWritten,
} from "firebase-functions/v2/firestore";

initializeApp();

const db = getFirestore();
const REGION = "asia-south1";

type Privacy = {
  showPhoto: boolean;
  showDateOfBirth: boolean;
  showBloodGroup: boolean;
  showAllergies: boolean;
  showMedicalConditions: boolean;
  showMedications: boolean;
  showEmergencyContacts: boolean;
  showEmergencyInstructions: boolean;
};

type EmergencyContact = {
  id?: string;
  name: string;
  relationship: string;
  phone: string;
  email?: string;
  isPrimary: boolean;
};

type Profile = {
  ownerId: string;
  fullName: string;
  photoUrl: string;
  dateOfBirth: string;
  bloodGroup: string;
  allergies: string[];
  medicalConditions: string[];
  medications: string[];
  emergencyContacts: EmergencyContact[];
  emergencyInstructions: string;
  privacy: Privacy;
  consentGiven: boolean;
  updatedAt: string;
};

type PersonalQr = {
  id: string;
  ownerId: string;
  profileId: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  activatedAt: string | null;
  deactivatedAt: string | null;
};

const PRIVACY_FIELDS: (keyof Privacy)[] = [
  "showPhoto",
  "showDateOfBirth",
  "showBloodGroup",
  "showAllergies",
  "showMedicalConditions",
  "showMedications",
  "showEmergencyContacts",
  "showEmergencyInstructions",
];

const BLOOD_GROUPS = [
  "Unknown",
  "A+",
  "A-",
  "B+",
  "B-",
  "AB+",
  "AB-",
  "O+",
  "O-",
];

function validQrId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[A-Za-z0-9_-]{20,100}$/.test(value)
  );
}

function validString(
  value: unknown,
  max: number,
  required = false
): value is string {
  return (
    typeof value === "string" &&
    value.length <= max &&
    (!required || value.trim().length > 0)
  );
}

function validStringArray(
  value: unknown,
  maxItems: number
): value is string[] {
  return (
    Array.isArray(value) &&
    value.length <= maxItems &&
    value.every((item) => validString(item, 500))
  );
}

function validContactEmail(value: unknown): boolean {
  if (value === undefined || value === "") {
    return true;
  }

  return (
    typeof value === "string" &&
    value.length <= 254 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
  );
}

function validEmergencyContact(
  contact: EmergencyContact
): boolean {
  return (
    contact !== null &&
    typeof contact === "object" &&
    (
      contact.id === undefined ||
      validString(contact.id, 100, true)
    ) &&
    validString(contact.name, 120, true) &&
    validString(contact.relationship, 120) &&
    validString(contact.phone, 30, true) &&
    validContactEmail(contact.email) &&
    typeof contact.isPrimary === "boolean"
  );
}

function validProfile(
  profile: Profile,
  uid: string
): boolean {
  if (!profile || typeof profile !== "object") {
    return false;
  }

  if (
    profile.ownerId !== uid ||
    profile.consentGiven !== true ||
    !validString(profile.fullName, 120, true) ||
    !validString(profile.photoUrl, 2048) ||
    !validString(profile.dateOfBirth, 10) ||
    !validString(profile.emergencyInstructions, 2000) ||
    !validString(profile.updatedAt, 50, true)
  ) {
    return false;
  }

  if (!BLOOD_GROUPS.includes(profile.bloodGroup)) {
    return false;
  }

  if (
    !validStringArray(profile.allergies, 30) ||
    !validStringArray(profile.medicalConditions, 30) ||
    !validStringArray(profile.medications, 30)
  ) {
    return false;
  }

  if (
    !profile.privacy ||
    typeof profile.privacy !== "object" ||
    !PRIVACY_FIELDS.every(
      (field) =>
        typeof profile.privacy[field] === "boolean"
    )
  ) {
    return false;
  }

  if (
    !Array.isArray(profile.emergencyContacts) ||
    profile.emergencyContacts.length < 1 ||
    profile.emergencyContacts.length > 10 ||
    !profile.emergencyContacts.every(validEmergencyContact)
  ) {
    return false;
  }

  return (
    profile.emergencyContacts.filter(
      (contact) => contact.isPrimary === true
    ).length === 1
  );
}

function publicProjection(
  profile: Profile,
  qrId: string,
  ownerId: string
): Record<string, unknown> {
  const result: Record<string, unknown> = {
    qrId,
    ownerId,
    status: "ACTIVE",
    fullName: profile.fullName.trim(),
    sourceUpdatedAt: profile.updatedAt,
    updatedAt: FieldValue.serverTimestamp(),
    publishedAt: FieldValue.serverTimestamp(),
  };

  const privacy = profile.privacy;

  if (privacy.showPhoto && profile.photoUrl) {
    result.photoUrl = profile.photoUrl;
  }

  if (
    privacy.showDateOfBirth &&
    profile.dateOfBirth
  ) {
    result.dateOfBirth = profile.dateOfBirth;
  }

  if (
    privacy.showBloodGroup &&
    profile.bloodGroup !== "Unknown"
  ) {
    result.bloodGroup = profile.bloodGroup;
  }

  if (privacy.showAllergies) {
    result.allergies = profile.allergies;
  }

  if (privacy.showMedicalConditions) {
    result.medicalConditions =
      profile.medicalConditions;
  }

  if (privacy.showMedications) {
    result.medications = profile.medications;
  }

  if (privacy.showEmergencyContacts) {
    // Email addresses are deliberately excluded.
    result.emergencyContacts =
      profile.emergencyContacts.map((contact) => ({
        name: contact.name,
        relationship: contact.relationship,
        phone: contact.phone,
        isPrimary: contact.isPrimary,
      }));
  }

  if (privacy.showEmergencyInstructions) {
    result.emergencyInstructions =
      profile.emergencyInstructions;
  }

  return result;
}

function requireVerifiedUser(
  request: {
    auth?: {
      uid: string;
      token: {
        email_verified?: boolean;
      };
    };
  }
): string {
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

  return request.auth.uid;
}

function assertQrOwnership(
  qr: PersonalQr,
  uid: string
): void {
  if (
    qr.ownerId !== uid ||
    qr.profileId !== uid ||
    !validQrId(qr.id)
  ) {
    throw new HttpsError(
      "permission-denied",
      "QR ownership or identifier is invalid."
    );
  }
}

function registryRef(qrId: string) {
  return db.doc(`emergencyQrRegistry/${qrId}`);
}

function publicQrRef(qrId: string) {
  return db.doc(`publicEmergencyQrs/${qrId}`);
}

// ============================================================
// CREATE AND RESERVE PERSONAL EMERGENCY QR
// ============================================================

export const createEmergencyQr = onCall(
  {
    region: REGION,
  },
  async (request) => {
    const uid = requireVerifiedUser(request);

    const profileRef = db.doc(
      `emergencyProfiles/${uid}`
    );

    const qrRef = db.doc(
      `personalEmergencyQrs/${uid}`
    );

    const qr = await db.runTransaction(
      async (tx: Transaction): Promise<PersonalQr> => {
        const [profileSnap, qrSnap] =
          await Promise.all([
            tx.get(profileRef),
            tx.get(qrRef),
          ]);

        if (!profileSnap.exists) {
          throw new HttpsError(
            "failed-precondition",
            "Create your emergency profile first."
          );
        }

        const profile = profileSnap.data() as Profile;

        if (!validProfile(profile, uid)) {
          throw new HttpsError(
            "failed-precondition",
            "Complete your emergency profile and consent."
          );
        }

        // Preserve existing drafts and active QR codes.
        const existingQr = qrSnap.exists
          ? (qrSnap.data() as PersonalQr)
          : null;

        if (existingQr) {
          assertQrOwnership(existingQr, uid);
        }

        const qrId = existingQr
          ? existingQr.id
          : randomUUID();

        const registry = registryRef(qrId);
        const publicRef = publicQrRef(qrId);

        // All reads must precede transaction writes.
        const [registrySnap, publicSnap] =
          await Promise.all([
            tx.get(registry),
            tx.get(publicRef),
          ]);

        if (registrySnap.exists) {
          const registryData = registrySnap.data();

          if (
            registryData?.ownerId !== uid ||
            registryData?.profileId !== uid ||
            registryData?.qrId !== qrId
          ) {
            throw new HttpsError(
              "already-exists",
              "This QR identifier is already assigned."
            );
          }
        }

        if (
          publicSnap.exists &&
          (
            publicSnap.data()?.ownerId !== uid ||
            publicSnap.data()?.qrId !== qrId
          )
        ) {
          throw new HttpsError(
            "already-exists",
            "This QR identifier is already in use."
          );
        }

        if (!registrySnap.exists) {
          tx.create(registry, {
            qrId,
            ownerId: uid,
            profileId: uid,
            createdAt:
              FieldValue.serverTimestamp(),
          });
        }

        if (existingQr) {
          return existingQr;
        }

        const now = new Date().toISOString();

        const newQr: PersonalQr = {
          id: qrId,
          ownerId: uid,
          profileId: uid,
          status: "DRAFT",
          createdAt: now,
          updatedAt: now,
          activatedAt: null,
          deactivatedAt: null,
        };

        tx.create(qrRef, newQr);

        return newQr;
      }
    );

    return {
      success: true,
      qr,
    };
  }
);

// ============================================================
// ACTIVATE EMERGENCY QR
// ============================================================

export const activateEmergencyQr = onCall(
  {
    region: REGION,
  },
  async (request) => {
    const uid = requireVerifiedUser(request);

    const profileRef = db.doc(
      `emergencyProfiles/${uid}`
    );

    const qrRef = db.doc(
      `personalEmergencyQrs/${uid}`
    );

    await db.runTransaction(
      async (tx: Transaction) => {
        const [profileSnap, qrSnap] =
          await Promise.all([
            tx.get(profileRef),
            tx.get(qrRef),
          ]);

        if (
          !profileSnap.exists ||
          !qrSnap.exists
        ) {
          throw new HttpsError(
            "failed-precondition",
            "Create your profile and QR first."
          );
        }

        const profile =
          profileSnap.data() as Profile;

        const qr =
          qrSnap.data() as PersonalQr;

        assertQrOwnership(qr, uid);

        if (!validProfile(profile, uid)) {
          throw new HttpsError(
            "failed-precondition",
            "Complete your emergency profile and consent."
          );
        }

        if (
          ![
            "DRAFT",
            "INACTIVE",
            "ACTIVE",
          ].includes(qr.status)
        ) {
          throw new HttpsError(
            "failed-precondition",
            "Invalid QR status."
          );
        }

        const registry = registryRef(qr.id);
        const publicRef = publicQrRef(qr.id);

        const [registrySnap, publicSnap] =
          await Promise.all([
            tx.get(registry),
            tx.get(publicRef),
          ]);

        if (registrySnap.exists) {
          const registryData = registrySnap.data();

          if (
            registryData?.ownerId !== uid ||
            registryData?.profileId !== uid ||
            registryData?.qrId !== qr.id
          ) {
            throw new HttpsError(
              "already-exists",
              "This QR identifier is already assigned."
            );
          }
        }

        if (
          publicSnap.exists &&
          (
            publicSnap.data()?.ownerId !== uid ||
            publicSnap.data()?.qrId !== qr.id
          )
        ) {
          throw new HttpsError(
            "already-exists",
            "This QR identifier is already in use."
          );
        }

        // Also supports legacy drafts that were created
        // before server-side reservation was introduced.
        if (!registrySnap.exists) {
          tx.create(registry, {
            qrId: qr.id,
            ownerId: uid,
            profileId: uid,
            createdAt:
              FieldValue.serverTimestamp(),
          });
        }

        const now = FieldValue.serverTimestamp();

        tx.set(
          publicRef,
          publicProjection(
            profile,
            qr.id,
            uid
          )
        );

        tx.update(qrRef, {
          status: "ACTIVE",
          activatedAt: now,
          deactivatedAt: null,
          updatedAt: now,
        });
      }
    );

    return {
      success: true,
    };
  }
);

// ============================================================
// DEACTIVATE EMERGENCY QR
// ============================================================

export const deactivateEmergencyQr = onCall(
  {
    region: REGION,
  },
  async (request) => {
    const uid = requireVerifiedUser(request);

    const qrRef = db.doc(
      `personalEmergencyQrs/${uid}`
    );

    await db.runTransaction(
      async (tx: Transaction) => {
        const qrSnap = await tx.get(qrRef);

        if (!qrSnap.exists) {
          throw new HttpsError(
            "not-found",
            "Emergency QR not found."
          );
        }

        const qr =
          qrSnap.data() as PersonalQr;

        assertQrOwnership(qr, uid);

        const registry = registryRef(qr.id);
        const publicRef = publicQrRef(qr.id);

        const [registrySnap, publicSnap] =
          await Promise.all([
            tx.get(registry),
            tx.get(publicRef),
          ]);

        if (
          registrySnap.exists &&
          (
            registrySnap.data()?.ownerId !== uid ||
            registrySnap.data()?.profileId !== uid ||
            registrySnap.data()?.qrId !== qr.id
          )
        ) {
          throw new HttpsError(
            "permission-denied",
            "QR registry ownership mismatch."
          );
        }

        if (
          publicSnap.exists &&
          publicSnap.data()?.ownerId !== uid
        ) {
          throw new HttpsError(
            "permission-denied",
            "Public QR ownership mismatch."
          );
        }

        const now = FieldValue.serverTimestamp();

        if (publicSnap.exists) {
          tx.delete(publicRef);
        }

        tx.update(qrRef, {
          status: "INACTIVE",
          deactivatedAt: now,
          updatedAt: now,
        });
      }
    );

    return {
      success: true,
    };
  }
);

// ============================================================
// SYNCHRONIZE PUBLIC QR AFTER PROFILE CHANGES
// ============================================================

export const syncEmergencyProfile =
  onDocumentWritten(
    {
      document: "emergencyProfiles/{ownerId}",
      region: REGION,
    },
    async (event) => {
      const ownerId = event.params.ownerId;

      const profileRef = db.doc(
        `emergencyProfiles/${ownerId}`
      );

      const qrRef = db.doc(
        `personalEmergencyQrs/${ownerId}`
      );

      await db.runTransaction(
        async (tx: Transaction) => {
          const [profileSnap, qrSnap] =
            await Promise.all([
              tx.get(profileRef),
              tx.get(qrRef),
            ]);

          if (!qrSnap.exists) {
            return;
          }

          const qr =
            qrSnap.data() as PersonalQr;

          if (
            qr.ownerId !== ownerId ||
            qr.profileId !== ownerId ||
            !validQrId(qr.id)
          ) {
            return;
          }

          const registry = registryRef(qr.id);
          const publicRef = publicQrRef(qr.id);

          const [registrySnap, publicSnap] =
            await Promise.all([
              tx.get(registry),
              tx.get(publicRef),
            ]);

          if (
            !registrySnap.exists ||
            registrySnap.data()?.ownerId !== ownerId ||
            registrySnap.data()?.profileId !== ownerId ||
            registrySnap.data()?.qrId !== qr.id
          ) {
            return;
          }

          if (
            publicSnap.exists &&
            publicSnap.data()?.ownerId !== ownerId
          ) {
            return;
          }

          if (
            !profileSnap.exists ||
            qr.status !== "ACTIVE"
          ) {
            if (publicSnap.exists) {
              tx.delete(publicRef);
            }

            return;
          }

          const profile =
            profileSnap.data() as Profile;

          if (!validProfile(profile, ownerId)) {
            if (publicSnap.exists) {
              tx.delete(publicRef);
            }

            return;
          }

          tx.set(
            publicRef,
            publicProjection(
              profile,
              qr.id,
              ownerId
            )
          );
        }
      );
    }
  );

export {
  notifyEmergencyContacts,
} from "./notifyEmergencyContacts";

export {
  deleteEmergencyQr,
} from "./deleteEmergencyQr";

export {
  sendEmailOtp,
  verifyEmailOtp,
} from "./emailOtp";

export {
  validateReferralCode,
  prepareReferral,
  completeReferralSetup,
  getReferralDashboardSummary,
} from "./referrals";

