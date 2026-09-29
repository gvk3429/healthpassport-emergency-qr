
import test from "node:test";
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

const projectId = JSON.parse(
  readFileSync(".firebaserc", "utf8")
).projects.default;

const FIRESTORE_HOST = "127.0.0.1:8080";
const FUNCTION_URL =
  `http://127.0.0.1:5001/` +
  `${projectId}/asia-south1/notifyEmergencyContacts`;

const CONTROL_URL =
  "http://127.0.0.1:2526";

process.env.FIRESTORE_EMULATOR_HOST =
  FIRESTORE_HOST;

const app = initializeApp(
  { projectId },
  `smtp-count-${randomUUID()}`
);

const db = getFirestore(app);

async function control(path, method = "GET") {
  const response = await fetch(
    `${CONTROL_URL}${path}`,
    {
      method,
      signal: AbortSignal.timeout(5000),
    }
  );

  assert.equal(
    response.status,
    200,
    `SMTP control endpoint failed: ${path}`
  );

  return response.json();
}

async function notify(qrId) {
  const response = await fetch(
    FUNCTION_URL,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        data: { qrId },
      }),
      signal: AbortSignal.timeout(60000),
    }
  );

  return response.json();
}

test(
  "Concurrent first-time requests produce exactly one SMTP message",
  { timeout: 120000 },
  async () => {
    const qrId = randomUUID();
    const ownerId =
      `smtp-count-${randomUUID()}`;

    const updatedAt =
      new Date().toISOString();

    const paths = [
      `emergencyProfiles/${ownerId}`,
      `personalEmergencyQrs/${ownerId}`,
      `emergencyQrRegistry/${qrId}`,
      `publicEmergencyQrs/${qrId}`,
      `emergencyNotificationLimits/${qrId}`,
    ];

    const refs = paths.map(
      (path) => db.doc(path)
    );

    // Ensure the mock server is reachable before
    // creating test data or sending requests.
    await control("/reset", "POST");

    try {
      const batch = db.batch();

      batch.set(refs[0], {
  ownerId,
  fullName: "SMTP Count Test",
  photoUrl: "",
  dateOfBirth: "",
  bloodGroup: "Unknown",
  allergies: [],
  medicalConditions: [],
  medications: [],
  emergencyContacts: [
    {
      id: "contact-1",
      name: "Synthetic Contact",
      relationship: "Family",
      phone: "0000000000",
      email: "count@example.com",
      isPrimary: true,
    },
  ],
  emergencyInstructions: "",
  privacy: {
    showPhoto: false,
    showDateOfBirth: false,
    showBloodGroup: false,
    showAllergies: false,
    showMedicalConditions: false,
    showMedications: false,
    showEmergencyContacts: false,
    showEmergencyInstructions: false,
  },
  consentGiven: true,
  updatedAt,
});

batch.set(refs[1], {
  id: qrId,
  ownerId,
  profileId: ownerId,
  status: "ACTIVE",
  createdAt: updatedAt,
  updatedAt,
  activatedAt: updatedAt,
  deactivatedAt: null,
});

batch.set(refs[2], {
  qrId,
  ownerId,
  profileId: ownerId,
  createdAt: Timestamp.now(),
});

batch.set(refs[3], {
  qrId,
  ownerId,
  status: "ACTIVE",
  fullName: "SMTP Count Test",
  sourceUpdatedAt: updatedAt,
  updatedAt: Timestamp.now(),
  publishedAt: Timestamp.now(),
});

      await batch.commit();

      const responses = await Promise.all(
        Array.from(
          { length: 5 },
          () => notify(qrId)
        )
      );

      const successful = responses.filter(
        (response) =>
          response.result?.success === true
      );

      const blocked = responses.filter(
        (response) =>
          response.error?.status ===
          "RESOURCE_EXHAUSTED"
      );

      assert.equal(
        successful.length,
        1,
        JSON.stringify(responses)
      );

      assert.equal(
        blocked.length,
        4,
        JSON.stringify(responses)
      );

      const smtp = await control(
        "/messages"
      );

      assert.equal(
        smtp.messageCount,
        1,
        JSON.stringify(smtp)
      );

      assert.equal(
  smtp.messages[0].recipients.length,
  1
);

assert.match(
  smtp.messages[0].recipients[0],
  /count@example\.com/i
);

      const cooldown =
        await refs[4].get();

      assert.equal(
        cooldown.data()?.lastAttemptStatus,
        "ACCEPTED"
      );

      assert.equal(
        cooldown.data()?.acceptedCount,
        1
      );
    } finally {
      // Remove only this test's synthetic data.
      const cleanup = db.batch();

      for (const ref of refs) {
        cleanup.delete(ref);
      }

      try {
        await cleanup.commit();
      } finally {
        await deleteApp(app);
      }
    }
  }
);