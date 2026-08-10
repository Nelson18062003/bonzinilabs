-- ============================================================
-- SMS — Lot 7 : retrait de l'alerte de taux quotidienne.
--
-- Décision produit : ce message n'a pas d'utilité aujourd'hui. C'était le
-- seul du lot de nature marketing, et le seul qui exigeait un écran de
-- préférences dans l'application avant de pouvoir être activé — puisque le
-- client ne peut pas répondre STOP à un expéditeur alphanumérique.
--
-- Le gabarit est retiré du code ; on retire ici sa ligne de mapping pour
-- que la base et le code disent la même chose.
--
-- CE QUI RESTE VOLONTAIREMENT EN PLACE :
--   · la catégorie 'marketing' dans sms_template_map et sms_outbox
--   · la colonne clients.sms_marketing_opt_in
--   · la vérification du consentement dans enqueue_sms_from_notification
-- Ces trois éléments ne coûtent rien tant qu'aucun gabarit marketing
-- n'existe, et éviteront de tout reconstruire le jour où l'on en ajoute un.
-- Supprimer une colonne de consentement est par ailleurs destructif : les
-- choix déjà exprimés par des clients seraient perdus.
-- ============================================================

DELETE FROM public.sms_template_map
 WHERE notification_type = 'daily_rate_alert';

-- Aucune ligne d'outbox ne devrait exister pour ce type — le gabarit n'a
-- jamais été activé. On nettoie malgré tout, au cas où un essai manuel en
-- aurait laissé une : une ligne en attente pointant vers un gabarit
-- désormais inconnu partirait en 'skipped' à chaque passage du drainer.
DELETE FROM public.sms_outbox
 WHERE template = 'daily_rate_alert'
   AND status IN ('pending', 'failed');

NOTIFY pgrst, 'reload schema';
