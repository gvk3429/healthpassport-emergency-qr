
import assert from "node:assert/strict";
import { before, after, test } from "node:test";

import {
  initializeApp as initializeAdminApp,
} from "firebase-admin/app";

import {
  getAuth as getAdminAuth,
} from "firebase-admin/auth";

import {
  getFirestore,
} from "firebase-admin/firestore";

import {
  initializeApp,
} from "firebase/app";

import {
  getAuth,
  connectAuthEmulator,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  getIdToken,
} from "firebase/auth";

// ============================================================
// CONFIGURATION
// ============================================================

const PROJECT_ID = "healthpassport-emergency-qr";
const REGION = "asia-south1";

const FUNCTIONS_URL =
  `http://127.0.0.1:5001/${PROJECT_ID}/${REGION}`;

const QR_ID = "SECURITYTESTQR1234567890123456";

const PASSWORD = "SecurityTestPassword123!";

process.env.FIREBASE_AUTH_EMULATOR_HOST =
  "127.0.0.1:9099";

process.env.FIRESTORE_EMULATOR_HOST =
  "127.0.0.1:8080";

process.env.GCLOUD_PROJECT = PROJECT_ID;

initializeAdminApp({
  projectId: PROJECT_ID,
});

const adminAuth = getAdminAuth();
const db = getFirestore();

const clientApp = initializeApp({
  apiKey: "fake-api-key",
  authDomain: `${PROJECT_ID}.firebaseapp.com`,
  projectId: PROJECT_ID,
});

const auth = getAuth(clientApp);

connectAuthEmulator(
  auth,
  "http://127.0.0.1:9099",
  {
    disableWarnings: true,
  }
);

let sequence = 0;

function uniqueEmail() {
  sequence++;

  return (
    `security-${Date.now()}-${sequence}` +
    "@example.com"
  );
}

// ============================================================
// TEST HELPERS
// ============================================================

async function createTestUser(verified = true) {
  const email = uniqueEmail();

  const credential =
    await createUserWithEmailAndPassword(
      auth,
      email,
      PASSWORD
    );

  const uid = credential.user.uid;

  if (verified) {
    await adminAuth.updateUser(uid, {
      emailVerified: true,
    });

    await signOut(auth);

    const refreshed =
      await signInWithEmailAndPassword(
        auth,
        email,
        PASSWORD
      );

    return {
      uid,
      email,
      token: await getIdToken(
        refreshed.user,
        true
      ),
    };
  }

  return {
    uid,
    email,
    token: await getIdToken(
      credential.user,
      true
    ),
  };
}

function profile(uid) {
  const now = new Date().toISOString();

  return {
    ownerId: uid,
    fullName: "Security Test Patient",
    photoUrl: "",
    dateOfBirth: "1990-01-01",
    bloodGroup: "O+",
    allergies: [],
    medicalConditions: [],
    medications: [],
    emergencyContacts: [
      {
        id: "contact-1",
        name: "Test Contact",
        relationship: "Family",
        phone: "9876543210",
        email: "test@example.com",
        isPrimary: true,
      },
    ],
    emergencyInstructions: "",
    privacy: {
      showPhoto: false,
      showDateOfBirth: false,
      showBloodGroup: true,
      showAllergies: true,
      showMedicalConditions: true,
      showMedications: true,
      showEmergencyContacts: true,
      showEmergencyInstructions: true,
    },
    consentGiven: true,
    consentUpdatedAt: now,
    createdAt: now,
    updatedAt: now,
  };
}

async function seedProfile(uid) {
  await db.doc(
    `emergencyProfiles/${uid}`
  ).set(profile(uid));
}

async function seedDraft(uid, qrId = QR_ID) {
  await seedProfile(uid);

  const now = new Date().toISOString();

  await db.doc(
    `personalEmergencyQrs/${uid}`
  ).set({
    id: qrId,
    ownerId: uid,
    profileId: uid,
    status: "DRAFT",
    createdAt: now,
    updatedAt: now,
    activatedAt: null,
    deactivatedAt: null,
  });
}

