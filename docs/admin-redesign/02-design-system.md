# Bonzini Admin — Design System v1 (desktop)

> Fondation visuelle de la refonte desktop. Architecture de tokens reprise du kit
> Figma « Simple Design System » (SDS, open-sourcé par Figma : primitives →
> tokens sémantiques), rebrandée Bonzini. Source d'implémentation de référence :
> `docs/admin-redesign/mockups/bonzini-admin.css`.

## Tokens

### Couleurs — primitives
| Échelle | Valeurs clés |
|---|---|
| `violet` (marque, logo `hsl(258 100% 60%)`) | 50 `#F6F4FE` · 100 `#EDE8FD` · 400 `#9C7BF2` · **600 `#6B33E5` (primaire)** · 700 `#5A26C8` · 800 `#48209E` |
| `neutral` (froid, légère teinte violette) | 0 `#FFF` · 25 `#FBFBFC` · 50 `#F7F7F9` (fond page) · 100 `#F0F0F4` · 200 `#E6E6EC` (bordure) · 400 `#A6A6B3` · 600 `#5D5D69` · 900 `#1B1B22` |
| statuts | green 500 `#12B76A`/700 `#067647` · amber 600 `#DC8A0E`/800 `#8F5A08` · blue 500 `#3E74E8`/700 `#1D4FBF` · red 500 `#E5484D`/700 `#C1272D` (+ fonds 50) |
| triade logo | violet 600 · amber `#F5A623` · orange `#F5551B` — **micro-accents uniquement** (logo, ping notification, alerte SLA) |

### Couleurs — sémantiques
`--bg-page/surface/subtle/hover/selected/brand` · `--border-default/strong/brand` ·
`--text-primary/secondary/tertiary/disabled/brand/on-brand`. Les composants ne
consomment **que** les tokens sémantiques — jamais une primitive, jamais un hex.

### Mapping statuts (source de vérité unique)
| Tone | Dépôts | Paiements |
|---|---|---|
| `success` (vert) | `validated` | `completed` |
| `pending` (ambre) | `created`, `awaiting_proof`, `pending_correction` | `created`, `waiting_beneficiary_info`, `cash_pending` |
| `info` (bleu) | `proof_submitted`, `admin_review` | `ready_for_payment`, `processing`, `cash_scanned` |
| `danger` (rouge) | `rejected` | `rejected` |
| `neutral` (gris) | `cancelled`, `cancelled_by_admin` | `cancelled_by_admin` |

L'urgence SLA est un canal séparé (point 6 px : vert < 2 h, ambre < 8 h, rouge au-delà
— paiements : 4 h / 12 h), jamais mélangée à la couleur de statut.

### Typographie
- **Inter** partout (UI + données), `JetBrains Mono` pour les références `BZ-…`.
- Corps de table **13 px**, formulaires 14 px, labels/méta 11-12 px
  (uppercase + tracking pour les en-têtes de colonnes/sections), titre de page 20 px/650.
- **`font-variant-numeric: tabular-nums` obligatoire** sur tout montant, compteur,
  horodatage. Montants : semibold, alignés à droite, devise en suffixe atténué
  (`7 800 000 XAF`).

### Géométrie
- Espacement : échelle 4 px. Rayons : **6 px** (contrôles), **10 px** (cartes),
  **14 px** (panneaux/modales). Ombres : 3 niveaux discrets + 1 overlay.
- Hauteurs : lignes de table 46 px, inputs/boutons 34-36 px, boutons larges 40 px.

## Patterns desktop

1. **Shell** : sidebar claire 224 px (groupes Principal/Opérations/Système, item actif
   violet-100, badges de file ambre) + topbar 52 px (fil d'Ariane, recherche ⌘K,
   chip taux du jour, notifications).
2. **Listes = tables**, pagination **serveur** (25 par défaut), tri par colonnes,
   recherche **serveur** débouncée, filtres persistés dans l'URL. KPI cliquables
   au-dessus (file d'attente, pas de vanity metrics).
3. **Fiche = slide-over 660 px** au-dessus de la liste (triage : ouvrir → décider →
   suivant), URL dédiée, bouton « ouvrir en pleine page ». Structure : header
   (réf + statut + fermer/étendre) → bande montant/portefeuille → **preuves d'abord**
   (grandes vignettes) → informations (grille clé/valeur) → chronologie visible →
   footer sticky d'actions (danger à gauche, primaire à droite).
4. **Création = une page** : sections numérotées (Client → Montant → Méthode →
   Détails optionnels) + **récapitulatif sticky** à droite avec solde projeté et CTA.
   Toute action d'argent passe par une confirmation explicite (mêmes exigences que
   la convention `@mola confirm:true`).
5. **Plus de BottomSheet sur desktop** : confirmations = `Dialog` centré ; actions
   secondaires = menu `⋯`.
6. Accessibilité : `role`/`aria` corrects sur lignes cliquables, switches, groupes
   radio ; focus visibles ; `prefers-reduced-motion` respecté.

## Règles d'implémentation

- Nouveau code UI admin desktop : composants dédiés (pas de réutilisation des écrans
  mobiles), stylés **exclusivement** via les tokens.
- Interdit : hex en dur, classes arbitraires `bg-[#…]`, `BottomSheet` desktop,
  wizard multi-étapes pour des formulaires < 10 champs.
- Chaque montant manipulé : `Number.isSafeInteger` + cap 50 M via
  `src/lib/amountLimits.ts` (jamais de constantes locales).
- Toute requête admin : `supabaseAdmin` ; clés react-query : factories de
  `src/lib/queryKeys.ts` (à réconcilier avec le realtime).
