
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

import { httpsCallable } from "firebase/functions";
import { auth, functions } from "../lib/firebase";
import { AuthContext } from "./AuthContext";

type ValidateReferralResponse = {
  valid: boolean;
  reason: string;
};

const validateReferralCode = httpsCallable<
  { code: string },
  ValidateReferralResponse
>(functions, "validateReferralCode");

const prepareReferral = httpsCallable<
  { code: string },
  { accepted: boolean }
>(functions, "prepareReferral");

export function AuthProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(
      auth,
      (firebaseUser) => {
        setUser(firebaseUser);
        setLoading(false);
      },
      (error) => {
        console.error("Authentication error:", error);
        setLoading(false);
      }
    );
  }, []);

  async function register(
    name: string,
    email: string,
    password: string,
    referralCode?: string
  ) {
    const normalizedEmail = email.trim();
    const normalizedCode = referralCode?.trim().toUpperCase() ?? "";

    // Validate before account creation so an invalid referral
    // does not leave behind a newly created, unverified account.
    if (normalizedCode) {
      const validation = await validateReferralCode({
        code: normalizedCode,
      });

      if (!validation.data.valid) {
        const messages: Record<string, string> = {
          INVALID_FORMAT: "Enter a valid 8-character referral code.",
          NOT_FOUND: "That referral code does not exist.",
          DISABLED: "That referral code has been disabled.",
          EXPIRED: "That referral code has expired.",
        };

        throw new Error(
          messages[validation.data.reason] ??
            "The referral code could not be validated."
        );
      }
    }

    const credential = await createUserWithEmailAndPassword(
      auth,
      normalizedEmail,
      password
    );

    setUser(credential.user);

    await updateProfile(credential.user, {
      displayName: name.trim(),
    });

    // Save pending attribution before sending the verification email.
    // The backend revalidates the code and prevents self-referrals.
    if (normalizedCode) {
      try {
        await prepareReferral({ code: normalizedCode });
      } catch (error) {
        // Keep the newly created account recoverable if referral
        // preparation fails. Do not silently claim attribution exists.
        console.error("Referral preparation failed:", error);
        throw new Error(
          "Your account was created, but the referral could not be saved. " +
            "Please sign in again and contact support before continuing."
        );
      }
    }

    await sendEmailVerification(credential.user);
  }

  async function login(email: string, password: string) {
    const credential = await signInWithEmailAndPassword(
      auth,
      email.trim(),
      password
    );

    await reload(credential.user);
    setUser(credential.user);
  }

  async function loginWithGoogle() {
    const provider = new GoogleAuthProvider();
    const credential = await signInWithPopup(auth, provider);
    setUser(credential.user);
  }

  async function logout() {
    await signOut(auth);
    setUser(null);
  }

  async function resetPassword(email: string) {
    await sendPasswordResetEmail(auth, email.trim());
  }

  async function resendVerification() {
    if (!auth.currentUser) {
      throw new Error("You must sign in first.");
    }

    await sendEmailVerification(auth.currentUser);
  }

  async function refreshUser() {
    const currentUser = auth.currentUser;

    if (!currentUser) return false;

    await reload(currentUser);
    await currentUser.getIdToken(true);
    setUser(currentUser);

    return currentUser.emailVerified;
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
