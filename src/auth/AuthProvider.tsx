
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

import { auth } from "../lib/firebase";
import { AuthContext } from "./AuthContext";

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
        console.error(
          "Authentication error:",
          error
        );
        setLoading(false);
      }
    );
  }, []);

  async function register(
    name: string,
    email: string,
    password: string
  ) {
    const credential =
      await createUserWithEmailAndPassword(
        auth,
        email.trim(),
        password
      );

    setUser(credential.user);

    await updateProfile(credential.user, {
      displayName: name.trim(),
    });

    await sendEmailVerification(
      credential.user
    );
  }

  async function login(
    email: string,
    password: string
  ) {
    const credential =
      await signInWithEmailAndPassword(
        auth,
        email.trim(),
        password
      );

    await reload(credential.user);
    setUser(credential.user);
  }

  async function loginWithGoogle() {
    const provider = new GoogleAuthProvider();

    const credential = await signInWithPopup(
      auth,
      provider
    );

    setUser(credential.user);
  }

  async function logout() {
    await signOut(auth);
    setUser(null);
  }

  async function resetPassword(email: string) {
    await sendPasswordResetEmail(
      auth,
      email.trim()
    );
  }

  async function resendVerification() {
    if (!auth.currentUser) {
      throw new Error(
        "You must sign in first."
      );
    }

    await sendEmailVerification(
      auth.currentUser
    );
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