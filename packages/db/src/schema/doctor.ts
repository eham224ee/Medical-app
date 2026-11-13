import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  index,
} from 'drizzle-orm/pg-core';
import { hospitals } from './hospital.js';

export const doctors = pgTable(
  'doctors',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    hospitalId: uuid('hospital_id')
      .notNull()
      .references(() => hospitals.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    specialty: text('specialty').notNull(),
    experienceYears: integer('experience_years').notNull().default(0),
    chamberSchedule: text('chamber_schedule').notNull(),
    contactPhone: text('contact_phone').notNull(),
    isAvailable: integer('is_available').notNull().default(1),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('doctor_hospital_idx').on(table.hospitalId),
    index('doctor_specialty_idx').on(table.specialty),
  ],
);
1;
