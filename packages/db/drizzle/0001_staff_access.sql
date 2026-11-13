CREATE TABLE IF NOT EXISTS public.staff_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id uuid NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
  staff_name text NOT NULL,
  pin_salt text NOT NULL,
  pin_hash text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp without time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS staff_access_hospital_idx
  ON public.staff_access (hospital_id);

ALTER TABLE public.staff_access ENABLE ROW LEVEL SECURITY;
