
import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { getAuth } from "firebase-admin/auth";
import {
  FieldValue,
  getFirestore,
} from "firebase-admin/firestore";
import { defineSecret } from "firebase-functions/params";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import nodemailer from "nodemailer";

const db = getFirestore();

const emailUser = defineSecret("HP_EMAIL_USER");
const emailPassword = defineSecret("HP_EMAIL_APP_PASSWORD");
const otpHashSecret = defineSecret("HP_OTP_HASH_SECRET");

const REGION = "asia-south1";
const OTP_LIFETIME_MS = 5 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
const SEND_WINDOW_MS = 60 * 60 * 1000;
const MAX_SENDS_PER_WINDOW = 5;
const MAX_VERIFY_ATTEMPTS = 5;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type OtpSession = {
  email: string;
  codeHash: string;
  status: "SENDING" | "ACTIVE" | "USED";
  createdAt: number;
  expiresAt: number;
  lastSentAt: number;
  windowStartedAt: number;
  sendsInWindow: number;
  attempts: number;
};

function getOtpHash(
  uid: string,
  email: string,
  code: string
): string {
  const secret = otpHashSecret.value();

  if (secret.length < 32) {
    throw new HttpsError(
      "failed-precondition",
      "Email verification is not configured."
    );
  }

  return createHmac("sha256", secret)
    .update(`${uid}:${email}:${code}`)
    .digest("hex");
}

function hashesMatch(
  expected: string,
  supplied: string
): boolean {
  const expectedBuffer = Buffer.from(expected, "hex");
  const suppliedBuffer = Buffer.from(supplied, "hex");

  return (
    expectedBuffer.length === suppliedBuffer.length &&
    timingSafeEqual(expectedBuffer, suppliedBuffer)
  );
}

function authenticatedEmail(request: {
  auth?: {
    uid: string;
    token: {
      email?: string;
    };
  };
}): { uid: string; email: string } {
  if (!request.auth) {
    throw new HttpsError(
      "unauthenticated",
      "Sign in before requesting email verification."
    );
  }

  const uid = request.auth.uid;
  const email = request.auth.token.email;

  if (
    typeof email !== "string" ||
    !EMAIL_PATTERN.test(email) ||
    email.length > 254
  ) {
    throw new HttpsError(
      "failed-precondition",
      "A valid account email is required."
    );
  }

  return { uid, email: email.trim().toLowerCase() };
}

function createTransport() {
  const user = emailUser.value();
  const password = emailPassword.value();

  if (!user || !password) {
    throw new HttpsError(
      "failed-precondition",
      "Email delivery is not configured."
    );
  }

  return nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: {
      user,
      pass: password,
    },
    connectionTimeout: 12000,
    greetingTimeout: 12000,
    socketTimeout: 12000,
  });
}

export const sendEmailOtp = onCall(
  {
    region: REGION,
    secrets: [emailUser, emailPassword, otpHashSecret],
    maxInstances: 5,
    enforceAppCheck: true,
  },
  async (request) => {
    const { uid, email } = authenticatedEmail(request);
    const userRecord = await getAuth().getUser(uid);

    if (
      !userRecord.email ||
      userRecord.email.trim().toLowerCase() !== email
    ) {
      throw new HttpsError(
        "permission-denied",
        "The account email does not match."
      );
    }

    if (userRecord.emailVerified) {
      throw new HttpsError(
        "failed-precondition",
        "This email address is already verified."
      );
    }

    const now = Date.now();
    const code = randomInt(0, 1_000_000)
      .toString()
      .padStart(6, "0");
    const codeHash = getOtpHash(uid, email, code);
    const sessionRef = db.doc(`emailOtpSessions/${uid}`);

    await db.runTransaction(async (tx) => {
      const snap = await tx.get(sessionRef);
      const previous = snap.exists
        ? (snap.data() as OtpSession)
        : null;

      if (
        previous &&
        now - previous.lastSentAt < RESEND_COOLDOWN_MS
      ) {
        throw new HttpsError(
          "resource-exhausted",
          "Please wait before requesting another code."
        );
      }

      const sameWindow =
        previous &&
        now - previous.windowStartedAt < SEND_WINDOW_MS;

      const sendsInWindow = sameWindow
        ? previous.sendsInWindow
        : 0;

      if (sendsInWindow >= MAX_SENDS_PER_WINDOW) {
        throw new HttpsError(
          "resource-exhausted",
          "Too many codes requested. Try again later."
        );
      }

      const windowStartedAt = sameWindow
        ? previous.windowStartedAt
        : now;

      tx.set(sessionRef, {
        email,
        codeHash,
        status: "SENDING",
        createdAt: now,
        expiresAt: now + OTP_LIFETIME_MS,
        lastSentAt: now,
        windowStartedAt,
        sendsInWindow: sendsInWindow + 1,
        attempts: 0,
      } satisfies OtpSession);
    });

    try {
      const transporter = createTransport();

      await transporter.sendMail({
        from: `"HealthPassport" <${emailUser.value()}>`,
        to: email,
        subject: "Your HealthPassport verification code",
        text: [
          "Your HealthPassport email verification code is:",
          "",
          code,
          "",
          "This code expires in 5 minutes.",
          "If you did not request this code, you can ignore this email.",
          "",
          "For your security, do not share this code with anyone.",
        ].join("\n"),
      });

      await sessionRefUpdateActive(sessionRef, codeHash);
    } catch {
      await db.runTransaction(async (tx) => {
        const snap = await tx.get(sessionRef);

        if (
          snap.exists &&
          snap.data()?.codeHash === codeHash &&
          snap.data()?.status === "SENDING"
        ) {
          tx.delete(sessionRef);
        }
      });

      throw new HttpsError(
        "unavailable",
        "We could not send the verification email. Please try again later."
      );
    }

    return {
      success: true,
      expiresInSeconds: OTP_LIFETIME_MS / 1000,
      resendAfterSeconds: RESEND_COOLDOWN_MS / 1000,
    };
  }
);

