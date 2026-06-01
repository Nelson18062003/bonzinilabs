-- ============================================================
-- Emails « doux » transactionnels (incrément 1)
--   #1 accusé de dépôt    (deposit_created)    — déclencheur sur deposits
--   #2 paiement en cours  (payment_processing) — notif déjà existante, on active
--   #3 mot de passe changé(password_changed)   — RPC appelée par le front
--
-- Réutilise l'outbox + drainer + cron déjà en place. Best-effort partout
-- (un échec d'enqueue n'impacte jamais l'opération métier). Comptes
-- téléphone-seul (@bonzini-client.local) → 'skipped'.
-- ============================================================

-- ── Mapping : activer ces 3 types (le cron est déjà live) ───────────────
INSERT INTO public.email_template_map (notification_type, template, enabled) VALUES
  ('deposit_created',     'deposit_created',     true),
  ('password_changed',    'password_changed',    true)
ON CONFLICT (notification_type) DO UPDATE SET enabled = EXCLUDED.enabled;

UPDATE public.email_template_map
   SET enabled = true
 WHERE notification_type = 'payment_processing';

-- ── #1 Accusé de dépôt : email quand le client soumet sa preuve ─────────
-- Déclenché à l'entrée en statut 'proof_submitted' (la « demande déposée »).
CREATE OR REPLACE FUNCTION public.enqueue_deposit_ack_email()
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
      FROM public.email_template_map WHERE notification_type = 'deposit_created';
    IF v_enabled IS NOT TRUE THEN RETURN NEW; END IF;

    SELECT email INTO v_email FROM auth.users WHERE id = NEW.user_id;

    IF v_email IS NULL OR v_email = '' OR lower(v_email) LIKE '%@bonzini-client.local' THEN
      v_status := 'skipped';
    ELSE
      v_status := 'pending';
    END IF;

    INSERT INTO public.email_outbox (
      event_type, entity_id, recipient_user_id, recipient_email,
      template, payload, status, idempotency_key
    ) VALUES (
      'deposit_created', NEW.id, NEW.user_id, v_email, 'deposit_created',
      jsonb_build_object('metadata', jsonb_build_object(
        'reference', NEW.reference, 'amount_xaf', NEW.amount_xaf)),
      v_status, 'deposit_ack:' || NEW.id::text
    )
    ON CONFLICT (idempotency_key) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'enqueue_deposit_ack_email: dépôt % : %', NEW.id, SQLERRM;
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_deposit_submitted_enqueue_email ON public.deposits;
CREATE TRIGGER on_deposit_submitted_enqueue_email
  AFTER INSERT OR UPDATE OF status ON public.deposits
  FOR EACH ROW
  WHEN (NEW.status = 'proof_submitted')
  EXECUTE FUNCTION public.enqueue_deposit_ack_email();

-- ── #3 Mot de passe changé : RPC appelée par le front après updateUser ──
CREATE OR REPLACE FUNCTION public.enqueue_password_changed_email()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid     UUID := auth.uid();
  v_email   TEXT;
  v_enabled BOOLEAN;
BEGIN
  IF v_uid IS NULL THEN RETURN; END IF;

  SELECT enabled INTO v_enabled
    FROM public.email_template_map WHERE notification_type = 'password_changed';
  IF v_enabled IS NOT TRUE THEN RETURN; END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = v_uid;
  IF v_email IS NULL OR v_email = '' OR lower(v_email) LIKE '%@bonzini-client.local' THEN
    RETURN;
  END IF;

  INSERT INTO public.email_outbox (
    event_type, recipient_user_id, recipient_email, template, payload,
    status, idempotency_key
  ) VALUES (
    'password_changed', v_uid, v_email, 'password_changed',
    jsonb_build_object('changed_at',
      to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI') || ' UTC'),
    'pending',
    -- un email par changement (dédup. si double-appel dans la même seconde)
    'pwdchanged:' || v_uid::text || ':' || to_char(now(), 'YYYYMMDDHH24MISS')
  )
  ON CONFLICT (idempotency_key) DO NOTHING;
END;
$$;

COMMENT ON FUNCTION public.enqueue_password_changed_email IS
  'Enfile l''email de sécurité « mot de passe modifié » pour l''utilisateur courant. Appelée par le front après un changement de mot de passe réussi.';

REVOKE ALL ON FUNCTION public.enqueue_password_changed_email() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.enqueue_password_changed_email() TO authenticated;

NOTIFY pgrst, 'reload schema';
