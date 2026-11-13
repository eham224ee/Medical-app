import { defineConfig } from 'drizzle-kit';
import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';

config({
  path: [
    fileURLToPath(new URL('../../apps/backend/.env', import.meta.url)),
    fileURLToPath(new URL('./.env', import.meta.url)),
  ],
});

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error(
    'DATABASE_URL must be configured before running Drizzle Kit.',
  );
}
if (/[<>]/.test(databaseUrl)) {
  throw new Error(
    'DATABASE_URL contains template placeholders; configure a real PostgreSQL connection URL.',
  );
}
let parsedDatabaseUrl: URL;
try {
  parsedDatabaseUrl = new URL(databaseUrl);
} catch {
  throw new Error('DATABASE_URL must be a valid PostgreSQL connection URL.');
}
if (
  (parsedDatabaseUrl.protocol !== 'postgres:' &&
    parsedDatabaseUrl.protocol !== 'postgresql:') ||
  !parsedDatabaseUrl.hostname ||
  /[<>]/.test(parsedDatabaseUrl.hostname)
) {
  throw new Error(
    'DATABASE_URL must contain a real PostgreSQL host, not an example placeholder.',
  );
}

export default defineConfig({
  schema: `${fileURLToPath(new URL('./src/schema', import.meta.url))}/*`,
  out: fileURLToPath(new URL('./drizzle', import.meta.url)),
  dialect: 'postgresql',
  dbCredentials: {
    url: databaseUrl,
  },
});
