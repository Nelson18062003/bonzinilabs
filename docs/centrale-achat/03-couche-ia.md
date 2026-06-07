# Phase 3 — La couche IA (le cœur du module)

> **Statut : rendu, en attente de validation.** Design de la couche conversationnelle/IA du module,
> en **extension de Mola** (décision Q4) : un seul cerveau, des organes procurement. Hérite de la
> charte Mola, **tue ses 6 modes d'échec documentés**. Aucun code écrit.
>
> **Ancrages 🟢 (architecture Mola réelle, agent d'audit) :** edge function
> `supabase/functions/admin-assistant/index.ts` (~2706 l.), boucle ReAct mono-agent, modèles
> `MODEL_FAST/SMART = claude-sonnet-4-6` (`index.ts:27-29`), 62 outils (42 R / 20 W), découverte
> `@mola` via `mola_discover_capabilities` (migration `20260603150000`), mémoire `mola_memory`
> (sémantique/épisodique + gte-small), cartes de confirmation `assistant_pending_actions`, coût
> instrumenté (`PRICING_USD_PER_MTOK`), parité `eval/assistant/parity.test.ts`.
>
> **Légende :** 🟢 vérifié · 🟡 design proposé · 🔴 à confirmer.

---

## 1. Principe directeur — étendre Mola, pas le cloner

Le brief veut « un module construit principalement comme un produit IA ». Concrètement, ça **ne**
veut **pas** dire un second agent (forker = re-créer la fragmentation que Mola combat). Ça veut dire :
**le même moteur Mola, doté d'organes procurement** et — surtout — d'un **mode ingestion** qu'il n'a
pas aujourd'hui.

**On hérite de la charte Mola** (`docs/assistant-ops/refonte/01-CIBLE-ET-QUICKWINS.md`) :
confirmation visuelle sur l'argent · permissions héritées jamais élargies · **parité
outil↔plateforme** · *il cherche avant d'abdiquer* · il se relit sur les chiffres · tout est mesuré.

**On tue les 6 modes d'échec** (`00-DIAGNOSTIC.md`) — table de correspondance en §9. Le plus
critique pour nous : **P2-B (vision désactivée)**. Pour la centrale d'achat, **la vision n'est pas
optionnelle, c'est le produit.**

---

## 2. Architecture (où ça se branche)

```
 FRONT
  ├─ App admin /m/assistant (Mola existant) ── + onglet/persona « Centrale d'achat »
  └─ Capture rapide père : upload photo(s) + dictée native + (option) bot Telegram
        │ SSE + JWT
        ▼
 EDGE FUNCTION « admin-assistant » (Mola, étendue — PAS de nouvelle function)
  ├─ Boucle ReAct (existante)  ── budgets déjà corrigés (max_tokens ~4000, 12-16 itér.)
  ├─ [NOUVEAU] Vision activée : les pièces jointes image sont envoyées au modèle
  ├─ [NOUVEAU] Tool riche  proc_ingest_document  (image → JSON structuré → carte de confirmation)
  ├─ Capacités @mola procurement (découvertes par mola_discover_capabilities) :
  │     lecture (rapports/360/soldes/retards) + écriture (créer mission/PO/paiement/QC…)
  ├─ Savoir métier procurement (RAG) dans mola_memory (sémantique)
  ├─ Mémoire en couches (existante) + résolution de références BZ-MS/BZ-PO/BZ-SP
  └─ Self-correction ciblée (argent/chiffres) + cartes de confirmation (existantes)
        │
        ▼
 Postgres : tables proc_* (Phase 2) + pgvector (savoir) + admin_audit_logs
        │
        └─► generate-report-pdf (existant) ─► push PDF (in-app / Telegram / email)
```

**Implantation :** tout vit dans l'edge function Mola existante + le Postgres existant. **Aucun
service séparé.** (Même doctrine que la refonte Mola §5 : rester dans l'edge, pgvector, pas de
framework tiers.)

---

## 3. PILIER 1 — Ingestion-first (le cœur, ce que Mola n'a pas)

> Rappel de la position validée (#2) : le vrai risque est la **saisie**. Le père ne tape pas 30
> fournisseurs à la main. L'IA doit transformer **une photo / une note vocale / une capture WeChat**
> en enregistrements structurés. C'est *la* fonction qui fait vivre le module.

### 3.1 Le flux `proc_ingest_document` 🟡

```
1. Le père envoie 1..N pièces (photo facture, reçu T/T, capture WeChat, PDF PI)
   → stockées bucket procurement-docs ({owner}/...) ; 1 ligne proc_documents (ocr_status=pending)
2. Mola appelle le tool proc_ingest_document(document_id)
   → envoie l'IMAGE au modèle (vision RÉACTIVÉE) + un SCHÉMA JSON STRICT selon doc_type présumé
3. Le modèle renvoie un JSON structuré : type de doc, fournisseur, montant, devise, date, lignes…
   → écrit dans proc_documents.ocr_extracted (ocr_status=extracted)
4. Mola PROPOSE (carte de confirmation, jamais d'écriture directe sur l'argent) :
   « Facture du fournisseur 美的家具 (Meidi Meubles), ¥120 000, 14/05.
     Je crée : la commande BZ-PO-… + un acompte de ¥36 000 (30%). Confirmer ? »
5. Le père tape « Confirmer » → Mola appelle les RPC @mola (proc_create_purchase_order,
   proc_record_supplier_payment…) → ocr_status=confirmed + admin_audit_logs.
```

- **Schéma JSON par `doc_type`** (PI / CI / packing_list / payment_receipt / bill_of_lading…) :
  sortie contrainte → pas de texte libre, parsing fiable. *(Réf. coût/faisabilité §C.5 Phase 1 :
  ~0,5-2 ¢/page, JSON structuré en un appel.)*
- **Champs monétaires → confirmation humaine obligatoire** avant écriture (les VLM mé-lisent les
  scans pourris ; + règles existantes `isSafeInteger`, cap 50 M XAF, cartes de confirmation).
- **Best-effort assumé** : si l'image est floue, Mola extrait ce qu'il peut, **marque les champs
  incertains**, et demande au père de compléter — **jamais** d'invention silencieuse (anti P0-B/P2-B).

### 3.2 Le « dump and structure » (catch-up mai 2026) 🟡

Cas d'usage central et **premier test réel** : le père/toi balancez **toutes** les pièces de mai
2026 (photos, PDFs, captures WeChat). Mola :
1. classe chaque pièce (`doc_type` + fournisseur + montant + date) ;
2. **regroupe par fournisseur/commande** (« 3 factures du même fournisseur → 1 PO ; 2 reçus → 2
   paiements ») ;
3. propose un **lot d'écritures** rétro-datées (`occurred_at` = vraie date) ;
4. signale les **trous** (« fournisseur sans montant », « acompte sans facture ») pour complétion.

> C'est exactement la résolution de la douleur déclenchante : passer du chaos WeChat/photos à une
> mission structurée et rapportable, **sans ressaisie manuelle massive**.

### 3.3 Voix & WeChat 🟡

- **Note vocale** : pas d'audio natif Claude → on s'appuie sur la **dictée native du téléphone**
  (déjà dans le composer Mola, « dictée native » refonte §3) → texte → Mola structure. Coût **0 $**
  (clavier du téléphone). Le père dit « j'ai payé 50 000 yuan cash au fournisseur de meubles pour
  l'acompte » → Mola propose le paiement.
- **WeChat** : conformément à la Phase 1 (§C.4, sources dures), **pas de transport de chat**. On
  ingère les **artefacts** : **captures d'écran** (→ vision) et **exports de conversation** (→ texte).
  Le père forward/upload, Mola rattache à la bonne commande horodatée.

---

## 4. PILIER 2 — Capacités `@mola` procurement

### 4.1 Toute action = une RPC taguée (découverte auto) 🟢🟡

Chaque RPC procurement porte un commentaire `@mola` → `mola_discover_capabilities` la voit, **sans
outil codé à la main**, et la **parité est testée**. Exemples :

```sql
-- écriture sensible (argent) → confirm + danger
comment on function public.proc_record_supplier_payment(...) is
 '@mola:{"expose":true,"kind":"write","permission":"canManageProcurement","confirm":true,
   "danger":true,"label":"Enregistrer un paiement fournisseur","resolve":{"p_po":"purchase_order"}}';

-- lecture → pas de confirm
comment on function public.proc_mission_report(...) is
 '@mola:{"expose":true,"kind":"read","permission":"canViewProcurement",
   "label":"Rapport de mission","resolve":{"p_mission":"mission"}}';
```

### 4.2 Outils de lecture (ce qui répond aux questions du brief) 🟡

| Outil `@mola` | Répond à | 
|---|---|
| `proc_mission_report(mission)` | « **génère le rapport de la mission mai** » (par fournisseur/commande/paiement/QC) |
| `proc_supplier_360(supplier)` | « tout sur le fournisseur Y : commandé, payé, **reste à payer**, prod, QC, docs » |
| `proc_outstanding_balances(mission?)` | « **combien reste-t-il à payer** (global / par fournisseur) ? » |
| `proc_overdue_qc(days)` | « **quels QC pas faits depuis 7 jours** ? » (alerte) |
| `proc_overdue_production(days)` | « quels fournisseurs **en retard** de production ? » |
| `proc_margin_summary(mission)` | « **marge Bonzini** (commissions + remises) / exposition financière » (interne) |
| `proc_search` / `query (read-only scoped)` | toute question ad hoc, **scopée par rôle** |

### 4.3 Outils d'écriture 🟡

`proc_create_mission`, `proc_upsert_supplier`, `proc_create_purchase_order`, `proc_add_order_line`,
`proc_record_supplier_payment`, `proc_record_qc`, `proc_log_production_event`,
`proc_set_commission`, `proc_void_*` — tous `confirm:true`, money → `danger:true`. **Void** réservé
à `super_admin` (comme trésorerie).

### 4.4 Résolution de références 🟡

`BZ-MS-…`, `BZ-PO-…`, `BZ-SP-…`, et **fournisseur par nom** (« le fournisseur de meubles ») → UUID
(façon `resolveRef`, Mola `index.ts`). **Le père ne tape jamais d'UUID.**

### 4.5 Parité 🟢

Étendre `eval/assistant/parity.manifest.ts` : chaque outil d'écriture procurement ↔ sa RPC, params
exposés/justifiés. Le test casse si un param diverge → **plus de confabulation** type P0-B.

---

## 5. PILIER 3 — Savoir métier procurement (RAG) 🟡

Tue P0-C (« je ne sais pas » / fausses règles). On indexe en **couche sémantique `mola_memory`** (pgvector,
gte-small — déjà en place) le **glossaire Phase 1**, récupéré *just-in-time* (3-5 chunks pertinents) :

- cycle **PI/PO/CI**, qui émet quoi, avant/après expédition ;
- **deposit/balance 30/70**, T/T, gate solde sur QC ;
- **Incoterms 2020** (FOB/CIF/DDP : qui paie/risque), « ship's rail » obsolète ;
- **AQL / ISO 2859-1**, niveaux, types PPI/DUPRO/PSI ;
- **compliance CEMAC** (BESC/ECTN, SGS ≥2 M XAF, TEC 5/10/20/30 % + TVA ~19,25 %, GUCE) ;
- **carte des capacités** du module (quel écran/RPC fait quoi) → Mola lit la carte avant d'affirmer
  une impossibilité.

**Fraîcheur** : ces docs vivent dans `docs/centrale-achat/` + sont (ré)indexés à chaque évolution.
*(Source de vérité unique, jamais réinjectée en bloc figé — pattern refonte §4.4.)*

---

## 6. PILIER 4 — Mémoire 🟢🟡

On **réutilise** la mémoire en couches de Mola (working / épisodique / sémantique / profil). Apports
procurement : le **profil** retient les habitudes (fournisseurs fréquents, devise par défaut,
formulations du père) ; l'**épisodique** garde le fil multi-tours d'une session d'ingestion longue.
On hérite des **corrections P0-A/P1-B** déjà appliquées (N derniers messages dans l'ordre, contexte
outil conservé).

---

## 7. PILIER 5 — Self-correction ciblée 🟡

Avant **toute proposition financière** et sur **les chiffres de rapport**, Mola se relit : recoupe le
montant extrait avec le total PO, vérifie le « reste à payer », contrôle la plausibilité (un acompte
> total = alerte). **Pas** de réflexion à chaque tour (coût) — **ciblée argent/chiffres**. La carte
de confirmation reste le filet ultime. *(Pattern refonte §4.5.)*

---

## 8. Reporting génératif & canal du père

### 8.1 Génération de rapport 🟡

« Génère le rapport de la mission mai » → `proc_mission_report` (données) → **`generate-report-pdf`**
(existant, `supabase/functions/generate-report-pdf/`) → PDF par mission / fournisseur / commande.
Granularité ligne-de-commande (validé Q7 Phase 0) pour répondre à *toute* question / litige.

### 8.2 Canal du père 🟡 (décision validée Phase 0 Q5)

- **In-app mobile (primaire)** : écran assistant Mola + **upload photo + dictée** + persona
  « Centrale d'achat » (Mola scopé procurement).
- **Telegram (capture rapide + livraison de rapports)** : on **réutilise le pattern**
  `telegram-bot` existant (push PDF/photo, `index.ts:500-538`, chat admin autorisé) pour : (a) le
  père envoie une photo de facture → ingestion ; (b) il reçoit le **rapport PDF** dans le chat.
  🔴 *Effort à chiffrer Phase 5 : router le bot vers Mola + lever la restriction « 1 seul chat ».*
- **WhatsApp Business API** : option future pour les fournisseurs qui l'utilisent (Phase 1 §C.4),
  hors MVP.

---

## 9. Anti-Mola-bugs (table de correspondance) 🟢

| Mode d'échec Mola | Notre traitement dans la centrale d'achat |
|---|---|
| **P0-A** mémoire à l'envers | hérité corrigé (N derniers, ordre) |
| **P0-B** confabule des limites | **parité testée** sur les outils procurement + carte des capacités |
| **P0-C** pas de socle métier | **RAG procurement** (glossaire Phase 1) |
| **P1-A** réponses tronquées | budgets hérités (max_tokens ~4000) |
| **P1-C** plafond d'itérations | hérité relevé (12-16) — utile pour le « dump » multi-pièces |
| **P2-B** **vision désactivée** | **RÉACTIVÉE** — c'est le cœur (ingestion). Coût maîtrisé (§10) |
| Sécurité SQL par rôle | outils procurement **scopés par permission** ; pas de SQL libre cross-périmètre |

---

## 10. Coût détaillé (chiffré) 🟡

| Poste | Hypothèse | Coût |
|---|---|---|
| **Ingestion catch-up mai 2026** (one-shot) | ~150-300 pièces × ~1 ¢ | **~1,5-6 $ une fois** |
| **Ingestion courante** | ~1 000 docs/mois × 0,5-2 ¢ | **~5-20 $/mois** |
| Inférence Mola (Q&A + actions procurement) | Sonnet 4.6, cache outils | marginal (~1-4 ¢/conv) |
| RAG (embeddings glossaire) | gte-small, one-shot + maj | **~1-5 $/mois** |
| Stockage docs | bucket Supabase, **pré-resize ~1600px** | quelques $/mois 🔴 (politique compression) |
| Infra | reste dans l'edge | **0 $** |
| **Total IA additionnel** | | **~10-40 $/mois** (à instrumenter, comme `mola_usage`) |

> **Garde-fou coût vision** : pré-redimensionner les images (~1600px long edge) avant envoi, n'envoyer
> en haute résolution que les factures chinoises denses, et **mesurer** (le projet a déjà l'instrumentation
> coût Mola). Le poste qui peut déraper = des scans HD non compressés en masse → politique de
> compression dans le tool d'upload.

---

## 11. Questions à trancher avant la Phase 4

1. 🔴 **Persona « Centrale d'achat »** : un **onglet/écran dédié** pour le père (Mola scopé
   procurement, gros boutons photo/dictée) en plus de l'assistant général ? *Reco : oui, un écran
   d'entrée procurement « caméra-first ».*
2. 🔴 **Telegram au MVP** : on branche le canal Telegram (capture + rapports) dès le MVP, ou in-app
   seulement d'abord ? *Reco : in-app au MVP, Telegram en incrément rapide juste après (le pattern
   existe déjà).*
