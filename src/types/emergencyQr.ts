
import type { Timestamp } from "firebase/firestore";

export type EmergencyQrStatus =
  | "DRAFT"
  | "ACTIVE"
  | "INACTIVE";

export type EmergencyQrTimestamp =
  | string
  | Timestamp;

export interface EmergencyQr {
  id: string;
  ownerId: string;
  profileId: string;

  status: EmergencyQrStatus;

  createdAt: EmergencyQrTimestamp;
  updatedAt: EmergencyQrTimestamp;
  activatedAt: EmergencyQrTimestamp | null;
  deactivatedAt: EmergencyQrTimestamp | null;
}