async function sessionRefUpdateActive(
  sessionRef: FirebaseFirestore.DocumentReference,
  codeHash: string
): Promise<void> {
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(sessionRef);

    if (
      !snap.exists ||
      snap.data()?.codeHash !== codeHash ||
      snap.data()?.status !== "SENDING"
    ) {
      throw new HttpsError(
        "aborted",
        "The verification request changed. Request a new code."
      );
    }

    tx.update(sessionRef, { status: "ACTIVE" });
  });
}

export const verifyEmailOtp = onCall(
  {
    region: REGION,
    secrets: [otpHashSecret],
    maxInstances: 5,
    enforceAppCheck: true,
  },
  async (request) => {
    const { uid, email } = authenticatedEmail(request);
    const suppliedCode = request.data?.code;

    if (
      typeof suppliedCode !== "string" ||
      !/^\d{6}$/.test(suppliedCode)
    ) {
      throw new HttpsError(
        "invalid-argument",
        "Enter the six-digit verification code."
      );
    }

    const userRecord = await getAuth().getUser(uid);

    if (
      !userRecord.email ||
      userRecord.email.trim().toLowerCase() !== email
    ) {
      throw new HttpsError(
        "permission-denied",
        "The account email does not match."
      );
    }

    if (userRecord.emailVerified) {
      return { success: true, alreadyVerified: true };
    }

    const sessionRef = db.doc(`emailOtpSessions/${uid}`);
    const suppliedHash = getOtpHash(uid, email, suppliedCode);
    const now = Date.now();

    const verified = await db.runTransaction(async (tx) => {
      const snap = await tx.get(sessionRef);

      if (!snap.exists) {
        throw new HttpsError(
          "failed-precondition",
          "Request a new verification code."
        );
      }

      const session = snap.data() as OtpSession;

      if (
        session.email !== email ||
        session.status !== "ACTIVE" ||
        session.expiresAt <= now
      ) {
        throw new HttpsError(
          "failed-precondition",
          "The code is expired or unavailable. Request a new code."
        );
      }

      if (session.attempts >= MAX_VERIFY_ATTEMPTS) {
        tx.delete(sessionRef);

        throw new HttpsError(
          "resource-exhausted",
          "Too many incorrect attempts. Request a new code."
        );
      }

      if (!hashesMatch(session.codeHash, suppliedHash)) {
        tx.update(sessionRef, {
          attempts: FieldValue.increment(1),
        });

        return false;
      }

      tx.update(sessionRef, {
        status: "USED",
        codeHash: "",
        verifiedAt: now,
      });

      return true;
    });

    if (!verified) {
      throw new HttpsError(
        "permission-denied",
        "The verification code is incorrect."
      );
    }

    await getAuth().updateUser(uid, {
      emailVerified: true,
    });

    return { success: true, alreadyVerified: false };
  }
);
