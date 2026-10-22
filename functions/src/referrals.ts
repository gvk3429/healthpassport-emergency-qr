
import { randomBytes } from "node:crypto";
import { getAuth } from "firebase-admin/auth";
import {
  FieldValue,
  Timestamp,
  getFirestore,
} from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";

const db = getFirestore();
const REGION = "asia-south1";
const CODE_PATTERN = /^[A-Z0-9]{8}$/;

type ReferralCodeDocument = {
  ownerUid?: string;
  ownerEmail?: string;
  active?: boolean;
  expiresAt?: Timestamp | null;
};

function normalizeCode(value: unknown): string {
  return typeof value === "string" ? value.trim().toUpperCase() : "";
}

function isCodeFormatValid(code: string): boolean {
  return CODE_PATTERN.test(code);
}

function generateCode(): string {
  return randomBytes(4).toString("hex").toUpperCase();
}

function requireUid(request: {
  auth?: { uid: string } | null;
}): string {
  if (!request.auth?.uid) {
    throw new HttpsError("unauthenticated", "Please sign in.");
  }

  return request.auth.uid;
}

function requireVerifiedUid(request: {
  auth?: {
    uid: string;
    token: Record<string, unknown>;
  } | null;
}): string {
  const uid = requireUid(request);

  if (request.auth?.token.email_verified !== true) {
    throw new HttpsError(
      "failed-precondition",
      "Verify your email before completing referral setup."
    );
  }

  return uid;
}

function codeIsActive(
  data: ReferralCodeDocument | undefined
): boolean {
  if (!data || data.active !== true) return false;

  if (
    data.expiresAt instanceof Timestamp &&
    data.expiresAt.toMillis() <= Date.now()
  ) {
    return false;
  }

  return true;
}

function invalidCodeReason(
  data: ReferralCodeDocument | undefined
): string {
  if (!data) return "NOT_FOUND";
  if (data.active !== true) return "DISABLED";

  if (
    data.expiresAt instanceof Timestamp &&
    data.expiresAt.toMillis() <= Date.now()
  ) {
    return "EXPIRED";
  }

  return "VALID";
}

class ReferralCodeCollisionError extends Error {
  constructor() {
    super("Generated referral code already exists.");
  }
}

/**
 * Public preflight validation only.
 * This function never records referral attribution.
 */
export const validateReferralCode = onCall(
  { region: REGION },
  async (request) => {
    const code = normalizeCode(request.data?.code);

    if (!isCodeFormatValid(code)) {
      return { valid: false, reason: "INVALID_FORMAT" };
    }

    const snapshot = await db
      .collection("referralCodes")
      .doc(code)
      .get();

    const data = snapshot.exists
      ? (snapshot.data() as ReferralCodeDocument)
      : undefined;

    const reason = invalidCodeReason(data);

    return {
      valid: reason === "VALID",
      reason,
    };
  }
);

/**
 * Save a pending referral before email verification.
 * Attribution is not finalized here.
 */
