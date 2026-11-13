import { randomUUID } from 'node:crypto';
import { basename } from 'node:path';
import { and, desc, eq, inArray } from 'drizzle-orm';
import multer from 'multer';
import { Router } from 'express';
import {
  auditLogs,
  bedInventory,
  db,
  doctors,
  hospitalDocuments,
  hospitals,
} from '@repo/database';
import {
  createAuditLog,
  getActorId,
  requireActor,
} from '../middleware/audit.js';
import { HttpError } from '../middleware/error.js';
import {
  removeLegalDocuments,
  uploadLegalDocument,
} from '../services/supabase-storage.js';

const router = Router();
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_LEGAL_DOCUMENTS = 5;
const documentUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: MAX_LEGAL_DOCUMENTS,
    fields: 8,
    parts: MAX_LEGAL_DOCUMENTS + 8,
  },
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requiredText(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new HttpError(`${field} is required.`, 400);
  }
  return value.trim();
}

function hospitalIdFrom(value: string | string[] | undefined): string {
  if (typeof value !== 'string' || !uuidPattern.test(value)) {
    throw new HttpError('Invalid hospital ID.', 400);
  }
  return value;
}

function parseCoordinate(
  value: unknown,
  field: string,
  minimum: number,
  maximum: number,
): string {
  if (
    (typeof value !== 'number' && typeof value !== 'string') ||
    value === ''
  ) {
    throw new HttpError(
      `${field} must be between ${minimum} and ${maximum}.`,
      400,
    );
  }
  const numberValue = typeof value === 'number' ? value : Number(value);
  if (
    !Number.isFinite(numberValue) ||
    numberValue < minimum ||
    numberValue > maximum
  ) {
    throw new HttpError(
      `${field} must be between ${minimum} and ${maximum}.`,
      400,
    );
  }
  return String(numberValue);
}

function countValue(value: unknown, field: string, minimum = 0): number {
  if (!Number.isInteger(value) || Number(value) < minimum) {
    throw new HttpError(
      `${field} must be an integer greater than or equal to ${minimum}.`,
      400,
    );
  }
  return Number(value);
}

function bedStatus(
  availableCount: number,
  totalCount: number,
): 'HIGH_AVAILABILITY' | 'LIMITED' | 'FULL' {
  if (availableCount === 0) return 'FULL';
  if (availableCount / totalCount <= 0.2) return 'LIMITED';
  return 'HIGH_AVAILABILITY';
}

router.post(
  '/hospitals/register',
  documentUpload.array('legalDocuments', MAX_LEGAL_DOCUMENTS),
  async (request, response) => {
    if (!isRecord(request.body)) {
      throw new HttpError('Request body must be an object.', 400);
    }

    const hospitalId = randomUUID();
    const values = {
      id: hospitalId,
      name: requiredText(request.body.name, 'name'),
      address: requiredText(request.body.address, 'address'),
      latitude: parseCoordinate(request.body.latitude, 'latitude', -90, 90),
      longitude: parseCoordinate(
        request.body.longitude,
        'longitude',
        -180,
        180,
      ),
      hotlinePhone: requiredText(request.body.hotlinePhone, 'hotlinePhone'),
    };
    const files = Array.isArray(request.files)
      ? (request.files as Express.Multer.File[])
      : [];
    const fileRecords = files.map((file) => {
      const fileName = basename(file.originalname.replace(/\\/g, '/'))
        .replace(/[\u0000-\u001f]/g, '')
        .trim()
        .slice(0, 200);
      if (!fileName) {
        throw new HttpError('Each document needs a file name.', 400);
      }
      return {
        id: randomUUID(),
        hospitalId,
        fileName,
        fileSize: file.size,
        storagePath: `${hospitalId}/${randomUUID()}.pdf`,
        file,
      };
    });
    const uploadedPaths: string[] = [];
    let createdHospital: typeof hospitals.$inferSelect | undefined;

    try {
      for (const document of fileRecords) {
        await uploadLegalDocument(document.storagePath, document.file);
        uploadedPaths.push(document.storagePath);
      }

      createdHospital = await db.transaction(async (transaction) => {
        const [hospital] = await transaction
          .insert(hospitals)
          .values(values)
          .returning();
        if (!hospital) {
          throw new HttpError('Unable to register hospital.', 500);
        }

        if (fileRecords.length) {
          await transaction.insert(hospitalDocuments).values(
            fileRecords.map(
              ({ id, hospitalId: documentHospitalId, fileName, fileSize, storagePath }) => ({
                id,
                hospitalId: documentHospitalId,
                fileName,
                fileSize,
                storagePath,
              }),
            ),
          );
        }
        return hospital;
      });
    } catch (error) {
      try {
        await removeLegalDocuments(uploadedPaths);
      } catch (cleanupError) {
        console.error(
          'Uploaded legal documents could not be rolled back.',
          cleanupError,
        );
      }
      throw error;
    }

    if (!createdHospital) {
      throw new HttpError('Unable to register hospital.', 500);
    }
    response.status(201).json({
      success: true,
      data: {
        ...createdHospital,
        documents: fileRecords.map(({ id, hospitalId: documentHospitalId, fileName, fileSize }) => ({
          id,
          hospitalId: documentHospitalId,
          fileName,
          fileSize,
        })),
      },
    });
  },
);

