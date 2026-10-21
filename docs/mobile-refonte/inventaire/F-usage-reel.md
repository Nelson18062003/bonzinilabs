# F — Usage réel de l'app staff (mesuré en production)

> Source : base de production `fmhsohrgbznqmcvqktjw`, requêtes **SELECT uniquement**, exécutées le 21/10/2026.
> Fenêtres : 90 jours (≈ 23/07 → 21/10/2026) et 30 jours (≈ 21/09 → 21/10/2026). Heures en `Africa/Douala` (UTC+1).
> Aucune donnée personnelle : le staff est désigné par son rôle, les clients uniquement par des comptages.

---

## 1) Résumé

**Le constat principal : l'app staff est aujourd'hui une app de saisie « dépôt + paiement » utilisée par UNE seule personne (super_admin) depuis un ordinateur, plus une app de réception de colis utilisée par 3 réceptionnistes sur téléphone.** Tout le reste est faible ou nul.

- **98 % des dépôts et 100 % des paiements des 90 derniers jours ont été saisis par le staff « pour le client »** (`create_deposit_for_client` 594 / 608 dépôts ; `create_payment_for_client` 813 / 813 paiements). Le client ne passe pas d'ordre lui-même : c'est le staff qui joue ce rôle.
- **Un seul compte fait ~92 % des actions** : le super_admin a 3 280 actions sur 3 570 en 90 jours, et il a été actif **30 jours sur 30**. Ses sessions récentes viennent de **Windows (bureau)** et, depuis le 21/10, de l'**app native BONZINI HQ (iOS)**.
- Les dépôts sont **validés dans la foulée** de leur saisie (médiane 6 s, p90 < 1 min) : ce n'est pas une file de revue, c'est un **formulaire en 2 temps**. Pour les paiements, médiane 8,5 min et p90 ≈ 4 h 50 (le temps d'exécuter le paiement en Chine).

| Usage | Modules |
|---|---|
| **Très utilisés** (quotidien) | **Paiements** (≈ 9/j sur 90 j, 11,9/j sur 30 j, pic 30/j) · **Dépôts** (≈ 6,8/j, 9,2/j sur 30 j, pic 17/j) · **Réception de colis** (depuis le 21/09 : 4 dépôts de colis/j et 5 colis/j sur 30 j, pic 18 dépôts et 24 colis/j) |
| **Utilisés régulièrement** (hebdo) | Création de clients (1,5/j) · Ajustements de portefeuille (≈ 1/j, surtout des débits) · Taux du jour (0,6/j, 47 jours sur 90) · Achats USDT / trésorerie (0,7/j, 41 jours sur 90) · Bénéficiaires (0,7/j) |
| **Peu utilisés** | Cargo maritime (6 conteneurs, tous créés les 11–12/09, données posées par script) · Devis colis (8, dont 7 brouillons) · Fret aérien (1 AWB « PLANNED ») · Mola / assistant (22 messages en 90 j, **0 depuis le 18/09**) · Notifications push staff (5 envois, depuis le 20/10) · Découvert (10 réglages) |
| **Jamais utilisés / à l'arrêt** | Lots de paiements (`payment_batches` : 0 en 90 j) · Ventes USDT (2 en 90 j, 0 en 30 j) · Chat support (0 message depuis le 15/06 ; 38 conversations sur 45 vides) · Douane : classifications et audits (0) · Prospects / commercial (0 fiche, 0 objectif — alors que 3 commerciaux existent) · Sorties d'entrepôt `parcel_releases` (0) · Pointage entrepôt `checked_in_at` (0) · Colis aériens `air_packages` (0) · Paiement cash scan/signature (27 paiements cash, **0 scanné, 0 signé**) · Paiements de devis (0) |

**Pistes pour la refonte mobile (priorités dictées par l'usage)**
1. Écran n°1 = **saisie rapide « Dépôt pour un client » + validation en un geste** et **« Paiement pour un client » → terminer / rejeter**. C'est 80 % du volume.
2. Écran n°2 = **Réception de colis** (ouvrir un dépôt, photos, fermer) pour le rôle `receptionist` — déjà mobile (iOS + Android navigateur).
3. Accès secondaire : clients, taux du jour, achats USDT, ajustements.
4. Tout le reste (cargo, douane, chat, prospects, lots, aérien, sorties d'entrepôt) peut rester **derrière un menu « Plus »** tant que l'usage n'existe pas.

---

## 2) Équipe par rôle

| Rôle | Comptes actifs | Désactivés | Ont agi (audit) sur 30 j | Jours actifs / 30 | Dernière connexion (auth) |
|---|---|---|---|---|---|
| super_admin | 1 | 0 | 1 | **30** | 21/10 |
| receptionist | 3 | 0 | 3 | 21 (cumul équipe) | 26/09, 07/10, 20/10 |
| commercial | 3 | 0 | **0** | 0 | 2 se sont connectés le 20/10, 1 jamais |
| ops | 1 | 1 | 1 | 4 | 18/10 (le désactivé : 11/05) |
| cash_agent | 0 | 1 | 0 | 0 | 03/04 (désactivé) |
| **Total** | **8** | **2** | **5** | | |

Remarques :
- `user_roles.last_login_at` est **vide pour tous** : la colonne n'est pas alimentée ; utiliser `auth.users.last_sign_in_at`.
- Les réceptionnistes ont été créés entre le 21/09 et le 02/10, les commerciaux entre le 05/10 et le 20/10 : ces modules sont **très récents**.
- Le rôle `ops` est quasi inactif depuis l'été (35 actions en 90 j, contre ~480 sur la période mars–juillet).

---

## 3) Actions par module et par rôle (`admin_audit_logs`)

Total 90 j : **3 570 actions** (super_admin 3 280 · receptionist 255 · ops 35). Total 30 j : 1 782.

### 3.1 Agrégé par module (90 j)

| Module | Actions 90 j | Actions 30 j | Rôles |
|---|---|---|---|
| Paiements (créer pour client, terminer, rejeter, annuler, corriger) | 1 628 | 708 | super_admin ≈ 99 % |
| Dépôts (créer pour client, valider, vérifier, annuler, preuves) | 1 249 | 600 | super_admin ≈ 99 % |
| Réception colis (ouvrir/fermer/annuler/assigner dépôt, modifier colis, charger) | 264 | 251 | receptionist 234 · super_admin 20 · ops 10 |
| Clients (créer, source, téléphones, identité, commercial) | 160 | 111 | super_admin 135 · receptionist 21 · ops 4 |
| Portefeuilles (débit/crédit, découvert, saisie antidatée) | 112 | 56 | super_admin |
| Trésorerie (achats/ventes USDT, annulation, contreparties) | 73 | 18 | super_admin |
| Taux (taux du jour, ajustements) | 60 | 26 | super_admin |
| Mola / assistant (`assistant_query`) | 11 | 0 | super_admin 9 · ops 2 |
| Équipe (créer/désactiver admin, mot de passe, profil, passkey) | 12 | 9 | super_admin |
| Cargo / aérien / devis | 3 | 3 | super_admin |

### 3.2 Top des actions (90 j / 30 j), par rôle

| Rôle | Action | 90 j | 30 j | Total historique |
|---|---|---|---|---|
| super_admin | create_payment_for_client | 807 | 356 | 1 169 |
| super_admin | complete_payment | 748 | 317 | 1 121 |
| super_admin | create_deposit_for_client | 589 | 278 | 728 |
| super_admin | validate_deposit | 587 | 276 | 770 |
| receptionist | open_parcel_deposit | 120 | 114 | 120 |
| receptionist | close_parcel_deposit | 110 | 105 | 110 |
| super_admin | create_client | 94 | 47 | 146 |
| super_admin | WALLET_DEBITED | 73 | 30 | 123 |
| super_admin | record_usdt_purchase | 64 | 16 | 146 |
| super_admin | reject_payment | 61 | 33 | 124 |
| super_admin | verify_deposit | 56 | 44 | 56 |
| super_admin | create_daily_rates | 54 | 22 | 152 |
| super_admin | set_client_source | 29 | 29 | 29 |
| receptionist | create_client | 16 | 16 | 16 |
| super_admin | WALLET_CREDITED | 15 | 3 | 50 |
| super_admin | backdate_late_entry | 14 | 14 | 14 |
| super_admin | cancel_parcel_deposit | 12 | 12 | 12 |
| super_admin | set_wallet_overdraft | 10 | 9 | 10 |
| super_admin | assistant_query | 9 | 0 | 466 |
| super_admin | CLIENT_PHONES_UPDATED | 8 | 7 | 8 |
| ops | create_payment_for_client | 6 | 0 | 183 |
| super_admin | update_rate_adjustment | 6 | 4 | 28 |
| ops | create_deposit_for_client | 5 | 0 | 199 |
| ops | validate_deposit | 5 | 0 | 185 |
| super_admin | void_treasury_operation | 5 | 2 | 25 |
| super_admin | cancel_deposit | 5 | 2 | 24 |
| receptionist | set_client_source | 5 | 5 | 5 |
| ops | create_client | 4 | 3 | 59 |
| super_admin | create_admin | 4 | 3 | 9 |
| ops | open_parcel_deposit | 4 | 4 | 4 |
| ops | close_parcel_deposit | 4 | 4 | 4 |
| receptionist | update_parcel | 4 | 4 | 4 |
| super_admin | cancel_payment | 3 | 2 | 61 |
| super_admin | open_parcel_deposit | 3 | 3 | 3 |
| super_admin | link_commercial_source | 3 | 3 | 3 |
| super_admin | close_parcel_deposit | 3 | 3 | 3 |
| super_admin | record_usdt_sale | 2 | 0 | 94 |
| ops | complete_payment | 2 | 0 | 44 |
| ops | assistant_query | 2 | 0 | 42 |
| super_admin | delete_deposit_proof | 2 | 0 | 13 |
| super_admin | reset_admin_password | 2 | 2 | 10 |
| super_admin | update_treasury_counterparty | 2 | 0 | 6 |
| super_admin | disable_admin | 2 | 2 | 2 |
| super_admin | set_client_identity | 1 | 1 | 1 |
| super_admin | register_passkey | 1 | 0 | 1 |
| ops | register_passkey | 1 | 0 | 1 |
| ops | assign_parcel_deposit | 1 | 1 | 1 |
| super_admin | assign_parcel_deposit | 1 | 1 | 1 |
| super_admin | send_parcel_quote | 1 | 1 | 1 |
| super_admin | load_parcels | 1 | 1 | 1 |
| super_admin | correct_payment | 1 | 0 | 1 |
| ops | update_parcel | 1 | 1 | 1 |
| super_admin | update_admin_profile | 1 | 1 | 1 |
| super_admin | create_air_shipment | 1 | 1 | 1 |
| (rôle inconnu) | create_admin | 1 | 1 | 1 |

Actions **historiques mais nulles sur 90 j** : `reject_deposit` (30), `delete_payment` (24), `create_treasury_counterparty` (23), tous les `assistant_exec_*` (≈ 80 au total : dépôts, paiements, achats USDT, ajustements…), `reset_client_password` (15), `delete_deposit` (13), `add_exchange_rate` (9), `create_payment_batch` (4), et toute l'activité `cash_agent` (rôle désactivé).

### 3.3 Qui écrit vraiment dans les tables de modules (colonnes « auteur »)

L'audit ne couvre pas tout (le cargo n'y apparaît presque pas). Contrôle croisé par les colonnes `*_by` :

| Table.colonne | super_admin | receptionist | ops | NULL (script/système) |
|---|---|---|---|---|
| payments.processed_by (90 j) | 809 | — | 3 | — |
| deposits.validated_by (90 j) | 586 | — | 5 | — |
| parcel_deposits.received_by | 3 | **120** | 4 | — |
| parcel_photos.taken_by | — | **77** | 4 | — |
| daily_rates.created_by (90 j) | 54 | — | — | — |
| usdt_purchases.created_by (90 j) | 64 | — | — | — |
| parcel_quotes.created_by | 8 | — | — | — |
| air_shipments.created_by | 1 | — | — | — |
| cargo_packages.created_by | 2 | — | — | 14 |
| cargo_documents.uploaded_by | — | — | — | 8 |
| cargo_steps.created_by | — | — | — | 11 |
| customs_notices.created_by | — | — | — | 8 |
| chat_messages (staff, historique) | 34 | — | — | — |

→ Le **cargo maritime et la douane ont été alimentés hors de l'app** (auteur NULL = SQL/script), pas par le staff.

---

## 4) Volumes et files d'attente par module

### 4.1 Création d'enregistrements par jour

| Module (table) | Total | 90 j | 30 j | Moy./j 90 j | Moy./j 30 j | Pic/j (90 j) | Jours actifs /90 | Premier | Dernier |
|---|---|---|---|---|---|---|---|---|---|
| Paiements (`payments`) | 1 359 | 813 | 356 | 9,03 | 11,87 | **30** | 80 | 03/03 | 21/10 |
| Dépôts (`deposits`) | 996 | 608 | 276 | 6,76 | 9,20 | **17** | 82 | 03/03 | 21/10 |
| Preuves de paiement | — | 860 | — | 9,6 | — | — | — | — | — |
| Preuves de dépôt | — | 782 | — | 8,7 | — | — | — | — | — |
| Écritures trésorerie (`treasury_ledger_entries`) | 489 | 179 | 50 | 1,99 | 1,67 | 13 | 41 | 16/05 | 19/10 |
| Colis (`parcels`) | 162 | 162 | 153 | 1,80 | 5,10 | **24** | 24 | 21/09 | 18/10 |
| Clients (`clients`) | 278 | 135 | 66 | 1,50 | 2,20 | 11 | 54 | 27/02 | 20/10 |
| Dépôts de colis (`parcel_deposits`) | 127 | 127 | 121 | 1,41 | 4,03 | **18** | 23 | 21/09 | 18/10 |
| Ajustements portefeuille | 168 | 88 | 33 | 0,98 | 1,10 | 27 | 27 | 03/03 | 16/10 |
| Photos de colis | 81 | 81 | 73 | 0,90 | 2,43 | 13 | 20 | 21/09 | 18/10 |
| Achats USDT | 146 | 64 | 16 | 0,71 | 0,53 | 4 | 41 | 16/05 | 19/10 |
| Bénéficiaires | 124 | 64 | 18 | 0,71 | 0,60 | 7 | 35 | 04/05 | 18/10 |
| Taux du jour (`daily_rates`) | 157 | 54 | 22 | 0,60 | 0,73 | 3 | 47 | 03/03 | 20/10 |
| Conversations chat | 45 | 23 | 1 | 0,26 | 0,03 | 3 | 17 | 17/05 | 24/09 |
| Messages Mola (`assistant_messages`) | 1 101 | 22 | 0 | 0,24 | 0 | 6 | 7 | 31/05 | 18/09 |
| Colis de conteneur (`cargo_packages`) | 16 | 16 | 15 | 0,18 | 0,50 | 11 | 3 | 12/09 | 03/10 |
| Étapes cargo (`cargo_steps`) | 11 | 11 | 11 | — | — | 11 | 1 | 04/10 | 04/10 |
| Avis douane (`customs_notices`) | 8 | 8 | 8 | — | — | 8 | 1 | 30/09 | 30/09 |
| Documents cargo | 8 | 8 | 8 | — | — | 8 | 1 | 04/10 | 04/10 |
| Devis colis | 8 | 8 | 8 | 0,09 | 0,27 | 2 | 6 | 22/09 | 09/10 |
| Conteneurs (`cargo_shipments`) | 6 | 6 | 0 | 0,07 | 0 | 6 | 1 | 11/09 | 12/09 |
| Push staff (`staff_push_log`) | 5 | 5 | 5 | — | — | 4 | 2 | 20/10 | 21/10 |
| Ventes USDT | 94 | 2 | 0 | 0,02 | 0 | 1 | 2 | 16/05 | 25/08 |
| Fret aérien (`air_shipments`) | 1 | 1 | 1 | — | — | 1 | 1 | 12/10 | 12/10 |
| Lots de paiements | 4 | 0 | 0 | 0 | 0 | — | 0 | 30/06 | 17/07 |
| Messages chat | 54 | 0 | 0 | 0 | 0 | — | 0 | 17/05 | 15/06 |
| Colis aériens, sorties d'entrepôt, classifications et audits douane, prospects, objectifs commerciaux, paiements de devis, `rate_adjustments` créés via `rate_adjustments`* | **0** | 0 | 0 | — | — | — | — | — | — |

\* `rate_adjustments` contient 9 lignes (anciennes) ; les modifications passent par `update_rate_adjustment` (6 en 90 j).

**Tendance hebdomadaire (actions d'audit)** : de 40–60/semaine fin juillet à **360–505/semaine depuis fin août**. La réception de colis démarre la semaine du 21/09 (77, puis 101, 35, 52 actions/semaine). Mola tombe à 0 dès mi-septembre.

| Semaine (lundi) | Paiements | Dépôts | Réception | Trésorerie | Taux | Mola | Total |
|---|---|---|---|---|---|---|---|
| 20/07 | 34 | 22 | 0 | 2 | 1 | 0 | 60 |
| 27/07 | 22 | 13 | 0 | 6 | 1 | 0 | 43 |
| 03/08 | 32 | 16 | 0 | 5 | 4 | 3 | 62 |
| 10/08 | 14 | 20 | 0 | 0 | 5 | 3 | 44 |
| 17/08 | 98 | 50 | 0 | 13 | 2 | 2 | 172 |
| 24/08 | 100 | 79 | 0 | 15 | 4 | 0 | 205 |
| 31/08 | 205 | 154 | 0 | 8 | 6 | 1 | 420 |
| 07/09 | 220 | 170 | 0 | 6 | 5 | 0 | 421 |
| 14/09 | 203 | 124 | 0 | 1 | 6 | 2 | 364 |
| 21/09 | 196 | 145 | 77 | 0 | 8 | 0 | 447 |
| 28/09 | 201 | 162 | 101 | 9 | 6 | 0 | 505 |
| 05/10 | 140 | 153 | 35 | 2 | 4 | 0 | 411 |
| 12/10 | 137 | 118 | 52 | 6 | 7 | 0 | 369 |
| 19/10 (partielle) | 33 | 20 | 0 | 1 | 2 | 0 | 65 |

### 4.2 Files d'attente actuelles (par statut)

| Module | Statut | Nb | dont créés < 30 j | Plus ancien | Lecture |
|---|---|---|---|---|---|
| Paiements | processing | **4** | 4 | 18/10 | file active réelle (petite) |
| Paiements | completed / rejected / cancelled_by_admin | 1 181 / 113 / 61 | 317 / 33 / 2 | | |
| Dépôts | created | **16** | 0 | 07/04 | **file morte** : 16 dépôts jamais traités depuis avril–sept. |
| Dépôts | validated / rejected / cancelled / cancelled_by_admin | 921 / 23 / 18 / 18 | 274 / 0 / 0 / 2 | | |
| Dépôts de colis | open | **6** | 6 | 24/09 | à fermer |
| Dépôts de colis | closed / cancelled | 109 / 12 | 105 / 10 | | |
| Colis | received / arrived | 161 / 1 | 153 / 0 | | aucun colis pointé (`checked_in_at` = 0), 1 seul affecté à un conteneur, 0 livré |
| Conteneurs | AT_SEA / ARRIVED / DELIVERED | 3 / 1 / 2 | 0 | 11/09 | suivi auto (125 événements transporteur) |
| Étapes cargo | todo / done | 9 / 2 | — | 04/10 | |
| Fret aérien | PLANNED | 1 | — | 12/10 | |
| Devis colis | draft / sent | 7 / 1 | — | 22/09 | 7 brouillons jamais envoyés |
| Chat | open | 45 | 1 | 17/05 | 0 non-lu staff ; 38 conversations vides |
| Avis douane | in_force / announced / watch (publiés) | 5 / 2 / 1 | — | 30/09 | |

### 4.3 Délais de traitement (90 j)

| Flux | Médiane | p90 | n |
|---|---|---|---|
| Paiement : création → terminé | 8,5 min | 290 min (≈ 4 h 50) | 750 |
| Dépôt : création → validé | 0,1 min (6 s) | 0,9 min | 591 |

### 4.4 Détails par méthode (90 j)

- **Paiements** : Alipay 735 (90 %) · WeChat 37 · cash 27 · virement 14. Les 27 paiements cash n'ont **aucun scan QR, aucune signature, aucun « remis »** → le parcours cash (scan/signature) n'est pas utilisé.
- **Dépôts** : MTN transfert 182 · OM retrait 113 · MTN retrait 112 · espèces en banque 112 · OM transfert 58 · virement 27 · agence 2 · Wave 2.
- **Ajustements portefeuille** : 73 débits, 15 crédits.
- **Push staff** : `cargo` 4, `reception` 1 (1 seul appareil inscrit dans `staff_push_devices`).
- Lots de paiements : 0 paiement rattaché à un lot sur 90 j.

---

## 5) Appareils (`auth.sessions.user_agent`, sessions encore en base)

| Rôle | Famille d'appareil | Sessions | Période |
|---|---|---|---|
| super_admin | Windows (bureau) | 1 | 20/10 → 21/10 |
| super_admin | **App BONZINI HQ (iOS, CFNetwork)** | 1 | 21/10 |
| ops | iOS (navigateur) | 34 | 08/03 → 18/10 |
| ops | Mac | 9 | 09/04 → 08/10 |
| ops | Android navigateur | 2 | 09/04 → 11/05 |
| receptionist | iOS (navigateur) | 5 | 25/09 → 18/10 |
| receptionist | Android navigateur | 4 | 25/09 → 14/10 |
| cash_agent (désactivé) | Android / Mac | 3 / 2 | 28/03 → 04/04 |
| commercial | — | 0 | (connectés le 20/10 selon `auth.users`, aucune session restante) |

Lecture :
- **Réception et ops = 100 % mobile** (iOS et Android, dans le navigateur). Pas encore de session de l'app native pour eux.
- **Le super_admin, qui fait 92 % du volume, travaille sur bureau** ; l'app native vient tout juste d'être ouverte (21/10). La refonte mobile doit donc gagner son usage, pas seulement le reproduire.
- Limite : `auth.sessions` ne garde que les sessions non expirées/non déconnectées ; c'est un échantillon, pas un historique complet.

---

## 6) Heures (Africa/Douala, actions d'audit sur 90 j)

| Heure | Total | super_admin | receptionist | ops |
|---|---|---|---|---|
| 00 | 40 | 39 | 0 | 1 |
| 01 | 25 | 25 | 0 | 0 |
| 02 | 32 | 32 | 0 | 0 |
| 03 | 63 | 60 | 3 | 0 |
| 04 | 107 | 98 | 9 | 0 |
| 05 | 106 | 92 | 13 | 1 |
| 06 | 189 | 137 | **52** | 0 |
| 07 | 147 | 129 | 18 | 0 |
| 08 | 172 | 158 | 14 | 0 |
| 09 | 254 | 231 | 21 | 2 |
| 10 | **341** | 311 | 29 | 1 |
| 11 | **362** | 324 | 35 | 3 |
| 12 | 273 | 247 | 16 | 9 |
| 13 | 226 | 202 | 21 | 3 |
| 14 | **336** | 327 | 6 | 3 |
| 15 | 207 | 190 | 12 | 5 |
| 16 | 201 | 199 | 2 | 0 |
| 17 | 88 | 84 | 2 | 2 |
| 18 | 54 | 52 | 2 | 0 |
| 19 | 85 | 85 | 0 | 0 |
| 20 | 64 | 64 | 0 | 0 |
| 21 | 76 | 76 | 0 | 0 |
| 22 | 85 | 83 | 0 | 2 |
| 23 | 39 | 36 | 0 | 0 |

- **Pointe : 9 h – 16 h** (64 % des actions), avec deux sommets à 10–11 h et 14 h.
- **Réception : 6 h – 13 h heure de Douala**, soit **13 h – 20 h à Guangzhou (UTC+8)** — cohérent avec l'entrepôt en Chine. Le sommet de 6 h Douala = 13 h Chine.
- **Activité de soirée et de nuit réelle** (19 h – 2 h : ≈ 450 actions, 13 %) — uniquement le super_admin : argument fort pour un usage sur téléphone hors bureau.
- **Jours** : lundi–vendredi 490–630 actions/jour de semaine cumulées, samedi 393, **dimanche 257** (activité 7 j/7). La réception est la plus active le vendredi (75) et le samedi (58).

| Jour | Total | super_admin | receptionist |
|---|---|---|---|
| Lun | 594 | 581 | 11 |
| Mar | 628 | 599 | 28 |
| Mer | 621 | 588 | 33 |
| Jeu | 494 | 461 | 23 |
| Ven | 585 | 489 | 75 |
| Sam | 393 | 335 | 58 |
| Dim | 257 | 228 | 27 |

---

## 7) Requêtes utilisées (SQL, lecture seule)

```sql
-- 2) Équipe par rôle
select role, coalesce(is_disabled,false) as disabled, count(*) from user_roles group by 1,2 order by 1;
select ur.role::text role, coalesce(ur.is_disabled,false) dis, u.last_sign_in_at::date last_sign_in, u.created_at::date created
from auth.users u join user_roles ur on ur.user_id=u.id order by 1;
select ur.role::text role, count(*) n_users, count(l.admin_user_id) as with_actions
from user_roles ur left join (select distinct admin_user_id from admin_audit_logs where created_at>now()-interval '30 days') l
  on l.admin_user_id=ur.user_id
where coalesce(ur.is_disabled,false)=false group by 1;

-- Activité par rôle
select ur.role::text role, coalesce(ur.is_disabled,false) dis, count(distinct l.admin_user_id) actors,
 count(*) filter (where l.created_at>now()-interval '30 days') n30,
 count(*) filter (where l.created_at>now()-interval '90 days') n90,
 min(l.created_at)::date first_action, max(l.created_at)::date last_action,
 count(distinct (l.created_at at time zone 'Africa/Douala')::date) filter (where l.created_at>now()-interval '30 days') active_days30
from admin_audit_logs l join user_roles ur on ur.user_id=l.admin_user_id group by 1,2 order by n90 desc;

-- 3) Actions par type et par rôle
select coalesce(ur.role::text,'(inconnu)') role, l.action_type,
 count(*) filter (where l.created_at > now()-interval '90 days') n90,
 count(*) filter (where l.created_at > now()-interval '30 days') n30, count(*) total
from admin_audit_logs l left join user_roles ur on ur.user_id=l.admin_user_id
group by 1,2 order by n90 desc, total desc limit 80;

-- 3.3) Auteurs réels dans les tables de modules
with x as (
 select 'parcel_deposits.received_by' t, received_by u from parcel_deposits
 union all select 'parcels.checked_in_by', checked_in_by from parcels where checked_in_by is not null
 union all select 'parcel_photos.taken_by', taken_by from parcel_photos
 union all select 'cargo_packages.created_by', created_by from cargo_packages
 union all select 'cargo_documents.uploaded_by', uploaded_by from cargo_documents
 union all select 'cargo_steps.created_by', created_by from cargo_steps
 union all select 'air_shipments.created_by', created_by from air_shipments
 union all select 'daily_rates.created_by', created_by from daily_rates where created_at>now()-interval '90 days'
 union all select 'usdt_purchases.created_by', created_by from usdt_purchases where created_at>now()-interval '90 days'
 union all select 'customs_notices.created_by', created_by from customs_notices
 union all select 'parcel_quotes.created_by', created_by from parcel_quotes
 union all select 'payments.processed_by(90j)', processed_by from payments where created_at>now()-interval '90 days' and processed_by is not null
 union all select 'deposits.validated_by(90j)', validated_by from deposits where created_at>now()-interval '90 days' and validated_by is not null
 union all select 'chat_messages.admin_sender', sender_id from chat_messages where sender_type::text<>'client'
)
select t, coalesce(ur.role::text, case when u is null then '(null/système)' else '(non-staff)' end) role, count(*)
from x left join user_roles ur on ur.user_id=x.u group by 1,2 order by 1,3 desc;

-- 4.1) Volumes par module (moyenne, pic, jours actifs)
with ev as (
 select 'deposits' m, created_at ts from deposits
 union all select 'payments', created_at from payments
 union all select 'payment_batches', created_at from payment_batches
 union all select 'wallet_adjustments', created_at from wallet_adjustments
 union all select 'cargo_shipments', created_at from cargo_shipments
 union all select 'cargo_packages', created_at from cargo_packages
 union all select 'cargo_documents', created_at from cargo_documents
 union all select 'cargo_steps', created_at from cargo_steps
 union all select 'air_shipments', created_at from air_shipments
 union all select 'air_packages', created_at from air_packages
 union all select 'parcel_deposits', created_at from parcel_deposits
 union all select 'parcels', created_at from parcels
 union all select 'parcels_checked_in', checked_in_at from parcels where checked_in_at is not null
 union all select 'parcel_photos', created_at from parcel_photos
 union all select 'parcel_quotes', created_at from parcel_quotes
 union all select 'parcel_releases', created_at from parcel_releases
 union all select 'usdt_purchases', created_at from usdt_purchases
 union all select 'usdt_sales', created_at from usdt_sales
 union all select 'treasury_ledger_entries', created_at from treasury_ledger_entries
 union all select 'daily_rates', created_at from daily_rates
 union all select 'chat_conversations', created_at from chat_conversations
 union all select 'chat_messages', created_at from chat_messages
 union all select 'customs_classifications', created_at from customs_classifications
 union all select 'customs_audits', created_at from customs_audits
 union all select 'customs_notices', created_at from customs_notices
 union all select 'prospects', created_at from prospects
 union all select 'staff_push_log', sent_at from staff_push_log
 union all select 'assistant_messages', created_at from assistant_messages
 union all select 'clients', created_at from clients
 union all select 'beneficiaries', created_at from beneficiaries
), d as (select m, (ts at time zone 'Africa/Douala')::date dy, count(*) n from ev where ts > now()-interval '90 days' group by 1,2)
select e.m, count(*) total, count(*) filter (where ts>now()-interval '90 days') n90, count(*) filter (where ts>now()-interval '30 days') n30,
 round(count(*) filter (where ts>now()-interval '90 days')/90.0,2) avg_day90,
 round(count(*) filter (where ts>now()-interval '30 days')/30.0,2) avg_day30,
 (select max(n) from d where d.m=e.m) peak_day90,
 (select count(*) from d where d.m=e.m) days_with_activity90,
 min(ts)::date first, max(ts)::date last
from ev e group by e.m order by n90 desc;

-- Tables vides / compteurs ponctuels
select (select count(*) from air_packages) air_packages, (select count(*) from parcel_releases) parcel_releases,
 (select count(*) from parcels where delivered_at is not null) parcels_delivered,
 (select count(*) from parcels where shipment_id is not null) parcels_in_container,
 (select count(*) from parcels where air_shipment_id is not null) parcels_air,
 (select count(*) from customs_classifications) cust_class, (select count(*) from customs_audits) cust_audits,
 (select count(*) from prospects) prospects, (select count(*) from prospect_client_claims) claims,
 (select count(*) from commercial_objectives) objectives, (select count(*) from rate_adjustments) rate_adj,
 (select count(*) from parcel_quote_payments) quote_payments, (select count(*) from cargo_costs) cargo_costs,
 (select count(*) from staff_push_devices) push_devices, (select count(*) from webauthn_credentials) passkeys,
 (select count(*) from treasury_counterparties) tcp, (select count(*) from treasury_accounts) tacc,
 (select count(*) from usdt_purchases where voided_at is null) usdt_p_live,
 (select count(*) from chat_messages where sender_type::text<>'client') chat_staff_msgs,
 (select count(*) from chat_messages) chat_msgs, (select count(*) from assistant_conversations) asst_conv;
select (select count(*) from deposit_proofs where uploaded_at>now()-interval '90 days') dep_proofs90,
 (select count(*) from payment_proofs where created_at>now()-interval '90 days') pay_proofs90,
 (select count(*) from payments where created_at>now()-interval '90 days' and batch_id is not null) pay_in_batch90;

-- 4.2) Files d'attente par statut
select 'deposits' m, status::text, count(*) n, count(*) filter (where created_at>now()-interval '30 days') n30, min(created_at)::date oldest from deposits group by 2
union all select 'payments', status::text, count(*), count(*) filter (where created_at>now()-interval '30 days'), min(created_at)::date from payments group by 2
union all select 'parcel_deposits', status::text, count(*), count(*) filter (where created_at>now()-interval '30 days'), min(created_at)::date from parcel_deposits group by 2
union all select 'parcels', status::text, count(*), count(*) filter (where created_at>now()-interval '30 days'), min(created_at)::date from parcels group by 2
union all select 'cargo_shipments', status::text, count(*), count(*) filter (where created_at>now()-interval '30 days'), min(created_at)::date from cargo_shipments group by 2
union all select 'air_shipments', status::text, count(*), 0, min(created_at)::date from air_shipments group by 2
union all select 'parcel_quotes', status::text, count(*), 0, min(created_at)::date from parcel_quotes group by 2
union all select 'chat_conversations', status::text, count(*), count(*) filter (where created_at>now()-interval '30 days'), min(created_at)::date from chat_conversations group by 2
union all select 'cargo_steps', status::text, count(*), 0, min(created_at)::date from cargo_steps group by 2
union all select 'customs_notices', status::text||'/pub='||published::text, count(*), 0, min(created_at)::date from customs_notices group by 2
order by 1,3 desc;
select count(*) conv, sum(unread_count_admin) unread_admin, count(*) filter (where unread_count_admin>0) conv_unread,
 count(*) filter (where last_message_at is null) conv_empty, max(last_client_message_at)::date last_client_msg,
 max(last_admin_message_at)::date last_admin_msg from chat_conversations;

-- 4.3) Délais
select 'payments' m,
 round(percentile_cont(0.5) within group (order by extract(epoch from processed_at-created_at)/60)::numeric,1) p50_min,
 round(percentile_cont(0.9) within group (order by extract(epoch from processed_at-created_at)/60)::numeric,1) p90_min, count(*) n
from payments where status='completed' and processed_at is not null and created_at>now()-interval '90 days'
union all select 'deposits',
 round(percentile_cont(0.5) within group (order by extract(epoch from validated_at-created_at)/60)::numeric,1),
 round(percentile_cont(0.9) within group (order by extract(epoch from validated_at-created_at)/60)::numeric,1), count(*)
from deposits where status='validated' and validated_at is not null and created_at>now()-interval '90 days';

-- 4.4) Méthodes, push, événements cargo, ajustements, cash
select 'push:'||kind k, count(*) n, max(sent_at)::date last from staff_push_log group by kind
union all select 'payment_method:'||method::text, count(*), max(created_at)::date from payments where created_at>now()-interval '90 days' group by method
union all select 'deposit_method:'||method::text, count(*), max(created_at)::date from deposits where created_at>now()-interval '90 days' group by method
union all select 'cargo_event:'||coalesce(classifier,'?'), count(*), max(created_at)::date from cargo_events group by classifier
union all select 'wallet_adj:'||adjustment_type::text, count(*), max(created_at)::date from wallet_adjustments where created_at>now()-interval '90 days' group by adjustment_type
order by 1;
select count(*) cash90, count(cash_scanned_at) scanned, count(cash_paid_at) paid, count(cash_signature_url) signed
from payments where method='cash' and created_at>now()-interval '90 days';
select (created_at at time zone 'Africa/Douala')::date d, count(*) from payments
where created_at>now()-interval '90 days' group by 1 order by 2 desc limit 3;

-- Tendance hebdomadaire
select date_trunc('week', created_at at time zone 'Africa/Douala')::date wk,
 count(*) filter (where action_type in ('create_payment_for_client','complete_payment','reject_payment')) pay,
 count(*) filter (where action_type in ('create_deposit_for_client','validate_deposit','verify_deposit')) dep,
 count(*) filter (where action_type like '%parcel%') recep,
 count(*) filter (where action_type like '%usdt%' or action_type like '%treasury%') treso,
 count(*) filter (where action_type like '%rate%') rates,
 count(*) filter (where action_type like 'assistant%') mola, count(*) total
from admin_audit_logs where created_at>now()-interval '91 days' group by 1 order by 1;

-- 5) Appareils
select ur.role::text role,
 case when s.user_agent ~ '; wv\)' then 'android_webview(app?)' when s.user_agent ~* 'android' then 'android_browser'
      when s.user_agent ~* 'iphone|ipad' then 'ios' when s.user_agent ~* 'windows' then 'windows'
      when s.user_agent ~* 'macintosh' then 'mac' else coalesce(left(s.user_agent,30),'null') end fam,
 count(*) n, min(s.created_at)::date first, max(coalesce(s.refreshed_at,s.updated_at))::date last
from auth.sessions s join user_roles ur on ur.user_id=s.user_id group by 1,2 order by 1,3 desc;

-- 6) Heures et jours
select extract(hour from l.created_at at time zone 'Africa/Douala')::int h, count(*) total,
 count(*) filter (where ur.role='super_admin') sa, count(*) filter (where ur.role='receptionist') rec,
 count(*) filter (where ur.role='ops') ops
from admin_audit_logs l left join user_roles ur on ur.user_id=l.admin_user_id
where l.created_at>now()-interval '90 days' group by 1 order by 1;
select extract(isodow from l.created_at at time zone 'Africa/Douala')::int dow, count(*) total,
 count(*) filter (where ur.role='super_admin') sa, count(*) filter (where ur.role='receptionist') rec
from admin_audit_logs l left join user_roles ur on ur.user_id=l.admin_user_id
where l.created_at>now()-interval '90 days' group by 1 order by 1;
```

### Limites de la mesure
- `admin_audit_logs` ne journalise pas toutes les écritures (cargo, douane, photos) : d'où le contrôle croisé par les colonnes `*_by` (§ 3.3).
- `auth.sessions` ne contient que les sessions encore valides : la répartition des appareils est indicative.
- Les modules commercial, réception et app native sont trop récents (septembre–octobre) pour une tendance sur 90 j ; regarder surtout la colonne 30 j.
