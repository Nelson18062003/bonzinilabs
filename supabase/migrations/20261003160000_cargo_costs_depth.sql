-- ============================================================
-- Bonzini Cargo — des coûts qu'on peut justifier.
--
-- L'onglet Coûts notait un poste, un montant, une date. Il manquait ce qui
-- sert le jour où on refait les comptes :
--   1. À QUI on a payé (payee) et QUAND (paid_on) — « BESC, 300 EUR, payé à
--      SOFT CENTRAL LAB le 30/09 » ;
--   2. une catégorie INSPECTION (CIVIC, expertise des véhicules) qui n'avait
--      nulle part où aller ;
--   3. la SOURCE du fret annoncé (cargo_shipments.freight_note) : le
--      dossier affichait « 6 550 $ » sans dire d'où venait le chiffre
--      (tableau du transitaire du 11/09) ni qu'il contredit le BESC
--      (3 000 $).
-- Les justificatifs (photos de reçus, factures) sont des cargo_documents
-- avec cost_id (20261003140000_cargo_document_folders.sql).
-- Idempotent.
-- ============================================================

ALTER TABLE public.cargo_costs
  ADD COLUMN IF NOT EXISTS payee   text CHECK (payee IS NULL OR char_length(payee) <= 160),
  ADD COLUMN IF NOT EXISTS paid_on date;

COMMENT ON COLUMN public.cargo_costs.payee IS 'À qui ce coût a été (ou sera) payé : transitaire, agent BESC, déclarant, port…';
COMMENT ON COLUMN public.cargo_costs.paid_on IS 'Date du paiement, quand paid = true.';

ALTER TABLE public.cargo_costs DROP CONSTRAINT IF EXISTS cargo_costs_kind_check;
ALTER TABLE public.cargo_costs ADD CONSTRAINT cargo_costs_kind_check CHECK (kind IN (
  'FREIGHT','SURCHARGE','THC','DEMURRAGE','STORAGE','CUSTOMS_DUTY','CUSTOMS_FEE','BESC','INSPECTION',
  'INSURANCE','TRANSIT','TRUCKING','OTHER'
));

ALTER TABLE public.cargo_shipments
  ADD COLUMN IF NOT EXISTS freight_note text CHECK (freight_note IS NULL OR char_length(freight_note) <= 500);

COMMENT ON COLUMN public.cargo_shipments.freight_note IS
  'D''où vient freight_usd (devis, tableau du transitaire, facture) et ce qui reste à confirmer.';

NOTIFY pgrst, 'reload schema';
