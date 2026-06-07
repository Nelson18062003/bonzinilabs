# Phase 3 — La couche IA (le cœur du module)

> **Statut : révisé après retour porteur produit.** Design de la couche conversationnelle/IA, en
> **extension de Mola** (Q4). **Décision majeure (révision) : PAS d'OCR / PAS d'analyse de documents.**
> Mola n'analyse **rien**. La saisie est **manuelle** : soit par **formulaires**, soit en **dictant
> les valeurs à Mola**. Les **photos sont des preuves** jointes, jamais analysées. Aucun code écrit.
>
> **Ancrages 🟢 (architecture Mola réelle) :** edge function `supabase/functions/admin-assistant/index.ts`
> (~2706 l.), boucle ReAct, `MODEL_FAST/SMART = claude-sonnet-4-6` (`index.ts:27-29`), 62 outils,
> découverte `@mola` (`mola_discover_capabilities`, migration `20260603150000`), mémoire `mola_memory`,
> cartes de confirmation `assistant_pending_actions`, coût instrumenté, parité `eval/assistant/parity.test.ts`.
>
> **Légende :** 🟢 vérifié · 🟡 design proposé · 🔴 à confirmer.

---

## 0. La décision qui change le pilier #1 (et pourquoi c'est sain)

En Phase 2/3 je pariais sur l'**ingestion OCR** (« le père ne tapera jamais tout à la main »). **Le
porteur produit tranche autrement : saisie manuelle, photos = preuves, aucune analyse IA des
documents.** Je m'aligne, et je pense que c'est **le bon choix ici**, pour trois raisons :

1. **L'argent se vérifie en le tapant.** L'OCR se trompe précisément sur les champs monétaires
   (scans flous, 中文) — le seul risque que je flaggais moi-même. Taper le montant qu'on connaît
   = zéro risque d'extraction + engagement humain sur chaque chiffre.
2. **Volume réel tractable.** 1 client / 30 fournisseurs aujourd'hui : la saisie manuelle (surtout
   **conversationnelle**, plus rapide qu'un formulaire) passe largement. L'OCR ne se justifierait
   qu'à très gros volume.
3. **Anti-over-engineering + ajout possible plus tard sans refonte.** Le modèle de données (Phase 2)
   est **identique** que les données viennent d'un formulaire, de Mola, ou (un jour) d'un OCR. On
   commence simple ; si le volume explose, on pourra ajouter un OCR *en assistance optionnelle*
   (brouillon pré-rempli à vérifier) **sans rien casser**.

