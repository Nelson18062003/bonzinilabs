# Module A — Opérations (dépôts, paiements, justificatifs, historique, agent cash)

## 1) Résumé

- Le desktop est un **poste de travail** : table + panneau latéral de 560 px (`/m/deposits/:id`, `/m/payments/:id`). Il offre des files d'attente (« À traiter » triée du plus ancien au plus récent), une recherche **côté serveur**, des tris par en-tête, une pagination numérotée, des actions rapides au survol et des raccourcis (⌘⏎, Échap, Ctrl+V).
- Le mobile regroupe dépôts et paiements dans **un seul écran « Opérations »** (onglets Dépôts / Paiements, bouton `+` qui ouvre une feuille avec 3 créations et l'export). Les fiches sont des pages entières écrites « en phrases ». Les créations sont des assistants pas à pas (4 à 6 étapes pour un dépôt, 5 pour un paiement).
- Écarts majeurs côté mobile : pas de case « Vérifié en banque », pas d'onglet « Info manquante » pour les paiements, recherche limitée aux pages déjà chargées, **filtre « Méthode » des dépôts sans effet** (bug), pas de suivi (timeline) sur la fiche paiement, pas d'export de la fiche en image PNG, pas de commentaire au client à la validation, pas de remplacement d'une preuve de paiement.
- Les deux plateformes partagent les écrans de paiement groupé (`BulkPaymentCreate/Detail` avec la prop `desktop`), Justificatifs (`MobileProofsScreen desktop`) et Modifier le bénéficiaire. **Aucune liste des lots** n'existe : on ne retrouve un lot qu'au moment où on le crée.
- L'app agent cash (`/a/*`) n'existe qu'en mobile : liste À payer / Payés → fiche → scan du QR → confirmation (case à cocher + signature) → succès avec reçu PDF. Elle a encore son propre écran de connexion `/a/login`, en double de la connexion unique `/m/login`.

---

## 2) Écrans

### Garde des routes (commune à tout le module)
- `/m/*` passe par `AdminRouteWrapper` puis `ProtectedAdminRoute` : il faut être authentifié dans `user_roles`. Les rôles `receptionist`, `warehouse_agent` et `commercial` sont renvoyés vers leur espace. **Aucune permission n'est vérifiée au niveau de la route.**
- Le menu desktop (`desktopNav.ts`) filtre les entrées : Dépôts → `canViewDeposits`, Paiements → `canViewPayments`, Journaux → `canViewLogs`. Côté mobile, ni l'onglet « Opérations » (`MobileTabBar`) ni « Historique » / « Justificatifs » (`MobileMoreScreen`) ne filtrent par permission.
- `/a/*` passe par `AgentCashRouteWrapper` : seul le rôle `cash_agent` est admis, les autres sont redirigés via `staffHomeFor`.
- Matrice des rôles (extrait) : `canProcessDeposits` = super_admin, ops, customer_success · `canProcessPayments` = super_admin, ops · `canViewLogs` = ops, support (+ super_admin) · `cash_agent` = `canViewPayments` + `canHandleCash`.

### 2.1 `/m/ops`, `/m/deposits` — Liste des dépôts

| | Desktop `DesktopDepositsScreen` | Mobile `MobileOperationsScreen` → `MobileDepositsScreenV2 embedded` |
|---|---|---|
| En-tête | « Dépôts » · « N dépôts · X à traiter » · bouton **Nouveau dépôt** | « Opérations » · bouton `+` (feuille « Nouvelle opération ») · onglets **Dépôts (n) / Paiements (n)** (compteurs `useAdminActionableCounts`) |
| Files / onglets | Puces **À traiter** (`proof_submitted`, `admin_review`) · **À corriger** (`pending_correction`) · **Tous** (`get_deposit_stats`) | Puces **Tous** · À traiter · À corriger · Validés · Rejetés (avec compteurs). **« Tous » est sélectionné par défaut** (sur desktop : « À traiter ») |
| Recherche | Côté serveur, avec délai de frappe : nom, téléphone, référence | **Côté client, seulement sur les pages déjà chargées**. Le texte d'aide dit « Nom ou téléphone » alors que la référence est aussi cherchée. Le défilement infini est coupé pendant une recherche |
| Filtres | Statut (si Tous : Validés, Rejetés, En attente de preuve) · Méthode (Banque, Agence, Orange, MTN, Wave) · Période (Aujourd'hui, Hier, Cette semaine, Ce mois) | Panneau repliable : Méthode (mêmes familles) · Période (mêmes valeurs + **Personnalisé** avec `BzDateRangeField`). **BUG** : la méthode est envoyée dans `params.methods`, que `usePaginatedAdminDeposits` ignore (il ne lit que `method`), et elle est même retirée quand c'est le seul filtre actif → **le filtre Méthode n'a aucun effet** |
| Tri | En-têtes cliquables « Montant XAF » et « Reçu » ; file triée du plus ancien au plus récent | Aucun tri au choix ; « À traiter » est trié du plus ancien au plus récent |
| Colonnes / carte | Référence + nombre de preuves 📎 · Client + téléphone · Montant XAF · Méthode (icône + libellé court) · Reçu (âge coloré selon le délai) · Statut · **Vérifié** (case, `set_deposit_verified`, `canProcessDeposits`, sinon lecture seule) · actions au survol **Valider / Rejeter** (ouvrent le panneau avec `?action=`) | Carte : icône méthode · nom du client · statut · « **X XAF** par Méthode » · « il y a … · n preuves » (en rouge ou ambre selon le délai). **Ni case Vérifié, ni référence, ni téléphone** |
| Pagination | Numérotée, 20 par page, « 1–20 sur N » | Défilement infini + tirer pour rafraîchir |
| Clavier | Ligne focalisable, Entrée / Espace pour ouvrir | — |
| Libellés de statut | `DEPOSIT_STATUS_LABELS` : Demande créée · En attente de preuve · Preuve envoyée · En vérification · Validé · Rejeté · À corriger · Annulé · Annulé (admin) | Identiques |

Feuille `+` (mobile seulement) : **Dépôt** → `/m/deposits/new` · **Paiement** → `/m/payments/new` · **Paiement groupé** → `/m/payments/batch/new` · **Exporter les paiements en cours** (`exportPendingPaymentsPDF`, statut `processing`, « PDF signé, pour l'équipe en Chine »).

### 2.2 `/m/deposits/:id` — Fiche d'un dépôt

| | Desktop `DesktopDepositPanel` (panneau à côté de la liste) | Mobile `MobileDepositDetailV2` (page entière) |
|---|---|---|
| En-tête | Référence · statut · âge (délai) · action principale selon le statut : **Vérifier** (`start_deposit_review`, si `proof_submitted`) sinon **Valider** · **Rejeter** · menu ⋯ · ✕ | ← « Dépôt » · bouton **Reçu** (PDF) |
| Zone de décision | Preuve (vignette, navigation 1/n, « Admin / Client · date ») **à côté** du bloc « Vérification du montant » : déclaré, crédité, champ « Montant confirmé », solde du portefeuille, solde « Après validation », alerte si le montant diffère | Phrases : montant en grand, « Envoyé par X via Méthode, il y a… », « crédité de Y au lieu de X », motif du refus, alerte de délai, « Solde du client » |
| Preuves | Agrandir · Télécharger · Remplacer · Supprimer (si `canProcessDeposits` et dépôt non terminé) · zone vide « Ajouter (Ctrl+V) » | Liste complète de cartes : Agrandir · Télécharger · Remplacer · Supprimer (affichés si **non terminé, sans vérifier la permission**) · « Ajouter une preuve » (si `canProcess`) |
| Faits | Grille : Client (lien vers la fiche client) · Téléphone · Société · Méthode · Banque ou Agence · Créé le · Note interne (`admin_comment`) | Repli « Le détail » : Référence, Méthode, Banque, Agence, Téléphone, Entreprise, Envoyé le, Validé le, « Note pour le client » (`admin_comment`), « Note interne » (`admin_internal_note`). **Pas de lien vers la fiche client** |
| Suivi | Ouvert (étapes datées) | Replié « Le suivi » |
| Décision | Dans l'en-tête et le menu ⋯ : **Valider sans vérification** · **Relevé PDF** · **Ajouter une preuve** · **Annuler le dépôt** (super_admin, dépôt non terminé) | Section « La décision » : **Valider le dépôt** (avec barre `DecisionDock` collante) · **Marquer « en vérification »** + explication · **Refuser le dépôt** · **Annuler ce dépôt** (super_admin, **même si le dépôt est terminé**) |
| Fenêtres | `CenterDialog` : Valider (montant confirmé, « Créditer X », nouveau solde estimé, note interne, **Notifier le client**, ⌘⏎ / Échap) · Refuser (7 motifs `REJECTION_REASONS`, message client obligatoire pré-rempli, note interne) · Ajouter une preuve (`PasteDropZone`) · Annuler · Supprimer la preuve (5 motifs `PROOF_DELETE_REASONS`, champ libre si « Autre ») · visionneuse | Mêmes contenus en `BottomSheet` |
| Absent | Motif du refus et `admin_internal_note` non affichés | Case « Vérifié en banque » absente |

### 2.3 `/m/deposits/new` — Nouveau dépôt

| | Desktop `DesktopNewDeposit` → `NewDepositDialog` (`FormDialog` au-dessus de la liste) | Mobile `MobileNewDepositV2` (assistant plein écran) |
|---|---|---|
| Structure | Une seule fenêtre : Client → Montant → Méthode → Preuve → « Plus d'options » | 4 à 6 étapes avec barre de progression : Quel client ? → Combien ? → Comment ? → (type d'opération) → (banque / agence) → « Tout est bon ? » |
| Client | `ClientPickerField` (nom, téléphone, BZ-…), **solde affiché**, `?clientId=` présélectionne | Recherche « Nom, téléphone ou BZ-… », liste de cartes. **Solde non affiché** |
| Montant | Grand champ + 6 montants ronds (100 k à 5 M) · minimum `MIN_DEPOSIT_XAF` | Champ + 4 montants ronds (100K, 500K, 1M, 2M) · **date de l'opération (antidater) sur cette étape** · avertissement « limite mobile money » affiché quelle que soit la méthode |
| Méthode | Boutons familles · type d'opération · banque · agence · alerte limite mobile money · repli « Coordonnées à donner au client » (lignes copiables + étapes) | Étapes dédiées · coordonnées et code marchand copiables + instructions sur le récapitulatif |
| Preuve | Facultative, Ctrl+V / glisser-déposer | Facultative, sur le récapitulatif |
| Options | Repli : date antidatée + note interne | Récapitulatif : « Commentaire admin (optionnel) » |
| Validation | Pied de fenêtre : résumé ou première erreur · **Créer le dépôt** (⌘⏎) · demande confirmation avant d'abandonner un brouillon | Bouton du bas « Suivant » / créer · écran « Création… » puis succès « Dépôt créé » → **Retour / Voir la fiche**. Le texte « Le client peut maintenant ajouter ses preuves » s'affiche **même si l'admin a déjà joint une preuve** |
| Appels | `create_client_deposit` + upload vers `deposit-proofs` + `deposit_proofs` + `submit_deposit_proof` + `admin_audit_logs` (`useAdminCreateDeposit`) | Identiques |
| Garde | Aucune en interface (le serveur vérifie la permission staff) | Aucune en interface |

### 2.4 `/m/payments` — Liste des paiements

| | Desktop `DesktopPaymentsScreen` | Mobile `MobilePaymentsScreen embedded` (onglet d'Opérations) |
|---|---|---|
| En-tête | « Paiements · N · X à traiter » · **Exporter (PDF)** · **Paiement groupé** · **Nouveau paiement** | Segmented + feuille `+` (voir 2.1). Bandeau « N paiements réglés aujourd'hui, ¥… » (mobile seulement) |
| Files | **À traiter** (`ready_for_payment`, `cash_scanned`) · **Info manquante** (`waiting_beneficiary_info`) · **En cours** (`processing`) · **Tous** | Tous · À traiter · En cours · Terminés · Rejetés (sans compteur). **Pas d'onglet « Info manquante »** ; « Tous » sélectionné par défaut |
| Recherche | Côté serveur : client, bénéficiaire, référence | Côté client sur les pages chargées : nom du client, téléphone, référence (**pas le bénéficiaire**) |
| Filtres | Statut (si Tous : Effectués, Refusés, Créés) · Méthode (Alipay, WeChat, Virement, Cash) · Période (7, 30, 90 jours) | Panneau : Méthode · **Tri** (Plus récent, Plus ancien, Montant ↓, Montant ↑) · Période **libre** (`BzDateRangeField`) · « Réinitialiser » · badge du nombre de filtres actifs |
| Colonnes / carte | Référence + 📎 · Client · **Bénéficiaire** (logo, nom, banque et compte / identifiant / « QR enregistré » / « Infos bénéficiaire manquantes » en rouge ; cash : « (le client) » ou « (tiers) ») · Montant ¥ + **XAF** · **Taux ¥/1M** + étiquette « perso » · Créé (âge) · Statut · action au survol **Traiter** (`ready_for_payment`, lance `start_processing`) ou **Valider** (`processing`, ouvre la fenêtre de validation) | Carte : logo · client · statut · « ¥X par Méthode » · « il y a… · n preuves ». **Ni bénéficiaire, ni XAF, ni taux** |
| Pagination | Numérotée, 20 par page | Défilement infini |
| Libellés | Liste : `PAYMENT_STATUS_LABELS` (Créé, **Info att.**, **Prêt**, En cours, **Terminé**, Rejeté, Cash att., Cash scanné, Annulé (admin)) | Identiques. La fiche utilise d'autres libellés, voir 5 |

### 2.5 `/m/payments/:id` — Fiche d'un paiement

| | Desktop `DesktopPaymentPanel` | Mobile `MobilePaymentDetail` |
|---|---|---|
| En-tête | Référence · statut (`PAYMENT_STATUS_CONFIG`) · âge · **Passer en cours** (`ready_for_payment`) · **Valider** (`processing`) · **Rejeter** (si non clos et ≠ `cash_pending`) · ⬇ Reçu PDF · menu ⋯ · ✕ | `MobileHeader` : référence, « Méthode · il y a… », ⬇ reçu PDF |
| Haut de fiche | **Fiche de paiement** toujours en clair, à partager : logo + méthode, « Le fournisseur reçoit ¥ », « X XAF débités · taux ¥ pour 1 000 000 XAF » + « perso », lignes copiables (Bénéficiaire, Alipay ID / WeChat ID, Banque, N° de compte, SWIFT/IBAN, Téléphone, Email, Notes), **QR** du bénéficiaire ou QR agent cash, pied « BONZINI LABS + date » | Montant en grand · statut · Stat « Client débité » / « Taux » · phrases : refus, annulation, délai, bénéficiaire manquant, découvert |
| Partage | **Instruction de paiement · 付款指令** (`PaymentInstructionDialog` : Télécharger le PDF · Copier l'image · Copier le texte) · **Copier l'image** de la fiche (PNG dans le presse-papiers) · **Image .png** · **Reçu PDF** | **Instruction de paiement** (`MobilePaymentInstructionSheet` : Partager l'image · Partager le PDF · Copier le texte · Télécharger le PDF). S'ouvre seule avec `?instruction=1` après une création. **Pas d'export de la fiche en PNG** |
| Client | Grille : Client (lien) · Téléphone · Créé le · Solde après débit (« découvert » en rouge) · **Lot** (« Paiement groupé », sans lien) · Traité le · Motif d'annulation · Motif du refus · Note interne | Section « Le client » + lien « Fiche → » ; repli « Le détail » : Référence, Méthode, Client, Entreprise, Demandé le, Traité le, Solde après, motifs, Commentaire. **Pas d'information de lot** |
| Bénéficiaire | « Modifier / Ajouter le bénéficiaire » → fenêtre (Nom, WeChat/Alipay ID, fichier QR, Banque, N° de compte, SWIFT/IBAN, Téléphone, Email, Notes) · bouton « Compléter le bénéficiaire » | Section « Le bénéficiaire » + **Modifier** sur la page même (formulaire Alipay/WeChat : Nom, QR collé ou glissé, ID (téléphone), Email, Identifiant, Notes ; virement : Titulaire*, Banque*, N° de compte*, Infos complémentaires, Notes) · Voir / Masquer / Agrandir / **Changer le QR** |
| Montants | Menu ⋯ « Modifier les montants / le taux » (ou « Corriger » si clos) | En-tête de section **Modifier / Corriger** + bouton « Modifier les montants » + bouton de recalcul ¥ |
| Cash | « Signature du bénéficiaire » : image + « Signé le … · nom », sinon **Faire signer** (`SignatureCanvas` → `confirm_cash_payment`) | `CashQRCode` (QR à présenter) · « La signature » : image + `CashReceiptDownloadButton`, sinon **Faire signer** |
| Preuves | Bandeau « Preuve de paiement admin attendue avant Valider » si `processing` sans preuve admin · visionneuse 1/n · badge Admin / Instruction / Client · Agrandir (image) ou **Ouvrir** (PDF) · Télécharger · **Remplacer** · Supprimer (preuve admin, ou super_admin ; super_admin aussi après clôture) · Ctrl+V | Cartes : Agrandir · Télécharger · Supprimer (mêmes règles). **Pas de Remplacer.** Un PDF passe par `<img>` et s'affiche vide. « Ajouter une instruction du client » si aucune |
| Suivi | Ouvert : Créé → Bénéficiaire → Prêt → Traitement → Effectué (étapes cash propres ; branche refus / annulation) | **Aucun.** La timeline est chargée (`useAdminPaymentTimeline`) mais n'est jamais affichée |
| Décision | En-tête + menu ⋯ : **Ajouter une preuve** · **Ajouter une instruction** · Modifier les montants · **Annuler le paiement** (super_admin, tant que non remboursé ; motif obligatoire si `completed`) | « La décision » : **Commencer le paiement** · **Valider le paiement** (+ `DecisionDock`) · Modifier les montants · **Refuser le paiement** (si non clos, **y compris `cash_pending`**) · **Annuler ce paiement (effectué)** |
| Fenêtres | Valider (preuve facultative + **commentaire visible par le client**) · Refuser (8 motifs `PAYMENT_REJECTION_REASONS` + précision) · Corriger (XAF, ¥, taux, impact sur le portefeuille, alerte d'incohérence, motif obligatoire) · Supprimer la preuve · Ajouter des preuves · Annuler (motif) · Signature · visionneuse | Feuilles : Confirmer le paiement (preuve facultative, **sans commentaire**) · Refuser (motifs + message client obligatoire) · Modifier les montants · Annuler · Supprimer la preuve · Aperçu |
| Reçu PDF | Contient le QR cash, la signature, `cash_signed_by_name` et la date de signature | **Sans QR cash ni signature** (il existe un bouton de reçu cash à part) |

### 2.6 `/m/payments/new` — Nouveau paiement

| | Desktop `NewPaymentDialog` (`FormDialog`) | Mobile `MobileNewPayment` (assistant en 5 étapes) |
|---|---|---|
| Étapes | Une seule fenêtre : Client (solde + découvert) → Destination (Alipay, WeChat Pay, Virement, Cash) → Montant (XAF ⇄ ¥, taux du jour, **taux personnalisé**, `RateUnavailableNotice` + Réessayer) → Bénéficiaire (onglets **Carnet (n) / Nouveau / Plus tard** ; « Enregistrer dans le carnet du client ») → Plus d'options (date antidatée) | Quel client ? → Comment payer ? → Combien ? (solde insuffisant, alerte « passe en découvert », taux personnalisé, taux du pays et des petits paiements, date de l'opération) → Qui reçoit ? (« Remplir plus tard », carnet ou nouveau, QR, enregistrer au carnet) → Tout est bon ? |
| Validation | Pied : « ¥ → bénéficiaire · débit XAF · solde après » · **Confirmer le paiement** (⌘⏎) → ouvre la fiche | Succès « Paiement créé » → **Envoyer l'instruction au partenaire** (`?instruction=1`) · Voir la fiche |
| Appels | `create_admin_payment` (`useAdminCreatePayment`), `useAdminCreateBeneficiary`, upload du QR, `wallets` (lecture), taux actif du jour | Identiques |
| Garde | Aucune en interface | Aucune en interface |

### 2.7 `/m/payments/batch/new` et `/m/payments/batch/:id` — Paiement groupé (même composant, prop `desktop`)
- **Création** `BulkPaymentCreate` : « Client à débiter » (recherche, solde affiché, « Changer ») · lignes de bénéficiaires (Modifier, **Dupliquer**, **Retirer**) · feuille « Nouveau / Modifier le bénéficiaire » (méthode, montant en ¥ ou en XAF, raccourci « Restant », taux personnalisé, nom, canaux QR / ID / Téléphone / E-mail, banque, compte, SWIFT, commentaire visible par le client, enregistrement au carnet : alias, relation Soi-même / Fournisseur / Autre) · feuille « Carnet du client » · « Note (optionnel) » · barre du bas avec le solde verrouillé · **Vérifier le lot** (Total débité, Solde restant) → **Créer le lot** (`create_payment_batch`, tout ou rien) → ouvre `/m/payments/batch/:id`.
- **Détail** `BulkPaymentDetail` : référence, client, date, total ¥, total XAF débité, note · liste des lignes (bénéficiaire, identifiant ou compte, ¥, XAF, statut) → un appui ouvre `/m/payments/:id`. Lecture seule.
- **Aucun écran ne liste les lots** : `usePaymentBatches` n'est appelé nulle part, et le « Lot » du panneau desktop n'est pas cliquable.

### 2.8 `/m/payments/:id/edit-beneficiary` — `MobileBeneficiaryEdit` (desktop : la même page dans le cadre desktop)
- `BeneficiaryEditForm` → `admin_update_payment_beneficiary` (si la RPC est introuvable, mise à jour directe de `payments`) + upload du QR · boutons Annuler / Enregistrer.
- **Page orpheline** : aucun lien de l'administration n'y mène (seul l'app client a un lien, vers `/payments/:id/edit-beneficiary`). Ancien style (`bg-background`, en dehors du kit de design), aucune garde de permission ni de statut dans l'interface.

### 2.9 `/m/more/proofs` — Justificatifs (`MobileProofsScreen`, même composant en desktop avec `desktop`)
- Données : `useAdminProofs` → `deposit_proofs` (les 100 plus récents) + noms des clients. **Preuves de dépôts seulement.**
- Deux tuiles « Total » et « Dépôts » qui affichent **le même nombre** · recherche côté client (client, nom de fichier) · grille de vignettes (badge « Dépôt ») · feuille d'aperçu : image, Client, Type, Date, **Télécharger** (`window.open`).
- Pas de lien vers le dépôt concerné, pas de filtre, pas de pagination. Aucune garde de permission (le menu desktop ne l'en protège pas non plus).

### 2.10 `/m/more/history` — Journal d'activité

| Desktop `DesktopHistoryScreen` (« Journaux », menu protégé par `canViewLogs`) | Mobile `MobileHistoryScreen` (« Historique », sans garde) |
|---|---|
| Table : Administrateur (avatar) · Action (`action_type` brut) · Cible (pastille `target_type` brute) · Date | Cartes équivalentes |
| Recherche (action, prénom de l'admin) · puces Tous / Dépôts / Paiements / Clients / Taux | Identiques |
| `admin_audit_logs` (les 100 plus récents), lecture seule | Identique |

Pas de lien vers l'objet concerné, pas de détail (`details`), pas de filtre par date, pas d'export.

### 2.11 App agent cash `/a/*` (mobile seulement, rôle `cash_agent`)
- **`/a/login` `AgentCashLogin`** : 2 étapes (email puis mot de passe, afficher / masquer), langue en boucle FR → EN → 中文, connexion via `useAdminAuth.login` → `staffHomeFor`. Écran en double de `/m/login`.
- **`/a` `AgentCashPayments`** : bouton de langue · **Déconnexion** (→ `/a/login`) · onglets **À payer** (`processing`, `cash_scanned`, `cash_pending`, `ready_for_payment` ; les plus anciens en tête) / **Payés** (`completed` avec `cash_paid_by` = moi) · cartes : montant, statut (Payé / Scanné / À payer), Bénéficiaire, Client, Référence, Date → fiche. Barre d'onglets : Paiements · Scanner.
- **`/a/scan` `AgentCashScanner`** : caméra `Html5Qrcode` (messages pour : permission refusée, caméra absente, HTTPS requis, caméra occupée, non pris en charge, échec de démarrage) · **saisie manuelle de l'ID** + Rechercher (`parseCashQRCode`) → `/a/payment/:id`.
- **`/a/payment/:id` `AgentCashPaymentDetail`** : montant, statut, bénéficiaire (nom, téléphone, email), client, référence, date · si payé : « Déjà payé le … », signé par, image de la signature, **Télécharger le reçu** · si à payer : **Procéder au paiement** (`scan_cash_payment` → confirm ; si déjà scanné, continue quand même) · si scanné : **Confirmer le paiement**.
- **`/a/payment/:id/confirm` `AgentCashConfirm`** : récapitulatif · case « espèces remises » · alerte « vérifier l'identité » · zone de signature (Effacer) · **Confirmer le paiement** (`confirm_cash_payment` + upload vers `cash-signatures`), actif seulement si la case est cochée et la signature faite.
- **`/a/payment/:id/success` `AgentCashSuccess`** : succès, montant, signature, **Télécharger le reçu**, **Retour à la liste**, **Scanner un autre**.

---

## 3) Toutes les actions

| Action | Écran desktop | Écran mobile | RPC / table | Permission (interface → serveur) |
|---|---|---|---|---|
| Lister et compter les dépôts | Table + puces | Liste + puces | `deposits`, `clients`, `deposit_proofs`, `get_deposit_stats` | aucune en interface (menu desktop : `canViewDeposits`) |
| Marquer « Vérifié en banque » | Colonne Vérifié | **absent** | `set_deposit_verified` | `canProcessDeposits` |
| Démarrer la vérification | Panneau « Vérifier » | « Marquer “en vérification” » | `start_deposit_review` | `canProcessDeposits` (mobile : bouton affiché seulement si `canProcess`) |
| Valider un dépôt (montant confirmé, note, notifier) | Panneau, survol, ⌘⏎ | Section décision + barre collante | `validate_deposit` | `canProcessDeposits` |
| Rejeter un dépôt (motif, message, note) | Panneau, survol | « Refuser le dépôt » | `reject_deposit` | `canProcessDeposits` |
| Ajouter des preuves à un dépôt | Menu ⋯, zone vide, Ctrl+V | Section, Ctrl+V | storage `deposit-proofs` + `deposit_proofs` + `submit_deposit_proof` | `canProcessDeposits`, dépôt non terminé |
| Remplacer / supprimer une preuve de dépôt (motif) | Boutons sous la vignette | Boutons des cartes (**sans vérifier la permission**) | `deposit_proofs` delete + `revert_deposit_to_created` + `deposit_timeline_events` + `admin_audit_logs` | desktop `canProcessDeposits` ; mobile : statut seul |
| Annuler un dépôt | Menu ⋯ (non terminé) | Bouton (**même terminé**) | `cancel_deposit` | rôle super_admin |
| Relevé / reçu PDF d'un dépôt | Menu ⋯ « Relevé PDF » | En-tête « Reçu » | client (`DepositReceiptPDF`) | — |
| Créer un dépôt | Fenêtre « Nouveau dépôt » | Feuille `+` → assistant | `create_client_deposit` (+ upload preuves, `submit_deposit_proof`, `admin_audit_logs`) | aucune en interface → permission staff côté serveur |
| Copier les coordonnées de dépôt | Repli « Coordonnées » | Récapitulatif | presse-papiers | — |
| Lister et compter les paiements | Table + puces | Liste + puces | `payments`, `clients`, `payment_proofs` | aucune en interface (menu desktop : `canViewPayments`) |
| Exporter les paiements en cours (PDF du lot) | En-tête « Exporter (PDF) » | Feuille `+` | `exportPendingPaymentsPDF` (`payments` en `processing`) | aucune |
| Passer en cours | En-tête, survol « Traiter » | « Commencer le paiement » | `process_payment` (`start_processing`) | `canProcessPayments`, statut `ready_for_payment` |
| Valider un paiement (preuve + commentaire) | En-tête, survol | « Valider le paiement » (**sans commentaire**) | upload `payment-proofs` + `process_payment` (`complete`) | `canProcessPayments`, statut `processing` |
| Refuser un paiement | En-tête (≠ `cash_pending`) | Section décision (**y compris `cash_pending`**) | `process_payment` (`reject`) | `canProcessPayments`, non clos |
| Annuler un paiement (motif obligatoire si effectué) | Menu ⋯ | Section décision | `cancel_payment` | rôle super_admin, non remboursé |
| Modifier / corriger les montants et le taux | Menu ⋯ | En-tête de section + bouton | `admin_correct_payment` | `canProcessPayments` si ouvert ; super_admin si clos |
| Modifier le bénéficiaire (+ QR) | Fenêtre | Sur la page + `/edit-beneficiary` (orpheline) | `admin_update_payment_beneficiary` (+ storage `payment-proofs`) | `canProcessPayments`, non clos, pas en cash |
| Ajouter une preuve de paiement | Menu ⋯, zone, Ctrl+V | « Ajouter » | storage + `payment_proofs` + `payment_timeline_events` | `canProcessPayments`, non clos |
| Ajouter une instruction | Menu ⋯ | « Ajouter une instruction du client » | `useAdminUploadPaymentInstruction` (storage + `payment_proofs` `admin_instruction`) | `canProcessPayments`, non clos |
| Remplacer une preuve de paiement | Bouton | **absent** | upload + `delete_payment_proof` | preuve admin ou super_admin |
| Supprimer une preuve de paiement | Bouton | Bouton | `delete_payment_proof` | idem |
| Instruction de paiement (PDF, image, texte) | Bouton violet + fenêtre | Bouton + feuille (partage natif) | client (`paymentInstruction`) | — |
| Fiche en PNG (copier / télécharger) | 2 boutons | **absent** | client (`nodeImage`) | — |
| Reçu PDF d'un paiement | En-tête + bouton | En-tête | client (`PaymentReceiptPDF`) | — |
| Faire signer le cash (admin) | Section signature | Section signature | storage `cash-signatures` + `confirm_cash_payment` | `canProcessPayments`, non clos |
| Créer un paiement | Fenêtre | Feuille `+` → assistant | `create_admin_payment`, création de bénéficiaire, `wallets` | aucune en interface → serveur |
| Créer un paiement groupé | Bouton d'en-tête → page partagée | Feuille `+` → page partagée | `create_payment_batch` | aucune en interface → serveur |
| Voir un lot | Seulement juste après la création | idem | `payment_batches`, `payments` | — |
| Parcourir les justificatifs | Page partagée | Page | `deposit_proofs` (100) | aucune |
| Consulter le journal | « Journaux » | « Historique » | `admin_audit_logs` (100) | desktop : menu `canViewLogs` ; mobile : aucune |
| Agent : scanner / saisir l'ID | — | `/a/scan` | `parseCashQRCode` | rôle `cash_agent` |
| Agent : procéder (scan) | — | Fiche `/a/payment/:id` | `scan_cash_payment` | `cash_agent` |
| Agent : confirmer la remise + signature | — | `/confirm` | storage `cash-signatures` + `confirm_cash_payment` | `cash_agent` |
| Agent : reçu cash | — | Fiche / succès | `CashReceiptDownloadButton` | — |
| Agent : langue / déconnexion | — | `/a` | `LanguageContext`, `logout` | — |

---

## 4) Écarts desktop → mobile

### Présent sur desktop, absent ou dégradé sur mobile
1. **Case « Vérifié en banque »** (`set_deposit_verified`) : absente sur mobile, ni dans la liste ni dans la fiche.
2. **Onglet « Info manquante »** (`waiting_beneficiary_info`) absent de la liste des paiements mobile, alors que c'est la file des paiements bloqués.
3. **Recherche côté serveur** (dépôts : nom, téléphone, référence ; paiements : + bénéficiaire) : sur mobile elle filtre seulement les pages déjà chargées et ne cherche pas le bénéficiaire.
4. **Filtre Méthode des dépôts cassé sur mobile** : `params.methods` est ignoré par `usePaginatedAdminDeposits` (qui ne lit que `method`) et retiré quand il est le seul filtre actif.
5. **Ordre de file par défaut** : desktop ouvre sur « À traiter », triée du plus ancien au plus récent ; mobile ouvre sur « Tous ».
6. **Colonnes de la liste des paiements** : bénéficiaire (et « infos manquantes »), montant XAF, taux + étiquette « perso », référence. Dans la liste des dépôts : référence, téléphone.
7. **Actions rapides depuis la liste** (Valider / Rejeter un dépôt, Traiter / Valider un paiement) : sur mobile il faut toujours ouvrir la fiche.
8. **Suivi d'un paiement** : absent de la fiche mobile (les données sont chargées mais pas affichées).
9. **Fiche de paiement partageable** (carte claire avec le QR) + **Copier l'image / Image .png** : absentes sur mobile, qui n'a que l'instruction de paiement.
10. **Commentaire visible par le client à la validation** d'un paiement : absent sur mobile.
11. **Remplacer une preuve de paiement** : absent sur mobile. **Ouvrir un PDF** de preuve de paiement : le mobile l'affiche comme une image vide.
12. **Reçu PDF d'un paiement** : sur mobile il n'inclut ni le QR cash ni la signature.
13. **Information « Lot »** sur la fiche paiement : absente sur mobile (et non cliquable sur desktop).
14. **Solde du client à la création d'un dépôt** : absent sur mobile.
15. **Vérification du montant côte à côte** (preuve ↔ montant déclaré ↔ solde après validation) : sur mobile le solde après validation n'apparaît que dans la feuille de validation.
16. **Lien vers la fiche client depuis la fiche dépôt** : absent sur mobile (il existe pour les paiements : « Fiche → »).
17. **Garde de permission dans les menus** (Dépôts `canViewDeposits`, Paiements `canViewPayments`, Journaux `canViewLogs`) : absente sur mobile.
18. **Raccourcis clavier** (⌘⏎, Échap, Entrée sur une ligne) : sans objet au doigt, mais il faut un équivalent (barre de décision collante, déjà présente).

### Présent sur mobile, absent sur desktop
1. Période **personnalisée** pour les dépôts, et plage de dates libre pour les paiements (desktop : préréglages seulement).
2. **Tri des paiements** au choix dans un menu (Plus récent, Plus ancien, Montant ↓, Montant ↑) ; sur desktop on trie par l'en-tête.
3. Puces **Validés / Rejetés** (dépôts) et **Terminés / Rejetés** (paiements) directement accessibles.
4. Bandeau « N paiements réglés aujourd'hui, ¥… ».
5. Écran de succès après la création d'un paiement, avec **« Envoyer l'instruction au partenaire »** ; le desktop ouvre directement la fiche.
6. Fiche dépôt : affiche le **motif du refus** et la **note interne** de refus (`admin_internal_note`), que le desktop n'affiche pas.
7. Sur mobile, le super_admin peut **annuler un dépôt déjà terminé** (validé, rejeté, annulé). Le desktop masque cette action. Il faut trancher : c'est soit une faille, soit une capacité voulue.
8. Sur mobile, on peut **refuser un paiement en `cash_pending`** ; le desktop l'exclut. Il faut aligner sur la RPC.
9. Fiche paiement mobile : **`CashQRCode`** dédié et **Changer le QR** directement sur la page.
10. Partage natif de l'instruction (Partager l'image ou le PDF, via le pont de l'app HQ).

### Manquant des deux côtés
- **Liste des lots** de paiements groupés : aucun point d'entrée vers `/m/payments/batch/:id` en dehors de la création.
- **Justificatifs des paiements** : la page n'agrège que les preuves de dépôts.
- Journal : pas de lien vers l'objet, pas de détail, pas de filtre par date, limite fixe de 100.
- **Garde de permission dans l'interface pour les créations** (dépôt, paiement, lot) : un support sans `canProcessDeposits` remplit tout l'assistant, puis le serveur refuse.

---

## 5) Problèmes UX mobile

- **Filtre Méthode sans effet** dans la liste des dépôts (bug, voir 4.4), alors qu'il affiche un point d'état « filtre actif ».
- **La recherche trompe** : elle ne cherche que dans les pages déjà chargées, donc un dépôt ancien reste introuvable alors que le texte d'aide promet « Nom ou téléphone ». La référence est cherchée sans que ce soit dit.
- **Les filtres se perdent** : ils vivent dans l'état local du composant. Ouvrir une fiche puis revenir avec `navigate('/m/deposits')` remonte la liste, et les filtres comme la position de défilement sont perdus.
- **Libellés de statut incohérents** : la liste dit « Terminé », « Rejeté », « Info att. », « Prêt », « Cash att. » ; la fiche dit « Effectué », « Refusé », « En attente infos », « Prêt à payer », « QR Généré » ; l'agent cash affiche « Scanné » pour `cash_pending` (« QR généré »). Même chose pour les verbes : « Passer en cours » / « Traiter » (desktop) contre « Commencer le paiement » (mobile) ; « Valider » contre « Confirmer le paiement » (titre de la feuille) ; « Rejeter » (desktop) contre « Refuser » (mobile) ; « Relevé PDF » contre « Reçu ».
- **`admin_comment` porte deux noms** sur mobile : « Note interne (visible uniquement par les admins) » dans la feuille de validation, mais « Note pour le client » dans « Le détail ».
- **Un même écran porte deux noms** : « Historique » (mobile) contre « Journaux » (desktop) ; « Justificatifs » contre « preuves » dans les fiches.
- **Écrans en double ou orphelins** : `/m/payments/:id/edit-beneficiary` est inaccessible et dans l'ancien style (la fiche fait la même chose sur la page) ; `/a/login` double `/m/login`, et la déconnexion de l'agent renvoie vers `/a/login` et non vers la connexion unique ; les modes « non embedded » de `MobileDepositsScreenV2` et `MobilePaymentsScreen` (en-tête, bouton d'export en double) ne servent plus que dans `__screenshot__`.
- **Impasses** : le lot n'est visible qu'une fois, juste après sa création ; « Lot » n'est pas cliquable ; la page Justificatifs ne mène pas au dépôt ; le journal ne mène à rien ; les créations sont ouvertes à des rôles que le serveur refuse ensuite.
- **Trop de texte et fiches trop longues** : la fiche paiement mobile empile client, QR cash, bénéficiaire (avec formulaire sur la page), montants, signature, preuves (une carte 16:10 par preuve), décision et détail. La fiche dépôt affiche toutes les preuves en cartes pleine largeur. La décision se retrouve loin sous la ligne de flottaison ; la barre collante compense en partie. Les phrases explicatives sont nombreuses (« Le client voit “en vérification” et vos collègues savent… »).
- **Profondeur de navigation** : créer = Opérations → `+` → feuille → assistant en 4 à 6 étapes → succès → fiche. Paiement groupé = Opérations → `+` → page → feuille bénéficiaire → feuille carnet → feuille de vérification.
- **Assistant de dépôt** : la date antidatée se trouve à l'étape « Combien ? » ; l'avertissement « limite mobile money » s'affiche avant même le choix de la méthode ; le message de succès est faux quand une preuve a déjà été jointe.
- **Justificatifs** : deux tuiles qui affichent le même nombre ; le badge « Dépôt » est sur chaque vignette alors que la page ne contient que des dépôts.
- **Permissions visibles mais inutilisables** : Remplacer / Supprimer une preuve de dépôt s'affichent sans vérifier `canProcessDeposits` ; l'onglet « Opérations » s'affiche à tous les rôles admin, y compris le trésorier.
- **Agent cash** : les onglets disent « À payer » pour quatre statuts différents ; la fiche propose « Procéder » puis l'écran de confirmation, avec repli silencieux si le paiement est déjà scanné. Le parcours est clair mais compte trois écrans pour une seule remise.

---

## 6) Fichiers lus

- Routage et gardes : `src/App.tsx` (l. 33-140, 332-358, 438-443), `src/desktop/components/AdminRouteWrapper.tsx`, `src/components/admin/ProtectedAdminRoute.tsx`, `src/mobile/components/MobileRouteWrapper.tsx`, `src/mobile/components/agent-cash/AgentCashRouteWrapper.tsx`, `src/mobile/components/agent-cash/AgentCashTabBar.tsx`, `src/lib/staffHome.ts`, `src/contexts/AdminAuthContext.tsx` (matrice des rôles), `src/desktop/components/layout/desktopNav.ts`, `src/mobile/components/layout/MobileTabBar.tsx`
- Desktop : `src/desktop/screens/deposits/{DesktopDepositsScreen,DesktopDepositPanel,DesktopNewDeposit,DepositVerifiedToggle}.tsx`, `src/desktop/screens/payments/{DesktopPaymentsScreen,DesktopPaymentPanel,DesktopNewPayment,PaymentInstructionDialog}.tsx`, `src/desktop/screens/more/{DesktopHistoryScreen,DesktopMoreScreen}.tsx`
- Mobile : `src/mobile/screens/operations/MobileOperationsScreen.tsx`, `src/mobile/screens/deposits/{MobileDepositsScreenV2,MobileDepositDetailV2}.tsx`, `src/mobile/screens/deposits/new-deposit/MobileNewDepositV2.tsx`, `src/mobile/screens/payments/{MobilePaymentsScreen,MobilePaymentDetail,MobileNewPayment,MobilePaymentInstructionSheet,MobileBeneficiaryEdit,BulkPaymentCreate,BulkPaymentDetail}.tsx`, `src/mobile/screens/more/{MobileProofsScreen,MobileHistoryScreen,MobileMoreScreen}.tsx`, `src/mobile/screens/agent-cash/{AgentCashLogin,AgentCashPayments,AgentCashScanner,AgentCashPaymentDetail,AgentCashConfirm,AgentCashSuccess}.tsx`
- Hooks et bibliothèques : `src/hooks/{useAdminDeposits,usePaginatedDeposits,usePaginatedPayments,useAdminPayments,usePayments,usePaymentProofUpload,useAgentCashActions,useAgentCashPayments,usePaymentBatches,useAdminData}.ts`, `src/lib/{depositsList,paymentsList,paymentEdits,paymentActions,terminalStatuses,exportPendingPaymentsPDF}.ts`, `src/types/{deposit,payment}.ts`
