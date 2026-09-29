// PATH: tests/firestore.rules.test.mjs
// HealthPassport Emergency QR — Phase 1, Step 6.4

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  before,
  after,
  beforeEach,
  test,
} from "node:test";

import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from "@firebase/rules-unit-testing";

import {
  doc,
  getDoc,
  getDocs,
  collection,
  setDoc,
  updateDoc,
  deleteDoc,
} from "firebase/firestore";

const PROJECT_ID = "healthpassport-security-test";

const OWNER = "owner-user";
const OTHER = "other-user";

const QR_ID = "ABCDEFGHIJKLMNOPQRST123456";
const OTHER_QR_ID = "ZYXWVUTSRQPONMLKJIHG123456";

const CREATED_AT = "2026-09-01T10:00:00.000Z";
const UPDATED_AT = "2026-09-02T10:00:00.000Z";

let env;

// ============================================================
// TEST DATA
// ============================================================

function profile(overrides = {}) {
  return {
    ownerId: OWNER,
    fullName: "Test User",
    photoUrl: "",
    dateOfBirth: "1990-01-01",
    bloodGroup: "O+",
    allergies: [],
    medicalConditions: [],
    medications: [],
    emergencyContacts: [
      {
        id: "contact-1",
        name: "Emergency Contact",
        relationship: "Family",
        phone: "9876543210",
        email: "contact@example.com",
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
    consentUpdatedAt: CREATED_AT,
    createdAt: CREATED_AT,
    updatedAt: CREATED_AT,
    ...overrides,
  };
}

function draftQr(overrides = {}) {
  return {
    id: QR_ID,
    ownerId: OWNER,
    profileId: OWNER,
    status: "DRAFT",
    createdAt: CREATED_AT,
    updatedAt: CREATED_AT,
    activatedAt: null,
    deactivatedAt: null,
    ...overrides,
  };
}

function publicQr(overrides = {}) {
  return {
    qrId: QR_ID,
    ownerId: OWNER,
    status: "ACTIVE",
    fullName: "Test User",
    bloodGroup: "O+",
    allergies: [],
    medicalConditions: [],
    medications: [],
    emergencyContacts: [
      {
        name: "Emergency Contact",
        relationship: "Family",
        phone: "9876543210",
        isPrimary: true,
      },
    ],
    emergencyInstructions: "",
    sourceUpdatedAt: UPDATED_AT,
    updatedAt: UPDATED_AT,
    publishedAt: UPDATED_AT,
    ...overrides,
  };
}

// ============================================================
// AUTHENTICATED CLIENTS
// ============================================================

function ownerDb() {
  return env.authenticatedContext(OWNER, {
    email_verified: true,
  }).firestore();
}

function otherDb() {
  return env.authenticatedContext(OTHER, {
    email_verified: true,
  }).firestore();
}

function unverifiedDb() {
  return env.authenticatedContext(OWNER, {
    email_verified: false,
  }).firestore();
}

function anonymousDb() {
  return env.unauthenticatedContext().firestore();
}

// ============================================================
// DATABASE SEEDING
// ============================================================

async function seedDocuments(documents) {
  await env.withSecurityRulesDisabled(
    async (context) => {
      const db = context.firestore();

      for (const [path, data] of documents) {
        await setDoc(doc(db, path), data);
      }
    }
  );
}

async function seedActiveQr() {
  await seedDocuments([
    [
      `emergencyProfiles/${OWNER}`,
      profile({
        updatedAt: UPDATED_AT,
      }),
    ],
    [
      `personalEmergencyQrs/${OWNER}`,
      draftQr({
        status: "ACTIVE",
        updatedAt: UPDATED_AT,
        activatedAt: UPDATED_AT,
      }),
    ],
    [
      `emergencyQrRegistry/${QR_ID}`,
      {
        qrId: QR_ID,
        ownerId: OWNER,
        profileId: OWNER,
        createdAt: CREATED_AT,
      },
    ],
    [
      `publicEmergencyQrs/${QR_ID}`,
      publicQr(),
    ],
  ]);
}

// ============================================================
// SETUP AND CLEANUP
// ============================================================

before(async () => {
  env = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: readFileSync(
        "firestore.rules",
        "utf8"
      ),
    },
  });
});

beforeEach(async () => {
  await env.clearFirestore();
});

after(async () => {
  if (env) {
    await env.cleanup();
  }
});

// ============================================================
// 1. PRIVATE EMERGENCY PROFILE
// ============================================================

test(
  "01 - Verified owner can create a valid profile",
  async () => {
    await assertSucceeds(
      setDoc(
        doc(
          ownerDb(),
          "emergencyProfiles",
          OWNER
        ),
        profile()
      )
    );
  }
);

