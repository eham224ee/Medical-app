import { pgTable, uuid, text, timestamp, pgEnum } from 'drizzle-orm/pg-core';

export const adminRoleEnum = pgEnum('admin_role', ['SUPER_ADMIN', 'MODERATOR', 'AUDITOR']);

export const masterAdmins = pgTable('master_admins', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: adminRoleEnum('role').notNull().default('MODERATOR'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});