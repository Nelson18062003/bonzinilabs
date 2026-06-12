-- ============================================================
-- Mail de bienvenue — déclenché UNIQUEMENT quand l'email est VÉRIFIÉ.
--
-- Règle métier (demandée) :
--   - Inscription manuelle (email+mot de passe) : code OTP d'abord, puis
--     bienvenue APRÈS vérification. → géré par le trigger B (à la confirmation).
--   - Compte créé par un admin (email réel) : déjà confirmé → bienvenue seule,
--     pas d'OTP. → géré par le trigger A (à la création, email déjà confirmé).
--   - Google : email déjà vérifié → bienvenue seule, pas d'OTP. → trigger A.
--
-- 2 déclencheurs complémentaires, MÊME idempotency_key ('welcome:<user_id>')
-- → un seul mail de bienvenue par utilisateur, quoi qu'il arrive.
--
-- SÛRETÉ : best-effort partout (un échec n'impacte JAMAIS l'auth ni la
-- création du compte). Inerte si template 'welcome' désactivé.
-- Téléphone-seul (@bonzini-client.local) → 'skipped'.
-- ============================================================

-- Fonction d'enqueue partagée (par user_id + prénom).
CREATE OR REPLACE FUNCTION public._enqueue_welcome(p_user_id UUID, p_first TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_enabled BOOLEAN;
  v_email   TEXT;
  v_status  TEXT;
BEGIN
  SELECT enabled INTO v_enabled
    FROM public.email_template_map WHERE notification_type = 'welcome';
  IF v_enabled IS NOT TRUE THEN RETURN; END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = p_user_id;

  IF v_email IS NULL OR v_email = '' OR lower(v_email) LIKE '%@bonzini-client.local' THEN
    v_status := 'skipped';
  ELSE
    v_status := 'pending';
  END IF;

  INSERT INTO public.email_outbox (
    event_type, recipient_user_id, recipient_email, template, payload,
    status, idempotency_key
  ) VALUES (
    'welcome', p_user_id, v_email, 'welcome',
    jsonb_build_object('first_name', COALESCE(p_first, '')),
    v_status, 'welcome:' || p_user_id::text
  )
  ON CONFLICT (idempotency_key) DO NOTHING;
END;
$$;

-- ── Trigger A : à la création du client, SI l'email est DÉJÀ vérifié ──────
-- Couvre : admin (email_confirm) + Google (email_verified). Les inscriptions
-- manuelles (non encore vérifiées) sont ignorées ici → voir trigger B.
CREATE OR REPLACE FUNCTION public.enqueue_welcome_email_on_client()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_confirmed TIMESTAMPTZ;
BEGIN
  BEGIN
    SELECT email_confirmed_at INTO v_confirmed FROM auth.users WHERE id = NEW.user_id;
    -- Bienvenue seulement si l'email est déjà confirmé à la création
    -- (admin/Google). Sinon (inscription manuelle non vérifiée) : on attend B.
    IF v_confirmed IS NOT NULL THEN
      PERFORM public._enqueue_welcome(NEW.user_id, NEW.first_name);
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'welcome_on_client % : %', NEW.user_id, SQLERRM;
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_client_created_welcome_email ON public.clients;
CREATE TRIGGER on_client_created_welcome_email
  AFTER INSERT ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.enqueue_welcome_email_on_client();

-- ── Trigger B : au moment où l'email devient VÉRIFIÉ (null → non-null) ─────
-- Couvre l'inscription manuelle : bienvenue envoyée APRÈS la saisie du code OTP.
CREATE OR REPLACE FUNCTION public.enqueue_welcome_email_on_confirm()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_first TEXT;
BEGIN
  BEGIN
    -- N'enfile que pour les clients (pas les admins) ayant une fiche.
    SELECT first_name INTO v_first FROM public.clients WHERE user_id = NEW.id;
    IF FOUND THEN
      PERFORM public._enqueue_welcome(NEW.id, v_first);
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'welcome_on_confirm % : %', NEW.id, SQLERRM;
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_user_email_confirmed_welcome ON auth.users;
CREATE TRIGGER on_user_email_confirmed_welcome
  AFTER UPDATE OF email_confirmed_at ON auth.users
  FOR EACH ROW
  WHEN (OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL)
  EXECUTE FUNCTION public.enqueue_welcome_email_on_confirm();

NOTIFY pgrst, 'reload schema';
