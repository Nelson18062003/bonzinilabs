# Lot 3 — Design thinking (carnet client) — application du framework `/frontend-design`

> Le skill `/frontend-design` n'est pas exposé comme outil dans cet environnement ; j'en applique
> le cadre **explicitement** ici avant d'écrire le moindre composant (exigence CLAUDE.md).

## 1. Intention & utilisateur
- **Qui** : importateur africain (CEMAC), mobile bas/milieu de gamme, 3G/4G fluctuant, data chère.
- **Job-to-be-done** : retrouver/réutiliser **en 1 geste** un destinataire chinois dont les infos
  réelles sont **illisibles** (chinois) → l'**alias latin** est le héros visuel.
- **Émotion cible** : confiance (argent), rapidité, « je reconnais mon contact d'un coup d'œil ».

## 2. Anti-générique (ce qu'on évite)
- Pas de liste grise uniforme : chaque item est **ancré par la couleur du mode** (bleu/vert/violet/
  rouge) → lecture par canal, pas par texte.
- Pas d'avatar photo (inexistant) : **pastille colorée + initiale de l'alias** (repère humain).
- Pas de modale lourde pour ajouter : **plein écran par étapes** (cohérent avec le wizard paiement
  déjà en place), une seule colonne, gros tap targets (mobile-first).

## 3. Hiérarchie visuelle d'un item (liste)
```
[ ● A ]  Alias en gras (titre)                    [badge mode coloré]
         identifiant / nom réel CJK (sous-titre, tronqué ellipsis)
```
- Titre = `alias` (latin, lisible). Sous-titre = identifiant ou `name` (peut être 张伟).
- Badge mode = pastille couleur + label court. Tri `updated_at` desc.

## 4. Structure des écrans
- **Liste** (`/beneficiaries`) : header + **recherche** + **filtre segmenté par mode** (Tous /
  Alipay / WeChat / Virement / Cash) + liste + FAB « + ».
- **Ajout/Édition** : sous-écran — choix mode (si ajout) → **alias en tête** → champs du mode (spec
  Lot 0) → validation Zod dure (CTA désactivé tant qu'incomplet) → anti-doublon (offre l'existant)
  → save.
- **Archiver** : modale de confirmation + **bandeau snapshot** « vos paiements ne changent pas ».

## 5. États (jamais d'écran nu)
- **Vide** (aucun bénéficiaire) : icône + phrase + CTA « Ajouter ».
- **Vide après filtre** : « Aucun résultat pour ce mode/recherche ».
- **Chargement** : skeleton léger (pas de spinner plein écran — réseau lent).
- **Erreur** : toast (déjà la convention via `sonner`).

## 6. CEMAC / perf
- Réutiliser `staleTime 30s` (cache react-query) + compression QR existante.
- Pas d'image lourde ; signed-URL QR uniquement au besoin.
- Saisie tolérante au **collage** (les coordonnées arrivent par WeChat/SMS), aucune regex de script.

## 7. Accessibilité / i18n
- Labels via `client:beneficiaries.*` (fr/en/zh déjà posés au Lot 0).
- Police CJK-safe (system-ui), troncature CSS, tap targets ≥ 44px.

→ Décisions figées. J'implémente en cohérence avec `MobileLayout` + `PageHeader` + Tailwind
(`rounded-xl border-2`, `bg-muted`, couleur mode inline), `lucide-react`, `react-i18next`.
