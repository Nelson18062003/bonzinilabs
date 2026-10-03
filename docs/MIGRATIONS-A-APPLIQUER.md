# Migrations à appliquer — registre

> Fichier de consignation : ce qu'il faut **pousser dans Supabase à la main** et les
> étapes post-migration. À tenir à jour à chaque PR qui embarque du SQL.

## En attente

### `20261002100000_reception_full_control.sql`
**PR :** Cargo › Réception refaite — dépôts et colis d'abord, plusieurs photos par colis, contrôle total
**Contenu :**
- `parcel_photos` (N photos par colis, RLS lecture staff, aucune écriture directe) ; les photos existantes y sont
  recopiées comme couvertures, et `parcels.photo_path` reste la couverture (trigger) — étiquettes, Douala inchangés.
- `parcel_deposits` : `cancelled_at / cancelled_by / cancel_reason` (suppression douce) et `last_seq` (un numéro de
  colis supprimé n'est jamais redonné : il peut déjà être imprimé sur une étiquette).
- `reception_add_parcel` et `reception_update_parcel` prennent `p_photo_paths` (l'ancienne signature est retirée ;
  les apps déjà ouvertes qui envoient `p_photo_path` continuent de marcher). L'équipe cargo ajoute un colis à un dépôt
  fermé ; un colis chargé en avion ne se modifie plus (seul le conteneur était vérifié).
- Nouvelles RPC, toutes étiquetées `@mola` : `reception_add_parcel_photos`, `reception_remove_parcel_photo`,
  `reception_set_parcel_cover`, `reception_update_deposit`, `reception_cancel_deposit`, `reception_restore_deposit`,
  `reception_board` ; `reception_remove_parcel(uuid, text)` (motif) remplace `reception_remove_parcel(uuid)`.
- Testée sur un Postgres local (droits réceptionnaire / support / admin, devis réglé, colis chargé, annulation puis
  rétablissement, journal) et idempotente (deux exécutions successives).

**Comment pousser :** appliquée par le workflow `deploy-edge-functions.yml` au merge (si `SUPABASE_DB_PASSWORD` est
posé), sinon coller le fichier dans l'éditeur SQL. Puis `/gen-types` (les écrans passent par `rpcJson` en attendant).

### `migrations/20260918_consolidated.sql` (= `20260918100000_wallet_overdraft.sql` + `20260918110000_payment_cancel_reason_and_edit.sql`)
**PR :** Découvert autorisé · relevé par période · annulation / modification de paiement · formulaire client
**Contenu :**
- `wallets.overdraft_limit_xaf` + contrainte `balance_xaf >= -overdraft_limit_xaf` ; `admin_set_wallet_overdraft`
  (super admin, `canGrantOverdraft`) ; six RPC de débit redéfinies avec ce plancher.
- `cancel_payment(uuid, text)` (motif, même paiement effectué) — l'ancienne `cancel_payment(uuid)` est supprimée ;
  `admin_correct_payment` ouverte aux agents `canProcessPayments` sur un paiement en cours.
- Testée sur un Postgres local (16 scénarios) et idempotente (deux exécutions successives).

**Comment pousser :** coller `migrations/20260918_consolidated.sql` dans l'éditeur SQL, puis `/gen-types`
et redéployer l'edge function `admin-assistant` (nouvelle permission dans sa matrice, outil `cancel_payment` avec motif,
outil `generate_rate_flyer` avec `country_key` pour le flyer Gabon…) ainsi que `generate-flyer` (pilule « Taux du jour · Gabon »).
Aucune migration SQL pour les taux par pays : ils réutilisent `rate_adjustments` / `update_rate_adjustment`.


### `20260607120000_mola_operations_radar_and_daily_digest.sql`
**PR :** Mola — profondeur + radar partagé + digest auto
**Contenu :**
- `mola_operations_radar(...)` — RPC **lecture seule**, étiquetée `@mola` : dépôts en
  attente trop vieux, paiements en souffrance, soldes dormants, taux perso récents
  (noms + montants + ancienneté). Source de vérité partagée Mola + cron.
- `run_mola_daily_digest()` + cron `mola-daily-digest` (06:00 UTC = 07:00 Douala) —
  résumé Telegram quotidien. **Inerte** tant que les secrets Vault ne sont pas posés.

**Comment pousser :**
```bash
npx supabase db push --linked
# puis régénérer les types (hygiène — la RPC read n'est pas dans la parité des écritures) :
npx supabase gen types typescript --project-id fmhsohrgbznqmcvqktjw --schema public > src/integrations/supabase/types.ts
```

**Pré-requis (déjà en place sur ce projet) :** extensions `pg_cron` et `pg_net` activées
(utilisées par `run_email_drainer`).

**Pour ACTIVER le digest** (sinon il reste inerte, sans erreur) — Project Settings → Vault :
| Secret Vault | Valeur |
|---|---|
| `telegram_bot_token` | même valeur que le secret Edge `TELEGRAM_BOT_TOKEN` |
| `telegram_chat_id` | même valeur que `TELEGRAM_CHAT_ID` |

**Ordre conseillé :** pousser cette migration **avant** de merger la PR (le merge
redéploie `admin-assistant`, qui appelle la RPC ; un repli évite toute casse si l'ordre
est inversé).

## Appliquées
_(rien encore)_
