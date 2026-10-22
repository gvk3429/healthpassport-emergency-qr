import { createContext, useContext } from "react";
import type { User } from "firebase/auth";

export type RegistrationDetails = {
  firstName: string;
  lastName: string;
  email: string;
  countryCode: string;
  mobileNumber: string;
  password: string;
  referralCode?: string;
};

export type AuthContextType = {
  user: User | null;
  loading: boolean;
  register: (details: RegistrationDetails) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  resendVerification: () => Promise<void>;
  refreshUser: () => Promise<boolean>;
};

export const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }

  return context;
}