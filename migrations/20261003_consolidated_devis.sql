-- ============================================================================
-- MIGRATION CONSOLIDÉE · 03/10/2026 · Cargo › Devis refait sur le modèle de la packing list client
-- Projet Supabase : fmhsohrgbznqmcvqktjw · à passer dans le SQL Editor, d'un bloc.
-- ============================================================================
--
-- Contenu, dans l'ordre d'exécution :
--   0. Contrôle des prérequis (s'arrête net s'il en manque un ; rien n'est modifié) :
--      les tables devis / encaissements / colis / dépôts / conteneurs / vols /
--      user_roles, CHAQUE colonne que la nouvelle fonction lit en plus de
--      l'ancienne, et reception_client_card
--   1. La migration de la PR, copie conforme de
--        ← supabase/migrations/20261003120000_cargo_quote_document_fields.sql
--      (qui reste la source pour `npx supabase db push --linked` et pour le
--      workflow deploy-edge-functions.yml) :
--        · cargo_quote_json redéfinie en AJOUTANT des clés — aucune clé
--          existante ne change (nom, valeur, ordre des lignes et des paiements) :
--            en tête    : supplier_kind, supplier_name, received_by_name,
--                         containers[] (conteneurs du dépôt, chacun une fois,
--                         triés par numéro), flights[] (vols, triés par LTA) ;
--            par ligne  : length_cm, width_cm, height_cm, courier_waybill,
--                         container_number, awb_number ;
--        · même signature, même type de retour, même étiquette @mola
--          (expose:false), mêmes REVOKE anon / authenticated.
--      Aucune table ni colonne créée ; aucune donnée modifiée.
--
-- Indépendante de migrations/20261003_consolidated_reception.sql : elle peut
-- passer avant ou après (elle ne lit ni parcel_photos ni l'annulation d'un dépôt).
-- La production n'a pas été interrogée pour ce fichier : la section 0 fait foi.
--
-- Idempotent : un seul CREATE OR REPLACE FUNCTION, un COMMENT, deux REVOKE.
-- Rejouable sans dégât.
-- Vérifié sur Postgres 16 : schéma minimal (DDL copiés des migrations cargo,
-- réception, fournisseur, avion, devis, encaissements), l'ANCIENNE
-- cargo_quote_json posée et sa sortie capturée sur trois devis — un dépôt de
-- trois colis (deux dans un conteneur, un dans un vol ; 3 lignes colis + 1 frais
-- + 1 encaissement), un dépôt sans aucun chargement, un dépôt à deux conteneurs
-- et deux vols ; puis ce fichier passé deux fois de suite dans UNE transaction
-- (psql -1) ; puis 40 contrôles : chaque devis, moins les nouvelles clés, est
-- identique à l'ancienne sortie ; exactement 5 clés ajoutées en tête et 6 par
-- ligne ; valeurs attendues ; conteneurs / vols chacun une fois, triés, sans
-- fuite d'un autre dépôt ; '[]' pour un dépôt sans chargement ; signature,
-- type de retour, STABLE, SECURITY DEFINER, search_path, étiquette @mola et
-- droits EXECUTE inchangés ; puis le fichier de supabase/migrations/ rejoué
-- seul par-dessus → mêmes 40 contrôles. Section 0 éprouvée sur des bases
-- jetables : une colonne retirée, plusieurs à la fois (plus la fonction
-- reception_client_card), une table retirée, et le tout sous psql -1 → arrêt
-- net qui nomme chaque manque, l'ancienne fonction reste en place.
--
-- Après passage :
--   1. Types TypeScript : /gen-types (hygiène : la signature et le type de retour
--      `Json` ne changent pas ; les nouvelles clés sont typées dans
--      src/lib/cargoQuote.ts).
--   2. Coller ce fichier n'inscrit rien dans supabase_migrations.schema_migrations ;
--      pour qu'un `db push` ultérieur ne le rejoue pas (sans dommage de toute façon) :
--        npx supabase migration repair --status applied 20261003120000
-- ============================================================================


-- ############################################################################
-- SECTION 0 — Prérequis
-- ############################################################################
DO $pre$
DECLARE
  v_missing TEXT[] := ARRAY[]::TEXT[];
  r         RECORD;
BEGIN
  -- Les tables.
  IF to_regclass('public.parcel_deposits') IS NULL THEN v_missing := array_append(v_missing, 'table public.parcel_deposits (réception, 20/09)'); END IF;
  IF to_regclass('public.parcels') IS NULL THEN v_missing := array_append(v_missing, 'table public.parcels (réception, 20/09)'); END IF;
  IF to_regclass('public.parcel_quotes') IS NULL OR to_regclass('public.parcel_quote_lines') IS NULL THEN v_missing := array_append(v_missing, 'devis cargo (21/09)'); END IF;
  IF to_regclass('public.parcel_quote_payments') IS NULL THEN v_missing := array_append(v_missing, 'encaissements cargo (21/09)'); END IF;
  IF to_regclass('public.cargo_shipments') IS NULL THEN v_missing := array_append(v_missing, 'table public.cargo_shipments (module cargo, 11/09)'); END IF;
  IF to_regclass('public.air_shipments') IS NULL THEN v_missing := array_append(v_missing, 'table public.air_shipments (cargo aérien, 21/09)'); END IF;
  IF to_regclass('public.user_roles') IS NULL THEN v_missing := array_append(v_missing, 'table public.user_roles'); END IF;

  -- Les colonnes que la nouvelle cargo_quote_json lit en plus de l'ancienne
  -- (une table absente est déjà signalée ci-dessus).
  FOR r IN
    SELECT c.tbl, c.col, c.origin
    FROM (VALUES
      ('parcels',         'length_cm',        'réception, 20/09'),
      ('parcels',         'width_cm',         'réception, 20/09'),
      ('parcels',         'height_cm',        'réception, 20/09'),
      ('parcels',         'courier_waybill',  'réception, 20/09'),
      ('parcels',         'shipment_id',      'réception, 20/09'),
      ('parcels',         'air_shipment_id',  'cargo aérien, 21/09'),
      ('parcel_deposits', 'received_by',      'réception, 20/09'),
      ('parcel_deposits', 'supplier_kind',    'fournisseur du dépôt, phase 7, 22/09'),
      ('parcel_deposits', 'supplier_name',    'fournisseur du dépôt, phase 7, 22/09'),
      ('parcel_quotes',   'invoice_no',       'facture, 21/09'),
      ('cargo_shipments', 'container_number', 'module cargo, 11/09'),
      ('cargo_shipments', 'bl_number',        'module cargo, 11/09'),
      ('cargo_shipments', 'carrier',          'module cargo, 11/09'),
      ('cargo_shipments', 'vessel_name',      'module cargo, 11/09'),
      ('cargo_shipments', 'voyage',           'module cargo, 11/09'),
      ('cargo_shipments', 'pol_name',         'module cargo, 11/09'),
      ('cargo_shipments', 'pod_name',         'module cargo, 11/09'),
      ('cargo_shipments', 'etd_promised',     'module cargo, 11/09'),
      ('cargo_shipments', 'eta_promised',     'module cargo, 11/09'),
      ('cargo_shipments', 'etd_actual',       'module cargo, 11/09'),
      ('cargo_shipments', 'eta_carrier',      'module cargo, 11/09'),
      ('air_shipments',   'awb_number',       'cargo aérien, 21/09'),
      ('air_shipments',   'airline',          'cargo aérien, 21/09'),
      ('air_shipments',   'flight_no',        'cargo aérien, 21/09'),
      ('air_shipments',   'origin',           'cargo aérien, 21/09'),
      ('air_shipments',   'destination',      'cargo aérien, 21/09'),
      ('air_shipments',   'etd',              'cargo aérien, 21/09'),
      ('air_shipments',   'eta',              'cargo aérien, 21/09'),
      ('air_shipments',   'departed_at',      'cargo aérien, 21/09'),
      ('air_shipments',   'arrived_at',       'cargo aérien, 21/09'),
      ('user_roles',      'first_name',       'clients / user_roles, 11/02'),
      ('user_roles',      'last_name',        'clients / user_roles, 11/02')
    ) AS c(tbl, col, origin)
    WHERE to_regclass('public.' || c.tbl) IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM pg_attribute a
                      WHERE a.attrelid = to_regclass('public.' || c.tbl) AND a.attname = c.col
                        AND a.attnum > 0 AND NOT a.attisdropped)
  LOOP
    v_missing := array_append(v_missing, 'colonne ' || r.tbl || '.' || r.col || ' (' || r.origin || ')');
  END LOOP;

  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'reception_client_card' AND pronamespace = 'public'::regnamespace) THEN v_missing := array_append(v_missing, 'fonction reception_client_card (réception, 20/09)'); END IF;
  IF array_length(v_missing, 1) IS NOT NULL THEN
    RAISE EXCEPTION 'Migration devis : prérequis absents — %', array_to_string(v_missing, ', ');
  END IF;
