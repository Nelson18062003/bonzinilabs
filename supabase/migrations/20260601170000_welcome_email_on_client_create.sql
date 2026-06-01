-- ============================================================
-- Mail de bienvenue ROBUSTE : déclenché côté serveur à la CRÉATION du
-- compte client (au lieu de dépendre de la complétion de l'onboarding
-- côté front). Couvre Google, email, et création admin (email réel).
--
-- POURQUOI : un utilisateur Google qui ne finit pas l'onboarding ne
-- recevait jamais la bienvenue (l'enqueue était dans OnboardingPage).
-- Ici, on l'enfile dès l'INSERT dans `clients` → fiable, indépendant du front.
--
-- SÛRETÉ :
--   - idempotent : idempotency_key = 'welcome:<user_id>' (1 seul mail, même
--     si l'ancien appel onboarding s'exécute aussi → ON CONFLICT DO NOTHING).
--   - best-effort : un échec n'annule jamais la création du client.
--   - inerte si template 'welcome' désactivé.
--   - téléphone-seul (@bonzini-client.local) → 'skipped'.
-- ============================================================

CREATE OR REPLACE FUNCTION public.enqueue_welcome_email_on_client()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_enabled BOOLEAN;
  v_email   TEXT;
  v_status  TEXT;
BEGIN
  BEGIN
    SELECT enabled INTO v_enabled
      FROM public.email_template_map WHERE notification_type = 'welcome';
    IF v_enabled IS NOT TRUE THEN RETURN NEW; END IF;

    -- Source de vérité pour l'email : auth.users.
    SELECT email INTO v_email FROM auth.users WHERE id = NEW.user_id;

    IF v_email IS NULL OR v_email = '' OR lower(v_email) LIKE '%@bonzini-client.local' THEN
      v_status := 'skipped';
    ELSE
      v_status := 'pending';
    END IF;

    INSERT INTO public.email_outbox (
      event_type, recipient_user_id, recipient_email, template, payload,
      status, idempotency_key
    ) VALUES (
      'welcome', NEW.user_id, v_email, 'welcome',
      jsonb_build_object('first_name', COALESCE(NEW.first_name, '')),
      v_status, 'welcome:' || NEW.user_id::text
    )
    ON CONFLICT (idempotency_key) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'enqueue_welcome_email_on_client: client % : %', NEW.user_id, SQLERRM;
  END;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.enqueue_welcome_email_on_client IS
  'Trigger AFTER INSERT ON clients : enfile le mail de bienvenue dès la création du compte (robuste, ne dépend pas de l''onboarding front). Idempotent par user_id, best-effort.';

DROP TRIGGER IF EXISTS on_client_created_welcome_email ON public.clients;
CREATE TRIGGER on_client_created_welcome_email
  AFTER INSERT ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.enqueue_welcome_email_on_client();

NOTIFY pgrst, 'reload schema';
