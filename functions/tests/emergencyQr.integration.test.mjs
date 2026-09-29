
import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  initializeApp as initializeAdminApp,
  deleteApp as deleteAdminApp,
} from "firebase-admin/app";

import {
  getAuth as getAdminAuth,
} from "firebase-admin/auth";

import {
  getFirestore as getAdminFirestore,
} from "firebase-admin/firestore";

import {
  initializeApp as initializeClientApp,
  deleteApp as deleteClientApp,
} from "firebase/app";

import {
  getAuth,
  connectAuthEmulator,
  signInWithEmailAndPassword,
} from "firebase/auth";

import {
  getFunctions,
  connectFunctionsEmulator,
  httpsCallable,
} from "firebase/functions";

import {
  getFirestore,
  connectFirestoreEmulator,
  doc,
  getDoc,
} from "firebase/firestore";

// ============================================================
// HEALTHPASSPORT EMERGENCY QR
// PHASE 1 — STEP 6.3
// BACKEND INTEGRATION TESTS
// ============================================================

const projectId =
  process.env.GCLOUD_PROJECT ||
  process.env.FIREBASE_PROJECT_ID ||
  JSON.parse(
    readFileSync(".firebaserc", "utf8")
  ).projects.default;

const authHost =
  process.env.FIREBASE_AUTH_EMULATOR_HOST ||
  "127.0.0.1:9099";

const firestoreHost =
  process.env.FIRESTORE_EMULATOR_HOST ||
  "127.0.0.1:8080";

const functionsHost =
  process.env.FUNCTIONS_EMULATOR_HOST ||
  "127.0.0.1:5001";

