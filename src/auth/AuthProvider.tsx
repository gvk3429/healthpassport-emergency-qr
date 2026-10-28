import {
  useEffect,
  useState,
  type ReactNode,
} from "react";

import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  onAuthStateChanged,
  reload,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type User,
} from "firebase/auth";

import {
  doc,
  getFirestore,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";

import { httpsCallable } from "firebase/functions";

import { auth, functions } from "../lib/firebase";
import { AuthContext } from "./AuthContext";
import type { RegistrationDetails } from "./AuthContext";

const db = getFirestore(auth.app);

type ReferralValidationResult = {
  valid: boolean;
  reason?: string;
};

type PrepareReferralResult = {
  accepted: boolean;
};

const validateReferralCode = httpsCallable<
  { code: string },
  ReferralValidationResult
>(functions, "validateReferralCode");

const prepareReferral = httpsCallable<
  { code: string },
  PrepareReferralResult
>(functions, "prepareReferral");

function normalizeCountryCode(countryCode: string): string {
  const normalized = countryCode.trim().replace(/\s+/g, "");

  if (!/^\+[1-9]\d{0,3}$/.test(normalized)) {
    throw new Error("Please select a valid country code.");
  }

  return normalized;
}

function normalizeMobileNumber(mobileNumber: string): string {
  const normalized = mobileNumber.replace(/\D/g, "");

  if (normalized.length < 6 || normalized.length > 14) {
    throw new Error("Please enter a valid mobile number.");
  }

  return normalized;
}

function validatePassword(password: string): void {
  const valid =
    password.length >= 8 &&
    password.length <= 128 &&
    /[A-Z]/.test(password) &&
    /[a-z]/.test(password) &&
    /\d/.test(password) &&
    /[^A-Za-z0-9]/.test(password);

  if (!valid) {
    throw new Error(
      "Your password must contain 8–128 characters, " +
        "an uppercase letter, a lowercase letter, a number, " +
        "and a special character."
    );
  }
}

function registrationLog(message: string): void {
  console.info(`[Registration] ${message}`);
}

function getErrorCode(error: unknown): string | undefined {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string"
  ) {
    return error.code;
  }

  return undefined;
}

function getErrorMessage(error: unknown): string {
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }

  return String(error);
}

function referralValidationMessage(
  result: ReferralValidationResult
): string {
  switch (result.reason?.toUpperCase()) {
    case "EXPIRED":
      return "This referral code has expired.";

    case "DISABLED":
      return "This referral code is no longer active.";

    case "SELF_REFERRAL":
      return "You cannot use your own referral code.";

    default:
      return "This referral code is invalid. Please check it and try again.";
  }
}

export function AuthProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      auth,
      (firebaseUser) => {
        setUser(firebaseUser);
        setLoading(false);
      },
      (error) => {
        console.error(
          "[Authentication] State listener failed:",
          error
        );
        setLoading(false);
      }
    );

    return unsubscribe;
  }, []);

  async function register(
    details: RegistrationDetails
  ): Promise<void> {
    const firstName = details.firstName.trim();
    const lastName = details.lastName.trim();
    const email = details.email.trim().toLowerCase();
    const countryCode = normalizeCountryCode(details.countryCode);
    const mobileNumber = normalizeMobileNumber(details.mobileNumber);
    const password = details.password;
    const referralCode =
      details.referralCode?.trim().toUpperCase() ?? "";

    if (!firstName || !lastName) {
      throw new Error("Enter your first name and last name.");
    }

    if (firstName.length > 60 || lastName.length > 60) {
      throw new Error(
        "Each name must be 60 characters or fewer."
      );
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error("Please enter a valid email address.");
    }

    validatePassword(password);

    if (referralCode) {
      registrationLog("Validating referral code.");

      try {
        const validation = await validateReferralCode({
          code: referralCode,
        });

        if (!validation.data.valid) {
          throw new Error(
            referralValidationMessage(validation.data)
          );
        }
      } catch (error) {
        if (error instanceof Error && !getErrorCode(error)) {
          throw error;
        }

        console.error(
          "[Registration] Referral validation failed:",
          error
        );

        throw new Error(
          "We could not validate this referral code. " +
            "Please check your connection or try again.",
          { cause: error }
        );
      }
    }

    const fullName = `${firstName} ${lastName}`;

    registrationLog("Creating Firebase Authentication account.");

    const credential = await createUserWithEmailAndPassword(
      auth,
      email,
      password
    );

    const createdUser = credential.user;

    setUser(createdUser);

    try {
      registrationLog("Updating authentication display name.");

      await updateProfile(createdUser, {
        displayName: fullName,
      });

      registrationLog("Creating the userAccounts document.");

      await setDoc(doc(db, "userAccounts", createdUser.uid), {
        uid: createdUser.uid,
        firstName,
        lastName,
        fullName,
        email,
        mobileCountryCode: countryCode,
        mobileNumber,
        mobileVerified: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      if (referralCode) {
        registrationLog("Preparing referral attribution.");

        const prepared = await prepareReferral({
          code: referralCode,
        });

        if (!prepared.data.accepted) {
          throw new Error(
            "The referral could not be accepted. " +
              "Please contact support before retrying."
          );
        }
      }

      registrationLog("Sending email verification.");

      await sendEmailVerification(createdUser);

      await reload(createdUser);

      setUser(auth.currentUser ?? createdUser);

      registrationLog("Registration setup completed.");
    } catch (error) {
      console.error("[Registration] Setup failed.", {
        code: getErrorCode(error),
        message: getErrorMessage(error),
        uid: createdUser.uid,
      });

      throw error;
    }
  }

  async function login(
    email: string,
    password: string
  ): Promise<void> {
    const credential = await signInWithEmailAndPassword(
      auth,
      email.trim().toLowerCase(),
      password
    );

    await reload(credential.user);

    setUser(auth.currentUser ?? credential.user);
  }

  async function loginWithGoogle(): Promise<void> {
    const provider = new GoogleAuthProvider();

    const credential = await signInWithPopup(
      auth,
      provider
    );

    setUser(credential.user);
  }

  async function logout(): Promise<void> {
    await signOut(auth);
    setUser(null);
  }

  async function resetPassword(email: string): Promise<void> {
    await sendPasswordResetEmail(
      auth,
      email.trim().toLowerCase()
    );
  }

  async function resendVerification(): Promise<void> {
    const currentUser = auth.currentUser;

    if (!currentUser) {
      throw new Error("You must sign in first.");
    }

    if (currentUser.emailVerified) {
      throw new Error("Your email is already verified.");
    }

    await sendEmailVerification(currentUser);
  }

  async function refreshUser(): Promise<boolean> {
    const currentUser = auth.currentUser;

    if (!currentUser) {
      setUser(null);
      return false;
    }

    await reload(currentUser);

    const refreshedUser = auth.currentUser ?? currentUser;

    await refreshedUser.getIdToken(true);

    setUser(refreshedUser);

    return refreshedUser.emailVerified;
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        register,
        login,
        loginWithGoogle,
        logout,
        resetPassword,
        resendVerification,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}