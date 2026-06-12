-- Mola — Rétention (Lot 4 / §5). Purge des conversations de l'assistant > N jours (défaut 180)
-- et des souvenirs épisodiques expirés. L'audit (admin_audit_logs) est conservé séparément, plus longtemps.
-- assistant_messages est supprimé en CASCADE avec sa conversation parente.

create or replace function public.mola_purge_old_conversations(p_days int default 180)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_conv int;
  v_mem int;
begin
  delete from public.assistant_conversations
  where updated_at < now() - make_interval(days => greatest(1, p_days));
  get diagnostics v_conv = row_count;

  delete from public.mola_memory
  where expires_at is not null and expires_at < now();
  get diagnostics v_mem = row_count;

  return jsonb_build_object('conversations_deleted', v_conv, 'expired_memory_deleted', v_mem);
end;
$$;

revoke all on function public.mola_purge_old_conversations(int) from public, anon;
grant execute on function public.mola_purge_old_conversations(int) to service_role;

-- Planification quotidienne si pg_cron est disponible (sinon, planifier manuellement côté Supabase).
-- On n'échoue JAMAIS la migration si pg_cron est absent.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('mola-purge-conversations', '17 3 * * *',
      $cron$ select public.mola_purge_old_conversations(180); $cron$);
  end if;
exception when others then
  null;
end $$;
