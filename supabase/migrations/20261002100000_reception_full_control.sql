-- ============================================================================
-- RÉCEPTION — les bases refaites : plusieurs photos par colis, et le
-- contrôle total de l'équipe cargo sur ce qui a été reçu.
--
-- Ce que le fondateur ne pouvait pas faire depuis la console :
--   · voir PLUSIEURS photos d'un colis (une seule, `parcels.photo_path`) ;
--   · corriger un dépôt (lieu, qui l'a apporté, notes) ;
--   · supprimer un colis d'un dépôt fermé, ou en ajouter un ;
--   · supprimer (annuler) un dépôt saisi par erreur — et le rétablir ;
--   · lister les DÉPÔTS et les COLIS eux-mêmes (la page ne montrait que des
--     totaux par client).
--
-- Ce fichier :
--   1. parcel_photos (N photos par colis) ; `parcels.photo_path` reste la
--      photo de COUVERTURE, tenue à jour par un trigger — l'étiquette, Douala
--      et tous les écrans qui la lisent continuent de marcher ;
--   2. parcel_deposits : la trace d'une annulation (qui, quand, pourquoi) ;
--   3. reception_deposit_json dit les photos et l'annulation ;
--   4. helpers internes : recompter un dépôt, ajouter des photos ;
--   5. reception_add_parcel / reception_update_parcel prennent plusieurs
--      photos ; l'équipe cargo ajoute un colis à un dépôt fermé ; un colis
--      chargé en AVION ne se modifie plus (seul le conteneur était vérifié) ;
--   6. photos : ajouter, retirer, choisir la couverture ;
--   7. reception_remove_parcel : aussi sur un dépôt fermé (équipe cargo),
--      avec un motif, jamais un colis parti, jamais sur un devis réglé ;
--   8. reception_update_deposit : lieu, mode d'arrivée, apporteur, notes ;
--   9. reception_cancel_deposit / reception_restore_deposit ;
--  10. reception_board : la liste des dépôts (en stock, sur une période,
--      ou supprimés), avec leurs colis, leurs photos et leur devis ;
--  11. les garde-fous d'un dépôt supprimé : ses colis ne se chargent plus,
--      son devis ne s'envoie, ne se facture ni ne s'encaisse plus (même
--      depuis le portefeuille), quelle que soit la RPC qui essaie.
--
-- Qui : `canReceiveParcels` partout (le réceptionnaire, sur SES dépôts
-- ouverts) ; `canManageCargo` (super_admin, ops) pour tout le reste — dépôts
-- fermés, dépôts des autres, suppression. Les colis déjà partis (conteneur,
-- avion, pointés ou remis à Douala) ne se touchent jamais d'ici.
--
-- Idempotent. Suppose 20260922090000_cargo_suppliers_accounts.sql passée.
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────
-- 1. Les photos d'un colis
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.parcel_photos (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parcel_id  UUID NOT NULL REFERENCES public.parcels(id) ON DELETE CASCADE,
  -- Chemin dans le seau privé parcel-photos : « <dépôt>/<horodatage>-<hasard>.jpg ».
  path       TEXT NOT NULL,
  -- 0 = la couverture ; puis l'ordre de prise de vue.
  position   INTEGER NOT NULL DEFAULT 0,
  taken_by   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (parcel_id, path)
);
CREATE INDEX IF NOT EXISTS parcel_photos_parcel_idx ON public.parcel_photos (parcel_id, position, created_at);

ALTER TABLE public.parcel_photos ENABLE ROW LEVEL SECURITY;
-- Lecture par le staff habilité, comme les colis ; AUCUNE écriture directe.
DROP POLICY IF EXISTS parcel_photos_staff_read ON public.parcel_photos;
CREATE POLICY parcel_photos_staff_read ON public.parcel_photos FOR SELECT TO authenticated
  USING (public.admin_has_permission(auth.uid(), 'canReceiveParcels') OR public.admin_has_permission(auth.uid(), 'canViewCargo'));

-- Les photos existantes deviennent la couverture de leur colis.
INSERT INTO public.parcel_photos (parcel_id, path, position, taken_by, created_at)
SELECT p.id, p.photo_path, 0, d.received_by, p.created_at
FROM public.parcels p JOIN public.parcel_deposits d ON d.id = p.deposit_id
WHERE p.photo_path IS NOT NULL AND TRIM(p.photo_path) <> ''
ON CONFLICT (parcel_id, path) DO NOTHING;

-- La couverture (`parcels.photo_path`) suit la table : première photo par position.
CREATE OR REPLACE FUNCTION public.parcel_photos_sync_cover()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE v_parcel UUID := COALESCE(NEW.parcel_id, OLD.parcel_id);
BEGIN
  UPDATE public.parcels p
     SET photo_path = (SELECT ph.path FROM public.parcel_photos ph WHERE ph.parcel_id = v_parcel ORDER BY ph.position, ph.created_at LIMIT 1)
   WHERE p.id = v_parcel
     AND p.photo_path IS DISTINCT FROM (SELECT ph.path FROM public.parcel_photos ph WHERE ph.parcel_id = v_parcel ORDER BY ph.position, ph.created_at LIMIT 1);
  RETURN NULL;
END;
$fn$;
COMMENT ON FUNCTION public.parcel_photos_sync_cover() IS
  '@mola:{"expose":false,"kind":"write","permission":"canReceiveParcels","confirm":false,"danger":false,"label":"Tenir la photo de couverture d''un colis à jour (trigger interne)"}';
REVOKE ALL ON FUNCTION public.parcel_photos_sync_cover() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.parcel_photos_sync_cover() FROM anon, authenticated;

DROP TRIGGER IF EXISTS parcel_photos_sync_cover ON public.parcel_photos;
CREATE TRIGGER parcel_photos_sync_cover
  AFTER INSERT OR UPDATE OR DELETE ON public.parcel_photos
  FOR EACH ROW EXECUTE FUNCTION public.parcel_photos_sync_cover();

-- ─────────────────────────────────────────────────────────────────────────
-- 2. La trace d'une annulation de dépôt
-- ─────────────────────────────────────────────────────────────────────────
ALTER TABLE public.parcel_deposits
  ADD COLUMN IF NOT EXISTS cancelled_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancelled_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cancel_reason TEXT,
  -- Le plus grand numéro de colis jamais donné dans ce dépôt. Un colis supprimé
  -- ne rend pas son numéro : « RC-000123-03 » est peut-être déjà imprimé sur
  -- une étiquette collée sur un carton — le suivant sera -04, jamais -03.
  ADD COLUMN IF NOT EXISTS last_seq      INTEGER NOT NULL DEFAULT 0;

UPDATE public.parcel_deposits d
   SET last_seq = s.max_seq
  FROM (SELECT deposit_id, max(seq) AS max_seq FROM public.parcels GROUP BY deposit_id) s
 WHERE s.deposit_id = d.id AND d.last_seq < s.max_seq;

-- ─────────────────────────────────────────────────────────────────────────
-- 3. Le dépôt, tel que les écrans le lisent : avec les photos de chaque colis
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.reception_deposit_json(p_deposit_id UUID)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT jsonb_build_object(
    'id',                   d.id,
    'deposit_no',           d.deposit_no,
    'client',               public.reception_client_card(d.client_user_id),
    'location',             d.location,
    'brought_by',           d.brought_by,
    'representative_name',  d.representative_name,
    'representative_phone', d.representative_phone,
    'supplier_kind',        d.supplier_kind,
    'supplier_name',        d.supplier_name,
    'supplier_contact',     d.supplier_contact,
    'supplier_phone',       d.supplier_phone,
    'supplier_email',       d.supplier_email,
    'supplier_wechat',      d.supplier_wechat,
    'supplier_address',     d.supplier_address,
    'status',               d.status,
    'received_by',          d.received_by,
    'received_by_name',     (SELECT TRIM(COALESCE(ur.first_name,'') || ' ' || COALESCE(ur.last_name,'')) FROM public.user_roles ur WHERE ur.user_id = d.received_by),
    'opened_at',            d.opened_at,
    'closed_at',            d.closed_at,
    'updated_at',           d.updated_at,
    'cancelled_at',         d.cancelled_at,
    'cancel_reason',        d.cancel_reason,
    'cancelled_by_name',    (SELECT TRIM(COALESCE(ur.first_name,'') || ' ' || COALESCE(ur.last_name,'')) FROM public.user_roles ur WHERE ur.user_id = d.cancelled_by),
    'parcel_count',         (SELECT count(*) FROM public.parcels p WHERE p.deposit_id = d.id),
    'total_weight_kg',      (SELECT COALESCE(sum(p.weight_kg), 0) FROM public.parcels p WHERE p.deposit_id = d.id),
    'total_cbm',            (SELECT COALESCE(sum(p.cbm), 0) FROM public.parcels p WHERE p.deposit_id = d.id),
    'notes',                d.notes,
    'parcels',              COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', p.id, 'seq', p.seq, 'parcel_no', p.parcel_no, 'kind', p.kind,
        'weight_kg', p.weight_kg, 'length_cm', p.length_cm, 'width_cm', p.width_cm, 'height_cm', p.height_cm,
        'cbm', p.cbm, 'description', p.description, 'courier_waybill', p.courier_waybill,
        'photo_path', p.photo_path,
        'photos', COALESCE((
          SELECT jsonb_agg(jsonb_build_object('id', ph.id, 'path', ph.path, 'position', ph.position, 'created_at', ph.created_at)
                           ORDER BY ph.position, ph.created_at)
          FROM public.parcel_photos ph WHERE ph.parcel_id = p.id), '[]'::jsonb),
        'status', p.status, 'shipment_id', p.shipment_id,
        'container_number', (SELECT cs.container_number FROM public.cargo_shipments cs WHERE cs.id = p.shipment_id),
        'air_shipment_id', p.air_shipment_id,
        'awb_number', (SELECT a.awb_number FROM public.air_shipments a WHERE a.id = p.air_shipment_id),
        'checked_in_at', p.checked_in_at, 'warehouse_location', p.warehouse_location, 'condition', p.condition, 'condition_note', p.condition_note,
        'delivered_at', p.delivered_at, 'release_id', p.release_id,
        'release_no', (SELECT r.release_no FROM public.parcel_releases r WHERE r.id = p.release_id),
        'created_at', p.created_at, 'updated_at', p.updated_at
      ) ORDER BY p.seq)
      FROM public.parcels p WHERE p.deposit_id = d.id), '[]'::jsonb)
  )
  FROM public.parcel_deposits d
  WHERE d.id = p_deposit_id;