test(
  "02 - Anonymous users cannot read private profiles",
  async () => {
    await seedDocuments([
      [
        `emergencyProfiles/${OWNER}`,
        profile(),
      ],
    ]);

    await assertFails(
      getDoc(
        doc(
          anonymousDb(),
          "emergencyProfiles",
          OWNER
        )
      )
    );
  }
);

test(
  "03 - Other users cannot read private profiles",
  async () => {
    await seedDocuments([
      [
        `emergencyProfiles/${OWNER}`,
        profile(),
      ],
    ]);

    await assertFails(
      getDoc(
        doc(
          otherDb(),
          "emergencyProfiles",
          OWNER
        )
      )
    );
  }
);

test(
  "04 - Unverified users cannot create profiles",
  async () => {
    await assertFails(
      setDoc(
        doc(
          unverifiedDb(),
          "emergencyProfiles",
          OWNER
        ),
        profile()
      )
    );
  }
);

test(
  "05 - Profiles cannot be created without consent",
  async () => {
    await assertFails(
      setDoc(
        doc(
          ownerDb(),
          "emergencyProfiles",
          OWNER
        ),
        profile({
          consentGiven: false,
        })
      )
    );
  }
);

test(
  "06 - Owners cannot change their profile ownerId",
  async () => {
    await seedDocuments([
      [
        `emergencyProfiles/${OWNER}`,
        profile(),
      ],
    ]);

    await assertFails(
      updateDoc(
        doc(
          ownerDb(),
          "emergencyProfiles",
          OWNER
        ),
        {
          ownerId: OTHER,
          updatedAt: UPDATED_AT,
        }
      )
    );
  }
);

test(
  "07 - Owners cannot change the original creation timestamp",
  async () => {
    await seedDocuments([
      [
        `emergencyProfiles/${OWNER}`,
        profile(),
      ],
    ]);

    await assertFails(
      updateDoc(
        doc(
          ownerDb(),
          "emergencyProfiles",
          OWNER
        ),
        {
          createdAt: UPDATED_AT,
          updatedAt: UPDATED_AT,
        }
      )
    );
  }
);

test(
  "08 - Private profile enumeration is prohibited",
  async () => {
    await assertFails(
      getDocs(
        collection(
          ownerDb(),
          "emergencyProfiles"
        )
      )
    );
  }
);

// ============================================================
// 2. PERSONAL EMERGENCY QR
// ============================================================

test(
  "09 - Verified owners cannot create drafts directly",
  async () => {
    await seedDocuments([
      [
        `emergencyProfiles/${OWNER}`,
        profile(),
      ],
    ]);

    await assertFails(
      setDoc(
        doc(
          ownerDb(),
          "personalEmergencyQrs",
          OWNER
        ),
        draftQr()
      )
    );
  }
);

test(
  "10 - A draft cannot be created without a profile",
  async () => {
    await assertFails(
      setDoc(
        doc(
          ownerDb(),
          "personalEmergencyQrs",
          OWNER
        ),
        draftQr()
      )
    );
  }
);

test(
  "11 - Clients cannot activate a QR directly",
  async () => {
    await seedDocuments([
      [
        `emergencyProfiles/${OWNER}`,
        profile(),
      ],
      [
        `personalEmergencyQrs/${OWNER}`,
        draftQr(),
      ],
    ]);

    await assertFails(
      updateDoc(
        doc(
          ownerDb(),
          "personalEmergencyQrs",
          OWNER
        ),
        {
          status: "ACTIVE",
          activatedAt: UPDATED_AT,
        }
      )
    );
  }
);

test(
  "12 - Owners can delete an unactivated draft",
  async () => {
    await seedDocuments([
      [
        `emergencyProfiles/${OWNER}`,
        profile(),
      ],
      [
        `personalEmergencyQrs/${OWNER}`,
        draftQr(),
      ],
    ]);

    await assertSucceeds(
      deleteDoc(
        doc(
          ownerDb(),
          "personalEmergencyQrs",
          OWNER
        )
      )
    );
  }
);

test(
  "13 - Owners cannot directly delete an active QR",
  async () => {
    await seedActiveQr();

    await assertFails(
      deleteDoc(
        doc(
          ownerDb(),
          "personalEmergencyQrs",
          OWNER
        )
      )
    );
  }
);

// ============================================================
// 3. PUBLIC EMERGENCY QR
// ============================================================

test(
  "14 - Anonymous scanners can read a valid active QR",
  async () => {
    await seedActiveQr();

    await assertSucceeds(
      getDoc(
        doc(
          anonymousDb(),
          "publicEmergencyQrs",
          QR_ID
        )
      )
    );
  }
);

test(
  "15 - Public QR enumeration is prohibited",
  async () => {
    await seedActiveQr();

    await assertFails(
      getDocs(
        collection(
          anonymousDb(),
          "publicEmergencyQrs"
        )
      )
    );
  }
);

test(
  "16 - Clients cannot publish public QR documents",
  async () => {
    await assertFails(
      setDoc(
        doc(
          ownerDb(),
          "publicEmergencyQrs",
          QR_ID
        ),
        publicQr()
      )
    );
  }
);

