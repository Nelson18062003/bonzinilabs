-- ============================================================
-- Chantier B — Lot B4 (partie DB)
-- RPC de prise de lot concurrente pour le drainer d'emails.
--
-- Le drainer (Edge Function send-email, déclenché par pg_cron) appelle
-- claim_email_batch() pour récupérer un lot d'emails prêts à partir, en
-- évitant qu'un run cron concurrent traite deux fois la même ligne.
--
-- PATTERN DE BAIL (lease) : on pose next_attempt_at dans le futur (+2 min)
-- au moment de la prise. Ainsi :
--   - un cron concurrent ne re-sélectionne pas la ligne (next_attempt_at > now),
--   - si le drainer crash en plein vol, la ligne redevient éligible après
--     l'expiration du bail (auto-réparation, pas de ligne bloquée).
-- Le marquage final (sent/failed) se fait ensuite par le drainer via le
-- service role (qui contourne la RLS) — pas besoin de RPC dédiée.
--
-- FOR UPDATE SKIP LOCKED : verrou non bloquant, cœur de la concurrence sûre.
-- ============================================================

CREATE OR REPLACE FUNCTION public.claim_email_batch(p_limit INT DEFAULT 20)
RETURNS SETOF public.email_outbox
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH ready AS (
    SELECT o.id
      FROM public.email_outbox o
     WHERE o.status IN ('pending', 'failed')
       AND o.attempts < o.max_attempts
       AND o.next_attempt_at <= now()
     ORDER BY o.created_at
     LIMIT GREATEST(p_limit, 1)
     FOR UPDATE SKIP LOCKED
  )
  UPDATE public.email_outbox o
     SET next_attempt_at = now() + interval '2 minutes'   -- bail
    FROM ready
   WHERE o.id = ready.id
  RETURNING o.*;
END;
$$;

COMMENT ON FUNCTION public.claim_email_batch IS
  'Réserve un lot d''emails prêts (FOR UPDATE SKIP LOCKED + bail de 2 min). Appelé par le drainer send-email. Le marquage final est fait par le service role.';

-- Réservé au service role (le drainer). Jamais exposé aux clients/admins.
REVOKE ALL ON FUNCTION public.claim_email_batch(INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.claim_email_batch(INT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.claim_email_batch(INT) TO service_role;

NOTIFY pgrst, 'reload schema';
