import type {
  bedStatusEnum,
  verificationStatusEnum,
} from './schema/hospital.js';

export type BedStatus = (typeof bedStatusEnum.enumValues)[number];
export type VerificationStatus =
  (typeof verificationStatusEnum.enumValues)[number];

export interface Hospital {
  id: string;
  name: string;
  address: string;
  latitude: string;
  longitude: string;
  hotlinePhone: string;
  verificationStatus: VerificationStatus;
  createdAt: string;
  updatedAt: string;
}

export interface BedInventory {
  id: string;
  hospitalId: string;
  category: string;
  department: string;
  availableCount: number;
  totalCount: number;
  statusCode: BedStatus;
  lastUpdatedByUserId: string | null;
  lastUpdatedAt: string;
}

export interface Doctor {
  id: string;
  hospitalId: string;
  name: string;
  specialty: string;
  experienceYears: number;
  chamberSchedule: string;
  contactPhone: string;
  isAvailable: boolean;
  createdAt: string;
}

export interface PublicHospital extends Hospital {
  beds: BedInventory[];
}

export interface PublicDoctor extends Doctor {
  hospitalName: string;
  hospitalAddress: string;
}

export interface HospitalDocument {
  id: string;
  hospitalId: string;
  fileName: string;
  fileSize: number;
  storagePath: string;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  hospitalId: string;
  actorId: string;
  actionType: string;
  payload: string;
  createdAt: string;
}

export interface AdminAuditLog extends AuditLog {
  hospitalName: string;
}

export interface AdminHospital extends Hospital {
  documents: HospitalDocument[];
}

export interface PlatformAnalytics {
  activeHospitals: number;
  availableIcuBeds: number;
  availableGeneralBeds: number;
  responseLatencyMs: number;
}

export interface HospitalDetails extends Hospital {
  beds: BedInventory[];
  doctors: Doctor[];
}

export type HospitalListItem = Pick<
  Hospital,
  'id' | 'name' | 'address' | 'verificationStatus'
>;

export type HospitalSessionInfo = Pick<
  Hospital,
  'id' | 'name' | 'address' | 'hotlinePhone' | 'verificationStatus'
> & {
  staffName: string;
};

export interface DoctorInput {
  id?: string;
  name: string;
  specialty: string;
  experienceYears: number;
  chamberSchedule: string;
  contactPhone: string;
  isAvailable: boolean;
}

export interface HospitalPanelSession {
  hospitalId: string;
  staffName: string;
  staffPassword: string;
}

export interface ApiEnvelope<T> {
  success: true;
  data: T;
}

export interface ApiErrorEnvelope {
  success: false;
  error: string;
}

export interface TriageResult {
  notice: string;
  specialties: string[];
  hospitals: Array<
    Hospital & {
      beds: Pick<
        BedInventory,
        'department' | 'category' | 'availableCount' | 'statusCode'
      >[];
      doctors: Pick<
        Doctor,
        'id' | 'name' | 'specialty' | 'chamberSchedule'
      >[];
    }
  >;
}