**Contre-argument que je garde au dossier** (honnêteté) : à l'échelle future (50 clients / 1000+
fournisseurs), un OCR-assist (extraire un brouillon, l'humain corrige/valide) battrait la saisie
pure sur la vitesse **tout en gardant** la vérification. → **À rouvrir** si/quand le volume fait mal.
Pas maintenant.

→ **Conséquences :** vision **non** réactivée, `proc_ingest_document` **supprimé**, « dump and
structure » **supprimé**. Coût IA **fortement réduit** (§10).

---

## 1. Principe directeur — étendre Mola

Le même moteur Mola, doté d'**organes procurement** : (a) **saisie conversationnelle** (tu dictes les
valeurs, Mola les enregistre via les RPC `@mola`, avec carte de confirmation), (b) **questions &
rapports**, (c) **savoir métier** (RAG). On hérite de la **charte Mola** (confirmation sur l'argent,
permissions héritées, parité, « il cherche avant d'abdiquer », il se relit, tout est mesuré) et on
**tue les modes d'échec** P0-A/B/C/P1 (table §9). **P2-B (vision) ne nous concerne plus** : on
n'analyse pas de documents, par choix produit.

---

## 2. Architecture (où ça se branche)

```
 FRONT (in-app only — pas de Telegram, pas d'écran assistant dédié : l'assistant Mola général suffit)
  ├─ Assistant Mola existant /m/assistant : saisie conversationnelle + questions + rapports
  └─ Écrans procurement (Phase 4) : formulaires de saisie manuelle + consultation 360 + photos (preuves)
        │ SSE + JWT
        ▼
 EDGE FUNCTION « admin-assistant » (Mola, étendue — PAS de nouvelle function, PAS de vision)
  ├─ Boucle ReAct (existante) ── budgets hérités (max_tokens ~4000, 12-16 itér.)
  ├─ Saisie conversationnelle : NL « enregistre pour fournisseur X : montant…, acompte… »
  │     → mapping vers params RPC → carte de confirmation → écriture @mola (jamais d'analyse de doc)
  ├─ Capacités @mola procurement : lecture (rapports/360/soldes/retards) + écriture (mission/PO/paiement/QC…)
  ├─ Savoir métier procurement (RAG) dans mola_memory (sémantique)
  ├─ Mémoire en couches (existante) + résolution de références BZ-MS/BZ-PO/BZ-SP
  └─ Self-correction ciblée (argent/chiffres) + cartes de confirmation
        │
        ▼
 Postgres : tables proc_* (Phase 2) + pgvector (savoir) + admin_audit_logs
        │   (photos stockées dans bucket procurement-docs comme PREUVES, doc_type=proof, NON analysées)
        └─► generate-report-pdf (existant) ─► PDF in-app (partage WhatsApp/email natif)
```

---

## 3. PILIER 1 — Saisie manuelle OU conversationnelle (photos = preuves)

> Le geste central n'est **pas** « photographier et laisser l'IA lire ». C'est **saisir les vraies
> valeurs**, vite, et **attacher la photo comme preuve**.

### 3.1 Deux canaux de saisie, mêmes enregistrements 🟡

| Canal | Comment | Pour qui |
|---|---|---|
| **Formulaires** (écrans Phase 4) | champs structurés : fournisseur, montant facture, acompte, commission, devise, date… | quand on préfère cliquer / vérifier visuellement |
| **Conversationnel (Mola)** | « Mola, pour le fournisseur Meidi : commande ¥120 000, acompte ¥36 000 cash, commission 5% » | quand c'est plus rapide de dire que de remplir |

Les deux produisent **exactement les mêmes lignes** dans les tables `proc_*` (Phase 2). Le choix est
une préférence d'ergonomie, pas deux modèles.

### 3.2 Le flux conversationnel (NL → confirmation → écriture) 🟡

```
 Père : « Mola, pour le fournisseur de meubles Meidi : facture ¥120 000,
          acompte ¥36 000 payé cash le 14/05, commission 5%. »
   ▼  Mola mappe les VALEURS DONNÉES vers les params RPC (aucune analyse de doc)
 ┌────────────────────────────────────────────┐
 │ Je vais enregistrer :                        │
 │  • Fournisseur : Meidi (美的家具) 🆕 à créer  │
 │  • Commande BZ-PO-… : ¥120 000               │
 │  • Acompte : ¥36 000 (cash, 14/05) attestation│
 │  • Commission : 5% → ¥6 000                   │
 │  [Modifier]            [✓ Confirmer]          │
 └────────────────────────────────────────────┘
   │ tap Confirmer
   ▼  RPC @mola (proc_upsert_supplier + proc_create_purchase_order +
       proc_record_supplier_payment + proc_set_commission) + admin_audit_logs
 Mola : « ✓ Enregistré. Reste à payer : ¥84 000. »
```
- **Mola n'invente rien** : il ne fait que **structurer les valeurs que tu donnes**. S'il manque une
  info, il **demande** (« quel mode de paiement ? »), il ne devine pas.
- **Argent → confirmation obligatoire** (charte Mola + `isSafeInteger` + cap 50 M XAF hérités).

### 3.3 Photos = preuves (stockées, jamais analysées) 🟡

À tout enregistrement, on peut **joindre une ou des photos** (facture, reçu, capture WeChat) → bucket
`procurement-docs` ({owner}/…) → ligne `proc_documents` avec `doc_type` (`invoice_photo`,
`payment_receipt`, `wechat_screenshot`, `other`) **sans aucune extraction**. La photo sert de
**preuve consultable**, attachée à la mission/commande/paiement. C'est tout.

### 3.4 Catch-up mai 2026 = saisie manuelle, par fournisseur 🟡

On reconstruit la mission **à la main** (formulaires ou dictée à Mola), **fournisseur par
fournisseur**, en **rétro-datant** (`occurred_at`), avec les photos jointes comme preuves. Pas
d'auto-structuration. C'est plus lent qu'un OCR, mais **chaque chiffre est vérifié** — ce qui est
exactement l'objectif (« ça nous permet de vérifier »).

---

## 4. PILIER 2 — Capacités `@mola` procurement

### 4.1 Toute action = une RPC taguée (découverte auto + parité) 🟢🟡

```sql
comment on function public.proc_record_supplier_payment(...) is
 '@mola:{"expose":true,"kind":"write","permission":"canManageProcurement","confirm":true,
   "danger":true,"label":"Enregistrer un paiement fournisseur","resolve":{"p_po":"purchase_order"}}';
```
Mola **découvre** l'action sans outil codé à la main ; la **parité** est testée (`parity.test.ts`).

### 4.2 Outils de lecture (répondent au brief) 🟡

`proc_mission_report(mission)` (« génère le rapport de la mission mai ») · `proc_supplier_360` ·
`proc_outstanding_balances` (« combien reste-t-il à payer ? ») · `proc_overdue_qc(days)` (« QC pas
faits depuis 7 j ») · `proc_overdue_production(days)` · `proc_margin_summary` (interne) · recherche
ad hoc **scopée par rôle**.

### 4.3 Outils d'écriture 🟡

`proc_create_mission`, `proc_upsert_supplier`, `proc_create_purchase_order`, `proc_add_order_line`,
`proc_record_supplier_payment`, `proc_record_qc`, `proc_log_production_event`, `proc_set_commission`,
`proc_attach_document` (joindre une photo-preuve), `proc_void_*` (void → `super_admin`). Tous
`confirm:true` ; argent → `danger:true`.

### 4.4 Résolution de références 🟡

`BZ-MS-…`, `BZ-PO-…`, `BZ-SP-…`, **fournisseur par nom** → UUID (façon `resolveRef`). Le père ne tape
jamais d'UUID.

---

## 5. PILIER 3 — Savoir métier procurement (RAG) 🟡

Tue P0-C. Indexer en couche sémantique `mola_memory` (pgvector, gte-small — en place) le **glossaire
Phase 1** : cycle PI/PO/CI, deposit/balance 30/70, Incoterms 2020, AQL/ISO 2859-1 & types PSI/DUPRO,
**compliance CEMAC**, + **carte des capacités** du module. Récupéré just-in-time. → Mola répond aux
questions métier sans halluciner. Fraîcheur : docs dans `docs/centrale-achat/` (ré)indexés.

---

## 6. PILIER 4 — Mémoire 🟢🟡

Réutiliser la mémoire en couches (working/épisodique/sémantique/profil). Le **profil** retient les
habitudes (fournisseurs fréquents, devise par défaut, formulations du père) ; l'**épisodique** garde
le fil d'une session de saisie longue. Corrections P0-A/P1-B héritées.

---

## 7. PILIER 5 — Self-correction ciblée 🟡

Avant toute proposition financière et sur les chiffres de rapport, Mola se relit (acompte > total =
alerte ; reste-à-payer recoupé). Ciblée argent/chiffres, pas à chaque tour. La carte de confirmation
reste le filet ultime.

---

## 8. Reporting génératif & canal (in-app only) 🟡

- « Génère le rapport de la mission mai » → `proc_mission_report` → **`generate-report-pdf`**
  (existant) → PDF par mission/fournisseur/commande, granularité ligne (Q7 Phase 0).
- **Canal : in-app uniquement** (validé). Partage du PDF via **WhatsApp/email natif**. **Pas de
  Telegram au MVP.** Pas d'écran assistant dédié (l'assistant Mola général suffit — validé).

