# Phase 2 — Modélisation des données (design de delta, DB préservée)

> **Décisions cadrées (validées par le porteur produit)**
> - App **refaite à neuf** (composants/hooks/UX propres et complets).
> - **DB préservée** : on **conserve** la table `beneficiaries` et **surtout** les colonnes snapshot
>   de `payments`. On **étend** par migrations **additives uniquement**.
> - **Prod active** → aucune migration ne doit rejeter/casser les lignes existantes.
> - Périmètre : feature **complète** (carnet + admin + alias + complétude + anti-doublon).
>
> Légende : **[V]** vérifié · **[S]** sonde · **[?]** à confirmer · **[NEW]** ajout additif proposé.

---

## 1. Principe directeur

Deux couches, deux traitements :

| Couche | Traitement | Raison |
|---|---|---|
| **Données (DB)** | **Conservée + étendue** (additif) | Le modèle polymorphe + le snapshot sont déjà corrects (Phase 1). Les détruire en prod = risque historique. |
| **Application** | **Reconstruite à neuf** | Câblage actuel incohérent (hooks morts, page stub, validation molle). |

> ⚠️ Conséquence structurante : la nouvelle couche app parle **le contrat DB existant (étendu)**.
> Les nouveaux écrans/hook doivent continuer à écrire les colonnes snapshot que `payments` et les
> RPC attendent — sinon on casse le flux de paiement existant.
>
> **Anti-over-engineering assumé** : « à neuf » = implémentation propre, cohérente et complète —
> **pas** réécriture dogmatique des bouts déjà corrects (ex. la logique de signed-URL des QR). Je
> signalerai chaque réutilisation au lieu de la cacher. *(À valider si tu veux vraiment 100 % de
> lignes neuves.)*

---

## 2. Schéma cible `beneficiaries` (existant + ajouts additifs)

**Existant conservé** (`migrations/20260304100000`) : `id, client_id, payment_method, name,
identifier, identifier_type, phone, email, bank_name, bank_account, bank_extra, qr_code_url,
is_active, created_at, updated_at`.

**Ajouts `[NEW]` (additifs, nullable d'abord) :**

| Colonne | Type | Rôle | Prod-safe |
|---|---|---|---|
| `alias` | TEXT | **Le repère lisible** (latin) affiché partout. Distinct du nom réel (souvent chinois). | Ajout NULLABLE → backfill `alias := name` → puis `NOT NULL`. |
| `relation_type` | TEXT CHECK in (`self`,`supplier`,`other`) | Typage relation (UX « me payer » + reporting AML). | NULLABLE (legacy = NULL/`other`). |
| `notes` | TEXT | Remarque libre par bénéficiaire (point de RDV, contact WeChat). | NULLABLE. |

> Pourquoi `alias` **distinct** de `name` et **requis** : c'est le besoin explicite (« nom/pseudo
> facile à repérer car les infos sont en chinois »). `name` reste le **titulaire réel** (utile à
> Alipay/banque, peut être en CJK) ; `alias` est le libellé humain garanti lisible. Affichage =
> `alias` en titre, `name`/identifiant en sous-titre.

---

## 3. Spec canonique des champs par mode (source unique de vérité)

Cette table pilote **les 3 couches** (formulaire, validation Zod, contrainte DB). Définie **une
fois** dans `src/lib/` et importée par l'app client **et** l'app admin.

| Mode | Requis | Optionnels | Clé naturelle (dédoublonnage) |
|---|---|---|---|
| **Tous** | `alias` | `relation_type`, `notes` | — |
| **alipay** / **wechat** | `name` + (**`identifier`** *ou* **`qr_code_url`**) | `identifier_type`, `phone`, `email` | `(client_id, payment_method, identifier)` |
| **bank_transfer** | `name`, `bank_name`, `bank_account` | `bank_extra` (SWIFT/CNAPS/agence — texte libre) | `(client_id, bank_account, bank_name)` |
| **cash** | `name`, `phone` | `email`, `notes` | *(aucune — pas d'unicité dure)* |

Notes :
- **`name` requis pour tous** (déjà `NOT NULL` en base). Pour cash « moi-même », le bénéficiaire
  n'est **pas** enregistré (c'est le client lui-même) — voir §4.
