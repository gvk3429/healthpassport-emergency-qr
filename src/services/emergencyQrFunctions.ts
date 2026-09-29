
import { getApp } from "firebase/app";

import {
  getFunctions,
  httpsCallable,
} from "firebase/functions";

const functions = getFunctions(
  getApp(),
  "asia-south1"
);

interface QrActionResponse {
  success: boolean;
}

export async function activateEmergencyQr():
  Promise<QrActionResponse> {
  const callable = httpsCallable<
    void,
    QrActionResponse
  >(
    functions,
    "activateEmergencyQr"
  );

  const result = await callable();

  return result.data;
}

export async function deactivateEmergencyQr():
  Promise<QrActionResponse> {
  const callable = httpsCallable<
    void,
    QrActionResponse
  >(
    functions,
    "deactivateEmergencyQr"
  );

  const result = await callable();

  return result.data;
}