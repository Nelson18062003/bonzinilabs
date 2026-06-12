-- ============================================================
-- Inscription email : le compte n'est créé qu'APRÈS vérification du code.
--
-- DEMANDE : un client qui s'inscrit par email/mot de passe ne doit être
-- considéré « créé » (client + wallet + notif admin) qu'une fois son email
-- VÉRIFIÉ via le code. Avant la vérification → rien n'est matérialisé.
--   - Admin (email_confirm) / Google (email_verified) : déjà vérifiés à la
--     création → compte créé tout de suite (inchangé), pas de code.
--
-- MÉCANIQUE :
--   - handle_new_user DIFFÈRE la création si l'email n'est pas confirmé.
--   - À la confirmation (email_confirmed_at NULL → non NULL), on crée le
--     compte. Le mail de bienvenue suit (trigger on_client_created_welcome_email).
--   - La notif admin (sur création de client) se déclenche donc, elle aussi,
--     APRÈS vérification — automatiquement.
--
-- SÛRETÉ : idempotent (ON CONFLICT) ; best-effort sur la confirmation (ne
-- bloque jamais l'auth).
-- ============================================================

-- Helper partagé : crée client + wallet (idempotent).
CREATE OR REPLACE FUNCTION public._create_client_and_wallet(p_id UUID, p_meta JSONB, p_email TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.clients (user_id, first_name, last_name, phone, email, avatar_url)
  VALUES (
    p_id,
    COALESCE(
      NULLIF(p_meta ->> 'first_name', ''),
      NULLIF(p_meta ->> 'full_name', ''),
      NULLIF(p_meta ->> 'name', ''),
      'Utilisateur'
    ),
    COALESCE(p_meta ->> 'last_name', ''),
    p_meta ->> 'phone',
    p_email,
    COALESCE(NULLIF(p_meta ->> 'avatar_url', ''), NULLIF(p_meta ->> 'picture', ''))
  )
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.wallets (user_id, balance_xaf)
  VALUES (p_id, 0)
  ON CONFLICT (user_id) DO NOTHING;
END;
$$;

-- handle_new_user : différer pour les inscriptions email NON vérifiées.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_oauth   BOOLEAN := (NEW.raw_app_meta_data ->> 'provider' = 'google');
  v_is_client  BOOLEAN := (NEW.raw_user_meta_data ->> 'is_client' = 'true');
  v_oauth_email_verified BOOLEAN := (NEW.raw_user_meta_data ->> 'email_verified' = 'true');
BEGIN
  -- OAuth Google non vérifié → rien (defense-in-depth).
  IF v_is_oauth AND NOT v_is_client AND NOT v_oauth_email_verified THEN
    RETURN NEW;
  END IF;

  -- Inscription email/mot de passe PAS encore vérifiée (code en cours) :
  -- on DIFFÈRE → le compte (et la notif admin) seront créés à la confirmation.
  IF v_is_client AND NOT v_is_oauth AND NEW.email_confirmed_at IS NULL THEN
    RETURN NEW;
  END IF;

  -- Sinon : admin / Google / autoconfirm → compte créé immédiatement.
  IF v_is_client OR v_is_oauth THEN
    PERFORM public._create_client_and_wallet(NEW.id, NEW.raw_user_meta_data, NEW.email);
  END IF;

  RETURN NEW;
END;
$$;

-- Confirmation de l'email (NULL → non NULL) : crée le compte différé, puis
-- s'assure du mail de bienvenue. Best-effort (ne bloque jamais la vérification).
CREATE OR REPLACE FUNCTION public.enqueue_welcome_email_on_confirm()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_first TEXT;
BEGIN
  BEGIN
    -- Inscription email/mot de passe qui vient d'être vérifiée → créer le compte.
    IF (NEW.raw_user_meta_data ->> 'is_client' = 'true')
       AND (NEW.raw_app_meta_data ->> 'provider' IS DISTINCT FROM 'google') THEN
      PERFORM public._create_client_and_wallet(NEW.id, NEW.raw_user_meta_data, NEW.email);
    END IF;

    -- Filet de sécurité bienvenue (idempotent ; cas où le client préexistait).
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

NOTIFY pgrst, 'reload schema';
