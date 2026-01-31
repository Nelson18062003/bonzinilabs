-- Script pour ajouter 20 taux supplémentaires avec plus de variations
-- Ces taux couvrent 60 jours avec des variations plus marquées

DO $$
DECLARE
  v_user_id UUID;
  v_date TIMESTAMP;
  v_rate_xaf_to_rmb NUMERIC(10, 8);
  v_base_rate NUMERIC(10, 8) := 0.01145; -- Taux de base
  v_days_ago INTEGER;
  v_rates INTEGER[] := ARRAY[60, 55, 50, 48, 45, 42, 40, 38, 35, 33, 32, 31, 29, 27, 25, 23, 21, 18, 16, 14]; -- Jours variés
  v_variations NUMERIC[] := ARRAY[
    -0.000025, 0.000015, -0.000010, 0.000030, -0.000020,
    0.000025, -0.000015, 0.000035, -0.000005, 0.000020,
    -0.000030, 0.000010, 0.000028, -0.000012, 0.000022,
    -0.000018, 0.000033, -0.000008, 0.000026, 0.000012
  ]; -- Variations marquées
  v_hour INTEGER;
  v_idx INTEGER := 1;
BEGIN
  -- Obtenir l'ID de l'admin
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email LIKE '%admin%' OR email LIKE '%super%'
  LIMIT 1;

  IF v_user_id IS NULL THEN
    SELECT id INTO v_user_id FROM auth.users LIMIT 1;
  END IF;

  -- Créer 20 taux avec variations sur différents jours
  FOREACH v_days_ago IN ARRAY v_rates LOOP
    -- Alterner les heures: 9h, 14h, 11h, 16h, etc.
    v_hour := CASE
      WHEN v_idx % 4 = 1 THEN 9
      WHEN v_idx % 4 = 2 THEN 14
      WHEN v_idx % 4 = 3 THEN 11
      ELSE 16
    END;

    v_date := (NOW() - (v_days_ago || ' days')::INTERVAL) + (v_hour || ' hours')::INTERVAL;

    -- Appliquer la variation correspondante
    v_rate_xaf_to_rmb := v_base_rate + v_variations[v_idx];

    -- Ajouter une légère variation aléatoire supplémentaire
    v_rate_xaf_to_rmb := v_rate_xaf_to_rmb + (RANDOM() - 0.5) * 0.000010;

    -- S'assurer que le taux reste dans une fourchette réaliste
    v_rate_xaf_to_rmb := GREATEST(0.01120, LEAST(0.01170, v_rate_xaf_to_rmb));

    -- Insérer le taux
    INSERT INTO public.exchange_rates (
      rate_xaf_to_rmb,
      effective_at,
      effective_date,
      created_by
    ) VALUES (
      v_rate_xaf_to_rmb,
      v_date,
      v_date::DATE,
      v_user_id
    );

    RAISE NOTICE 'Taux % créé pour %: 1,000,000 XAF = % CNY',
      v_idx,
      TO_CHAR(v_date, 'DD/MM/YYYY HH24:MI'),
      ROUND(1000000 * v_rate_xaf_to_rmb);

    v_idx := v_idx + 1;
  END LOOP;

  RAISE NOTICE '✅ 20 taux supplémentaires créés avec succès!';
  RAISE NOTICE '📊 Total: % taux dans la base',
    (SELECT COUNT(*) FROM public.exchange_rates);
END $$;

-- Afficher un aperçu des taux récents
SELECT
  TO_CHAR(effective_at, 'DD/MM/YYYY HH24:MI') as "Date & Heure",
  ROUND(1000000 * rate_xaf_to_rmb) as "1M XAF → CNY",
  ROUND(1 / rate_xaf_to_rmb) as "1 CNY → XAF",
  CASE
    WHEN effective_at > NOW() - INTERVAL '7 days' THEN '🔴 Récent'
    WHEN effective_at > NOW() - INTERVAL '30 days' THEN '🟡 Ce mois'
    ELSE '🟢 Plus ancien'
  END as "Période"
FROM public.exchange_rates
ORDER BY effective_at DESC
LIMIT 15;

-- Statistiques globales
SELECT
  COUNT(*) as "Total de taux",
  ROUND(MIN(1000000 * rate_xaf_to_rmb)) as "Min (CNY)",
  ROUND(MAX(1000000 * rate_xaf_to_rmb)) as "Max (CNY)",
  ROUND(AVG(1000000 * rate_xaf_to_rmb)) as "Moyenne (CNY)",
  ROUND(
    (MAX(1000000 * rate_xaf_to_rmb) - MIN(1000000 * rate_xaf_to_rmb)) * 100.0 /
    MIN(1000000 * rate_xaf_to_rmb),
    2
  ) as "Variation %"
FROM public.exchange_rates;
