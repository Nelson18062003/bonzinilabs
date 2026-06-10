# Centrale d'achat — Phase 0 : Cadrage & état des lieux

> **Statut :** Phase 0 — cadrage. Lecture seule du code réel ; **aucune ligne applicative modifiée, aucun code avant validation**.
> **Date :** 2026-06-10
> **Méthode :** lecture directe des documents de refonte Mola (00, 06, 14, 16) + trois explorations exhaustives parallèles du repo (Mola niveau code · schéma DB + structure des apps · existant procurement), avec contre-vérification manuelle des faits porteurs (modèles, enums, étiquettes `@mola`, tarification, lignes citées).
> **Légende confiance :** 🟢 vérifié dans le code (référence `fichier:ligne`) · 🟡 étayé, marge d'interprétation · 🔴 supposé / à confirmer.

---

## 1. Le déclencheur et la mission

**Mai 2026.** Un gros client camerounais vient en Chine pour ses achats. Le père l'accompagne dans **plus de 30 usines** (voitures, meubles, matériaux de construction, fenêtres…). Le client verse des **avances chez chaque fournisseur** (cash, Alipay, WeChat). Volume total : **> 3 M CNY**. Résultat aujourd'hui : **impossible de produire un rapport propre** de cette mission. Pas de vue 360° par fournisseur, par commande, par statut. Tout est dispersé entre photos de factures, PDFs, conversations WeChat, et la mémoire du père.

**Mission :** concevoir un module **centrale d'achat** pour Bonzini couvrant le cycle complet *Sourcing → Order → Production → QC → Shipping → Delivery*, pour un client donné sur N fournisseurs, avec :
- reporting à forte granularité (par mission, fournisseur, commande) ;
- transparence interne (reste à payer, marge Bonzini, exposition financière) ;
- ingestion de documents hétérogènes (photos, PDFs, Word, exports WeChat) avec OCR best-effort + validation humaine ;
- une **couche IA conversationnelle** héritière de l'esprit Mola, sans ses erreurs historiques ;
- utilisable par le **père, sur mobile, en Chine, pendant une visite d'usine** (persona n°1) ;
- audit trail non négociable (argent du client) ;
- scalable de 1 client / 30 fournisseurs à 50 clients / 1000+ fournisseurs sans refonte.

**Contrainte de méthode imposée (et acceptée) :** une phase à la fois, apprentissage du domaine avant tout design, anti-réinvention (étudier Anvyl/Flexport/Alibaba avant de proposer), coût mensuel chiffré pour chaque décision, catch-up rétroactif de la mission mai 2026 dans le Lot 1.

---

## 2. État des lieux Bonzini (vérifié sur le code)

### 2.1 Architecture générale

| Élément | Réalité | Référence | Conf. |
|---|---|---|---|
| Stack | React + Vite + TypeScript + Tailwind + shadcn/ui, Supabase (Postgres + Edge Functions Deno + Storage) | `CLAUDE.md`, `package.json` | 🟢 |
| Deux apps isolées | client (`supabase`, storageKey `bonzini-client-auth`) / admin (`supabaseAdmin`, `bonzini-admin-auth`) — sessions totalement séparées | `.claude/rules/supabase-clients.md` | 🟢 |
| App admin | **mobile-first**, écrans sous `src/mobile/screens/` (13 domaines : admins, agent-cash, analytics, assistant, auth, clients, dashboard, deposits, more, payments, rates, support, treasury), routes `/m/*`, lazy-loaded | `src/mobile/screens/` | 🟢 |
| App client | pages sous `src/pages/` (wallet, deposits, payments, beneficiaries, history, rates, support, notifications…) | `src/pages/` | 🟢 |
| i18n | **FR / EN / ZH (chinois simplifié)** via i18next — la plateforme parle déjà chinois | `src/i18n/locales/` | 🟢 |
| Rôles admin | `super_admin · ops · support · customer_success · cash_agent · treasurer` | `types.ts:1770-1776` | 🟢 |
| Permissions | matrice `ROLE_PERMISSIONS` (12 clés `canX`) + `hasPermission()` | `src/contexts/AdminAuthContext.tsx:35-120, 303-306` | 🟢 |
| Audit | `admin_audit_logs` (action_type, target_type, target_id, details JSON) alimenté par `logAction()` et par les RPC | `types.ts:41-70`, `AdminAuthContext.tsx:309-330` | 🟢 |
| RPC | **86 fonctions** dans le bloc `Functions` de `types.ts` ; écritures via SECURITY DEFINER uniquement | `types.ts:1358-1768` | 🟢 |
| Tests | vitest (+ Playwright e2e iOS), `npm run type-check`, CI GitHub Actions | `package.json:7-17`, `playwright.config.ts` | 🟢 |
| Uploads | `validateUploadFile()` : JPEG/PNG/WebP/PDF, max 10 Mo ; buckets `deposit-proofs`, `payment-proofs`, `assistant-attachments` | `src/lib/utils.ts:8-19`, migrations `20251212074205`, `20251220211736`, `20260531130000` | 🟢 |
| OCR / extraction | **inexistant** — les fichiers sont stockés, jamais analysés | recherche exhaustive | 🟢 |