async function callFunction(
  name,
  data = {},
  token
) {
  const response = await fetch(
    `${FUNCTIONS_URL}/${name}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token
          ? {
              Authorization: `Bearer ${token}`,
            }
          : {}),
      },
      body: JSON.stringify({
        data,
      }),
    }
  );

  const body = await response.json();

  return {
    status: response.status,
    result: body.result,
    error: body.error,
  };
}

function expectError(response, code) {
  assert.ok(
    response.error,
    `Expected ${code}, received ` +
      JSON.stringify(response)
  );

  assert.equal(
    response.error.status,
    code
  );
}

function assertValidQrId(qrId) {
  assert.equal(
    typeof qrId,
    "string"
  );

  assert.match(
    qrId,
    /^[A-Za-z0-9_-]{20,100}$/
  );
}

// ============================================================
// SETUP
// ============================================================

before(async () => {
  // Emulators must already be running.
  await db.listCollections();
});

after(async () => {
  await signOut(auth);
});

// ============================================================
// CREATE QR: AUTHENTICATION
// ============================================================

test(
  "01 - Anonymous QR creation is rejected",
  async () => {
    const result = await callFunction(
      "createEmergencyQr"
    );

    expectError(
      result,
      "UNAUTHENTICATED"
    );
  }
);

test(
  "02 - Unverified QR creation is rejected",
  async () => {
    const user = await createTestUser(false);

    await seedProfile(user.uid);

    const result = await callFunction(
      "createEmergencyQr",
      {},
      user.token
    );

    expectError(
      result,
      "PERMISSION_DENIED"
    );

    const qr = await db.doc(
      `personalEmergencyQrs/${user.uid}`
    ).get();

    assert.equal(qr.exists, false);
  }
);

test(
  "03 - QR creation requires a profile",
  async () => {
    const user = await createTestUser();

    const result = await callFunction(
      "createEmergencyQr",
      {},
      user.token
    );

    expectError(
      result,
      "FAILED_PRECONDITION"
    );

    const qr = await db.doc(
      `personalEmergencyQrs/${user.uid}`
    ).get();

    assert.equal(qr.exists, false);
  }
);

// ============================================================
// CREATE QR: SUCCESS AND IDEMPOTENCY
// ============================================================

test(
  "04 - Verified user creates a reserved draft QR",
  async () => {
    const user = await createTestUser();

    await seedProfile(user.uid);

    const result = await callFunction(
      "createEmergencyQr",
      {},
      user.token
    );

    assert.equal(
      result.result?.success,
      true
    );

    const qrId = result.result?.qr?.id;

    assertValidQrId(qrId);

    assert.equal(
      result.result.qr.ownerId,
      user.uid
    );

    assert.equal(
      result.result.qr.profileId,
      user.uid
    );

    assert.equal(
      result.result.qr.status,
      "DRAFT"
    );

    const qr = await db.doc(
      `personalEmergencyQrs/${user.uid}`
    ).get();

    const registry = await db.doc(
      `emergencyQrRegistry/${qrId}`
    ).get();

    assert.equal(qr.exists, true);
    assert.equal(registry.exists, true);

    assert.equal(
      qr.data()?.id,
      qrId
    );

    assert.equal(
      registry.data()?.ownerId,
      user.uid
    );

    assert.equal(
      registry.data()?.profileId,
      user.uid
    );

    assert.equal(
      registry.data()?.qrId,
      qrId
    );

    // Drafts must not have a public projection.
    const publicQr = await db.doc(
      `publicEmergencyQrs/${qrId}`
    ).get();

    assert.equal(
      publicQr.exists,
      false
    );
  }
);

test(
  "05 - Repeated creation returns the same QR",
  async () => {
    const user = await createTestUser();

    await seedProfile(user.uid);

    const first = await callFunction(
      "createEmergencyQr",
      {},
      user.token
    );

    const second = await callFunction(
      "createEmergencyQr",
      {},
      user.token
    );

    assert.equal(
      first.result?.success,
      true
    );

    assert.equal(
      second.result?.success,
      true
    );

    assert.equal(
      first.result.qr.id,
      second.result.qr.id
    );

    const qr = await db.doc(
      `personalEmergencyQrs/${user.uid}`
    ).get();

    assert.equal(
      qr.data()?.id,
      first.result.qr.id
    );
  }
);

// ============================================================
// CREATE QR: CONCURRENCY
// ============================================================

test(
  "06 - Concurrent creation produces one QR",
  async () => {
    const user = await createTestUser();

    await seedProfile(user.uid);

    const results = await Promise.all(
      Array.from(
        {
          length: 5,
        },
        () =>
          callFunction(
            "createEmergencyQr",
            {},
            user.token
          )
      )
    );

    for (const result of results) {
      assert.equal(
        result.result?.success,
        true,
        JSON.stringify(result)
      );

      assertValidQrId(
        result.result.qr.id
      );
    }

    const ids = new Set(
      results.map(
        (result) =>
          result.result.qr.id
      )
    );

    assert.equal(
      ids.size,
      1,
      "Concurrent requests must return one QR ID."
    );

    const [qrId] = ids;

    const qr = await db.doc(
      `personalEmergencyQrs/${user.uid}`
    ).get();

    const registry = await db.doc(
      `emergencyQrRegistry/${qrId}`
    ).get();

    assert.equal(
      qr.data()?.id,
      qrId
    );

    assert.equal(
      registry.data()?.ownerId,
      user.uid
    );
  }
);

// ============================================================
// CREATE QR: LEGACY DRAFT MIGRATION
// ============================================================

test(
  "07 - Existing draft receives registry reservation",
  async () => {
    const user = await createTestUser();

    const legacyQrId =
      "LEGACYDRAFTQR1234567890123456";

    await seedDraft(
      user.uid,
      legacyQrId
    );

    const result = await callFunction(
      "createEmergencyQr",
      {},
      user.token
    );

    assert.equal(
      result.result?.success,
      true
    );

    assert.equal(
      result.result.qr.id,
      legacyQrId
    );

    assert.equal(
      result.result.qr.status,
      "DRAFT"
    );

    const registry = await db.doc(
      `emergencyQrRegistry/${legacyQrId}`
    ).get();

    assert.equal(
      registry.data()?.ownerId,
      user.uid
    );

    assert.equal(
      registry.data()?.qrId,
      legacyQrId
    );
  }
);

test(
  "08 - Existing draft cannot claim another owner's ID",
  async () => {
    const owner = await createTestUser();

    await seedProfile(owner.uid);

    const created = await callFunction(
      "createEmergencyQr",
      {},
      owner.token
    );

    assert.equal(
      created.result?.success,
      true
    );

    const reservedId =
      created.result.qr.id;

    const other = await createTestUser();

    // Admin SDK deliberately simulates a legacy
    // draft with a conflicting identifier.
    await seedDraft(
      other.uid,
      reservedId
    );

    const result = await callFunction(
      "createEmergencyQr",
      {},
      other.token
    );

    expectError(
      result,
      "ALREADY_EXISTS"
    );

    const registry = await db.doc(
      `emergencyQrRegistry/${reservedId}`
    ).get();

    assert.equal(
      registry.data()?.ownerId,
      owner.uid
    );
  }
);

// ============================================================
// ACTIVATE QR: AUTHENTICATION
// ============================================================

test(
  "09 - Anonymous activation is rejected",
  async () => {
    const result = await callFunction(
      "activateEmergencyQr"
    );

    expectError(
      result,
      "UNAUTHENTICATED"
    );
  }
);

test(
  "10 - Unverified activation is rejected",
  async () => {
    const user = await createTestUser(false);

    const result = await callFunction(
      "activateEmergencyQr",
      {},
      user.token
    );

    expectError(
      result,
      "PERMISSION_DENIED"
    );
  }
);

test(
  "11 - Missing profile and QR are rejected",
  async () => {
    const user = await createTestUser();

    const result = await callFunction(
      "activateEmergencyQr",
      {},
      user.token
    );

    expectError(
      result,
      "FAILED_PRECONDITION"
    );
  }
);

// ============================================================
// QR LIFECYCLE
// ============================================================

test(
  "12 - Valid QR activation succeeds",
  async () => {
    const user = await createTestUser();

    await seedDraft(user.uid);

    const result = await callFunction(
      "activateEmergencyQr",
      {},
      user.token
    );

    assert.equal(
      result.result?.success,
      true
    );

    const qr = await db.doc(
      `personalEmergencyQrs/${user.uid}`
    ).get();

    const publicQr = await db.doc(
      `publicEmergencyQrs/${QR_ID}`
    ).get();

    const registry = await db.doc(
      `emergencyQrRegistry/${QR_ID}`
    ).get();

    assert.equal(
      qr.data()?.status,
      "ACTIVE"
    );

    assert.equal(
      publicQr.data()?.status,
      "ACTIVE"
    );

    assert.equal(
      registry.data()?.ownerId,
      user.uid
    );

    // Emergency contact emails must remain private.
    const contacts =
      publicQr.data()?.emergencyContacts ?? [];

    for (const contact of contacts) {
      assert.equal(
        Object.hasOwn(
          contact,
          "email"
        ),
        false
      );
    }
  }
);

test(
  "13 - Another account cannot claim the same QR",
  async () => {
    const other = await createTestUser();

    await seedDraft(other.uid);

    const result = await callFunction(
      "activateEmergencyQr",
      {},
      other.token
    );

    expectError(
      result,
      "ALREADY_EXISTS"
    );
  }
);

test(
  "14 - Anonymous deactivation is rejected",
  async () => {
    const result = await callFunction(
      "deactivateEmergencyQr"
    );

    expectError(
      result,
      "UNAUTHENTICATED"
    );
  }
);

test(
  "15 - Another user cannot deactivate owner's QR",
  async () => {
    const other = await createTestUser();

    const result = await callFunction(
      "deactivateEmergencyQr",
      {},
      other.token
    );

    expectError(
      result,
      "NOT_FOUND"
    );

    const publicQr = await db.doc(
      `publicEmergencyQrs/${QR_ID}`
    ).get();

    assert.equal(
      publicQr.exists,
      true
    );
  }
);

test(
  "16 - Owner can deactivate an active QR",
  async () => {
    const registry = await db.doc(
      `emergencyQrRegistry/${QR_ID}`
    ).get();

    const ownerId =
      registry.data()?.ownerId;

    assert.ok(ownerId);

    const userRecord =
      await adminAuth.getUser(ownerId);

    assert.ok(userRecord.email);

    const owner =
      await signInWithEmailAndPassword(
        auth,
        userRecord.email,
        PASSWORD
      );

    const token = await getIdToken(
      owner.user,
      true
    );

    const result = await callFunction(
      "deactivateEmergencyQr",
      {},
      token
    );

    assert.equal(
      result.result?.success,
      true
    );

    const qr = await db.doc(
      `personalEmergencyQrs/${ownerId}`
    ).get();

    const publicQr = await db.doc(
      `publicEmergencyQrs/${QR_ID}`
    ).get();

    assert.equal(
      qr.data()?.status,
      "INACTIVE"
    );

    assert.equal(
      publicQr.exists,
      false
    );

    // Deactivation must not release ownership.
    const registryAfter = await db.doc(
      `emergencyQrRegistry/${QR_ID}`
    ).get();

    assert.equal(
      registryAfter.data()?.ownerId,
      ownerId
    );
  }
);

// ============================================================
// EMERGENCY NOTIFICATION INPUT VALIDATION
// These must fail before SMTP delivery.
// ============================================================

test(
  "17 - Invalid notification QR is rejected",
  async () => {
    const result = await callFunction(
      "notifyEmergencyContacts",
      {
        qrId: "../invalid",
        latitude: 15.85,
        longitude: 74.5,
        accuracy: 20,
      }
    );

    expectError(
      result,
      "INVALID_ARGUMENT"
    );
  }
);

test(
  "18 - Invalid GPS coordinates are rejected",
  async () => {
    const result = await callFunction(
      "notifyEmergencyContacts",
      {
        qrId: QR_ID,
        latitude: 999,
        longitude: 74.5,
        accuracy: 20,
      }
    );

    expectError(
      result,
      "INVALID_ARGUMENT"
    );
  }
);

test(
  "19 - Oversized messages are rejected",
  async () => {
    const result = await callFunction(
      "notifyEmergencyContacts",
      {
        qrId: QR_ID,
        latitude: 15.85,
        longitude: 74.5,
        accuracy: 20,
        message: "A".repeat(501),
      }
    );

    expectError(
      result,
      "INVALID_ARGUMENT"
    );
  }
);


test(
  "20 - Anonymous QR deletion is rejected",
  async () => {
    const result = await callFunction(
      "deleteEmergencyQr"
    );

    expectError(result, "UNAUTHENTICATED");
  }
);

test(
  "21 - Unverified QR deletion is rejected",
  async () => {
    const user = await createTestUser(false);

    const result = await callFunction(
      "deleteEmergencyQr",
      {},
      user.token
    );

    expectError(result, "PERMISSION_DENIED");
  }
);

test(
  "22 - Deleting a nonexistent QR is rejected",
  async () => {
    const user = await createTestUser();

    const result = await callFunction(
      "deleteEmergencyQr",
      {},
      user.token
    );

    expectError(result, "NOT_FOUND");
  }
);

test(
  "23 - ACTIVE QR deletion is prohibited",
  async () => {
    const user = await createTestUser();

    await seedProfile(user.uid);

    const created = await callFunction(
      "createEmergencyQr",
      {},
      user.token
    );

    assert.equal(created.result?.success, true);

    const qrId = created.result.qr.id;

    const activated = await callFunction(
      "activateEmergencyQr",
      {},
      user.token
    );

    assert.equal(activated.result?.success, true);

    const deleted = await callFunction(
      "deleteEmergencyQr",
      {},
      user.token
    );

    expectError(deleted, "FAILED_PRECONDITION");

    const qr = await db.doc(
      `personalEmergencyQrs/${user.uid}`
    ).get();

    const publicQr = await db.doc(
      `publicEmergencyQrs/${qrId}`
    ).get();

    assert.equal(qr.data()?.status, "ACTIVE");
    assert.equal(publicQr.exists, true);
  }
);

test(
  "24 - INACTIVE QR deletion preserves its registry",
  async () => {
    const user = await createTestUser();

    await seedProfile(user.uid);

    const created = await callFunction(
      "createEmergencyQr",
      {},
      user.token
    );

    assert.equal(created.result?.success, true);

    const qrId = created.result.qr.id;

    const activated = await callFunction(
      "activateEmergencyQr",
      {},
      user.token
    );

    assert.equal(activated.result?.success, true);

    const deactivated = await callFunction(
      "deactivateEmergencyQr",
      {},
      user.token
    );

    assert.equal(deactivated.result?.success, true);

    const deleted = await callFunction(
      "deleteEmergencyQr",
      {},
      user.token
    );

    assert.equal(deleted.result?.success, true);

    const qr = await db.doc(
      `personalEmergencyQrs/${user.uid}`
    ).get();

    const publicQr = await db.doc(
      `publicEmergencyQrs/${qrId}`
    ).get();

    const registry = await db.doc(
      `emergencyQrRegistry/${qrId}`
    ).get();

    assert.equal(qr.exists, false);
    assert.equal(publicQr.exists, false);
    assert.equal(registry.exists, true);

    assert.equal(
      registry.data()?.ownerId,
      user.uid
    );

    assert.equal(
      registry.data()?.qrId,
      qrId
    );

    assert.ok(
      registry.data()?.retiredAt,
      "The registry must record permanent retirement."
    );
  }
);

test(
  "25 - New QR after deletion gets a different ID",
  async () => {
    const user = await createTestUser();

    await seedProfile(user.uid);

    const first = await callFunction(
      "createEmergencyQr",
      {},
      user.token
    );

    assert.equal(first.result?.success, true);

    const originalId = first.result.qr.id;

    const activated = await callFunction(
      "activateEmergencyQr",
      {},
      user.token
    );

    assert.equal(activated.result?.success, true);

    const deactivated = await callFunction(
      "deactivateEmergencyQr",
      {},
      user.token
    );

    assert.equal(deactivated.result?.success, true);

    const deleted = await callFunction(
      "deleteEmergencyQr",
      {},
      user.token
    );

    assert.equal(deleted.result?.success, true);

    const replacement = await callFunction(
      "createEmergencyQr",
      {},
      user.token
    );

    assert.equal(replacement.result?.success, true);

    const newId = replacement.result.qr.id;

    assert.notEqual(newId, originalId);
    assert.equal(replacement.result.qr.status, "DRAFT");

    const oldRegistry = await db.doc(
      `emergencyQrRegistry/${originalId}`
    ).get();

    const newRegistry = await db.doc(
      `emergencyQrRegistry/${newId}`
    ).get();

    assert.equal(oldRegistry.exists, true);
    assert.ok(oldRegistry.data()?.retiredAt);

    assert.equal(newRegistry.exists, true);
    assert.equal(newRegistry.data()?.ownerId, user.uid);
  }
);