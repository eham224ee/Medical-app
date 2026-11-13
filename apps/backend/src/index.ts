import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';

config({
  path: [
    fileURLToPath(new URL('../.env', import.meta.url)),
    fileURLToPath(new URL('../../../packages/db/.env', import.meta.url)),
  ],
});

const [{ createApp }, { checkDatabaseConnection, closeDatabaseConnection }] =
  await Promise.all([import('./app.js'), import('@repo/database')]);
const { safeErrorLog } = await import('./middleware/error.js');

const port = Number(process.env.PORT ?? 5000);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('PORT must be an integer between 1 and 65535.');
}

export const app = createApp();
let databaseReady = true;
try {
  await checkDatabaseConnection();
} catch (error) {
  console.error(
    'Database readiness check failed. API startup aborted; verify DATABASE_URL and Supabase network access.',
    safeErrorLog(error),
  );
  await closeDatabaseConnection();
  databaseReady = false;
}

if (databaseReady) {
  app.listen(port, () => {
    console.log(`API server listening on port ${port}.`);
  });
} else {
  process.exitCode = 1;
}
