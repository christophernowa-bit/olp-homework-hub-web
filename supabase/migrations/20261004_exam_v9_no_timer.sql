-- OLP v9 consolidated correction: exams are not timed.
-- Keep deadline_at for backward compatibility, but stop creating/enforcing deadlines.
drop trigger if exists trg_set_exam_attempt_deadline on public.exam_attempts;
update public.exam_attempts set deadline_at = null where deadline_at is not null;
update public.exams set duration_minutes = null where duration_minutes is not null;

create or replace function public.can_edit_exam_attempt(p_attempt_id uuid)
returns boolean
language sql
stable security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.exam_attempts a
    join public.exams e on e.id = a.exam_id
    where a.id = p_attempt_id
      and a.student_id = auth.uid()
      and a.status = 'in_progress'
      and e.status = 'published'
      and (e.ends_at is null or now() <= e.ends_at)
  );
$$;