router.get('/hospitals', async (_request, response) => {
  const result = await db
    .select()
    .from(hospitals)
    .where(eq(hospitals.verificationStatus, 'VERIFIED'));

  const beds = result.length
    ? await db
        .select()
        .from(bedInventory)
        .where(
          inArray(
            bedInventory.hospitalId,
            result.map((hospital) => hospital.id),
          ),
        )
    : [];
  const bedsByHospital = new Map<string, typeof beds>();
  for (const bed of beds) {
    const hospitalBeds = bedsByHospital.get(bed.hospitalId) ?? [];
    hospitalBeds.push(bed);
    bedsByHospital.set(bed.hospitalId, hospitalBeds);
  }
  response.json({
    success: true,
    data: result.map((hospital) => ({
      ...hospital,
      beds: bedsByHospital.get(hospital.id) ?? [],
    })),
  });
});

router.get('/hospitals/:id', async (request, response) => {
  const id = hospitalIdFrom(request.params.id);
  const hospital = await db.query.hospitals.findFirst({
    where: and(
      eq(hospitals.id, id),
      eq(hospitals.verificationStatus, 'VERIFIED'),
    ),
    with: {
      beds: true,
      doctors: {
        where: eq(doctors.isAvailable, 1),
      },
    },
  });

  if (!hospital) {
    throw new HttpError('Hospital not found.', 404);
  }

  response.json({
    success: true,
    data: {
      ...hospital,
      doctors: hospital.doctors.map((doctor) => ({
        ...doctor,
        isAvailable: doctor.isAvailable === 1,
      })),
    },
  });
});

router.post(
  '/hospitals/:id/session',
  requireActor(),
  async (request, response) => {
    const id = hospitalIdFrom(request.params.id);
    const hospital = await db.query.hospitals.findFirst({
      where: eq(hospitals.id, id),
      columns: {
        id: true,
        name: true,
        address: true,
        hotlinePhone: true,
        verificationStatus: true,
      },
    });
    if (!hospital) {
      throw new HttpError('Hospital not found.', 404);
    }

    response.json({
      success: true,
      data: { ...hospital, staffName: getActorId(request) },
    });
  },
);

router.get('/hospitals/:id/beds', async (request, response) => {
  const hospitalId = hospitalIdFrom(request.params.id);
  const [hospital] = await db
    .select({ id: hospitals.id })
    .from(hospitals)
    .where(
      and(
        eq(hospitals.id, hospitalId),
        eq(hospitals.verificationStatus, 'VERIFIED'),
      ),
    );
  if (!hospital) {
    throw new HttpError('Hospital not found.', 404);
  }

  const beds = await db
    .select()
    .from(bedInventory)
    .where(eq(bedInventory.hospitalId, hospitalId));
  response.json({ success: true, data: beds });
});