test(
  "17 - Stale public projections cannot be read",
  async () => {
    await seedActiveQr();

    await seedDocuments([
      [
        `emergencyProfiles/${OWNER}`,
        profile({
          updatedAt:
            "2026-09-03T10:00:00.000Z",
        }),
      ],
    ]);

    await assertFails(
      getDoc(
        doc(
          anonymousDb(),
          "publicEmergencyQrs",
          QR_ID
        )
      )
    );
  }
);

test(
  "18 - Inactive QRs cannot be publicly accessed",
  async () => {
    await seedActiveQr();

    await seedDocuments([
      [
        `personalEmergencyQrs/${OWNER}`,
        draftQr({
          status: "INACTIVE",
          updatedAt: UPDATED_AT,
          activatedAt: UPDATED_AT,
          deactivatedAt: UPDATED_AT,
        }),
      ],
    ]);

    await assertFails(
      getDoc(
        doc(
          anonymousDb(),
          "publicEmergencyQrs",
          QR_ID
        )
      )
    );
  }
);

// ============================================================
// 4. PERMANENT REGISTRY AND DEFAULT DENY
// ============================================================

test(
  "19 - Clients cannot modify the permanent QR registry",
  async () => {
    await seedActiveQr();

    await assertFails(
      deleteDoc(
        doc(
          ownerDb(),
          "emergencyQrRegistry",
          QR_ID
        )
      )
    );

    await assertFails(
      setDoc(
        doc(
          otherDb(),
          "emergencyQrRegistry",
          OTHER_QR_ID
        ),
        {
          qrId: OTHER_QR_ID,
          ownerId: OTHER,
          profileId: OTHER,
          createdAt: CREATED_AT,
        }
      )
    );
  }
);

// ============================================================
// 5. ADDITIONAL QR RESERVATION SECURITY TESTS
// ============================================================

test(
  "20 - Verified owner can read a server-created draft",
  async () => {
    await seedDocuments([
      [
        `emergencyProfiles/${OWNER}`,
        profile(),
      ],
      [
        `personalEmergencyQrs/${OWNER}`,
        draftQr(),
      ],
      [
        `emergencyQrRegistry/${QR_ID}`,
        {
          qrId: QR_ID,
          ownerId: OWNER,
          profileId: OWNER,
          createdAt: CREATED_AT,
        },
      ],
    ]);

    const snapshot = await assertSucceeds(
      getDoc(
        doc(
          ownerDb(),
          "personalEmergencyQrs",
          OWNER
        )
      )
    );

    assert.equal(
      snapshot.data()?.id,
      QR_ID
    );
  }
);

test(
  "21 - Other users and anonymous scanners cannot read private QRs",
  async () => {
    await seedDocuments([
      [
        `personalEmergencyQrs/${OWNER}`,
        draftQr(),
      ],
    ]);

    await assertFails(
      getDoc(
        doc(
          otherDb(),
          "personalEmergencyQrs",
          OWNER
        )
      )
    );

    await assertFails(
      getDoc(
        doc(
          anonymousDb(),
          "personalEmergencyQrs",
          OWNER
        )
      )
    );
  }
);

test(
  "22 - Unverified owners cannot read or delete their drafts",
  async () => {
    await seedDocuments([
      [
        `personalEmergencyQrs/${OWNER}`,
        draftQr(),
      ],
    ]);

    await assertFails(
      getDoc(
        doc(
          unverifiedDb(),
          "personalEmergencyQrs",
          OWNER
        )
      )
    );

    await assertFails(
      deleteDoc(
        doc(
          unverifiedDb(),
          "personalEmergencyQrs",
          OWNER
        )
      )
    );
  }
);

test(
  "23 - Clients cannot enumerate personal QRs or read registry",
  async () => {
    await seedDocuments([
      [
        `personalEmergencyQrs/${OWNER}`,
        draftQr(),
      ],
      [
        `emergencyQrRegistry/${QR_ID}`,
        {
          qrId: QR_ID,
          ownerId: OWNER,
          profileId: OWNER,
          createdAt: CREATED_AT,
        },
      ],
    ]);

    await assertFails(
      getDocs(
        collection(
          ownerDb(),
          "personalEmergencyQrs"
        )
      )
    );

    await assertFails(
      getDoc(
        doc(
          ownerDb(),
          "emergencyQrRegistry",
          QR_ID
        )
      )
    );
  }
);

test(
  "24 - Another account cannot delete an owner's draft",
  async () => {
    await seedDocuments([
      [
        `personalEmergencyQrs/${OWNER}`,
        draftQr(),
      ],
    ]);

    await assertFails(
      deleteDoc(
        doc(
          otherDb(),
          "personalEmergencyQrs",
          OWNER
        )
      )
    );
  }
);