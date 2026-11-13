DO $$ BEGIN
  CREATE TYPE public.bed_status_code AS ENUM (
    'HIGH_AVAILABILITY',
    'LIMITED',
    'FULL',
    'UNVERIFIED'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END; $$;

DO $$ BEGIN
  CREATE TYPE public.verification_status AS ENUM (
    'PENDING',
    'VERIFIED',
    'REJECTED'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END; $$;

DO $$ BEGIN
  CREATE TYPE public.admin_role AS ENUM (
    'SUPER_ADMIN',
    'MODERATOR',
    'AUDITOR'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END; $$;

CREATE TABLE IF NOT EXISTS public.hospitals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  address text NOT NULL,
  latitude text NOT NULL,
  longitude text NOT NULL,
  hotline_phone text NOT NULL,
  verification_status public.verification_status NOT NULL DEFAULT 'PENDING',
  created_at timestamp without time zone NOT NULL DEFAULT now(),
  updated_at timestamp without time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS hospital_location_idx
  ON public.hospitals (latitude, longitude);

CREATE TABLE IF NOT EXISTS public.bed_inventory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id uuid NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
  category text NOT NULL,
  department text NOT NULL,
  available_count integer NOT NULL DEFAULT 0,
  total_count integer NOT NULL DEFAULT 0,
  status_code public.bed_status_code NOT NULL DEFAULT 'HIGH_AVAILABILITY',
  last_updated_by_user_id text,
  last_updated_at timestamp without time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS bed_hospital_idx
  ON public.bed_inventory (hospital_id);

CREATE UNIQUE INDEX IF NOT EXISTS "bed_inventory_hospital_category_department_uidx"
  ON public.bed_inventory (hospital_id, category, department);

CREATE TABLE IF NOT EXISTS public.doctors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id uuid NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
  name text NOT NULL,
  specialty text NOT NULL,
  experience_years integer NOT NULL DEFAULT 0,
  chamber_schedule text NOT NULL,
  contact_phone text NOT NULL,
  is_available integer NOT NULL DEFAULT 1,
  created_at timestamp without time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS doctor_hospital_idx
  ON public.doctors (hospital_id);
CREATE INDEX IF NOT EXISTS doctor_specialty_idx
  ON public.doctors (specialty);

CREATE TABLE IF NOT EXISTS public.master_admins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  password_hash text NOT NULL,
  role public.admin_role NOT NULL DEFAULT 'MODERATOR',
  created_at timestamp without time zone NOT NULL DEFAULT now(),
  CONSTRAINT master_admins_email_unique UNIQUE (email)
);

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id uuid NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
  actor_id text NOT NULL,
  action_type text NOT NULL,
  payload text NOT NULL,
  created_at timestamp without time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS audit_hospital_idx
  ON public.audit_logs (hospital_id);
