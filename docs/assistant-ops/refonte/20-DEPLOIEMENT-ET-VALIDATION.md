# Runbook — Déployer & valider Mola (les 2 PR, en une passe)

> But : que tu déploies **tout** (refonte + nettoyage taux + Mola + étiquetage) sans te tromper d'ordre,
> et que tu **vérifies chaque fonctionnalité** par un test concret. Rien d'irréversible sans filet.

## 0. État de départ
- **PR #136** : mergé sur `main` (refonte Mola, 6 migrations, nettoyage taux, fichier SQL consolidé). **Pas encore déployé** sur ta base/fonction.
- **PR #137** : à merger (nom « Mola » + prénom + étiquetage complet + convention).

## 1. Pré-vol (Git)
1. **Merge le PR #137** sur `main` (bouton « Merge » sur GitHub).
2. En local : `git checkout main && git pull origin main`.

## 2. Déploiement (ordre STRICT)
```bash
# a) Migrations — applique TOUTES les migrations en attente (les 6 de #136 + l'étiquetage complet de #137)
npx supabase db push --linked

# b) Types — IMPORTANT après les migrations (sinon le test de parité Mola se trompe)
npx supabase gen types typescript --project-id fmhsohrgbznqmcvqktjw --schema public > src/integrations/supabase/types.ts

# c) La fonction (le cerveau de Mola)
npx supabase functions deploy admin-assistant

# d) Le frontend (le nom « Mola » à l'écran, suppression des approximations RMB)
npm run build   # puis déploie le build comme d'habitude (Vercel)
```
> Astuce : si tu préfères, le fichier **`docs/DEPLOY_MOLA_REFONTE.sql`** regroupe les 6 migrations de #136 en un seul SQL (éditeur Supabase) — mais alors **n'utilise PAS aussi `db push`** pour les mêmes. La migration d'étiquetage complet de #137 (`20260603180000`) s'applique via `db push`.

## 3. Une fois, après déploiement
- Connecte-toi en **super_admin** et demande à Mola : **« réindexe le savoir »** (outil `reindex_knowledge`). S'il répond `indexed: 0`, c'est que les embeddings (gte-small) ne sont pas dispo dans ton runtime → la mémoire vectorielle reste vide **mais tout le reste marche** (profil, résumé, etc.).

## 4. Checklist de validation (fonctionnalité → test → résultat attendu)

| # | Test (ce que tu écris à Mola) | Attendu |
|---|---|---|
| 1 | « tu t'appelles comment ? » | « Je suis **Mola**… » |
| 2 | (ouvre l'écran) | Onglet/écran nommé **Mola** ; accueil « Je suis Mola » ; il t'appelle **Nelson** à l'occasion |
| 3 | « paie 2 000 000 XAF en Alipay pour Jonas au taux 78 » | Carte de paiement avec **taux 78 personnalisé** (pas le taux du jour) |
| 4 | « annule le dépôt BZ-DP-… » | Il **découvre** `cancel_deposit` (aucun outil codé) → carte → exécute |
| 5 | « enregistre Alibaba comme bénéficiaire Alipay réutilisable de Jonas » | Carte `create_beneficiary` |
| 6 | « remplace la preuve du paiement BZ-… » (+ joins une image) | Supprime l'ancienne, attache la nouvelle |
| 7 | « retiens que je préfère les réponses courtes » | Carte « Mémoriser » → nouvelle conversation : il s'en souvient |
| 8 | « que se passe-t-il quand je valide un dépôt ? » | Réponse juste (crédite le solde) — **pas** « je ne sais pas » |
| 9 | conversation > 20 messages, puis référence le début | Contexte tenu (mémoire) |
| 10 | (en compte **support**) « soldes trésorerie en SQL » | **Refus** scopé (« ton rôle n'a pas accès ») |
| 11 | « donne l'IBAN complet du bénéficiaire du paiement X » | IBAN **masqué** (`****1234`) |
| 12 | Écrans wallet client / fiche client / dashboard | **Plus d'approximation RMB** sous le solde |
| 13 | `admin_audit_logs` (dernière ligne `assistant_query`) | `usage` (tokens) + `est_cost_usd` présents |

## 5. Dépannage (par symptôme)
- **Une migration échoue** → lis le message. Les migrations sont idempotent-friendly (`if [not] exists` / `create or replace`). Le `DROP exchange_rates` est `if exists` (sûr). Si blocage, copie l'erreur, on regarde.
- **`functions deploy` échoue (type-check Deno)** → c'est ici que le code edge est vraiment type-checké (je ne peux pas le faire en sandbox). Copie l'erreur, je corrige.
- **Mola répond « je ne sais pas » / refuse une action qui existe** → demande-lui d'appeler `find_capability` ; si la capacité n'y est pas, c'est qu'il manque une étiquette `@mola` (cf. convention `CLAUDE.md`).
- **La mémoire ne « se souvient » pas** → vérifie les logs de la fonction : si `Supabase.ai`/gte-small indisponible, l'embedding renvoie `null` (best-effort) → le profil + le résumé marchent quand même.
- **Un écran plante après le DROP exchange_rates** → ne devrait pas (vérifié : aucune FK, frontend nettoyé, `tsc` exit 0). Si ça arrive, copie l'erreur ; on a la cartographie (`doc 18`) pour remonter.

## 6. Filet / rollback
- **Code** : tout est dans Git (PR #136 + #137). Revert d'un merge possible.
- **Migrations** : `DROP exchange_rates` est la seule destruction de données — le SQL est conservé (réversible : on garde le `CREATE TABLE` d'origine dans l'historique des migrations). Les autres migrations ne suppriment rien.
- **Mola** : tout mouvement d'argent reste derrière **ta confirmation** → même si Mola se trompe, rien d'irréversible ne part sans toi.

## 7. Après validation — quoi remonter
Pour chaque test qui échoue : **le n° du test + ce que Mola a répondu + (si possible) le log de la fonction.** On itère sur du concret.

*Une fois cette checklist verte, Mola est en prod, AI-native, personnalisé, et sous ton contrôle.*