### 2.2 Le modèle d'argent côté client (le métier actuel de Bonzini)

Le cœur actuel : un client africain alimente un **wallet XAF**, puis ordonne des **paiements vers la Chine**.

- **`wallets`** (solde XAF, SELECT-only par RLS) + **`ledger_entries`** (append : `DEPOSIT_VALIDATED`, `PAYMENT_RESERVED`, `PAYMENT_EXECUTED`, `ADMIN_CREDIT`… avec `balance_before/after`) — `types.ts:1316-1339, 453-507` 🟢
- **`deposits`** : 9 statuts (`created → awaiting_proof → proof_submitted → admin_review → validated/rejected/pending_correction/cancelled/cancelled_by_admin`), méthodes mobile money/banque/cash, preuves (`deposit_proofs` avec soft-delete) + timeline (`deposit_timeline_events`) — `types.ts:363-425, 275-362, 1786-1795` 🟢
- **`payments`** : 9 statuts (`created → waiting_beneficiary_info → ready_for_payment → processing → completed` + flux cash `cash_pending → cash_scanned`), méthodes **alipay / wechat / bank_transfer / cash**, double montant **`amount_xaf` + `amount_rmb`** + `exchange_rate` + `rate_is_custom` — `types.ts:621-763, 1804-1814` 🟢
- **Flux cash chinois déjà outillé** : QR code, scan, signature du bénéficiaire (`cash_qr_code`, `cash_scanned_by`, `cash_signature_url`, `cash_signed_by_name`) — `types.ts:621-763` 🟢. *Le « cash sans reçu » a donc déjà un précédent de réponse produit : l'attestation par signature/scan.*
- **`beneficiaries`** : contacts de paiement réutilisables (alipay/wechat/banque/cash, `identifier`, `qr_code_url`) — `types.ts:71-139` 🟢
- **Taux** : `daily_rates` (taux XAF/CNY **par méthode** : alipay, wechat, virement, cash) + `rate_adjustments` + `rate_snapshots` (Binance bid, spread, WAC) — `types.ts:239-274, 764-847` 🟢

### 2.3 Le module trésorerie interne (découverte clé de la Phase 0)

Un module **trésorerie XAF → USDT → CNY** est déjà conçu, documenté et codé (doctrine validée dans `docs/analysis-tracabilite-chaine-valeur.md` 🟢) :

- **`treasury_counterparties`** (`usdt_supplier` | `cny_buyer`, avec `wechat_id`, `short_id`) — `types.ts:884-931` 🟢
- **`treasury_accounts`** multi-devises (XAF/USDT/CNY ; kinds `bank, mobile_money, crypto_pool, cash, alipay, wechat` — dont les comptes réels `cash_guangzhou`, `alipay_papa`, `wechat_papa`) — `types.ts:848-883`, doc chaîne de valeur 🟢
- **`usdt_purchases` / `usdt_sales`** append-only avec taux implicite, **WAC**, annulation par **contre-écriture** (`void_contra_entry_id`) — `types.ts:1058-1225` 🟢
- **`treasury_ledger_entries`** (double entrée interne) + **`treasury_inventory_snapshots`** (inventaire hebdo du cash, variance) — `types.ts:991-1057, 932-990` 🟢
- Rôle dédié **`treasurer`** (= le père) avec `canViewTreasury` / `canManageTreasury` ; 12 écrans mobiles `src/mobile/screens/treasury/` ; hook `useTreasury.ts` (~633 lignes) 🟢

