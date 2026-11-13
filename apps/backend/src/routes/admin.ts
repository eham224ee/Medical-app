import { randomUUID } from 'node:crypto';
import { asc, desc, eq, inArray } from 'drizzle-orm';
import { Router } from 'express';
import {
  auditLogs,
  bedInventory,
  db,
  hospitalDocuments,
  hospitals,
} from '@repo/database';
import {
  createLegalDocumentUrl,
} from '../services/supabase-storage.js';
import {
  createMasterAdminSession,
  loginIsRateLimited,
  masterAdminConfigurationReady,
  masterAdminCookie,
  requireMasterAdmin,
  validateMasterAdminCredentials,
} from '../middleware/master-admin.js';
import { HttpError } from '../middleware/error.js';

const router = Router();
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

router.use((_request, response, next) => {
  response.setHeader('Cache-Control', 'no-store');
  next();
});

function hospitalIdFrom(value: string | string[] | undefined): string {
  if (typeof value !== 'string' || !uuidPattern.test(value)) {
    throw new HttpError('Invalid hospital ID.', 400);
  }
  return value;
}

function requestedLimit(value: unknown, fallback: number): number {
  if (value === undefined) return fallback;
  if (typeof value !== 'string') {
    throw new HttpError('limit must be an integer between 1 and 100.', 400);
  }
  const limit = Number(value);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new HttpError('limit must be an integer between 1 and 100.', 400);
  }
  return limit;
}

router.post('/session', (request, response) => {
  const ipAddress = request.ip ?? 'unknown';
  if (loginIsRateLimited(ipAddress)) {
    throw new HttpError('Too many login attempts. Try again in 15 minutes.', 429);
  }
  if (!masterAdminConfigurationReady()) {
    throw new HttpError(
      'Master admin credentials and session secret are not configured.',
      503,
    );
  }
  if (
    !validateMasterAdminCredentials(
      request.body?.username,
      request.body?.password,
      ipAddress,
    )
  ) {
    throw new HttpError('Invalid username or password.', 401);
  }

  response.cookie(
    masterAdminCookie.name,
    createMasterAdminSession(),
    masterAdminCookie.options,
  );
  response.json({
    success: true,
    data: { username: process.env.MASTER_ADMIN_USERNAME },
  });
});

router.get('/session', requireMasterAdmin, (_request, response) => {
  response.json({
    success: true,
    data: { username: process.env.MASTER_ADMIN_USERNAME },
  });
});

router.delete('/session', (_request, response) => {
  response.clearCookie(masterAdminCookie.name, masterAdminCookie.options);
  response.status(204).end();
});

router.get('/hospitals', requireMasterAdmin, async (_request, response) => {
  const pending = await db
    .select()
    .from(hospitals)
    .where(eq(hospitals.verificationStatus, 'PENDING'))
    .orderBy(asc(hospitals.createdAt));
  const documents = pending.length
    ? await db
        .select()
        .from(hospitalDocuments)
        .where(
          inArray(
            hospitalDocuments.hospitalId,
            pending.map((hospital) => hospital.id),
          ),
        )
        .orderBy(asc(hospitalDocuments.createdAt))
    : [];
  const documentsByHospital = new Map<string, typeof documents>();
  for (const document of documents) {
    const records = documentsByHospital.get(document.hospitalId) ?? [];
    records.push(document);
    documentsByHospital.set(document.hospitalId, records);
  }

  response.json({
    success: true,
    data: pending.map((hospital) => ({
      ...hospital,
      documents: documentsByHospital.get(hospital.id) ?? [],
    })),
  });
});

