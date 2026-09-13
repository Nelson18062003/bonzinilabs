-- ============================================================
-- RÉGLAGES DE PLATEFORME — les valeurs que le fondateur change lui-même.
--
-- Premier usage : l'expédition (module cargo). L'adresse de l'entrepôt de
-- Baiyun, celle du bureau de Guangzhou, et les coordonnées de la société
-- (téléphone, WeChat, WhatsApp, e-mail) figurent sur chaque étiquette colis
-- que le client envoie à son fournisseur. Elles vivaient dans le code : à
-- chaque déménagement, un déploiement. Désormais elles vivent ici, éditables
-- depuis l'app admin, et les DEUX apps (client et admin) les lisent.
--
-- Une ligne par clé, la valeur en jsonb : on ajoute une clé sans migration.
-- Lecture : tout utilisateur connecté (le client rend l'étiquette).
-- Écriture : uniquement par la RPC, gardée par canManageUsers (super_admin),
-- jamais en direct — la table n'a pas de policy d'UPDATE.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.platform_settings (
  key        TEXT PRIMARY KEY,
  value      JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID
);

COMMENT ON TABLE public.platform_settings IS
  'Réglages éditables depuis l''app admin (clé → jsonb). Lecture : authenticated. Écriture : RPC update_platform_setting (canManageUsers).';

ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS platform_settings_read ON public.platform_settings;
CREATE POLICY platform_settings_read ON public.platform_settings
  FOR SELECT TO authenticated USING (true);

-- Valeurs de départ : celles relevées sur le bon de réception de l'entrepôt
-- et la fiche du bureau. Idempotent : on ne réécrit pas une ligne existante.
INSERT INTO public.platform_settings (key, value) VALUES (
  'shipping',
  '{
    "company": {
      "nameZh": "",
      "nameEn": "Bonzini Labs",
      "email": "contact@bonziniapps.com",
      "phone": "+86 186 6743 9286",
      "wechat": "138 2229 7518",
      "whatsapp": "+86 186 6743 9286"
    },
    "warehouse": {
      "addressZh": "广东省广州市白云区窖心街\n白云湖物流园 K栋 18档",
      "addressEn": "Unit 18, Building K, Baiyun Lake Logistics Park, Jiaoxin Street, Baiyun District, Guangzhou, Guangdong",
      "recipient": "Tina",
      "phone": "199 2746 3902",
      "wechat": "138 2229 7518",
      "whatsapp": "+86 186 6743 9286",
      "email": "contact@bonziniapps.com"
    },
    "office": {
      "addressZh": "广州市广园西路219号\n客麦隆大厦二楼 259",
      "addressEn": "259, 2/F, Cameroon Building, No. 219 Guangyuan West Road, Guangzhou, China",
      "recipient": "Tina",
      "phone": "138 2229 7518",
      "wechat": "138 2229 7518",
      "whatsapp": "+86 186 6743 9286",
      "email": "contact@bonziniapps.com"
    }
  }'::jsonb
)
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.update_platform_setting(p_key TEXT, p_value JSONB)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id UUID := auth.uid();
BEGIN
  IF v_admin_id IS NULL OR NOT public.admin_has_permission(v_admin_id, 'canManageUsers') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accès non autorisé');
  END IF;
  IF p_key IS NULL OR p_key !~ '^[a-z_]{2,40}$' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Clé invalide');
  END IF;
  IF p_value IS NULL OR jsonb_typeof(p_value) <> 'object' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Valeur invalide');
  END IF;

  INSERT INTO public.platform_settings (key, value, updated_at, updated_by)
  VALUES (p_key, p_value, now(), v_admin_id)
  ON CONFLICT (key) DO UPDATE
    SET value = EXCLUDED.value, updated_at = now(), updated_by = v_admin_id;

  RETURN jsonb_build_object('success', true, 'key', p_key);
END;
$$;

REVOKE ALL ON FUNCTION public.update_platform_setting(TEXT, JSONB) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.update_platform_setting(TEXT, JSONB) TO authenticated;

COMMENT ON FUNCTION public.update_platform_setting(TEXT, JSONB) IS
  '@mola:{"expose":true,"kind":"write","permission":"canManageUsers","confirm":true,"danger":false,"label":"Modifier un réglage de plateforme (adresses d''expédition, coordonnées de la société)"}';

NOTIFY pgrst, 'reload schema';
