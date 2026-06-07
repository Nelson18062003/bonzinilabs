# Phase 0 — Cadrage & diagnostic de l'existant

> **Statut : rendu, en attente de validation.** Aucun design détaillé ici (réservé aux phases
> suivantes). Aucun code applicatif écrit. Cette phase répond à trois questions : **(1)** qu'a déjà
> Bonzini que je peux réutiliser ? **(2)** comment Mola est-il *réellement* fait (pour en hériter
> sans copier ses bugs) ? **(3)** quel workflow et quelles décisions pour la suite ?
>
> **Légende confiance :** 🟢 vérifié (`fichier:ligne`) · 🟡 supposé · 🔴 à confirmer (métier/mesure).

---

## 1. Reformulation — ce qu'est *vraiment* ce module

Le brief parle d'une « centrale d'achat ». Première mise au point, parce qu'elle conditionne tout
le reste : **ce module n'est pas une extension de l'app de paiement. C'est une autre activité.**

- L'app actuelle est un **transmetteur de fonds** : le client a un wallet XAF, il paie un
  bénéficiaire chinois en CNY. Bonzini gère la *liquidité* (XAF→USDT→CNX) et la *conformité du
  paiement*. Le client possède la relation fournisseur ; Bonzini ne voit que le flux d'argent.
- La centrale d'achat est une **maison de sourcing / agent d'achat** : Bonzini (via le père)
  accompagne le client en usine, **négocie**, suit la **commande physique** (production, qualité,
  expédition), et prend une **marge** (commission et/ou remise négociée). Bonzini possède — au moins
  partiellement — la relation fournisseur et porte une part de responsabilité sur la *marchandise*,
  pas seulement sur l'argent.

C'est le modèle d'**Alibaba Sourcing / Flexport / Anvyl**, pas celui d'un PSP. Conséquence : les
entités (mission, fournisseur, commande, produit, QC, expédition), la P&L (marge sur marchandise,
pas spread FX), et le risque (litige qualité, retard de production) sont **nouveaux**. On ne les
plaque pas sur le schéma paiement existant.

