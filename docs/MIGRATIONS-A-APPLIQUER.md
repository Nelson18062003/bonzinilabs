# Migrations à appliquer — registre

> Fichier de consignation : ce qu'il faut **pousser dans Supabase à la main** et les
> étapes post-migration. À tenir à jour à chaque PR qui embarque du SQL.

## En attente

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
