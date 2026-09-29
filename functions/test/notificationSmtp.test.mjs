
import {
  after,
  afterEach,
  test,
} from "node:test";

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

// Run this test only against Firebase emulators.
// The backend must use the emulator-only SMTP transport.

const projectId =
  process.env.GCLOUD_PROJECT ||
  process.env.FIREBASE_PROJECT_ID ||
  JSON.parse(
    readFileSync(".firebaserc", "utf8")
  ).projects.default;

const firestoreHost = (
  process.env.FIRESTORE_EMULATOR_HOST ||
  "127.0.0.1:8080"
).replace(/^https?:\/\//, "");

const functionsHost = (
  process.env.FUNCTIONS_EMULATOR_HOST ||
  "127.0.0.1:5001"
).replace(/^https?:\/\//, "");

process.env.FIRESTORE_EMULATOR_HOST =
  firestoreHost;

const app = initializeApp(
  { projectId },
  `smtp-reliability-${randomUUID()}`
);

const db = getFirestore(app);

const functionUrl =
  `http://${functionsHost}` +
  `/${projectId}/asia-south1/notifyEmergencyContacts`;

const createdDocuments = [];

function doc(path) {
  const reference = db.doc(path);
  createdDocuments.push(reference);
  return reference;
}

async function createTestQr(emails) {
  const qrId = randomUUID();
  const ownerId = `smtp-test-${randomUUID()}`;
  const now = new Date().toISOString();

  const profileRef = doc(
    `emergencyProfiles/${ownerId}`
  );

  const personalRef = doc(
    `personalEmergencyQrs/${ownerId}`
  );

  const registryRef = doc(
    `emergencyQrRegistry/${qrId}`
  );

  const publicRef = doc(
    `publicEmergencyQrs/${qrId}`
  );

  const cooldownRef = doc(
    `emergencyNotificationLimits/${qrId}`
  );

  const contacts = emails.map(
    (email, index) => ({
      id: `contact-${index + 1}`,
      name: `Test Contact ${index + 1}`,
      relationship: "Family",
      phone: "0000000000",
      email,
      isPrimary: index === 0,
    })
  );

  const batch = db.batch();

  batch.set(profileRef, {
    ownerId,
    fullName: "SMTP Test Patient",
    photoUrl: "",
    dateOfBirth: "",
    bloodGroup: "Unknown",
    allergies: [],
    medicalConditions: [],
    medications: [],
    emergencyContacts: contacts,
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
    updatedAt: now,
  });

  batch.set(personalRef, {
    id: qrId,
    ownerId,
    profileId: ownerId,
    status: "ACTIVE",
    createdAt: now,
    updatedAt: now,
    activatedAt: now,
    deactivatedAt: null,
  });

  batch.set(registryRef, {
    qrId,
    ownerId,
    profileId: ownerId,
    createdAt: Timestamp.now(),
  });

  batch.set(publicRef, {
    qrId,
    ownerId,
    status: "ACTIVE",
    fullName: "SMTP Test Patient",
    sourceUpdatedAt: now,
    updatedAt: Timestamp.now(),
    publishedAt: Timestamp.now(),
  });

  await batch.commit();

  return {
    qrId,
    cooldownRef,
  };
}

async function notify(qrId) {
  const response = await fetch(functionUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      data: {
        qrId,
      },
    }),
    signal: AbortSignal.timeout(60000),
  });

  const payload = await response.json();

  return {
    httpStatus: response.status,
    ...payload,
  };
}

function assertSuccess(response) {
  assert.equal(
    response.httpStatus,
    200,
    JSON.stringify(response)
  );

  assert.equal(
    response.result?.success,
    true,
    JSON.stringify(response)
  );
}

function assertError(response, status) {
  assert.equal(
    response.error?.status,
    status,
    JSON.stringify(response)
  );
}

