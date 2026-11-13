import { pgTable, uuid, text, timestamp, index } from 'drizzle-orm/pg-core';
import { hospitals } from './hospital.js';

export const auditLogs = pgTable(
  'audit_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    hospitalId: uuid('hospital_id')
      .notNull()
      .references(() => hospitals.id, { onDelete: 'cascade' }),
    actorId: text('actor_id').notNull(),
    actionType: text('action_type').notNull(),
    payload: text('payload').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('audit_hospital_idx').on(table.hospitalId)],
);