- **QC2** : `bank_extra` reste **texte libre** (décision : ne pas structurer CNAPS/SWIFT au MVP ;
  l'app actuelle paie via ce champ). Si tu veux structurer plus tard, ce sera additif.
- **Pas de `pickup_city` cash** au MVP (absent du flux actuel ; ajout additif possible plus tard).

---

## 4. Contrat de snapshot — le piège fintech (formalisé)

**État actuel [V/S]** : déjà correct. On le **formalise et on l'étend** sans rien casser.

1. **À la création d'un paiement**, on **fige** dans `payments` :
   - les **colonnes dénormalisées** (`beneficiary_name/phone/email/qr_code_url/bank_name/
     bank_account/bank_extra/identifier/identifier_type/notes` + `cash_beneficiary_*`) — écrites par
     le RPC `create_payment` / `create_admin_payment` ;
   - **`beneficiary_details` JSONB** = snapshot complet, **incluant désormais `[NEW]` `alias` et
     `relation_type`** (pur app-layer : JSONB, **aucune migration** requise) ;
   - **`beneficiary_id`** (FK `ON DELETE SET NULL`) = **lien de traçabilité uniquement**, jamais une
     source d'affichage.
2. **Affichage d'un paiement = TOUJOURS le snapshot**, jamais la ligne `beneficiaries` vivante.
3. **Éditer / archiver / supprimer un bénéficiaire ⇒ zéro effet** sur les paiements passés (copie
   gelée + FK `SET NULL`). **Donc : aucune restriction d'édition selon l'état du paiement** (réponse
   QC5). C'est l'intérêt du découplage déjà en place.
4. **Suppression = archivage** (`is_active = false`), pas `DELETE` physique (préserve le lien pour
   le reporting). Voir §8.

> Règle de code à graver : **interdiction de joindre `beneficiaries` pour afficher un paiement.**
> Tout l'historique se lit depuis les colonnes snapshot / `beneficiary_details`.

---

## 5. Validation par mode — 3 couches, 1 spec

| Couche | Rôle | Mise en œuvre |
|---|---|---|
| **DB (garde ultime)** | « jamais incomplet » **physiquement** impossible | `CHECK` par mode **`NOT VALID`** (cf. §9) + `alias NOT NULL` |
| **Zod partagé (UX)** | erreurs inline, bouton désactivé, **remplace la validation molle** | schéma dérivé de la spec §3, app client + admin |
| **RLS (déjà là)** | scoping client/admin | inchangé (§8) |

> **Pas de RPC dédié aux bénéficiaires** (anti-over-engineering) : l'insert/update passe par
> `supabase.from('beneficiaries')` sous RLS, et la **complétude est garantie par les `CHECK` DB**
> (vérité serveur) — un RPC `SECURITY DEFINER` n'apporterait rien de plus ici. *(Contraste avec les
> paiements, qui eux DOIVENT rester en RPC pour le débit wallet + `SELECT FOR UPDATE`.)*

---

## 6. Dédoublonnage (anti-doublon, prod-safe)

- **Index UNIQUE partiels** sur la clé naturelle par mode (§3), `WHERE is_active = TRUE AND <clé> IS
  NOT NULL`. Cash : pas d'unicité dure (alerte douce nom+téléphone côté UX).
- **Scope = par client** (jamais global : fournisseurs communs légitimes + vie privée).
- **UX douce** : collision ⇒ pas d'erreur sèche, mais « Vous avez déjà *<alias>* avec ce compte.
  L'utiliser ? ».
- **Prod-safe** (cf. §9) : nettoyer les doublons existants **avant** de créer l'index, sinon la
  création échoue.

---

## 7. Caractères chinois (saisie / validation / affichage)

