import { and, eq, ilike } from 'drizzle-orm';
import { Router } from 'express';
import { db, doctors, hospitals } from '@repo/database';
import { HttpError } from '../middleware/error.js';

const router = Router();
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

router.get('/doctors', async (request, response) => {
  const filters = [];
  if (
    request.query.specialty !== undefined &&
    typeof request.query.specialty !== 'string'
  ) {
    throw new HttpError('specialty must be a single string value.', 400);
  }
  if (
    typeof request.query.specialty === 'string' &&
    request.query.specialty.trim()
  ) {
    filters.push(
      ilike(doctors.specialty, `%${request.query.specialty.trim()}%`),
    );
  }
  if (
    request.query.hospitalId !== undefined &&
    typeof request.query.hospitalId !== 'string'
  ) {
    throw new HttpError('hospitalId must be a single string value.', 400);
  }
  if (typeof request.query.hospitalId === 'string') {
    if (!uuidPattern.test(request.query.hospitalId)) {
      throw new HttpError('Invalid hospital ID.', 400);
    }
    filters.push(eq(doctors.hospitalId, request.query.hospitalId));
  }
  if (request.query.available !== undefined) {
    if (
      request.query.available !== 'true' &&
      request.query.available !== 'false'
    ) {
      throw new HttpError('available must be true or false.', 400);
    }
    filters.push(
      eq(doctors.isAvailable, request.query.available === 'true' ? 1 : 0),
    );
  }

  const result = await db
    .select({
      id: doctors.id,
      hospitalId: doctors.hospitalId,
      name: doctors.name,
      specialty: doctors.specialty,
      experienceYears: doctors.experienceYears,
      chamberSchedule: doctors.chamberSchedule,
      contactPhone: doctors.contactPhone,
      isAvailable: doctors.isAvailable,
      createdAt: doctors.createdAt,
      hospitalName: hospitals.name,
      hospitalAddress: hospitals.address,
    })
    .from(doctors)
    .innerJoin(hospitals, eq(doctors.hospitalId, hospitals.id))
    .where(and(eq(hospitals.verificationStatus, 'VERIFIED'), ...filters));
  response.json({
    success: true,
    data: result.map((doctor) => ({
      ...doctor,
      isAvailable: doctor.isAvailable === 1,
    })),
  });
});

export default router;
