# Runbook de déploiement — Fonctionnalité « Bénéficiaires »

> **À exécuter par le porteur produit** (la migration touche la PROD active).
> Tout le code est déjà mergé sur `claude/amazing-hawking-HQMup` et vérifié
> (type-check 0 · 85/85 tests · build OK · migrations testées sur Postgres 16).
> Ce runbook applique le seul morceau restant : **les 3 migrations DB + la régénération des types**.

---

## 0. Pré-requis (une fois)

```bash
# Être sur la branche de la feature, à jour
git checkout claude/amazing-hawking-HQMup
git pull origin claude/amazing-hawking-HQMup

# Installer les deps (le repo utilise bun ; npm marche aussi)
bun install        # ou: npm install

# Supabase CLI liée au projet (project id = fmhsohrgbznqmcvqktjw)
npx supabase link --project-ref fmhsohrgbznqmcvqktjw   # si pas déjà lié
```

Vérifier que les 3 migrations sont bien présentes :
```bash
ls supabase/migrations/2026060100000*.sql
# 20260601000000_beneficiaries_alias_relation_created_by.sql
# 20260601000001_beneficiaries_completeness_checks.sql
# 20260601000002_beneficiaries_dedup_unique.sql
```

---

## 1. SAUVEGARDE (obligatoire avant toute migration prod)

- Soit via le dashboard Supabase → **Database → Backups** (déclencher un backup à la demande),
- soit un dump logique :
```bash
# adapte l'URL (Project Settings → Database → Connection string)
pg_dump "postgresql://postgres:[PASSWORD]@db.fmhsohrgbznqmcvqktjw.supabase.co:5432/postgres" \
  -t public.beneficiaries -t public.payments -Fc -f backup_beneficiaries_$(date +%F).dump
```
> On ne sauve que `beneficiaries` + `payments` ici car ce sont les seules tables concernées
> (les migrations sont **additives** et ne touchent que `beneficiaries`).

---

## 2. DRY-RUN (voir ce qui sera appliqué, sans rien changer)

```bash
npx supabase db push --linked --dry-run
```

**À vérifier dans la sortie :**
- ✅ les 3 migrations `20260601000000/01/02` apparaissent ;
- ⚠️ **regarde s'il y a d'AUTRES migrations en attente** (non liées aux bénéficiaires) que tu ne
  voudrais pas pousser maintenant. Si oui, décide avant d'appliquer.

---

## 3. APPLIQUER (idéalement staging d'abord, puis prod)

```bash
npx supabase db push --linked
```

> Les 3 migrations sont **idempotentes** (`IF NOT EXISTS`, `DO $$ … IF NOT EXISTS`) → rejouables
> sans casse. Aucune n'utilise `CONCURRENTLY` → tout passe dans la transaction de migration.

**Ce qu'elles font (rappel) :**
1. `…000000` — ajoute `alias` (backfill `alias := name` puis `NOT NULL`), `relation_type`, `notes`,
   `created_by`, `created_by_role`. **Aucune ligne existante cassée.**
2. `…000001` — `CHECK` de complétude par mode en **`NOT VALID`** (durcit le neuf, *grandfather* le
   legacy).
3. `…000002` — **archive** les doublons existants (`is_active=false`, réversible) puis crée les
   index `UNIQUE` partiels.

---

## 4. RÉGÉNÉRER LES TYPES TypeScript

```bash
npx supabase gen types typescript --project-id fmhsohrgbznqmcvqktjw --schema public \
  > src/integrations/supabase/types.ts

git diff src/integrations/supabase/types.ts
```

- **Diff attendu : nul ou minime.** J'ai déjà étendu `types.ts` à la main (colonnes `alias`,
  `relation_type`, `notes`, `created_by`, `created_by_role`) → la régénération doit produire la même
  chose. Si le diff est **vide**, c'est le cache schéma Supabase (délai 1–2 min) : réessaie.
