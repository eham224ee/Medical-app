ALTER TABLE public.staff_access
  RENAME COLUMN pin_salt TO password_salt;

ALTER TABLE public.staff_access
  RENAME COLUMN pin_hash TO password_hash;
