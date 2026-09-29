
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { after, before, beforeEach, test } from "node:test";
import assert from "node:assert/strict";

import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} from "@firebase/rules-unit-testing";

import {
  doc,
  collection,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
} from "firebase/firestore";

// ============================================================
// HEALTHPASSPORT EMERGENCY QR
// PHASE 1 - STEP 6.2
// FIRESTORE SECURITY REGRESSION TESTS
// ============================================================

const PROJECT_ID = "healthpassport-security-test";

const USER_A = "security-user-a";
const USER_B = "security-user-b";

const QR_A = "securityQrIdentifierAAAA123456";
const QR_B = "securityQrIdentifierBBBB123456";

const CREATED_AT = "2026-09-01T10:00:00.000Z";
const UPDATED_AT = "2026-09-01T11:00:00.000Z";

const RULES_PATH = resolve(
  process.cwd(),
  "firestore.rules"
);

let environment;

// ============================================================
// TEST DATA
// ============================================================

function privacy(overrides = {}) {
  return {
    showPhoto: true,
    showDateOfBirth: true,
    showBloodGroup: true,
    showAllergies: true,
    showMedicalConditions: true,
    showMedications: true,
    showEmergencyContacts: true,
    showEmergencyInstructions: true,
    ...overrides,
  };
}

function profile(ownerId, overrides = {}) {
  return {
    ownerId,
    fullName: "Security Test User",
    photoUrl: "",
    dateOfBirth: "1990-11-29",
    bloodGroup: "O+",
    allergies: ["Penicillin"],
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
    emergencyInstructions: "Contact family.",
    privacy: privacy(),
    consentGiven: true,
    consentUpdatedAt: CREATED_AT,
    createdAt: CREATED_AT,
    updatedAt: UPDATED_AT,
    ...overrides,
  };
}

function draftQr(ownerId, qrId, overrides = {}) {
  return {
    id: qrId,
    ownerId,
    profileId: ownerId,
    status: "DRAFT",
    createdAt: CREATED_AT,
    updatedAt: UPDATED_AT,
    activatedAt: null,
    deactivatedAt: null,
    ...overrides,
  };
}

function activeQr(ownerId, qrId) {
  return {
    ...draftQr(ownerId, qrId),
    status: "ACTIVE",
    activatedAt: UPDATED_AT,
  };
}

function registry(ownerId, qrId) {
  return {
    qrId,
    ownerId,
    profileId: ownerId,
    createdAt: CREATED_AT,
  };
}

function publicQr(ownerId, qrId, overrides = {}) {
  return {
    qrId,
    ownerId,
    status: "ACTIVE",
    fullName: "Security Test User",
    sourceUpdatedAt: UPDATED_AT,
    updatedAt: UPDATED_AT,
    publishedAt: UPDATED_AT,
    ...overrides,
  };
}

// ============================================================
// AUTHENTICATION CONTEXTS
// ============================================================

function verifiedUser(uid) {
  return environment.authenticatedContext(
    uid,
    {
      email_verified: true,
      email: `${uid}@example.com`,
    }
  ).firestore();
}

function unverifiedUser(uid) {
  return environment.authenticatedContext(
    uid,
    {
      email_verified: false,
      email: `${uid}@example.com`,
    }
  ).firestore();
}

function anonymousUser() {
  return environment
    .unauthenticatedContext()
    .firestore();
}

// ============================================================
// DOCUMENT REFERENCES
// ============================================================

function profileRef(db, uid) {
  return doc(db, "emergencyProfiles", uid);
}

function qrRef(db, uid) {
  return doc(db, "personalEmergencyQrs", uid);
}

function publicRef(db, qrId) {
  return doc(db, "publicEmergencyQrs", qrId);
}

function registryRef(db, qrId) {
  return doc(db, "emergencyQrRegistry", qrId);
}

// ============================================================
// ADMIN TEST HELPERS
// ============================================================

// Admin setup bypasses Firestore rules.
// Never use this helper in application code.

async function seedProfile(uid, overrides = {}) {
  await environment.withSecurityRulesDisabled(
    async (context) => {
      const db = context.firestore();

      await setDoc(
        profileRef(db, uid),
        profile(uid, overrides)
      );
    }
  );
}

