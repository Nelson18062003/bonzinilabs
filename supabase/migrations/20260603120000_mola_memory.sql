-- Mola — Mémoire en couches (Lot 3).
-- Conception : docs/assistant-ops/refonte/04-MEMOIRE.md
--   - mola_memory       : sémantique (savoir/global) + épisodique (résumés de conv, par admin), vectorisé.
--   - mola_user_memory  : profil/préférences (structuré, NON vectorisé).
--   - assistant_conversations.rolling_summary : compaction des conversations longues.
--   - mola_search_memory(...) : recherche top-k par similarité cosinus, scopée (global + propre à l'admin).
-- Embeddings : gte-small (384 dim), générés DANS l'edge function (Supabase.ai) → rien ne sort de l'infra.
-- Best-effort : si l'embedding est indisponible, la table reste vide et l'assistant fonctionne normalement.

create extension if not exists vector;

-- ── Mémoire vectorisée ──────────────────────────────────────────────────────
create table if not exists public.mola_memory (
  id            uuid primary key default gen_random_uuid(),
  kind          text not null check (kind in ('semantic', 'episodic')),
  admin_user_id uuid references auth.users(id) on delete cascade,  -- NULL = savoir GLOBAL partagé
  scope         text,
  content       text not null,
  embedding     vector(384),
  source        text,
  created_at    timestamptz not null default now(),
  expires_at    timestamptz
);
create index if not exists idx_mola_memory_vec on public.mola_memory using hnsw (embedding vector_cosine_ops);
create index if not exists idx_mola_memory_scope on public.mola_memory (admin_user_id, kind, scope);

-- ── Profil / préférences / macros (structuré) ───────────────────────────────
create table if not exists public.mola_user_memory (
  admin_user_id uuid not null references auth.users(id) on delete cascade,
  key           text not null,
  value         jsonb not null,
  updated_at    timestamptz not null default now(),
  primary key (admin_user_id, key)
);

-- ── Compaction des conversations longues ────────────────────────────────────
alter table public.assistant_conversations add column if not exists rolling_summary text;
alter table public.assistant_conversations add column if not exists summary_through timestamptz;

-- ── RLS (protège les lectures directes depuis le frontend ; l'edge function écrit en service role) ──
alter table public.mola_memory enable row level security;
alter table public.mola_user_memory enable row level security;

drop policy if exists "mola_memory_read" on public.mola_memory;
create policy "mola_memory_read" on public.mola_memory for select
  using (
    (admin_user_id = auth.uid())
    or (admin_user_id is null and kind = 'semantic')
  );

drop policy if exists "mola_user_memory_owner" on public.mola_user_memory;
create policy "mola_user_memory_owner" on public.mola_user_memory for select
  using (admin_user_id = auth.uid());

-- ── Recherche vectorielle scopée (top-k cosinus) ────────────────────────────
create or replace function public.mola_search_memory(
  p_embedding vector(384),
  p_admin uuid,
  p_kinds text[] default array['semantic', 'episodic'],
  p_limit int default 6
) returns table (kind text, scope text, content text, distance double precision)
language sql
stable
security definer
set search_path = public
as $$
  select m.kind, m.scope, m.content, (m.embedding <=> p_embedding) as distance
  from public.mola_memory m
  where m.embedding is not null
    and m.kind = any(p_kinds)
    and (m.expires_at is null or m.expires_at > now())
    and (m.admin_user_id = p_admin or m.admin_user_id is null)
  order by m.embedding <=> p_embedding
  limit greatest(1, least(coalesce(p_limit, 6), 20));
$$;

revoke all on function public.mola_search_memory(vector, uuid, text[], int) from public, anon;
grant execute on function public.mola_search_memory(vector, uuid, text[], int) to authenticated, service_role;
