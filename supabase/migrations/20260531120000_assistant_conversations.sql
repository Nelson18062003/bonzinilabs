-- Assistant Directeur des Opérations (DO IA) — Phase 0
-- Persistance des conversations de l'assistant admin.
-- RLS : un admin ne voit QUE ses propres conversations/messages.
-- Les écritures côté serveur se font via l'Edge Function (service role) qui contourne RLS ;
-- ces politiques protègent les lectures directes depuis le frontend.

create table if not exists public.assistant_conversations (
  id            uuid primary key default gen_random_uuid(),
  admin_user_id uuid not null references auth.users(id) on delete cascade,
  title         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table if not exists public.assistant_messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.assistant_conversations(id) on delete cascade,
  role            text not null check (role in ('user', 'assistant', 'tool', 'system')),
  content         jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now()
);

create index if not exists idx_assistant_conversations_admin
  on public.assistant_conversations(admin_user_id, updated_at desc);
create index if not exists idx_assistant_messages_conversation
  on public.assistant_messages(conversation_id, created_at);

alter table public.assistant_conversations enable row level security;
alter table public.assistant_messages enable row level security;

-- Conversations : propriétaire uniquement, et doit être un admin actif (non désactivé)
drop policy if exists "assistant_conversations_owner_select" on public.assistant_conversations;
create policy "assistant_conversations_owner_select"
  on public.assistant_conversations for select
  using (
    admin_user_id = auth.uid()
    and exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid() and coalesce(ur.is_disabled, false) = false
    )
  );

drop policy if exists "assistant_conversations_owner_insert" on public.assistant_conversations;
create policy "assistant_conversations_owner_insert"
  on public.assistant_conversations for insert
  with check (
    admin_user_id = auth.uid()
    and exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid() and coalesce(ur.is_disabled, false) = false
    )
  );

drop policy if exists "assistant_conversations_owner_update" on public.assistant_conversations;
create policy "assistant_conversations_owner_update"
  on public.assistant_conversations for update
  using (admin_user_id = auth.uid())
  with check (admin_user_id = auth.uid());

drop policy if exists "assistant_conversations_owner_delete" on public.assistant_conversations;
create policy "assistant_conversations_owner_delete"
  on public.assistant_conversations for delete
  using (admin_user_id = auth.uid());

-- Messages : visibles/insérables si on possède la conversation parente
drop policy if exists "assistant_messages_owner_select" on public.assistant_messages;
create policy "assistant_messages_owner_select"
  on public.assistant_messages for select
  using (
    exists (
      select 1 from public.assistant_conversations c
      where c.id = conversation_id and c.admin_user_id = auth.uid()
    )
  );

drop policy if exists "assistant_messages_owner_insert" on public.assistant_messages;
create policy "assistant_messages_owner_insert"
  on public.assistant_messages for insert
  with check (
    exists (
      select 1 from public.assistant_conversations c
      where c.id = conversation_id and c.admin_user_id = auth.uid()
    )
  );
