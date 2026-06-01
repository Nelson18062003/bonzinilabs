# Phase 6 — Vérification (jeu de données + scénarios bout-en-bout)

> Objectif : prouver que la feature fonctionne par mode et par persona, et fournir un jeu de données
> de test reproductible. Statut : tests automatisés **verts** ; scénarios manuels = **checklist**
> à exécuter une fois la migration appliquée en staging (prod active → geste porteur produit).

---

## 1. État des vérifications automatisées

| Vérification | Commande | Résultat |
|---|---|---|
| Types | `npm run type-check` | ✅ 0 erreur |
| Tests unitaires | `npm run test` (`vitest run`) | ✅ **85/85** (9 fichiers) |
| Build prod | `npm run build` | ✅ OK |
| Migrations DB | rejeu sur Postgres 16 jetable (Lot 1) | ✅ 7/7 assertions |

**Tests bénéficiaires (18) :**
- `beneficiarySpec.test.ts` (14) — complétude par mode, CJK accepté, longueurs en caractères,
  clé naturelle/dédup, email.
- `beneficiarySnapshot.test.ts` (4) — **immuabilité du snapshot** (copie de valeur, édition source
  sans effet, lien conservé, CJK préservé).

---

## 2. Jeu de données de test (seed)

À créer côté client (app cliente) ou via l'admin. **Inclut volontairement du CJK** pour valider
saisie/affichage/stockage.

| # | Mode | alias (latin) | name (réel) | Champs clés | relation |
|--:|------|---------------|-------------|-------------|----------|
| 1 | alipay | « Fournisseur chaussures Yiwu » | 张伟 | identifier `zhang@alipay.cn` (email) | supplier |
| 2 | wechat | « Sacs Guangzhou » | 王芳 | identifier `wxid_abc123` (id) | supplier |
| 3 | bank_transfer | « Usine textile Foshan » | 李明 | bank `中国工商银行`, account `6222021234567890123` | supplier |
| 4 | cash | « Contact remise Canton » | Chen Lei | phone `+8613800000000` | other |
| 5 | alipay | « Mon compte perso » | (nom KYC du client) | identifier = tel client | **self** |
| 6 | alipay (doublon de #1) | « Doublon test » | 张伟 | identifier `zhang@alipay.cn` | → doit être **refusé/relié** |

> Le #6 sert à vérifier l'anti-doublon (index UNIQUE + UX douce). Le #5 vérifie « me payer
> moi-même » multi-mode.

---

## 3. Scénarios bout-en-bout — CLIENT

| # | Scénario | Étapes | Attendu |
|--:|----------|--------|---------|
| C1 | Carnet : ajouter (alipay CJK) | `/beneficiaries` → + → alias+nom 张伟+identifier → Enregistrer | apparaît en liste, **alias en titre**, 张伟 lisible |
| C2 | Carnet : éditer | ouvrir #1 → changer alias → Enregistrer | mis à jour ; bandeau « paiements passés non modifiés » visible |
| C3 | Carnet : archiver | #4 → Supprimer → confirmer | disparaît des listes actives ; paiements liés intacts |
| C4 | Carnet : recherche/filtre | taper « yiwu » / filtre Alipay | filtrage correct (alias + identifiant) |
| C5 | Payer → existant | wizard → mode alipay → onglet Existant → #1 → confirmer | snapshot figé = #1 ; `beneficiary_id` lié |
| C6 | Payer → nouveau (enregistré) | wizard → bank → Nouveau → remplir → confirmer | paiement créé **+** bénéficiaire ajouté au carnet |
| C7 | Payer → nouveau (ne pas enregistrer) | idem + cocher « ne pas enregistrer » | paiement créé, carnet **inchangé** |
| C8 | Payer → moi-même (alipay) | Nouveau → « Moi-même » → compte → confirmer | `relation_type='self'`, enregistrable |
| C9 | Payer → moi-même (cash) | mode cash → « Moi-même » | auto-rempli profil, **non** enregistré au carnet |
| C10 | Payer → doublon | Nouveau avec identifier de #1 | bandeau « déjà <alias>, l'utiliser ? » → relie l'existant |
| C11 | Compléter plus tard + carnet | skip → payer → fiche → compléter + cocher « enregistrer au carnet » | snapshot du paiement MAJ **+** entrée carnet créée |
| C12 | Validation dure | Nouveau alipay sans identifier ni QR | bouton **désactivé** (Zod) — plus de validation molle |

---

## 4. Scénarios bout-en-bout — ADMIN

| # | Scénario | Étapes | Attendu |
|--:|----------|--------|---------|
| A1 | Payer p/ client → voir SES bénéf. | `/m/payments/new` → client → mode → étape 4 onglet Enregistré | liste = bénéficiaires **de ce client uniquement** |
| A2 | Scoping anti-fuite | changer de client | la liste se recharge ; **aucun** bénéficiaire d'un autre client |
| A3 | Payer p/ client → choisir | sélectionner un bénéficiaire → confirmer | snapshot + `beneficiary_id` ; résumé/succès affichent l'alias |
| A4 | Payer p/ client → créer | onglet Nouveau → remplir → « enregistrer au carnet » → confirmer | paiement créé **+** bénéficiaire visible **côté client** |
| A5 | Carnet hors paiement | fiche client → « Bénéficiaires » | page `/m/clients/:id/beneficiaries` : liste/ajout/édition/archivage |
| A6 | Recherche/filtre admin | rechercher dans le carnet du client | filtrage correct |

---

## 5. Vérifications transverses (règles dures)

| Règle | Comment vérifier | Statut |
|---|---|---|
| **Snapshot immuable** | éditer un bénéficiaire après un paiement → rouvrir le paiement : inchangé | ✅ test auto + checklist C2 |
| **Jamais incomplet** | tenter de sauver un bénéficiaire incomplet (UI + insert SQL direct) | ✅ Zod (UI) + CHECK (DB, Lot 1) |
| **Anti-doublon** | recréer un bénéficiaire identique | ✅ index UNIQUE (DB) + UX (C10) |
| **Scoping cross-client** | admin change de client (A2) ; client ne voit que les siens (RLS) | ✅ RLS + filtre `client_id` |
| **CJK** | saisir/coller 张伟 / 中国工商银行, afficher en liste, tronquer | ✅ stockage UTF-8 + tests + C1 |
| **Anti-régression paiement** | payload `createPayment` inchangé | ✅ flux préservé (Lot 3 bis/4) |

---

## 6. Reste à faire (hors code, porteur produit)

1. **Appliquer la migration** (staging → prod) : sauvegarde → `npx supabase db push --linked` →
   `gen types`. Tant que non appliquée, la prod tourne sur l'ancien schéma (le code compile sur les
   types étendus à la main, diff de régénération attendu nul).
2. **Exécuter la checklist manuelle** (§3–§4) en staging avec le seed (§2).
3. **Audit legacy** : lancer la requête d'audit de la migration 1B → compléter les bénéficiaires
   incomplets pré-existants.
4. (Option) relecture native des libellés **zh**.

---

## Auto-contrôle Phase 6
- ✅ Tests auto verts (85), build OK, migrations testées (PG16).
- ✅ Scénarios exhaustifs par mode × persona × {existant, nouveau, self, plus tard, doublon}.
- ✅ Règles dures (snapshot, complétude, doublon, scoping, CJK) chacune rattachée à une preuve.
- ✅ Jeu de données reproductible avec CJK + cas self + cas doublon.
- ⏳ Checklist manuelle conditionnée à l'application de la migration (geste porteur produit).
