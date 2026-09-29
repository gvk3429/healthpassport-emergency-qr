
import { after, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";

import {
  initializeApp,
  deleteApp,
} from "firebase-admin/app";

import {
  getFirestore,
  Timestamp,
} from "firebase-admin/firestore";

const projectId =
  process.env.GCLOUD_PROJECT ||
  process.env.FIREBASE_PROJECT_ID ||
  JSON.parse(
    readFileSync(".firebaserc", "utf8")
  ).projects.default;

const firestoreHost =
  process.env.FIRESTORE_EMULATOR_HOST ||
  "127.0.0.1:8080";

const functionsHost =
  process.env.FUNCTIONS_EMULATOR_HOST ||
  "127.0.0.1:5001";

// Force emulator use. Never seed production data.
process.env.FIRESTORE_EMULATOR_HOST =
  firestoreHost.replace(/^https?:\/\//, "");

const app = initializeApp(
  { projectId },
  `notification-cooldown-${randomUUID()}`
);

const db = getFirestore(app);

const baseUrl =
  `http://${functionsHost.replace(/^https?:\/\//, "")}` +
  `/${projectId}/asia-south1`;

const privacy = {
  showPhoto: false,
  showDateOfBirth: false,
  showBloodGroup: true,
  showAllergies: true,
  showMedicalConditions: false,
  showMedications: false,
  showEmergencyContacts: true,
  showEmergencyInstructions: false,
};

function uniqueQrId() {
  return randomUUID();
}

async function seedActiveQr({
  staleProfile = false,
  cooldown = false,
} = {}) {
  const qrId = uniqueQrId();
  const ownerId = `test-${randomUUID()}`;
  const updatedAt = new Date().toISOString();

  await db.doc(
    `emergencyProfiles/${ownerId}`
  ).set({
    ownerId,
    fullName: "Notification Test",
    photoUrl: "",
    dateOfBirth: "",
    bloodGroup: "Unknown",
    allergies: [],
    medicalConditions: [],
    medications: [],
    emergencyContacts: [
      {
        id: "contact-1",
        name: "Test Contact",
        relationship: "Family",
        phone: "0000000000",
        email: "test@example.com",
        isPrimary: true,
      },
    ],
    emergencyInstructions: "",
    privacy,
    consentGiven: true,
    consentUpdatedAt: updatedAt,
    createdAt: updatedAt,
    updatedAt,
  });

  await db.doc(
    `personalEmergencyQrs/${ownerId}`
  ).set({
    id: qrId,
    ownerId,
    profileId: ownerId,
    status: "ACTIVE",
    createdAt: updatedAt,
    updatedAt,
    activatedAt: updatedAt,
    deactivatedAt: null,
  });

  await db.doc(
    `emergencyQrRegistry/${qrId}`
  ).set({
    qrId,
    ownerId,
    profileId: ownerId,
    createdAt: Timestamp.now(),
  });

  await db.doc(
    `publicEmergencyQrs/${qrId}`
  ).set({
    qrId,
    ownerId,
    status: "ACTIVE",
    fullName: "Notification Test",
    sourceUpdatedAt: staleProfile
      ? "2020-01-01T00:00:00.000Z"
      : updatedAt,
    updatedAt: Timestamp.now(),
    publishedAt: Timestamp.now(),
  });

  if (cooldown) {
    await db.doc(
      `emergencyNotificationLimits/${qrId}`
    ).set({
      qrId,
      lastAttemptAt: Timestamp.now(),
      lastAttemptStatus: "PENDING",
      acceptedCount: 0,
      recipientCount: 1,
    });
  }

  return { qrId, ownerId };
}

async function notify(qrId) {
  const response = await fetch(
    `${baseUrl}/notifyEmergencyContacts`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        data: { qrId },
      }),
      signal: AbortSignal.timeout(45000),
    }
  );

  return response.json();
}

function expectError(response, status) {
  assert.equal(
    response.error?.status,
    status,
    JSON.stringify(response)
  );
}

test(
  "01 - Recent notification enforces cooldown",
  async () => {
    const { qrId } = await seedActiveQr({
      cooldown: true,
    });

    const response = await notify(qrId);

    expectError(
      response,
      "RESOURCE_EXHAUSTED"
    );
  }
);

test(
  "02 - Concurrent requests cannot bypass an existing cooldown",
  async () => {
    const { qrId } = await seedActiveQr({
      cooldown: true,
    });

    const responses = await Promise.all(
      Array.from(
        { length: 5 },
        () => notify(qrId)
      )
    );

    for (const response of responses) {
      expectError(
        response,
        "RESOURCE_EXHAUSTED"
      );
    }

    const cooldown = await db.doc(
      `emergencyNotificationLimits/${qrId}`
    ).get();

    assert.equal(
      cooldown.data()?.lastAttemptStatus,
      "PENDING"
    );

    assert.equal(
      cooldown.data()?.acceptedCount,
      0
    );
  }
);

test(
  "03 - Stale public profile blocks notification",
  async () => {
    const { qrId } = await seedActiveQr({
      staleProfile: true,
    });

    const response = await notify(qrId);

    expectError(
      response,
      "FAILED_PRECONDITION"
    );

    const cooldown = await db.doc(
      `emergencyNotificationLimits/${qrId}`
    ).get();

    assert.equal(
      cooldown.exists,
      false
    );
  }
);

after(async () => {
  await deleteApp(app);
});