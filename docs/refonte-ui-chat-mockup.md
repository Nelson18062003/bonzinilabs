# Mockup UI/UX Chat — v3 (refonte sérieuse)

Suite à ton feedback ("trop de couleurs arc-en-ciel, effet IA, voice recording mauvais"), j'ai refait le mockup en profondeur.

## URL d'accès

```
https://[ton-app-url]/chat-mockup.html
```

Le fichier est dans `public/` donc déployé automatiquement à chaque push.

## Ce qui a changé vs v1

### Couleurs : drastiquement réduites
- **AVANT** : violet + ambre + orange utilisés partout (badges, illustrations, headers, accents). Effet "arc-en-ciel IA".
- **MAINTENANT** : **UNE seule couleur d'accent** = violet Bonzini, utilisée parcimonieusement :
  - Bulles envoyées (tint violet TRÈS léger, à la WhatsApp avec son vert mint)
  - Avatar de l'équipe (rond plein violet)
  - Bouton micro/envoi (FAB violet)
  - Status "À vous", read receipt vu, search highlight, CTAs clés
- **Tout le reste** : neutres (blanc, gris très clair, gris moyen, gris foncé)
- **Rouge** : uniquement pour le point recording
- **Vert** : uniquement pour le status dot "en ligne"
- **Pas d'ambre, pas d'orange** dans le chat

### Voice recording : INLINE comme WhatsApp (plus d'overlay)
- **AVANT** : tu appuies sur le micro → ça prend tout l'écran avec un overlay rouge plein largeur, avec waveform live. Mauvaise UX.
- **MAINTENANT** (scène 5) : la barre d'input se transforme **inline** :
  - `🔴 0:08    ← Glissez pour annuler    🔒 Verrouille    🎤`
  - Tout dans la même barre où était le textarea
  - Le micro reste à sa place (passe en rouge, pulse subtil)
  - 3 sous-états testables via toggle dans la scène : recording / cancel-armed / locked
- **Comportement attendu en React** (Phase B) :
  - Appui long sur micro → enregistre + bar passe inline
  - Slide à gauche → annule (au-delà de 80px de slide)
  - Slide en haut → verrouille (mode mains-libres avec bouton stop/envoyer)
  - Lever doigt sans slide → envoie immédiatement

### Empty state : épuré
- **AVANT** : illustration SVG avec 3 gradients violet/ambre/orange + petites bulles colorées partout
- **MAINTENANT** : icône monoligne mono-couleur (violet) avec un "B" centré. Simple, mémorable, premium.

### Headers : sans gradient
- **AVANT** : gradient violet→orange dans certains headers
- **MAINTENANT** : header blanc/clair uniforme avec hairline 1px en bas, avatar circulaire violet, c'est tout.

### Background du chat
- **AVANT** : pattern de petits points violet+ambre+orange à 4% d'opacité, busy
- **MAINTENANT** : off-white doux uniforme (`hsl(30 8% 96%)`), comme WhatsApp

### Quick replies
- **AVANT** : grosses cartes violettes avec emoji
- **MAINTENANT** : cartes blanches avec subtile bordure, icône grise minimaliste, libellé sobre

### Stats
- **AVANT** : 4 cards KPI avec icônes colorées (violet/ambre/orange)
- **MAINTENANT** : 4 cards KPI avec **icône grise uniforme**, valeur en noir, hint en gris. Charts en violet uniquement (avec opacités 100/75/50/30% pour la distribution).

### Bulles
- **AVANT** : gradient violet→violet-clair sur bulle envoyée, bordure visible sur bulle reçue
- **MAINTENANT** : bulle envoyée = **tint violet très léger** (`hsl(258 100% 97%)` quasi blanc avec teinte) + texte foncé. Bulle reçue = blanc pur avec ombre 1px. Queue (tail) uniquement sur la **dernière bulle d'une séquence**, pas toutes.

### Typographie
- **AVANT** : `leading-snug` (1.275) trop serré, padding `py-1.5` + `py-1` empilés
- **MAINTENANT** : `line-height 1.42` (sweet spot lisibilité), padding bulle `6px 10px`. Le mot "Hello" tient sur 1 ligne (vérifie scène 2).

