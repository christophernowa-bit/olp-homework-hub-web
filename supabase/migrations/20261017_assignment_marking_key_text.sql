-- Private teacher-only assignment marking keys; do not place keys on student-readable assignments.
CREATE TABLE IF NOT EXISTS public.assignment_ai_keys (
  assignment_id uuid PRIMARY KEY REFERENCES public.assignments(id) ON DELETE CASCADE,
  marking_key_text text NOT NULL CHECK (length(trim(marking_key_text)) > 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.assignment_ai_keys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Assignment key teacher read" ON public.assignment_ai_keys FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.assignments a WHERE a.id = assignment_id
  AND (a.created_by = (SELECT auth.uid()) OR public.is_platform_owner((SELECT auth.uid())))));
CREATE POLICY "Assignment key teacher insert" ON public.assignment_ai_keys FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.assignments a WHERE a.id = assignment_id
  AND (a.created_by = (SELECT auth.uid()) OR public.is_platform_owner((SELECT auth.uid())))));
CREATE POLICY "Assignment key teacher update" ON public.assignment_ai_keys FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.assignments a WHERE a.id = assignment_id
  AND (a.created_by = (SELECT auth.uid()) OR public.is_platform_owner((SELECT auth.uid())))))
WITH CHECK (EXISTS (SELECT 1 FROM public.assignments a WHERE a.id = assignment_id
  AND (a.created_by = (SELECT auth.uid()) OR public.is_platform_owner((SELECT auth.uid())))));
