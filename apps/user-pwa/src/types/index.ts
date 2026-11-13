export type {
  ApiEnvelope,
  BedInventory,
  Doctor,
  HospitalDetails,
  PublicDoctor,
  PublicHospital,
  TriageResult,
} from '@repo/database/contracts';

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export type LocationStatus = 'requesting' | 'live' | 'fallback';
export type AppTab = 'emergency' | 'doctors' | 'ai' | 'profile';
