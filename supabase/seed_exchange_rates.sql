-- Script pour créer des taux de change fictifs pour tester le graphique
-- Période: 30 derniers jours avec variations réalistes

-- Insérer des taux avec variations progressives (tendance à la hausse)
-- Taux de base: 1,000,000 XAF ≈ 11,400 CNY au début, montant jusqu'à 11,550 CNY

DO $$
DECLARE
  v_user_id UUID;
  v_date TIMESTAMP;
  v_rate_xaf_to_rmb NUMERIC(10, 8);
  v_base_rate NUMERIC(10, 8) := 0.01140; -- Taux de départ (11,400 CNY pour 1M XAF)
  v_day INTEGER;
BEGIN
  -- Obtenir l'ID de l'admin actuel (ou créer un utilisateur système)
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email LIKE '%admin%' OR email LIKE '%super%'
  LIMIT 1;

  -- Si pas d'admin trouvé, utiliser le premier utilisateur
  IF v_user_id IS NULL THEN
    SELECT id INTO v_user_id FROM auth.users LIMIT 1;
  END IF;

  -- Générer 30 jours de taux avec variations réalistes
  FOR v_day IN 0..29 LOOP
    -- Date: aujourd'hui - v_day jours, à 9h00
    v_date := (NOW() - (v_day || ' days')::INTERVAL) + TIME '09:00:00';

    -- Calculer le taux avec variations:
    -- - Tendance générale à la hausse (progression de 0.000005 par jour)
    -- - Variations aléatoires quotidiennes (±0.000020)
    v_rate_xaf_to_rmb := v_base_rate
      + (0.000005 * (30 - v_day)) -- Progression
      + (RANDOM() - 0.5) * 0.000040; -- Variation aléatoire

    -- S'assurer que le taux reste positif et dans une fourchette réaliste
    v_rate_xaf_to_rmb := GREATEST(0.01130, LEAST(0.01160, v_rate_xaf_to_rmb));

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

    RAISE NOTICE 'Taux créé pour %: 1,000,000 XAF = % CNY',
      TO_CHAR(v_date, 'DD/MM/YYYY'),
      ROUND(1000000 * v_rate_xaf_to_rmb);
  END LOOP;

  RAISE NOTICE '✅ 30 taux de change fictifs créés avec succès!';
END $$;

-- Afficher les taux créés
SELECT
  TO_CHAR(effective_at, 'DD/MM/YYYY HH24:MI') as "Date & Heure",
  ROUND(1000000 * rate_xaf_to_rmb) as "1M XAF = CNY",
  ROUND(1 / rate_xaf_to_rmb) as "1 CNY = XAF"
FROM public.exchange_rates
ORDER BY effective_at DESC
LIMIT 10;
