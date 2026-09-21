-- ============================================================================
-- Réception : la liste des clients, et une fiche par client
--
-- Le réceptionnaire n'avait accès à un client qu'au moment d'un dépôt. Or il
-- doit pouvoir sortir l'étiquette colis d'un client à tout moment (la
-- réimprimer, l'envoyer au client par WhatsApp / WeChat) sans ouvrir de dépôt.
--
--   reception_recent_clients : les clients récents — ceux des derniers
--     dépôts (tous réceptionnaires) puis les derniers inscrits ; identité seule.
--   reception_client : la fiche d'identité d'un client par son user_id
--     (la même carte que la recherche), pour la fiche « /r/clients/:id ».
-- Guard : canReceiveParcels. Aucun solde, aucun paiement. Idempotent.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.reception_recent_clients(p_limit INTEGER DEFAULT 30)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_uid UUID := auth.uid();
  v_rows JSONB;
BEGIN
  IF NOT public.admin_has_permission(v_uid, 'canReceiveParcels') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accès non autorisé');
  END IF;
  SELECT COALESCE(jsonb_agg(public.reception_client_card(x.user_id) ORDER BY x.last_at DESC), '[]'::jsonb) INTO v_rows
  FROM (
    SELECT c.user_id,
           GREATEST(c.created_at, COALESCE((SELECT max(d.opened_at) FROM public.parcel_deposits d WHERE d.client_user_id = c.user_id AND d.status <> 'cancelled'), c.created_at)) AS last_at
    FROM public.clients c
    WHERE c.customer_code IS NOT NULL
    ORDER BY last_at DESC
    LIMIT LEAST(GREATEST(COALESCE(p_limit, 30), 1), 100)
  ) x;
  RETURN jsonb_build_object('success', true, 'clients', v_rows);
END;
$fn$;
COMMENT ON FUNCTION public.reception_recent_clients(INTEGER) IS
  '@mola:{"expose":true,"kind":"read","permission":"canReceiveParcels","confirm":false,"danger":false,"label":"Les clients récents à la réception (identité seule)"}';

CREATE OR REPLACE FUNCTION public.reception_client(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE v_card JSONB;
BEGIN
  IF NOT public.admin_has_permission(auth.uid(), 'canReceiveParcels') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accès non autorisé');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.clients c WHERE c.user_id = p_user_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Client introuvable');
  END IF;
  v_card := public.reception_client_card(p_user_id);
  RETURN jsonb_build_object('success', true, 'client', v_card);
END;
$fn$;
COMMENT ON FUNCTION public.reception_client(UUID) IS
  '@mola:{"expose":true,"kind":"read","permission":"canReceiveParcels","confirm":false,"danger":false,"label":"La fiche d''identité d''un client pour la réception (code, nom, téléphone)","resolve":{"p_user_id":"client"}}';
