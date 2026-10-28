
export type BloodGroup =
  | "A+"
  | "A-"
  | "B+"
  | "B-"
  | "AB+"
  | "AB-"
  | "O+"
  | "O-"
  | "Unknown";

export interface EmergencyContact {
  id: string;
  name: string;
  relationship: string;
  phone: string;

  // Private: used only for emergency email notifications.
  // Optional while migrating existing profiles.
  email?: string;

  isPrimary: boolean;
}

export interface EmergencyPrivacy {
  showPhoto: boolean;
  showHomeAddress: boolean;
  showDateOfBirth: boolean;
  showBloodGroup: boolean;
  showAllergies: boolean;
  showMedicalConditions: boolean;
  showMedications: boolean;
  showEmergencyContacts: boolean;
  showEmergencyInstructions: boolean;
}

export interface EmergencyProfile {
  ownerId: string;

  fullName: string;
  photoUrl: string;
  homeAddress: string;
  dateOfBirth: string;
  bloodGroup: BloodGroup;

  allergies: string[];
  medicalConditions: string[];
  medications: string[];

  emergencyContacts: EmergencyContact[];
  emergencyInstructions: string;

  privacy: EmergencyPrivacy;

  consentGiven: boolean;
  consentUpdatedAt: string | null;

  createdAt: string;
  updatedAt: string;
}

export const DEFAULT_EMERGENCY_PRIVACY: EmergencyPrivacy = {
  showPhoto: false,
  showHomeAddress: false,
  showDateOfBirth: false,
  showBloodGroup: false,
  showAllergies: false,
  showMedicalConditions: false,
  showMedications: false,
  showEmergencyContacts: false,
  showEmergencyInstructions: false,
};