router.get(
  '/hospitals/:id/audit-logs',
  requireActor(),
  async (request, response) => {
    const hospitalId = hospitalIdFrom(request.params.id);
    const requestedLimit =
      typeof request.query.limit === 'string'
        ? Number(request.query.limit)
        : 25;
    if (
      !Number.isInteger(requestedLimit) ||
      requestedLimit < 1 ||
      requestedLimit > 100
    ) {
      throw new HttpError('limit must be an integer between 1 and 100.', 400);
    }

    const result = await db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.hospitalId, hospitalId))
      .orderBy(desc(auditLogs.createdAt))
      .limit(requestedLimit);
    response.json({ success: true, data: result });
  },
);

router.patch(
  '/hospitals/:id/beds',
  requireActor(),
  async (request, response) => {
    const hospitalId = hospitalIdFrom(request.params.id);
    if (!isRecord(request.body)) {
      throw new HttpError('Request body must be an object.', 400);
    }

    const category = requiredText(request.body.category, 'category');
    const department = requiredText(request.body.department, 'department');
    const operation = request.body.operation;
    if (
      operation !== 'set' &&
      operation !== 'increment' &&
      operation !== 'decrement'
    ) {
      throw new HttpError(
        'operation must be set, increment, or decrement.',
        400,
      );
    }
    const count = countValue(
      request.body.count,
      'count',
      operation === 'set' ? 0 : 1,
    );
    const requestedTotal =
      request.body.totalCount === undefined
        ? undefined
        : countValue(request.body.totalCount, 'totalCount', 1);
    const actorId = getActorId(request);

    const [hospital] = await db
      .select({ id: hospitals.id })
      .from(hospitals)
      .where(eq(hospitals.id, hospitalId));
    if (!hospital) {
      throw new HttpError('Hospital not found.', 404);
    }

    const bed = await db.transaction(async (transaction) => {
      const keyConditions = and(
        eq(bedInventory.hospitalId, hospitalId),
        eq(bedInventory.category, category),
        eq(bedInventory.department, department),
      );
      const [existing] = await transaction
        .select()
        .from(bedInventory)
        .where(keyConditions)
        .for('update');
      let updated = existing;

      if (!existing) {
        if (operation === 'decrement') {
          throw new HttpError(
            'Bed inventory does not exist for this category and department.',
            409,
          );
        }
        if (requestedTotal === undefined) {
          throw new HttpError(
            'totalCount is required when creating bed inventory.',
            400,
          );
        }
        const availableCount = count;
        if (availableCount > requestedTotal) {
          throw new HttpError('Available beds cannot exceed total beds.', 400);
        }

        const [created] = await transaction
          .insert(bedInventory)
          .values({
            hospitalId,
            category,
            department,
            availableCount,
            totalCount: requestedTotal,
            statusCode: bedStatus(availableCount, requestedTotal),
            lastUpdatedByUserId: actorId,
          })
          .onConflictDoNothing({
            target: [
              bedInventory.hospitalId,
              bedInventory.category,
              bedInventory.department,
            ],
          })
          .returning();

        updated = created;
        if (!updated) {
          const [raced] = await transaction
            .select()
            .from(bedInventory)
            .where(keyConditions)
            .for('update');
          if (!raced) {
            throw new HttpError('Unable to update bed inventory.', 409);
          }
          const totalCount = requestedTotal ?? raced.totalCount;
          const availableCount =
            operation === 'set'
              ? count
              : operation === 'increment'
                ? raced.availableCount + count
                : raced.availableCount - count;
          if (availableCount < 0 || availableCount > totalCount) {
            throw new HttpError(
              'Bed count must remain between zero and totalCount.',
              409,
            );
          }
          const [raceUpdated] = await transaction
            .update(bedInventory)
            .set({
              availableCount,
              totalCount,
              statusCode: bedStatus(availableCount, totalCount),
              lastUpdatedByUserId: actorId,
              lastUpdatedAt: new Date(),
            })
            .where(eq(bedInventory.id, raced.id))
            .returning();
          updated = raceUpdated;
        }
      } else {
        const totalCount = requestedTotal ?? existing.totalCount;
        const availableCount =
          operation === 'set'
            ? count
            : operation === 'increment'
              ? existing.availableCount + count
              : existing.availableCount - count;
        if (availableCount < 0 || availableCount > totalCount) {
          throw new HttpError(
            'Bed count must remain between zero and totalCount.',
            409,
          );
        }
        const [changed] = await transaction
          .update(bedInventory)
          .set({
            availableCount,
            totalCount,
            statusCode: bedStatus(availableCount, totalCount),
            lastUpdatedByUserId: actorId,
            lastUpdatedAt: new Date(),
          })
          .where(eq(bedInventory.id, existing.id))
          .returning();
        updated = changed;
      }

      if (!updated) {
        throw new HttpError('Unable to update bed inventory.', 409);
      }

      await transaction.insert(auditLogs).values(
        createAuditLog(actorId, hospitalId, 'BED_INVENTORY_UPDATED', {
          bedInventoryId: updated.id,
          category,
          department,
          operation,
          count,
          availableCount: updated.availableCount,
          totalCount: updated.totalCount,
        }),
      );

      return updated;
    });

    response.json({ success: true, data: bed });
  },
);