const [fsHost, fsPort] = firestoreHost
  .replace(/^https?:\/\//, "")
  .split(":");

const [fnHost, fnPort] = functionsHost
  .replace(/^https?:\/\//, "")
  .split(":");

process.env.FIREBASE_AUTH_EMULATOR_HOST =
  authHost.replace(/^https?:\/\//, "");

process.env.FIRESTORE_EMULATOR_HOST =
  firestoreHost.replace(/^https?:\/\//, "");

// ============================================================
// ADMIN AND TEST CONFIGURATION
// ============================================================

const adminApp = initializeAdminApp(
  { projectId },
  "emergency-qr-integration-admin"
);

const adminAuth = getAdminAuth(adminApp);
const adminDb = getAdminFirestore(adminApp);

const clients = [];

const password =
  "Integration-Test-Password-2026!";

const stamp =
  "2026-09-01T11:00:00.000Z";

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

// ============================================================
// TEST DATA
// ============================================================

function profile(uid, overrides = {}) {
  return {
    ownerId: uid,
    fullName: "Integration Test",
    photoUrl:
      "https://example.com/private.jpg",
    dateOfBirth: "1990-11-29",
    bloodGroup: "O+",

    allergies: ["Penicillin"],

    medicalConditions: [
      "PRIVATE CONDITION",
    ],

    medications: [
      "PRIVATE MEDICATION",
    ],

    emergencyContacts: [
      {
        name: "Contact",
        relationship: "Family",
        phone: "9876543210",
        isPrimary: true,
      },
    ],

    emergencyInstructions:
      "PRIVATE INSTRUCTIONS",

    privacy: { ...privacy },

    consentGiven: true,
    consentUpdatedAt: stamp,
    createdAt: stamp,
    updatedAt: stamp,

    ...overrides,
  };
}

function draft(uid, id, overrides = {}) {
  return {
    id,
    ownerId: uid,
    profileId: uid,
    status: "DRAFT",

    createdAt: stamp,
    updatedAt: stamp,

    activatedAt: null,
    deactivatedAt: null,

    ...overrides,
  };
}

// ============================================================
// ACCOUNT CREATION
// ============================================================

async function createAccount(
  label,
  verified = true
) {
  const uid = `integration-${label}`;
  const email = `${uid}@example.com`;

  await adminAuth.createUser({
    uid,
    email,
    password,
    emailVerified: verified,
  });

  const app = initializeClientApp(
    {
      apiKey: "integration-emulator-key",
      projectId,
      appId: label,
    },
    label
  );

  clients.push(app);

  const auth = getAuth(app);

  connectAuthEmulator(
    auth,
    `http://${authHost.replace(/^https?:\/\//, "")}`,
    { disableWarnings: true }
  );

  await signInWithEmailAndPassword(
    auth,
    email,
    password
  );

  const functions = getFunctions(
    app,
    "asia-south1"
  );

  connectFunctionsEmulator(
    functions,
    fnHost,
    Number(fnPort || 5001)
  );

  return {
    uid,

    activate: httpsCallable(
      functions,
      "activateEmergencyQr"
    ),

    deactivate: httpsCallable(
      functions,
      "deactivateEmergencyQr"
    ),
  };
}

// ============================================================
// DATA SEEDING
// ============================================================

async function seed(
  uid,
  qrId,
  overrides = {}
) {
  await adminDb
    .doc(`emergencyProfiles/${uid}`)
    .set(
      profile(uid, overrides.profile)
    );

  await adminDb
    .doc(`personalEmergencyQrs/${uid}`)
    .set(
      draft(uid, qrId, overrides.qr)
    );
}

// ============================================================
// ASSERTION HELPERS
// ============================================================

async function expectCode(
  promise,
  code
) {
  await assert.rejects(
    promise,
    (error) => {
      assert.equal(
        error.code,
        `functions/${code}`,
        error.message
      );

      return true;
    }
  );
}

async function eventually(
  check,
  description,
  timeoutMs = 12000
) {
  const end = Date.now() + timeoutMs;

  let lastError;

  while (Date.now() < end) {
    try {
      await check();
      return;
    } catch (error) {
      lastError = error;
    }

    await new Promise(
      (resolve) => setTimeout(resolve, 300)
    );
  }

  throw new Error(
    `${description}: ${
      lastError?.message || "timed out"
    }`
  );
}

// ============================================================
// TEST ENVIRONMENT
// ============================================================

let alice;
let bob;
let unverified;
let publicDb;

before(async () => {
  if (
    !process.env.FIREBASE_AUTH_EMULATOR_HOST ||
    !process.env.FIRESTORE_EMULATOR_HOST
  ) {
    throw new Error(
      "Auth and Firestore emulators are required."
    );
  }

  alice = await createAccount("alice");

  bob = await createAccount("bob");

  unverified = await createAccount(
    "unverified",
    false
  );

  const publicApp = initializeClientApp(
    {
      apiKey: "integration-emulator-key",
      projectId,
      appId: "public",
    },
    "public"
  );

  clients.push(publicApp);

  publicDb = getFirestore(publicApp);

  connectFirestoreEmulator(
    publicDb,
    fsHost,
    Number(fsPort || 8080)
  );
});

after(async () => {
  await Promise.all(
    clients.map(deleteClientApp)
  );

  await deleteAdminApp(adminApp);
});

// ============================================================
// TEST 01
// ACTIVATION AND PUBLIC PRIVACY
// ============================================================

test(
  "01: activation publishes only approved fields and permits anonymous get",
  async () => {
    const id =
      "integrationQrAliceAAAA123456";

    await seed(alice.uid, id);

    const response =
      await alice.activate({});

    assert.equal(
      response.data.success,
      true
    );

    const registry = (
      await adminDb
        .doc(`emergencyQrRegistry/${id}`)
        .get()
    ).data();

    assert.equal(
      registry.ownerId,
      alice.uid
    );

    const qr = (
      await adminDb
        .doc(
          `personalEmergencyQrs/${alice.uid}`
        )
        .get()
    ).data();

    assert.equal(
      qr.status,
      "ACTIVE"
    );

    assert.ok(
      qr.updatedAt?.toDate,
      "Activation must store a Firestore server timestamp"
    );

    const snapshot = await getDoc(
      doc(
        publicDb,
        "publicEmergencyQrs",
        id
      )
    );

    assert.equal(
      snapshot.exists(),
      true
    );

    const data = snapshot.data();

    assert.equal(
      data.fullName,
      "Integration Test"
    );

    assert.equal(
      data.bloodGroup,
      "O+"
    );

    assert.deepEqual(
      data.allergies,
      ["Penicillin"]
    );

    assert.ok(
      data.emergencyContacts
    );

    for (const hidden of [
      "photoUrl",
      "dateOfBirth",
      "medicalConditions",
      "medications",
      "emergencyInstructions",
    ]) {
      assert.equal(
        Object.hasOwn(data, hidden),
        false,
        `${hidden} must not be public`
      );
    }
  }
);

// ============================================================
// TEST 02
// EMAIL VERIFICATION
// ============================================================

test(
  "02: unverified account cannot activate",
  async () => {
    await seed(
      unverified.uid,
      "integrationQrUnverified123456"
    );

    await expectCode(
      unverified.activate({}),
      "permission-denied"
    );
  }
);

// ============================================================
// TEST 03
// QR OWNERSHIP
// ============================================================

test(
  "03: mismatched personal QR ownership cannot activate",
  async () => {
    await seed(
      bob.uid,
      "integrationQrBobWrongOwner123",
      {
        qr: {
          ownerId: alice.uid,
        },
      }
    );

    await expectCode(
      bob.activate({}),
      "permission-denied"
    );
  }
);

// ============================================================
// TEST 04
// PERMANENT REGISTRY PROTECTION
// ============================================================

test(
  "04: a QR ID permanently registered to another owner cannot be claimed",
  async () => {
    const id =
      "integrationQrReservedAAAA12345";

    await adminDb
      .doc(`emergencyQrRegistry/${id}`)
      .set({
        qrId: id,
        ownerId: alice.uid,
        profileId: alice.uid,
        createdAt: stamp,
      });

    await adminDb
      .doc(
        `personalEmergencyQrs/${bob.uid}`
      )
      .set(
        draft(bob.uid, id)
      );

    await expectCode(
      bob.activate({}),
      "already-exists"
    );
  }
);

// ============================================================
// TEST 05
// DEACTIVATION
// ============================================================

test(
  "05: deactivation removes public data but preserves registry",
  async () => {
    const id =
      "integrationQrAliceAAAA123456";

    const response =
      await alice.deactivate({});

    assert.equal(
      response.data.success,
      true
    );

    const publicSnapshot =
      await adminDb
        .doc(
          `publicEmergencyQrs/${id}`
        )
        .get();

    assert.equal(
      publicSnapshot.exists,
      false
    );

    const registrySnapshot =
      await adminDb
        .doc(
          `emergencyQrRegistry/${id}`
        )
        .get();

    assert.equal(
      registrySnapshot.exists,
      true
    );

    const qrSnapshot =
      await adminDb
        .doc(
          `personalEmergencyQrs/${alice.uid}`
        )
        .get();

    assert.equal(
      qrSnapshot.data().status,
      "INACTIVE"
    );

    await assert.rejects(
      getDoc(
        doc(
          publicDb,
          "publicEmergencyQrs",
          id
        )
      ),
      (error) =>
        error.code === "permission-denied"
    );
  }
);

// ============================================================
// TEST 06
// CONSENT WITHDRAWAL AND PROFILE SYNCHRONIZATION
// ============================================================

test(
  "06: withdrawing consent blocks public reads and removes projection",
  async () => {
    const id =
      "integrationQrAliceAAAA123456";

    const response =
      await alice.activate({});

    assert.equal(
      response.data.success,
      true
    );

    await adminDb
      .doc(
        `emergencyProfiles/${alice.uid}`
      )
      .update({
        consentGiven: false,

        consentUpdatedAt:
          "2026-09-02T12:00:00.000Z",

        updatedAt:
          "2026-09-02T12:00:00.000Z",
      });

    await assert.rejects(
      getDoc(
        doc(
          publicDb,
          "publicEmergencyQrs",
          id
        )
      ),
      (error) =>
        error.code === "permission-denied"
    );

    await eventually(
      async () => {
        const snapshot =
          await adminDb
            .doc(
              `publicEmergencyQrs/${id}`
            )
            .get();

        assert.equal(
          snapshot.exists,
          false
        );
      },
      "Profile synchronization did not delete the public projection"
    );
  }
);