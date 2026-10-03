-- ============================================================================
-- Réception — lot du 21/09/2026 (suite) : les clients côté réception, et
-- l'adresse Sea cargo — migration CONSOLIDÉE (Supabase / PostgreSQL)
-- Générée le 2026-09-21 depuis la branche claude/dazzling-keller-h53f6l
--
-- CE FICHIER SUFFIT pour ce lot. Il suppose que
-- migrations/20260921_consolidated_reception-scan-langues-colis.sql (PR #204)
-- est déjà passé. Deux sections :
--   1. supabase/migrations/20260921120000_reception_clients.sql
--      (reception_recent_clients, reception_client)
--   2. DONNÉES : l'adresse Sea cargo telle que l'office manager de Guangzhou
--      l'a écrite, en chinois (云溪颂花园, pas 颐) et en anglais. Déjà appliquée
--      en base le 21/09 ; la clause WHERE ne touche que les anciennes valeurs,
--      donc repasser ce fichier est sans effet.
-- Ouvre le SQL Editor du projet Bonzini « fmhsohrgbznqmcvqktjw », colle-le en
-- entier, exécute UNE fois. Idempotent.
-- ============================================================================

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ SECTION 1 : 20260921120000_reception_clients.sql                          ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
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

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ SECTION 2 : données — l'adresse Sea cargo de Tina (platform_settings)     ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
UPDATE public.platform_settings
   SET value = jsonb_set(value, '{warehouse,addressZh}',
                 to_jsonb('广东省广州市白云区石门街道云溪颂花园中心售楼部正对面铁皮仓库 Bonzini Trading Cargo'::text)),
       updated_at = now()
 WHERE key = 'shipping'
   AND value #>> '{warehouse,addressZh}' LIKE '%云溪颐花园%';

UPDATE public.platform_settings
   SET value = jsonb_set(value, '{warehouse,addressEn}',
                 to_jsonb('Bonzini Trading Cargo, an iron warehouse located directly opposite the sales department of Yunxi Song Garden Center in Shimen Street, Baiyun District, Guangzhou City, Guangdong Province'::text)),
       updated_at = now()
 WHERE key = 'shipping'
   AND value #>> '{warehouse,addressEn}' LIKE 'Unit 18, Building K, Baiyun Lake%';