- **Stockage [V]** : Postgres UTF-8, colonnes `TEXT` → CJK natif. Rien à migrer.
- **`alias`** : libellé humain **requis**, texte libre (placeholder « Ex : Fournisseur chaussures
  Yiwu »). C'est lui qui garantit la lisibilité.
- **`name` / `bank_name`** : **autoriser le CJK** (aucune regex `^[A-Za-z]+$` — c'était le bug
  classique à ne PAS réintroduire). Valider **structure** (compte, téléphone), pas le **script**.
- **Longueurs en *nombre de caractères*** (pas octets) — un CJK ≈ 3 octets.
- **Affichage** : police CJK-safe (`system-ui`), troncature CSS (`text-overflow: ellipsis`).
- **Bouton « copier »** sur `identifier` / `bank_account` / `name` côté **admin** : coller à
  l'identique dans le portail Alipay/banque → réduit l'erreur de transcription (l'enjeu central).

---

## 8. RLS & cycle de vie

- **RLS existant conservé** [V] : client CRUD sur les siens ; admin SELECT/INSERT/UPDATE via
  `is_admin()`. Scoping correct, pas de fuite cross-client.
- **Archivage** : client **et** admin archivent via `UPDATE is_active=false` (déjà permis). L'app
  **n'utilise pas le DELETE physique** (on évite d'orphéliner ; le FK `SET NULL` protège de toute
  façon l'historique).
- La policy client `DELETE` existante est **laissée** (droit du client) mais non exposée en UI au
  profit de l'archivage. *(À confirmer [?] : veux-tu retirer carrément le droit DELETE pour forcer
  l'archivage ? Recommandation : le garder, UI = archive.)*
- **Admin** n'a pas de policy DELETE → cohérent (il archive via UPDATE).

---

## 9. Stratégie de migration PROD-SAFE (esquisse — non appliquée, Phase 5)

> Esquisses SQL de **conception** pour validation. Ordre et précautions importent autant que le DDL.

**Migration A — colonnes (sûr, en transaction) :**
```sql
ALTER TABLE public.beneficiaries
  ADD COLUMN IF NOT EXISTS alias TEXT,
  ADD COLUMN IF NOT EXISTS relation_type TEXT
    CHECK (relation_type IN ('self','supplier','other')),
  ADD COLUMN IF NOT EXISTS notes TEXT;

UPDATE public.beneficiaries SET alias = name WHERE alias IS NULL;  -- backfill
ALTER TABLE public.beneficiaries ALTER COLUMN alias SET NOT NULL;  -- OK car backfillé
```

**Migration B — complétude par mode (NON destructif → `NOT VALID`) :**
```sql
ALTER TABLE public.beneficiaries
  ADD CONSTRAINT chk_benef_alipay_wechat CHECK (
    payment_method NOT IN ('alipay','wechat')
    OR identifier IS NOT NULL OR qr_code_url IS NOT NULL
  ) NOT VALID,                       -- s'applique aux NOUVELLES lignes ; legacy grandfathered
  ADD CONSTRAINT chk_benef_bank CHECK (
    payment_method <> 'bank_transfer'
    OR (bank_name IS NOT NULL AND bank_account IS NOT NULL)
  ) NOT VALID,
  ADD CONSTRAINT chk_benef_cash CHECK (
    payment_method <> 'cash' OR phone IS NOT NULL
  ) NOT VALID;
```
> `NOT VALID` = la contrainte garde les **nouvelles** écritures, sans rejeter les lignes prod
> existantes (qui pourraient être incomplètes). Un **audit data** listera les legacy incomplets pour
> que le client les complète ; on pourra `VALIDATE CONSTRAINT` plus tard.

**Migration C — anti-doublon (hors transaction, `CONCURRENTLY`) :**
```sql
-- 1) Neutraliser les doublons EXISTANTS (garder le plus récent) AVANT l'index :
WITH ranked AS (
  SELECT id, row_number() OVER (
    PARTITION BY client_id, payment_method, identifier
    ORDER BY updated_at DESC
  ) rn
  FROM public.beneficiaries
  WHERE is_active AND identifier IS NOT NULL
)
UPDATE public.beneficiaries b SET is_active = false
FROM ranked r WHERE b.id = r.id AND r.rn > 1;

-- 2) Index UNIQUE partiel (CONCURRENTLY ⇒ migration À PART, hors transaction) :
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS uq_benef_account
  ON public.beneficiaries (client_id, payment_method, identifier)
  WHERE is_active AND identifier IS NOT NULL;
-- idem pour bank: (client_id, bank_account, bank_name) WHERE is_active AND bank_account IS NOT NULL
```
> ⚠️ `CONCURRENTLY` **ne peut pas** tourner dans une transaction → migration Supabase dédiée
> (ou DDL appliqué hors `BEGIN`). À border en Phase 4.

**Aucune migration ne touche `payments`.** `beneficiary_details` (JSONB) absorbe `alias`/
`relation_type` sans DDL.

---

## 10. Périmètre de la reconstruction app (à neuf)

| Brique | État actuel | Cible |
|---|---|---|
| `useBeneficiaries` (module data) | 5 hooks, 2 câblés, noms ambigus | Module **consolidé** : `list / create / update / archive`, client (`supabase`) **et** admin (`supabaseAdmin`), tous **câblés** |
| `BeneficiariesPage` (carnet) | **stub** | Écran complet : liste par mode, recherche, ajout/édition/archivage, **alias en avant**, CJK-safe |
| Étape bénéficiaire — **client** | molle, save best-effort silencieux | Pick/new/self, **dedup-aware**, save **non silencieux**, validation Zod dure |
| Étape bénéficiaire — **admin** (`MobileNewPayment`) | carnet **non branché** | **Sélecteur** des bénéficiaires du client + **création** au carnet (branche les 2 hooks morts) |
| Spec champs par mode | éparse | **1 source** `src/lib/` partagée (forms + Zod + miroir des CHECK) |

---

## 11. Points à confirmer avant Phase 3

1. **[?]** OK pour `alias` **requis et distinct** de `name` (deux champs) ? *(reco : oui — c'est le
   besoin explicite.)*
2. **[?]** `relation_type` et `notes` au carnet : on les inclut au MVP ? *(reco : oui, coût quasi
   nul, utiles UX/reporting.)*
3. **[?]** Doublons legacy : on **archive** automatiquement les doublons existants (garder le plus
   récent) — OK ? Sinon je te fournis juste l'audit et tu tranches au cas par cas.
4. **[?]** Droit `DELETE` client : le garder (UI = archive) ou le retirer pour forcer l'archivage ?
   *(reco : le garder.)*
5. **[?]** « À neuf » : OK pour **réutiliser les bouts déjà corrects** (signed-URLs QR, contrat
   snapshot) plutôt que tout réécrire ? *(reco : oui, anti-over-engineering.)*

---

## Auto-contrôle Phase 2
- ✅ DB **préservée**, migrations **additives** et **prod-safe** (`NOT VALID`, backfill,
  `CONCURRENTLY`, dédup avant index, **aucun `DROP`**, `payments` intact).
- ✅ Snapshot (Q4) **formalisé** : copie gelée, FK = traçabilité, interdiction de joindre la ligne
  vivante, édition carnet toujours permise.
- ✅ « Jamais incomplet » (G5) garanti **en base** (CHECK) ; doublons (G6) bloqués (UNIQUE partiel).
- ✅ Chinois (Q7) : alias requis lisible + CJK autorisé + limites en caractères + copie presse-papier.
- ✅ Scoping (Q5/Q8) inchangé, pas de fuite cross-client.
- ✅ Anti-over-engineering : pas de RPC bénéficiaire superflu, réutilisation assumée.
- ⏳ En attente : tes réponses aux 5 points du §11 → puis **Phase 3 (parcours, tous les cas)**.