router.post(
  '/hospitals/:id/doctors',
  requireActor(),
  async (request, response) => {
    const hospitalId = hospitalIdFrom(request.params.id);
    if (!isRecord(request.body)) {
      throw new HttpError('Request body must be an object.', 400);
    }

    const doctorId =
      request.body.id === undefined
        ? undefined
        : requiredText(request.body.id, 'id');
    if (doctorId !== undefined && !uuidPattern.test(doctorId)) {
      throw new HttpError('Invalid doctor ID.', 400);
    }
    const name = requiredText(request.body.name, 'name');
    const specialty = requiredText(request.body.specialty, 'specialty');
    const chamberSchedule = requiredText(
      request.body.chamberSchedule,
      'chamberSchedule',
    );
    const contactPhone = requiredText(
      request.body.contactPhone,
      'contactPhone',
    );
    const experienceYears = countValue(
      request.body.experienceYears ?? 0,
      'experienceYears',
    );
    if (typeof request.body.isAvailable !== 'boolean') {
      throw new HttpError('isAvailable must be a boolean.', 400);
    }
    const isAvailable = request.body.isAvailable ? 1 : 0;
    const actorId = getActorId(request);

    const result = await db.transaction(async (transaction) => {
      const [hospital] = await transaction
        .select({ id: hospitals.id })
        .from(hospitals)
        .where(eq(hospitals.id, hospitalId));
      if (!hospital) {
        throw new HttpError('Hospital not found.', 404);
      }

      if (doctorId) {
        const [updatedDoctor] = await transaction
          .update(doctors)
          .set({
            name,
            specialty,
            chamberSchedule,
            contactPhone,
            experienceYears,
            isAvailable,
          })
          .where(
            and(eq(doctors.id, doctorId), eq(doctors.hospitalId, hospitalId)),
          )
          .returning();
        if (!updatedDoctor) {
          throw new HttpError('Doctor not found for this hospital.', 404);
        }

        await transaction.insert(auditLogs).values(
          createAuditLog(actorId, hospitalId, 'DOCTOR_UPDATED', {
            doctorId: updatedDoctor.id,
            specialty,
            isAvailable: Boolean(isAvailable),
          }),
        );
        return { doctor: updatedDoctor, created: false };
      }

      const [createdDoctor] = await transaction
        .insert(doctors)
        .values({
          hospitalId,
          name,
          specialty,
          chamberSchedule,
          contactPhone,
          experienceYears,
          isAvailable,
        })
        .returning();
      if (!createdDoctor) {
        throw new HttpError('Unable to create doctor profile.', 500);
      }

      await transaction.insert(auditLogs).values(
        createAuditLog(actorId, hospitalId, 'DOCTOR_CREATED', {
          doctorId: createdDoctor.id,
          specialty,
          isAvailable: Boolean(isAvailable),
        }),
      );
      return { doctor: createdDoctor, created: true };
    });

    response.status(result.created ? 201 : 200).json({
      success: true,
      data: {
        ...result.doctor,
        isAvailable: result.doctor.isAvailable === 1,
      },
    });
  },
);

export default router;
