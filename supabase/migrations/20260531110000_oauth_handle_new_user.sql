-- ============================================================
-- Chantier A — Lot A2
-- Étendre handle_new_user() pour le social login Google (OAuth)
--
-- CONTEXTE (audit Phase 1) : le trigger ne crée clients+wallets que si
-- raw_user_meta_data->>'is_client' = 'true'. Un utilisateur créé via
-- signInWithOAuth(Google) ne porte PAS cette métadonnée → ni client ni
-- wallet n'étaient créés. On ajoute donc une branche OAuth.
--
-- SÉCURITÉ :
--   - L'OAuth est réservé à l'app CLIENT (Phase 0). Les admins sont créés
--     par RPC avec provider='email' et sans is_client → ils ne matchent pas.
--   - Donc provider='google' ⇒ c'est un client. Aucun risque d'escalade
--     (un user OAuth n'obtient jamais de ligne user_roles).
--   - email_verified=false (cas D) : on REFUSE de créer clients+wallets côté
--     serveur (defense-in-depth, en plus du blocage dans le callback). Ainsi,
--     même si un attaquant ignore la redirection client, aucune coquille de
--     compte n'est matérialisée pour un email Google non vérifié.
--
-- IDEMPOTENCE : ON CONFLICT (user_id) DO NOTHING sur clients ET wallets
-- (la version précédente ne l'avait que sur wallets).
--
-- GOOGLE NE FOURNIT PAS prénom/nom séparés via Supabase (full_name / name
-- uniquement) → on remplit first_name avec full_name ; l'onboarding laisse
-- l'utilisateur corriger prénom/nom + saisir phone/country (bloquants).
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_oauth   BOOLEAN := (NEW.raw_app_meta_data ->> 'provider' = 'google');
  v_is_client  BOOLEAN := (NEW.raw_user_meta_data ->> 'is_client' = 'true');
  -- Pour un signup OAuth Google, n'accepter que les emails vérifiés
  -- (defense-in-depth, miroir du cas D du callback). GoTrue place le claim
  -- dans raw_user_meta_data.email_verified.
  v_oauth_email_verified BOOLEAN := (NEW.raw_user_meta_data ->> 'email_verified' = 'true');
BEGIN
  -- Bloc OAuth : on exige un email vérifié.
  IF v_is_oauth AND NOT v_is_client AND NOT v_oauth_email_verified THEN
    RETURN NEW;  -- email Google non vérifié → aucune création (cas D, côté serveur)
  END IF;

  IF v_is_client OR v_is_oauth THEN

    -- clients : source de vérité côté métier
    INSERT INTO public.clients (user_id, first_name, last_name, phone, email, avatar_url)
    VALUES (
      NEW.id,
      COALESCE(
        NULLIF(NEW.raw_user_meta_data ->> 'first_name', ''),
        NULLIF(NEW.raw_user_meta_data ->> 'full_name', ''),
        NULLIF(NEW.raw_user_meta_data ->> 'name', ''),
        'Utilisateur'
      ),
      COALESCE(NEW.raw_user_meta_data ->> 'last_name', ''),
      NEW.raw_user_meta_data ->> 'phone',            -- NULL en OAuth → complété à l'onboarding
      NEW.email,
      COALESCE(
        NULLIF(NEW.raw_user_meta_data ->> 'avatar_url', ''),
        NULLIF(NEW.raw_user_meta_data ->> 'picture', '')
      )
    )
    ON CONFLICT (user_id) DO NOTHING;

    -- wallet à 0
    INSERT INTO public.wallets (user_id, balance_xaf)
    VALUES (NEW.id, 0)
    ON CONFLICT (user_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.handle_new_user IS
  'Crée clients+wallets pour un nouveau client (signup email OU OAuth Google). Idempotent. Les admins (provider=email, sans is_client) sont ignorés.';

NOTIFY pgrst, 'reload schema';
