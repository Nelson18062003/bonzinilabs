# Phase B livrée — Implémentation React de la refonte UI/UX chat

Suite à la validation du mockup v3 ("GO Phase B"), j'ai implémenté la refonte
dans les vrais composants React. Tout le code v1 a été remplacé directement
(pas de `v2/` parallèle) — au merge de cette branche, la nouvelle UI sera
en prod sans manipulation supplémentaire.

## Ce qui a été refait (15 fichiers)

### Composants UI
- **`MessageBubble.tsx`** : tint léger pour bulle envoyée (vs solide), padding compact (10px), line-height 1.42, queue uniquement sur la dernière bulle d'une séquence, fade-in via Framer Motion
- **`MessageInput.tsx`** : refonte complète — pill layout WhatsApp-style, voice recording **INLINE** (plus d'overlay), bouton micro/envoi swappable, KeyboardSafeArea via `useKeyboardHeight()`, reply preview en slide-down Framer
- **`VoiceRecorder.tsx`** : **réécriture totale** pour mode inline. Le composant rend le bouton micro à droite, et appelle `renderInline()` pour rendre l'UI de l'enregistrement dans la zone centrale (à la place du textarea). 3 sous-états supportés : recording → cancel-armed → locked (mains-libres). Slide vers la gauche pour annuler, slide vers le haut pour verrouiller. Vibration haptique.
- **`VoiceRecorderInline`** (exporté du même fichier) : l'UI inline pendant l'enregistrement — rec-dot rouge pulsant + timer + hint "slide to cancel" + en mode locked : bouton trash gauche + bouton send droit
- **`ChatThread.tsx`** : background off-white (`hsl(30 8% 96%)`) sobre, calcul `isLastInGroup` pour la queue des bulles, séparateurs de dates centrés discrets
- **`EmptyChatState.tsx`** : illustration mono-couleur mono-ligne (88px, fini les gradients 3-couleurs), copy concis, quick replies en cartes blanches sobres
- **`ResponseTimeBadge.tsx`** : chip neutre gris uniforme (plus de variation vert/ambre/orange selon vitesse)
- **`ReadReceiptIndicator.tsx`** : juste l'icône check/double-check, plus de texte "Envoyé/Vu" qui prend de la place
- **`FileMessage.tsx`** : **icône grise uniforme** pour tous les types de fichier (plus de rouge PDF / vert XLS / bleu DOC)
- **`HighlightedSnippet.tsx`** : surlignage **violet light** au lieu du jaune ambre criard
- **`ReactionPills.tsx`** : pills neutres (border + fond blanc), tint violet uniquement quand "ma" réaction
- **`QuotedMessage.tsx`** : design conforme au mockup (barre verticale violet, fond muted/40)
- **`DateSeparator.tsx`** : pill central avec hairline (vs blob coloré)

### Pages
- **`SupportPage.tsx`** : Layout `h-[100dvh] flex-col` fixe, header custom (plus de MobileLayout wrapper qui ajoutait nav + sidebar), background chat off-white, avatar B violet
- **`MobileSupportConversationScreen.tsx`** : Layout pareil, header avec badge "À vous" / claim button / menu ⋮, modal d'assignation animée Framer

### Config
- **`index.html`** : ajout du critical `interactive-widget=resizes-content` au viewport meta (fix du bug clavier sur iOS 16.4+ / Chrome 108+)

## Fix des 3 bugs critiques

### Bug clavier (le plus important)
**Méta viewport** : `interactive-widget=resizes-content` → iOS Safari 16.4+ et Chrome 108+ resize le layout viewport quand le clavier s'ouvre, donc l'input bar sticky en `padding-bottom: env(safe-area-inset-bottom)` reste visible naturellement.

**Fallback pour iOS Safari < 16.4** : le `MessageInput` utilise `useKeyboardHeight()` (déjà dans la codebase) qui mesure la différence `window.innerHeight - visualViewport.height` et applique un `paddingBottom` dynamique. La transition est animée à 220ms.

**Le `KeyboardFocusManager` (monté globalement dans App.tsx)** : déjà actif, fournit auto-scroll au focus pour iOS.

Combiné : input toujours visible, aucune action utilisateur requise.

### Bug "Hello" sur 2 lignes
**Avant** : `py-1.5` (12px) + `py-1` (8px) empilés = 20px padding + `leading-snug` (1.275). Pas d'espace horizontal restant pour "Hello".
**Maintenant** : `py-1.5` simple (6px total) + `leading-[1.42]` + `tracking-[-0.005em]`. "Hello" tient sur 1 ligne nativement.

### Bug layout petits écrans
- Tous les conteneurs flex ont `min-w-0` sur les enfants flex-1 (évite débordement)
- Icon buttons standardisés à 36-40px (touch target accessibility minimum)
- Plus de `gap-2` excessif sur petits écrans

## Implémentations clés Framer Motion

- **Bubble entrance** : `initial={{ opacity: 0, y: 6 }}` → `animate={{ opacity: 1, y: 0 }}`, 220ms ease custom
- **Reply preview** : `height: 0 → auto` + opacity, slide-down naturel à la apparition
- **Attach menu popover** : fade + slide vertical
- **Reaction pills** : `whileTap={{ scale: 0.92 }}` pour feedback
- **Send button** : `whileTap` + rotation -12deg statique (look "avion qui décolle")
- **Voice mic button** :
  - Pulse animé (`scale: 1 → 1.6, opacity: 0.6 → 0`, infinite) pendant l'enregistrement
  - Couleur switch violet → rouge quand cancel-armed
- **Assignation modal** : `y: 40 → 0` slide-up + backdrop fade
- **Menu ⋮ admin** : fade + slight slide vertical

## Voice recording — comportement final

```
[+] [   Tape ici...   ] [🎤]   ← idle
         ↓ press long sur 🎤
[  🔴 0:03 ← Glissez pour annuler  🔒  ] [🎤 rouge pulsant] ← recording
         ↓ slide gauche au-delà de 80px
[  🔴 0:05  Relâchez pour annuler       ] [🎤 rouge]      ← cancel-armed
         ↓ slide haut au-delà de 60px
[ 🗑  🔴 0:07  Enregistrement verrouillé  📤 ]              ← locked (mains-libres)
```

Quand l'utilisateur relâche son doigt :
- Pas en cancel-armed et pas locked → envoi immédiat
- Cancel-armed → annulation, blob jeté
- Locked → reste en enregistrement, utilisateur clique 📤 quand prêt ou 🗑 pour annuler

## Validations

- `npm run type-check` ✅ clean
- `npm run build` ✅ 43s
- `npm run lint` ✅ 0 erreur/warning sur mon code (122 pré-existants intacts)

## Tests à faire (toi, sur device réel)

Une fois la branche déployée :

1. **Bug clavier** : ouvre `/support/[id]` sur iPhone Safari, tape sur l'input → vérifie qu'il reste visible. Pareil sur Android Chrome.
2. **"Hello" 1 ligne** : envoie le mot "Hello" → vérifie qu'il tient sur 1 ligne dans la bulle.
3. **Voice recording WhatsApp-style** : ouvre une conversation, appui long sur le micro à droite. Le textarea doit disparaître et être remplacé inline par le timer + hint. Relâche → ça envoie. Slide à gauche pendant l'appui → ça annule.
4. **Direction visuelle** : tu reconnais bien Bonzini (violet sur quelques moments clés) mais le reste est neutre. Plus de "arc-en-ciel IA".
5. **Multi-thread** : `/support` (liste) → tap une conv → arrive sur `/support/:id`. Bouton back → revient à la liste.

## Fichiers modifiés (récap)

```
M  index.html
M  src/i18n/locales/{fr,en,zh}/support.json
M  src/components/support/MessageBubble.tsx
M  src/components/support/MessageInput.tsx
M  src/components/support/VoiceRecorder.tsx
M  src/components/support/ChatThread.tsx
M  src/components/support/EmptyChatState.tsx
M  src/components/support/ResponseTimeBadge.tsx
M  src/components/support/ReadReceiptIndicator.tsx
M  src/components/support/FileMessage.tsx
M  src/components/support/HighlightedSnippet.tsx
M  src/components/support/ReactionPills.tsx
M  src/components/support/QuotedMessage.tsx
M  src/components/support/DateSeparator.tsx
M  src/pages/SupportPage.tsx
M  src/mobile/screens/support/MobileSupportConversationScreen.tsx
```

15 fichiers, ~1500 lignes refactorisées. Aucune migration SQL nécessaire. Aucune Edge Function à mettre à jour.