## Les 10 scénarios à tester

| # | Scénario | Ce qu'il valide |
|---|---|---|
| 1 | Empty + Quick replies | Empty state épuré, illustration monoligne, quick replies neutres |
| 2 | Conv pleine | Bulles avec queue uniquement en bas de séquence, "Hello" sur 1 ligne |
| 3 | Avec reply | Preview du message cité, citation dans bulle, tout cohérent |
| 4 | Clavier ouvert ⚠️ | Active "⌨ Clavier" → input reste visible. Sur device : focus input → clavier natif → input visible. |
| 5 | **Voice recording INLINE** ⭐ | 3 sous-états togglables : recording / cancel-armed / locked. Tout reste dans la barre d'input. |
| 6 | Media | Image, voice (waveform), vidéo (poster + bouton play overlay), fichier (icône grise) |
| 7 | Liste convs client | Avatar violet plein pour non-lus, neutre sinon, badge violet compact |
| 8 | Admin actions | Badge "À vous" en pill violet, menu ⋮ en haut à droite, bouton templates dans la pill input |
| 9 | Admin liste | SearchField clean, snippets surlignés en violet light + texte violet (au lieu de jaune ambre), chips noires |
| 10 | Stats | KPI cards monochromes, line chart violet, distribution en dégradé d'opacité, top admins barres simples |

## Décisions techniques pour Phase B (implémentation React)

Quand tu valides le mockup, l'implémentation React utilisera :
- **Framer Motion** pour :
  - `<AnimatePresence>` sur bulles (fade-in + slide-up)
  - Gesture `drag` pour swipe-to-cancel sur voice recording (avec spring back animation)
  - Transition entre les 3 états du voice recorder (recording → cancel-armed → locked)
  - Subtle layout animations sur la barre d'input quand elle change de mode
- **CSS uniquement** pour :
  - Transitions d'état simple (hover, active, focus)
  - L'animation rec-blink du point rouge
  - Le pulse du bouton micro pendant recording
- **`KeyboardSafeArea`** (déjà dans la codebase) sur les 2 pages chat (client + admin)
- **`useKeyboardHeight`** (déjà dans la codebase) en fallback iOS Safari < 16.4
- **Hook custom `useVoiceRecorderGesture`** : encapsule touchstart/touchmove/touchend + état recording/cancel/locked + appel `MediaRecorder` réel
- Composants v2 dans `src/components/support/v2/` (pas de breaking change pendant le dev)
- Migration progressive des imports une fois v2 stable

## Checklist de validation

### Bugs critiques
- [ ] Clavier (scène 4) : input bar reste visible sur device réel iOS + Android
- [ ] "Hello" (scène 2) : tient sur 1 seule ligne
- [ ] Layout petit écran (320px) : aucun débordement

### Direction visuelle
- [ ] Ressemble plus à WhatsApp / Signal qu'à un "site IA arc-en-ciel"
- [ ] Identité Bonzini présente mais discrète (violet pour les moments clés uniquement)
- [ ] Pas d'effet "trop de couleurs"
- [ ] Premium, épuré, calme

### Voice recording (scène 5)
- [ ] L'enregistrement reste **dans la barre d'input**, pas d'overlay plein écran
- [ ] Le micro reste en place (juste pulse en rouge)
- [ ] Toggle entre 3 sous-états fonctionne
- [ ] Comportement attendu réel : appui long → enregistre → relâche → envoie. Slide à gauche → annule.

### Si tu valides
Réponds-moi **"GO Phase B"** → je code les vrais composants React (avec Framer Motion, KeyboardSafeArea, gesture handlers), tests sur device réel, migration progressive de la v1.

### Si tu veux encore ajuster
Décris ce que tu veux changer (couleurs, layout, copy, etc.) et j'itère sur le HTML. Itération illimitée avant React.

### Si la direction visuelle ne convient toujours pas
On retourne en plan mode pour explorer une autre direction (style Signal ultra-sobre / iMessage minimaliste / autre).
