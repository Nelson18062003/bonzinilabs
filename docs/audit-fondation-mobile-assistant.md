# Chantier fondation mobile — Audit & architecture (focus Assistant)

> **Nature** : ce n'est pas un bug fix. C'est un audit de *qualité d'exécution* qui remonte à
> la cause racine **architecturale** de l'instabilité mobile, en partant du module Assistant
> (chat directeur d'opération) et en posant des principes **généralisables à toute la plateforme**.
>
> **Méthode** : lecture seule du code réel + vérification des APIs web sur caniuse/MDN
> (anti-hallucination). Aucune conclusion n'est tirée d'une intuition non vérifiée.
>
> **Plan de chantier (une phase à la fois)** :
> - **Phase 1 — Diagnostic / cause racine** ← *ce document* (lecture seule) ✅
> - **Phase 2 — Benchmark** des références (ChatGPT, Claude.ai, Linear, Vercel) — observation
> - **Phase 3 — Architecture cible** : app-shell, scroll containers, design tokens layout
> - **Phase 4 — Plan de remédiation** détaillé + procédures de test sur device réel
> - **Phase 5 — Implémentation** (Assistant d'abord, puis généralisation) — *écriture*
>
> **Légende confiance** : 🟢 haute · 🟡 modérée · 🔴 hypothèse à valider sur device.

---

## 0. TL;DR — la conclusion en cinq phrases

1. **Ton hypothèse de départ est fausse pour ce codebase.** `dvh`/`svh`/`lvh`, `visualViewport`
   et `env(safe-area-inset-*)` sont **déjà présents partout**. Le problème n'est pas un *manque*
   de primitives.
2. La vraie maladie est un **excès non gouverné** : **7+ implémentations concurrentes** de la
   gestion clavier/viewport, à moitié abandonnées, qui se contredisent — et l'Assistant en
   réimplémente une **8ᵉ, dégradée, en inline**.
3. Le défaut **structurel** : il n'existe **aucune distinction** entre « écrans à scroll-document »
   (formulaires, listes) et « écrans app-shell » (chat = viewport verrouillé, scroll interne). Le
   chat tente d'être un app-shell **à l'intérieur d'un shell `min-h-screen` qui scrolle comme un
   document**. Les deux modèles de layout sont incompatibles → header qui disparaît, blanc en bas.
4. Un **modèle mental erroné est gravé dans le code ET dans la doc** : « `interactive-widget` fait
   shrink le layout sur iOS ». **iOS ignore `interactive-widget`** (vérifié). Cette croyance fausse
   est la justification d'une décision d'architecture (« on a abandonné `calc(100dvh - inset)` »).
5. La différence avec Vercel/Linear/Claude.ai **n'est pas du CSS** (`dvh` vs `vh`). C'est qu'ils ont
   **un seul app-shell discipliné** et **une seule source de vérité** pour le viewport. Bonzini a
   huit demi-solutions. **On arrête de patcher : on pose la fondation une fois.**

---

## 1. Démontage de l'hypothèse initiale

L'hypothèse fournie était : (1) `100vh` sans `100dvh`, (2) pas de `visualViewport`, (3) pas de
`safe-area`. **Les trois sont contredites par le code.**

| Hypothèse | Réalité dans le code | Preuve |
|---|---|---|
| `100vh` sans fallback `dvh` | `dvh`/`svh`/`lvh` utilisés dans ~30 endroits | `MobileAssistantScreen.tsx:224`, `MobileLayout.tsx:15`, `ui/sidebar.tsx`, etc. |
| Pas de `visualViewport` | API utilisée dans **7 hooks** dédiés + inline dans l'Assistant | `src/hooks/keyboard/*`, `MobileAssistantScreen.tsx:138` |
| Pas de `safe-area` | `env(safe-area-inset-*)` dans ~20 endroits | `index.css:203,752,939-940,1194,1198`, `MobileHeader.tsx:42`, etc. |
| (implicite) zoom = font < 16px non géré | `font-size:16px !important` global sur mobile | `index.css:184-192` |
| (implicite) pas de `interactive-widget` | Présent dans le meta | `index.html:5` |

🟢 **Conclusion** : l'équipe **connaît** les pièges mobiles et a posé de vraies défenses. Le
problème n'est **pas un déficit de connaissance**, c'est un **déficit de gouvernance** : les
défenses vivent dans N endroits déconnectés et certains écrans (l'Assistant) les contournent.

### Correction d'une de mes propres hypothèses de travail
J'avais d'abord noté que le `textarea` de l'Assistant est en `text-[15px]` (`MobileAssistantScreen.tsx:388`)
→ déclencheur de zoom iOS (< 16px). **C'est faux** : la règle globale `index.css:189-191`
(`font-size:16px !important` sous 767px) **écrase** ce 15px sur device réel. Le `text-[15px]`
reste un *code smell* (il bypasse le design system, ce qui est exactement le pattern de la maladie)
**mais il ne provoque pas de zoom**. Retiré des causes. 🟢

---

## 2. Faits API vérifiés (caniuse / MDN — juin 2026)

| API / feature | Support réel | Implication pour Bonzini | Conf. |
|---|---|---|---|
| `dvh` / `svh` / `lvh` | Safari **15.4+**, Chrome **108+**, **93%** global | Sûr à utiliser. Fallback nécessaire seulement < iOS 15.4 (négligeable) | 🟢 |
| VirtualKeyboard API (`navigator.virtualKeyboard`) | **Chromium uniquement** (Chrome/Edge 94+). **PAS Safari (aucune), PAS Firefox**. 76% global | `overlaysContent=true` n'agit **que** sur Chrome/Edge Android | 🟢 |
| `interactive-widget` (meta viewport) | Chrome **108+**, Firefox **132+**. **PAS WebKit/Safari** ([WebKit request #65](https://github.com/WebKit/standards-positions/issues/65)) | **iOS ignore le tag**. La croyance « iOS shrink via interactive-widget » est **fausse** | 🟢 |
| Zoom focus iOS | Déclenché si **font-size calculé < 16px** | Défendu par `index.css:184-192`. OK | 🟢 |

**Corollaire dérangeant** : `interactive-widget=resizes-content` (`index.html:5`) est un **no-op sur
les deux plateformes** : ignoré sur iOS, et **écrasé sur Android** par `overlaysContent=true` (qui
force le mode *overlay*, l'inverse de *resizes*). Le tag ne fait rien d'utile et **induit en erreur
quiconque le lit** — c'est précisément ce qui a produit le commentaire faux ci-dessous.

---

## 3. La vraie cause racine — en couches

> Principe : on ne s'arrête pas au niveau 1 (CSS). On remonte jusqu'au niveau architectural.

### Couche 0 — Aucun verrou de document (le socle manquant)
`html`, `body`, `#root` n'ont **aucune** règle de `height`/`overflow` (`index.css:170-178` ne pose
que la police et la couleur). Donc **le document peut toujours scroller**. Les apps premium
verrouillent le document (`html,body,#root { height:100%; overflow:hidden }` ou un conteneur app
`position:fixed`) pour que **seuls des conteneurs internes** scrollent. Ici, rien ne l'empêche →
chaque écran est à la merci du *document scroll* + de la danse de la barre d'URL iOS. 🟢

### Couche 1 — Nesting de hauteurs incompatibles (le smoking gun structurel)
Pile DOM réelle de l'Assistant :

```
<div min-h-screen flex flex-col>             ← MobileAppShell (min-height: 100vh)
  <main flex-1>
    <div animate-fade-in>                    ← AnimatedPage (opacity only, pas de transform)
      <div style="height: vv.height" overflow-hidden flex flex-col>   ← Assistant root
        <header sticky top-0>                ← MobileHeader
        <div flex-1 overflow-y-auto>…msgs…</div>
        <div>…barre de saisie…</div>
```

- Le **parent** (`MobileAppShell.tsx:22-26`) est `min-h-screen` = `min-height:100vh`. Sur iOS, `100vh`
  = *large viewport* (barre d'URL masquée). Quand la barre d'URL est **visible**, le shell est **plus
  haut que la zone visible** → **le document devient scrollable**.
- L'**enfant** (`MobileAssistantScreen.tsx:222-224`) est `height: vv.height` + `overflow-hidden` : il
  veut être un app-shell à hauteur fixe.
- **Un conteneur à hauteur fixe `overflow-hidden` posé dans un document scrollable `min-h-screen` :
  les deux modèles de layout s'excluent.** Le `overflow-hidden` du root n'empêche pas le **document**
  de scroller. Donc tout scroll (doigt, scroll-au-focus du navigateur, ou le `window.scrollBy` global,
  cf. couche 5) **translate tout le root** — header compris.
- Le header `sticky top-0` (`MobileHeader.tsx:38-44`) colle dans le contexte de scroll du **root**
  (qui ne scrolle pas), **pas** du document → quand le document bouge, le header **part avec** →
  **« header se cache »**. Le blanc en bas = le fond du shell `min-h-screen` qui dépasse sous le
  conteneur `vv.height`. 🟢 (mécanisme structurel) / 🟡 (manifestation exacte au pixel : dépend du
  timing de scroll iOS — à confirmer device).

> Note : `AnimatedPage` n'applique **que** `opacity` (`animate-fade-in`, cf. `tailwind.config.ts:105`),
> **pas** de `transform`. Donc il **ne casse pas** sticky/fixed. Hypothèse « transform » écartée. 🟢

### Couche 2 — Sept implémentations concurrentes, sans source de vérité
`src/hooks/keyboard/` contient :

| Hook | Rôle | Seuil clavier | Remarque |
|---|---|---|---|
| `useVisualViewport` | géométrie vv brute | — | OK, primitive saine |
| `useKeyboardInset` | hauteur clavier (VK API + vv) | **100** | pour `calc(100dvh - inset)` |
| `useKeyboardHeight` / `useKeyboardOpen` | hauteur clavier (vv only) | **120** | duplique `useKeyboardInset`, **désaccord de seuil** |
| `useViewportContainerHeight` | string de hauteur CSS | — (vv.height brut) | **« abandonne » `calc(100dvh - inset)`** sur un commentaire faux |
| `useVirtualKeyboardOverlay` | `overlaysContent=true` | — | Chromium only |
| `useScrollIntoViewOnFocus` | `window.scrollBy` au focus | — | global, **scrolle le document** |
| `useKeyboardSafePadding` | `paddingBottom = kbHeight` | 120 (via useKeyboardHeight) | encore une autre voie |

**Trois** façons différentes de répondre à « quelle est la hauteur du clavier ? » (`useKeyboardInset`
seuil 100, `useKeyboardHeight` seuil 120, `useViewportContainerHeight` brut) qui **renvoient des
nombres différents pour le même état physique**. Aucune n'est faisant autorité. C'est pire que de
n'avoir rien : elles **interagissent de façon imprévisible** selon l'écran qui en pioche une. 🟢

### Couche 3 — Un modèle mental faux, gravé dans le code ET la doc
`useViewportContainerHeight.ts:24-28` :

> *« Why we abandoned `calc(100dvh - useKeyboardInset())` : On iOS Safari 16.4+, the meta tag
> `interactive-widget=resizes-content` makes 100dvh ALREADY shrink when the keyboard opens. »*

**Faux** (vérifié §2) : iOS n'implémente pas `interactive-widget` ; `100dvh` **ne shrink pas** à
l'ouverture du clavier sur iOS (le clavier ne réduit que le *visual viewport*, pas le *layout
viewport* auquel `dvh` est lié). La même croyance est répétée dans `refonte-ui-chat-implementation.md:35`.
**Une décision d'architecture (« abandonner X ») repose sur une prémisse fausse.** C'est la racine de
la dérive « patch sur patch » : on corrige les symptômes d'un modèle mental incorrect. 🟢

### Couche 4 — L'Assistant : copie dégradée d'un pattern qui existe déjà
Il existe **deux** surfaces de chat, traitées différemment :

| | Support (`MobileSupportConversationScreen`) | Assistant (`MobileAssistantScreen`) |
|---|---|---|
| Hauteur conteneur | `useViewportContainerHeight()` (`:43,176`) | **inline** `vv.height` (`:137-151,224`) |
| Gère Android (overlay) | **Oui** (`calc(100dvh - vkHeight)`) | **NON** → bug Android |
| Gère iOS | Oui (`vv.height`) | Oui (`vv.height`) |
| Auto-grow du textarea | **Oui** (`MessageInput.tsx:332-336`) | **NON** (`:382-389`) → champ ne grandit pas |
| Issu de la refonte clavier | Oui (`refonte-ui-chat-implementation.md`) | **Non** (construit séparément après) |

**L'Assistant n'implémente que la moitié iOS** de ce que `useViewportContainerHeight` fait déjà.
Sur **Android**, `overlaysContent=true` (global) empêche le *visual viewport* de shrink → `vv.height`
reste plein → **le conteneur ne rétrécit jamais → le clavier recouvre la saisie**. C'est *exactement*
le symptôme Android rapporté. Et le textarea n'a **pas** le handler `onInput` d'auto-grow présent à 40
fichiers de là → *exactement* le « champ qui ne s'agrandit pas ». 🟢

### Couche 5 — Conflits actifs entre mécanismes globaux et locaux
`KeyboardFocusManager` est monté globalement (`App.tsx:138`) et active **deux** choses pour tous :
1. `overlaysContent=true` (Android) → le vv ne shrink pas → casse l'approche `height:vv.height` de l'Assistant (couche 4).
2. `useScrollIntoViewOnFocus` → au focus, après **320 ms**, fait `window.scrollBy` (`useScrollIntoViewOnFocus.ts:38-51`) → **scrolle le document** sous un conteneur qui, lui, se redimensionne via `vv.resize`. Deux mouvements qui se superposent en deux temps → **« ça part dans tous les sens »**. 🟡 (mécanisme 🟢, ampleur à confirmer device)

---

## 4. Mapping symptôme rapporté → cause → confiance

| Symptôme (rapporté) | Plateforme | Cause racine (couche) | Conf. |
|---|---|---|---|
| Grand blanc en bas au scroll | iOS | Shell `min-h-screen`(100vh) > visible → document scroll sous conteneur `vv.height` (C0,C1) | 🟢 |
| Header « Assistant » se cache | iOS | Sticky dans root `overflow-hidden` qui translate avec le document (C1) | 🟢 |
| Saisie + boutons remontent, blanc en bas | iOS | `offsetTop` du visual viewport **ignoré** par l'inline (`:140-141` lit `vv.height`, pas `offsetTop`) (C4) | 🟢 |
| Difficile de scroller la conversation | iOS | Conflit scroll document vs scroll interne `flex-1 overflow-y-auto` (C0,C1,C5) | 🟡 |
| Clavier cache la saisie | **Android** | `overlaysContent=true` → vv ne shrink pas → conteneur reste plein (C4,C5) | 🟢 |
| Champ ne grandit pas avec le texte | iOS+Android | Pas de handler `onInput` d'auto-grow sur le textarea (C4) | 🟢 |
| Zoom involontaire | iOS | **Déjà défendu** (`index.css` 16px). Probablement **non reproductible** | 🟡 (penche « non-bug ») |
| Comportement radicalement différent iOS↔Android | les deux | Config globale + code local font des **hypothèses opposées par plateforme** (C3,C4,C5) | 🟢 |

---

## 5. Ce qui est DÉJÀ bon (à NE PAS jeter)

- `useVisualViewport` : primitive propre et correcte (gère `offsetTop`, fallback resize). **Base de la future source unique.**
- `env(safe-area-inset-*)` : appliqué correctement à plusieurs endroits.
- Garde-fou global anti-zoom 16px (`index.css:184-192`).
- `dvh` partout (support navigateur OK).
- Le pattern `useViewportContainerHeight` du Support est la **bonne direction** (gère les 2 plateformes) — il faut le **généraliser et le durcir** (offsetTop, nesting), pas le réécrire.

## 6. Ce qui doit disparaître / converger (dette à éliminer en Phase 5)

- Les **doublons** de calcul de hauteur clavier (`useKeyboardInset` vs `useKeyboardHeight` vs inline) → **une** source de vérité.
- La logique **inline** de l'Assistant (`:137-151`) → supprimée au profit du système.
- Le commentaire/doc faux sur `interactive-widget` iOS (C3) → corrigé.
- Le `interactive-widget=resizes-content` no-op → décision explicite (le garder seulement si on documente *pourquoi*, sinon le retirer pour ne plus tromper).
- Le mélange `min-h-screen`(100vh) / `100dvh` / `vv.height` → **convention unique** (cf. Phase 3).

---

## 7. Pourquoi Vercel/Linear/Claude.ai « jouent dans une autre cour »

Ce n'est **pas** parce qu'ils ont écrit `dvh` au lieu de `vh`. C'est parce qu'ils ont :
1. **Un seul app-shell** : document verrouillé (`overflow:hidden` sur la racine), un conteneur racine
   qui occupe le viewport visible, des **scroll containers internes** explicites. Le chat *possède* le
   viewport — il n'est pas un invité dans une page qui scrolle.
2. **Une seule source de vérité viewport/clavier**, pas sept.
3. **Le même contrat sur tous les écrans** : header ancré, zone de scroll au milieu, composeur ancré au
   *visual viewport*. Cohérence = sensation de calme.

→ Ces trois points deviennent les **principes de la Phase 3**, conçus pour être **généralisables à
toute la plateforme**, pas seulement à l'Assistant.

## 8. Limites de cet audit (honnêteté)

- 🔴 **Aucun test sur device réel n'a encore été fait** (DevTools desktop ne montre pas ces bugs). Les
  mécanismes structurels sont 🟢 par lecture de code + specs vérifiées ; l'ampleur/pixel exact de
  certaines manifestations iOS reste 🟡 jusqu'à validation sur iPhone (Safari) + Android (Chrome) réels.
- Je n'ai pas encore profilé le comportement runtime (pas d'exécution). Phase 4 définira le protocole de
  test sur device (Web Inspector iOS, Chrome remote debugging) — obligatoire avant et après tout fix.
- Le Support chat partage des risques latents (offsetTop, nesting) même s'il n'est pas l'objet de la
  plainte : la fondation Phase 3 doit le couvrir aussi.

## 9. Prochaine étape

**Phase 2 — Benchmark** (observation, lecture seule) : disséquer ChatGPT, Claude.ai, Linear, Vercel sur
mobile (header au scroll, composeur au clavier iOS/Android, champ qui grandit, stabilité, safe-areas,
patterns CSS/HTML observables) et en extraire le **contrat d'app-shell** à reproduire.

*Phase 2 lancée ci-dessous.*

---

# Phase 2 — Benchmark : le « contrat du cadre fixe »

## 2.0 Note de méthode (honnêteté)

Depuis cet environnement d'exécution, je **ne peux pas** ouvrir ces apps sur un device réel et
inspecter leur code en direct. Donc je ne prétends pas l'avoir fait. Méthode :
1. **Technique universelle vérifiée** contre la documentation officielle + sources d'ingénierie
   reconnues (citées) → 🟢.
2. **Comportements connus** de chaque app décrits avec niveau de confiance (jamais présentés comme
   une inspection que je n'ai pas faite) → 🟡 sauf mention.

## 2.1 Mise au point : Vercel n'est PAS la bonne référence pour CE problème précis

Tu cites Vercel. Important : **la web app de Vercel est un *tableau de bord*, pas un chat.** Elle est
une excellente référence pour la **sensation générale de calme et de solidité** (un app-shell qui ne
tremble pas), mais elle ne t'apprend presque **rien** sur le problème précis qui te bloque : *la
barre d'écriture + le clavier*. Pour ça, les vrais maîtres sont les **messageries** :

| Référence | Bon prof pour… | Pertinence clavier-composeur |
|---|---|---|
| **WhatsApp / iMessage** | le composeur (barre qui grandit, collée au clavier) | ⭐ étalon absolu |
| **ChatGPT / Claude.ai (web mobile)** | chat web dans un navigateur (ton cas exact) | ⭐ très haute |
| **Telegram Web** | composeur web + défilement | haute |
| **Linear (mobile)** | l'app-shell (cadre fixe, barres ancrées) | moyenne (pas un chat) |
| **Vercel (mobile)** | la *finition* générale, le calme visuel | faible (pas un chat) |

→ On benchmarke donc d'abord les **messageries**, et on garde Vercel/Linear pour la finition
d'app-shell généralisable.

## 2.2 Le contrat universel — 4 règles que toutes les bonnes apps respectent

> C'est la traduction de la métaphore « cadre fixe » en règles concrètes. Chaque règle = un
> comportement observable + la technique vérifiée qui le produit.

### R1 — Le document ne défile JAMAIS. Seule la zone des messages défile. 🟢
La page entière est **verrouillée**. Ce qui bouge, c'est uniquement la liste des messages, dans sa
propre fenêtre interne. C'est ce qui supprime le « tout glisse / header qui part / blanc en bas ».
- **Technique vérifiée** : verrouillage du défilement de page (racine `overflow:hidden` /
  `position:fixed`) + `overscroll-behavior` sur la zone de messages pour éviter que le défilement
  « déborde » sur la page. iOS a historiquement rendu ça difficile — d'où l'importance de le faire
  **une fois, correctement, au niveau du shell**.
  Sources : [Locking body scroll iOS — jayfreestone](https://www.jayfreestone.com/writing/locking-body-scroll-ios/),
  [overscroll-behavior — ishadeed](https://ishadeed.com/article/prevent-scroll-chaining-overscroll-behavior/),
  [decade-long iOS Safari fix — Medium](https://stripearmy.medium.com/i-fixed-a-decade-long-ios-safari-problem-0d85f76caec0).
- **Bonzini aujourd'hui** : ❌ rien ne verrouille le document (`html/body/#root` sans règle de
  hauteur/overflow — cf. Phase 1, Couche 0).

### R2 — Le cadre épouse la zone *visible* et SUIT le clavier. 🟢
Quand le clavier monte, le cadre se rétrécit pour finir **pile au-dessus du clavier**. Quand la barre
d'adresse du navigateur apparaît/disparaît, le cadre s'ajuste sans saut.
- **Technique vérifiée** : `visualViewport` (hauteur visible + position) pour le **clavier**, +
  unités d'écran dynamiques (`dvh`) pour la **barre d'adresse**. Nuance critique (vérifiée en
  Phase 1) : `dvh` **seul** suffit pour la barre d'adresse mais **PAS** pour le clavier sur iOS
  (iOS ne rétrécit pas la page à l'ouverture du clavier). Il faut donc **combiner** les deux.
  Sources : [VisualViewport — MDN](https://developer.mozilla.org/en-US/docs/Web/API/VisualViewport),
  [fix keyboard overlap — dev.to](https://dev.to/franciscomoretti/fix-mobile-keyboard-overlap-with-visualviewport-3a4a),
  [fixed elements respect keyboard iOS — saricden](https://saricden.com/how-to-make-fixed-elements-respect-the-virtual-keyboard-on-ios).
- **Bonzini aujourd'hui** : ⚠️ moitié fait. Le Support utilise un bon hook ; l'Assistant a une copie
  inline qui ignore la position (`offsetTop`) et ne gère pas Android (cf. Phase 1, Couche 4).

### R3 — Titre ancré en haut, composeur ancré en bas, messages au milieu — et le composeur GRANDIT. 🟢
Structure invariante : 3 zones. Le titre ne défile pas. Le composeur ne défile pas. Le composeur
**grandit** ligne par ligne quand le texte est long, jusqu'à une hauteur max, puis défile à
l'intérieur. C'est le comportement WhatsApp/iMessage.
- **Technique vérifiée** : layout en colonne (haut fixe / milieu extensible-défilant / bas fixe) +
  recalcul de la hauteur du composeur à la frappe (le `MessageInput` du Support le fait déjà :
  `MessageInput.tsx:332-336`).
- **Bonzini aujourd'hui** : ❌ le composeur de l'Assistant **ne grandit pas** (pas de recalcul de
  hauteur — cf. Phase 1, Couche 4).

### R4 — UNE seule recette, partagée par tous les écrans. 🟢 (principe)
Les bonnes apps n'ont pas huit façons de gérer le clavier. Elles ont **un** composant de cadre et
**un** composant de composeur, réutilisés partout. La cohérence = la sensation de qualité.
- **Bonzini aujourd'hui** : ❌ 8 implémentations (7 hooks + 1 inline), seuils divergents, modèle
  mental faux gravé dedans (cf. Phase 1, Couches 2 & 3).

## 2.3 Comportements par référence (connus, avec confiance)

- **WhatsApp / iMessage** (apps natives, étalon du *ressenti* composeur) : composeur collé au clavier,
  grandit jusqu'à ~5-6 lignes puis défile, titre figé, liste qui défile seule, zéro saut. Comportement
  universellement observable → 🟢. *Natif ≠ web*, mais c'est la **cible de ressenti** à égaler.
- **ChatGPT / Claude.ai (web mobile, navigateur)** : c'est **exactement ton cas** (chat web). Composeur
  qui reste au-dessus du clavier, page qui ne « danse » pas, liste qui défile, composeur extensible.
  Connu/cohérent avec les techniques R1-R3 → 🟡 (non inspecté ici).
- **Linear (mobile)** : app-shell exemplaire — barres ancrées, contenu interne défilant, transitions
  calmes. Bon prof pour le **shell généralisable**, pas pour le composeur → 🟡.
- **Vercel (mobile)** : finition et calme visuel d'un tableau de bord. Référence de **polish**, pas de
  chat → 🟡.

## 2.4 Tableau écart : bonne app ↔ Assistant Bonzini (aujourd'hui)

| Règle | Bonne app | Assistant Bonzini actuel | État |
|---|---|---|---|
| R1 Document verrouillé | la page ne bouge jamais | document libre de défiler sous un cadre à hauteur fixe | ❌ |
| R2 Suit le clavier | cadre pile au-dessus du clavier (iOS+Android) | OK iOS partiel, **cassé Android** (clavier recouvre) | ⚠️ |
| R3 Composeur ancré + grandit | grandit jusqu'à une limite | **ne grandit pas** | ❌ |
| R4 Une seule recette | 1 cadre + 1 composeur réutilisés | **8 demi-recettes** | ❌ |

## 2.5 Ce que la Phase 2 verrouille pour la suite

La cible n'est pas mystérieuse ni propriétaire : c'est **un contrat public et standard** (R1→R4). La
Phase 3 va le matérialiser en **un seul app-shell + un seul composeur**, conçus pour être **réutilisés
par tout Bonzini** (pas seulement l'Assistant). On ne réinvente rien : on **applique proprement, une
fois**, ce que la doc web et les meilleures apps font déjà.

*Phase 3 lancée ci-dessous.*

---

# Phase 3 — Architecture cible : la « recette unique »

> Objectif : matérialiser le contrat R1→R4 (Phase 2) en **un seul app-shell + un seul composeur**,
> réutilisables par **toute la plateforme**, et **supprimer** les 8 demi-implémentations.
> Tout le code ci-dessous est une **spécification** (Phase 5 = écriture réelle).

## 3.1 La décision structurante : DEUX archétypes d'écran, et un seul

Aujourd'hui le code n'a **aucune** distinction explicite entre un écran qui doit défiler et un écran
qui doit verrouiller le viewport. C'est la racine du chaos. La cible impose **deux archétypes, et
chaque écran déclare lequel il est** :

| Archétype | Pour quoi | Comportement | Hauteur |
|---|---|---|---|
| **`<DocumentScreen>`** | listes, formulaires, tableaux de bord, détails | la **page défile** naturellement (barre d'URL se rétracte) | `min-h-[100dvh]` |
| **`<ViewportShell>`** | chat (Assistant, Support), et tout écran « plein cadre » | la **page est verrouillée**, seul l'intérieur défile, suit le clavier | hauteur visible exacte |

C'est un principe **généralisable** : chaque écran de Bonzini sera l'un ou l'autre, jamais un hybride
accidentel. Le chat est un `ViewportShell`. La plupart des autres écrans sont des `DocumentScreen`
(ce qu'ils font déjà via `min-h-screen` — qu'on remplacera par `min-h-[100dvh]`).

## 3.2 La décision clavier UNIQUE : mode « resize », pas mode « overlay »

Rappel Phase 1 : le code active **en même temps** deux mécanismes contradictoires —
`interactive-widget=resizes-content` (meta) **et** `overlaysContent=true` (runtime). On tranche :

- **On SUPPRIME `overlaysContent=true`** (on retire `useVirtualKeyboardOverlay` du manager global).
- **Conséquence clé** : une fois le mode overlay retiré, **`window.visualViewport.height` rétrécit de
  façon fiable à l'ouverture du clavier sur iOS ET Android** (mode par défaut « resizes-visual » ou
  « resizes-content »). C'est ce qui permet d'avoir **UNE seule source de vérité** pour la hauteur
  visible, au lieu des 3 calculs divergents actuels. 🟡 *(mécanisme 🟢 ; à valider device)*
- `interactive-widget=resizes-content` : **gardé** (utile comme repli `dvh` sans JS sur Android),
  mais le **commentaire faux** sur iOS est corrigé.

## 3.3 La source de vérité unique : `useVisibleViewportHeight`

Remplace `useKeyboardInset`, `useKeyboardHeight`, `useViewportContainerHeight` et la logique inline de
l'Assistant. Écrit des **variables CSS** sur `:root` via **un seul** écouteur (throttle `rAF`) — donc
**aucun re-render React** sur l'animation du clavier (≠ le `setState` actuel de l'Assistant qui
re-render tout le chat à chaque frame → jank).

```ts
// SPEC — pas encore implémenté
// Pose --vvh (hauteur visible) et --vvt (offset haut du viewport visuel) sur :root.
// Le ViewportShell s'y ancre. Un seul listener pour toute l'app.
function useVisibleViewportSync() {
  useEffect(() => {
    const vv = window.visualViewport;
    const root = document.documentElement;
    let raf = 0;
    const apply = () => {
      raf = 0;
      const h = vv ? vv.height : window.innerHeight;
      const t = vv ? vv.offsetTop : 0;
      root.style.setProperty('--vvh', `${Math.round(h)}px`);
      root.style.setProperty('--vvt', `${Math.round(t)}px`);
    };
    const onChange = () => { if (!raf) raf = requestAnimationFrame(apply); };
    apply();
    vv?.addEventListener('resize', onChange);
    vv?.addEventListener('scroll', onChange);
    window.addEventListener('resize', onChange);
    return () => { /* cleanup + cancelAnimationFrame */ };
  }, []);
}
```

Fallback : si `--vvh` non posée (avant montage / pas de support), le shell tombe sur `100dvh`.

## 3.4 Le composant `<ViewportShell>` (cadre verrouillé)

Structure invariante en 3 zones (R3). Verrouille le document à l'ouverture (R1), s'ancre au viewport
visible (R2). En `position: fixed` → il **sort du flux** et neutralise le parent `min-h-screen`
(c'est ce qui règle le « nesting » de la Phase 1 sans toucher au routage).

```
position: fixed; left:0; right:0;
top:    var(--vvt, 0);
height: var(--vvh, 100dvh);
display:flex; flex-direction:column; overflow:hidden;
+ verrouille <body> au montage (overflow:hidden; overscroll:none), restaure au démontage.
```

```
 ┌─────────────────────────────┐  ← position: fixed, ancré au viewport visible
 │  HEADER  (slot, shrink-0)    │     padding-top: env(safe-area-inset-top)
 ├─────────────────────────────┤
 │  SCROLL REGION (flex-1)      │     overflow-y:auto; overscroll-behavior:contain
 │     ↕ messages seulement     │     ← seule zone qui défile
 ├─────────────────────────────┤
 │  COMPOSER (slot, shrink-0)   │     padding-bottom: env(safe-area-inset-bottom)
 └─────────────────────────────┘  ← bord inférieur = pile au-dessus du clavier (via --vvh)
```

API proposée : `<ViewportShell header={…} composer={…}>{messages}</ViewportShell>`.

## 3.5 Le composant `<ChatComposer>` (barre d'écriture unique)

Une seule barre, partagée par Assistant **et** Support. Réunit ce qui marche déjà + ce qui manque :

- **Auto-grow** : recalcul de hauteur à la frappe (`onInput`, `min(scrollHeight, max)`) — repris de
  `MessageInput.tsx:332-336`, **absent** de l'Assistant aujourd'hui → corrige R3.
- **≥16px** garanti (anti-zoom iOS, déjà global — on retire le `text-[15px]` smell de l'Assistant).
- **max-height puis scroll interne** (n'envahit pas l'écran).
- Slots gauche/droite (pièce jointe, micro, envoyer) configurables selon le contexte.
- `enterkeyhint`, gestion `Enter`/`Shift+Enter` selon mobile/desktop (déjà présente côté Support).

## 3.6 Ce qui est supprimé / converge (nettoyage de dette)

| Avant (8 voies) | Après |
|---|---|
| `useKeyboardInset` (seuil 100) | ❌ supprimé |
| `useKeyboardHeight`/`useKeyboardOpen` (seuil 120) | ❌ supprimé (ou réécrit au-dessus de `--vvh`) |
| `useViewportContainerHeight` | ➡️ remplacé par `useVisibleViewportSync` + `<ViewportShell>` |
| `useVirtualKeyboardOverlay` (overlaysContent) | ❌ supprimé (on passe en mode resize) |
| `useKeyboardSafePadding` / `KeyboardSafeArea` | conservé pour les `DocumentScreen` (formulaires longs) |
| logique inline Assistant (`:137-151,224`) | ❌ supprimée → utilise `<ViewportShell>` |
| `useVisualViewport` | ✅ conservé (primitive bas niveau) |
| `useScrollIntoViewOnFocus` (global `window.scrollBy`) | conservé **uniquement** pour `DocumentScreen` ; **désactivé** dans un `ViewportShell` (sinon il scrolle un document verrouillé = jank) |

## 3.7 Principes généralisables (à documenter comme standard plateforme)

1. **Tout écran déclare son archétype** : `DocumentScreen` (défile) ou `ViewportShell` (verrouillé).
2. **Une seule source de vérité viewport** (`--vvh`/`--vvt`), jamais de calcul clavier ad-hoc.
3. **Un seul mode clavier** : resize (pas overlay).
4. **Safe-areas gérées par les primitives** (shell/screen), pas écran par écran.
5. **Inputs ≥ 16px** (déjà global — maintenu).
6. **Hauteur via variables CSS**, pas via `setState` (zéro re-render sur l'animation clavier).
7. **Un seul composeur** réutilisé.

## 3.8 Fichiers impactés en Phase 5 (prévision)

- `index.html` : corriger le commentaire/intention du meta (le tag reste).
- `src/components/form/KeyboardFocusManager.tsx` : retirer `useVirtualKeyboardOverlay`, scoper le scroll-into-view.
- **Nouveau** `src/components/layout/ViewportShell.tsx` + hook `useVisibleViewportSync`.
- **Nouveau** `src/components/chat/ChatComposer.tsx` (mutualise Assistant + Support).
- `MobileAssistantScreen.tsx` : réécrit au-dessus de `<ViewportShell>` + `<ChatComposer>` (supprime l'inline).
- `MobileSupportConversationScreen.tsx` + `MessageInput.tsx` : migrés vers les mêmes primitives.
- Suppression des hooks redondants (3.6).
- `src/index.css` : poser le verrou document (classe `.viewport-locked`) + `--vvh` fallback.

## 3.9 Risques & points à valider sur device (avant de généraliser)

- 🔴 **`visualViewport.height` fiable sur Android après retrait de l'overlay** : mécanisme solide,
  mais **à confirmer sur Chrome Android + Samsung Internet réels**.
- 🔴 **Verrou `<body>` iOS** : la technique a des variantes (overflow vs position:fixed) ; valider
  qu'il n'y a pas de saut de scroll au montage/démontage du chat.
- 🟡 **Safe-area bas quand clavier ouvert** : léger sur-espace possible ; décider si on le neutralise.
- 🟡 **Transitions de page** (`AnimatedPage`) autour d'un shell `position:fixed` : vérifier l'entrée/sortie.

*Phase 5 livrée ci-dessous (l'utilisateur a demandé « répare-le » directement).*

---

# Phase 5 — Implémentation (Assistant) + protocole de test device

## 5.1 Ce qui a été construit

| Fichier | Nature | Rôle |
|---|---|---|
| `src/hooks/keyboard/useVisibleViewportSync.ts` | **nouveau** | Source de vérité unique : pose `--vvh`/`--vvt` sur `:root` via **1** écouteur throttlé `rAF`. **Zéro re-render React** sur l'animation clavier. |
| `src/components/layout/ViewportShell.tsx` | **nouveau** | Le « cadre verrouillé » : `position:fixed` (échappe au parent `min-h-screen`), ancré au viewport visible (`--vvh`/`--vvt`), verrouille le document, 3 zones (header / scroll / footer). |
| `src/components/form/KeyboardFocusManager.tsx` | modifié | **Retrait de `useVirtualKeyboardOverlay`** (overlay → resize) + ajout de `useVisibleViewportSync`. |
| `src/index.css` | modifié | Repli `--vvh:100dvh` / `--vvt:0px` + classe `.viewport-locked` (verrou document iOS/Android). |
| `src/mobile/screens/assistant/MobileAssistantScreen.tsx` | réécrit | Reconstruit sur `<ViewportShell>` ; composeur avec **auto-grow** + **16px** ; suppression de la logique `visualViewport` inline. |
| `src/hooks/keyboard/index.ts` | modifié | Export de `useVisibleViewportSync`. |

> Rendu visuel **préservé à l'identique** (couleurs, bulles, cartes de confirmation, pièces jointes,
> dégradé de marque). Seuls la **structure du cadre** et le **champ de saisie** changent.

## 5.2 Symptôme → correctif

| Symptôme (Phase 1) | Correctif |
|---|---|
| Blanc en bas / page qui glisse (iOS) | Document verrouillé (`.viewport-locked`) + shell `position:fixed` → plus de scroll-document |
| Header se cache | Header dans la zone fixe d'un shell `position:fixed` → ne défile plus |
| Clavier cache la saisie (Android) | Retrait de l'overlay → `visualViewport.height` rétrécit → `--vvh` suit le clavier |
| Champ ne grandit pas | `onInput` auto-grow ajouté (min(scrollHeight, 128)) |
| « Ça part dans tous les sens » | Hauteur en variables CSS (0 re-render) ; un seul mécanisme au lieu de 8 |

## 5.3 Vérifications machine (faites)

- **Type-check** (`tsc --noEmit`, TS 6.0.2) : **exit 0, aucune erreur sur le code**. *(Note : `tsc`
  émet une dépréciation `baseUrl` au niveau de `tsconfig.json` — **pré-existante**, liée à la version
  d'avant-garde du conteneur, contournée ici via `--ignoreDeprecations 6.0` sans modifier le repo.)*
- **Build** (`vite build`) : **exit 0**, `✓ built in ~28s`. *(Seuls avertissements : tailles de
  chunks pdf/charts — pré-existants.)*
- **Lint** (`eslint`) : **exit 0**, propre (le `<textarea>` brut suit le même précédent que
  `MessageInput.tsx`).

## 5.4 ⚠️ Vérifications IMPOSSIBLES sans device réel — À FAIRE par l'utilisateur

> Rappel : ces bugs **ne se voient pas** sur un ordinateur. Tester sur **iPhone (Safari)** ET
> **Android (Chrome)**, connecté en admin, sur `/m/assistant`.

1. **Ouverture** : titre en haut, barre d'écriture en bas, pas de blanc, rien ne dépasse.
2. **Focus clavier** : touche le champ → la barre reste **collée juste au-dessus du clavier**, sans saut ni blanc.
3. **Champ qui grandit** : écris 5+ lignes → le champ grandit puis défile à l'intérieur (~5 lignes max).
4. **Défilement** : remonte la conversation → le **titre reste en haut**, pas de blanc en bas, pas de « page qui glisse ».
5. **Après envoi** : le champ **revient à 1 ligne**, la conversation colle au bas.
6. **Fermeture clavier** : la barre redescend proprement, pas de blanc résiduel.
7. **Régression formulaire** (changement global) : `/m/deposits/new` ou `/m/payments/new` → toucher un champ → il reste visible au-dessus du clavier.
8. **Régression Support** : `/m/support/[conv]` → toucher le champ → reste au-dessus du clavier sur iPhone **et** Android.

→ Si une étape échoue : indiquer **le numéro d'étape + le téléphone** concerné.

## 5.5 Périmètre — fait / pas encore (généralisation future)

- ✅ **Fait** : l'Assistant (priorité bloquante) + les 2 primitives réutilisables (`ViewportShell`,
  `useVisibleViewportSync`) + bascule globale en mode resize.
- ⏳ **Pas encore (volontairement, pour limiter le rayon d'impact)** :
  - Migrer le **Support** (`MobileSupportConversationScreen` + `MessageInput`) vers `ViewportShell` +
    un `<ChatComposer>` mutualisé. *(Le Support bénéficie déjà du mode resize ; à tester — étape 8.)*
  - **Supprimer les hooks redondants** (`useKeyboardInset`, `useKeyboardHeight`,
    `useViewportContainerHeight` une fois le Support migré).
  - Convertir les `min-h-screen` (100vh) restants en `min-h-[100dvh]`.
- 🔴 **Risque connu à valider** : le retrait de `overlaysContent` change le mode clavier **global** →
  d'où les étapes de régression 7 & 8.

*Fondation posée. La suite (généralisation Support + nettoyage dette) se fera une fois l'Assistant
validé sur device.*