$fn$;
COMMENT ON FUNCTION public.reception_deposit_json(UUID) IS
  '@mola:{"expose":false,"kind":"read","permission":"canReceiveParcels","confirm":false,"danger":false,"label":"Sérialiser un dépôt de colis, avec ses photos (helper interne)"}';
REVOKE ALL ON FUNCTION public.reception_deposit_json(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.reception_deposit_json(UUID) FROM anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 4. Helpers internes
-- ─────────────────────────────────────────────────────────────────────────

-- Les totaux d'un dépôt, recalculés depuis ses colis (à appeler après toute
-- correction d'un dépôt fermé : ils sont lus par le Cargo et les devis).
CREATE OR REPLACE FUNCTION public.reception_recount_deposit(p_deposit_id UUID)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $fn$
  UPDATE public.parcel_deposits d
     SET parcel_count    = s.n,
         total_weight_kg = s.kg,
         total_cbm       = s.cbm,
         updated_at      = now()
    FROM (SELECT count(*) AS n, COALESCE(sum(weight_kg), 0) AS kg, COALESCE(sum(cbm), 0) AS cbm
            FROM public.parcels WHERE deposit_id = p_deposit_id) s
   WHERE d.id = p_deposit_id;
$fn$;
COMMENT ON FUNCTION public.reception_recount_deposit(UUID) IS
  '@mola:{"expose":false,"kind":"write","permission":"canReceiveParcels","confirm":false,"danger":false,"label":"Recalculer les totaux d''un dépôt de colis (helper interne)"}';
REVOKE ALL ON FUNCTION public.reception_recount_deposit(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.reception_recount_deposit(UUID) FROM anon, authenticated;

-- Ajouter des photos à un colis. Un chemin n'est accepté que s'il est rangé
-- sous le dossier du dépôt (« <dépôt>/… ») : on ne rattache pas la photo d'un
-- autre dépôt. Vingt photos au plus par colis. `p_cover` : la première photo
-- ajoutée passe en couverture (le geste « reprendre la photo »).
-- Renvoie un message d'erreur, ou NULL si tout va bien.
CREATE OR REPLACE FUNCTION public.reception_attach_photos(p_parcel_id UUID, p_paths TEXT[], p_uid UUID, p_cover BOOLEAN DEFAULT false)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_dep_id UUID;
  v_paths  TEXT[];
  v_path   TEXT;
  v_pos    INTEGER;
  v_count  INTEGER;
  v_first  BOOLEAN := true;
BEGIN
  SELECT deposit_id INTO v_dep_id FROM public.parcels WHERE id = p_parcel_id;
  IF v_dep_id IS NULL THEN RETURN 'Colis introuvable'; END IF;
  -- Les chemins vides et les doublons tombent ; l'ordre de prise de vue reste.
  SELECT COALESCE(array_agg(s.clean ORDER BY s.ord), '{}') INTO v_paths
  FROM (SELECT DISTINCT ON (TRIM(u.raw)) TRIM(u.raw) AS clean, u.ord
          FROM unnest(COALESCE(p_paths, '{}'::TEXT[])) WITH ORDINALITY AS u(raw, ord)
         WHERE u.raw IS NOT NULL AND TRIM(u.raw) <> ''
         ORDER BY TRIM(u.raw), u.ord) s;
  IF cardinality(v_paths) = 0 THEN RETURN NULL; END IF;

  FOREACH v_path IN ARRAY v_paths LOOP
    -- « <dépôt>/<nom>.jpg », rien d'autre : ni sous-dossier, ni « .. », ni le dossier d'un autre dépôt.
    IF v_path !~ ('^' || v_dep_id::text || '/[A-Za-z0-9._-]+$') OR v_path LIKE '%..%' THEN
      RETURN 'Photo refusée : elle n''appartient pas à ce dépôt';
    END IF;
    -- Le fichier doit avoir été envoyé dans le seau : on ne rattache pas un chemin inventé.
    IF NOT EXISTS (SELECT 1 FROM storage.objects o WHERE o.bucket_id = 'parcel-photos' AND o.name = v_path) THEN
      RETURN 'Photo introuvable dans le stockage : renvoyez-la';
    END IF;
  END LOOP;

  SELECT count(*) INTO v_count FROM public.parcel_photos WHERE parcel_id = p_parcel_id AND NOT (path = ANY (v_paths));
  IF v_count + cardinality(v_paths) > 20 THEN
    RETURN 'Vingt photos au plus par colis';
  END IF;

  FOREACH v_path IN ARRAY v_paths LOOP
    IF p_cover AND v_first THEN
      UPDATE public.parcel_photos SET position = position + 1 WHERE parcel_id = p_parcel_id;
      v_pos := 0;
    ELSE
      SELECT COALESCE(max(position), -1) + 1 INTO v_pos FROM public.parcel_photos WHERE parcel_id = p_parcel_id;
    END IF;
    INSERT INTO public.parcel_photos (parcel_id, path, position, taken_by)
    VALUES (p_parcel_id, v_path, v_pos, p_uid)
    ON CONFLICT (parcel_id, path) DO NOTHING;
    v_first := false;
  END LOOP;
  RETURN NULL;
END;
$fn$;
COMMENT ON FUNCTION public.reception_attach_photos(UUID, TEXT[], UUID, BOOLEAN) IS
  '@mola:{"expose":false,"kind":"write","permission":"canReceiveParcels","confirm":false,"danger":false,"label":"Rattacher des photos à un colis (helper interne)"}';
REVOKE ALL ON FUNCTION public.reception_attach_photos(UUID, TEXT[], UUID, BOOLEAN) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.reception_attach_photos(UUID, TEXT[], UUID, BOOLEAN) FROM anon, authenticated;

-- Un devis que l'argent ou le client a déjà vu : envoyé, encaissé (même un
-- encaissement annulé laisse un reçu), réglé ou facturé. Renvoie la raison,
-- ou NULL. Un devis jamais envoyé ni encaissé reste un simple brouillon.
CREATE OR REPLACE FUNCTION public.reception_quote_engaged(p_deposit_id UUID)
RETURNS TEXT
LANGUAGE sql
STABLE
SET search_path = public
AS $fn$
  SELECT CASE
    WHEN q.id IS NULL THEN NULL
    WHEN q.invoice_no IS NOT NULL OR q.status = 'invoiced' THEN 'La facture ' || COALESCE(q.invoice_no, '') || ' est établie'
    WHEN q.status = 'paid' THEN 'Le devis ' || q.quote_no || ' est réglé'
    WHEN q.amount_paid_xaf > 0 THEN 'Le devis ' || q.quote_no || ' a déjà reçu des encaissements'
    WHEN EXISTS (SELECT 1 FROM public.parcel_quote_payments pm WHERE pm.quote_id = q.id) THEN 'Le devis ' || q.quote_no || ' porte des reçus (même annulés)'
    WHEN q.sent_at IS NOT NULL THEN 'Le devis ' || q.quote_no || ' a déjà été envoyé au client'
    ELSE NULL
  END
  FROM (SELECT 1) one LEFT JOIN public.parcel_quotes q ON q.deposit_id = p_deposit_id;
$fn$;
COMMENT ON FUNCTION public.reception_quote_engaged(UUID) IS
  '@mola:{"expose":false,"kind":"read","permission":"canReceiveParcels","confirm":false,"danger":false,"label":"Dire si le devis d''un dépôt est déjà engagé (helper interne)"}';
REVOKE ALL ON FUNCTION public.reception_quote_engaged(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.reception_quote_engaged(UUID) FROM anon, authenticated;

-- Un colis encore modifiable d'ici ? Ni chargé (conteneur ou avion), ni
-- pointé, ni remis à Douala. Renvoie la raison du refus, ou NULL.
CREATE OR REPLACE FUNCTION public.reception_parcel_locked(p public.parcels)
RETURNS TEXT
LANGUAGE sql
STABLE
SET search_path = public
AS $fn$
  SELECT CASE
    WHEN p.delivered_at IS NOT NULL OR p.release_id IS NOT NULL THEN 'Ce colis a été remis au client'
    WHEN p.checked_in_at IS NOT NULL THEN 'Ce colis est déjà arrivé à Douala'
    WHEN p.shipment_id IS NOT NULL THEN 'Ce colis est chargé dans un conteneur : retirez-le d''abord de la boîte'
    WHEN p.air_shipment_id IS NOT NULL THEN 'Ce colis est chargé dans une expédition aérienne : retirez-le d''abord de la LTA'
    ELSE NULL
  END;
$fn$;
COMMENT ON FUNCTION public.reception_parcel_locked(public.parcels) IS
  '@mola:{"expose":false,"kind":"read","permission":"canReceiveParcels","confirm":false,"danger":false,"label":"Dire pourquoi un colis ne se modifie plus (helper interne)"}';
REVOKE ALL ON FUNCTION public.reception_parcel_locked(public.parcels) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.reception_parcel_locked(public.parcels) FROM anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 5. Ajouter un colis (plusieurs photos ; l'équipe cargo complète un dépôt
--    fermé), corriger un colis (plusieurs photos ; jamais un colis parti)
-- ─────────────────────────────────────────────────────────────────────────
-- Une seule signature par RPC : l'ancienne est retirée (deux surcharges
-- rendraient l'appel PostgREST ambigu).
DROP FUNCTION IF EXISTS public.reception_add_parcel(UUID, TEXT, NUMERIC, NUMERIC, NUMERIC, NUMERIC, TEXT, TEXT, TEXT, INTEGER);

CREATE OR REPLACE FUNCTION public.reception_add_parcel(
  p_deposit_id UUID,
  p_kind TEXT DEFAULT 'carton',
  p_weight_kg NUMERIC DEFAULT NULL,
  p_length_cm NUMERIC DEFAULT NULL,
  p_width_cm NUMERIC DEFAULT NULL,
  p_height_cm NUMERIC DEFAULT NULL,
  p_description TEXT DEFAULT NULL,
  p_courier_waybill TEXT DEFAULT NULL,
  p_photo_path TEXT DEFAULT NULL,
  p_copies INTEGER DEFAULT 1,
  p_photo_paths TEXT[] DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_uid   UUID := auth.uid();
  v_dep   public.parcel_deposits;
  v_quote public.parcel_quotes;
  v_seq   INTEGER;
  v_i     INTEGER;
  v_id    UUID;
  v_err   TEXT;
  v_paths TEXT[] := array_remove(array_prepend(NULLIF(TRIM(p_photo_path), ''), COALESCE(p_photo_paths, '{}'::TEXT[])), NULL);
BEGIN
  IF NOT public.admin_has_permission(v_uid, 'canReceiveParcels') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accès non autorisé');
  END IF;
  SELECT * INTO v_dep FROM public.parcel_deposits WHERE id = p_deposit_id FOR UPDATE;
  IF v_dep.id IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Dépôt introuvable'); END IF;
  -- Ouvert : son réceptionnaire ou l'équipe cargo. Fermé : l'équipe cargo seule.
  IF NOT (public.reception_can_edit(v_dep, v_uid)
          OR (v_dep.status = 'closed' AND public.admin_has_permission(v_uid, 'canManageCargo'))) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ce dépôt est fermé ou ne vous appartient pas');
  END IF;
  SELECT * INTO v_quote FROM public.parcel_quotes WHERE deposit_id = v_dep.id;
  IF v_dep.status = 'closed' AND v_quote.status IN ('paid','invoiced') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Le devis de ce dépôt est réglé : ouvrez un nouveau dépôt pour ce colis');
  END IF;
  IF p_kind NOT IN ('carton','bag','bale','roll','pallet','other') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Type de colis inconnu');
  END IF;
  IF p_copies IS NULL OR p_copies < 1 OR p_copies > 200 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Nombre de colis invalide (1 à 200)');
  END IF;
  IF COALESCE(p_weight_kg, 0) < 0 OR COALESCE(p_length_cm, 0) < 0 OR COALESCE(p_width_cm, 0) < 0 OR COALESCE(p_height_cm, 0) < 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Poids et dimensions doivent être positifs');
  END IF;

  SELECT GREATEST(COALESCE(max(seq), 0), v_dep.last_seq) INTO v_seq FROM public.parcels WHERE deposit_id = v_dep.id;
  FOR v_i IN 1..p_copies LOOP
    v_seq := v_seq + 1;
    INSERT INTO public.parcels (deposit_id, seq, parcel_no, kind, weight_kg, length_cm, width_cm, height_cm, description, courier_waybill)
    VALUES (v_dep.id, v_seq, v_dep.deposit_no || '-' || lpad(v_seq::text, 2, '0'), p_kind,
            p_weight_kg, p_length_cm, p_width_cm, p_height_cm,
            NULLIF(TRIM(p_description), ''), NULLIF(TRIM(p_courier_waybill), ''))
    RETURNING id INTO v_id;
    -- Des cartons identiques partagent les mêmes photos (le même geste de prise de vue).
    v_err := public.reception_attach_photos(v_id, v_paths, v_uid, false);
    IF v_err IS NOT NULL THEN RAISE EXCEPTION USING MESSAGE = v_err, ERRCODE = 'P0001'; END IF;
  END LOOP;
  UPDATE public.parcel_deposits SET last_seq = v_seq WHERE id = v_dep.id;

  IF v_dep.status = 'closed' THEN
    PERFORM public.reception_recount_deposit(v_dep.id);
    INSERT INTO public.admin_audit_logs (admin_user_id, action_type, target_type, target_id, details)
    VALUES (v_uid, 'add_parcel_after_close', 'parcel_deposit', v_dep.id,
            jsonb_build_object('description', p_copies || ' colis ajouté(s) au dépôt ' || v_dep.deposit_no || ' après sa fermeture',
                               'deposit_no', v_dep.deposit_no, 'copies', p_copies, 'weight_kg', p_weight_kg, 'description_colis', NULLIF(TRIM(p_description), '')));
  ELSE
    UPDATE public.parcel_deposits SET updated_at = now() WHERE id = v_dep.id;
  END IF;

  RETURN jsonb_build_object('success', true, 'deposit', public.reception_deposit_json(v_dep.id));
EXCEPTION WHEN SQLSTATE 'P0001' THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$fn$;
COMMENT ON FUNCTION public.reception_add_parcel(UUID, TEXT, NUMERIC, NUMERIC, NUMERIC, NUMERIC, TEXT, TEXT, TEXT, INTEGER, TEXT[]) IS
  '@mola:{"expose":true,"kind":"write","permission":"canReceiveParcels","confirm":true,"danger":false,"label":"Ajouter un colis (poids, dimensions, description, photos) à un dépôt","resolve":{"p_deposit_id":"deposit"}}';

DROP FUNCTION IF EXISTS public.reception_update_parcel(UUID, TEXT, NUMERIC, NUMERIC, NUMERIC, NUMERIC, TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.reception_update_parcel(
  p_parcel_id UUID,
  p_kind TEXT DEFAULT NULL,
  p_weight_kg NUMERIC DEFAULT NULL,
  p_length_cm NUMERIC DEFAULT NULL,
  p_width_cm NUMERIC DEFAULT NULL,
  p_height_cm NUMERIC DEFAULT NULL,
  p_description TEXT DEFAULT NULL,
  p_courier_waybill TEXT DEFAULT NULL,
  p_photo_path TEXT DEFAULT NULL,
  p_photo_paths TEXT[] DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_uid    UUID := auth.uid();
  v_dep    public.parcel_deposits;
  v_par    public.parcels;
  v_locked TEXT;
  v_err    TEXT;
BEGIN
  IF NOT public.admin_has_permission(v_uid, 'canReceiveParcels') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accès non autorisé');
  END IF;
  SELECT * INTO v_par FROM public.parcels WHERE id = p_parcel_id;
  IF v_par.id IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Colis introuvable'); END IF;
  -- Verrou du dépôt AVANT de relire le colis : deux corrections simultanées ne se croisent pas.
  SELECT * INTO v_dep FROM public.parcel_deposits WHERE id = v_par.deposit_id FOR UPDATE;
  SELECT * INTO v_par FROM public.parcels WHERE id = p_parcel_id FOR UPDATE;
  -- Qui : l'auteur du dépôt, ou le cargo. Sur quelle ligne : un colis pas encore parti.
  IF NOT (v_dep.received_by = v_uid OR public.admin_has_permission(v_uid, 'canManageCargo')) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ce dépôt ne vous appartient pas');
  END IF;
  IF v_dep.status = 'cancelled' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ce dépôt est supprimé');
  END IF;
  v_locked := public.reception_parcel_locked(v_par);
  IF v_locked IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', v_locked);
  END IF;
  -- Le devis est parti chez le client (ou payé) : le réceptionnaire ne repèse plus ; l'équipe cargo corrige, journalisé.
  IF v_dep.status = 'closed' AND NOT public.admin_has_permission(v_uid, 'canManageCargo') THEN
    v_locked := public.reception_quote_engaged(v_dep.id);
    IF v_locked IS NOT NULL THEN
      RETURN jsonb_build_object('success', false, 'error', v_locked || ' : demandez à l''équipe cargo de corriger ce colis');
    END IF;
  END IF;
  IF p_kind IS NOT NULL AND p_kind NOT IN ('carton','bag','bale','roll','pallet','other') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Type de colis inconnu');
  END IF;
  IF COALESCE(p_weight_kg, 0) < 0 OR COALESCE(p_length_cm, 0) < 0 OR COALESCE(p_width_cm, 0) < 0 OR COALESCE(p_height_cm, 0) < 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Poids et dimensions doivent être positifs');
  END IF;

  UPDATE public.parcels
     SET kind            = COALESCE(p_kind, kind),
         weight_kg       = p_weight_kg,
         length_cm       = p_length_cm,
         width_cm        = p_width_cm,
         height_cm       = p_height_cm,
         description     = NULLIF(TRIM(COALESCE(p_description, '')), ''),
         courier_waybill = NULLIF(TRIM(COALESCE(p_courier_waybill, '')), ''),
         updated_at      = now()
   WHERE id = v_par.id;

  -- `p_photo_path` (une photo reprise, ancien geste) passe en couverture ;
  -- `p_photo_paths` s'ajoutent derrière. Aucune photo n'est perdue.
  v_err := public.reception_attach_photos(v_par.id, ARRAY[NULLIF(TRIM(p_photo_path), '')], v_uid, true);
  IF v_err IS NULL THEN v_err := public.reception_attach_photos(v_par.id, p_photo_paths, v_uid, false); END IF;
  IF v_err IS NOT NULL THEN RAISE EXCEPTION USING MESSAGE = v_err, ERRCODE = 'P0001'; END IF;

  IF v_dep.status = 'closed' OR v_dep.received_by <> v_uid THEN
    -- Les totaux figés à la fermeture suivent la correction, et on garde une trace.
    IF v_dep.status = 'closed' THEN PERFORM public.reception_recount_deposit(v_dep.id); END IF;
    INSERT INTO public.admin_audit_logs (admin_user_id, action_type, target_type, target_id, details)
    VALUES (v_uid, 'update_parcel', 'parcel_deposit', v_dep.id,
            jsonb_build_object('description', 'Colis ' || v_par.parcel_no || ' corrigé', 'parcel_id', v_par.id, 'parcel_no', v_par.parcel_no,
                               'before', jsonb_build_object('kind', v_par.kind, 'weight_kg', v_par.weight_kg, 'length_cm', v_par.length_cm, 'width_cm', v_par.width_cm, 'height_cm', v_par.height_cm, 'description', v_par.description, 'courier_waybill', v_par.courier_waybill),
                               'after', jsonb_build_object('kind', COALESCE(p_kind, v_par.kind), 'weight_kg', p_weight_kg, 'length_cm', p_length_cm, 'width_cm', p_width_cm, 'height_cm', p_height_cm, 'description', NULLIF(TRIM(COALESCE(p_description, '')), ''), 'courier_waybill', NULLIF(TRIM(COALESCE(p_courier_waybill, '')), ''))));
  END IF;
  IF v_dep.status <> 'closed' THEN
    UPDATE public.parcel_deposits SET updated_at = now() WHERE id = v_dep.id;
  END IF;

  RETURN jsonb_build_object('success', true, 'deposit', public.reception_deposit_json(v_dep.id));
EXCEPTION WHEN SQLSTATE 'P0001' THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$fn$;
COMMENT ON FUNCTION public.reception_update_parcel(UUID, TEXT, NUMERIC, NUMERIC, NUMERIC, NUMERIC, TEXT, TEXT, TEXT, TEXT[]) IS
  '@mola:{"expose":true,"kind":"write","permission":"canReceiveParcels","confirm":true,"danger":false,"label":"Corriger ou compléter un colis reçu (poids, dimensions, description, photos)"}';

-- ─────────────────────────────────────────────────────────────────────────
-- 6. Les photos : ajouter, retirer, choisir la couverture
-- ─────────────────────────────────────────────────────────────────────────

-- Qui touche aux photos d'un colis : l'auteur du dépôt (ouvert ou fermé — une
-- photo de plus ne fausse rien), ou l'équipe cargo. Jamais un dépôt supprimé.
CREATE OR REPLACE FUNCTION public.reception_add_parcel_photos(p_parcel_id UUID, p_paths TEXT[])
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_uid UUID := auth.uid();
  v_par public.parcels;
  v_dep public.parcel_deposits;
  v_err TEXT;
BEGIN
  IF NOT public.admin_has_permission(v_uid, 'canReceiveParcels') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accès non autorisé');
  END IF;
  SELECT * INTO v_par FROM public.parcels WHERE id = p_parcel_id;
  IF v_par.id IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Colis introuvable'); END IF;
  SELECT * INTO v_dep FROM public.parcel_deposits WHERE id = v_par.deposit_id FOR UPDATE;
  IF NOT (v_dep.received_by = v_uid OR public.admin_has_permission(v_uid, 'canManageCargo')) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ce dépôt ne vous appartient pas');
  END IF;
  IF v_dep.status = 'cancelled' THEN RETURN jsonb_build_object('success', false, 'error', 'Ce dépôt est supprimé'); END IF;
  IF COALESCE(cardinality(p_paths), 0) = 0 THEN RETURN jsonb_build_object('success', false, 'error', 'Aucune photo à ajouter'); END IF;

  v_err := public.reception_attach_photos(v_par.id, p_paths, v_uid, false);
  IF v_err IS NOT NULL THEN RETURN jsonb_build_object('success', false, 'error', v_err); END IF;
  UPDATE public.parcels SET updated_at = now() WHERE id = v_par.id;
  RETURN jsonb_build_object('success', true, 'deposit', public.reception_deposit_json(v_dep.id));
END;
$fn$;
COMMENT ON FUNCTION public.reception_add_parcel_photos(UUID, TEXT[]) IS
  '@mola:{"expose":false,"kind":"write","permission":"canReceiveParcels","confirm":false,"danger":false,"label":"Ajouter des photos à un colis (les fichiers sont envoyés par l''app)"}';

CREATE OR REPLACE FUNCTION public.reception_remove_parcel_photo(p_photo_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_uid UUID := auth.uid();
  v_ph  public.parcel_photos;
  v_par public.parcels;
  v_dep public.parcel_deposits;
BEGIN
  IF NOT public.admin_has_permission(v_uid, 'canReceiveParcels') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accès non autorisé');
  END IF;
  SELECT * INTO v_ph FROM public.parcel_photos WHERE id = p_photo_id;
  IF v_ph.id IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Photo introuvable'); END IF;
  SELECT * INTO v_par FROM public.parcels WHERE id = v_ph.parcel_id;
  SELECT * INTO v_dep FROM public.parcel_deposits WHERE id = v_par.deposit_id FOR UPDATE;
  -- Retirer une preuve : le réceptionnaire tant que SON dépôt est ouvert ; ensuite, l'équipe cargo seule.
  IF NOT (public.reception_can_edit(v_dep, v_uid) OR public.admin_has_permission(v_uid, 'canManageCargo')) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Seule l''équipe cargo retire une photo d''un dépôt fermé');
  END IF;
  IF v_dep.status = 'cancelled' THEN RETURN jsonb_build_object('success', false, 'error', 'Ce dépôt est supprimé'); END IF;
  -- Une photo d'un colis parti, pointé ou remis est une preuve : elle reste.
  IF public.reception_parcel_locked(v_par) IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ce colis est déjà parti : ses photos sont une preuve, elles restent');
  END IF;

  DELETE FROM public.parcel_photos WHERE id = v_ph.id;
  -- Les positions restent compactes : la suivante devient la couverture.
  UPDATE public.parcel_photos ph SET position = r.rn - 1
    FROM (SELECT id, row_number() OVER (ORDER BY position, created_at) AS rn FROM public.parcel_photos WHERE parcel_id = v_par.id) r
   WHERE ph.id = r.id AND ph.position <> r.rn - 1;
  UPDATE public.parcels SET updated_at = now() WHERE id = v_par.id;

  INSERT INTO public.admin_audit_logs (admin_user_id, action_type, target_type, target_id, details)
  VALUES (v_uid, 'remove_parcel_photo', 'parcel_deposit', v_dep.id,
          jsonb_build_object('description', 'Photo retirée du colis ' || v_par.parcel_no, 'parcel_id', v_par.id, 'path', v_ph.path));
  RETURN jsonb_build_object('success', true, 'deposit', public.reception_deposit_json(v_dep.id));
END;
$fn$;
COMMENT ON FUNCTION public.reception_remove_parcel_photo(UUID) IS
  '@mola:{"expose":false,"kind":"write","permission":"canReceiveParcels","confirm":true,"danger":false,"label":"Retirer une photo d''un colis"}';

CREATE OR REPLACE FUNCTION public.reception_set_parcel_cover(p_photo_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_uid UUID := auth.uid();
  v_ph  public.parcel_photos;
  v_par public.parcels;
  v_dep public.parcel_deposits;
BEGIN
  IF NOT public.admin_has_permission(v_uid, 'canReceiveParcels') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accès non autorisé');
  END IF;
  SELECT * INTO v_ph FROM public.parcel_photos WHERE id = p_photo_id;
  IF v_ph.id IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Photo introuvable'); END IF;
  SELECT * INTO v_par FROM public.parcels WHERE id = v_ph.parcel_id;
  SELECT * INTO v_dep FROM public.parcel_deposits WHERE id = v_par.deposit_id FOR UPDATE;
  IF NOT (v_dep.received_by = v_uid OR public.admin_has_permission(v_uid, 'canManageCargo')) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ce dépôt ne vous appartient pas');
  END IF;
  IF v_dep.status = 'cancelled' THEN RETURN jsonb_build_object('success', false, 'error', 'Ce dépôt est supprimé'); END IF;

  -- La photo choisie passe en tête ; les autres gardent leur ordre derrière elle.
  UPDATE public.parcel_photos ph SET position = r.rn
    FROM (SELECT id, row_number() OVER (ORDER BY position, created_at) AS rn FROM public.parcel_photos WHERE parcel_id = v_par.id AND id <> v_ph.id) r
   WHERE ph.id = r.id;
  UPDATE public.parcel_photos SET position = 0 WHERE id = v_ph.id;
  RETURN jsonb_build_object('success', true, 'deposit', public.reception_deposit_json(v_dep.id));
END;
$fn$;
COMMENT ON FUNCTION public.reception_set_parcel_cover(UUID) IS
  '@mola:{"expose":false,"kind":"write","permission":"canReceiveParcels","confirm":false,"danger":false,"label":"Choisir la photo de couverture d''un colis"}';

-- ─────────────────────────────────────────────────────────────────────────
-- 7. Supprimer un colis — dépôt ouvert (son réceptionnaire) ou fermé
--    (l'équipe cargo, avec un motif). Jamais un colis parti, jamais sur un
--    devis réglé ; la ligne de devis du colis part avec lui.
-- ─────────────────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.reception_remove_parcel(UUID);

CREATE OR REPLACE FUNCTION public.reception_remove_parcel(p_parcel_id UUID, p_reason TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_uid    UUID := auth.uid();
  v_dep    public.parcel_deposits;
  v_par    public.parcels;
  v_quote  public.parcel_quotes;
  v_locked TEXT;
  v_left   INTEGER;
  v_reason TEXT := NULLIF(TRIM(p_reason), '');
BEGIN
  IF NOT public.admin_has_permission(v_uid, 'canReceiveParcels') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accès non autorisé');
  END IF;
  SELECT * INTO v_par FROM public.parcels WHERE id = p_parcel_id;
  IF v_par.id IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Colis introuvable'); END IF;
  SELECT * INTO v_dep FROM public.parcel_deposits WHERE id = v_par.deposit_id FOR UPDATE;
  SELECT * INTO v_par FROM public.parcels WHERE id = p_parcel_id FOR UPDATE;
  IF NOT (public.reception_can_edit(v_dep, v_uid)
          OR (v_dep.status = 'closed' AND public.admin_has_permission(v_uid, 'canManageCargo'))) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ce dépôt est fermé ou ne vous appartient pas');
  END IF;
  v_locked := public.reception_parcel_locked(v_par);
  IF v_locked IS NOT NULL THEN RETURN jsonb_build_object('success', false, 'error', v_locked); END IF;

  SELECT * INTO v_quote FROM public.parcel_quotes WHERE deposit_id = v_dep.id FOR UPDATE;
  -- Un encaissement (même partiel) : retirer la ligne ferait un trop-perçu sans remboursement.
  IF v_quote.id IS NOT NULL AND (v_quote.status IN ('paid','invoiced') OR v_quote.invoice_no IS NOT NULL OR v_quote.amount_paid_xaf > 0) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Le devis ' || v_quote.quote_no || ' a déjà reçu des encaissements : le colis ne se supprime plus');
  END IF;

  IF v_dep.status = 'closed' THEN
    IF v_reason IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Indiquez pourquoi ce colis est supprimé');
    END IF;
    SELECT count(*) INTO v_left FROM public.parcels WHERE deposit_id = v_dep.id AND id <> v_par.id;
    IF v_left = 0 THEN
      RETURN jsonb_build_object('success', false, 'error', 'C''est le dernier colis du dépôt : supprimez plutôt le dépôt');
    END IF;
  END IF;

  -- La ligne de devis du colis part avec lui ; le total suit.
  IF v_quote.id IS NOT NULL THEN
    DELETE FROM public.parcel_quote_lines WHERE quote_id = v_quote.id AND parcel_id = v_par.id;
    PERFORM public.cargo_quote_recompute(v_quote.id);
  END IF;

  DELETE FROM public.parcels WHERE id = v_par.id;

  IF v_dep.status = 'closed' THEN
    PERFORM public.reception_recount_deposit(v_dep.id);
  ELSE
    UPDATE public.parcel_deposits SET updated_at = now() WHERE id = v_dep.id;
  END IF;
  IF v_dep.status = 'closed' OR v_dep.received_by <> v_uid THEN
    INSERT INTO public.admin_audit_logs (admin_user_id, action_type, target_type, target_id, details)
    VALUES (v_uid, 'remove_parcel', 'parcel_deposit', v_dep.id,
            jsonb_build_object('description', 'Colis ' || v_par.parcel_no || ' supprimé' || COALESCE(' : ' || v_reason, ''),
                               'deposit_no', v_dep.deposit_no, 'reason', v_reason,
                               'parcel', jsonb_build_object('id', v_par.id, 'parcel_no', v_par.parcel_no, 'kind', v_par.kind, 'weight_kg', v_par.weight_kg,
                                                            'length_cm', v_par.length_cm, 'width_cm', v_par.width_cm, 'height_cm', v_par.height_cm,
                                                            'description', v_par.description, 'courier_waybill', v_par.courier_waybill, 'photo_path', v_par.photo_path)));
  END IF;
  RETURN jsonb_build_object('success', true, 'deposit', public.reception_deposit_json(v_dep.id));
END;
$fn$;
COMMENT ON FUNCTION public.reception_remove_parcel(UUID, TEXT) IS
  '@mola:{"expose":true,"kind":"write","permission":"canReceiveParcels","confirm":true,"danger":true,"label":"Supprimer un colis d''un dépôt (motif obligatoire si le dépôt est fermé)"}';

-- ─────────────────────────────────────────────────────────────────────────
-- 8. Corriger un dépôt : lieu, mode d'arrivée, apporteur, notes
--    (le client : reception_assign_client ; le fournisseur : reception_set_supplier)
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.reception_update_deposit(
  p_deposit_id UUID,
  p_location TEXT DEFAULT NULL,
  p_brought_by TEXT DEFAULT NULL,
  p_representative_name TEXT DEFAULT NULL,
  p_representative_phone TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_uid   UUID := auth.uid();
  v_dep   public.parcel_deposits;
  v_quote public.parcel_quotes;
  v_loc   TEXT;
  v_by    TEXT;
  v_after public.parcel_deposits;
  v_draft BOOLEAN := false;
  v_why   TEXT;
BEGIN
  IF NOT public.admin_has_permission(v_uid, 'canReceiveParcels') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accès non autorisé');
  END IF;
  SELECT * INTO v_dep FROM public.parcel_deposits WHERE id = p_deposit_id FOR UPDATE;
  IF v_dep.id IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Dépôt introuvable'); END IF;
  IF v_dep.status = 'cancelled' THEN RETURN jsonb_build_object('success', false, 'error', 'Ce dépôt est supprimé'); END IF;
  IF NOT (public.reception_can_edit(v_dep, v_uid) OR public.admin_has_permission(v_uid, 'canManageCargo')) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ce dépôt est fermé ou ne vous appartient pas');
  END IF;

  v_loc := COALESCE(p_location, v_dep.location);
  v_by  := COALESCE(p_brought_by, v_dep.brought_by);
  IF v_loc NOT IN ('warehouse','office') THEN RETURN jsonb_build_object('success', false, 'error', 'Lieu inconnu'); END IF;
  IF v_by NOT IN ('courier','client','representative','pickup') THEN RETURN jsonb_build_object('success', false, 'error', 'Mode d''arrivée inconnu'); END IF;

  -- Changer de lieu, c'est changer de mode (Sea ↔ Air) : jamais avec des colis déjà partis ni un devis réglé.
  IF v_loc <> v_dep.location THEN
    PERFORM 1 FROM public.parcels WHERE deposit_id = v_dep.id FOR UPDATE;
    IF EXISTS (SELECT 1 FROM public.parcels p WHERE p.deposit_id = v_dep.id AND public.reception_parcel_locked(p) IS NOT NULL) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Des colis de ce dépôt sont déjà partis : le lieu ne change plus');
    END IF;
    -- Le lieu fixe la base du prix (m³ en Sea, kilo en Air). Un devis déjà vu
    -- par le client ou par l'argent ne change pas de base ; un brouillon est
    -- jeté, il se refera au tarif du nouveau mode.
    SELECT * INTO v_quote FROM public.parcel_quotes WHERE deposit_id = v_dep.id FOR UPDATE;
    v_why := public.reception_quote_engaged(v_dep.id);
    IF v_why IS NOT NULL THEN
      RETURN jsonb_build_object('success', false, 'error', v_why || ' : le lieu (et donc la base du prix) ne change plus');
    END IF;
    IF v_quote.id IS NOT NULL THEN
      DELETE FROM public.parcel_quotes WHERE id = v_quote.id;
      v_draft := true;
    END IF;
  END IF;

  -- NULL : on garde ; une chaîne vide : on efface.
  UPDATE public.parcel_deposits SET
    location             = v_loc,
    brought_by           = v_by,
    representative_name  = CASE WHEN p_representative_name  IS NULL THEN representative_name  ELSE NULLIF(TRIM(p_representative_name), '')  END,
    representative_phone = CASE WHEN p_representative_phone IS NULL THEN representative_phone ELSE NULLIF(TRIM(p_representative_phone), '') END,
    notes                = CASE WHEN p_notes IS NULL THEN notes ELSE NULLIF(TRIM(p_notes), '') END,
    updated_at           = now()
  WHERE id = v_dep.id
  RETURNING * INTO v_after;

  INSERT INTO public.admin_audit_logs (admin_user_id, action_type, target_type, target_id, details)
  VALUES (v_uid, 'update_parcel_deposit', 'parcel_deposit', v_dep.id,
          jsonb_build_object('description', 'Dépôt ' || v_dep.deposit_no || ' corrigé' || CASE WHEN v_draft THEN ' (brouillon de devis ' || v_quote.quote_no || ' retiré : nouveau mode)' ELSE '' END,
                             'deposit_no', v_dep.deposit_no, 'draft_quote_removed', CASE WHEN v_draft THEN v_quote.quote_no END,
                             'before', jsonb_build_object('location', v_dep.location, 'brought_by', v_dep.brought_by, 'representative_name', v_dep.representative_name, 'representative_phone', v_dep.representative_phone, 'notes', v_dep.notes),
                             'after', jsonb_build_object('location', v_after.location, 'brought_by', v_after.brought_by, 'representative_name', v_after.representative_name, 'representative_phone', v_after.representative_phone, 'notes', v_after.notes)));
  RETURN jsonb_build_object('success', true, 'deposit', public.reception_deposit_json(v_dep.id));
END;
$fn$;
COMMENT ON FUNCTION public.reception_update_deposit(UUID, TEXT, TEXT, TEXT, TEXT, TEXT) IS
  '@mola:{"expose":true,"kind":"write","permission":"canManageCargo","confirm":true,"danger":false,"label":"Corriger un dépôt de colis (lieu, mode d''arrivée, apporteur, notes)","resolve":{"p_deposit_id":"deposit"}}';

-- ─────────────────────────────────────────────────────────────────────────
-- 9. Supprimer (annuler) un dépôt, et le rétablir
-- ─────────────────────────────────────────────────────────────────────────
-- L'annulation est une suppression douce : le dépôt disparaît des listes, du
-- stock, des chargements et des devis à faire, mais la ligne et ses colis
-- restent (le journal et le rétablissement en ont besoin). Refusée dès qu'un
-- colis est parti ou qu'un encaissement existe : on défait d'abord l'argent.
CREATE OR REPLACE FUNCTION public.reception_cancel_deposit(p_deposit_id UUID, p_reason TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_uid    UUID := auth.uid();
  v_dep    public.parcel_deposits;
  v_quote  public.parcel_quotes;
  v_reason TEXT := NULLIF(TRIM(p_reason), '');
  v_n      INTEGER;
BEGIN
  IF NOT public.admin_has_permission(v_uid, 'canReceiveParcels') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accès non autorisé');
  END IF;
  SELECT * INTO v_dep FROM public.parcel_deposits WHERE id = p_deposit_id FOR UPDATE;
  IF v_dep.id IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Dépôt introuvable'); END IF;
  IF v_dep.status = 'cancelled' THEN RETURN jsonb_build_object('success', false, 'error', 'Ce dépôt est déjà supprimé'); END IF;
  -- Son réceptionnaire peut abandonner un dépôt encore OUVERT (ouvert par erreur) ; fermé : l'équipe cargo seule.
  IF NOT (public.reception_can_edit(v_dep, v_uid) OR public.admin_has_permission(v_uid, 'canManageCargo')) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Seule l''équipe cargo supprime un dépôt fermé');
  END IF;
  IF v_reason IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Indiquez pourquoi ce dépôt est supprimé');
  END IF;
  -- Les colis verrouillés AVANT de vérifier qu'aucun n'est parti : un chargement
  -- concurrent attend la fin de la suppression, puis la trouve (garde-fou §11).
  PERFORM 1 FROM public.parcels WHERE deposit_id = v_dep.id FOR UPDATE;
  IF EXISTS (SELECT 1 FROM public.parcels p WHERE p.deposit_id = v_dep.id AND public.reception_parcel_locked(p) IS NOT NULL) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Des colis de ce dépôt sont déjà partis : il ne se supprime plus');
  END IF;
  SELECT * INTO v_quote FROM public.parcel_quotes WHERE deposit_id = v_dep.id FOR UPDATE;
  IF v_quote.id IS NOT NULL AND (v_quote.amount_paid_xaf > 0 OR v_quote.invoice_no IS NOT NULL OR v_quote.status IN ('paid','invoiced')) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Des encaissements existent sur ce dépôt : annulez-les d''abord');
  END IF;

  SELECT count(*) INTO v_n FROM public.parcels WHERE deposit_id = v_dep.id;
  UPDATE public.parcel_deposits
     SET status = 'cancelled', cancelled_at = now(), cancelled_by = v_uid, cancel_reason = v_reason, updated_at = now()
   WHERE id = v_dep.id;

  INSERT INTO public.admin_audit_logs (admin_user_id, action_type, target_type, target_id, details)
  VALUES (v_uid, 'cancel_parcel_deposit', 'parcel_deposit', v_dep.id,
          jsonb_build_object('description', 'Dépôt ' || v_dep.deposit_no || ' supprimé (' || v_n || ' colis) : ' || v_reason,
                             'deposit_no', v_dep.deposit_no, 'previous_status', v_dep.status, 'parcel_count', v_n, 'reason', v_reason,
                             'client_user_id', v_dep.client_user_id));
  RETURN jsonb_build_object('success', true, 'deposit', public.reception_deposit_json(v_dep.id));
END;
$fn$;
COMMENT ON FUNCTION public.reception_cancel_deposit(UUID, TEXT) IS
  '@mola:{"expose":true,"kind":"write","permission":"canManageCargo","confirm":true,"danger":true,"label":"Supprimer (annuler) un dépôt de colis saisi par erreur — motif obligatoire","resolve":{"p_deposit_id":"deposit"}}';

CREATE OR REPLACE FUNCTION public.reception_restore_deposit(p_deposit_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_uid UUID := auth.uid();
  v_dep public.parcel_deposits;
  v_to  TEXT;
BEGIN
  IF NOT public.admin_has_permission(v_uid, 'canManageCargo') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accès non autorisé');
  END IF;
  SELECT * INTO v_dep FROM public.parcel_deposits WHERE id = p_deposit_id FOR UPDATE;
  IF v_dep.id IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Dépôt introuvable'); END IF;
  IF v_dep.status <> 'cancelled' THEN RETURN jsonb_build_object('success', false, 'error', 'Ce dépôt n''est pas supprimé'); END IF;

  v_to := CASE WHEN v_dep.closed_at IS NOT NULL THEN 'closed' ELSE 'open' END;
  UPDATE public.parcel_deposits
     SET status = v_to, cancelled_at = NULL, cancelled_by = NULL, cancel_reason = NULL, updated_at = now()
   WHERE id = v_dep.id;
  IF v_to = 'closed' THEN PERFORM public.reception_recount_deposit(v_dep.id); END IF;

  INSERT INTO public.admin_audit_logs (admin_user_id, action_type, target_type, target_id, details)
  VALUES (v_uid, 'restore_parcel_deposit', 'parcel_deposit', v_dep.id,
          jsonb_build_object('description', 'Dépôt ' || v_dep.deposit_no || ' rétabli', 'deposit_no', v_dep.deposit_no,
                             'cancel_reason', v_dep.cancel_reason, 'cancelled_at', v_dep.cancelled_at));
  RETURN jsonb_build_object('success', true, 'deposit', public.reception_deposit_json(v_dep.id));
END;
$fn$;
COMMENT ON FUNCTION public.reception_restore_deposit(UUID) IS
  '@mola:{"expose":true,"kind":"write","permission":"canManageCargo","confirm":true,"danger":false,"label":"Rétablir un dépôt de colis supprimé","resolve":{"p_deposit_id":"deposit"}}';

-- ─────────────────────────────────────────────────────────────────────────
-- 10. La liste des dépôts, colis compris — la page Réception de la console
-- ─────────────────────────────────────────────────────────────────────────
--   p_scope = 'stock'     : ce qui est ici — tout dépôt dont au moins un colis
--                           attend (reçu, pas chargé), plus les dépôts en
--                           cours de saisie ; la période est ignorée ;
--           = 'all'       : tous les dépôts reçus sur la période ;
--           = 'cancelled' : les dépôts supprimés sur la période.
--   p_from / p_to : bornes sur la date de réception (NULL = sans borne).
CREATE OR REPLACE FUNCTION public.reception_board(
  p_scope TEXT DEFAULT 'stock',
  p_location TEXT DEFAULT NULL,
  p_from TIMESTAMPTZ DEFAULT NULL,
  p_to TIMESTAMPTZ DEFAULT NULL,
  p_limit INTEGER DEFAULT 500
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_limit INTEGER := GREATEST(1, LEAST(COALESCE(p_limit, 500), 2000));
  v_total INTEGER;
  v_rows  JSONB;
BEGIN
  IF NOT public.admin_has_permission(auth.uid(), 'canViewCargo') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accès non autorisé');
  END IF;
  IF COALESCE(p_scope, 'stock') NOT IN ('stock','all','cancelled') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Vue inconnue');
  END IF;
  IF p_location IS NOT NULL AND p_location NOT IN ('warehouse','office') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Lieu inconnu');
  END IF;

  -- La période porte sur la date affichée partout : la fermeture du dépôt (le
  -- reçu), sinon son ouverture — un dépôt ouvert à 23 h 50 et fermé après
  -- minuit est « d'aujourd'hui », comme l'écran le montre.
  WITH picked AS (
    SELECT d.id, COALESCE(d.closed_at, d.opened_at) AS at
    FROM public.parcel_deposits d
    WHERE (p_location IS NULL OR d.location = p_location)
      AND CASE COALESCE(p_scope, 'stock')
            WHEN 'stock' THEN d.status <> 'cancelled' AND (
                   d.status = 'open'
                   OR EXISTS (SELECT 1 FROM public.parcels p
                               WHERE p.deposit_id = d.id AND p.shipment_id IS NULL AND p.air_shipment_id IS NULL
                                 AND p.status IN ('received','stored')))
            WHEN 'all' THEN d.status <> 'cancelled'
                   AND (p_from IS NULL OR COALESCE(d.closed_at, d.opened_at) >= p_from) AND (p_to IS NULL OR COALESCE(d.closed_at, d.opened_at) < p_to)
            ELSE d.status = 'cancelled'
                   AND (p_from IS NULL OR COALESCE(d.closed_at, d.opened_at) >= p_from) AND (p_to IS NULL OR COALESCE(d.closed_at, d.opened_at) < p_to)
          END
  ), counted AS (
    SELECT count(*) AS n FROM picked
  ), page AS (
    SELECT id, at FROM picked ORDER BY at DESC LIMIT v_limit
  )
  SELECT (SELECT n FROM counted),
         COALESCE(jsonb_agg(
           public.reception_deposit_json(pg.id)
           || jsonb_build_object('quote_status', q.status, 'quote_no', q.quote_no, 'quote_total_xaf', q.total_xaf,
                                 'quote_paid_xaf', q.amount_paid_xaf, 'invoice_no', q.invoice_no)
           ORDER BY pg.at DESC), '[]'::jsonb)
    INTO v_total, v_rows
  FROM page pg LEFT JOIN public.parcel_quotes q ON q.deposit_id = pg.id;

  RETURN jsonb_build_object('success', true, 'scope', COALESCE(p_scope, 'stock'), 'total', COALESCE(v_total, 0),
                            'truncated', COALESCE(v_total, 0) > v_limit, 'deposits', v_rows);
END;
$fn$;
COMMENT ON FUNCTION public.reception_board(TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, INTEGER) IS
  '@mola:{"expose":true,"kind":"read","permission":"canViewCargo","confirm":false,"danger":false,"label":"Les dépôts de colis reçus, avec leurs colis et leurs photos (en stock, sur une période, ou supprimés)"}';

-- Les vues « période » et « supprimés » trient les dépôts par date de réception.
CREATE INDEX IF NOT EXISTS parcel_deposits_status_at_idx ON public.parcel_deposits (status, (COALESCE(closed_at, opened_at)) DESC);

-- ─────────────────────────────────────────────────────────────────────────
-- Le fournisseur d'un dépôt supprimé ne se corrige plus (même corps que
-- 20260922090000, plus ce refus).
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.reception_set_supplier(
  p_deposit_id UUID,
  p_supplier_kind TEXT DEFAULT 'supplier',
  p_supplier_name TEXT DEFAULT NULL,
  p_supplier_contact TEXT DEFAULT NULL,
  p_supplier_phone TEXT DEFAULT NULL,
  p_supplier_email TEXT DEFAULT NULL,
  p_supplier_wechat TEXT DEFAULT NULL,
  p_supplier_address TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE v_uid UUID := auth.uid(); v_d public.parcel_deposits;
BEGIN
  IF NOT public.admin_has_permission(v_uid, 'canReceiveParcels') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accès non autorisé');
  END IF;
  SELECT * INTO v_d FROM public.parcel_deposits WHERE id = p_deposit_id FOR UPDATE;
  IF v_d.id IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Dépôt introuvable'); END IF;
  IF v_d.status = 'cancelled' THEN RETURN jsonb_build_object('success', false, 'error', 'Ce dépôt est supprimé'); END IF;
  -- Fermé : seule l'équipe cargo corrige encore (le réceptionnaire ne réécrit pas un dépôt clos).
  IF NOT (public.reception_can_edit(v_d, v_uid) OR public.admin_has_permission(v_uid, 'canManageCargo')) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ce dépôt ne peut plus être modifié');
  END IF;
  IF p_supplier_kind IS NOT NULL AND p_supplier_kind NOT IN ('supplier','buying_agent') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Type de fournisseur inconnu');
  END IF;
  UPDATE public.parcel_deposits SET
    supplier_kind    = CASE WHEN NULLIF(TRIM(p_supplier_name), '') IS NULL THEN NULL ELSE COALESCE(p_supplier_kind, 'supplier') END,
    supplier_name    = NULLIF(TRIM(p_supplier_name), ''),
    supplier_contact = NULLIF(TRIM(p_supplier_contact), ''),
    supplier_phone   = NULLIF(TRIM(p_supplier_phone), ''),
    supplier_email   = NULLIF(TRIM(p_supplier_email), ''),
    supplier_wechat  = NULLIF(TRIM(p_supplier_wechat), ''),
    supplier_address = NULLIF(TRIM(p_supplier_address), ''),
    updated_at = now()
  WHERE id = v_d.id;
  RETURN jsonb_build_object('success', true, 'deposit', public.reception_deposit_json(v_d.id));
END;
$fn$;
COMMENT ON FUNCTION public.reception_set_supplier(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) IS
  '@mola:{"expose":true,"kind":"write","permission":"canReceiveParcels","confirm":false,"danger":false,"label":"Poser ou corriger le fournisseur d''un dépôt de colis"}';

-- ─────────────────────────────────────────────────────────────────────────
-- 11. Un dépôt supprimé ne vit plus — quelle que soit la RPC qui essaie
-- ─────────────────────────────────────────────────────────────────────────
-- Les RPC de chargement (conteneur, avion), d'envoi, de facturation et
-- d'encaissement (y compris depuis le portefeuille du client) ne lisent pas
-- le statut du dépôt. Plutôt que de les recopier une à une, un trigger refuse
-- au niveau de la ligne : charger un colis, envoyer ou facturer un devis,
-- enregistrer un encaissement, quand le dépôt est supprimé. L'exception
-- annule toute la transaction — le débit du portefeuille compris.
--
-- Pas de verrou ici : ces RPC verrouillent le devis puis lisent le dépôt,
-- la suppression verrouille le dépôt puis le devis. Une simple lecture (READ
-- COMMITTED : la dernière version validée) suffit et n'inverse aucun ordre
-- de verrouillage.
CREATE OR REPLACE FUNCTION public.reception_guard_cancelled_deposit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE v_dep public.parcel_deposits;
BEGIN
  IF TG_TABLE_NAME = 'parcels' THEN
    IF NOT ((NEW.shipment_id IS NOT NULL AND NEW.shipment_id IS DISTINCT FROM OLD.shipment_id)
         OR (NEW.air_shipment_id IS NOT NULL AND NEW.air_shipment_id IS DISTINCT FROM OLD.air_shipment_id)) THEN
      RETURN NEW;
    END IF;
    SELECT * INTO v_dep FROM public.parcel_deposits WHERE id = NEW.deposit_id;
    IF v_dep.status = 'cancelled' THEN
      RAISE EXCEPTION 'Le dépôt % est supprimé : le colis % ne se charge plus', v_dep.deposit_no, NEW.parcel_no USING ERRCODE = 'P0001';
    END IF;
  ELSIF TG_TABLE_NAME = 'parcel_quote_payments' THEN
    SELECT d.* INTO v_dep FROM public.parcel_deposits d JOIN public.parcel_quotes q ON q.deposit_id = d.id WHERE q.id = NEW.quote_id;
    IF v_dep.status = 'cancelled' THEN
      RAISE EXCEPTION 'Le dépôt % est supprimé : son devis ne s''encaisse plus', v_dep.deposit_no USING ERRCODE = 'P0001';
    END IF;
  ELSIF TG_TABLE_NAME = 'parcel_quotes' THEN
    IF NOT ((NEW.sent_at IS NOT NULL AND NEW.sent_at IS DISTINCT FROM OLD.sent_at)
         OR (NEW.invoice_no IS NOT NULL AND NEW.invoice_no IS DISTINCT FROM OLD.invoice_no)) THEN
      RETURN NEW;
    END IF;
    SELECT * INTO v_dep FROM public.parcel_deposits WHERE id = NEW.deposit_id;
    IF v_dep.status = 'cancelled' THEN
      RAISE EXCEPTION 'Le dépôt % est supprimé : son devis ne s''envoie ni ne se facture plus', v_dep.deposit_no USING ERRCODE = 'P0001';
    END IF;
  END IF;
  RETURN NEW;
END;
$fn$;
COMMENT ON FUNCTION public.reception_guard_cancelled_deposit() IS
  '@mola:{"expose":false,"kind":"write","permission":"canManageCargo","confirm":false,"danger":false,"label":"Refuser chargement, envoi, facture et encaissement d''un dépôt supprimé (trigger interne)"}';
REVOKE ALL ON FUNCTION public.reception_guard_cancelled_deposit() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.reception_guard_cancelled_deposit() FROM anon, authenticated;

DROP TRIGGER IF EXISTS parcels_guard_cancelled_deposit ON public.parcels;
CREATE TRIGGER parcels_guard_cancelled_deposit
  BEFORE UPDATE OF shipment_id, air_shipment_id ON public.parcels
  FOR EACH ROW EXECUTE FUNCTION public.reception_guard_cancelled_deposit();

DROP TRIGGER IF EXISTS parcel_quote_payments_guard_cancelled_deposit ON public.parcel_quote_payments;
CREATE TRIGGER parcel_quote_payments_guard_cancelled_deposit
  BEFORE INSERT ON public.parcel_quote_payments
  FOR EACH ROW EXECUTE FUNCTION public.reception_guard_cancelled_deposit();

DROP TRIGGER IF EXISTS parcel_quotes_guard_cancelled_deposit ON public.parcel_quotes;
CREATE TRIGGER parcel_quotes_guard_cancelled_deposit
  BEFORE UPDATE OF sent_at, invoice_no ON public.parcel_quotes
  FOR EACH ROW EXECUTE FUNCTION public.reception_guard_cancelled_deposit();
