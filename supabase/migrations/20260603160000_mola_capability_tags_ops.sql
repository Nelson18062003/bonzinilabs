-- Mola — Industrialisation des capacités auto-découvertes (étiquetage des opérations).
-- Signatures vérifiées dans les migrations (ordre EXACT des types — requis par COMMENT ON FUNCTION).
--
-- expose:true  = Mola peut le découvrir + l'exécuter (avec permission + carte de confirmation).
-- expose:false = documenté mais ÉTEINT, en attente d'une décision explicite du fondateur
--                (actions très sensibles : gestion d'admins, reset de mot de passe, suppression de preuve).

-- ════════════ OPÉRATIONNEL — exposé (le métier du directeur des opérations) ════════════

-- Dépôts (cycle de vie)
comment on function public.revert_deposit_to_created(uuid) is
  '@mola:{"expose":true,"kind":"write","permission":"canProcessDeposits","confirm":true,"danger":true,"label":"Remettre un dépôt à l''état créé","resolve":{"p_deposit_id":"deposit"}}';
comment on function public.start_deposit_review(uuid) is
  '@mola:{"expose":true,"kind":"write","permission":"canProcessDeposits","confirm":true,"danger":false,"label":"Démarrer la revue d''un dépôt","resolve":{"p_deposit_id":"deposit"}}';

-- Paiements / cash
comment on function public.scan_cash_payment(uuid) is
  '@mola:{"expose":true,"kind":"write","permission":"canProcessPayments","confirm":true,"danger":false,"label":"Scanner un paiement cash","resolve":{"p_payment_id":"payment"}}';
comment on function public.process_payment(uuid, text, text) is
  '@mola:{"expose":true,"kind":"write","permission":"canProcessPayments","confirm":true,"danger":true,"label":"Traiter un paiement (p_action: action; p_comment: commentaire)","resolve":{"p_payment_id":"payment"}}';

-- ════════════ SENSIBLE — ÉTEINT (expose:false) jusqu'à décision explicite ════════════
-- (Les reset de mot de passe vérifient DÉJÀ super_admin en interne ; on les laisse OFF par prudence.)

-- Activée (décision fondateur) : Mola peut supprimer/remplacer une preuve (toujours avec confirmation).
comment on function public.delete_payment_proof(uuid) is
  '@mola:{"expose":true,"kind":"write","permission":"canProcessPayments","confirm":true,"danger":true,"label":"Supprimer une preuve de paiement"}';
comment on function public.admin_reset_client_password(uuid) is
  '@mola:{"expose":false,"kind":"write","permission":"canManageUsers","danger":true,"label":"Réinitialiser le mot de passe d''un client (super_admin)","resolve":{"p_target_user_id":"client"}}';
comment on function public.admin_reset_password(uuid) is
  '@mola:{"expose":false,"kind":"write","permission":"canManageUsers","danger":true,"label":"Réinitialiser le mot de passe d''un admin (super_admin)"}';
comment on function public.admin_create_admin(text, text, text, text) is
  '@mola:{"expose":false,"kind":"write","permission":"canManageUsers","danger":true,"label":"Créer un administrateur"}';
comment on function public.toggle_admin_status(uuid, boolean) is
  '@mola:{"expose":false,"kind":"write","permission":"canManageUsers","danger":true,"label":"Activer/désactiver un administrateur"}';
comment on function public.update_admin_role(uuid, app_role) is
  '@mola:{"expose":false,"kind":"write","permission":"canManageUsers","danger":true,"label":"Changer le rôle d''un administrateur"}';
comment on function public.update_admin_profile(uuid, text, text) is
  '@mola:{"expose":false,"kind":"write","permission":"canManageUsers","danger":true,"label":"Modifier le profil d''un administrateur"}';
