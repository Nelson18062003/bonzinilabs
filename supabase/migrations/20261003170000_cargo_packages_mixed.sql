-- ============================================================
-- Bonzini Cargo — ce qu'il y a VRAIMENT dans un conteneur de groupage.
--
-- La table cargo_packages ne savait décrire que des cartons de dimensions
-- connues. MIEU3611115 a montré ses limites : trois VÉHICULES (que le plan
-- rangeait comme des cartons, si bien que la Haval « ne tenait pas ») et
-- des effets personnels dont la packing list ne donne que le VOLUME par
-- ligne (« vêtements, 1 colis, 5,98 CBM »), jamais les cotes.
--
--   1. kind VEHICLE : un véhicule se dessine en silhouette et peut être
--      posé incliné (l'avant sur le capot du voisin), comme le fait un
--      entrepôt pour loger trois voitures dans un 40 pieds ;
--   2. cbm : le volume déclaré du LOT ; les dimensions deviennent
--      facultatives à condition d'avoir l'un ou l'autre ;
--   3. owner_label / client_id : À QUI est le lot (groupage) — « Olivier
--      Yaoundé » sur les tôles ; client_id le rattache à un client Bonzini ;
--   4. hs_code : le classement proposé, pour la douane.
-- Idempotent.
-- ============================================================

ALTER TABLE public.cargo_packages DROP CONSTRAINT IF EXISTS cargo_packages_kind_check;
ALTER TABLE public.cargo_packages ADD CONSTRAINT cargo_packages_kind_check CHECK (kind IN (
  'CARTON','PALLET','CRATE','BAG','DRUM','BUNDLE','VEHICLE','OTHER'
));

ALTER TABLE public.cargo_packages
  ALTER COLUMN length_cm DROP NOT NULL,
  ALTER COLUMN width_cm  DROP NOT NULL,
  ALTER COLUMN height_cm DROP NOT NULL;

ALTER TABLE public.cargo_packages
  ADD COLUMN IF NOT EXISTS cbm         numeric(10,3) CHECK (cbm IS NULL OR (cbm > 0 AND cbm <= 100)),
  ADD COLUMN IF NOT EXISTS owner_label text CHECK (owner_label IS NULL OR char_length(owner_label) <= 160),
  ADD COLUMN IF NOT EXISTS client_id   uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS hs_code     text CHECK (hs_code IS NULL OR hs_code ~ '^[0-9.]{4,20}$');

-- Des cotes complètes, OU un volume : sans l'un ni l'autre, le lot ne se dessine pas.
ALTER TABLE public.cargo_packages DROP CONSTRAINT IF EXISTS cargo_packages_size_known;
ALTER TABLE public.cargo_packages ADD CONSTRAINT cargo_packages_size_known CHECK (
  (length_cm IS NOT NULL AND width_cm IS NOT NULL AND height_cm IS NOT NULL)
  OR (length_cm IS NULL AND width_cm IS NULL AND height_cm IS NULL AND cbm IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS cargo_packages_client_idx ON public.cargo_packages (client_id);

COMMENT ON COLUMN public.cargo_packages.cbm IS 'Volume déclaré du lot entier (m³), quand la packing list ne donne pas les cotes.';
COMMENT ON COLUMN public.cargo_packages.owner_label IS 'À qui est ce lot dans le groupage (nom porté sur les colis ou la packing list).';
COMMENT ON COLUMN public.cargo_packages.client_id IS 'Client Bonzini propriétaire du lot, si identifié.';
COMMENT ON COLUMN public.cargo_packages.hs_code IS 'Code SH proposé (à valider par le déclarant).';

NOTIFY pgrst, 'reload schema';
