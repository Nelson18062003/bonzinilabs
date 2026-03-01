-- ============================================================
-- Sécurité RLS : restreindre l'INSERT sur les tables timeline
--
-- Avant : "WITH CHECK (true)" → n'importe quel utilisateur
--         connecté peut insérer des événements arbitraires.
--
-- Après : la policy permissive est supprimée.
--         Les fonctions SECURITY DEFINER (validate_deposit,
--         reject_deposit, create_payment, process_payment…)
--         contournent le RLS par construction (elles s'exécutent
--         avec les droits du propriétaire de la fonction = postgres).
--         Les clients/admins ne peuvent plus insérer directement.
-- ============================================================

-- ---- deposit_timeline_events --------------------------------

DROP POLICY IF EXISTS "System can insert timeline events"
  ON public.deposit_timeline_events;

DROP POLICY IF EXISTS "System can insert deposit timeline events"
  ON public.deposit_timeline_events;

-- Nouvelle policy : seuls les admins peuvent insérer manuellement
-- (les RPCs SECURITY DEFINER n'ont pas besoin de policy — elles bypass RLS)
CREATE POLICY "Admins can insert deposit timeline events"
  ON public.deposit_timeline_events
  FOR INSERT
  WITH CHECK (public.is_admin(auth.uid()));

-- ---- payment_timeline_events --------------------------------

DROP POLICY IF EXISTS "System can insert payment timeline events"
  ON public.payment_timeline_events;

DROP POLICY IF EXISTS "System can insert payment events"
  ON public.payment_timeline_events;

CREATE POLICY "Admins can insert payment timeline events"
  ON public.payment_timeline_events
  FOR INSERT
  WITH CHECK (public.is_admin(auth.uid()));

-- ---- Commentaires documentaires ----

COMMENT ON TABLE public.deposit_timeline_events IS
  'Événements de suivi des dépôts. Insertions produites uniquement par
   les RPCs SECURITY DEFINER (bypass RLS). INSERT direct restreint aux admins.';

COMMENT ON TABLE public.payment_timeline_events IS
  'Événements de suivi des paiements. Insertions produites uniquement par
   les RPCs SECURITY DEFINER (bypass RLS). INSERT direct restreint aux admins.';
