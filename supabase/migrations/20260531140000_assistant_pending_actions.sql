-- Assistant DO IA — Phase 2 : actions d'écriture avec CONFIRMATION humaine.
-- L'IA ne fait qu'en PROPOSER ; l'action n'est exécutée que lorsque l'admin
-- la confirme. Cette table mémorise les propositions en attente (anti-rejeu,
-- audit, montant verrouillé côté serveur — impossible à altérer après coup).

create table if not exists public.assistant_pending_actions (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid references public.assistant_conversations(id) on delete cascade,
  admin_user_id   uuid not null references auth.users(id) on delete cascade,
  tool            text not null,
  args            jsonb not null default '{}'::jsonb,
  summary         jsonb not null default '{}'::jsonb,
  status          text not null default 'pending' check (status in ('pending','executing','executed','cancelled','failed')),
  result          jsonb,
  created_at      timestamptz not null default now(),
  resolved_at     timestamptz
);

create index if not exists idx_assistant_pending_actions_admin
  on public.assistant_pending_actions(admin_user_id, status, created_at desc);

alter table public.assistant_pending_actions enable row level security;

-- Le propriétaire (admin actif) peut lire ses propres propositions.
-- Les écritures réelles passent par l'Edge Function (service role) qui contourne RLS.
drop policy if exists "assistant_pending_actions_owner_select" on public.assistant_pending_actions;
create policy "assistant_pending_actions_owner_select"
  on public.assistant_pending_actions for select
  using (
    admin_user_id = auth.uid()
    and exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid() and coalesce(ur.is_disabled, false) = false
    )
  );