**Pourquoi c'est structurant :** ce module a déjà tranché — et fait vivre en production — quatre doctrines que la centrale d'achat devra respecter : (1) **append-only + voiding par contre-écriture**, (2) **multi-devises à soldes natifs, reporting XAF**, (3) **saisie mobile-first par le père**, (4) **comptes cash/Alipay/WeChat de Guangzhou comme objets de première classe**. Quand le père paiera une avance fournisseur en cash pendant une mission, ce cash **sort d'un compte treasury existant** : le lien est un point d'intégration majeur (Phase 3).

**Mais attention au faux ami** 🟢 : `treasury_counterparties.usdt_supplier` désigne un **vendeur d'USDT** (contrepartie de change), pas une **usine**. Le « fournisseur » de la centrale d'achat est une entité nouvelle, à ne pas tordre dans le modèle treasury.

### 2.4 Mola — le socle d'héritage (et les leçons payées)

Architecture actuelle vérifiée (`supabase/functions/admin-assistant/index.ts`, **2 996 lignes**) :

| Élément | Valeur actuelle | Référence | Conf. |
|---|---|---|---|
| Boucle agentique ReAct | max **14** itérations d'outils | `index.ts:35, 2863` | 🟢 |
| Modèles | FAST = `claude-haiku-4-5-20251001` (lecture) → bascule SMART = `claude-sonnet-4-6` (écriture) | `index.ts:33-34` | 🟢 |
| Outils | **77** (≈50 lecture + 27 écriture, toutes avec carte de confirmation) | `index.ts:2` | 🟢 |
| Découverte de capacités | `find_capability` → RPC `mola_discover_capabilities` (scan **live** de `pg_proc` + étiquettes `@mola`) → `do_capability` (gateway générique) | `index.ts:310-319, 2396-2442` ; migration `20260603150000:27-48` | 🟢 |
| Étiquettes `@mola` | **59 occurrences** dans 7 migrations `*_mola_*` ; convention gravée dans `CLAUDE.md` (obligatoire pour toute nouvelle RPC) | `supabase/migrations/` | 🟢 |
| Résolution de références | `resolveRef` : BZ-DP-…/BZ-PY-…/nom client → UUID (anti-hallucination d'identifiants) | `index.ts:2425` | 🟢 |
| Sécurité d'exécution | re-vérification de permission **à la confirmation** + claim atomique anti double-tap (`UPDATE … WHERE status='pending'`) | `index.ts:2725-2748` | 🟢 |
| Mémoire | `mola_memory` (pgvector 384, **gte-small natif** edge runtime) + `mola_user_memory` (profil) + résumé roulant + compaction (>30 msgs) ; historique rechargé **chronologique, limit 100** (le bug « 20 plus anciens » est corrigé) | migration `20260603120000` ; `index.ts:2620-2673` ; `useAdminAssistant.ts:237-241` | 🟢 |
| Masquage PII | `_shared/mask.ts` appliqué à **chaque** tool_result avant le LLM, par rôle | `index.ts:2944` | 🟢 |
| SQL libre | `assistant_readonly_query` : SELECT/WITH only, blocklist mots-clés, **transaction READ ONLY**, LIMIT 200, timeout 8 s | migration `20260601120000` | 🟢 |
| Coût | usage exact (input/output/cache) journalisé dans `admin_audit_logs.details.est_cost_usd` ; grille : Haiku 1/5, Sonnet 3/15 USD/MTok (cache read 0.10/0.30) | `index.ts:43-48, 2973` | 🟢 |
| Qualité | harnais d'eval `eval/assistant/` (cases, judge 5 axes, gate, parité, baseline) + **test de parité** qui casse la CI si une RPC dérive de son outil ; **radar opérationnel** + digest quotidien Telegram (cron 06:00) | `eval/assistant/*` ; migration `20260607120000` | 🟢 |
| Pièces jointes | compressées, stockées (`assistant-attachments`), **jamais envoyées au modèle** (vision désactivée par choix coût/vitesse) | `useAdminAssistant.ts:107` ; héritage du diagnostic `00-DIAGNOSTIC.md` §P2-B | 🟢 |

**Les erreurs historiques de Mola, et leur traduction en règles de conception** (source : `docs/assistant-ops/refonte/00-DIAGNOSTIC.md`, vérifié) :

| Faiblesse documentée | Cause racine prouvée | Règle pour la centrale d'achat |
|---|---|---|
| « Perd le contexte » | historique rechargé `ORDER BY ASC LIMIT 20` = les 20 messages les plus **anciens** (`00-DIAGNOSTIC.md` §P0-A) | mémoire = stratégie de fenêtre + compaction **dès le design**, jamais un afterthought ; cas d'eval multi-tours obligatoires |
| « Refuse des actions possibles » | catalogue d'outils écrit à la main = **miroir partiel et figé** de la plateforme (§P0-B, cas du taux personnalisé) | **zéro outil écrit à la main pour les écritures** : toute RPC du module naît avec son étiquette `@mola` ; le test de parité casse la CI sinon |
| « Je ne sais pas » injustifié | prompt vide de métier + max_tokens 1500 + 8 itérations + contexte-outil jeté (§P0-C, P1-A/B/C) | couche de savoir métier (playbook + ontologie indexée) livrée **avec** le module ; budgets tokens/itérations dimensionnés pour des rapports longs |
| Fausse info « avec aplomb » | l'agent devine au lieu d'inspecter | les tools **inspectent la base en temps réel** (find_capability scanne `pg_proc` live ; SQL lecture libre) — jamais de doc statique comme source de vérité |

### 2.5 Le greenfield : ce qui n'existe pas du tout

Recherche exhaustive (src/, supabase/, docs/) 🟢 — **aucune** trace de :
- fournisseurs-usines, missions d'achat, RFQ/sourcing ;
- purchase orders, lignes de commande, SKU/produits, conditions (deposit ratio, deadline) ;
- statuts de production, QC/inspection (checklists, photos de défauts, AQL) ;
- shipping (conteneurs, regroupement, incoterms, tracking) ;
- factures/proformas/contrats comme objets métier (seules des « preuves » de dépôt/paiement existent) ;
- OCR, traduction de documents, extraction de données ;
- frais de mission (hôtel, transport, chauffeur) refacturables ;
- remises/commissions négociées fournisseur.

### 2.6 Synthèse : réutiliser / étendre / créer

| Brique | Verdict | Détail |
|---|---|---|
| Auth, rôles, permissions, audit logs | **Réutiliser** | ajouter des clés `canX` procurement à la matrice |
| Doctrine append-only + contre-écriture | **Réutiliser** | héritée du treasury, déjà en prod |
| Convention `@mola` + découverte de capacités + cartes de confirmation | **Réutiliser** | imposée par `CLAUDE.md`, le module naît AI-native |
| Harnais d'eval + test de parité + instrumentation coût | **Réutiliser** | étendre `parity.manifest.ts` et `cases.ts` au domaine achat |
| Buckets + `validateUploadFile()` + pattern proofs/timeline | **Étendre** | nouveau bucket documents, types de fichiers élargis (Word ?), pipeline OCR à créer |
| `beneficiaries`, flux cash QR/signature | **Étendre** | précédent direct pour « payer une usine en cash/Alipay/WeChat avec attestation » |
| Treasury (comptes CNY, WAC) | **Intégrer** | les paiements fournisseurs sortent des comptes treasury ; ne PAS confondre contreparties de change et usines |
| i18n ZH | **Réutiliser** | utile pour documents/communication fournisseurs |
| Suppliers, missions, PO, SKU, production, QC, shipping, documents métier, dépenses de mission, remises | **Créer** | le cœur de la centrale d'achat |
| OCR multilingue + traduction | **Créer** | divergence délibérée vs Mola (qui n'envoie rien au modèle) — ligne de coût à chiffrer |

---

## 3. Lecture critique du brief (contre-pieds assumés)

1. **« On centralise la communication WeChat dans la plateforme ? » — Non, et il faut tuer cette idée tôt.** Confiance haute (sources formelles en Phase 1) : il n'existe pas d'API officielle utilisable pour automatiser un WeChat **personnel** ; les passerelles tierces violent les CGU et exposent le compte du père à un **ban** — opérationnellement catastrophique puisque c'est son canal fournisseurs. WeCom (WeChat Work) impose une entité chinoise vérifiée et ne couvre pas les conversations personnelles existantes. La voie réaliste est **côté capture** : saisie ultra-rapide dans l'app pendant/après l'échange, partage de captures d'écran/exports → OCR → validation. Le brief doit cesser de penser « intégration » et penser « capture ». 🟡 (position ferme, sourçage Phase 1)
2. **« Construit totalement comme un produit IA » — à moitié vrai.** L'IA est l'interface et le multiplicateur, pas le substrat. La preuve interne : Mola n'est devenu bon que quand la couche RPC a été propre, étiquetée et introspectable (`14-AI-NATIVE-DIAGNOSTIC-DESIGN.md`). L'ordre des phases en découle : modèle métier (Phase 3) **avant** agent (Phase 5). C'est d'ailleurs ta propre règle (« IA en couche au-dessus »), je la prends au mot contre la formulation « totalement IA ».
3. **Le piège du faux existant.** Le module treasury ressemble à du procurement (« suppliers », CNY, WAC) mais n'en est pas : c'est du change. Réutiliser ses *doctrines* oui, tordre ses *tables* non. 🟢
4. **« Scaler à 50 clients sans refonte » — la contrainte n'est pas la base de données.** Postgres tiendra 1000 fournisseurs sans effort. Le goulot est **le père** : un humain ne fait pas 50 missions. Le module ne « scale » que s'il **encode le process** (checklists QC, statuts, attestations, rapports auto) au point de pouvoir déléguer à des tiers (inspecteurs, staff local) sans perte de confiance. C'est un objectif de design, pas d'infra. Confiance moyenne-haute.
5. **Vision documentaire : divergence nécessaire vs Mola.** Mola n'envoie volontairement aucun document au modèle (coût). La centrale d'achat, elle, a l'OCR de factures chinoises au cœur du besoin. C'est une décision de coût explicite à chiffrer en Phase 6 (OCR dédié vs multimodal LLM), pas un héritage à copier. 🟢
6. **Anti-réinvention, mais avec le bon référentiel.** Anvyl/Flexport/Alibaba sont à étudier (Phase 1), mais ce sont des produits US/enterprise ou des marketplaces ; le comparable le plus proche du métier réel (agent de sourcing à la commission, terrain, WeChat, cash) est le **playbook des sourcing agents Chine** et les pratiques 1688/Canton Fair/Yiwu. La Phase 1 étudiera les deux familles et dira ce qu'on copie de chacune.

---

## 4. Workflow proposé (à valider — Décision D-003)

### Proposition A — 7 phases avec gates (recommandée)

| Phase | Contenu | Livrable | Gate (tu valides) |
|---|---|---|---|
| **0. Cadrage** *(ce doc)* | état des lieux, briques, risques, workflow | `00-PHASE0-CADRAGE.md` | workflow + réponses Q-1…Q-8 |
| **1. Apprentissage du domaine** | vocabulaire et standards (incoterms 2020, PI/CI/PL, T/T 30-70, AQL/ISO 2859, types d'inspection pre-prod/DUPRO/PSI, FCL/LCL, factoring) ; étude des références : Anvyl, Flexport, Alibaba (Trade Assurance + agents), ImportYeti, pure players QC (QIMA…), playbooks sourcing agents Chine/1688 ; patterns à copier / à éviter. **Tout sourcé URL+date, zéro terme deviné.** | `10-DOMAINE-PROCUREMENT.md` (glossaire + analyse comparative) | vocabulaire + périmètre métier retenu |
| **2. Diagnostic terrain & cas mai 2026** | questionnaire père/toi (livrable dès la fin de Phase 0 pour paralléliser), reconstitution de la mission réelle, inventaire des artefacts existants, personas, parcours actuels WhatsApp/WeChat, pain points priorisés | `20-DIAGNOSTIC-TERRAIN.md` + questionnaire rempli | personas + périmètre MVP |
| **3. Modèle métier & données** | entités + relations, machines à états (PO, production, QC, shipping, paiement fournisseur), modèle monétaire multi-devises (CNY natif, reporting XAF, attestation cash), remises/commissions/marge, intégration ledger+treasury, RLS/permissions, modèle de reporting | `30-MODELE-METIER.md` | **LA** décision structurante |
| **4. UX mobile-first terrain** | parcours « père en usine » (capture < 30 s : photo + montant + fournisseur), mode dégradé réseau Chine, pipeline document (photo → OCR → validation humaine), vue 360° fournisseur, rapports client, place dans l'app admin | `40-UX-TERRAIN.md` | parcours validés |
| **5. Couche IA — agent centrale d'achat** | architecture (tools temps réel, étiquettes `@mola`, mémoire, self-correction), catalogue de capacités, génération de rapports, alertes proactives (radar achat, à l'image du radar ops), evals dédiées, rapport Mola : extension vs agent frère | `50-AGENT-IA.md` | architecture agent |
| **6. Architecture technique & coûts** | choix chiffrés (OCR, traduction, stockage, embeddings), **coût mensuel par palier (1 / 10 / 50 clients)**, risques réseau Chine, plan de migrations | `60-ARCHITECTURE-COUTS.md` | stack + budget |
| **7. Roadmap & lots** | **Lot 1 = MVP interne + catch-up rétroactif mission mai 2026**, lots suivants, DoD, plan de validation | `70-ROADMAP-LOTS.md` | **GO implémentation** |

Parallélisation prévue : le **questionnaire terrain** (Phase 2) part pendant la Phase 1 — il dépend d'humains, pas de moi.

### Proposition B — 4 phases compressées

(1) domaine + diagnostic · (2) modèle métier + UX · (3) IA + archi + coûts · (4) roadmap. Plus rapide, moins de checkpoints. **Risque réel :** les découvertes terrain (Phase 2) arrivent après des choix de modèle déjà esquissés ; sur un sujet de cette taille, c'est le profil d'erreur classique. **Je recommande A.**

---

## 5. Cadre de chiffrage des coûts (baseline vérifiée)

Aucune décision de coût n'est prise en Phase 0 ; voici le **socle de référence** sur lequel les phases 5-6 chiffreront :

- Tarifs inférence déjà codés en dur dans l'edge function 🟢 (`index.ts:43-46`) : Sonnet 4.6 = 3/15 USD par MTok (in/out, cache read 0.30) ; Haiku 4.5 = 1/5 (cache read 0.10).
- Coût réel **mesuré par conversation** dans `admin_audit_logs.details.est_cost_usd` 🟢 — on pourra extraire le coût observé de Mola comme ordre de grandeur avant de dimensionner l'agent achat. 🔴 valeur réelle à extraire de la prod (Phase 5).
- Postes nouveaux à chiffrer en Phase 6 : OCR multilingue (API dédiée vs LLM multimodal), traduction ZH→FR, stockage documents (volumétrie : une mission ≈ 30 fournisseurs × N docs/photos), embeddings (gte-small natif = ~0 $, précédent Mola 🟢).

---

## 6. Registre des risques initial

| # | Risque | Impact | Traitement prévu |
|---|---|---|---|
| R-1 | Intégration WeChat impossible officiellement ; passerelles = risque de ban du compte du père | canal fournisseurs principal | Phase 1 (sourçage formel) + Phase 4 (workflow de capture) |
| R-2 | Réseau Chine (GFW) : accès Supabase/Anthropic instable depuis le continent | persona n°1 inutilisable sur le terrain | Phase 4/6 : capture offline-first + file d'attente de sync ; à tester en conditions réelles 🔴 |
| R-3 | Données mai 2026 partiellement perdues (mémoire humaine, photos dispersées) | catch-up rétroactif dégradé | questionnaire tôt (Phase 2 parallélisée) ; workflow d'attestation pour cash sans reçu |
| R-4 | Sur-modélisation (SAP pour 1 client) ou sous-modélisation (Sheets pour 3 M CNY) | échec produit | gate Phase 3 explicitement sur ce critère |
| R-5 | Double saisie père (treasury + achat) si paiements fournisseurs non liés aux comptes treasury | abandon de l'outil par le père | point d'intégration majeur en Phase 3 |
| R-6 | OCR chinois sur photos floues : erreurs silencieuses | chiffres faux dans les rapports | OCR = proposition, **jamais** auto-commit ; validation humaine obligatoire |
| R-7 | Transparence client vs marge interne (remises négociées) non tranchée | modèle de données et confiance client | Q-6, doctrine à fixer avant Phase 3 |
| R-8 | L'agent répond sans inspecter (récidive Mola) | fausses infos sur l'argent client | tools d'inspection live + evals de grounding dès le design (Phase 5) |

---

## 7. Questions à trancher (gate de la Phase 0)

- **Q-1 — Workflow :** Proposition A (7 phases, recommandée), B (compressée), ou A amendée ?
- **Q-2 — Références Phase 1 :** ma liste d'étude (Anvyl, Flexport, Alibaba Trade Assurance + agents de sourcing, ImportYeti, QIMA/inspection, playbooks 1688/Canton Fair) te va-t-elle ? Des outils à ajouter/imposer ?
- **Q-3 — Artefacts mai 2026 :** que reste-t-il concrètement (photos de factures, PDFs, exports WeChat, notes, liste des ~30 usines) ? Peux-tu m'en fournir un échantillon (même partiel/anonymisé) en Phase 2 ?
- **Q-4 — Interview père :** un questionnaire écrit relayé par toi (~45 min) est-il faisable pendant la Phase 1 ? Je le livre dès validation du workflow.
- **Q-5 — Périmètre Lot 1 :** outil **interne admin** d'abord, le client recevant des rapports générés (ma recommandation), ou exposition dans l'app cliente dès le Lot 1 ?
- **Q-6 — Doctrine transparence :** le client voit-il les **remises négociées** (transparence totale, commission Bonzini explicite) ou un **prix net** (marge interne invisible) ? Cette décision structure le modèle de données et le reporting.
- **Q-7 — Budget mensuel cible** pour OCR + IA + stockage du module : < 20 $ / < 75 $ / < 200 $ ? (calibre les choix de la Phase 6)
- **Q-8 — Entité légale Chine :** Bonzini (ou le père) dispose-t-il d'une structure enregistrée en Chine ? Cela change les options WeCom / Alipay business / comptes bancaires CNY.

---

## 8. Self-check Phase 0

- Apprentissage domaine : **pas encore fait** — c'est l'objet de la Phase 1, aucun terme métier n'a été défini de mémoire dans ce doc ✅
- Références procurement existantes : programmées en Phase 1 avec liste explicite ✅
- Persona père terrain : présent dans les risques (R-2, R-5), le workflow (Phase 4 dédiée) et l'état des lieux (treasury mobile-first prouvé) ✅
- Cash sans reçu : traité comme réalité (précédent `cash_signature_url` identifié, workflow d'attestation prévu) ✅
- Documents hétérogènes : acceptés tels quels (OCR best-effort + validation humaine, R-6) ✅
- Audit trail : doctrine append-only + contre-écriture identifiée et héritée ✅
- IA en couche au-dessus : ordre des phases 3 → 5 l'impose ✅
- Hériter de Mola sans ses erreurs : tableau faiblesses → règles (§2.4) ✅
- Coût mensuel : baseline vérifiée + cadre (§5), chiffrage par décision en phases 5-6 ✅
- Catch-up mai 2026 dans Lot 1 : inscrit dans la Phase 7 ✅
- `fichier:ligne` : systématique ; URL+date : s'appliquera dès la Phase 1 (web) ✅
- Vérifié/supposé/à confirmer : légende appliquée ✅
- Doc Markdown : ce fichier + `DECISIONS.md` + `README.md` ✅
- Questions concrètes en fin : Q-1…Q-8 ✅
