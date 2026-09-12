-- ============================================================
-- Bonzini Cargo — corrections d'étiquettes @mola et d'un commentaire trompeur.
--
-- Trois corrections, toutes documentaires côté base (aucun changement de
-- comportement SQL), mais deux d'entre elles débloquent Mola.
--
-- 1) request_cargo_lookup était étiquetée "kind":"read" alors qu'elle ÉCRIT
--    (INSERT dans cargo_lookups, puis net.http_post vers l'edge function).
--    La passerelle refuse toute capacité dont kind === 'read'
--    (supabase/functions/admin-assistant/index.ts, do_capability), donc
--    l'action était annoncée dans le catalogue et impossible à exécuter.
--
-- 2) cargo_touch_updated_at n'avait aucune étiquette. CLAUDE.md demande de la
--    poser même sur les fonctions internes, « pour documenter le choix ».
--    C'est un déclencheur (RETURNS trigger) : PostgREST ne l'expose jamais,
--    donc expose:false.
--
-- 3) Le commentaire de 20260911120000 laissait croire que la politique
--    cargo_shipments_manage ne couvrait que « paiement, télex, notes ».
--    Une politique FOR UPDATE n'a AUCUNE portée de colonne : elle couvre
--    toute la ligne, y compris les onze colonnes ajoutées le 12/09. On
--    l'inscrit noir sur blanc dans la base plutôt que de laisser le
--    commentaire d'origine induire en erreur.
--
-- Les migrations d'origine ne sont pas modifiées : elles sont déjà appliquées
-- en production, et `supabase db push` ne les rejoue pas.
-- Idempotent : COMMENT ON remplace toujours le commentaire existant.
-- ============================================================

COMMENT ON FUNCTION public.request_cargo_lookup(text) IS
  '@mola:{"expose":true,"kind":"write","permission":"canViewCargo","confirm":false,"danger":false,"label":"Suivre une reference (B/L, booking ou conteneur) chez l''armateur"}';

COMMENT ON FUNCTION public.cargo_touch_updated_at() IS
  '@mola:{"expose":false,"kind":"write","permission":"canManageCargo","label":"Mettre a jour updated_at (declencheur interne, jamais appele directement)"}';

COMMENT ON POLICY cargo_shipments_manage ON public.cargo_shipments IS
  'canManageCargo peut modifier TOUTE la ligne : une politique FOR UPDATE n''a pas de portee de colonne. Les champs tenus par l''armateur (jalons, ETA, navire) sont ecrasables par un appel PostgREST direct ; seule la synchronisation les reecrit ensuite.';

NOTIFY pgrst, 'reload schema';