export const prepareReferral = onCall(
  { region: REGION },
  async (request) => {
    const uid = requireUid(request);
    const code = normalizeCode(request.data?.code);

    if (!isCodeFormatValid(code)) {
      throw new HttpsError(
        "invalid-argument",
        "Enter a valid referral code."
      );
    }

    const account = await getAuth().getUser(uid);
    const email = account.email?.trim().toLowerCase();

    if (!email) {
      throw new HttpsError(
        "failed-precondition",
        "Your account must have an email address."
      );
    }

    const codeRef = db.collection("referralCodes").doc(code);
    const pendingRef = db
      .collection("pendingReferralApplications")
      .doc(uid);
    const attributionRef = db
      .collection("referralAttributions")
      .doc(uid);

    await db.runTransaction(async (transaction) => {
      const [codeSnapshot, pendingSnapshot, attributionSnapshot] =
        await Promise.all([
          transaction.get(codeRef),
          transaction.get(pendingRef),
          transaction.get(attributionRef),
        ]);

      if (!codeSnapshot.exists) {
        throw new HttpsError(
          "not-found",
          "That referral code does not exist."
        );
      }

      const codeData =
        codeSnapshot.data() as ReferralCodeDocument;

      if (!codeIsActive(codeData)) {
        throw new HttpsError(
          "failed-precondition",
          "That referral code is disabled or expired."
        );
      }

      const referrerUid = codeData.ownerUid;
      const referrerEmail =
        codeData.ownerEmail?.trim().toLowerCase();

      if (!referrerUid) {
        throw new HttpsError(
          "failed-precondition",
          "That referral code is not configured correctly."
        );
      }

      if (
        referrerUid === uid ||
        (referrerEmail && referrerEmail === email)
      ) {
        throw new HttpsError(
          "failed-precondition",
          "You cannot use your own referral code."
        );
      }

      if (attributionSnapshot.exists) {
        const existing = attributionSnapshot.data();

        if (existing?.code === code) return;

        throw new HttpsError(
          "already-exists",
          "A referral has already been recorded for this account."
        );
      }

      if (pendingSnapshot.exists) {
        const existing = pendingSnapshot.data();

        if (
          existing?.code === code &&
          existing?.referrerUid === referrerUid
        ) {
          return;
        }

        throw new HttpsError(
          "already-exists",
          "A referral has already been selected for this account."
        );
      }

      transaction.create(pendingRef, {
        referredUid: uid,
        referrerUid,
        code,
        status: "PENDING_EMAIL_VERIFICATION",
        createdAt: FieldValue.serverTimestamp(),
      });
    });

    return { accepted: true };
  }
);

/**
 * After email verification, create the user's unique referral code
 * and finalize any pending referral attribution.
 *
 * Idempotent: subsequent calls return the existing code and do not
 * create duplicate attribution.
 */