async function readOutcome(cooldownRef) {
  const snapshot = await cooldownRef.get();

  assert.equal(
    snapshot.exists,
    true,
    "Notification outcome record is missing."
  );

  return snapshot.data();
}

test(
  "01 - SMTP accepts every recipient",
  { timeout: 90000 },
  async () => {
    const { qrId, cooldownRef } =
      await createTestQr([
        "accept-one@example.com",
        "accept-two@example.com",
      ]);

    const response = await notify(qrId);

    assertSuccess(response);

    assert.equal(
      response.result.acceptedCount,
      2
    );

    assert.equal(
      response.result.recipientCount,
      2
    );

    assert.equal(
      response.result.partialSuccess,
      false
    );

    const outcome =
      await readOutcome(cooldownRef);

    assert.equal(
      outcome.lastAttemptStatus,
      "ACCEPTED"
    );

    assert.equal(outcome.acceptedCount, 2);
    assert.equal(outcome.failedCount, 0);
    assert.equal(outcome.recipientCount, 2);
  }
);

test(
  "02 - One recipient is rejected",
  { timeout: 90000 },
  async () => {
    const { qrId, cooldownRef } =
      await createTestQr([
        "accept@example.com",
        "reject@example.com",
      ]);

    const response = await notify(qrId);

    assertSuccess(response);

    assert.equal(
      response.result.acceptedCount,
      1
    );

    assert.equal(
      response.result.recipientCount,
      2
    );

    assert.equal(
      response.result.partialSuccess,
      true
    );

    const outcome =
      await readOutcome(cooldownRef);

    assert.equal(
      outcome.lastAttemptStatus,
      "PARTIAL"
    );

    assert.equal(outcome.acceptedCount, 1);
    assert.equal(outcome.failedCount, 1);
    assert.equal(outcome.recipientCount, 2);
  }
);

test(
  "03 - Every recipient is rejected",
  { timeout: 90000 },
  async () => {
    const { qrId, cooldownRef } =
      await createTestQr([
        "reject@example.com",
      ]);

    const response = await notify(qrId);

    assertError(response, "UNAVAILABLE");

    const outcome =
      await readOutcome(cooldownRef);

    assert.equal(
      outcome.lastAttemptStatus,
      "FAILED"
    );

    assert.equal(outcome.acceptedCount, 0);
    assert.equal(outcome.failedCount, 1);
    assert.equal(outcome.recipientCount, 1);
  }
);

test(
  "04 - Five concurrent first-time requests",
  { timeout: 120000 },
  async () => {
    const { qrId, cooldownRef } =
      await createTestQr([
        "concurrent@example.com",
      ]);

    const responses = await Promise.all(
      Array.from(
        { length: 5 },
        () => notify(qrId)
      )
    );

    const successes = responses.filter(
      (response) =>
        response.result?.success === true
    );

    const blocked = responses.filter(
      (response) =>
        response.error?.status ===
        "RESOURCE_EXHAUSTED"
    );

    assert.equal(
      successes.length,
      1,
      JSON.stringify(responses)
    );

    assert.equal(
      blocked.length,
      4,
      JSON.stringify(responses)
    );

    assert.equal(
      successes[0].result.acceptedCount,
      1
    );

    const outcome =
      await readOutcome(cooldownRef);

    assert.equal(
      outcome.lastAttemptStatus,
      "ACCEPTED"
    );

    assert.equal(outcome.acceptedCount, 1);
    assert.equal(outcome.recipientCount, 1);
  }
);

// Delete only synthetic documents created by this test.
// Do not clear the entire emulator database.

afterEach(async () => {
  const references = createdDocuments.splice(0);

  for (
    let index = 0;
    index < references.length;
    index += 400
  ) {
    const batch = db.batch();

    for (
      const reference of references.slice(
        index,
        index + 400
      )
    ) {
      batch.delete(reference);
    }

    await batch.commit();
  }
});

after(async () => {
  await deleteApp(app);
});