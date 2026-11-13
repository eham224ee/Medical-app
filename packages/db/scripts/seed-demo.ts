import { scryptSync, randomBytes } from 'node:crypto';
import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';

config({
  path: [
    fileURLToPath(new URL('../.env', import.meta.url)),
    fileURLToPath(new URL('../../../apps/backend/.env', import.meta.url)),
  ],
});

const { bedInventory, db, doctors, hospitals, staffAccess } =
  await import('../src/index.js');

const demoHospitals = [
  {
    id: 'd0000000-0000-4000-8000-000000000001',
    name: 'Central City Medical Center (DEMO)',
    address: '12 Sample Crescent, Central City',
    latitude: '23.7806',
    longitude: '90.4070',
    hotlinePhone: '+880 2 5550 0101',
    verificationStatus: 'VERIFIED' as const,
  },
  {
    id: 'd0000000-0000-4000-8000-000000000002',
    name: 'Riverside Emergency Hospital (DEMO)',
    address: '48 Example River Road, Riverside',
    latitude: '23.7940',
    longitude: '90.4125',
    hotlinePhone: '+880 2 5550 0202',
    verificationStatus: 'VERIFIED' as const,
  },
];

const demoStaff = [
  {
    id: 'da000000-0000-4000-8000-000000000001',
    hospitalId: demoHospitals[0]!.id,
    staffName: 'Demo Receptionist',
    password: 'DemoAccess!2026',
  },
  {
    id: 'da000000-0000-4000-8000-000000000002',
    hospitalId: demoHospitals[1]!.id,
    staffName: 'Demo Emergency Lead',
    password: 'DemoAccess!2026',
  },
];

const demoBeds = [
  {
    id: 'db000000-0000-4000-8000-000000000001',
    hospitalId: demoHospitals[0]!.id,
    category: 'ICU',
    department: 'Cardiology',
    availableCount: 2,
    totalCount: 12,
    statusCode: 'LIMITED' as const,
  },
  {
    id: 'db000000-0000-4000-8000-000000000002',
    hospitalId: demoHospitals[0]!.id,
    category: 'General Ward',
    department: 'Cardiology',
    availableCount: 16,
    totalCount: 24,
    statusCode: 'HIGH_AVAILABILITY' as const,
  },
  {
    id: 'db000000-0000-4000-8000-000000000003',
    hospitalId: demoHospitals[0]!.id,
    category: 'General Ward',
    department: 'Pediatrics',
    availableCount: 0,
    totalCount: 10,
    statusCode: 'FULL' as const,
  },
  {
    id: 'db000000-0000-4000-8000-000000000004',
    hospitalId: demoHospitals[1]!.id,
    category: 'ICU',
    department: 'Emergency Medicine',
    availableCount: 3,
    totalCount: 8,
    statusCode: 'HIGH_AVAILABILITY' as const,
  },
  {
    id: 'db000000-0000-4000-8000-000000000005',
    hospitalId: demoHospitals[1]!.id,
    category: 'General Ward',
    department: 'Orthopedics',
    availableCount: 1,
    totalCount: 14,
    statusCode: 'LIMITED' as const,
  },
];

const demoDoctors = [
  {
    id: 'dc000000-0000-4000-8000-000000000001',
    hospitalId: demoHospitals[0]!.id,
    name: 'Dr. Amina Rahman (DEMO)',
    specialty: 'Cardiology',
    experienceYears: 12,
    chamberSchedule: 'Mon–Fri · 09:00–13:00',
    contactPhone: '+880 1700 000101',
    isAvailable: 1,
  },
  {
    id: 'dc000000-0000-4000-8000-000000000002',
    hospitalId: demoHospitals[0]!.id,
    name: 'Dr. Farhan Karim (DEMO)',
    specialty: 'Pediatrics',
    experienceYears: 8,
    chamberSchedule: 'Daily · 14:00–20:00',
    contactPhone: '+880 1700 000102',
    isAvailable: 0,
  },
  {
    id: 'dc000000-0000-4000-8000-000000000003',
    hospitalId: demoHospitals[1]!.id,
    name: 'Dr. Samira Noor (DEMO)',
    specialty: 'Emergency Medicine',
    experienceYears: 10,
    chamberSchedule: 'On call · 24 hours',
    contactPhone: '+880 1700 000201',
    isAvailable: 1,
  },
  {
    id: 'dc000000-0000-4000-8000-000000000004',
    hospitalId: demoHospitals[1]!.id,
    name: 'Dr. Imran Hossain (DEMO)',
    specialty: 'Orthopedics',
    experienceYears: 7,
    chamberSchedule: 'Sat–Thu · 10:00–16:00',
    contactPhone: '+880 1700 000202',
    isAvailable: 1,
  },
];

function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return { passwordSalt: salt, passwordHash: hash };
}

await db.transaction(async (transaction) => {
  for (const hospital of demoHospitals) {
    await transaction
      .insert(hospitals)
      .values(hospital)
      .onConflictDoNothing({ target: hospitals.id });
  }

  for (const bed of demoBeds) {
    await transaction
      .insert(bedInventory)
      .values(bed)
      .onConflictDoNothing({ target: bedInventory.id });
  }

  for (const doctor of demoDoctors) {
    await transaction
      .insert(doctors)
      .values(doctor)
      .onConflictDoNothing({ target: doctors.id });
  }

  for (const staff of demoStaff) {
    const { passwordHash, passwordSalt } = hashPassword(staff.password);
    await transaction
      .insert(staffAccess)
      .values({
        id: staff.id,
        hospitalId: staff.hospitalId,
        staffName: staff.staffName,
        passwordSalt,
        passwordHash,
        isActive: true,
      })
      .onConflictDoUpdate({
        target: staffAccess.id,
        set: {
          staffName: staff.staffName,
          passwordSalt,
          passwordHash,
          isActive: true,
        },
      });
  }
});

await db.$client.end({ timeout: 5 });

console.log(
  'Demo data seeded successfully. Demo credentials are documented in README.md.',
);
for (const hospital of demoHospitals) {
  console.log(`${hospital.name}: ${hospital.id}`);
}
