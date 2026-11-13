import cors from 'cors';
import express, { type RequestHandler } from 'express';
import { checkDatabaseConnection } from '@repo/database';
import adminRoutes from './routes/admin.js';
import aiRoutes from './routes/ai.js';
import doctorsRoutes from './routes/doctors.js';
import hospitalsRoutes from './routes/hospitals.js';
import { errorHandler, HttpError } from './middleware/error.js';

export function createApp(authContextMiddleware?: RequestHandler) {
  const app = express();
  const defaultOrigins = [
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:5175',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:5174',
    'http://127.0.0.1:5175',
    'http://localhost:4173',
    'http://localhost:4174',
    'http://localhost:4175',
  ];
  const allowedOrigins = new Set(
    (process.env.CORS_ORIGINS ?? defaultOrigins.join(','))
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
  );

  app.use(
    cors({
      origin: (origin, callback) => {
        callback(null, Boolean(origin && allowedOrigins.has(origin)));
      },
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '1mb' }));
  if (authContextMiddleware) {
    app.use(authContextMiddleware);
  }

  app.get('/api/health', async (_request, response) => {
    await checkDatabaseConnection();
    response.json({ success: true, data: { status: 'ok' } });
  });

  app.use('/api/admin', adminRoutes);
  app.use('/api', hospitalsRoutes);
  app.use('/api', doctorsRoutes);
  app.use('/api', aiRoutes);

  app.use((_request, _response, next) => {
    next(new HttpError('Route not found.', 404));
  });
  app.use(errorHandler);

  return app;
}
