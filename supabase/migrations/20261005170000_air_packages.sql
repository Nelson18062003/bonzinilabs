-- ============================================================================
-- Cargo aérien · les PAQUETS de 32 kg, de Guangzhou à Douala
--
-- Au bureau de Guangzhou, les colis avion (dépôts « office ») sont regroupés
-- dans des paquets d'au plus 32 kg : un paquet réunit des colis de plusieurs
-- clients, et les colis d'un client peuvent partir dans plusieurs paquets.
-- Chaque paquet a son numéro (PQ-000001) et son étiquette. Les paquets — pas
-- les colis un par un — vont à l'aéroport : on les affecte à une expédition,
-- on les scanne au départ, l'aéroport peut en refuser un. À Douala, on
-- reçoit chaque paquet (tous sont-ils là ?), on l'ouvre et on pointe chacun
-- de ses colis (le pointage existant).
--
--   1. air_packages (+ séquence) ; parcels.air_package_id ; lecture RLS
--   2. invariant : un colis emballé suit son paquet (ni conteneur, ni
--      chargement ou retrait à l'unité) — déclencheur parcels_package_guard
--   3. pointer à Douala un colis d'un paquet ouvre le paquet
--   4. RPC des paquets : créer, trouver, lister, ajouter / retirer un colis,
--      fermer (pesée), rouvrir, supprimer un paquet vide, affecter / retirer
--      d'une expédition, scanner au départ, refus de l'aéroport, réception
--      et ouverture à Douala
--   5. le reste sait les paquets : verrou d'un colis, colis chargeables
--      (avion, conteneur), jalons de l'expédition (le départ exige les
--      paquets scannés ; une arrivée pointée ne s'annule plus), fiches
--      expédition / colis / arrivée à Douala ; la journée de Douala, les
--      messages aux clients et la notification de l'équipe n'affichent jamais
--      une LTA provisoire ; le dépôt dit le paquet de chaque colis ; les
--      anciens chargements à l'unité sautent les colis emballés
--   6. LTA provisoire : une expédition s'ouvre avant que la LTA soit connue
--      (PROV-…), la vraie LTA se pose ensuite, même après le départ
--
-- Ordre de verrouillage partout : expédition, puis paquet, puis colis — sauf
-- le jalon « arrivé → parti », qui verrouille les colis puis les paquets
-- (l'ordre du pointage de Douala, qui verrouille le colis puis son paquet).
-- Idempotent. Suppose 20261005150000 (remise / vols) passée.
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────
-- 1. Le paquet
-- ─────────────────────────────────────────────────────────────────────────
CREATE SEQUENCE IF NOT EXISTS public.air_package_seq;

CREATE TABLE IF NOT EXISTS public.air_packages (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seq               BIGINT NOT NULL UNIQUE DEFAULT nextval('public.air_package_seq'),
  -- PQ-000123 : six chiffres commençant par 0 (jamais lu comme un code client
  -- BZ-xxxxxx), et pas la forme RC-dddddd-dd d'un colis.
  package_no        TEXT GENERATED ALWAYS AS ('PQ-' || CASE WHEN seq < 1000000 THEN lpad(seq::text, 6, '0') ELSE seq::text END) STORED UNIQUE,
  -- open : on le remplit · sealed : fermé, pesé (affecté ou non) · handed_over : scanné au départ ·
  -- refused : refusé à l'aéroport · received : arrivé à l'entrepôt de Douala · opened : ouvert, colis pointés
  status            TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','sealed','handed_over','refused','received','opened')),
  air_shipment_id   UUID REFERENCES public.air_shipments(id) ON DELETE RESTRICT,
  max_weight_kg     NUMERIC(6,2) NOT NULL DEFAULT 32 CHECK (max_weight_kg > 0 AND max_weight_kg <= 100),
  gross_weight_kg   NUMERIC(8,2) CHECK (gross_weight_kg IS NULL OR gross_weight_kg > 0),
  length_cm         NUMERIC(8,1) CHECK (length_cm IS NULL OR length_cm > 0),
  width_cm          NUMERIC(8,1) CHECK (width_cm IS NULL OR width_cm > 0),
  height_cm         NUMERIC(8,1) CHECK (height_cm IS NULL OR height_cm > 0),
  notes             TEXT CHECK (notes IS NULL OR length(notes) <= 500),
  sealed_at         TIMESTAMPTZ,
  sealed_by         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  handed_over_at    TIMESTAMPTZ,
  handed_over_by    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  refused_at        TIMESTAMPTZ,
  refused_by        UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  refusal_reason    TEXT CHECK (refusal_reason IS NULL OR length(refusal_reason) <= 300),
  refused_air_shipment_id UUID REFERENCES public.air_shipments(id) ON DELETE SET NULL,
  received_at       TIMESTAMPTZ,
  received_by       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  opened_at         TIMESTAMPTZ,
  opened_by         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by        UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS air_packages_air_idx ON public.air_packages (air_shipment_id) WHERE air_shipment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS air_packages_status_idx ON public.air_packages (status, created_at DESC);

ALTER TABLE public.parcels ADD COLUMN IF NOT EXISTS air_package_id UUID REFERENCES public.air_packages(id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS parcels_air_package_idx ON public.parcels (air_package_id) WHERE air_package_id IS NOT NULL;

ALTER TABLE public.air_packages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS air_packages_staff_read ON public.air_packages;
CREATE POLICY air_packages_staff_read ON public.air_packages FOR SELECT TO authenticated
  USING (public.admin_has_permission(auth.uid(), 'canReceiveParcels')
      OR public.admin_has_permission(auth.uid(), 'canViewCargo')
      OR public.admin_has_permission(auth.uid(), 'canReceiveAtDestination'));
-- Aucune écriture directe : tout passe par les RPC ci-dessous.

-- ─────────────────────────────────────────────────────────────────────────
-- 2. Un colis emballé suit son paquet
-- ─────────────────────────────────────────────────────────────────────────
-- Son expédition est TOUJOURS celle du paquet : on charge, retire ou refuse le
-- paquet entier, jamais un de ses colis. Et un colis emballé ne part pas en
-- conteneur. Les RPC des paquets écrivent le paquet d'abord, ses colis ensuite.
CREATE OR REPLACE FUNCTION public.parcels_package_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE v_pkg public.air_packages;
BEGIN
  IF NEW.air_package_id IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT * INTO v_pkg FROM public.air_packages WHERE id = NEW.air_package_id;
  IF NEW.shipment_id IS NOT NULL THEN
    RAISE EXCEPTION 'Le colis % est dans le paquet % : il part en avion, pas en conteneur', NEW.parcel_no, v_pkg.package_no USING ERRCODE = 'P0001';
  END IF;
  IF NEW.air_shipment_id IS DISTINCT FROM v_pkg.air_shipment_id THEN
    RAISE EXCEPTION 'Le colis % est dans le paquet % : c''est le paquet entier qui se charge ou se retire', NEW.parcel_no, v_pkg.package_no USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$fn$;
DROP TRIGGER IF EXISTS parcels_package_guard ON public.parcels;
CREATE TRIGGER parcels_package_guard
  BEFORE INSERT OR UPDATE OF air_package_id, shipment_id, air_shipment_id ON public.parcels
  FOR EACH ROW EXECUTE FUNCTION public.parcels_package_guard();

-- ─────────────────────────────────────────────────────────────────────────
-- 3. Pointer à Douala un colis d'un paquet : le paquet est reçu et ouvert
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.air_packages_follow_checkin()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  IF NEW.air_package_id IS NULL OR NEW.checked_in_at IS NULL OR OLD.checked_in_at IS NOT NULL THEN
    RETURN NEW;
  END IF;
  UPDATE public.air_packages
     SET status = 'opened',
         received_at = COALESCE(received_at, now()), received_by = COALESCE(received_by, NEW.checked_in_by),
         opened_at = COALESCE(opened_at, now()), opened_by = COALESCE(opened_by, NEW.checked_in_by),
         updated_at = now()
   WHERE id = NEW.air_package_id AND status IN ('sealed','handed_over','received');
  RETURN NEW;
END;
$fn$;
DROP TRIGGER IF EXISTS air_packages_follow_checkin ON public.parcels;
CREATE TRIGGER air_packages_follow_checkin
  AFTER UPDATE OF checked_in_at ON public.parcels
  FOR EACH ROW EXECUTE FUNCTION public.air_packages_follow_checkin();

-- ─────────────────────────────────────────────────────────────────────────
-- 4. RPC des paquets
-- ─────────────────────────────────────────────────────────────────────────

-- 4.0 Lire un code scanné ou tapé.
--     « PQ-000123 », « pq123 », l'étiquette entière → PQ-000123.
CREATE OR REPLACE FUNCTION public.air_package_code(p_text TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $fn$
  SELECT CASE WHEN m IS NULL THEN NULL
              ELSE 'PQ-' || CASE WHEN m[1]::bigint < 1000000 THEN lpad((m[1]::bigint)::text, 6, '0') ELSE (m[1]::bigint)::text END END
    FROM (SELECT regexp_match(upper(COALESCE(p_text, '')), 'PQ[\s-]?(\d{1,9})') AS m) x
$fn$;

--     « RC-000123-01 », l'URL de l'étiquette (…?p=RC-000123-01) → RC-000123-01.
CREATE OR REPLACE FUNCTION public.parcel_code(p_text TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $fn$
  SELECT CASE WHEN m IS NULL THEN NULL ELSE 'RC-' || m[1] || '-' || m[2] END
    FROM (SELECT regexp_match(upper(COALESCE(p_text, '')), 'RC-?(\d{6})-?(\d{2,3})') AS m) x
$fn$;

-- 4.1 Un paquet au format JSON (helper) : la fiche, ses poids, son expédition
--     et ses colis (avec leur client et leur pointage à Douala).
CREATE OR REPLACE FUNCTION public.air_package_json(p_package_id UUID, p_with_parcels BOOLEAN DEFAULT true)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT jsonb_build_object(
    'id', k.id, 'package_no', k.package_no, 'status', k.status,
    'air_shipment_id', k.air_shipment_id, 'awb_number', a.awb_number, 'air_status', a.status, 'etd', a.etd, 'flight_no', a.flight_no,
    'max_weight_kg', k.max_weight_kg, 'gross_weight_kg', k.gross_weight_kg,
    'length_cm', k.length_cm, 'width_cm', k.width_cm, 'height_cm', k.height_cm, 'notes', k.notes,
    'net_weight_kg', (SELECT COALESCE(sum(p.weight_kg), 0) FROM public.parcels p WHERE p.air_package_id = k.id),
    'parcel_count',  (SELECT count(*) FROM public.parcels p WHERE p.air_package_id = k.id),
    'client_count',  (SELECT count(DISTINCT d.client_user_id) FROM public.parcels p JOIN public.parcel_deposits d ON d.id = p.deposit_id WHERE p.air_package_id = k.id),
    'checked_count', (SELECT count(*) FROM public.parcels p WHERE p.air_package_id = k.id AND p.checked_in_at IS NOT NULL),
    'missing_count', (SELECT count(*) FROM public.parcels p WHERE p.air_package_id = k.id AND p.condition = 'missing'),
    'sealed_at', k.sealed_at, 'handed_over_at', k.handed_over_at,
    'refused_at', k.refused_at, 'refusal_reason', k.refusal_reason, 'refused_air_shipment_id', k.refused_air_shipment_id,
    'received_at', k.received_at, 'opened_at', k.opened_at, 'created_at', k.created_at, 'updated_at', k.updated_at,
    'parcels', CASE WHEN p_with_parcels THEN COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', p.id, 'seq', p.seq, 'parcel_no', p.parcel_no, 'kind', p.kind, 'weight_kg', p.weight_kg, 'cbm', p.cbm,
        'description', p.description, 'status', p.status, 'photo_path', p.photo_path,
        'checked_in_at', p.checked_in_at, 'warehouse_location', p.warehouse_location, 'condition', p.condition, 'delivered_at', p.delivered_at,
        'deposit_no', d.deposit_no, 'deposit_id', d.id,
        'client', public.reception_client_card(d.client_user_id)
      ) ORDER BY d.client_user_id, d.opened_at, p.seq)
      FROM public.parcels p JOIN public.parcel_deposits d ON d.id = p.deposit_id
      WHERE p.air_package_id = k.id), '[]'::jsonb) ELSE NULL END
  )
  FROM public.air_packages k LEFT JOIN public.air_shipments a ON a.id = k.air_shipment_id
  WHERE k.id = p_package_id;
$fn$;

CREATE OR REPLACE FUNCTION public._air_package_can_read()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT public.admin_has_permission(auth.uid(), 'canReceiveParcels')
      OR public.admin_has_permission(auth.uid(), 'canViewCargo')
      OR public.admin_has_permission(auth.uid(), 'canReceiveAtDestination')
$fn$;

-- L'équipe de Guangzhou (réception) et le cargo (ops) envoient les paquets à l'aéroport.
CREATE OR REPLACE FUNCTION public._air_package_can_ship()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT public.admin_has_permission(auth.uid(), 'canReceiveParcels')
      OR public.admin_has_permission(auth.uid(), 'canManageCargo')
$fn$;

-- 4.2 Lister les paquets. p_air_id : ceux d'une expédition. Sinon p_scope :
--     'bureau' (pas encore partis : en cours, fermés, refusés, affectés à une
--     expédition qui n'est pas partie), 'all' (les 300 derniers).
CREATE OR REPLACE FUNCTION public.air_package_list(p_scope TEXT DEFAULT 'bureau', p_air_id UUID DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  IF NOT public._air_package_can_read() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accès non autorisé');
  END IF;
  RETURN jsonb_build_object('success', true, 'packages', COALESCE((
    SELECT jsonb_agg(public.air_package_json(x.id, false) ORDER BY x.ord, x.created_at DESC)
    FROM (
      SELECT k.id, k.created_at,
             CASE k.status WHEN 'open' THEN 0 WHEN 'refused' THEN 1 WHEN 'sealed' THEN 2 WHEN 'handed_over' THEN 3 ELSE 4 END AS ord
        FROM public.air_packages k LEFT JOIN public.air_shipments a ON a.id = k.air_shipment_id
       WHERE CASE
               WHEN p_air_id IS NOT NULL THEN k.air_shipment_id = p_air_id
               WHEN p_scope = 'all' THEN true
               ELSE k.status IN ('open','sealed','refused','handed_over') AND (a.id IS NULL OR a.status = 'PLANNED')
             END
       ORDER BY k.created_at DESC
       LIMIT 300
    ) x
  ), '[]'::jsonb));
END;
$fn$;

-- 4.3 Un paquet, par son identifiant ou par un code scanné (PQ-…).
CREATE OR REPLACE FUNCTION public.air_package_get(p_package_id UUID DEFAULT NULL, p_code TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE v_id UUID;
BEGIN
  IF NOT public._air_package_can_read() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accès non autorisé');
  END IF;
  IF p_package_id IS NOT NULL THEN
    SELECT id INTO v_id FROM public.air_packages WHERE id = p_package_id;
  ELSE
    SELECT id INTO v_id FROM public.air_packages WHERE package_no = public.air_package_code(p_code);
  END IF;
  IF v_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Paquet introuvable');
  END IF;
  RETURN jsonb_build_object('success', true, 'package', public.air_package_json(v_id, true));
END;
$fn$;

-- 4.4 Ouvrir un nouveau paquet (vide).
CREATE OR REPLACE FUNCTION public.air_package_create(p_notes TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE v_uid UUID := auth.uid(); v_id UUID; v_no TEXT;
BEGIN
  IF NOT public.admin_has_permission(v_uid, 'canReceiveParcels') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accès non autorisé');
  END IF;
  INSERT INTO public.air_packages (notes, created_by) VALUES (NULLIF(btrim(COALESCE(p_notes, '')), ''), v_uid)
  RETURNING id, package_no INTO v_id, v_no;
  INSERT INTO public.admin_audit_logs (admin_user_id, action_type, target_type, target_id, details)
  VALUES (v_uid, 'air_package_create', 'air_package', v_id, jsonb_build_object('description', 'Paquet ' || v_no || ' ouvert', 'package_no', v_no));
  RETURN jsonb_build_object('success', true, 'package', public.air_package_json(v_id, true));
END;
$fn$;

-- 4.5 Mettre un colis dans un paquet (scan de son étiquette). Un colis avion
--     (dépôt du bureau), pesé, avec son client, qui n'est ni parti ni déjà
--     emballé ; le paquet reste sous son poids maximal (32 kg).
CREATE OR REPLACE FUNCTION public.air_package_add_parcel(p_package_id UUID, p_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_uid UUID := auth.uid();
  v_k public.air_packages;
  v_p public.parcels;
  v_d public.parcel_deposits;
  v_no TEXT := public.parcel_code(p_code);
  v_net NUMERIC;
  v_other TEXT;
BEGIN
  IF NOT public.admin_has_permission(v_uid, 'canReceiveParcels') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accès non autorisé');
  END IF;
  SELECT * INTO v_k FROM public.air_packages WHERE id = p_package_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Paquet introuvable'); END IF;
  IF v_k.status <> 'open' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Le paquet ' || v_k.package_no || ' est fermé : rouvrez-le pour y ajouter un colis');
  END IF;
  IF v_no IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ce n''est pas une étiquette de colis (RC-000000-00)');
  END IF;
  SELECT * INTO v_p FROM public.parcels WHERE parcel_no = v_no FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Colis ' || v_no || ' introuvable'); END IF;
  IF v_p.air_package_id = v_k.id THEN
    RETURN jsonb_build_object('success', true, 'already', true, 'parcel_no', v_no, 'package', public.air_package_json(v_k.id, true));
  END IF;
  IF v_p.air_package_id IS NOT NULL THEN
    SELECT package_no INTO v_other FROM public.air_packages WHERE id = v_p.air_package_id;
    RETURN jsonb_build_object('success', false, 'error', 'Le colis ' || v_no || ' est déjà dans le paquet ' || v_other);
  END IF;
  SELECT * INTO v_d FROM public.parcel_deposits WHERE id = v_p.deposit_id;
  IF v_d.status = 'cancelled' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Le dépôt ' || v_d.deposit_no || ' est supprimé : ce colis ne part pas');
  END IF;
  IF v_d.location <> 'office' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Le colis ' || v_no || ' part en bateau (reçu à l''entrepôt) : il ne va pas dans un paquet avion');
  END IF;
  IF v_d.client_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Le colis ' || v_no || ' n''a pas encore de client : attribuez son dépôt d''abord');
  END IF;
  IF v_p.weight_kg IS NULL OR v_p.weight_kg <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Le colis ' || v_no || ' n''est pas pesé : pesez-le d''abord');
  END IF;
  IF v_p.shipment_id IS NOT NULL OR v_p.air_shipment_id IS NOT NULL OR v_p.status NOT IN ('received','stored')
     OR v_p.checked_in_at IS NOT NULL OR v_p.delivered_at IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Le colis ' || v_no || ' est déjà chargé ou parti');
  END IF;
  SELECT COALESCE(sum(weight_kg), 0) INTO v_net FROM public.parcels WHERE air_package_id = v_k.id;
  IF v_net + v_p.weight_kg > v_k.max_weight_kg THEN
    RETURN jsonb_build_object('success', false, 'error',
      'Le paquet passerait à ' || trim(to_char(v_net + v_p.weight_kg, 'FM999990.0')) || ' kg : ' || trim(to_char(v_k.max_weight_kg, 'FM990')) || ' kg au plus. Commencez un autre paquet.',
      'over', true);
  END IF;

  UPDATE public.parcels SET air_package_id = v_k.id, updated_at = now() WHERE id = v_p.id;
  UPDATE public.air_packages SET updated_at = now() WHERE id = v_k.id;
  RETURN jsonb_build_object('success', true, 'already', false, 'parcel_no', v_no, 'weight_kg', v_p.weight_kg,
                            'client', public.reception_client_card(v_d.client_user_id),
                            'package', public.air_package_json(v_k.id, true));
END;
$fn$;

-- 4.6 Retirer un colis d'un paquet encore ouvert.
CREATE OR REPLACE FUNCTION public.air_package_remove_parcel(p_parcel_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE v_uid UUID := auth.uid(); v_pkg UUID; v_k public.air_packages; v_p public.parcels;
BEGIN
  IF NOT public.admin_has_permission(v_uid, 'canReceiveParcels') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accès non autorisé');
  END IF;
  SELECT air_package_id INTO v_pkg FROM public.parcels WHERE id = p_parcel_id;
  IF v_pkg IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Ce colis n''est dans aucun paquet'); END IF;
  SELECT * INTO v_k FROM public.air_packages WHERE id = v_pkg FOR UPDATE;
  SELECT * INTO v_p FROM public.parcels WHERE id = p_parcel_id FOR UPDATE;
  IF v_p.air_package_id IS DISTINCT FROM v_k.id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ce colis vient de changer de paquet : rechargez la page');
  END IF;
  IF v_k.status <> 'open' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Le paquet ' || v_k.package_no || ' est fermé : rouvrez-le d''abord');
  END IF;
  UPDATE public.parcels SET air_package_id = NULL, updated_at = now() WHERE id = v_p.id;
  UPDATE public.air_packages SET updated_at = now() WHERE id = v_k.id;
  RETURN jsonb_build_object('success', true, 'package', public.air_package_json(v_k.id, true));
END;
$fn$;

-- 4.7 Fermer le paquet : pesé (brut), mesuré. Le poids brut tient sous le maximum.
CREATE OR REPLACE FUNCTION public.air_package_seal(
  p_package_id UUID,
  p_gross_weight_kg NUMERIC,
  p_length_cm NUMERIC DEFAULT NULL,
  p_width_cm NUMERIC DEFAULT NULL,
  p_height_cm NUMERIC DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE v_uid UUID := auth.uid(); v_k public.air_packages; v_net NUMERIC; v_n INTEGER;
BEGIN
  IF NOT public.admin_has_permission(v_uid, 'canReceiveParcels') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accès non autorisé');
  END IF;
  SELECT * INTO v_k FROM public.air_packages WHERE id = p_package_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Paquet introuvable'); END IF;
  IF v_k.status <> 'open' THEN RETURN jsonb_build_object('success', false, 'error', 'Ce paquet est déjà fermé'); END IF;
  SELECT count(*), COALESCE(sum(weight_kg), 0) INTO v_n, v_net FROM public.parcels WHERE air_package_id = v_k.id;
  IF v_n = 0 THEN RETURN jsonb_build_object('success', false, 'error', 'Le paquet est vide'); END IF;
  IF p_gross_weight_kg IS NULL OR p_gross_weight_kg <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Indiquez le poids pesé du paquet');
  END IF;
  IF p_gross_weight_kg > v_k.max_weight_kg THEN
    RETURN jsonb_build_object('success', false, 'error',
      'Le paquet pèse ' || trim(to_char(p_gross_weight_kg, 'FM999990.0')) || ' kg : ' || trim(to_char(v_k.max_weight_kg, 'FM990')) || ' kg au plus. Retirez un colis.');
  END IF;
  IF p_gross_weight_kg < v_net - 0.5 THEN
    RETURN jsonb_build_object('success', false, 'error',
      'Le poids pesé (' || trim(to_char(p_gross_weight_kg, 'FM999990.0')) || ' kg) est inférieur à celui des colis (' || trim(to_char(v_net, 'FM999990.0')) || ' kg) : vérifiez la pesée');
  END IF;
  IF (p_length_cm IS NOT NULL AND (p_length_cm <= 0 OR p_length_cm > 400))
     OR (p_width_cm IS NOT NULL AND (p_width_cm <= 0 OR p_width_cm > 400))
     OR (p_height_cm IS NOT NULL AND (p_height_cm <= 0 OR p_height_cm > 400)) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Dimensions invalides');
  END IF;
  UPDATE public.air_packages
     SET status = 'sealed', gross_weight_kg = p_gross_weight_kg,
         length_cm = p_length_cm, width_cm = p_width_cm, height_cm = p_height_cm,
         sealed_at = now(), sealed_by = v_uid, updated_at = now()
   WHERE id = v_k.id;
  INSERT INTO public.admin_audit_logs (admin_user_id, action_type, target_type, target_id, details)
  VALUES (v_uid, 'air_package_seal', 'air_package', v_k.id,
          jsonb_build_object('description', 'Paquet ' || v_k.package_no || ' fermé : ' || v_n || ' colis, ' || p_gross_weight_kg || ' kg', 'package_no', v_k.package_no, 'parcels', v_n, 'gross_weight_kg', p_gross_weight_kg, 'net_weight_kg', v_net));
  RETURN jsonb_build_object('success', true, 'package', public.air_package_json(v_k.id, true));
END;
$fn$;

-- 4.8 Rouvrir un paquet fermé (ou refusé) qui n'est dans aucune expédition.
CREATE OR REPLACE FUNCTION public.air_package_reopen(p_package_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE v_uid UUID := auth.uid(); v_k public.air_packages;
BEGIN
  IF NOT public.admin_has_permission(v_uid, 'canReceiveParcels') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accès non autorisé');
  END IF;
  SELECT * INTO v_k FROM public.air_packages WHERE id = p_package_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Paquet introuvable'); END IF;
  IF v_k.status = 'open' THEN RETURN jsonb_build_object('success', true, 'package', public.air_package_json(v_k.id, true)); END IF;
  IF v_k.status NOT IN ('sealed','refused') OR v_k.air_shipment_id IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Le paquet ' || v_k.package_no || ' est affecté à une expédition : retirez-le d''abord');
  END IF;
  UPDATE public.air_packages
     SET status = 'open', gross_weight_kg = NULL, sealed_at = NULL, sealed_by = NULL, updated_at = now()
   WHERE id = v_k.id;
  INSERT INTO public.admin_audit_logs (admin_user_id, action_type, target_type, target_id, details)
  VALUES (v_uid, 'air_package_reopen', 'air_package', v_k.id, jsonb_build_object('description', 'Paquet ' || v_k.package_no || ' rouvert', 'package_no', v_k.package_no, 'from', v_k.status));
  RETURN jsonb_build_object('success', true, 'package', public.air_package_json(v_k.id, true));
END;
$fn$;

-- 4.9 Supprimer un paquet ouvert et vide (ouvert par erreur).
CREATE OR REPLACE FUNCTION public.air_package_delete(p_package_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE v_uid UUID := auth.uid(); v_k public.air_packages;
BEGIN
  IF NOT public.admin_has_permission(v_uid, 'canReceiveParcels') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accès non autorisé');
  END IF;
  SELECT * INTO v_k FROM public.air_packages WHERE id = p_package_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Paquet introuvable'); END IF;
  IF v_k.status <> 'open' OR EXISTS (SELECT 1 FROM public.parcels WHERE air_package_id = v_k.id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Seul un paquet ouvert et vide se supprime');
  END IF;
  DELETE FROM public.air_packages WHERE id = v_k.id;
  INSERT INTO public.admin_audit_logs (admin_user_id, action_type, target_type, target_id, details)
  VALUES (v_uid, 'air_package_delete', 'air_package', v_k.id, jsonb_build_object('description', 'Paquet vide ' || v_k.package_no || ' supprimé', 'package_no', v_k.package_no));
  RETURN jsonb_build_object('success', true);
END;
$fn$;

-- 4.10 Affecter des paquets fermés (ou refusés) à une expédition pas encore partie.
--      Leurs colis passent dans l'expédition (« chargés »).
CREATE OR REPLACE FUNCTION public.air_package_assign(p_air_id UUID, p_package_ids UUID[])
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_uid UUID := auth.uid();
  v_a public.air_shipments;
  v_k public.air_packages;
  v_ok UUID[] := ARRAY[]::UUID[];
  v_skipped TEXT[] := ARRAY[]::TEXT[];
  v_parcels INTEGER;
BEGIN
  IF NOT public._air_package_can_ship() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accès non autorisé');
  END IF;
  IF p_package_ids IS NULL OR array_length(p_package_ids, 1) IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Aucun paquet choisi');
  END IF;
  SELECT * INTO v_a FROM public.air_shipments WHERE id = p_air_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Expédition introuvable'); END IF;
  IF v_a.status <> 'PLANNED' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cette expédition est partie : on n''y ajoute plus de paquet');
  END IF;
  FOR v_k IN SELECT * FROM public.air_packages WHERE id = ANY(p_package_ids) ORDER BY id FOR UPDATE LOOP
    IF v_k.status IN ('sealed','refused') AND v_k.air_shipment_id IS NULL THEN
      v_ok := array_append(v_ok, v_k.id);
    ELSE
      v_skipped := array_append(v_skipped, v_k.package_no || CASE
        WHEN v_k.status = 'open' THEN ' (pas encore fermé)'
        WHEN v_k.air_shipment_id IS NOT NULL THEN ' (déjà affecté)'
        ELSE ' (' || v_k.status || ')' END);
    END IF;
  END LOOP;
  IF array_length(v_ok, 1) IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Aucun paquet à affecter : ' || COALESCE(array_to_string(v_skipped, ', '), 'introuvables'));
  END IF;

  UPDATE public.air_packages
     SET air_shipment_id = p_air_id, status = 'sealed', handed_over_at = NULL, handed_over_by = NULL, updated_at = now()
   WHERE id = ANY(v_ok);
  WITH moved AS (
    UPDATE public.parcels
       SET air_shipment_id = p_air_id, status = public.parcel_status_for_air(v_a.status), updated_at = now()
     WHERE air_package_id = ANY(v_ok)
     RETURNING id
  ) SELECT count(*) INTO v_parcels FROM moved;

  INSERT INTO public.admin_audit_logs (admin_user_id, action_type, target_type, target_id, details)
  VALUES (v_uid, 'air_package_assign', 'air_shipment', p_air_id,
          jsonb_build_object('description', array_length(v_ok, 1) || ' paquet(s) affecté(s) à la LTA ' || v_a.awb_number || ' (' || v_parcels || ' colis)',
                             'package_ids', to_jsonb(v_ok), 'parcels', v_parcels, 'skipped', to_jsonb(v_skipped)));
  RETURN jsonb_build_object('success', true, 'assigned', array_length(v_ok, 1), 'parcels', v_parcels, 'skipped', to_jsonb(v_skipped));
END;
$fn$;

-- 4.11 Retirer un paquet d'une expédition pas encore partie : il redevient
--      « fermé », ses colis reviennent au bureau.
CREATE OR REPLACE FUNCTION public.air_package_unassign(p_package_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE v_uid UUID := auth.uid(); v_air UUID; v_a public.air_shipments; v_k public.air_packages;
BEGIN
  IF NOT public._air_package_can_ship() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accès non autorisé');
  END IF;
  SELECT air_shipment_id INTO v_air FROM public.air_packages WHERE id = p_package_id;
  IF v_air IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Ce paquet n''est affecté à aucune expédition'); END IF;
  SELECT * INTO v_a FROM public.air_shipments WHERE id = v_air FOR UPDATE;
  SELECT * INTO v_k FROM public.air_packages WHERE id = p_package_id FOR UPDATE;
  IF v_k.air_shipment_id IS DISTINCT FROM v_a.id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ce paquet vient de changer d''expédition : rechargez la page');
  END IF;
  IF v_a.status <> 'PLANNED' THEN
    RETURN jsonb_build_object('success', false, 'error', 'L''expédition est partie : si l''aéroport a refusé ce paquet, déclarez le refus');
  END IF;
  UPDATE public.air_packages
     SET air_shipment_id = NULL, status = 'sealed', handed_over_at = NULL, handed_over_by = NULL, updated_at = now()
   WHERE id = v_k.id;
  UPDATE public.parcels SET air_shipment_id = NULL, status = 'received', updated_at = now() WHERE air_package_id = v_k.id;
  INSERT INTO public.admin_audit_logs (admin_user_id, action_type, target_type, target_id, details)
  VALUES (v_uid, 'air_package_unassign', 'air_shipment', v_a.id,
          jsonb_build_object('description', 'Paquet ' || v_k.package_no || ' retiré de la LTA ' || v_a.awb_number, 'package_id', v_k.id, 'package_no', v_k.package_no));
  RETURN jsonb_build_object('success', true, 'package', public.air_package_json(v_k.id, true));
END;
$fn$;

-- 4.12 Scanner un paquet au départ (remise au transitaire / à l'aéroport).
CREATE OR REPLACE FUNCTION public.air_package_scan_departure(p_air_id UUID, p_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_uid UUID := auth.uid();
  v_a public.air_shipments;
  v_k public.air_packages;
  v_no TEXT := public.air_package_code(p_code);
  v_already BOOLEAN := false;
BEGIN
  IF NOT public._air_package_can_ship() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accès non autorisé');
  END IF;
  SELECT * INTO v_a FROM public.air_shipments WHERE id = p_air_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Expédition introuvable'); END IF;
  IF v_a.status <> 'PLANNED' THEN RETURN jsonb_build_object('success', false, 'error', 'Cette expédition est déjà partie'); END IF;
  IF v_no IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Ce n''est pas une étiquette de paquet (PQ-000000)'); END IF;
  SELECT * INTO v_k FROM public.air_packages WHERE package_no = v_no FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Paquet ' || v_no || ' introuvable'); END IF;
  IF v_k.air_shipment_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Le paquet ' || v_no || ' n''est affecté à aucune expédition : affectez-le d''abord', 'package_no', v_no);
  END IF;
  IF v_k.air_shipment_id <> p_air_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Le paquet ' || v_no || ' est affecté à une autre expédition', 'package_no', v_no);
  END IF;
  IF v_k.status = 'handed_over' THEN
    v_already := true;
  ELSE
    UPDATE public.air_packages SET status = 'handed_over', handed_over_at = now(), handed_over_by = v_uid, updated_at = now() WHERE id = v_k.id;
  END IF;
  RETURN jsonb_build_object('success', true, 'already', v_already, 'package_no', v_no,
    'scanned', (SELECT count(*) FROM public.air_packages WHERE air_shipment_id = p_air_id AND status = 'handed_over'),
    'total',   (SELECT count(*) FROM public.air_packages WHERE air_shipment_id = p_air_id));
END;
$fn$;

-- 4.13 L'aéroport refuse un paquet (avant ou après le départ de l'avion) :
--      il sort de l'expédition avec ses colis, qui reviennent au bureau ; il
--      garde ses colis et pourra partir par une autre expédition.
CREATE OR REPLACE FUNCTION public.air_package_refuse(p_package_id UUID, p_reason TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_uid UUID := auth.uid();
  v_reason TEXT := NULLIF(btrim(COALESCE(p_reason, '')), '');
  v_air UUID; v_a public.air_shipments; v_k public.air_packages; v_n INTEGER;
BEGIN
  IF NOT public._air_package_can_ship() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accès non autorisé');
  END IF;
  IF v_reason IS NULL OR length(v_reason) < 3 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Indiquez le motif du refus');
  END IF;
  SELECT air_shipment_id INTO v_air FROM public.air_packages WHERE id = p_package_id;
  IF v_air IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Ce paquet n''est affecté à aucune expédition'); END IF;
  SELECT * INTO v_a FROM public.air_shipments WHERE id = v_air FOR UPDATE;
  SELECT * INTO v_k FROM public.air_packages WHERE id = p_package_id FOR UPDATE;
  IF v_k.air_shipment_id IS DISTINCT FROM v_a.id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ce paquet vient de changer d''expédition : rechargez la page');
  END IF;
  IF v_a.status NOT IN ('PLANNED','DEPARTED') OR v_k.status IN ('received','opened') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ce paquet est déjà arrivé à Douala');
  END IF;
  IF EXISTS (SELECT 1 FROM public.parcels WHERE air_package_id = v_k.id AND (checked_in_at IS NOT NULL OR delivered_at IS NOT NULL)) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Des colis de ce paquet sont déjà pointés à Douala');
  END IF;

  UPDATE public.air_packages
     SET status = 'refused', refused_at = now(), refused_by = v_uid, refusal_reason = left(v_reason, 300),
         refused_air_shipment_id = v_a.id, air_shipment_id = NULL, handed_over_at = NULL, handed_over_by = NULL, updated_at = now()
   WHERE id = v_k.id;
  WITH back AS (
    UPDATE public.parcels SET air_shipment_id = NULL, status = 'received', updated_at = now()
     WHERE air_package_id = v_k.id RETURNING id
  ) SELECT count(*) INTO v_n FROM back;

  INSERT INTO public.admin_audit_logs (admin_user_id, action_type, target_type, target_id, details)
  VALUES (v_uid, 'air_package_refused', 'air_shipment', v_a.id,
          jsonb_build_object('description', 'Paquet ' || v_k.package_no || ' refusé à l''aéroport (LTA ' || v_a.awb_number || ') : ' || v_reason,
                             'package_id', v_k.id, 'package_no', v_k.package_no, 'reason', v_reason, 'parcels', v_n, 'air_status', v_a.status));
  -- Après le départ, les clients ont déjà reçu « vos colis sont partis » : l'écran le rappelle.
  RETURN jsonb_build_object('success', true, 'parcels', v_n, 'clients_told_departed', v_a.status = 'DEPARTED',
                            'package', public.air_package_json(v_k.id, true));
END;
$fn$;

-- 4.14 Douala : un paquet arrive à l'entrepôt (scan de son étiquette).
CREATE OR REPLACE FUNCTION public.air_package_receive(p_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_uid UUID := auth.uid();
  v_no TEXT := public.air_package_code(p_code);
  v_k public.air_packages;
  v_air_status TEXT;
  v_already BOOLEAN := false;
BEGIN
  IF NOT public.admin_has_permission(v_uid, 'canReceiveAtDestination') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accès non autorisé');
  END IF;
  IF v_no IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Ce n''est pas une étiquette de paquet (PQ-000000)'); END IF;
  SELECT * INTO v_k FROM public.air_packages WHERE package_no = v_no FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Paquet ' || v_no || ' introuvable'); END IF;
  SELECT status INTO v_air_status FROM public.air_shipments WHERE id = v_k.air_shipment_id;
  IF v_air_status IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Le paquet ' || v_no || ' n''est dans aucune expédition', 'package_no', v_no);
  END IF;
  IF v_air_status NOT IN ('ARRIVED','DELIVERED') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Son expédition n''est pas encore marquée arrivée : demandez à l''admin de poser le jalon', 'package_no', v_no);
  END IF;
  IF v_k.status IN ('received','opened') THEN
    v_already := true;
  ELSE
    UPDATE public.air_packages SET status = 'received', received_at = now(), received_by = v_uid, updated_at = now() WHERE id = v_k.id;
  END IF;
  RETURN jsonb_build_object('success', true, 'already', v_already, 'package_no', v_no,
    'received', (SELECT count(*) FROM public.air_packages WHERE air_shipment_id = v_k.air_shipment_id AND status IN ('received','opened')),
    'total',    (SELECT count(*) FROM public.air_packages WHERE air_shipment_id = v_k.air_shipment_id),
    'package', public.air_package_json(v_k.id, true));
END;
$fn$;

-- 4.15 Douala : ouvrir un paquet reçu (ses colis se pointent ensuite un par un).
CREATE OR REPLACE FUNCTION public.air_package_open(p_package_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE v_uid UUID := auth.uid(); v_k public.air_packages; v_air_status TEXT;
BEGIN
  IF NOT public.admin_has_permission(v_uid, 'canReceiveAtDestination') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accès non autorisé');
  END IF;
  SELECT * INTO v_k FROM public.air_packages WHERE id = p_package_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Paquet introuvable'); END IF;
  SELECT status INTO v_air_status FROM public.air_shipments WHERE id = v_k.air_shipment_id;
  IF v_air_status IS NULL OR v_air_status NOT IN ('ARRIVED','DELIVERED') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Son expédition n''est pas encore marquée arrivée');
  END IF;
  IF v_k.status <> 'opened' THEN
    UPDATE public.air_packages
       SET status = 'opened', received_at = COALESCE(received_at, now()), received_by = COALESCE(received_by, v_uid),
           opened_at = now(), opened_by = v_uid, updated_at = now()
     WHERE id = v_k.id;
  END IF;
  RETURN jsonb_build_object('success', true, 'package', public.air_package_json(v_k.id, true));
END;
$fn$;

-- ─────────────────────────────────────────────────────────────────────────
-- 5. Le reste de la plateforme sait les paquets
-- ─────────────────────────────────────────────────────────────────────────

-- 5.1 Un colis emballé ne se modifie plus d'ici (ni son dépôt) : on le retire du paquet d'abord.
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
    WHEN p.air_package_id IS NOT NULL THEN 'Ce colis est dans le paquet '
      || COALESCE((SELECT k.package_no FROM public.air_packages k WHERE k.id = p.air_package_id), '')
      || ' : retirez-le d''abord du paquet'
    ELSE NULL
  END;
$fn$;

-- 5.2 Les colis chargeables à l'unité ne comptent plus les colis emballés.
CREATE OR REPLACE FUNCTION public.cargo_air_loadable_parcels(p_air_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  IF NOT public.admin_has_permission(auth.uid(), 'canViewCargo') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accès non autorisé');
  END IF;
  RETURN jsonb_build_object('success', true, 'client_user_id', NULL, 'parcels', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'id', p.id, 'seq', p.seq, 'parcel_no', p.parcel_no, 'kind', p.kind, 'weight_kg', p.weight_kg,
      'length_cm', p.length_cm, 'width_cm', p.width_cm, 'height_cm', p.height_cm, 'cbm', p.cbm,
      'description', p.description, 'courier_waybill', p.courier_waybill, 'photo_path', p.photo_path,
      'status', p.status, 'shipment_id', p.shipment_id, 'air_shipment_id', p.air_shipment_id, 'created_at', p.created_at,
      'deposit_no', d.deposit_no, 'deposit_id', d.id, 'location', d.location, 'opened_at', d.opened_at,
      'client', public.reception_client_card(d.client_user_id),
      'quote_status', q.status, 'quote_total_xaf', q.total_xaf, 'quote_paid_xaf', q.amount_paid_xaf
    ) ORDER BY (d.location = 'office') DESC, d.opened_at, p.seq)
    FROM public.parcels p JOIN public.parcel_deposits d ON d.id = p.deposit_id LEFT JOIN public.parcel_quotes q ON q.deposit_id = d.id
    WHERE p.shipment_id IS NULL AND p.air_shipment_id IS NULL AND p.air_package_id IS NULL
      AND p.status IN ('received','stored') AND d.status <> 'cancelled'
  ), '[]'::jsonb));
END;
$fn$;

CREATE OR REPLACE FUNCTION public.reception_loadable_parcels(p_shipment_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE v_client_user UUID;
BEGIN
  IF NOT public.admin_has_permission(auth.uid(), 'canViewCargo') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accès non autorisé');
  END IF;
  SELECT c.user_id INTO v_client_user
  FROM public.cargo_shipments cs LEFT JOIN public.clients c ON c.id = cs.client_id
  WHERE cs.id = p_shipment_id;
  RETURN jsonb_build_object('success', true, 'client_user_id', v_client_user, 'parcels', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'id', p.id, 'seq', p.seq, 'parcel_no', p.parcel_no, 'kind', p.kind, 'weight_kg', p.weight_kg,
      'length_cm', p.length_cm, 'width_cm', p.width_cm, 'height_cm', p.height_cm, 'cbm', p.cbm,
      'description', p.description, 'courier_waybill', p.courier_waybill, 'photo_path', p.photo_path,
      'status', p.status, 'shipment_id', p.shipment_id, 'created_at', p.created_at,
      'deposit_no', d.deposit_no, 'deposit_id', d.id, 'location', d.location, 'opened_at', d.opened_at,
      'client', public.reception_client_card(d.client_user_id)
    ) ORDER BY d.opened_at, p.seq)
    FROM public.parcels p JOIN public.parcel_deposits d ON d.id = p.deposit_id
    WHERE p.shipment_id IS NULL AND p.air_package_id IS NULL AND p.status IN ('received','stored') AND d.status <> 'cancelled'
      AND (v_client_user IS NULL OR d.client_user_id = v_client_user)
  ), '[]'::jsonb));
END;
$fn$;

-- 5.3 Les jalons d'une expédition : le départ exige ses paquets scannés ; une
--     arrivée dont des colis sont pointés à Douala ne s'annule plus.
CREATE OR REPLACE FUNCTION public.cargo_air_set_status(p_air_id UUID, p_status TEXT, p_at TIMESTAMPTZ DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE v_uid UUID := auth.uid(); v_a public.air_shipments; v_at TIMESTAMPTZ := COALESCE(p_at, now()); v_left INTEGER;
BEGIN
  IF NOT public.admin_has_permission(v_uid, 'canManageCargo') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accès non autorisé');
  END IF;
  IF p_status NOT IN ('PLANNED','DEPARTED','ARRIVED') THEN RETURN jsonb_build_object('success', false, 'error', 'Jalon inconnu'); END IF;
  IF v_at > now() + interval '1 day' THEN RETURN jsonb_build_object('success', false, 'error', 'La date est dans le futur'); END IF;
  SELECT * INTO v_a FROM public.air_shipments WHERE id = p_air_id FOR UPDATE;
  IF v_a.id IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Expédition introuvable'); END IF;
  IF v_a.status = 'DELIVERED' THEN RETURN jsonb_build_object('success', false, 'error', 'Cette expédition est livrée : elle ne bouge plus'); END IF;
  IF v_a.status = p_status THEN RETURN jsonb_build_object('success', true, 'shipment', public.cargo_air_json(v_a.id, true)); END IF;
  IF p_status = 'DEPARTED' AND NOT EXISTS (SELECT 1 FROM public.parcels WHERE air_shipment_id = v_a.id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Aucun colis chargé : rien ne part');
  END IF;
  IF p_status = 'DEPARTED' AND v_a.status = 'PLANNED' THEN
    SELECT count(*) INTO v_left FROM public.air_packages WHERE air_shipment_id = v_a.id AND status <> 'handed_over';
    IF v_left > 0 THEN
      RETURN jsonb_build_object('success', false, 'error',
        v_left || ' paquet(s) pas encore scanné(s) au départ : scannez-les, ou retirez-les de l''expédition');
    END IF;
  END IF;
  -- Un cran à la fois, dans les deux sens.
  IF (v_a.status = 'PLANNED' AND p_status = 'ARRIVED') OR (v_a.status = 'ARRIVED' AND p_status = 'PLANNED') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Un jalon à la fois : ' || CASE WHEN p_status = 'ARRIVED' THEN 'marquez d''abord le départ' ELSE 'revenez d''abord à « parti »' END);
  END IF;
  -- Une arrivée déjà travaillée à Douala ne se défait pas : les colis pointés redeviendraient « en vol ».
  -- Verrouiller d'abord ce qu'on vérifie (colis, puis paquets : l'ordre du pointage, qui verrouille le
  -- colis puis son paquet) : un pointage ou une réception concurrents attendent ce jalon, ou le font refuser.
  IF v_a.status = 'ARRIVED' THEN
    PERFORM 1 FROM public.parcels WHERE air_shipment_id = v_a.id ORDER BY id FOR UPDATE;
    PERFORM 1 FROM public.air_packages WHERE air_shipment_id = v_a.id ORDER BY id FOR UPDATE;
  END IF;
  IF v_a.status = 'ARRIVED' AND (
       EXISTS (SELECT 1 FROM public.parcels WHERE air_shipment_id = v_a.id AND (checked_in_at IS NOT NULL OR delivered_at IS NOT NULL OR condition = 'missing'))
    OR EXISTS (SELECT 1 FROM public.air_packages WHERE air_shipment_id = v_a.id AND status IN ('received','opened'))) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Des colis ou des paquets sont déjà reçus à Douala : l''arrivée ne s''annule plus');
  END IF;
  UPDATE public.air_shipments SET
    status      = p_status,
    departed_at = CASE p_status WHEN 'DEPARTED' THEN COALESCE(CASE WHEN v_a.status = 'ARRIVED' THEN departed_at END, v_at) WHEN 'PLANNED' THEN NULL ELSE departed_at END,
    arrived_at  = CASE p_status WHEN 'ARRIVED' THEN v_at ELSE NULL END,
    updated_at  = now()
  WHERE id = v_a.id;
  INSERT INTO public.admin_audit_logs (admin_user_id, action_type, target_type, target_id, details)
  VALUES (v_uid, 'air_shipment_status', 'air_shipment', v_a.id,
          jsonb_build_object('description', 'LTA ' || v_a.awb_number || ' : ' || v_a.status || ' → ' || p_status, 'awb_number', v_a.awb_number, 'from', v_a.status, 'to', p_status, 'at', v_at));
  RETURN jsonb_build_object('success', true, 'shipment', public.cargo_air_json(v_a.id, true));
END;
$fn$;

-- 5.4 L'expédition : ses paquets, et pour chaque colis son paquet.
CREATE OR REPLACE FUNCTION public.cargo_air_json(p_air_id UUID, p_with_parcels BOOLEAN DEFAULT true)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT jsonb_build_object(
    'id', a.id, 'awb_number', a.awb_number, 'awb_provisional', a.awb_number LIKE 'PROV-%',
    'airline', a.airline, 'flight_no', a.flight_no,
    'origin', a.origin, 'destination', a.destination, 'status', a.status,
    'etd', a.etd, 'eta', a.eta, 'departed_at', a.departed_at, 'arrived_at', a.arrived_at, 'delivered_at', a.delivered_at,
    'freight_usd', a.freight_usd, 'notes', a.notes, 'created_at', a.created_at, 'updated_at', a.updated_at,
    'parcel_count',    (SELECT count(*) FROM public.parcels p WHERE p.air_shipment_id = a.id),
    'total_weight_kg', (SELECT COALESCE(sum(p.weight_kg), 0) FROM public.parcels p WHERE p.air_shipment_id = a.id),
    'total_cbm',       (SELECT COALESCE(sum(p.cbm), 0) FROM public.parcels p WHERE p.air_shipment_id = a.id),
    'client_count',    (SELECT count(DISTINCT d.client_user_id) FROM public.parcels p JOIN public.parcel_deposits d ON d.id = p.deposit_id WHERE p.air_shipment_id = a.id),
    'unpaid_count',    (SELECT count(*) FROM public.parcels p JOIN public.parcel_deposits d ON d.id = p.deposit_id LEFT JOIN public.parcel_quotes q ON q.deposit_id = d.id
                        WHERE p.air_shipment_id = a.id AND (q.id IS NULL OR q.amount_paid_xaf < q.total_xaf OR q.total_xaf <= 0)),
    'checked_count',   (SELECT count(*) FROM public.parcels p WHERE p.air_shipment_id = a.id AND p.checked_in_at IS NOT NULL),
    'missing_count',   (SELECT count(*) FROM public.parcels p WHERE p.air_shipment_id = a.id AND p.condition = 'missing'),
    'delivered_count', (SELECT count(*) FROM public.parcels p WHERE p.air_shipment_id = a.id AND p.delivered_at IS NOT NULL),
    'package_count',   (SELECT count(*) FROM public.air_packages k WHERE k.air_shipment_id = a.id),
    'packages_handed_over', (SELECT count(*) FROM public.air_packages k WHERE k.air_shipment_id = a.id AND k.status = 'handed_over'),
    'packages_received',    (SELECT count(*) FROM public.air_packages k WHERE k.air_shipment_id = a.id AND k.status IN ('received','opened')),
    'packages', COALESCE((SELECT jsonb_agg(public.air_package_json(k.id, false) ORDER BY k.seq)
                            FROM public.air_packages k WHERE k.air_shipment_id = a.id), '[]'::jsonb),
    'parcels', CASE WHEN p_with_parcels THEN COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', p.id, 'seq', p.seq, 'parcel_no', p.parcel_no, 'kind', p.kind, 'weight_kg', p.weight_kg,
        'length_cm', p.length_cm, 'width_cm', p.width_cm, 'height_cm', p.height_cm, 'cbm', p.cbm,
        'description', p.description, 'courier_waybill', p.courier_waybill, 'photo_path', p.photo_path,
        'status', p.status, 'shipment_id', p.shipment_id, 'air_shipment_id', p.air_shipment_id, 'awb_number', a.awb_number, 'created_at', p.created_at,
        'air_package_id', p.air_package_id, 'package_no', k.package_no,
        'checked_in_at', p.checked_in_at, 'warehouse_location', p.warehouse_location, 'condition', p.condition, 'condition_note', p.condition_note,
        'delivered_at', p.delivered_at, 'release_id', p.release_id,
        'deposit_no', d.deposit_no, 'deposit_id', d.id, 'location', d.location, 'opened_at', d.opened_at,
        'client', public.reception_client_card(d.client_user_id),
        'quote_status', q.status, 'quote_no', q.quote_no, 'quote_total_xaf', q.total_xaf, 'quote_paid_xaf', q.amount_paid_xaf, 'invoice_no', q.invoice_no
      ) ORDER BY d.client_user_id, d.opened_at, p.seq)
      FROM public.parcels p JOIN public.parcel_deposits d ON d.id = p.deposit_id LEFT JOIN public.parcel_quotes q ON q.deposit_id = d.id
      LEFT JOIN public.air_packages k ON k.id = p.air_package_id
      WHERE p.air_shipment_id = a.id), '[]'::jsonb) ELSE NULL END
  )
  FROM public.air_shipments a WHERE a.id = p_air_id;
$fn$;

-- 5.5 Un colis vu de Douala dit son paquet.
CREATE OR REPLACE FUNCTION public.warehouse_parcel_json(p_parcel_id UUID)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT jsonb_build_object(
    'id', p.id, 'seq', p.seq, 'parcel_no', p.parcel_no, 'kind', p.kind, 'weight_kg', p.weight_kg,
    'length_cm', p.length_cm, 'width_cm', p.width_cm, 'height_cm', p.height_cm, 'cbm', p.cbm,
    'description', p.description, 'courier_waybill', p.courier_waybill, 'photo_path', p.photo_path,
    'status', p.status, 'shipment_id', p.shipment_id, 'air_shipment_id', p.air_shipment_id, 'created_at', p.created_at,
    'container_number', (SELECT cs.container_number FROM public.cargo_shipments cs WHERE cs.id = p.shipment_id),
    'awb_number', (SELECT a.awb_number FROM public.air_shipments a WHERE a.id = p.air_shipment_id),
    'air_package_id', p.air_package_id,
    'package_no', (SELECT k.package_no FROM public.air_packages k WHERE k.id = p.air_package_id),
    'checked_in_at', p.checked_in_at, 'warehouse_location', p.warehouse_location, 'condition', p.condition, 'condition_note', p.condition_note,
    'delivered_at', p.delivered_at, 'release_id', p.release_id,
    'release_no', (SELECT r.release_no FROM public.parcel_releases r WHERE r.id = p.release_id),
    'deposit_no', d.deposit_no, 'deposit_id', d.id, 'location', d.location, 'opened_at', d.opened_at,
    'client', public.reception_client_card(d.client_user_id),
    'quote_id', q.id, 'quote_status', q.status, 'quote_no', q.quote_no, 'quote_total_xaf', q.total_xaf, 'quote_paid_xaf', q.amount_paid_xaf, 'invoice_no', q.invoice_no
  )
  FROM public.parcels p JOIN public.parcel_deposits d ON d.id = p.deposit_id LEFT JOIN public.parcel_quotes q ON q.deposit_id = d.id
  WHERE p.id = p_parcel_id;
$fn$;

-- 5.6 L'arrivée d'un avion à Douala : ses paquets (reçus ou pas) avec ses colis.
CREATE OR REPLACE FUNCTION public.warehouse_arrival_parcels(p_kind TEXT, p_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE v_uid UUID := auth.uid(); v_label TEXT; v_sub TEXT;
BEGIN
  IF NOT public.admin_has_permission(v_uid, 'canReceiveAtDestination') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accès non autorisé');
  END IF;
  IF p_kind = 'air' THEN
    SELECT CASE WHEN a.awb_number LIKE 'PROV-%' THEN 'Expédition' || COALESCE(' du ' || to_char(a.etd, 'DD/MM'), '') ELSE 'LTA ' || a.awb_number END,
           COALESCE(a.flight_no || ' · ', '') || COALESCE(a.airline, '')
      INTO v_label, v_sub FROM public.air_shipments a WHERE a.id = p_id;
  ELSIF p_kind = 'sea' THEN
    SELECT cs.container_number, cs.client_label INTO v_label, v_sub FROM public.cargo_shipments cs WHERE cs.id = p_id;
  ELSE
    RETURN jsonb_build_object('success', false, 'error', 'Type inconnu');
  END IF;
  IF v_label IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Arrivée introuvable'); END IF;
  RETURN jsonb_build_object('success', true, 'kind', p_kind, 'id', p_id, 'label', v_label, 'sub', v_sub,
    'packages', CASE WHEN p_kind = 'air' THEN COALESCE((
      SELECT jsonb_agg(public.air_package_json(k.id, false) ORDER BY k.seq)
      FROM public.air_packages k WHERE k.air_shipment_id = p_id), '[]'::jsonb) ELSE '[]'::jsonb END,
    'parcels', COALESCE((
      SELECT jsonb_agg(public.warehouse_parcel_json(p.id) ORDER BY d.client_user_id, d.opened_at, p.seq)
      FROM public.parcels p JOIN public.parcel_deposits d ON d.id = p.deposit_id
      WHERE (p_kind = 'air' AND p.air_shipment_id = p_id) OR (p_kind = 'sea' AND p.shipment_id = p_id)
    ), '[]'::jsonb));
END;
$fn$;

-- 5.7 La journée de Douala : une expédition à LTA provisoire se lit « Expédition du JJ/MM », jamais « LTA PROV-… ».
CREATE OR REPLACE FUNCTION public.warehouse_day()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE v_uid UUID := auth.uid(); v_today DATE := (now() AT TIME ZONE 'Africa/Douala')::date;
BEGIN
  IF NOT (public.admin_has_permission(v_uid, 'canReceiveAtDestination') OR public.admin_has_permission(v_uid, 'canReleaseParcels')) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accès non autorisé');
  END IF;
  RETURN jsonb_build_object(
    'success', true,
    'day', v_today,
    'stats', jsonb_build_object(
      'to_checkin', (SELECT count(*) FROM public.parcels p WHERE p.status IN ('shipped','arrived') AND p.checked_in_at IS NULL AND p.delivered_at IS NULL AND COALESCE(p.condition, '') <> 'missing'
                       AND (EXISTS (SELECT 1 FROM public.air_shipments a WHERE a.id = p.air_shipment_id AND a.status = 'ARRIVED')
                         OR EXISTS (SELECT 1 FROM public.cargo_shipments cs WHERE cs.id = p.shipment_id AND cs.status IN ('ARRIVED','DELIVERED')))),
      'waiting', (SELECT count(*) FROM public.parcels p WHERE p.status = 'arrived' AND p.checked_in_at IS NOT NULL AND p.delivered_at IS NULL),
      'missing', (SELECT count(*) FROM public.parcels p WHERE p.condition = 'missing' AND p.delivered_at IS NULL),
      'delivered_today', (SELECT count(*) FROM public.parcels p WHERE p.delivered_at IS NOT NULL AND (p.delivered_at AT TIME ZONE 'Africa/Douala')::date = v_today)
    ),
    -- Les arrivées : un avion arrivé ou une boîte arrivée dont il reste des colis à pointer.
    'arrivals', COALESCE((
      SELECT jsonb_agg(row ORDER BY (row->>'arrived_at') DESC) FROM (
        SELECT jsonb_build_object('kind', 'air', 'id', a.id, 'ref', a.awb_number, 'label', CASE WHEN a.awb_number LIKE 'PROV-%' THEN 'Expédition' || COALESCE(' du ' || to_char(a.etd, 'DD/MM'), '') ELSE 'LTA ' || a.awb_number END, 'sub', COALESCE(a.flight_no || ' · ', '') || COALESCE(a.airline, ''),
          'arrived_at', a.arrived_at,
          'expected', (SELECT count(*) FROM public.parcels p WHERE p.air_shipment_id = a.id AND p.delivered_at IS NULL),
          'checked', (SELECT count(*) FROM public.parcels p WHERE p.air_shipment_id = a.id AND p.checked_in_at IS NOT NULL AND p.delivered_at IS NULL),
          'missing', (SELECT count(*) FROM public.parcels p WHERE p.air_shipment_id = a.id AND p.condition = 'missing'),
          'delivered', (SELECT count(*) FROM public.parcels p WHERE p.air_shipment_id = a.id AND p.delivered_at IS NOT NULL)) AS row
        FROM public.air_shipments a WHERE a.status = 'ARRIVED'
        UNION ALL
        SELECT jsonb_build_object('kind', 'sea', 'id', cs.id, 'ref', cs.container_number, 'label', cs.container_number, 'sub', cs.client_label || COALESCE(' · ' || cs.vessel_name, ''),
          'arrived_at', COALESCE(cs.eta_carrier, cs.last_event_at, cs.updated_at),
          'expected', (SELECT count(*) FROM public.parcels p WHERE p.shipment_id = cs.id AND p.delivered_at IS NULL),
          'checked', (SELECT count(*) FROM public.parcels p WHERE p.shipment_id = cs.id AND p.checked_in_at IS NOT NULL AND p.delivered_at IS NULL),
          'missing', (SELECT count(*) FROM public.parcels p WHERE p.shipment_id = cs.id AND p.condition = 'missing'),
          'delivered', (SELECT count(*) FROM public.parcels p WHERE p.shipment_id = cs.id AND p.delivered_at IS NOT NULL)) AS row
        FROM public.cargo_shipments cs WHERE cs.status IN ('ARRIVED','DELIVERED') AND EXISTS (SELECT 1 FROM public.parcels p WHERE p.shipment_id = cs.id AND p.delivered_at IS NULL)
      ) r), '[]'::jsonb),
    -- Ce qui attend son client, par client : pointé, pas remis.
    'waiting_by_client', COALESCE((
      SELECT jsonb_agg(row ORDER BY (row->>'since')) FROM (
        SELECT jsonb_build_object(
          'client', public.reception_client_card(d.client_user_id),
          'parcels', count(*), 'weight_kg', COALESCE(sum(p.weight_kg), 0), 'since', min(p.checked_in_at),
          'unpaid', bool_or(q.id IS NULL OR q.total_xaf <= 0 OR q.amount_paid_xaf < q.total_xaf),
          'balance_xaf', COALESCE(sum(GREATEST(q.total_xaf - q.amount_paid_xaf, 0)) FILTER (WHERE q.id IS NOT NULL), 0)
        ) AS row
        FROM public.parcels p JOIN public.parcel_deposits d ON d.id = p.deposit_id LEFT JOIN public.parcel_quotes q ON q.deposit_id = d.id
        WHERE p.status = 'arrived' AND p.checked_in_at IS NOT NULL AND p.delivered_at IS NULL
        GROUP BY d.client_user_id
      ) g), '[]'::jsonb),
    'releases_today', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', r.id, 'release_no', r.release_no, 'released_at', r.released_at, 'picked_by_name', r.picked_by_name, 'parcel_count', r.parcel_count,
                                          'client', public.reception_client_card(r.client_user_id)) ORDER BY r.released_at DESC)
      FROM public.parcel_releases r WHERE (r.released_at AT TIME ZONE 'Africa/Douala')::date = v_today), '[]'::jsonb)
  );
END;
$fn$;

-- 5.8 Les messages aux clients au départ et à l'arrivée : la référence est la LTA, ou à défaut
--     le vol, ou les dépôts — jamais une LTA provisoire.
CREATE OR REPLACE FUNCTION public.air_shipments_notify()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE r RECORD; v_flight TEXT; v_awb TEXT;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status OR NEW.status NOT IN ('DEPARTED','ARRIVED') THEN RETURN NEW; END IF;
  v_flight := COALESCE(NEW.flight_no, 'Air cargo');
  -- Une LTA provisoire (PROV-…) n'est pas un numéro que le client peut suivre : on ne l'envoie pas.
  v_awb := CASE WHEN NEW.awb_number LIKE 'PROV-%' THEN NULL ELSE NEW.awb_number END;
  FOR r IN
    SELECT d.client_user_id AS user_id, count(*) AS n, string_agg(DISTINCT d.deposit_no, ', ') AS deposits, (array_agg(d.id ORDER BY d.deposit_no))[1] AS deposit_id
    FROM public.parcels p JOIN public.parcel_deposits d ON d.id = p.deposit_id
    WHERE p.air_shipment_id = NEW.id AND d.client_user_id IS NOT NULL AND p.delivered_at IS NULL
    GROUP BY d.client_user_id
  LOOP
    IF NEW.status = 'DEPARTED' THEN
      PERFORM public.cargo_notify_client(r.user_id, 'parcel_departed',
        'Vos colis ont quitté la Chine',
        'Vos ' || r.n || ' colis (' || r.deposits || ') ont quitté Guangzhou par avion, vol ' || v_flight || COALESCE(', arrivée prévue le ' || to_char(NEW.eta, 'DD/MM'), '') || '.',
        jsonb_build_object('deposit_id', r.deposit_id, 'deposit_no', r.deposits, 'parcel_count', r.n, 'air_shipment_id', NEW.id, 'awb_number', v_awb, 'flight_no', NEW.flight_no, 'eta', NEW.eta, 'reference', COALESCE(v_awb, NULLIF(NEW.flight_no, ''), r.deposits)));
    ELSE
      PERFORM public.cargo_notify_client(r.user_id, 'parcel_arrived',
        'Vos colis sont arrivés à Douala',
        'Vos ' || r.n || ' colis (' || r.deposits || ') sont arrivés à Douala. Nous vous prévenons dès qu''ils sont prêts au retrait.',
        jsonb_build_object('deposit_id', r.deposit_id, 'deposit_no', r.deposits, 'parcel_count', r.n, 'air_shipment_id', NEW.id, 'awb_number', v_awb, 'reference', COALESCE(v_awb, NULLIF(NEW.flight_no, ''), r.deposits)));
    END IF;
  END LOOP;
  RETURN NEW;
END;
$fn$;

-- 5.9 La notification « arrivée à Douala » de l'équipe : le vol, ou la LTA si elle est connue.
create or replace function public.staff_push_on_air_arrival()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_count integer;
begin
  if new.status = 'ARRIVED' and old.status is distinct from new.status then
    select count(*) into v_count from public.parcels where air_shipment_id = new.id;
    if v_count > 0 then
      perform public.send_staff_push('canReceiveAtDestination', 'Arrivée à Douala · avion',
        coalesce(nullif(new.flight_no, ''), case when new.awb_number like 'PROV-%' then null else new.awb_number end, 'Vol') || ' · ' || v_count || ' colis à pointer',
        '/w/arrivees', null, auth.uid());
    end if;
  end if;
  return new;
exception when others then
  raise warning 'staff_push_on_air_arrival: %', sqlerrm;
  return new;
end;
$$;

-- 5.10 Le dépôt, tel que les écrans le lisent : chaque colis dit aussi son paquet.
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
        'air_package_id', p.air_package_id,
        'package_no', (SELECT k.package_no FROM public.air_packages k WHERE k.id = p.air_package_id),
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

-- 5.11 Charger une boîte : un colis emballé dans un paquet avion est sauté, pas une erreur pour tout le lot.
CREATE OR REPLACE FUNCTION public.cargo_load_parcels(p_shipment_id UUID, p_parcel_ids UUID[])
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_uid UUID := auth.uid();
  v_ship public.cargo_shipments;
  v_status TEXT;
  v_n INTEGER; v_kg NUMERIC; v_cbm NUMERIC;
BEGIN
  IF NOT public.admin_has_permission(v_uid, 'canManageCargo') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accès non autorisé');
  END IF;
  SELECT * INTO v_ship FROM public.cargo_shipments WHERE id = p_shipment_id FOR UPDATE;
  IF v_ship.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Boîte introuvable');
  END IF;
  IF v_ship.status = 'DELIVERED' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cette boîte est déjà livrée : on ne charge plus rien dedans');
  END IF;
  IF p_parcel_ids IS NULL OR array_length(p_parcel_ids, 1) IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Aucun colis choisi');
  END IF;
  v_status := public.parcel_status_for_shipment(v_ship.status);
  -- Seuls les colis qui attendent : un colis déjà dans une boîte ne bouge pas d'ici.
  WITH moved AS (
    UPDATE public.parcels p
       SET shipment_id = p_shipment_id, status = v_status, updated_at = now()
     WHERE p.id = ANY(p_parcel_ids) AND p.shipment_id IS NULL AND p.air_package_id IS NULL AND p.status IN ('received','stored')
     RETURNING p.weight_kg, p.cbm
  )
  SELECT count(*), COALESCE(sum(weight_kg), 0), COALESCE(sum(cbm), 0) INTO v_n, v_kg, v_cbm FROM moved;
  IF v_n = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ces colis sont déjà chargés ou introuvables');
  END IF;
  INSERT INTO public.admin_audit_logs (admin_user_id, action_type, target_type, target_id, details)
  VALUES (v_uid, 'load_parcels', 'cargo_shipment', p_shipment_id,
          jsonb_build_object('description', v_n || ' colis chargés dans ' || v_ship.container_number || ' (' || v_kg || ' kg, ' || v_cbm || ' m³)', 'parcel_ids', to_jsonb(p_parcel_ids), 'count', v_n, 'weight_kg', v_kg, 'cbm', v_cbm));
  RETURN jsonb_build_object('success', true, 'loaded', v_n, 'weight_kg', v_kg, 'cbm', v_cbm, 'status', v_status);
END;
$fn$;

-- 5.12 Charger un avion colis par colis : même règle (le colis emballé part avec son paquet).
CREATE OR REPLACE FUNCTION public.cargo_air_load_parcels(p_air_id UUID, p_parcel_ids UUID[])
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE v_uid UUID := auth.uid(); v_a public.air_shipments; v_status TEXT; v_n INTEGER; v_kg NUMERIC; v_cbm NUMERIC;
BEGIN
  IF NOT public.admin_has_permission(v_uid, 'canManageCargo') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accès non autorisé');
  END IF;
  SELECT * INTO v_a FROM public.air_shipments WHERE id = p_air_id FOR UPDATE;
  IF v_a.id IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Expédition introuvable'); END IF;
  IF v_a.status IN ('ARRIVED','DELIVERED') THEN RETURN jsonb_build_object('success', false, 'error', 'Cet avion est déjà arrivé : on ne charge plus rien dedans'); END IF;
  IF p_parcel_ids IS NULL OR array_length(p_parcel_ids, 1) IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Aucun colis choisi'); END IF;
  v_status := public.parcel_status_for_air(v_a.status);
  WITH moved AS (
    UPDATE public.parcels p
       SET air_shipment_id = p_air_id, status = v_status, updated_at = now()
     WHERE p.id = ANY(p_parcel_ids) AND p.shipment_id IS NULL AND p.air_shipment_id IS NULL AND p.air_package_id IS NULL AND p.status IN ('received','stored')
     RETURNING p.weight_kg, p.cbm
  )
  SELECT count(*), COALESCE(sum(weight_kg), 0), COALESCE(sum(cbm), 0) INTO v_n, v_kg, v_cbm FROM moved;
  IF v_n = 0 THEN RETURN jsonb_build_object('success', false, 'error', 'Ces colis sont déjà chargés ou introuvables'); END IF;
  INSERT INTO public.admin_audit_logs (admin_user_id, action_type, target_type, target_id, details)
  VALUES (v_uid, 'air_load_parcels', 'air_shipment', p_air_id,
          jsonb_build_object('description', v_n || ' colis chargés dans la LTA ' || v_a.awb_number || ' (' || v_kg || ' kg)', 'parcel_ids', to_jsonb(p_parcel_ids), 'count', v_n, 'weight_kg', v_kg, 'cbm', v_cbm));
  RETURN jsonb_build_object('success', true, 'loaded', v_n, 'weight_kg', v_kg, 'cbm', v_cbm, 'status', v_status);
END;
$fn$;

-- 5.13 Retirer un colis d'un avion : un colis emballé ne sort qu'avec son paquet.
CREATE OR REPLACE FUNCTION public.cargo_air_unload_parcel(p_parcel_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE v_uid UUID := auth.uid(); v_p public.parcels; v_a public.air_shipments;
BEGIN
  IF NOT public.admin_has_permission(v_uid, 'canManageCargo') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accès non autorisé');
  END IF;
  SELECT * INTO v_p FROM public.parcels WHERE id = p_parcel_id FOR UPDATE;
  IF v_p.id IS NULL OR v_p.air_shipment_id IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Ce colis n''est pas dans un avion'); END IF;
  IF v_p.air_package_id IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ce colis voyage dans le paquet '
      || COALESCE((SELECT k.package_no FROM public.air_packages k WHERE k.id = v_p.air_package_id), '')
      || ' : retirez le paquet de l''expédition');
  END IF;
  SELECT * INTO v_a FROM public.air_shipments WHERE id = v_p.air_shipment_id;
  IF v_a.status <> 'PLANNED' THEN RETURN jsonb_build_object('success', false, 'error', 'L''avion est parti : le colis ne se retire plus'); END IF;
  UPDATE public.parcels SET air_shipment_id = NULL, status = 'received', updated_at = now() WHERE id = v_p.id;
  INSERT INTO public.admin_audit_logs (admin_user_id, action_type, target_type, target_id, details)
  VALUES (v_uid, 'air_unload_parcel', 'air_shipment', v_a.id,
          jsonb_build_object('description', 'Colis ' || v_p.parcel_no || ' retiré de la LTA ' || v_a.awb_number, 'parcel_id', v_p.id, 'parcel_no', v_p.parcel_no));
  RETURN jsonb_build_object('success', true);
END;
$fn$;

-- ─────────────────────────────────────────────────────────────────────────
-- 6. LTA provisoire : l'expédition s'ouvre avant que la LTA soit connue
-- ─────────────────────────────────────────────────────────────────────────
-- p_awb_number vide → « PROV-XXXXXX » ; la vraie LTA se pose ensuite, même
-- l'avion parti (une LTA réelle, elle, ne change plus après le départ).
CREATE OR REPLACE FUNCTION public.cargo_air_create(
  p_awb_number TEXT,
  p_airline TEXT DEFAULT NULL,
  p_flight_no TEXT DEFAULT NULL,
  p_etd DATE DEFAULT NULL,
  p_eta DATE DEFAULT NULL,
  p_origin TEXT DEFAULT NULL,
  p_destination TEXT DEFAULT NULL,
  p_freight_usd NUMERIC DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE v_uid UUID := auth.uid(); v_awb TEXT; v_id UUID; v_prov BOOLEAN;
BEGIN
  IF NOT public.admin_has_permission(v_uid, 'canManageCargo') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accès non autorisé');
  END IF;
  v_awb := upper(regexp_replace(COALESCE(p_awb_number, ''), '\s+', '', 'g'));
  v_prov := v_awb = '';
  IF v_prov THEN
    IF p_etd IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Sans LTA, indiquez au moins la date de départ prévue'); END IF;
    LOOP
      v_awb := 'PROV-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
      EXIT WHEN NOT EXISTS (SELECT 1 FROM public.air_shipments WHERE awb_number = v_awb);
    END LOOP;
  ELSE
    IF length(v_awb) < 4 THEN RETURN jsonb_build_object('success', false, 'error', 'Numéro de LTA trop court'); END IF;
    IF v_awb LIKE 'PROV-%' THEN RETURN jsonb_build_object('success', false, 'error', 'Ce numéro est réservé aux LTA provisoires'); END IF;
    IF EXISTS (SELECT 1 FROM public.air_shipments WHERE awb_number = v_awb) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Cette LTA existe déjà');
    END IF;
  END IF;
  IF p_freight_usd IS NOT NULL AND p_freight_usd < 0 THEN RETURN jsonb_build_object('success', false, 'error', 'Le fret ne peut pas être négatif'); END IF;
  INSERT INTO public.air_shipments (awb_number, airline, flight_no, etd, eta, origin, destination, freight_usd, notes, created_by)
  VALUES (v_awb, NULLIF(TRIM(p_airline), ''), NULLIF(upper(TRIM(p_flight_no)), ''), p_etd, p_eta,
          COALESCE(NULLIF(TRIM(p_origin), ''), 'Guangzhou (CAN)'), COALESCE(NULLIF(TRIM(p_destination), ''), 'Douala (DLA)'),
          p_freight_usd, NULLIF(TRIM(p_notes), ''), v_uid)
  RETURNING id INTO v_id;
  INSERT INTO public.admin_audit_logs (admin_user_id, action_type, target_type, target_id, details)
  VALUES (v_uid, 'create_air_shipment', 'air_shipment', v_id,
          jsonb_build_object('description', 'Expédition aérienne ouverte : ' || CASE WHEN v_prov THEN 'LTA à venir (' || v_awb || ')' ELSE 'LTA ' || v_awb END
                                            || COALESCE(' · vol ' || upper(TRIM(p_flight_no)), ''), 'awb_number', v_awb, 'etd', p_etd, 'provisional', v_prov));
  RETURN jsonb_build_object('success', true, 'shipment', public.cargo_air_json(v_id, true));
END;
$fn$;

CREATE OR REPLACE FUNCTION public.cargo_air_update(
  p_air_id UUID,
  p_awb_number TEXT DEFAULT NULL,
  p_airline TEXT DEFAULT NULL,
  p_flight_no TEXT DEFAULT NULL,
  p_etd DATE DEFAULT NULL,
  p_eta DATE DEFAULT NULL,
  p_origin TEXT DEFAULT NULL,
  p_destination TEXT DEFAULT NULL,
  p_freight_usd NUMERIC DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE v_uid UUID := auth.uid(); v_a public.air_shipments; v_awb TEXT;
BEGIN
  IF NOT public.admin_has_permission(v_uid, 'canManageCargo') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accès non autorisé');
  END IF;
  SELECT * INTO v_a FROM public.air_shipments WHERE id = p_air_id FOR UPDATE;
  IF v_a.id IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Expédition introuvable'); END IF;
  v_awb := v_a.awb_number;
  IF p_awb_number IS NOT NULL AND btrim(p_awb_number) <> '' AND upper(regexp_replace(p_awb_number, '\s+', '', 'g')) <> v_a.awb_number THEN
    -- Une LTA réelle ne change plus une fois l'avion parti ; une LTA provisoire se remplace toujours.
    IF v_a.status <> 'PLANNED' AND v_a.awb_number NOT LIKE 'PROV-%' THEN
      RETURN jsonb_build_object('success', false, 'error', 'La LTA ne change plus une fois l''avion parti');
    END IF;
    v_awb := upper(regexp_replace(p_awb_number, '\s+', '', 'g'));
    IF length(v_awb) < 4 THEN RETURN jsonb_build_object('success', false, 'error', 'Numéro de LTA trop court'); END IF;
    IF v_awb LIKE 'PROV-%' THEN RETURN jsonb_build_object('success', false, 'error', 'Ce numéro est réservé aux LTA provisoires'); END IF;
    IF EXISTS (SELECT 1 FROM public.air_shipments WHERE awb_number = v_awb AND id <> v_a.id) THEN RETURN jsonb_build_object('success', false, 'error', 'Cette LTA existe déjà'); END IF;
    INSERT INTO public.admin_audit_logs (admin_user_id, action_type, target_type, target_id, details)
    VALUES (v_uid, 'air_shipment_awb', 'air_shipment', v_a.id,
            jsonb_build_object('description', 'LTA ' || v_a.awb_number || ' → ' || v_awb, 'from', v_a.awb_number, 'to', v_awb));
  END IF;
  IF p_freight_usd IS NOT NULL AND p_freight_usd < 0 THEN RETURN jsonb_build_object('success', false, 'error', 'Le fret ne peut pas être négatif'); END IF;
  UPDATE public.air_shipments SET
    awb_number  = v_awb,
    airline     = CASE WHEN p_airline IS NULL THEN airline ELSE NULLIF(TRIM(p_airline), '') END,
    flight_no   = CASE WHEN p_flight_no IS NULL THEN flight_no ELSE NULLIF(upper(TRIM(p_flight_no)), '') END,
    etd         = COALESCE(p_etd, etd),
    eta         = COALESCE(p_eta, eta),
    origin      = COALESCE(NULLIF(TRIM(p_origin), ''), origin),
    destination = COALESCE(NULLIF(TRIM(p_destination), ''), destination),
    freight_usd = COALESCE(p_freight_usd, freight_usd),
    notes       = CASE WHEN p_notes IS NULL THEN notes ELSE NULLIF(TRIM(p_notes), '') END,
    updated_at  = now()
  WHERE id = v_a.id;
  RETURN jsonb_build_object('success', true, 'shipment', public.cargo_air_json(v_a.id, true));
END;
$fn$;

-- ─────────────────────────────────────────────────────────────────────────
-- 7. Droits et étiquettes Mola
-- ─────────────────────────────────────────────────────────────────────────
-- Aides internes : jamais appelables depuis l'API.
REVOKE ALL ON FUNCTION public.air_package_json(UUID, BOOLEAN) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._air_package_can_read() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._air_package_can_ship() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.parcels_package_guard() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.air_packages_follow_checkin() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reception_parcel_locked(public.parcels) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cargo_air_json(UUID, BOOLEAN) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.warehouse_parcel_json(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reception_deposit_json(UUID) FROM PUBLIC, anon, authenticated;
-- Lecteurs de code : purs, sans données.
REVOKE ALL ON FUNCTION public.air_package_code(TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.parcel_code(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.air_package_code(TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.parcel_code(TEXT) TO authenticated, service_role;

DO $$
DECLARE f TEXT;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'public.air_package_list(text, uuid)',
    'public.air_package_get(uuid, text)',
    'public.air_package_create(text)',
    'public.air_package_add_parcel(uuid, text)',
    'public.air_package_remove_parcel(uuid)',
    'public.air_package_seal(uuid, numeric, numeric, numeric, numeric)',
    'public.air_package_reopen(uuid)',
    'public.air_package_delete(uuid)',
    'public.air_package_assign(uuid, uuid[])',
    'public.air_package_unassign(uuid)',
    'public.air_package_scan_departure(uuid, text)',
    'public.air_package_refuse(uuid, text)',
    'public.air_package_receive(text)',
    'public.air_package_open(uuid)',
    'public.cargo_air_loadable_parcels(uuid)',
    'public.reception_loadable_parcels(uuid)',
    'public.cargo_air_set_status(uuid, text, timestamptz)',
    'public.warehouse_arrival_parcels(text, uuid)',
    'public.cargo_air_create(text, text, text, date, date, text, text, numeric, text)',
    'public.cargo_air_update(uuid, text, text, text, date, date, text, text, numeric, text)',
    'public.warehouse_day()',
    'public.cargo_load_parcels(uuid, uuid[])',
    'public.cargo_air_load_parcels(uuid, uuid[])',
    'public.cargo_air_unload_parcel(uuid)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', f);
  END LOOP;
END $$;

COMMENT ON FUNCTION public.air_package_list(text, uuid) IS
  '@mola:{"expose":true,"kind":"read","permission":"canViewCargo","label":"Les paquets avion de 32 kg : au bureau (en cours, fermés, refusés, pas encore partis), ou ceux d''une expédition"}';
COMMENT ON FUNCTION public.air_package_get(uuid, text) IS
  '@mola:{"expose":true,"kind":"read","permission":"canViewCargo","label":"Un paquet avion (par son numéro PQ-…) : poids, expédition, colis et clients"}';
COMMENT ON FUNCTION public.air_package_create(text) IS
  '@mola:{"expose":true,"kind":"write","permission":"canReceiveParcels","confirm":true,"danger":false,"label":"Ouvrir un nouveau paquet avion (32 kg au plus)"}';
COMMENT ON FUNCTION public.air_package_add_parcel(uuid, text) IS
  '@mola:{"expose":true,"kind":"write","permission":"canReceiveParcels","confirm":true,"danger":false,"label":"Mettre un colis avion (RC-…) dans un paquet ouvert"}';
COMMENT ON FUNCTION public.air_package_remove_parcel(uuid) IS
  '@mola:{"expose":true,"kind":"write","permission":"canReceiveParcels","confirm":true,"danger":false,"label":"Retirer un colis d''un paquet encore ouvert"}';
COMMENT ON FUNCTION public.air_package_seal(uuid, numeric, numeric, numeric, numeric) IS
  '@mola:{"expose":true,"kind":"write","permission":"canReceiveParcels","confirm":true,"danger":false,"label":"Fermer un paquet avion : poids pesé (32 kg au plus) et dimensions"}';
COMMENT ON FUNCTION public.air_package_reopen(uuid) IS
  '@mola:{"expose":true,"kind":"write","permission":"canReceiveParcels","confirm":true,"danger":false,"label":"Rouvrir un paquet fermé qui n''est dans aucune expédition"}';
COMMENT ON FUNCTION public.air_package_delete(uuid) IS
  '@mola:{"expose":true,"kind":"write","permission":"canReceiveParcels","confirm":true,"danger":false,"label":"Supprimer un paquet ouvert et vide"}';
COMMENT ON FUNCTION public.air_package_assign(uuid, uuid[]) IS
  '@mola:{"expose":true,"kind":"write","permission":"canReceiveParcels","confirm":true,"danger":false,"label":"Affecter des paquets fermés à une expédition aérienne pas encore partie"}';
COMMENT ON FUNCTION public.air_package_unassign(uuid) IS
  '@mola:{"expose":true,"kind":"write","permission":"canReceiveParcels","confirm":true,"danger":false,"label":"Retirer un paquet d''une expédition pas encore partie"}';
COMMENT ON FUNCTION public.air_package_scan_departure(uuid, text) IS
  '@mola:{"expose":true,"kind":"write","permission":"canReceiveParcels","confirm":false,"danger":false,"label":"Scanner un paquet au départ (remise à l''aéroport)"}';
COMMENT ON FUNCTION public.air_package_refuse(uuid, text) IS
  '@mola:{"expose":true,"kind":"write","permission":"canReceiveParcels","confirm":true,"danger":true,"label":"Déclarer un paquet refusé à l''aéroport (motif) : il sort de l''expédition avec ses colis"}';
COMMENT ON FUNCTION public.air_package_receive(text) IS
  '@mola:{"expose":true,"kind":"write","permission":"canReceiveAtDestination","confirm":false,"danger":false,"label":"Douala : recevoir un paquet à l''entrepôt (scan PQ-…)"}';
COMMENT ON FUNCTION public.air_package_open(uuid) IS
  '@mola:{"expose":true,"kind":"write","permission":"canReceiveAtDestination","confirm":false,"danger":false,"label":"Douala : ouvrir un paquet reçu pour pointer ses colis"}';
COMMENT ON FUNCTION public.air_package_json(uuid, boolean) IS
  '@mola:{"expose":false,"kind":"read","permission":"canViewCargo","label":"Sérialiser un paquet avion (helper interne)"}';
COMMENT ON FUNCTION public._air_package_can_read() IS
  '@mola:{"expose":false,"kind":"read","permission":"canViewCargo","label":"Interne : peut lire les paquets"}';
COMMENT ON FUNCTION public._air_package_can_ship() IS
  '@mola:{"expose":false,"kind":"read","permission":"canReceiveParcels","label":"Interne : peut envoyer les paquets à l''aéroport"}';
COMMENT ON FUNCTION public.air_package_code(text) IS
  '@mola:{"expose":false,"kind":"read","permission":"canViewCargo","label":"Interne : lire un numéro de paquet scanné"}';
COMMENT ON FUNCTION public.parcel_code(text) IS
  '@mola:{"expose":false,"kind":"read","permission":"canViewCargo","label":"Interne : lire un numéro de colis scanné"}';
COMMENT ON FUNCTION public.parcels_package_guard() IS
  '@mola:{"expose":false,"kind":"write","permission":"canManageCargo","label":"Interne : un colis emballé suit son paquet"}';
COMMENT ON FUNCTION public.air_packages_follow_checkin() IS
  '@mola:{"expose":false,"kind":"write","permission":"canReceiveAtDestination","label":"Interne : pointer un colis ouvre son paquet"}';
COMMENT ON FUNCTION public.reception_parcel_locked(public.parcels) IS
  '@mola:{"expose":false,"kind":"read","permission":"canReceiveParcels","confirm":false,"danger":false,"label":"Dire pourquoi un colis ne se modifie plus (helper interne)"}';
COMMENT ON FUNCTION public.cargo_air_loadable_parcels(uuid) IS
  '@mola:{"expose":true,"kind":"read","permission":"canViewCargo","confirm":false,"danger":false,"label":"Les colis reçus (hors paquets) qu''on peut mettre dans une expédition aérienne"}';
COMMENT ON FUNCTION public.reception_loadable_parcels(uuid) IS
  '@mola:{"expose":true,"kind":"read","permission":"canViewCargo","confirm":false,"danger":false,"label":"Les colis reçus qu''on peut charger dans une boîte"}';
COMMENT ON FUNCTION public.cargo_air_set_status(uuid, text, timestamptz) IS
  '@mola:{"expose":true,"kind":"write","permission":"canManageCargo","confirm":true,"danger":false,"label":"Poser un jalon sur une expédition aérienne : parti (paquets scannés), arrivé (les colis suivent)"}';
COMMENT ON FUNCTION public.cargo_air_json(uuid, boolean) IS
  '@mola:{"expose":false,"kind":"read","permission":"canViewCargo","confirm":false,"danger":false,"label":"Sérialiser une expédition aérienne (helper interne)"}';
COMMENT ON FUNCTION public.warehouse_parcel_json(uuid) IS
  '@mola:{"expose":false,"kind":"read","permission":"canReceiveAtDestination","confirm":false,"danger":false,"label":"Sérialiser un colis vu de l''entrepôt de destination (helper interne)"}';
COMMENT ON FUNCTION public.warehouse_arrival_parcels(text, uuid) IS
  '@mola:{"expose":true,"kind":"read","permission":"canReceiveAtDestination","confirm":false,"danger":false,"label":"Les colis et les paquets d''une arrivée à Douala (avion ou boîte), avec leur pointage"}';
COMMENT ON FUNCTION public.cargo_air_create(text, text, text, date, date, text, text, numeric, text) IS
  '@mola:{"expose":true,"kind":"write","permission":"canManageCargo","confirm":true,"danger":false,"label":"Ouvrir une expédition aérienne (LTA, ou vide = LTA à venir avec une date de départ ; compagnie, vol, dates)"}';
COMMENT ON FUNCTION public.cargo_air_update(uuid, text, text, text, date, date, text, text, numeric, text) IS
  '@mola:{"expose":true,"kind":"write","permission":"canManageCargo","confirm":true,"danger":false,"label":"Corriger une expédition aérienne (LTA provisoire à remplacer, vol, dates, fret, notes)"}';

COMMENT ON FUNCTION public.warehouse_day() IS
  '@mola:{"expose":true,"kind":"read","permission":"canReceiveAtDestination","confirm":false,"danger":false,"label":"La journée de l''entrepôt de Douala : arrivées à pointer, colis qui attendent leur client, remises du jour"}';
COMMENT ON FUNCTION public.air_shipments_notify() IS
  '@mola:{"expose":false,"kind":"write","permission":"canManageCargo","confirm":false,"danger":false,"label":"Interne : prévenir les clients au départ et à l''arrivée d''un vol"}';
COMMENT ON FUNCTION public.staff_push_on_air_arrival() IS
  '@mola:{"expose":false,"kind":"write","permission":"canReceiveAtDestination","confirm":false,"danger":false,"label":"Interne : prévenir l''équipe de Douala qu''un vol est arrivé"}';
COMMENT ON FUNCTION public.reception_deposit_json(uuid) IS
  '@mola:{"expose":false,"kind":"read","permission":"canReceiveParcels","confirm":false,"danger":false,"label":"Sérialiser un dépôt de colis, avec ses photos et le paquet de chaque colis (helper interne)"}';
COMMENT ON FUNCTION public.cargo_load_parcels(uuid, uuid[]) IS
  '@mola:{"expose":true,"kind":"write","permission":"canManageCargo","confirm":true,"danger":false,"label":"Charger des colis reçus dans une boîte (dossier Cargo) — hors colis emballés dans un paquet avion"}';
COMMENT ON FUNCTION public.cargo_air_load_parcels(uuid, uuid[]) IS
  '@mola:{"expose":true,"kind":"write","permission":"canManageCargo","confirm":true,"danger":false,"label":"Charger des colis reçus dans une expédition aérienne (colis hors paquet)"}';
COMMENT ON FUNCTION public.cargo_air_unload_parcel(uuid) IS
  '@mola:{"expose":true,"kind":"write","permission":"canManageCargo","confirm":true,"danger":false,"label":"Retirer un colis (hors paquet) d''une expédition aérienne pas encore partie"}';

NOTIFY pgrst, 'reload schema';
