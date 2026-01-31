-- Script pour créer des taux de change fictifs (VERSION CORRIGÉE)
-- Gère les doublons et remplace les taux existants

DO $$
DECLARE
  v_user_id UUID;
  v_date TIMESTAMP;
  v_rate_xaf_to_rmb NUMERIC(10, 8);
  v_base_rate NUMERIC(10, 8) := 0.01140;
  v_day INTEGER;
  v_hour INTEGER;
BEGIN
  -- Obtenir l'ID de l'admin
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email LIKE '%admin%' OR email LIKE '%super%'
  LIMIT 1;

  IF v_user_id IS NULL THEN
    SELECT id INTO v_user_id FROM auth.users LIMIT 1;
  END IF;

  -- Supprimer les anciens taux fictifs (optionnel)
  -- DELETE FROM public.exchange_rates WHERE created_at > NOW() - INTERVAL '90 days';

  -- Générer 50 taux sur 60 jours (avec heures différentes pour éviter les doublons)
  FOR v_day IN 0..59 LOOP
    -- Alterner les heures pour avoir plusieurs taux par jour
    v_hour := CASE
      WHEN v_day % 3 = 0 THEN 9   -- 9h
      WHEN v_day % 3 = 1 THEN 14  -- 14h
      ELSE 17                      -- 17h
    END;

    v_date := (NOW() - (v_day || ' days')::INTERVAL) + (v_hour || ' hours')::INTERVAL;

    -- Calculer le taux avec variations
    v_rate_xaf_to_rmb := v_base_rate
      + (0.000003 * (60 - v_day))  -- Progression lente
      + (RANDOM() - 0.5) * 0.000050; -- Variations marquées

    -- Fourchette réaliste
    v_rate_xaf_to_rmb := GREATEST(0.01120, LEAST(0.01170, v_rate_xaf_to_rmb));

    -- Insérer ou mettre à jour (ON CONFLICT)
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
    )
    ON CONFLICT (effective_date) DO UPDATE SET
      rate_xaf_to_rmb = EXCLUDED.rate_xaf_to_rmb,
      effective_at = EXCLUDED.effective_at,
      created_by = EXCLUDED.created_by;

  END LOOP;

  RAISE NOTICE '✅ Taux créés/mis à jour avec succès!';
END $$;

-- Vérifier les résultats
SELECT
  TO_CHAR(effective_at, 'DD/MM/YYYY HH24:MI') as "Date & Heure",
  ROUND(1000000 * rate_xaf_to_rmb) as "1M FCFA → CNY",
  CASE
    WHEN effective_at > NOW() - INTERVAL '7 days' THEN '🔴 7j'
    WHEN effective_at > NOW() - INTERVAL '30 days' THEN '🟡 30j'
    ELSE '🟢 60j'
  END as "Période"
FROM public.exchange_rates
ORDER BY effective_at DESC
LIMIT 20;

-- Stats globales
SELECT
  COUNT(*) as "Total",
  ROUND(MIN(1000000 * rate_xaf_to_rmb)) as "Min CNY",
  ROUND(MAX(1000000 * rate_xaf_to_rmb)) as "Max CNY",
  ROUND(AVG(1000000 * rate_xaf_to_rmb)) as "Moy CNY",
  ROUND(
    (MAX(1000000 * rate_xaf_to_rmb) - MIN(1000000 * rate_xaf_to_rmb)) * 100.0 /
    MIN(1000000 * rate_xaf_to_rmb),
    2
  ) as "Variation %"
FROM public.exchange_rates;
