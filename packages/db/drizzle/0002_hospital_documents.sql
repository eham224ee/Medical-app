CREATE TABLE IF NOT EXISTS public.hospital_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id uuid NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_size integer NOT NULL CHECK (file_size > 0 AND file_size <= 10485760),
  storage_path text NOT NULL UNIQUE,
  created_at timestamp without time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS hospital_documents_hospital_idx
  ON public.hospital_documents (hospital_id);

ALTER TABLE public.hospital_documents ENABLE ROW LEVEL SECURITY;
