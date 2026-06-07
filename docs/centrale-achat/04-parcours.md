# Phase 4 — Parcours & UX terrain

> **Statut : rendu (révisé après retour produit), en attente de validation.** Parcours (père sur le
> terrain + toi en admin) et **jeu d'écrans**. Décisions : **pas d'écran assistant dédié** (assistant
> Mola général), **in-app only** (pas de Telegram), **saisie manuelle** (formulaires) **ou dictée à
> Mola** — **aucune analyse de document**, les **photos sont des preuves**. Wireframes textuels. Aucun code.
>
> **Ancrages 🟢 :** shell `src/mobile/components/MobileRouteWrapper.tsx` → `MobileAppShell` (tab bar) ;
> écrans `src/mobile/screens/` ; modèle = trésorerie (`src/mobile/screens/treasury/*`) ; upload
> résilient `src/lib/storageUpload.ts`.
>
> **Légende :** 🟢 vérifié · 🟡 design proposé · 🔴 à confirmer.

---

## 1. Principe UX — « formulaires OU dictée pour saisir, écrans pour consulter »

| Surface | Rôle | Qui |
|---|---|---|
| **Formulaires procurement** | **Saisir manuellement** les infos clés (montant facture, acompte, commission, devise, date) + joindre une photo-preuve | père + toi |
| **Assistant Mola (existant)** | **Saisir en dictant** les mêmes valeurs (« enregistre pour tel fournisseur… ») et **demander** (« reste à payer ? », « génère le rapport ») — **sans analyser aucun document** | père surtout |
| **Écrans de consultation** | **Naviguer** : control tower, mission 360, fournisseur 360, commande ; **déclencher un rapport** | père + toi |

Deux canaux de **saisie** (formulaire / dictée), mêmes enregistrements. Les écrans de consultation
donnent ce que le chat fait mal : **la vue d'ensemble navigable** (30+ fournisseurs).

