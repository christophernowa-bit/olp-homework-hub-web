create table if not exists public.teacher_support_conversations (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null unique references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.teacher_support_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.teacher_support_conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 5000),
  created_at timestamptz not null default now()
);

create index if not exists teacher_support_messages_conversation_created_idx
  on public.teacher_support_messages(conversation_id, created_at);

create table if not exists public.teacher_welcome_email_log (
  teacher_id uuid primary key references public.profiles(id) on delete cascade,
  email text not null,
  status text not null check (status in ('sending', 'sent', 'failed')),
  last_attempt_at timestamptz not null default now(),
  sent_at timestamptz,
  provider_message_id text,
  last_error text
);

alter table public.teacher_support_conversations enable row level security;
alter table public.teacher_support_messages enable row level security;
alter table public.teacher_welcome_email_log enable row level security;

grant select, insert on public.teacher_support_conversations to authenticated;
grant select, insert on public.teacher_support_messages to authenticated;
revoke all on public.teacher_welcome_email_log from anon, authenticated;

create policy "Teachers and owners can read support conversations"
  on public.teacher_support_conversations for select to authenticated
  using (
    teacher_id = (select auth.uid())
    or exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.role::text = 'platform_owner'
    )
  );

create policy "Teachers can open their own support conversation"
  on public.teacher_support_conversations for insert to authenticated
  with check (
    teacher_id = (select auth.uid())
    and exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.role::text = 'teacher'
    )
  );

create policy "Teachers and owners can read support messages"
  on public.teacher_support_messages for select to authenticated
  using (
    exists (
      select 1
      from public.teacher_support_conversations c
      where c.id = conversation_id
        and (
          c.teacher_id = (select auth.uid())
          or exists (
            select 1 from public.profiles p
            where p.id = (select auth.uid()) and p.role::text = 'platform_owner'
          )
        )
    )
  );

create policy "Teachers and owners can send support messages"
  on public.teacher_support_messages for insert to authenticated
  with check (
    sender_id = (select auth.uid())
    and exists (
      select 1
      from public.teacher_support_conversations c
      where c.id = conversation_id
        and (
          (c.teacher_id = (select auth.uid()) and exists (
            select 1 from public.profiles p
            where p.id = (select auth.uid()) and p.role::text = 'teacher'
          ))
          or exists (
            select 1 from public.profiles p
            where p.id = (select auth.uid()) and p.role::text = 'platform_owner'
          )
        )
    )
  );
