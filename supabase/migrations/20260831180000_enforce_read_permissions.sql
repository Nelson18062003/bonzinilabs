-- ============================================================
-- P1 (suite) — Confidentialité : permissions de LECTURE côté serveur.
--
-- Rappel du problème (cf. 20260831160000) : is_admin() ne teste aucun rôle.
-- Restaient gardées par is_admin() des fonctions qui exposent des données
-- client ou pilotent des flux métier :
--
--   · assistant_readonly_query — le SQL libre de Mola. L'edge function
--     passe volontairement p_allowed_tables = NULL (« accès LECTURE complet
--     pour tout admin »), et le garde-fou de confidentialité est ignoré
--     quand ce paramètre est NULL. Résultat : un cash_agent ou un treasurer
--     (canViewClients = false) pouvait exécuter un SELECT arbitraire et
--     lire tout le PII client, les grands livres, les bénéficiaires…
--     Le paramètre restant à la main de l'appelant, la seule barrière
--     fiable est le rôle : la fonction exige désormais canViewClients.
--   · get_client_ledger — grand livre d'un client (PII + financier).
--   · get_deposit_stats, create_client_deposit, mark_suggestion_applied.
--
-- Méthode identique au batch 1 : le CORPS de chaque fonction est repris tel
-- quel via pg_get_functiondef ; seule la ligne de garde est remplacée, avec
-- assertion si le motif n'est pas trouvé (échec bruyant plutôt que silencieux).
-- ============================================================
DO $mig$
DECLARE
  r RECORD;
  v_def TEXT;
  v_new TEXT;
BEGIN
  FOR r IN
    SELECT * FROM (VALUES
      ('assistant_readonly_query','canViewClients'),
      ('get_client_ledger','canViewClients'),
      ('get_deposit_stats','canViewDeposits'),
      ('create_client_deposit','canProcessDeposits'),
      ('mark_suggestion_applied','canManageRates')
    ) AS t(fname, perm)
  LOOP
    SELECT pg_get_functiondef(p.oid) INTO v_def
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = r.fname
    LIMIT 1;

    IF v_def IS NULL THEN
      RAISE EXCEPTION 'Fonction introuvable: %', r.fname;
    END IF;

    IF v_def LIKE '%admin_has_permission(%' THEN
      CONTINUE;  -- déjà durcie (migration rejouée)
    END IF;

    v_new := regexp_replace(
      v_def,
      '(?:public\.)?is_admin\((auth\.uid\(\)|v_admin_id|v_caller_id)\)',
      'public.admin_has_permission(\1, ''' || r.perm || ''')',
      'g'
    );

    IF v_new = v_def THEN
      RAISE EXCEPTION 'Garde is_admin introuvable dans %', r.fname;
    END IF;

    EXECUTE v_new;
    RAISE NOTICE 'durcie: % -> %', r.fname, r.perm;
  END LOOP;
END
$mig$;