async function seedActiveQr(uid, qrId) {
  await environment.withSecurityRulesDisabled(
    async (context) => {
      const db = context.firestore();

      await setDoc(
        qrRef(db, uid),
        activeQr(uid, qrId)
      );

      await setDoc(
        registryRef(db, qrId),
        registry(uid, qrId)
      );

      await setDoc(
        publicRef(db, qrId),
        publicQr(uid, qrId)
      );
    }
  );
}

// ============================================================
// ENVIRONMENT
// ============================================================

before(async () => {
  const rules = readFileSync(
    RULES_PATH,
    "utf8"
  );

  environment = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules,
    },
  });
});

beforeEach(async () => {
  await environment.clearFirestore();
});

after(async () => {
  if (environment) {
    await environment.cleanup();
  }
});

// ============================================================
// TEST 01
// ANONYMOUS PROFILE ACCESS
// ============================================================

test(
  "01 - Anonymous users cannot read private profiles",
  async () => {
    await seedProfile(USER_A);

    const db = anonymousUser();

    await assertFails(
      getDoc(profileRef(db, USER_A))
    );
  }
);

// ============================================================
// TEST 02
// UNVERIFIED EMAIL ACCESS
// ============================================================

test(
  "02 - Unverified users cannot read private profiles",
  async () => {
    await seedProfile(USER_A);

    const db = unverifiedUser(USER_A);

    await assertFails(
      getDoc(profileRef(db, USER_A))
    );
  }
);

// ============================================================
// TEST 03
// VERIFIED OWNER ACCESS
// ============================================================

test(
  "03 - Verified owners can read their own profiles",
  async () => {
    await seedProfile(USER_A);

    const db = verifiedUser(USER_A);

    const snapshot = await assertSucceeds(
      getDoc(profileRef(db, USER_A))
    );

    assert.equal(snapshot.exists(), true);
    assert.equal(
      snapshot.data().ownerId,
      USER_A
    );
  }
);

// ============================================================
// TEST 04
// CROSS-ACCOUNT PROFILE ACCESS
// ============================================================

test(
  "04 - Users cannot read another user's profile",
  async () => {
    await seedProfile(USER_A);

    const db = verifiedUser(USER_B);

    await assertFails(
      getDoc(profileRef(db, USER_A))
    );
  }
);

// ============================================================
// TEST 05
// PROFILE CREATION
// ============================================================

test(
  "05 - Verified owners can create valid profiles",
  async () => {
    const db = verifiedUser(USER_A);

    await assertSucceeds(
      setDoc(
        profileRef(db, USER_A),
        profile(USER_A)
      )
    );
  }
);

// ============================================================
// TEST 06
// PROFILE IMPERSONATION
// ============================================================

test(
  "06 - Users cannot create profiles for other accounts",
  async () => {
    const db = verifiedUser(USER_B);

    await assertFails(
      setDoc(
        profileRef(db, USER_A),
        profile(USER_A)
      )
    );
  }
);

// ============================================================
// TEST 07
// INVALID PROFILE
// ============================================================

test(
  "07 - Profiles with invalid privacy settings are rejected",
  async () => {
    const db = verifiedUser(USER_A);

    const invalidProfile = profile(
      USER_A,
      {
        privacy: {
          ...privacy(),
          showBloodGroup: "yes",
        },
      }
    );

    await assertFails(
      setDoc(
        profileRef(db, USER_A),
        invalidProfile
      )
    );
  }
);

// ============================================================
// TEST 08
// CONSENT REQUIRED
// ============================================================

test(
  "08 - Profile creation requires consent",
  async () => {
    const db = verifiedUser(USER_A);

    await assertFails(
      setDoc(
        profileRef(db, USER_A),
        profile(
          USER_A,
          { consentGiven: false }
        )
      )
    );
  }
);

// ============================================================
// TEST 09
// PROFILE UPDATE
// ============================================================

test(
  "09 - Owners can update profiles with newer timestamps",
  async () => {
    await seedProfile(USER_A);

    const db = verifiedUser(USER_A);

    await assertSucceeds(
      updateDoc(
        profileRef(db, USER_A),
        {
          fullName: "Updated Test User",
          updatedAt:
            "2026-09-02T11:00:00.000Z",
        }
      )
    );
  }
);

// ============================================================
// TEST 10
// CROSS-ACCOUNT PROFILE MODIFICATION
// ============================================================

