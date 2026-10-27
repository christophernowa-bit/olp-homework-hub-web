create table public.assignment_submission_reviews (
  submission_id uuid primary key references public.assignment_submissions(id) on delete cascade,
  teacher_feedback text not null default '',
  annotations jsonb not null default '[]'::jsonb check (jsonb_typeof(annotations) = 'array'),
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now()
);

alter table public.assignment_submission_reviews enable row level security;
grant select, insert, update, delete on public.assignment_submission_reviews to authenticated;

create policy assignment_submission_reviews_select
on public.assignment_submission_reviews
for select to authenticated
using (
  exists (
    select 1
    from public.assignment_submissions s
    where s.id = submission_id
      and (
        can_manage_assignment(s.assignment_id)
        or (s.student_id = (select auth.uid()) and s.status = 'returned')
      )
  )
);

create policy assignment_submission_reviews_teacher_insert
on public.assignment_submission_reviews
for insert to authenticated
with check (
  exists (
    select 1 from public.assignment_submissions s
    where s.id = submission_id
      and can_manage_assignment(s.assignment_id)
  )
);

create policy assignment_submission_reviews_teacher_update
on public.assignment_submission_reviews
for update to authenticated
using (
  exists (
    select 1 from public.assignment_submissions s
    where s.id = submission_id
      and can_manage_assignment(s.assignment_id)
  )
)
with check (
  exists (
    select 1 from public.assignment_submissions s
    where s.id = submission_id
      and can_manage_assignment(s.assignment_id)
  )
);

create policy assignment_submission_reviews_teacher_delete
on public.assignment_submission_reviews
for delete to authenticated
using (
  exists (
    select 1 from public.assignment_submissions s
    where s.id = submission_id
      and can_manage_assignment(s.assignment_id)
  )
);