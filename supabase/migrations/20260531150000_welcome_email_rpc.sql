-- ============================================================
-- Chantier B — email de Bienvenue (#3, hors trigger notifications)
--
-- La Bienvenue ne correspond à aucune notification métier : on l'enfile
-- explicitement à la fin de l'onboarding, via une RPC SECURITY DEFINER
-- (l'outbox est en RLS interne, pas d'écriture client directe).
--
-- Idempotence : idempotency_key = 'welcome:<user_id>' UNIQUE → un seul
-- email de bienvenue par utilisateur, même si l'onboarding est rejoué.
-- Respecte la même règle d'activation que le trigger : on n'enfile que si
-- le template 'welcome' est activé dans email_template_map (sinon no-op),
-- pour garder le système globalement inerte jusqu'à l'étape d'activation B4.
-- ============================================================

-- Le set v1 inclut 'welcome' (désactivé au départ comme les autres).
INSERT INTO public.email_template_map (notification_type, template, enabled)
VALUES ('welcome', 'welcome', false)
ON CONFLICT (notification_type) DO NOTHING;

CREATE OR REPLACE FUNCTION public.enqueue_welcome_email()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid     UUID := auth.uid();
  v_email   TEXT;
  v_first   TEXT;
  v_enabled BOOLEAN;
BEGIN
  IF v_uid IS NULL THEN
    RETURN;  -- non authentifié : no-op silencieux
  END IF;

  -- Respecter le drapeau d'activation global.
  SELECT enabled INTO v_enabled
    FROM public.email_template_map WHERE notification_type = 'welcome';
  IF v_enabled IS NOT TRUE THEN
    RETURN;
  END IF;

  SELECT u.email, c.first_name
    INTO v_email, v_first
    FROM auth.users u
    LEFT JOIN public.clients c ON c.user_id = u.id
   WHERE u.id = v_uid;

  -- Pas d'email réel (téléphone-seul) → skipped, pas d'envoi.
  IF v_email IS NULL OR v_email = '' OR lower(v_email) LIKE '%@bonzini-client.local' THEN
    INSERT INTO public.email_outbox (
      event_type, recipient_user_id, recipient_email, template, payload,
      status, idempotency_key
    ) VALUES (
      'welcome', v_uid, v_email, 'welcome',
      jsonb_build_object('first_name', COALESCE(v_first, 'Utilisateur')),
      'skipped', 'welcome:' || v_uid::text
    )
    ON CONFLICT (idempotency_key) DO NOTHING;
    RETURN;
  END IF;

  INSERT INTO public.email_outbox (
    event_type, recipient_user_id, recipient_email, template, payload,
    status, idempotency_key
  ) VALUES (
    'welcome', v_uid, v_email, 'welcome',
    jsonb_build_object('first_name', COALESCE(v_first, 'Utilisateur')),
    'pending', 'welcome:' || v_uid::text
  )
  ON CONFLICT (idempotency_key) DO NOTHING;
END;
$$;

COMMENT ON FUNCTION public.enqueue_welcome_email IS
  'Enfile l''email de bienvenue pour l''utilisateur courant (idempotent par user_id). Appelée en fin d''onboarding. No-op si le template welcome est désactivé.';

REVOKE ALL ON FUNCTION public.enqueue_welcome_email() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.enqueue_welcome_email() TO authenticated;

NOTIFY pgrst, 'reload schema';
