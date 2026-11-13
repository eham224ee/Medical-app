import { eq, inArray } from 'drizzle-orm';
import { Router } from 'express';
import { bedInventory, db, doctors, hospitals } from '@repo/database';
import { HttpError } from '../middleware/error.js';

const router = Router();

const routingRules: ReadonlyArray<{
  terms: readonly string[];
  specialties: readonly string[];
}> = [
  { terms: ['chest', 'heart', 'palpitation'], specialties: ['Cardiology'] },
  {
    terms: ['breath', 'lung', 'cough', 'asthma'],
    specialties: ['Pulmonology'],
  },
  {
    terms: ['bone', 'fracture', 'joint', 'injury'],
    specialties: ['Orthopedics'],
  },
  {
    terms: ['pregnan', 'labor', 'gyne', 'obstetric'],
    specialties: ['Obstetrics and Gynecology'],
  },
  { terms: ['skin', 'rash', 'itch'], specialties: ['Dermatology'] },
  { terms: ['eye', 'vision'], specialties: ['Ophthalmology'] },
  { terms: ['child', 'infant', 'baby'], specialties: ['Pediatrics'] },
  {
    terms: ['fever', 'headache', 'stomach', 'nausea', 'pain'],
    specialties: ['Internal Medicine'],
  },
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

router.post('/ai/triage', async (request, response) => {
  if (!isRecord(request.body)) {
    throw new HttpError('Request body must be an object.', 400);
  }

  const symptomsInput = request.body.symptoms;
  const symptoms = (
    Array.isArray(symptomsInput) ? symptomsInput : [symptomsInput]
  )
    .filter((symptom): symptom is string => typeof symptom === 'string')
    .map((symptom) => symptom.trim())
    .filter(Boolean);
  if (symptoms.length === 0) {
    throw new HttpError('At least one symptom is required.', 400);
  }
  if (
    symptomsInput !== undefined &&
    Array.isArray(symptomsInput) &&
    symptoms.length !== symptomsInput.length
  ) {
    throw new HttpError('Each symptom must be a non-empty string.', 400);
  }
  if (
    typeof request.body.age !== 'number' ||
    !Number.isInteger(request.body.age) ||
    request.body.age < 0 ||
    request.body.age > 130
  ) {
    throw new HttpError('age must be an integer between 0 and 130.', 400);
  }
  if (
    typeof request.body.gender !== 'string' ||
    request.body.gender.trim().length === 0
  ) {
    throw new HttpError('gender is required.', 400);
  }

  const normalizedSymptoms = symptoms.join(' ').toLowerCase();
  const specialties = new Set<string>();
  for (const rule of routingRules) {
    if (rule.terms.some((term) => normalizedSymptoms.includes(term))) {
      for (const specialty of rule.specialties) specialties.add(specialty);
    }
  }
  if (specialties.size === 0) {
    specialties.add('Emergency Medicine');
  }

  const verifiedHospitals = await db
    .select()
    .from(hospitals)
    .where(eq(hospitals.verificationStatus, 'VERIFIED'));
  const hospitalIds = verifiedHospitals.map((hospital) => hospital.id);
  const [allBeds, allDoctors] = hospitalIds.length
    ? await Promise.all([
        db
          .select()
          .from(bedInventory)
          .where(inArray(bedInventory.hospitalId, hospitalIds)),
        db
          .select()
          .from(doctors)
          .where(inArray(doctors.hospitalId, hospitalIds))
          .then((rows) => rows.filter((doctor) => doctor.isAvailable === 1)),
      ])
    : [[], []];

  const routedHospitals = verifiedHospitals.flatMap((hospital) => {
    const hospitalBeds = allBeds.filter(
      (bed) => bed.hospitalId === hospital.id,
    );
    const hospitalDoctors = allDoctors.filter(
      (doctor) => doctor.hospitalId === hospital.id,
    );
    const matchedDepartments = hospitalBeds
      .filter((bed) =>
        [...specialties].some(
          (specialty) =>
            bed.department.toLowerCase() === specialty.toLowerCase(),
        ),
      )
      .map((bed) => ({
        department: bed.department,
        category: bed.category,
        availableCount: bed.availableCount,
        statusCode: bed.statusCode,
      }));
    const matchedDoctors = hospitalDoctors
      .filter((doctor) =>
        [...specialties].some(
          (specialty) =>
            doctor.specialty.toLowerCase() === specialty.toLowerCase(),
        ),
      )
      .map((doctor) => ({
        id: doctor.id,
        name: doctor.name,
        specialty: doctor.specialty,
        chamberSchedule: doctor.chamberSchedule,
      }));

    return matchedDepartments.length || matchedDoctors.length
      ? [{ ...hospital, beds: matchedDepartments, doctors: matchedDoctors }]
      : [];
  });

  response.json({
    success: true,
    data: {
      notice:
        'This service only routes to matching departments and specialties; it does not provide a diagnosis.',
      specialties: [...specialties],
      hospitals: routedHospitals,
    },
  });
});

export default router;
