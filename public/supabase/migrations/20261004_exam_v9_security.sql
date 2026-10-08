-- OLP Exam System v9: server-authoritative attempt deadlines and controlled submission.

alter table public.exam_attempts
  add column if not exists deadline_at timestamptz;

create or replace function public.set_exam_attempt_deadline()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_duration integer;
  v_exam_end timestamptz;
  v_duration_end timestamptz;
begin
  select e.duration_minutes, e.ends_at
    into v_duration, v_exam_end
  from public.exams e
  where e.id = new.exam_id;

  if new.started_at is null then
    new.started_at := now();
  end if;

  if v_duration is not null then
    v_duration_end := new.started_at + make_interval(mins => v_duration);
  end if;

  new.deadline_at := case
    when v_duration_end is not null and v_exam_end is not null then least(v_duration_end, v_exam_end)
    when v_duration_end is not null then v_duration_end
    else v_exam_end
  end;

  return new;
end;
$$;

drop trigger if exists trg_set_exam_attempt_deadline on public.exam_attempts;
create trigger trg_set_exam_attempt_deadline
before insert on public.exam_attempts
for each row execute function public.set_exam_attempt_deadline();

-- Backfill existing attempts without changing their start time.
update public.exam_attempts a
set deadline_at = case
  when e.duration_minutes is not null and e.ends_at is not null then
    least(a.started_at + make_interval(mins => e.duration_minutes), e.ends_at)
  when e.duration_minutes is not null then
    a.started_at + make_interval(mins => e.duration_minutes)
  else e.ends_at
end
from public.exams e
where e.id = a.exam_id
  and a.deadline_at is null;

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
      and (a.deadline_at is null or now() <= a.deadline_at)
      and (e.ends_at is null or now() <= e.ends_at)
  );
$$;

create or replace function public.submit_exam_attempt(p_attempt_id uuid)
returns public.exam_attempts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attempt public.exam_attempts;
begin
  select * into v_attempt
  from public.exam_attempts
  where id = p_attempt_id
    and student_id = auth.uid()
  for update;

  if not found then
    raise exception 'Exam attempt not found.' using errcode = 'P0002';
  end if;

  if v_attempt.status <> 'in_progress' then
    return v_attempt;
  end if;

  update public.exam_attempts
  set status = 'submitted',
      submitted_at = now(),
      updated_at = now()
  where id = p_attempt_id
  returning * into v_attempt;

  return v_attempt;
end;
$$;

revoke all on function public.submit_exam_attempt(uuid) from public;
grant execute on function public.submit_exam_attempt(uuid) to authenticated;