END
$pre$;


-- ############################################################################
-- SECTION 1 — Le devis refait sur le modèle de la packing list client
--   ← supabase/migrations/20261003120000_cargo_quote_document_fields.sql
-- ############################################################################
-- ============================================================================
-- Cargo · Le devis refait sur le modèle de la packing list client
--
-- Le devis PDF reprend la structure de la packing list client : dimensions,
-- fournisseur, conteneur ou vol. Le client y retrouve, colis par colis, ce
-- qu'il connaît déjà de sa packing list (L × l × h, bordereau du transporteur
-- chinois, conteneur ou LTA), et en tête du document qui a envoyé la
-- marchandise, qui l'a reçue à Guangzhou, et où elle est chargée.
--
-- `cargo_quote_json` ne disait rien de tout ça : seulement le poids et le
-- volume de chaque colis. Ce fichier la redéfinit en AJOUTANT des clés —
-- aucune clé existante ne change de nom, de valeur ni d'ordre de tri :
--
--   · en tête : supplier_kind, supplier_name (le fournisseur du dépôt),
--     received_by_name (le réceptionnaire, comme pour un encaissement) ;
--   · containers : les conteneurs (cargo_shipments) où sont chargés des colis
--     du dépôt, chacun une fois, triés par numéro — B/L, armateur, navire,
--     voyage, POL / POD, départ et arrivée (le réel si l'armateur l'a
--     mesuré, sinon l'annoncé) ;
--   · flights : les vols (air_shipments) de la même façon, triés par LTA ;
--   · par ligne : length_cm, width_cm, height_cm, courier_waybill,
--     container_number, awb_number (comme reception_deposit_json).
--
-- Un colis supprimé (reception_remove_parcel) est effacé de `parcels` avec
-- sa ligne de devis : il ne peut plus faire apparaître un conteneur ou un vol.
--
-- Même signature, même type de retour, même étiquette @mola (expose:false),
-- mêmes REVOKE : toutes les RPC cargo_quote_* qui la renvoient (devis,
-- encaissement, facture, portefeuille) portent les nouvelles clés sans
-- changer elles-mêmes.
--
-- Idempotent (CREATE OR REPLACE). Suppose 20260921150000_cargo_air_shipments.sql
-- et 20260922090000_cargo_suppliers_accounts.sql passées.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.cargo_quote_json(p_quote_id UUID)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT jsonb_build_object(
    'id', q.id, 'quote_no', q.quote_no, 'deposit_id', q.deposit_id, 'status', q.status, 'currency', q.currency,
    'total_xaf', q.total_xaf, 'amount_paid_xaf', q.amount_paid_xaf,
    'balance_xaf', GREATEST(q.total_xaf - q.amount_paid_xaf, 0),
    'notes', q.notes,
    'sent_at', q.sent_at, 'paid_at', q.paid_at,
    'invoice_no', q.invoice_no, 'invoiced_at', q.invoiced_at,
    'created_at', q.created_at, 'updated_at', q.updated_at,
    'deposit_no', d.deposit_no, 'location', d.location, 'opened_at', d.opened_at, 'closed_at', d.closed_at,
    'client', public.reception_client_card(d.client_user_id),
    -- Le fournisseur et le réceptionnaire du dépôt.
    'supplier_kind', d.supplier_kind, 'supplier_name', d.supplier_name,
    'received_by_name', (SELECT TRIM(COALESCE(ur.first_name,'') || ' ' || COALESCE(ur.last_name,'')) FROM public.user_roles ur WHERE ur.user_id = d.received_by),
    -- Où sont chargés les colis du dépôt : chaque conteneur une fois, chaque vol une fois. Une date RÉELLE
    -- (timestamptz) est lue dans le fuseau du lieu : départ à Guangzhou (Asia/Shanghai), arrivée à Douala / Kribi
    -- (Africa/Douala) — sinon une arrivée entre minuit et 1 h serait datée de la veille.
    'containers', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'container_number', cs.container_number, 'bl_number', cs.bl_number, 'carrier', cs.carrier,
        'vessel_name', cs.vessel_name, 'voyage', cs.voyage, 'pol_name', cs.pol_name, 'pod_name', cs.pod_name,
        'etd', COALESCE((cs.etd_actual AT TIME ZONE 'Asia/Shanghai')::date, cs.etd_promised),
        'eta', COALESCE((cs.eta_carrier AT TIME ZONE 'Africa/Douala')::date, cs.eta_promised)
      ) ORDER BY cs.container_number)
      FROM public.cargo_shipments cs
      WHERE cs.id IN (SELECT pc.shipment_id FROM public.parcels pc WHERE pc.deposit_id = d.id AND pc.shipment_id IS NOT NULL)), '[]'::jsonb),
    'flights', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'awb_number', a.awb_number, 'airline', a.airline, 'flight_no', a.flight_no,
        'origin', a.origin, 'destination', a.destination,
        'etd', COALESCE((a.departed_at AT TIME ZONE 'Asia/Shanghai')::date, a.etd),
        'eta', COALESCE((a.arrived_at AT TIME ZONE 'Africa/Douala')::date, a.eta)
      ) ORDER BY a.awb_number)
      FROM public.air_shipments a
      WHERE a.id IN (SELECT pa.air_shipment_id FROM public.parcels pa WHERE pa.deposit_id = d.id AND pa.air_shipment_id IS NOT NULL)), '[]'::jsonb),
    'lines', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', l.id, 'seq', l.seq, 'kind', l.kind, 'label', l.label, 'basis', l.basis,
        'quantity', l.quantity, 'unit_price_xaf', l.unit_price_xaf, 'amount_xaf', l.amount_xaf,
        'parcel_id', l.parcel_id, 'parcel_no', p.parcel_no, 'parcel_seq', p.seq, 'kind_of_parcel', p.kind,
        'description', p.description, 'weight_kg', p.weight_kg, 'cbm', p.cbm,
        -- Les mesures et le suivi du colis, comme sur la packing list.
        'length_cm', p.length_cm, 'width_cm', p.width_cm, 'height_cm', p.height_cm,
        'courier_waybill', p.courier_waybill,
        'container_number', (SELECT cs.container_number FROM public.cargo_shipments cs WHERE cs.id = p.shipment_id),
        'awb_number', (SELECT a.awb_number FROM public.air_shipments a WHERE a.id = p.air_shipment_id)
      ) ORDER BY l.seq)
      FROM public.parcel_quote_lines l LEFT JOIN public.parcels p ON p.id = l.parcel_id
      WHERE l.quote_id = q.id), '[]'::jsonb),
    'payments', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', pm.id, 'receipt_no', pm.receipt_no, 'amount_xaf', pm.amount_xaf, 'method', pm.method, 'place', pm.place,
        'paid_at', pm.paid_at, 'reference', pm.reference, 'proof_path', pm.proof_path, 'note', pm.note,
        'received_by', pm.received_by,
        'received_by_name', (SELECT TRIM(COALESCE(ur.first_name,'') || ' ' || COALESCE(ur.last_name,'')) FROM public.user_roles ur WHERE ur.user_id = pm.received_by),
        'created_at', pm.created_at, 'cancelled_at', pm.cancelled_at, 'cancel_reason', pm.cancel_reason
      ) ORDER BY pm.paid_at, pm.created_at)
      FROM public.parcel_quote_payments pm WHERE pm.quote_id = q.id), '[]'::jsonb)
  )
  FROM public.parcel_quotes q JOIN public.parcel_deposits d ON d.id = q.deposit_id
  WHERE q.id = p_quote_id;
$fn$;
COMMENT ON FUNCTION public.cargo_quote_json(UUID) IS
  '@mola:{"expose":false,"kind":"read","permission":"canViewCargo","confirm":false,"danger":false,"label":"Sérialiser un devis avec ses paiements (helper interne)"}';
REVOKE ALL ON FUNCTION public.cargo_quote_json(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.cargo_quote_json(UUID) FROM anon, authenticated;
