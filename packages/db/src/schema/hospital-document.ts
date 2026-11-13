import {
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
  check,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { hospitals } from './hospital.js';

export const hospitalDocuments = pgTable(
  'hospital_documents',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    hospitalId: uuid('hospital_id')
      .notNull()
      .references(() => hospitals.id, { onDelete: 'cascade' }),
    fileName: text('file_name').notNull(),
    fileSize: integer('file_size').notNull(),
    storagePath: text('storage_path').notNull().unique(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('hospital_documents_hospital_idx').on(table.hospitalId),
    check(
      'hospital_documents_file_size_check',
      sql`${table.fileSize} > 0 AND ${table.fileSize} <= 10485760`,
    ),
  ],
);