test(
  "10 - Users cannot modify another user's profile",
  async () => {
    await seedProfile(USER_A);

    const db = verifiedUser(USER_B);

    await assertFails(
      updateDoc(
        profileRef(db, USER_A),
        {
          fullName: "Unauthorized Change",
          updatedAt:
            "2026-09-02T11:00:00.000Z",
        }
      )
    );
  }
);

// ============================================================
// TEST 11
// DRAFT QR CREATION
// ============================================================

test(
  "11 - Verified owners can create draft QRs",
  async () => {
    await seedProfile(USER_A);

    const db = verifiedUser(USER_A);

    await assertSucceeds(
      setDoc(
        qrRef(db, USER_A),
        draftQr(USER_A, QR_A)
      )
    );
  }
);

// ============================================================
// TEST 12
// CLIENT-SIDE QR ACTIVATION
// ============================================================

test(
  "12 - Clients cannot activate QRs directly",
  async () => {
    await seedProfile(USER_A);

    const db = verifiedUser(USER_A);

    await assertSucceeds(
      setDoc(
        qrRef(db, USER_A),
        draftQr(USER_A, QR_A)
      )
    );

    await assertFails(
      updateDoc(
        qrRef(db, USER_A),
        {
          status: "ACTIVE",
        }
      )
    );
  }
);

// ============================================================
// TEST 13
// PUBLIC EMERGENCY ACCESS
// ============================================================


test(
  "13 - Anonymous users can read valid active public QRs",
  async () => {
    // Create a private profile and its active QR.
    await seedProfile(USER_A);
    await seedActiveQr(USER_A, QR_A);

    // Read the actual stored documents using the
    // rules-disabled test administrator.
    await environment.withSecurityRulesDisabled(
      async (context) => {
        const adminDb = context.firestore();

        const profileSnapshot = await getDoc(
          profileRef(adminDb, USER_A)
        );

        const qrSnapshot = await getDoc(
          qrRef(adminDb, USER_A)
        );

        const registrySnapshot = await getDoc(
          registryRef(adminDb, QR_A)
        );

        assert.equal(profileSnapshot.exists(), true);
        assert.equal(qrSnapshot.exists(), true);
        assert.equal(registrySnapshot.exists(), true);

        const storedProfile = profileSnapshot.data();
        const storedQr = qrSnapshot.data();
        const storedRegistry = registrySnapshot.data();

        // Verify the complete authorization relationship.
        assert.equal(storedProfile.ownerId, USER_A);
        assert.equal(storedProfile.consentGiven, true);

        assert.equal(storedQr.id, QR_A);
        assert.equal(storedQr.ownerId, USER_A);
        assert.equal(storedQr.profileId, USER_A);
        assert.equal(storedQr.status, "ACTIVE");

        assert.equal(storedRegistry.qrId, QR_A);
        assert.equal(storedRegistry.ownerId, USER_A);
        assert.equal(storedRegistry.profileId, USER_A);

        // Rebuild the published document using the
        // actual stored profile timestamp.
        await setDoc(
          publicRef(adminDb, QR_A),
          publicQr(USER_A, QR_A, {
            qrId: storedQr.id,
            ownerId: storedQr.ownerId,
            status: storedQr.status,
            fullName: storedProfile.fullName,
            sourceUpdatedAt: storedProfile.updatedAt,
          })
        );
      }
    );

    // This read must work without authentication.
    const publicDb = anonymousUser();

    const result = await assertSucceeds(
      getDoc(publicRef(publicDb, QR_A))
    );

    assert.equal(result.exists(), true);
    assert.equal(result.data().ownerId, USER_A);
    assert.equal(result.data().qrId, QR_A);
    assert.equal(result.data().status, "ACTIVE");
  }
);

// ============================================================
// TEST 14
// INACTIVE QR ACCESS
// ============================================================

test(
  "14 - Inactive QRs cannot expose public profiles",
  async () => {
    await seedProfile(USER_A);
    await seedActiveQr(USER_A, QR_A);

    await environment.withSecurityRulesDisabled(
      async (context) => {
        const db = context.firestore();

        await updateDoc(
          qrRef(db, USER_A),
          {
            status: "INACTIVE",
          }
        );
      }
    );

    const db = anonymousUser();

    await assertFails(
      getDoc(publicRef(db, QR_A))
    );
  }
);