router.patch(
  '/hospitals/:id/verification',
  requireMasterAdmin,
  async (request, response) => {
    const hospitalId = hospitalIdFrom(request.params.id);
    const status = request.body?.status;
    if (status !== 'VERIFIED' && status !== 'REJECTED') {
      throw new HttpError('status must be VERIFIED or REJECTED.', 400);
    }
    const reason = request.body?.reason;
    if (
      reason !== undefined &&
      (typeof reason !== 'string' || reason.trim().length > 500)
    ) {
      throw new HttpError('reason must be a string no longer than 500 characters.', 400);
    }

    const changed = await db.transaction(async (transaction) => {
      const [existing] = await transaction
        .select()
        .from(hospitals)
        .where(eq(hospitals.id, hospitalId))
        .for('update');
      if (!existing) throw new HttpError('Hospital not found.', 404);
      if (existing.verificationStatus !== 'PENDING') {
        throw new HttpError('Only pending hospitals can be reviewed.', 409);
      }

      const [updated] = await transaction
        .update(hospitals)
        .set({ verificationStatus: status, updatedAt: new Date() })
        .where(eq(hospitals.id, hospitalId))
        .returning();
      if (!updated) throw new HttpError('Unable to update verification status.', 409);

      await transaction.insert(auditLogs).values({
        hospitalId,
        actorId: process.env.MASTER_ADMIN_USERNAME ?? 'master-admin',
        actionType: 'HOSPITAL_VERIFICATION_UPDATED',
        payload: JSON.stringify({
          previousStatus: existing.verificationStatus,
          status,
          reason: typeof reason === 'string' ? reason.trim() : undefined,
        }),
      });
      return updated;
    });

    response.json({ success: true, data: changed });
  },
);

router.get('/audit-logs', requireMasterAdmin, async (request, response) => {
  const limit = requestedLimit(request.query.limit, 50);
  const result = await db
    .select({
      id: auditLogs.id,
      hospitalId: auditLogs.hospitalId,
      hospitalName: hospitals.name,
      actorId: auditLogs.actorId,
      actionType: auditLogs.actionType,
      payload: auditLogs.payload,
      createdAt: auditLogs.createdAt,
    })
    .from(auditLogs)
    .innerJoin(hospitals, eq(auditLogs.hospitalId, hospitals.id))
    .orderBy(desc(auditLogs.createdAt))
    .limit(limit);
  response.json({ success: true, data: result });
});

router.get('/analytics', requireMasterAdmin, async (_request, response) => {
  const startedAt = performance.now();
  const active = await db
    .select({ id: hospitals.id })
    .from(hospitals)
    .where(eq(hospitals.verificationStatus, 'VERIFIED'));
  const beds = active.length
    ? await db
        .select({
          category: bedInventory.category,
          availableCount: bedInventory.availableCount,
        })
        .from(bedInventory)
        .where(
          inArray(
            bedInventory.hospitalId,
            active.map((hospital) => hospital.id),
          ),
        )
    : [];

  response.json({
    success: true,
    data: {
      activeHospitals: active.length,
      availableIcuBeds: beds
        .filter((bed) => bed.category.toLowerCase().includes('icu'))
        .reduce((total, bed) => total + bed.availableCount, 0),
      availableGeneralBeds: beds
        .filter((bed) => bed.category.toLowerCase().includes('general'))
        .reduce((total, bed) => total + bed.availableCount, 0),
      responseLatencyMs: Math.round(performance.now() - startedAt),
    },
  });
});

router.get(
  '/hospitals/:id/documents/:documentId/url',
  requireMasterAdmin,
  async (request, response) => {
    const hospitalId = hospitalIdFrom(request.params.id);
    const documentId = request.params.documentId;
    if (typeof documentId !== 'string' || !uuidPattern.test(documentId)) {
      throw new HttpError('Invalid document ID.', 400);
    }
    const [document] = await db
      .select()
      .from(hospitalDocuments)
      .where(
        eq(hospitalDocuments.id, documentId),
      );
    if (!document || document.hospitalId !== hospitalId) {
      throw new HttpError('Document not found.', 404);
    }

    response.json({
      success: true,
      data: { url: await createLegalDocumentUrl(document.storagePath) },
    });
  },
);

export default router;