export const completeReferralSetup = onCall(
  { region: REGION },
  async (request) => {
    const uid = requireVerifiedUid(request);
    const account = await getAuth().getUser(uid);

    if (!account.emailVerified || !account.email) {
      throw new HttpsError(
        "failed-precondition",
        "A verified email address is required."
      );
    }

    const email = account.email.trim().toLowerCase();
    const profileRef = db.collection("referralProfiles").doc(uid);
    const pendingRef = db
      .collection("pendingReferralApplications")
      .doc(uid);
    const attributionRef = db
      .collection("referralAttributions")
      .doc(uid);

    for (let attempt = 0; attempt < 8; attempt += 1) {
      const candidate = generateCode();
      const candidateRef = db
        .collection("referralCodes")
        .doc(candidate);

      try {
        const result = await db.runTransaction(async (transaction) => {
          const [
            profileSnapshot,
            candidateSnapshot,
            pendingSnapshot,
            attributionSnapshot,
          ] = await Promise.all([
            transaction.get(profileRef),
            transaction.get(candidateRef),
            transaction.get(pendingRef),
            transaction.get(attributionRef),
          ]);

          if (!profileSnapshot.exists && candidateSnapshot.exists) {
            throw new ReferralCodeCollisionError();
          }

          const profile = profileSnapshot.data();
          const existingCode =
            typeof profile?.code === "string"
              ? profile.code
              : null;

          const selectedCode = existingCode ?? candidate;
          const selectedCodeRef = existingCode
            ? db.collection("referralCodes").doc(existingCode)
            : candidateRef;

          // All reads, including the pending source code, happen
          // before any writes in this transaction.
          let selectedCodeSnapshot = candidateSnapshot;

          if (existingCode) {
            selectedCodeSnapshot =
              selectedCodeRef.path === candidateRef.path
                ? candidateSnapshot
                : await transaction.get(selectedCodeRef);
          }

          const pending = pendingSnapshot.data();
          const pendingCode =
            typeof pending?.code === "string"
              ? pending.code
              : null;

          let sourceCodeSnapshot:
            | FirebaseFirestore.DocumentSnapshot
            | undefined;

          if (pendingCode && !attributionSnapshot.exists) {
            sourceCodeSnapshot = await transaction.get(
              db.collection("referralCodes").doc(pendingCode)
            );
          }

          if (existingCode) {
            if (
              !selectedCodeSnapshot.exists ||
              selectedCodeSnapshot.data()?.ownerUid !== uid
            ) {
              throw new HttpsError(
                "failed-precondition",
                "Your referral profile needs administrator review."
              );
            }
          }

          const codeData = selectedCodeSnapshot.data();

          if (!existingCode) {
            transaction.create(candidateRef, {
              ownerUid: uid,
              ownerEmail: email,
              active: true,
              createdAt: FieldValue.serverTimestamp(),
              expiresAt: null,
            });

            transaction.create(profileRef, {
              uid,
              code: candidate,
              createdAt: FieldValue.serverTimestamp(),
            });
          } else if (codeData?.ownerEmail !== email) {
            transaction.update(selectedCodeRef, {
              ownerEmail: email,
            });
          }

          if (pendingSnapshot.exists && !attributionSnapshot.exists) {
            const sourceData = sourceCodeSnapshot?.exists
              ? (sourceCodeSnapshot.data() as ReferralCodeDocument)
              : undefined;

            const sourceUid = sourceData?.ownerUid;
            const sourceEmail =
              sourceData?.ownerEmail?.trim().toLowerCase();

            const canAttribute =
              !!pendingCode &&
              codeIsActive(sourceData) &&
              !!sourceUid &&
              sourceUid !== uid &&
              sourceUid === pending?.referrerUid &&
              pendingCode !== selectedCode &&
              (!sourceEmail || sourceEmail !== email);

            if (canAttribute) {
              transaction.create(attributionRef, {
                referredUid: uid,
                referrerUid: sourceUid,
                code: pendingCode,
                status: "VERIFIED",
                createdAt: FieldValue.serverTimestamp(),
                verifiedAt: FieldValue.serverTimestamp(),
              });

              transaction.update(pendingRef, {
                status: "COMPLETED",
                completedAt: FieldValue.serverTimestamp(),
              });
            } else {
              transaction.update(pendingRef, {
                status: "REJECTED",
                rejectedAt: FieldValue.serverTimestamp(),
                rejectionReason: "CODE_INVALID_AT_VERIFICATION",
              });
            }
          }

          return { code: selectedCode };
        });

        return result;
      } catch (error) {
        if (error instanceof ReferralCodeCollisionError) {
          continue;
        }

        throw error;
      }
    }

    throw new HttpsError(
      "resource-exhausted",
      "Unable to allocate a referral code. Please retry."
    );
  }
);

/**
 * Return the signed-in user's referral code and verified referral count.
 * Only the authenticated user's own referral profile is read.
 */
export const getReferralDashboardSummary = onCall(
  { region: REGION },
  async (request) => {
    const uid = requireVerifiedUid(request);

    const profileSnapshot = await db
      .collection("referralProfiles")
      .doc(uid)
      .get();

    if (!profileSnapshot.exists) {
      throw new HttpsError(
        "failed-precondition",
        "Your referral profile has not been created yet."
      );
    }

    const profile = profileSnapshot.data();
    const code =
      typeof profile?.code === "string" ? profile.code : "";

    if (!code || !isCodeFormatValid(code)) {
      throw new HttpsError(
        "failed-precondition",
        "Your referral profile needs administrator review."
      );
    }

    const codeSnapshot = await db
      .collection("referralCodes")
      .doc(code)
      .get();

    if (
      !codeSnapshot.exists ||
      codeSnapshot.data()?.ownerUid !== uid
    ) {
      throw new HttpsError(
        "failed-precondition",
        "Your referral code could not be verified."
      );
    }

    const referralsSnapshot = await db
      .collection("referralAttributions")
      .where("referrerUid", "==", uid)
      .where("status", "==", "VERIFIED")
      .get();

    return {
      code,
      verifiedReferrals: referralsSnapshot.size,
    };
  }
);