// ============================================================
// TEST 15
// CONSENT WITHDRAWAL
// ============================================================

test(
  "15 - Withdrawing consent blocks public QR access",
  async () => {
    await seedProfile(USER_A);
    await seedActiveQr(USER_A, QR_A);

    await environment.withSecurityRulesDisabled(
      async (context) => {
        const db = context.firestore();

        await updateDoc(
          profileRef(db, USER_A),
          {
            consentGiven: false,
            consentUpdatedAt:
              "2026-09-02T12:00:00.000Z",
            updatedAt:
              "2026-09-02T12:00:00.000Z",
          }
        );
      }
    );

    const db = anonymousUser();

    await assertFails(
      getDoc(publicRef(db, QR_A))
    );
  }
);

// ============================================================
// TEST 16
// REGISTRY PROTECTION
// ============================================================

test(
  "16 - Clients cannot modify the QR ownership registry",
  async () => {
    await seedProfile(USER_A);
    await seedActiveQr(USER_A, QR_A);

    const db = verifiedUser(USER_B);

    await assertFails(
      setDoc(
        registryRef(db, QR_A),
        registry(USER_B, QR_A)
      )
    );

    await assertFails(
      deleteDoc(
        registryRef(db, QR_A)
      )
    );

    await assertFails(
      getDoc(
        registryRef(db, QR_A)
      )
    );
  }
);

// ============================================================
// ADDITIONAL SECURITY REGRESSION TESTS
// ============================================================

test(
  "17 - Anonymous users cannot list private profiles",
  async () => {
    await seedProfile(USER_A);

    const db = anonymousUser();

    await assertFails(
      getDocs(
        collection(db, "emergencyProfiles")
      )
    );
  }
);

test(
  "18 - Clients cannot write public emergency records",
  async () => {
    const db = verifiedUser(USER_A);

    await assertFails(
      setDoc(
        publicRef(db, QR_A),
        publicQr(USER_A, QR_A)
      )
    );
  }
);

test(
  "19 - Clients cannot delete active personal QRs",
  async () => {
    await seedProfile(USER_A);
    await seedActiveQr(USER_A, QR_A);

    const db = verifiedUser(USER_A);

    await assertFails(
      deleteDoc(
        qrRef(db, USER_A)
      )
    );
  }
);

test(
  "20 - A public QR requires a matching registry",
  async () => {
    await seedProfile(USER_A);
    await seedActiveQr(USER_A, QR_A);

    await environment.withSecurityRulesDisabled(
      async (context) => {
        await deleteDoc(
          registryRef(
            context.firestore(),
            QR_A
          )
        );
      }
    );

    const db = anonymousUser();

    await assertFails(
      getDoc(publicRef(db, QR_A))
    );
  }
);

test(
  "21 - A mismatched registry blocks public access",
  async () => {
    await seedProfile(USER_A);
    await seedActiveQr(USER_A, QR_A);

    await environment.withSecurityRulesDisabled(
      async (context) => {
        await setDoc(
          registryRef(
            context.firestore(),
            QR_A
          ),
          registry(USER_B, QR_A)
        );
      }
    );

    const db = anonymousUser();

    await assertFails(
      getDoc(publicRef(db, QR_A))
    );
  }
);

test(
  "22 - Stale published profiles are inaccessible",
  async () => {
    await seedProfile(USER_A);
    await seedActiveQr(USER_A, QR_A);

    await environment.withSecurityRulesDisabled(
      async (context) => {
        await updateDoc(
          profileRef(
            context.firestore(),
            USER_A
          ),
          {
            updatedAt:
              "2026-09-03T12:00:00.000Z",
          }
        );
      }
    );

    const db = anonymousUser();

    await assertFails(
      getDoc(publicRef(db, QR_A))
    );
  }
);

test(
  "23 - Users cannot delete another user's profile",
  async () => {
    await seedProfile(USER_A);

    const db = verifiedUser(USER_B);

    await assertFails(
      deleteDoc(profileRef(db, USER_A))
    );
  }
);

test(
  "24 - Unverified users cannot create draft QRs",
  async () => {
    await seedProfile(USER_A);

    const db = unverifiedUser(USER_A);

    await assertFails(
      setDoc(
        qrRef(db, USER_A),
        draftQr(USER_A, QR_A)
      )
    );
  }
);