---

## 9. Anti-Mola-bugs (table de correspondance) 🟢

| Mode d'échec Mola | Notre traitement |
|---|---|
| **P0-A** mémoire à l'envers | hérité corrigé (N derniers, ordre) |
| **P0-B** confabule des limites | **parité testée** sur les outils procurement + carte des capacités |
| **P0-C** pas de socle métier | **RAG procurement** (glossaire Phase 1) |
| **P1-A** réponses tronquées | budgets hérités (max_tokens ~4000) |
| **P1-C** plafond d'itérations | hérité relevé (12-16) |
| **P2-B** vision désactivée | **sans objet** : on n'analyse pas de documents (choix produit). Vision reste OFF. |
| Sécurité SQL par rôle | outils procurement **scopés par permission** |

---

## 10. Coût (chiffré — fortement réduit sans OCR) 🟡

| Poste | Hypothèse | Coût |
|---|---|---|
| ~~OCR/vision ingestion~~ | **supprimé** | **0 $** |
| Inférence Mola (saisie conversationnelle + Q&A + rapports) | Sonnet 4.6, cache outils | marginal (~1-4 ¢/conv) |
| RAG (embeddings glossaire) | gte-small, one-shot + maj | **~1-5 $/mois** |
| Stockage photos-preuves | bucket Supabase | quelques $/mois (compression à l'upload) |
| Infra | reste dans l'edge | **0 $** |
| **Total IA additionnel** | | **~quelques $/mois** (bien moins que l'estimation OCR précédente) |

---

## 11. Questions à trancher avant la Phase 4

1. 🔴 **Saisie conversationnelle vs formulaires** : les deux au MVP (reco), ou tu préfères **commencer
   par les formulaires** et ajouter la dictée à Mola juste après ?
2. 🔴 **Langue** : Mola dialogue en **FR** (reco) ; affichage des noms/specs en 中文 toléré (tu les
   tapes/colles tels quels, pas de traduction auto puisqu'on n'analyse rien) — OK ?
3. 🔴 **Photos obligatoires ?** Une preuve photo est-elle **exigée** pour un paiement (recommandé
   pour l'audit), ou **optionnelle** (réalité : parfois pas de reçu) ? *Reco : optionnelle mais
   encouragée.*

*(Persona dédié & Telegram : déjà tranchés — non. Vision/OCR : supprimés.)*

---

## Auto-contrôle Phase 3 (révisé)

- ✅ **Aligné sur le retour produit** : pas d'OCR, pas d'analyse de documents ; saisie manuelle
  (formulaires) **ou** conversationnelle (dictée à Mola) ; photos = preuves.
- ✅ **Étend Mola** (un cerveau) ; dans l'edge + Postgres existants ; in-app only.
- ✅ **Modèle de données inchangé** (Phase 2 tient) — la source des données change, pas les tables.
- ✅ **Hérite de Mola sans ses bugs** (table P0-A→P2-B) ; argent = confirmation obligatoire.
- ✅ **AI-native** : capacités `@mola` (découverte + parité), références humaines, RAG métier.
- ✅ **Coût** : fortement réduit (OCR supprimé) → ~quelques $/mois.
- ✅ **Contre-argument OCR-assist conservé au dossier** (réouvrable au scale), sans l'imposer.
- ✅ **Pas de code**.
- ⏳ **En attente** : réponses §11 → puis **Phase 4 (parcours & UX, déjà esquissée, à réaligner)**.