3. 🔴 **Confiance ingestion** : un seuil au-delà duquel Mola crée **sans** confirmation pour le
   **non-argent** (ex. créer une fiche fournisseur depuis une carte de visite) ? *Reco : non — tout
   passe par confirmation au début, on assouplit après mesure.*
4. 🔴 **Autonomie « lot »** : pour le dump mai 2026, Mola propose-t-il **un gros lot** à valider en
   bloc, ou **pièce par pièce** ? *Reco : par fournisseur (lot moyen), pas tout-en-un ni
   un-par-un.*
5. 🔴 **Langue de Mola avec le père** : FR strict, ou FR + capacité à lire le 中文 des docs (oui,
   c'est de la vision) et à **traduire** les noms/specs ? *Reco : FR pour le dialogue, lecture +
   traduction du 中文 dans l'extraction.*

---

## Auto-contrôle Phase 3

- ✅ **Étend Mola** (un cerveau), n'en forke pas un second ; implantation dans l'edge + Postgres
  existants.
- ✅ **Ingestion-first** posée comme pilier #1 (le manque de Mola) ; **vision réactivée** ;
  « dump and structure » pour le catch-up mai 2026.
- ✅ **Hérite de Mola sans ses bugs** : table P0-A→P2-B → traitement explicite.
- ✅ **AI-native** : capacités `@mola` (découverte auto + parité), références humaines, RAG métier.
- ✅ **Cash sans reçu / docs hétérogènes** : best-effort + champs incertains marqués + confirmation,
  jamais d'invention.
- ✅ **Argent** : confirmation humaine obligatoire, self-correction ciblée, cap 50 M / isSafeInteger
  hérités.
- ✅ **Persona père & canal** : in-app caméra-first + Telegram (pattern existant) + reporting PDF.
- ✅ **Coût chiffré** (~10-40 $/mois ; catch-up one-shot ~1,5-6 $) + garde-fou compression.
- ✅ **Pas de code** : conception seule.
- ⏳ **En attente** : réponses aux 5 questions §11 → puis **Phase 4 (parcours & UX terrain)**.
