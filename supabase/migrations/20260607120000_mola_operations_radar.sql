-- ============================================================
-- Mola — Radar opérationnel (source de vérité partagée) + Digest quotidien
--
-- POURQUOI : « ce qui demande mon attention » était (a) un simple comptage côté
-- Edge Function (get_pending_summary), et (b) impossible à automatiser (pg_cron ne
-- peut pas appeler le modèle). On pose ici UNE fonction SQL lue à la fois par Mola
-- (outil enrichi) ET par un cron quotidien → un seul endroit de vérité, AI-native.
--
-- Contenu :
--   1) mola_operations_radar(...)  : RPC LECTURE SEULE, étiquetée @mola, qui remonte
--      dépôts en attente trop vieux, paiements en souffrance, soldes dormants et
--      paiements à taux personnalisé récents (avec noms/montants/ancienneté).
--   2) run_mola_daily_digest()     : envoie un résumé Telegram chaque matin via pg_net.
--      INERTE tant que les secrets Vault (telegram_bot_token / telegram_chat_id) ne
--      sont pas posés (même garde-fou que run_email_drainer). Sûr à migrer avant config.
--   3) cron 'mola-daily-digest'    : planifié à 06:00 UTC (07:00 Douala).
--
-- Sécurité : RPC SECURITY DEFINER, LECTURE SEULE. Si appelée par un utilisateur
-- authentifié, il DOIT être admin actif (is_admin). Le service_role / cron (auth.uid()
-- NULL) est un contexte de confiance. L'Edge Function valide déjà l'admin en amont.
-- ============================================================

-- ── 1) Le radar : source de vérité partagée ─────────────────────────────────
create or replace function public.mola_operations_radar(
  p_deposit_age_hours integer default 48,
  p_payment_age_hours integer default 24,
  p_dormant_min_xaf   bigint  default 2000000,
  p_custom_rate_days  integer default 7
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_dep_before   timestamptz := now() - make_interval(hours => greatest(coalesce(p_deposit_age_hours, 48), 1));
  v_pay_before   timestamptz := now() - make_interval(hours => greatest(coalesce(p_payment_age_hours, 24), 1));
  v_custom_since timestamptz := now() - make_interval(days  => greatest(coalesce(p_custom_rate_days, 7), 1));
  v_dormant      bigint      := greatest(coalesce(p_dormant_min_xaf, 2000000), 0);
  v_depots       jsonb;
  v_paiements    jsonb;
  v_dormants     jsonb;
  v_customs      jsonb;
begin
  -- Garde : un utilisateur authentifié non-admin n'a rien à faire ici.
  if auth.uid() is not null and not public.is_admin(auth.uid()) then
    raise exception 'Non autorisé';
  end if;

  -- (1) Dépôts en attente de validation depuis trop longtemps
  select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at asc), '[]'::jsonb)
  into v_depots
  from (
    select d.reference,
           nullif(trim(coalesce(c.first_name, '') || ' ' || coalesce(c.last_name, '')), '') as client,
           coalesce(d.confirmed_amount_xaf, d.amount_xaf) as montant_xaf,
           d.status,
           d.created_at,
           round(extract(epoch from (now() - d.created_at)) / 3600)::int as age_heures
    from public.deposits d
    left join public.clients c on c.user_id = d.user_id
    where d.status in ('admin_review', 'proof_submitted')
      and d.created_at < v_dep_before
    order by d.created_at asc
    limit 15
  ) x;

  -- (2) Paiements en souffrance (fournisseur qui attend / infos bénéficiaire manquantes)
  select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at asc), '[]'::jsonb)
  into v_paiements
  from (
    select p.reference,
           nullif(trim(coalesce(c.first_name, '') || ' ' || coalesce(c.last_name, '')), '') as client,
           p.amount_xaf as montant_xaf,
           p.status,
           p.created_at,
           round(extract(epoch from (now() - p.created_at)) / 3600)::int as age_heures
    from public.payments p
    left join public.clients c on c.user_id = p.user_id
    where p.status in ('processing', 'waiting_beneficiary_info', 'cash_pending')
      and p.created_at < v_pay_before
    order by p.created_at asc
    limit 15
  ) x;

  -- (3) Gros soldes wallet dormants (argent immobile)
  select coalesce(jsonb_agg(to_jsonb(x) order by x.balance_xaf desc), '[]'::jsonb)
  into v_dormants
  from (
    select nullif(trim(coalesce(c.first_name, '') || ' ' || coalesce(c.last_name, '')), '') as client,
           w.balance_xaf
    from public.wallets w
    left join public.clients c on c.user_id = w.user_id
    where w.balance_xaf >= v_dormant
    order by w.balance_xaf desc
    limit 10
  ) x;

  -- (4) Paiements à taux personnalisé récents (à vérifier côté marge)
  select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc), '[]'::jsonb)
  into v_customs
  from (
    select p.reference,
           nullif(trim(coalesce(c.first_name, '') || ' ' || coalesce(c.last_name, '')), '') as client,
           p.amount_xaf as montant_xaf,
           p.exchange_rate as taux,
           p.status,
           p.created_at
    from public.payments p
    left join public.clients c on c.user_id = p.user_id
    where p.rate_is_custom = true
      and p.created_at >= v_custom_since
    order by p.created_at desc
    limit 15
  ) x;

  return jsonb_build_object(
    'genere_a', now(),
    'seuils', jsonb_build_object(
      'depot_age_h', coalesce(p_deposit_age_hours, 48),
      'paiement_age_h', coalesce(p_payment_age_hours, 24),
      'dormant_min_xaf', v_dormant,
      'taux_perso_jours', coalesce(p_custom_rate_days, 7)
    ),
    'depots_en_attente',          jsonb_build_object('count', jsonb_array_length(v_depots),    'items', v_depots),
    'paiements_en_souffrance',    jsonb_build_object('count', jsonb_array_length(v_paiements), 'items', v_paiements),
    'soldes_dormants',            jsonb_build_object('count', jsonb_array_length(v_dormants),  'items', v_dormants),
    'taux_personnalises_recents', jsonb_build_object('count', jsonb_array_length(v_customs),   'items', v_customs),
    'note', 'Présente d''abord le plus URGENT (dépôts/paiements les plus vieux, plus gros montants). Si tout est vide, dis simplement que rien ne demande attention.'
  );
