-- Additive: the existing assignment RLS policies continue to govern this private key.
ALTER TABLE public.assignments
ADD COLUMN IF NOT EXISTS marking_key_text text;
COMMENT ON COLUMN public.assignments.marking_key_text IS 'Private teacher-provided authoritative AI marking scheme. Never expose through student assignment queries.';
