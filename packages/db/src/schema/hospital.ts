import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  pgEnum,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const bedStatusEnum = pgEnum('bed_status_code', [
  'HIGH_AVAILABILITY',
  'LIMITED',
  'FULL',
  'UNVERIFIED',
]);
export const verificationStatusEnum = pgEnum('verification_status', [
  'PENDING',
  'VERIFIED',
  'REJECTED',
]);

export const hospitals = pgTable(
  'hospitals',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    address: text('address').notNull(),
    latitude: text('latitude').notNull(),
    longitude: text('longitude').notNull(),
    hotlinePhone: text('hotline_phone').notNull(),
    verificationStatus: verificationStatusEnum('verification_status')
      .notNull()
      .default('PENDING'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('hospital_location_idx').on(table.latitude, table.longitude),
  ],
);

export const bedInventory = pgTable(
  'bed_inventory',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    hospitalId: uuid('hospital_id')
      .notNull()
      .references(() => hospitals.id, { onDelete: 'cascade' }),
    category: text('category').notNull(), // ICU, General Ward, Cabin
    department: text('department').notNull(), // Cardiology, Orthopedics
    availableCount: integer('available_count').notNull().default(0),
    totalCount: integer('total_count').notNull().default(0),
    statusCode: bedStatusEnum('status_code')
      .notNull()
      .default('HIGH_AVAILABILITY'),
    lastUpdatedByUserId: text('last_updated_by_user_id'),
    lastUpdatedAt: timestamp('last_updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('bed_hospital_idx').on(table.hospitalId),
    uniqueIndex('bed_inventory_hospital_category_department_uidx').on(
      table.hospitalId,
      table.category,
      table.department,
    ),
  ],
);
