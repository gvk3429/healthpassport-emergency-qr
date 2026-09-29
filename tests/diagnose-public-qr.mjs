
import {
  initializeTestEnvironment,
} from "@firebase/rules-unit-testing";

import {
  doc,
  getDoc,
  setDoc,
} from "firebase/firestore";

const UID = "security-user-a";
const QR_ID = "securityQrIdentifierAAAA123456";
const UPDATED_AT = "2026-09-01T11:00:00.000Z";

const profilePath =
  "/databases/$(database)/documents/emergencyProfiles/$(resource.data.ownerId)";

const qrPath =
  "/databases/$(database)/documents/personalEmergencyQrs/$(resource.data.ownerId)";

const registryPath =
  "/databases/$(database)/documents/emergencyQrRegistry/$(qrId)";

const checks = [
  {
    name: "Public document",
    expression: "true",
  },
  {
    name: "Public QR status and identifier",
    expression: `
      resource.data.status == 'ACTIVE'
      && resource.data.qrId == qrId
    `,
  },
  {
    name: "All three supporting documents exist",
    expression: `
      exists(${profilePath})
      && exists(${qrPath})
      && exists(${registryPath})
    `,
  },
  {
    name: "Profile ownership, consent and timestamp",
    expression: `
      get(${profilePath}).data.ownerId
        == resource.data.ownerId
      && get(${profilePath}).data.consentGiven == true
      && get(${profilePath}).data.updatedAt
        == resource.data.sourceUpdatedAt
    `,
  },
  {
    name: "Personal QR ownership and active status",
    expression: `
      get(${qrPath}).data.ownerId
        == resource.data.ownerId
      && get(${qrPath}).data.profileId
        == resource.data.ownerId
      && get(${qrPath}).data.id == qrId
      && get(${qrPath}).data.status == 'ACTIVE'
    `,
  },
  {
    name: "Registry ownership",
    expression: `
      get(${registryPath}).data.ownerId
        == resource.data.ownerId
      && get(${registryPath}).data.profileId
        == resource.data.ownerId
      && get(${registryPath}).data.qrId == qrId
    `,
  },
  {
    name: "All authorization conditions combined",
    expression: `
      resource.data.ownerId is string
      && resource.data.status == 'ACTIVE'
      && resource.data.qrId == qrId
      && exists(${profilePath})
      && exists(${qrPath})
      && exists(${registryPath})
      && get(${profilePath}).data.ownerId
        == resource.data.ownerId
      && get(${profilePath}).data.consentGiven == true
      && get(${profilePath}).data.updatedAt
        == resource.data.sourceUpdatedAt
      && get(${qrPath}).data.ownerId
        == resource.data.ownerId
      && get(${qrPath}).data.profileId
        == resource.data.ownerId
      && get(${qrPath}).data.id == qrId
      && get(${qrPath}).data.status == 'ACTIVE'
      && get(${registryPath}).data.ownerId
        == resource.data.ownerId
      && get(${registryPath}).data.profileId
        == resource.data.ownerId
      && get(${registryPath}).data.qrId == qrId
    `,
  },
];

function makeRules(expression) {
  return `
    rules_version = '2';

    service cloud.firestore {
      match /databases/{database}/documents {
        match /publicEmergencyQrs/{qrId} {
          allow get: if ${expression};
          allow list, write: if false;
        }

        match /{document=**} {
          allow read, write: if false;
        }
      }
    }
  `;
}

async function seedDocuments(environment) {
  await environment.withSecurityRulesDisabled(
    async (context) => {
      const db = context.firestore();

      await setDoc(
        doc(db, "emergencyProfiles", UID),
        {
          ownerId: UID,
          consentGiven: true,
          updatedAt: UPDATED_AT,
        }
      );

      await setDoc(
        doc(db, "personalEmergencyQrs", UID),
        {
          id: QR_ID,
          ownerId: UID,
          profileId: UID,
          status: "ACTIVE",
        }
      );

      await setDoc(
        doc(db, "emergencyQrRegistry", QR_ID),
        {
          qrId: QR_ID,
          ownerId: UID,
          profileId: UID,
        }
      );

      await setDoc(
        doc(db, "publicEmergencyQrs", QR_ID),
        {
          qrId: QR_ID,
          ownerId: UID,
          status: "ACTIVE",
          sourceUpdatedAt: UPDATED_AT,
        }
      );
    }
  );
}

for (let index = 0; index < checks.length; index++) {
  const check = checks[index];

  const environment = await initializeTestEnvironment({
    projectId: `healthpassport-diagnostic-${index + 1}`,
    firestore: {
      rules: makeRules(check.expression),
    },
  });

  try {
    await seedDocuments(environment);

    const db = environment
      .unauthenticatedContext()
      .firestore();

    try {
      const snapshot = await getDoc(
        doc(db, "publicEmergencyQrs", QR_ID)
      );

      console.log(
        `${snapshot.exists() ? "PASS" : "FAIL"}: ${check.name}`
      );
    } catch (error) {
      console.log(
        `FAIL: ${check.name} (${error.code ?? error.message})`
      );
    }
  } finally {
    await environment.cleanup();
  }
}