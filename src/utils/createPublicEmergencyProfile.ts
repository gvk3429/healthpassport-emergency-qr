
import type {
  EmergencyProfile,
} from "../types/emergencyProfile";

import type {
  PublicEmergencyProfile,
} from "../types/publicEmergencyProfile";

export function createPublicEmergencyProfile(
  profile: EmergencyProfile,
  qrId: string
): PublicEmergencyProfile {
  if (!profile.consentGiven) {
    throw new Error(
      "Emergency information consent is required."
    );
  }

  const now = new Date().toISOString();

  const result: PublicEmergencyProfile = {
    qrId,
    status: "ACTIVE",
    fullName: profile.fullName,
    publishedAt: now,
    updatedAt: now,
  };

  const privacy = profile.privacy;

  if (privacy.showPhoto && profile.photoUrl) {
    result.photoUrl = profile.photoUrl;
  }

  if (privacy.showHomeAddress && profile.homeAddress?.trim()) {
    result.homeAddress = profile.homeAddress.trim();
  }

  if (
    privacy.showDateOfBirth &&
    profile.dateOfBirth
  ) {
    result.dateOfBirth =
      profile.dateOfBirth;
  }

  if (
    privacy.showBloodGroup &&
    profile.bloodGroup !== "Unknown"
  ) {
    result.bloodGroup =
      profile.bloodGroup;
  }

  if (privacy.showAllergies) {
    result.allergies = [
      ...profile.allergies,
    ];
  }

  if (privacy.showMedicalConditions) {
    result.medicalConditions = [
      ...profile.medicalConditions,
    ];
  }

  if (privacy.showMedications) {
    result.medications = [
      ...profile.medications,
    ];
  }

  if (privacy.showEmergencyContacts) {
    result.emergencyContacts =
      profile.emergencyContacts.map(
        (contact) => ({
          name: contact.name,
          relationship: contact.relationship,
          phone: contact.phone,
          isPrimary: contact.isPrimary,
        })
      );
  }

  if (privacy.showEmergencyInstructions) {
    result.emergencyInstructions =
      profile.emergencyInstructions;
  }

  return result;
}