- Puis confirmer :
```bash
npm run type-check     # doit rester à 0 erreur
```
- Si le diff a changé `types.ts`, commit :
```bash
git add src/integrations/supabase/types.ts
git commit -m "chore(beneficiaries): regen Supabase types apres migration"
git push origin claude/amazing-hawking-HQMup
```

---

## 5. AUDIT des bénéficiaires legacy incomplets (post-migration)

La migration `…000001` (NOT VALID) laisse passer d'anciennes lignes incomplètes. Pour les lister
(et demander aux clients de compléter), exécute dans le **SQL editor** Supabase :

```sql
SELECT id, client_id, payment_method, alias
FROM public.beneficiaries
WHERE is_active AND (
     (payment_method IN ('alipay','wechat') AND identifier IS NULL AND qr_code_url IS NULL)
  OR (payment_method = 'bank_transfer' AND (bank_name IS NULL OR bank_account IS NULL))
  OR (payment_method = 'cash' AND phone IS NULL)
);
```
> Quand cette requête ne renvoie plus rien, tu pourras (optionnel, plus tard) « valider » les
> contraintes : `ALTER TABLE public.beneficiaries VALIDATE CONSTRAINT chk_benef_cash_phone;` (idem
> pour les 2 autres).

Voir aussi combien de doublons ont été archivés :
```sql
SELECT payment_method, count(*) FILTER (WHERE NOT is_active) AS archives
FROM public.beneficiaries GROUP BY payment_method;
```

---

## 6. SMOKE TEST (5 min, après déploiement)

App **cliente** :
- [ ] `/beneficiaries` s'ouvre (plus le stub « coming soon »).
- [ ] Ajouter un bénéficiaire Alipay avec un nom chinois (张伟) → apparaît, **alias en titre**.
- [ ] Créer un paiement → onglet « Existant » → le bénéficiaire est sélectionnable.
- [ ] Tenter un doublon (même identifiant Alipay) → bandeau « déjà enregistré, l'utiliser ? ».

App **admin** :
- [ ] Nouveau paiement → choisir un client → étape 4 → onglet « Enregistré » montre **ses**
      bénéficiaires (et change quand on change de client).
- [ ] Fiche client → bouton « Bénéficiaires » → page carnet du client.

> Checklist complète (C1–C12 client, A1–A6 admin) dans `06-verification.md`.

---

## 7. ROLLBACK (si besoin)

Les migrations sont additives : un rollback « dur » est rarement nécessaire. En cas de souci :
- **Doublons archivés à tort** → réactiver : `UPDATE public.beneficiaries SET is_active=true WHERE …;`
  (le backup §1 liste l'état d'origine).
- **Contraintes gênantes** → `ALTER TABLE public.beneficiaries DROP CONSTRAINT chk_benef_…;`
  et/ou `DROP INDEX public.uq_benef_account;` `DROP INDEX public.uq_benef_bank;`.
- **Colonnes** → laissables en place (nullable, sans impact) ; ne PAS `DROP COLUMN alias` si des
  écritures ont déjà eu lieu.
- Restauration complète depuis le dump `§1` en dernier recours.

---

## 8. (Optionnel) Ouvrir la PR

Le code vit sur `claude/amazing-hawking-HQMup`. Quand tu veux merger vers `main` :
créer une Pull Request depuis cette branche (je peux la rédiger si tu me le demandes).

---

## Récap ultra-court (si tu es pressé)

```bash
# 1. backup (dashboard Supabase → Backups)
npx supabase db push --linked --dry-run        # 2. vérifier
npx supabase db push --linked                  # 3. appliquer
npx supabase gen types typescript --project-id fmhsohrgbznqmcvqktjw --schema public > src/integrations/supabase/types.ts
git diff src/integrations/supabase/types.ts && npm run type-check   # 4. types
# 5. lancer la requête d'audit (SQL editor)  6. smoke test
```