end;
$$;

revoke all on function public.mola_operations_radar(integer, integer, bigint, integer) from public, anon;
grant execute on function public.mola_operations_radar(integer, integer, bigint, integer) to authenticated, service_role;

-- Étiquette @mola (OBLIGATOIRE pour toute nouvelle RPC) → découverte AI-native.
comment on function public.mola_operations_radar(integer, integer, bigint, integer) is
  '@mola:{"expose":true,"kind":"read","permission":"canViewDeposits","label":"Radar opérationnel (ce qui demande attention)"}';

-- ── 2) Le digest quotidien (cron → Telegram via pg_net) ─────────────────────
create or replace function public.run_mola_daily_digest()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token text;
  v_chat  text;
  v_radar jsonb;
  v_nd int; v_np int; v_ndorm int; v_nc int;
  v_msg text;
begin
  -- Secrets dans Vault (mêmes valeurs que les secrets Edge TELEGRAM_*). Absents → no-op.
  select decrypted_secret into v_token from vault.decrypted_secrets where name = 'telegram_bot_token';
  select decrypted_secret into v_chat  from vault.decrypted_secrets where name = 'telegram_chat_id';
  if v_token is null or v_chat is null then
    raise warning 'run_mola_daily_digest: secrets Vault manquants (telegram_bot_token / telegram_chat_id) — appel ignoré';
    return;
  end if;

  v_radar := public.mola_operations_radar();  -- seuils par défaut
  v_nd    := coalesce((v_radar -> 'depots_en_attente'          ->> 'count')::int, 0);
  v_np    := coalesce((v_radar -> 'paiements_en_souffrance'    ->> 'count')::int, 0);
  v_ndorm := coalesce((v_radar -> 'soldes_dormants'            ->> 'count')::int, 0);
  v_nc    := coalesce((v_radar -> 'taux_personnalises_recents' ->> 'count')::int, 0);

  -- Rien à signaler → on n'envoie rien (pas de bruit quotidien).
  if (v_nd + v_np + v_ndorm + v_nc) = 0 then
    return;
  end if;

  v_msg := '☀️ <b>Point Mola du matin</b>' || E'\n\n'
        || '🟠 Dépôts à valider (>48h) : '   || v_nd    || E'\n'
        || '🔴 Paiements en souffrance : '    || v_np    || E'\n'
        || '💰 Soldes dormants : '            || v_ndorm || E'\n'
        || '⚠️ Taux perso récents : '         || v_nc    || E'\n\n'
        || 'Ouvre Mola et demande « fais le point » pour le détail.';

  perform net.http_post(
    url     := 'https://api.telegram.org/bot' || v_token || '/sendMessage',
    body    := jsonb_build_object('chat_id', v_chat, 'text', v_msg, 'parse_mode', 'HTML'),
    headers := jsonb_build_object('Content-Type', 'application/json'),
    timeout_milliseconds := 10000
  );
exception when others then
  raise warning 'run_mola_daily_digest failed: %', sqlerrm;
end;
$$;

revoke all on function public.run_mola_daily_digest() from public, anon, authenticated;

-- ── 3) Planification quotidienne (06:00 UTC = 07:00 Douala) ──────────────────
do $$
begin
  perform cron.unschedule('mola-daily-digest')
  where exists (select 1 from cron.job where jobname = 'mola-daily-digest');

  perform cron.schedule(
    'mola-daily-digest',
    '0 6 * * *',
    $cron$ select public.run_mola_daily_digest(); $cron$
  );
exception when others then
  raise warning 'Planification cron mola-daily-digest impossible (pg_cron activé ?): %', sqlerrm;
end;
$$;

-- ============================================================
-- CONFIG (à poser dans Vault — Project Settings → Vault) pour activer le digest :
--   telegram_bot_token = <même valeur que le secret Edge TELEGRAM_BOT_TOKEN>
--   telegram_chat_id   = <même valeur que TELEGRAM_CHAT_ID>
-- Sans ces secrets, le digest est inerte (le radar, lui, marche immédiatement).
-- ============================================================

notify pgrst, 'reload schema';