**Mobile-first & terrain** (persona #1) : gros boutons, **formulaires courts + dictée** comme entrées
primaires, **caméra = preuve jointe (jamais analysée)**, **tolérance réseau** (file d'attente upload +
retry via `storageUpload.ts`), **saisie en lot le soir** possible (back-dating natif `occurred_at`).

---

## 2. Les parcours clés (wireframes textuels)

### P1 — Enregistrer un achat (le geste central) 🟡

**Deux façons, au choix.** Photo = preuve optionnelle jointe, **pas** une source de données.

**(a) Par formulaire :**
```
┌──────────────────────────────────────┐
│ ← Nouvel achat            Mission ▼    │
├──────────────────────────────────────┤
│ Fournisseur *   [🔍 Meidi / + nouveau] │
│ Montant facture * [120 000]  Devise[¥] │
│ Acompte           [36 000]  Mode[cash] │
│ Date              [14/05/2026]         │
│ Commission   [5 %] ⇄ [montant 6 000]   │  ← double-mode (% ou montant)
│ 📎 Photo (preuve, facultatif) [+]      │  ← stockée, NON analysée
│ [Annuler]              [✓ Enregistrer] │
└──────────────────────────────────────┘
```

**(b) En dictant à Mola :**
```
 Père : « Mola, pour Meidi : facture ¥120 000, acompte ¥36 000 cash le 14/05, commission 5%. »
   ▼ Mola structure les VALEURS DONNÉES (aucune analyse de doc) → carte de confirmation
 ┌────────────────────────────────────────────┐
 │ • Fournisseur Meidi (美的家具) 🆕             │
 │ • Commande BZ-PO-… : ¥120 000                │
 │ • Acompte ¥36 000 (cash, 14/05) attestation  │
 │ • Commission 5% → ¥6 000                      │
 │ [Modifier]            [✓ Confirmer]          │
 └────────────────────────────────────────────┘
   ▼ tap → RPC @mola + audit · « ✓ Reste à payer : ¥84 000. »
```
- Champ monétaire = **confirmation/validation humaine** (c'est *le* moyen de vérifier). Fournisseur
  inconnu → proposé à la création. Mola **demande** si une info manque, **n'invente** rien.

### P2 — Catch-up mai 2026 (saisie manuelle, par fournisseur) 🟡

Pas d'auto-structuration. On reprend **fournisseur par fournisseur** : pour chacun, on crée la
commande + les acomptes + la commission (formulaire ou dictée), **rétro-datés** (`occurred_at`), et
on **joint les photos** (factures, reçus, captures WeChat) comme preuves. Plus lent qu'un OCR, mais
**chaque chiffre est vérifié** — exactement l'objectif. Une checklist « fournisseurs saisis / restants »
aide à ne rien oublier.

### P3 — Control tower (accueil procurement) 🟡

```
┌──────────────────────────────────────┐
│ Centrale d'achat        [Mission ▼]   │
├──────────────────────────────────────┤
│ ━━ MISSIONS ACTIVES ━━                │
│ • Cameroun-Guangzhou mai 2026         │
│   9 fournisseurs · reste ¥420 000     │
│ ━━ ALERTES ━━                         │
│ 🔴 2 QC non faits > 7 j               │
│ 🟠 1 fournisseur en retard production │
│ ━━ ARGENT ━━                          │
│ Reste à payer global : ¥420 000       │
│ Marge Bonzini (mission) : … (interne) │
│ [+ Nouvel achat]   [📄 Rapport]       │
└──────────────────────────────────────┘
```

### P4 — Mission 360 🟡

```
┌──────────────────────────────────────┐
│ ← Mission Cameroun-Guangzhou mai 2026 │
│   BZ-MS-2026-0001 · 14–28/05 · actif  │
├──────────────────────────────────────┤
│ Reste à payer : ¥420 000 · 9 fourn.   │
│ 美的家具  ¥120k · payé 36k · prod 🟢    │
│ 广州门窗  ¥85k  · payé 85k · QC ⏳      │
│ … (7)                                 │
│ [📄 Rapport mission]  [+ Commande]    │
└──────────────────────────────────────┘
```

### P5 — Fournisseur 360 🟡

```
┌──────────────────────────────────────┐
│ ← 美的家具 (Meidi)        ✅ visité     │
│   Usine · Foshan · meubles · WeChat:… │
├──────────────────────────────────────┤
│ Scorecard : 92% à l'heure · 1 défaut  │
│ COMMANDES  BZ-PO-0007 ¥120k reste 84k │
│ PAIEMENTS  ¥36 000 (cash, 14/05)      │
│ QC         PSI ⏳ pas fait             │
│ DOCUMENTS  facture, reçu (2 preuves)  │
│ HISTORIQUE (autres missions…)         │
└──────────────────────────────────────┘
```
Identité partagée org-wide ; prix affichés = ceux de **cette** mission/ce client.

### P6 — Commande (PO) + paiement du solde (gate souple) 🟡

```
 [PO BZ-PO-0007] total ¥120k · acompte 30% · FOB · reste ¥84k
 Lignes : chaises bureau ×200 @ ¥600 (HS 9401…)
 Prod : en fabrication 🟢   QC : PSI non fait ⏳
 [+ Paiement]  (le père veut payer le solde ¥84k)
   ▼ ⚠️ « QC pré-expédition non validé. Payer le solde quand même ? Motif : ____ »
 [Annuler]                         [Payer avec justification]
```
Gate **souple** (validé) : alerte + motif obligatoire, pas de blocage dur.

### P7 — Rapport 🟡

`[📄 Rapport mission]` → `proc_mission_report` → `generate-report-pdf` → aperçu PDF (par
fournisseur/commande/paiement/QC, granularité ligne) → **[Partager]** WhatsApp/email natif (pas de
portail client au MVP).

### P8 — Q&A ad hoc (assistant) 🟡

« reste à payer au fournisseur 广州门窗 ? » · « QC en retard > 7 j ? » · « paiements cash de la mission
mai » → outils `@mola` lecture → réponse chiffrée + lien vers l'écran 360.

---

## 3. Jeu d'écrans & implantation 🟡

| Écran | Fichier cible (miroir trésorerie) | Permission |
|---|---|---|
| Control tower | `src/mobile/screens/procurement/MobileProcurementHome.tsx` | `canViewProcurement` |
| Missions liste + 360 | `…/MobileMissions*.tsx` | `canViewProcurement` |
| Fournisseurs liste (partagée) + 360 | `…/MobileSuppliers*.tsx` | `canViewProcurement` |
| Commande (PO) détail | `…/MobilePurchaseOrderDetail.tsx` | `canViewProcurement` |
| **Formulaires saisie** (achat, paiement, QC, fournisseur) | `…/MobileNew*.tsx` | `canManageProcurement` |

- **Les formulaires sont un canal de saisie de premier rang** (pas un simple fallback) : ils **sont**
  le moyen de vérifier en saisissant. La dictée à Mola est l'alternative rapide.
- **Entrée tab bar / Plus** : « Centrale d'achat » (si `canViewProcurement`), route `/m/procurement`
  (comme la trésorerie).

---

## 4. Tolérance terrain (réseau / offline) 🟡

- **Upload photo-preuve résilient** : `storageUpload.ts` (retry, idempotent) + file d'attente
  hors-ligne.
- **Back-dating natif** (`occurred_at`) → saisie le soir à l'hôtel sans fausser les dates.
- 🔴 *Offline complet (PWA) = hors MVP* sauf si réseau usine inutilisable (dépend du « terrain du
  père », toujours ouverte).

---

## 5. Questions à trancher avant la Phase 5

1. 🔴 **Canaux de saisie au MVP** : formulaires **et** dictée à Mola dès le départ (reco), ou
   formulaires d'abord + dictée juste après ?
2. 🔴 **Ampleur des écrans** : le jeu ci-dessus (control tower + missions + fournisseurs + PO +
   formulaires) te va, ou plus léger ? *Reco : ce jeu — la navigation 360° le justifie.*
3. 🔴 **Terrain du père** (toujours ouverte) : réseau en usine ? saisie pendant/après la visite ? →
   décide l'investissement offline.
4. 🔴 **Photo-preuve** : exigée pour un paiement (audit) ou optionnelle ? *Reco : optionnelle mais
   encouragée.*

---

## Auto-contrôle Phase 4 (révisé)

- ✅ **Aligné produit** : saisie manuelle (formulaires) **ou** dictée à Mola ; **aucune analyse de
   doc** ; photos = preuves jointes.
- ✅ **Persona père** : geste central = saisir/dicter les vraies valeurs ; back-dating ; tolérance
   réseau.
- ✅ **Cash sans reçu** : photo-preuve optionnelle ; attestation autonome.
- ✅ **Vue 360°** : control tower + mission/fournisseur/commande ; granularité ligne au rapport.
- ✅ **Réutilise l'existant** : shell mobile, pattern écrans trésorerie, `storageUpload`, tab bar,
   `generate-report-pdf` ; in-app only.
- ✅ **Pas de code** ; wireframes textuels.
- ⏳ **En attente** : réponses §5 → puis **Phase 5 (plan d'implémentation par lots, catch-up mai 2026
   en Lot 1)**.
