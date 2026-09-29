
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const projectId =
  process.env.GCLOUD_PROJECT ||
  process.env.FIREBASE_PROJECT_ID ||
  JSON.parse(
    readFileSync(".firebaserc", "utf8")
  ).projects.default;

const region = "asia-south1";

const host =
  process.env.FUNCTIONS_EMULATOR_HOST ||
  "127.0.0.1:5001";

const baseUrl =
  `http://${host}/${projectId}/${region}`;

const inactiveQrId =
  "PHASE2INACTIVEQR123456789012";

async function notify(data) {
  const response = await fetch(
    `${baseUrl}/notifyEmergencyContacts`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ data }),
      signal: AbortSignal.timeout(15000),
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
    `Expected ${code}: ${JSON.stringify(response)}`
  );

  assert.equal(response.error.status, code);
}

test(
  "01 - Invalid QR format is rejected",
  async () => {
    const response = await notify({
      qrId: "../invalid",
    });

    expectError(response, "INVALID_ARGUMENT");
  }
);

test(
  "02 - Notification without GPS passes input validation",
  async () => {
    const response = await notify({
      qrId: inactiveQrId,
      message: "Emergency assistance required",
    });

    expectError(
      response,
      "FAILED_PRECONDITION"
    );
  }
);

test(
  "03 - Incomplete GPS fields are rejected",
  async () => {
    const response = await notify({
      qrId: inactiveQrId,
      latitude: 15.85,
      longitude: 74.5,
    });

    expectError(response, "INVALID_ARGUMENT");
  }
);

test(
  "04 - Invalid GPS accuracy is rejected",
  async () => {
    const response = await notify({
      qrId: inactiveQrId,
      latitude: 15.85,
      longitude: 74.5,
      accuracy: -10,
    });

    expectError(response, "INVALID_ARGUMENT");
  }
);

test(
  "05 - Oversized messages are rejected",
  async () => {
    const response = await notify({
      qrId: inactiveQrId,
      message: "A".repeat(501),
    });

    expectError(response, "INVALID_ARGUMENT");
  }
);

test(
  "06 - Inactive QR cannot trigger notification",
  async () => {
    const response = await notify({
      qrId: inactiveQrId,
      latitude: 15.85,
      longitude: 74.5,
      accuracy: 20,
    });

    expectError(
      response,
      "FAILED_PRECONDITION"
    );
  }
);