**Le besoin en une phrase :** transformer 30+ relations fournisseurs dispersées dans WeChat, des
photos et la tête du père, en une **vue 360° structurée et auditable par mission / fournisseur /
commande**, alimentée principalement par **ingestion IA** (le père dépose des photos/notes,
l'agent structure) et interrogeable / rapportable en conversation.

---

## 2. Diagnostic de l'existant (ce que j'ai lu dans le code)

### 2.1 Stack & architecture 🟢

- React 18 + Vite + TypeScript + Tailwind + shadcn/Radix ; forms `react-hook-form` + `zod` ;
  état TanStack Query v5 ; routing React Router v6 (`package.json`).
- **Deux clients Supabase isolés** par `storageKey` (`src/integrations/supabase/client.ts:10-36`) :
  `supabase` (client app) et `supabaseAdmin` (admin app). Règle dure du projet : en contexte admin,
  **tout** passe par `supabaseAdmin`.
- Admin **mobile-first** : tous les écrans admin vivent dans `src/mobile/screens/`, sous un shell à
  tab bar (`src/mobile/components/MobileRouteWrapper.tsx` → `MobileAppShell`). Admin sous `/m/*`,
  agents cash sous `/a/*`.
- Backend Supabase Postgres + RLS + **RPC `SECURITY DEFINER`** pour toute écriture sensible. Aucune
  écriture financière directe en table.

**Implication module :** on a déjà tout le squelette technique (mobile-first, RHF+Zod, RPC pattern,
deux clients). La centrale d'achat s'ajoute en **greenfield** dans `src/mobile/screens/` + nouvelles
tables + nouvelles RPC, sans toucher au cœur paiement. C'est exactement la trajectoire qu'ont suivie
les deux derniers modules (trésorerie, bénéficiaires).

### 2.2 Modèle de données existant — réutilisable vs manquant 🟢

**28 tables actives.** Les colonnes/positions sont sourcées dans `src/integrations/supabase/types.ts`
(rapport d'audit schéma complet, archivé en annexe de ce dossier). Ce qui compte pour nous :

| Brique existante | Où | Réutilisable pour la centrale d'achat ? |
|---|---|---|
| `clients` (donneur d'ordre) | `types.ts:158-237` | ✅ **Oui** — le client de la mission EST un `clients`. On rattache les missions à `clients.user_id`. |
| `wallets` + `ledger_entries` (append-only, `balance_before/after`) | `types.ts:1316-1339`, `453-507` | ⚠️ **Partiel** — c'est le rail *financier* XAF. Les paiements fournisseurs *peuvent* s'y rattacher, mais beaucoup sont cash/WeChat directs hors-rail. Voir position #4. |
| `payments` (sortie CNY, `create_admin_payment`) | `types.ts:621-762` | ⚠️ **Lien, pas duplication** — quand un acompte fournisseur passe par le rail Bonzini, on **référence** le `payment`, on ne recopie pas le montant. |
| `admin_audit_logs` (`action_type/target/details JSONB`) | `types.ts:41-69` | ✅ **Oui** — chaque RPC sensible y journalise déjà. On réutilise le mécanisme pour l'audit trail procurement. |
| Pattern **append-only + voiding par contre-écriture** (trésorerie) | `supabase/migrations/20260515000002_treasury_schema.sql` | ✅ **Oui** — modèle exact pour un ledger procurement auditable (cf. position #6). |
| **Storage buckets** (`deposit-proofs`, `payment-proofs`, `cash-signatures`, `assistant-attachments`) | migrations `…074205`, `…131033`, `…531130000` | ✅ **Oui** — on ajoute un bucket `procurement-docs` sur le même pattern RLS (`{owner}/...`). |
| Rôle **`treasurer`** créé pour le père + helper `can_access_treasury()` | `supabase/migrations/20260515000003_treasury_role.sql` | ✅ **Précédent direct** — on créera de même un rôle/permission procurement pour le père. |
| Permission matrix TS (12 clés) | `src/contexts/AdminAuthContext.tsx:20-120` | ✅ **Oui** — on étend avec `canViewProcurement` / `canManageProcurement`. |

**Ce qui n'existe PAS et qu'il faut créer (cœur du module) :**

- ❌ **Mission** (séjour/projet d'achat) — aucune notion.
- ❌ **Supplier / usine** — il existe `beneficiaries` (destinataires de paiement, **par client**,
  `types.ts:71-138`) et `treasury_counterparties` (fournisseurs USDT / acheteurs CNY, **org-wide**,
  `types.ts:884-930`), mais **aucun ne modélise une usine** (nom, catégorie produit, ville, WeChat,
  catalogue, photos, historique qualité). Et surtout : un fournisseur de marchandise est
  **partagé entre clients** (voir position #3) — ni le modèle `beneficiaries` (par client) ni
  `counterparties` (sans relation commerciale) ne convient tel quel.
- ❌ **Purchase Order / Product-SKU** — aucune notion de commande de marchandise ni d'article.
- ❌ **Paiement fournisseur typé** (acompte/solde, vs le `payments` générique).
- ❌ **Statut de production / QC inspection / expédition (conteneur) / frais de mission.**
- ❌ **Marge/commission/remise négociée** comme entité (le seul concept de marge existant est le
  *spread FX* trésorerie, `wac`/`spread`, qui n'a rien à voir avec une marge sur marchandise).

**Verdict :** ~70 % de la *plomberie* est réutilisable (auth, RLS, RPC, storage, audit, mobile,
append-only). ~0 % du *domaine métier* procurement existe. C'est un vrai module, pas un patch.

### 2.3 Mola — ce qu'on hérite, ce qu'on évite 🟢

Mola est l'edge function `supabase/functions/admin-assistant/index.ts` (~2706 lignes), modèle
**Claude Sonnet 4.6** par défaut (`index.ts:27-29`), boucle ReAct mono-agent, **62 outils
(42 lecture / 20 écriture)**, UI `src/mobile/screens/assistant/MobileAssistantScreen.tsx`, hook
`src/hooks/useAdminAssistant.ts`.

**Les qualités à hériter (la « charte Mola »,** `docs/assistant-ops/refonte/01-CIBLE-ET-QUICKWINS.md`**) :**

1. **Découverte automatique de capacités** — chaque RPC porte un commentaire SQL `@mola:{...}`
   (`expose/kind/permission/confirm/danger/label/resolve/tool`). La RPC `mola_discover_capabilities`
   (`supabase/migrations/20260603150000_mola_capability_discovery.sql`) scanne `pg_proc`/`pg_description`
   à l'exécution → Mola **découvre** les actions sans code outil écrit à la main. **C'est exactement
   le mécanisme à réutiliser** : on tague nos RPC procurement `@mola`, Mola les voit immédiatement.
2. **Confirmation humaine sur l'argent** — toute écriture sensible passe par une carte de
   confirmation (`assistant_pending_actions`), jamais d'exécution sans tap.
3. **Permissions héritées, jamais élargies** — chaque outil porte une `permission` (clé `canX`),
   filtrée selon le rôle de l'admin connecté (matrice `index.ts`).
4. **Parité outil↔plateforme testée** — `eval/assistant/parity.test.ts` + `parity.manifest.ts`
   cassent le build si un paramètre de RPC n'est pas exposé/justifié. Anti-dérive mécanique.
5. **Mémoire en couches** (`mola_memory`, pgvector, résumés roulants) + **coût instrumenté**
   (capture des tokens, `PRICING_USD_PER_MTOK`, estimation par conversation).

**Les erreurs documentées à NE PAS reproduire (`docs/assistant-ops/refonte/00-DIAGNOSTIC.md`) :**

| Code | Symptôme | Cause | Ce qu'on fait dans la centrale d'achat |
|---|---|---|---|
| P0-A | « perd le contexte en pleine conversation » | mémoire chargée à l'envers (20 plus *vieux* messages) | charger les **N derniers** dans l'ordre + compaction par résumé |
| P0-B | « refuse une action pourtant possible » + invente une fausse règle | écart outil↔RPC (le « patient zéro » du taux personnalisé) | **parité dès le départ** : tout ce que l'écran fait, l'outil le propose ; test de parité |
| P0-C | « je ne sais pas » sur le métier | zéro socle de savoir dans le prompt | **RAG métier procurement** (cycle PO/QC, incoterms, règles) récupéré just-in-time |
| P1-A/C | réponses tronquées, abandons | `max_tokens` bas, plafond d'itérations bas | budgets relevés (déjà corrigés côté Mola : ~4000 tok, 12-16 itérations) |
| **P2-B** | **« ne peut pas lire un reçu / un QR »** | **vision désactivée : les pièces jointes ne sont PAS envoyées au modèle** (choix de coût, `index.ts` ~1783-1784) | **🔴 BLOQUANT pour nous : la vision DOIT être activée.** L'ingestion de factures/photos EST le cœur du module. |
| Sécurité | un rôle peut lire toute la base via SQL libre | `query_database` scopé seulement `is_admin()`, pas par rôle | exposer au LLM **seulement** ce que le rôle peut voir ; pas de SQL libre cross-périmètre |

> **Conclusion Mola :** ne pas construire un *second agent*. **Étendre Mola.** Le mécanisme
> `@mola` + parité + mémoire + coût existe déjà et marche. On ajoute : les RPC procurement taguées,
> des **outils d'ingestion riches** (OCR/vision), un **RAG métier procurement**, et — si besoin —
> une **persona/canal « centrale d'achat »** côté père. Détail en Phase 3. *(C'est une position, pas
> un acquis — voir Question Q4.)*

### 2.4 Une méthodologie de module déjà éprouvée 🟢

Bonzini a livré **deux modules** avec un process phasé identique, documenté :
- **Trésorerie / chaîne de valeur** (`docs/analysis-tracabilite-chaine-valeur.md`,
  `docs/design-module-tracabilite.md`) — livré : écrans `src/mobile/screens/treasury/*`, schéma
  append-only, rôle `treasurer`, `NUMERIC(20,8)`, voiding par contre-écriture.
- **Bénéficiaires** (`docs/beneficiaires/00-cadrage.md` → `06-verification.md`) — process
  Phase 0 (cadrage + questions + reco) → 1 (audit) → 2 (données) → 3 (parcours) → 4 (plan) →
  5 (implémentation) → 6 (vérification).

**Implication :** mon workflow (§4) **calque** cette méthode (que l'équipe maîtrise déjà) en
l'enrichissant des deux exigences propres à ce module : une **phase d'apprentissage du domaine**
(le procurement a un vocabulaire normé qu'on ne réinvente pas) et une **phase IA dédiée** (ce
module est « principalement un produit IA »).

### 2.5 Canaux & reporting déjà en place 🟢

- **`telegram-bot`** (`supabase/functions/telegram-bot/index.ts`) : bot restreint à **un seul** chat
  admin (`index.ts:645-648`), capable de **pousser des PDF** (`/rapport`, `index.ts:500-538`) et des
  **images/flyers** (`/flyer`). Ce n'est pas Mola, mais c'est la **preuve qu'un canal de messagerie
  + push de rapports fonctionne déjà** dans l'infra. Réutilisable pour « le père reçoit le rapport
  mission en PDF dans un chat ».
- **`generate-report-pdf`** (`supabase/functions/generate-report-pdf/index.ts`) : génération PDF
  serveur déjà opérationnelle → socle pour les rapports mission/fournisseur.

**Implication pour la question « WeChat ? » :** voir position #7. En bref — WeChat n'a pas d'API
bot exploitable pour comptes perso ; on garde WeChat pour la conversation fournisseur, la
plateforme devient le **système de référence** (ingestion des exports WeChat), et le **père dialogue
avec l'agent** via un canal qui a une API (in-app, et/ou Telegram déjà branché).

### 2.6 Coût IA de référence 🟢

`docs/assistant-ops/refonte/06-EVAL-ET-COUT.md` + constantes `index.ts` :
- Sonnet 4.6 : **3 $ / 15 $** par M tokens (in/out), cache read **0,30 $** → **~1-4 ¢/conversation**
  avec cache outils bien posé.
- Cible Mola : **~40-135 $/mois** à 75 conv/jour. Eval complet (30-50 cas) : **< 1 $/run**.

C'est ma **base de chiffrage** pour la couche IA procurement. Le poste nouveau et potentiellement
lourd = **OCR/vision** (les pièces jointes envoyées au modèle = tokens image). Je chiffrerai ce
poste précisément en Phase 3 (ordre de grandeur anticipé : quelques ¢ par document selon
résolution ; à mesurer, pas à deviner).

---

## 3. Sept positions tranchées (analyse, pas neutralité)

> Le brief demande des positions argumentées, pas un menu. Voici mes sept, avec niveau de confiance.
> Elles deviennent des **questions à valider** au §5 — mais je prends parti d'abord.

**Position #1 — C'est une maison de sourcing, pas un PSP. (confiance : élevée)**
La P&L est la **marge sur marchandise** (commission + remise négociée), pas le spread FX. La
responsabilité touche la *marchandise* (qualité, délai), pas que l'argent. Modéliser commission/
remise comme entités de premier rang, dès le départ. Le nier = reconstruire le module dans 6 mois.

**Position #2 — Le vrai risque n'est pas technique, c'est la saisie. Donc l'IA est d'abord un
moteur d'INGESTION, pas un moteur de questions. (confiance : élevée)**
Le doc trésorerie a lui-même listé « discipline opérationnelle » comme **risque #1**
(`design-module-tracabilite.md:543`). Ici le volume est 10-50× pire : 30 fournisseurs × N commandes
× N produits × N paiements × QC × docs **par mission**. Le père ne tapera **jamais** tout ça à la
main sur un téléphone dans une usine. Donc : l'agent doit transformer **une photo / une note vocale
/ un export WeChat** en enregistrements structurés (« dump and structure »). Interroger des données
propres, c'est les 20 % faciles ; **les faire entrer, c'est les 80 % durs.** Le brief insiste sur
« interroger » — je rééquilibre vers « ingérer ».
→ **Corollaire dur :** la vision de Mola est désactivée (P2-B). Pour ce module, **non négociable :
on l'active** (avec garde-fous coût).

**Position #3 — Le fournisseur est une donnée PARTAGÉE, pas par-client. À trancher maintenant ou
refonte garantie. (confiance : élevée)**
La même usine de meubles de Foshan vend à plusieurs importateurs. Aujourd'hui 1 client/30
fournisseurs ; cible 50 clients/1000+ fournisseurs **sans refonte** (contrainte explicite). Si on
modélise le fournisseur par-client (comme `beneficiaries`), on duplique massivement et on ne peut
jamais répondre à « quels de mes clients achètent chez cette usine ? » ni « cette usine a arnaqué
quelqu'un, signale-la partout ». Le bon modèle : **annuaire fournisseur partagé (identité, contacts,
catégorie, historique qualité)** + **relations/commandes par client-mission** par-dessus. L'identité
est partagée ; **les prix/remises négociés restent privés par relation** (sinon on fuite les prix
du client A au client B).

**Position #4 — Ne pas dupliquer le rail d'argent ; le référencer. Mais accepter l'attestation cash
autonome. (confiance : élevée)**
En mai 2026, les acomptes ont été payés cash/Alipay/WeChat, souvent **hors** wallet Bonzini. Le
paiement fournisseur doit donc pouvoir **exister seul** (attestation : « le père a remis ¥50 000
cash au fournisseur X le 14/05, photo du reçu ou attestation »). Quand un paiement **passe** par le
rail Bonzini (`payments` / `create_admin_payment`, `types.ts:621-762`), l'enregistrement procurement
le **référence** (`reference_id`) au lieu de recopier le montant → pas de double comptage, audit
trail existant réutilisé.

**Position #5 — Étendre Mola, ne pas forker un nouvel agent. (confiance : élevée)**
Le mécanisme `@mola` + parité + mémoire + coût existe et marche. Un second agent = duplication +
re-création de la fragmentation de contexte que Mola combat déjà. On tague les RPC procurement
`@mola`, on ajoute des outils d'ingestion riches + un RAG procurement, on (ré)active la vision. Le
père peut avoir une **persona/canal** dédié « centrale d'achat » mais **le même cerveau**. *(Le
brief dit « un nouveau module Mola-like construit principalement comme produit IA » — je le lis
comme « le même moteur, des organes procurement », pas « un clone ». À valider Q4.)*

**Position #6 — Append-only + voiding, comme la trésorerie. Pas de DELETE. (confiance : élevée)**
L'argent du client est en jeu → traçabilité totale. Le projet a déjà cette doctrine
(`20260515000002_treasury_schema.sql`, convention `cancel_*` qui réécrit au lieu de supprimer). On
l'applique aux paiements fournisseurs et aux mouvements de commande. Un paiement erroné se *void*
(contre-écriture motivée), il ne s'efface pas.

**Position #7 — WeChat ne se « centralise » pas dans la plateforme. Hybride assumé. (confiance :
modérée — à vérifier en Phase 1)**
À ma connaissance (cutoff jan. 2026, **à reconfirmer**), WeChat n'offre pas d'API bot/automation
pour comptes personnels ; Official Accounts / WeCom exigent une entité chinoise + ICP et restreignent
fortement ; scraper le WeChat perso viole les CGU et fait bannir le compte. Donc : **suppliers
restent sur WeChat** pour le live ; **la plateforme est le système de référence** (on ingère les
exports/captures WeChat) ; **le père dialogue avec l'agent** via in-app + Telegram (déjà branché).
Prétendre « tout centraliser dans WeChat via API » serait promettre l'infaisable.

---

## 4. Proposition de workflow (à valider / amender)

Calqué sur la méthode maison (bénéficiaires/trésorerie), enrichi des deux exigences du brief
(domaine obligatoire + IA dédiée). **Une phase à la fois, je rends, tu valides, on avance.**

| Phase | Livrable | Pourquoi à cette place |
|------:|----------|------------------------|
| **0** | **Cadrage & diagnostic** (ce document) | Savoir ce qui existe avant de concevoir. |
| **1** | **Apprentissage du domaine procurement** : glossaire (PO/PI/CI, deposit-balance 30/70, incoterms FOB/EXW/CIF/DDP, AQL & niveaux d'inspection QC, factoring, LCL/FCL & consolidation conteneur) + étude **Anvyl / Flexport / Alibaba Sourcing / playbooks sourcing Chine** : ce qu'ils ont résolu, ce qu'on emprunte, ce qu'on jette. **URL + date.** | Règle dure : pas de design avant de connaître le métier. Anti-réinvention. |
| **2** | **Modèle conceptuel & entités** (conçu **AI-first**) : Mission, Supplier (partagé), Relation/Commande (PO), Produit/SKU, SupplierPayment (lien rail + attestation cash), Commission/Remise, Production, QC, Document, Expédition, Frais. Master-data partagée vs par-client. Lien `payments`/`ledger`. Append-only. Multi-tenancy & RLS. **Coût par décision.** | Le socle métier propre — l'IA hallucine sinon. Conçu pour être ingérable et tagué `@mola`. |
| **3** | **Couche IA (le cœur)** : ingestion-first (vision/OCR multilingue FR/中文, voix, parsing exports WeChat), capacités `@mola` procurement, outils riches, RAG métier, self-correction, canal/persona du père, génération de rapports. Hérite de Mola, évite P0-A/B/C, **active la vision**. **Coût inférence + OCR + stockage chiffré.** | Ce module est « principalement un produit IA ». L'IA mérite sa phase. |
| **4** | **Parcours & UX terrain** : capture éclair en visite d'usine, tolérance offline/réseau faible, mobile-first ; flux admin ; **vue reporting client** (par mission/fournisseur/commande). Wireframes texte. | Persona #1 = père sur le terrain. |
| **5** | **Plan d'implémentation par lots** : migrations, RPC taguées `@mola`, écrans, jeu d'eval, revue sécurité, **catch-up rétroactif mission mai 2026 = Lot 1**. Estimations + critères « fait ». **Coût.** | Découper pour livrer incrémentalement, valider tôt sur du réel. |
| **6** | **Implémentation** (après GO explicite), par lots, `type-check`+`build` verts par lot. | Code seulement après validation. |
| **7** | **Vérification** : eval IA + scénario bout-en-bout. **Le rapport propre de la mission mai 2026 = test d'acceptation.** | « Fini » = le problème déclencheur est résolu. |

**Décisions de workflow à prendre (Q-WF) :** (a) cet ordre te convient-il ? (b) veux-tu fusionner
2+3 (données+IA) puisqu'ils sont couplés, ou les garder séparés ? (c) veux-tu un **POC d'ingestion**
ultra-tôt (dès après Phase 1) sur 5-10 vraies pièces de mai 2026, pour dé-risquer l'OCR avant de
tout concevoir ? *(Je le recommande : ça valide le pari central — position #2 — sur du réel.)*

---

## 5. Questions de conception (avec ma reco) — on tranche ensemble

> Format : **Options → Reco → Pourquoi → Risque.** Tu valides ou tu corriges.

**Q1 — Modèle économique.** Bonzini est-il (a) **agent d'achat à commission** (prend une marge sur
la marchandise, possède la relation, porte un risque qualité/délai) ; (b) **simple facilitateur**
(le client possède tout, Bonzini ne fait que payer + tracer) ; (c) **hybride** (commission sur
certains clients, facilitation sur d'autres) ?
**Reco : (a) modélisé pour permettre (c).** *Pourquoi :* l'histoire de mai 2026 (père qui négocie
en usine) EST du comportement d'agent ; et la transparence marge interne demandée n'a de sens que
si la marge existe. *Risque :* si en réalité c'est juste de la facilitation, on a sur-modélisé la
commission (coût faible, additif).

**Q2 — Modèle fournisseur : partagé ou par-client ?**
**Reco : annuaire partagé (identité/contacts/catégorie/historique qualité) + relations & prix par
client-mission.** *Pourquoi :* scale 1→1000 sans refonte, dédoublonnage, signalement qualité
transverse. *Risque :* fuite de prix entre clients → mitigé en gardant les **termes commerciaux
privés par relation**, seule l'identité étant partagée.

**Q3 — Paiements fournisseurs : rail ou autonome ?**
**Reco : enregistrement procurement autonome (attestation cash/Alipay/WeChat) qui *référence*
optionnellement un `payment` du rail.** *Pourquoi :* coller à la réalité mai 2026 (cash hors rail)
sans double-compter quand le rail est utilisé. *Risque :* deux sources de vérité d'argent → mitigé
par le lien `reference_id` + réconciliation.

**Q4 — IA : étendre Mola ou nouvel agent ?**
**Reco : étendre Mola** (mêmes mécanismes `@mola`/parité/mémoire/coût), avec **vision activée** et
**outils d'ingestion riches**, + éventuelle persona « centrale d'achat » pour le père.
*Pourquoi :* anti-réinvention, un seul cerveau, pas de fragmentation. *Risque :* charger Mola de
trop de capacités → mitigé par le filtrage par permission/rôle déjà en place.

**Q5 — Canal du père.** in-app mobile / **Telegram** (déjà branché) / WhatsApp Business API (payant,
Meta) / WeChat (pas d'API exploitable) ?
**Reco : in-app mobile (primaire) + Telegram (capture rapide & réception de rapports), WeChat reste
pour les fournisseurs, plateforme = système de référence.** *Pourquoi :* réutilise l'existant, évite
l'infaisable WeChat. *Risque :* le père doit avoir Telegram accessible en Chine (VPN) → à confirmer
(Q-bloquante #4).

**Q6 — Transparence de la marge.** Le client voit-il la commission/remise de Bonzini ?
**Reco : deux couches — le client voit un « frais de service » convenu ; l'interne voit la marge
complète (remise négociée + markup).** *Pourquoi :* transparence client ≠ exposer toute ta marge.
*Risque :* tension éthique/commerciale → **c'est ta décision business, pas la mienne.**

**Q7 — Granularité du reporting.** Le brief veut « répondre à toute question / tout problème à la
demande ». **Reco : granularité ligne-de-commande** (chaque produit/SKU d'une PO traçable
individuellement : payé/dû, produit/QC/expédié). *Pourquoi :* c'est le niveau où naissent les
litiges (« la 3ᵉ palette de fenêtres est non conforme »). *Risque :* saisie plus lourde → repoussée
sur l'ingestion IA (position #2).

---

## 6. Questions bloquantes (faits métier que je ne peux pas deviner)

Je ne lance pas la Phase 1 à l'aveugle sur ces points — ce sont des **faits**, pas des arbitrages :

1. **🔴 Relation commerciale réelle avec le client de mai 2026** : commission en % ? forfait ?
   markup sur marchandise ? Qui détient le titre de propriété des biens ? (→ détermine Q1 et la P&L.)
2. **🔴 Les acomptes de mai 2026 ont-ils transité par le wallet Bonzini, ou le client a-t-il payé
   les usines directement, le père facilitant ?** (→ détermine Q3 et le modèle d'argent.)
3. **🔴 Inventaire réel des pièces de mai 2026** : combien de fournisseurs documentés, sous quelle
   forme (photos floues ? PDFs ? captures WeChat ? rien d'écrit, juste la mémoire du père ?), en
   quelle langue (中文 / FR / EN) ? (→ dimensionne le catch-up Lot 1 et le pari OCR.)
4. **🔴 Le terrain du père** : téléphone (Android/iPhone) ? Telegram/WhatsApp accessibles en Chine
   (VPN) ? Qualité data en usine ? Saisit-il pendant la visite ou le soir à l'hôtel ? (→ contraint
   toute l'UX terrain.)
5. **🔴 Utilisateurs du module** : aujourd'hui père + toi seulement ? Des recrues ops prévues ?
   Le client a-t-il un accès en lecture à *son* reporting, ou tout passe par vous ? (→ rôles & RLS.)

---

## 7. Coût — ce qu'on sait déjà (baseline)

| Poste | Référence | Ordre de grandeur |
|---|---|---|
| Inférence agent (Q&A + ingestion texte) | Mola, Sonnet 4.6, cache outils | ~1-4 ¢/conversation |
| **Vision/OCR** (le poste nouveau) | tokens image Sonnet | 🔴 **à mesurer en Phase 3** (anticipé : quelques ¢/document selon résolution) |
| Stockage documents | buckets Supabase (déjà payés) | marginal ; gros si scans HD volumineux → politique de compression à définir |
| Embeddings RAG procurement | gte-small (Supabase.ai) | ~1-5 $/mois |
| Infra | reste dans l'edge + Postgres existants | **0 $** marginal |

Chiffrage fin **par décision** à partir de la Phase 2 (chaque table/RPC/écran) et surtout Phase 3
(le poste OCR, qui peut déraper si on envoie des scans pleine résolution sans contrôle).

---

## 8. Auto-contrôle Phase 0

- ✅ **Lecture seule respectée** : aucun code applicatif ; seuls des fichiers de doc créés (demandé
  par la persistance externe).
- ✅ **Pas de saut de phase** : aucun design détaillé ; l'apprentissage domaine est réservé Phase 1.
- ✅ **Diagnostic de l'existant fait, pas survolé** : Mola (architecture + 6 modes d'échec
  documentés), schéma (28 tables, réutilisable vs manquant), méthodologie maison, canaux, coût —
  tout `fichier:ligne`.
- ✅ **Anti-réinvention interne** : repéré les 2 modules adjacents (trésorerie, bénéficiaires) et le
  mécanisme `@mola` à réutiliser plutôt qu'un nouvel agent.
- ✅ **Persona père** : posé comme #1, et la position #2 (ingestion d'abord) en découle directement.
- ✅ **Cash sans reçu** : traité (position #4, attestation autonome).
- ✅ **Documents hétérogènes** : traités (position #2 + bucket sur pattern existant).
- ✅ **Audit trail** : couvert (position #6 append-only + `admin_audit_logs` réutilisé).
- ✅ **IA en couche, héritée de Mola sans ses bugs** : table P0-A→P2-B + vision à réactiver.
- ✅ **Coût** : baseline chiffrée, poste OCR identifié comme à mesurer.
- ✅ **Catch-up mai 2026** : explicitement placé en Lot 1 (Phase 5) + POC ingestion proposé.
- ✅ **`fichier:ligne` + confiance** : systématiques.
- ⏳ **En attente** : tes réponses aux **Q1-Q7**, aux **5 questions bloquantes**, et aux **décisions
  de workflow Q-WF** → puis je lance la **Phase 1 (apprentissage du domaine)**.
