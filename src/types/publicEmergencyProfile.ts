
export interface PublicEmergencyContact {
  name: string;
  relationship: string;
  phone: string;
  isPrimary: boolean;
}

export interface PublicEmergencyProfile {
  qrId: string;
  status: "ACTIVE" | "INACTIVE";

  fullName: string;

  photoUrl?: string;
  homeAddress?: string;
  dateOfBirth?: string;
  bloodGroup?: string;

  allergies?: string[];
  medicalConditions?: string[];
  medications?: string[];

  emergencyContacts?: PublicEmergencyContact[];

  emergencyInstructions?: string;

  publishedAt: string;
  updatedAt: string;
}