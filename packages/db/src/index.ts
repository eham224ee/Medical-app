import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { relations } from 'drizzle-orm';
import * as hospitalsSchema from './schema/hospital.js';
import * as doctorsSchema from './schema/doctor.js';
import * as adminSchema from './schema/admin.js';
import * as auditSchema from './schema/audit.js';
import * as staffSchema from './schema/staff.js';
import * as hospitalDocumentSchema from './schema/hospital-document.js';

const connectionString = (
  globalThis as typeof globalThis & {
    process?: { env?: Record<string, string | undefined> };
  }
).process?.env?.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is missing.');
}
if (/[<>]/.test(connectionString)) {
  throw new Error(
    'DATABASE_URL contains template placeholders; configure a real PostgreSQL connection URL.',
  );
}

let databaseUrl: URL;
try {
  databaseUrl = new URL(connectionString);
} catch {
  throw new Error('DATABASE_URL must be a valid PostgreSQL connection URL.');
}
if (
  (databaseUrl.protocol !== 'postgres:' &&
    databaseUrl.protocol !== 'postgresql:') ||
  !databaseUrl.hostname ||
  /[<>]/.test(databaseUrl.hostname)
) {
  throw new Error(
    'DATABASE_URL must contain a real PostgreSQL host, not an example placeholder.',
  );
}

const client = postgres(connectionString, { prepare: false });

export class DatabaseSchemaError extends Error {
  readonly code = '42P01';

  constructor(missingObjects: string[]) {
    super(`Database schema is missing: ${missingObjects.join(', ')}.`);
    this.name = 'DatabaseSchemaError';
  }
}

export async function checkDatabaseConnection(): Promise<void> {
  const [schemaState] = await client<
    {
      hospitals: boolean;
      bed_inventory: boolean;
      doctors: boolean;
      master_admins: boolean;
      audit_logs: boolean;
      hospital_documents: boolean;
      staff_access: boolean;
      bed_status_code: boolean;
      verification_status: boolean;
      admin_role: boolean;
    }[]
  >`
    SELECT
      to_regclass('public.hospitals') IS NOT NULL AS hospitals,
      to_regclass('public.bed_inventory') IS NOT NULL AS bed_inventory,
      to_regclass('public.doctors') IS NOT NULL AS doctors,
      to_regclass('public.master_admins') IS NOT NULL AS master_admins,
      to_regclass('public.audit_logs') IS NOT NULL AS audit_logs,
      to_regclass('public.hospital_documents') IS NOT NULL AS hospital_documents,
      to_regclass('public.staff_access') IS NOT NULL AS staff_access,
      to_regtype('public.bed_status_code') IS NOT NULL AS bed_status_code,
      to_regtype('public.verification_status') IS NOT NULL AS verification_status,
      to_regtype('public.admin_role') IS NOT NULL AS admin_role
  `;
  if (!schemaState) {
    throw new Error('Database readiness query returned no result.');
  }
  const missingObjects = Object.entries(schemaState)
    .filter(([, exists]) => !exists)
    .map(([name]) => name);
  if (missingObjects.length) throw new DatabaseSchemaError(missingObjects);
}

export async function closeDatabaseConnection(): Promise<void> {
  await client.end({ timeout: 5 });
}

export const hospitalsRelations = relations(
  hospitalsSchema.hospitals,
  ({ many }) => ({
    beds: many(hospitalsSchema.bedInventory),
    doctors: many(doctorsSchema.doctors),
    auditLogs: many(auditSchema.auditLogs),
    documents: many(hospitalDocumentSchema.hospitalDocuments),
  }),
);

export const bedInventoryRelations = relations(
  hospitalsSchema.bedInventory,
  ({ one }) => ({
    hospital: one(hospitalsSchema.hospitals, {
      fields: [hospitalsSchema.bedInventory.hospitalId],
      references: [hospitalsSchema.hospitals.id],
    }),
  }),
);

export const doctorsRelations = relations(doctorsSchema.doctors, ({ one }) => ({
  hospital: one(hospitalsSchema.hospitals, {
    fields: [doctorsSchema.doctors.hospitalId],
    references: [hospitalsSchema.hospitals.id],
  }),
}));

export const auditLogsRelations = relations(
  auditSchema.auditLogs,
  ({ one }) => ({
    hospital: one(hospitalsSchema.hospitals, {
      fields: [auditSchema.auditLogs.hospitalId],
      references: [hospitalsSchema.hospitals.id],
    }),
  }),
);

export const hospitalDocumentsRelations = relations(
  hospitalDocumentSchema.hospitalDocuments,
  ({ one }) => ({
    hospital: one(hospitalsSchema.hospitals, {
      fields: [hospitalDocumentSchema.hospitalDocuments.hospitalId],
      references: [hospitalsSchema.hospitals.id],
    }),
  }),
);

export const staffAccessRelations = relations(
  staffSchema.staffAccess,
  ({ one }) => ({
    hospital: one(hospitalsSchema.hospitals, {
      fields: [staffSchema.staffAccess.hospitalId],
      references: [hospitalsSchema.hospitals.id],
    }),
  }),
);

export const schema = {
  ...hospitalsSchema,
  ...doctorsSchema,
  ...adminSchema,
  ...auditSchema,
  ...staffSchema,
  ...hospitalDocumentSchema,
  hospitalsRelations,
  bedInventoryRelations,
  doctorsRelations,
  auditLogsRelations,
  hospitalDocumentsRelations,
  staffAccessRelations,
};

export const db = drizzle(client, { schema });

export * from './schema/hospital.js';
export * from './schema/doctor.js';
export * from './schema/admin.js';
export * from './schema/audit.js';
export * from './schema/staff.js';
export * from './schema/hospital-document.js';
