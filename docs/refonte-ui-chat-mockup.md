# Mockup UI/UX Chat — Phase A

Fichier autonome HTML, à tester sur téléphone réel avant qu'on parte sur l'implémentation React.

## URL d'accès

Une fois la branche déployée par ton hébergeur (Vercel/Netlify), le mockup est accessible à :

```
https://[ton-app-url]/chat-mockup.html
```

Exemple : `https://app.bonzini.com/chat-mockup.html`

C'est un fichier statique servi depuis `public/`, donc aucune action serveur à faire — il devient dispo dès que la branche est mergée et redéployée.

**Test local sans déployer** : clique sur le fichier sur GitHub, puis "View raw" puis "Download" → ouvre le `.html` téléchargé directement sur ton téléphone (Chrome/Safari supportent l'ouverture de fichiers locaux).

## Ce que tu testes

10 scénarios navigables via les onglets en haut :

| # | Scénario | Ce qu'il valide |
|---|---|---|
| 1 | **Empty + Quick replies** (client) | Empty state avec illustration custom + chips suggérées + chaleur du copy |
| 2 | **Conv pleine** (client) | Bulles avec queue WhatsApp-style, groupage par sender, séparateurs date, accusés de lecture, **vérifie "Hello" sur 1 ligne** |
| 3 | **Avec reply en cours** | Preview du message cité au-dessus de l'input, citation dans bulle |
| 4 | **Clavier ouvert** ⚠️ test critique | Active le toggle "⌨ Simuler clavier" en haut → l'input reste visible. Ou focus l'input → clavier natif → input doit rester visible |
| 5 | **Voice recorder actif** | Overlay rouge, waveform pulsante, hint "glissez pour annuler", boutons annuler/envoyer |
| 6 | **Media (img + vidéo + fichier)** | 3 types de bulles média avec leur design respectif, voice playback waveform avec progress |
| 7 | **Liste convs client** (multi-thread) | Cards conversations, badge non-lus animé, bouton "Nouvelle conversation" dégradé |
| 8 | **Conv admin + actions** | Header avec badge "À vous", menu actions, bouton templates en plus du + |
| 9 | **Liste admin + search** | SearchField actif, snippets surlignés en jaune ambre, chips de filtres |
| 10 | **Stats admin** | 4 KPI cards, line chart volume, bar chart distribution, barres horizontales top admins |

## Contrôles globaux (en haut)

- **Toggle lune** : Light/Dark mode
- **A petit/normal/grand** : taille de texte (accessibility)
- **iOS/Android** : preview différents OS (subtil)
- **⌨ Simuler clavier** : pour tester scène 4 sans avoir à focus un vrai input

## Checklist de validation

### Bugs critiques fixés (les 3 principaux)

- [ ] **Bug clavier** (scène 4) : Active "⌨ Simuler clavier" — l'input bar reste visible, ne se cache pas. Sur device réel, focus l'input → clavier natif s'ouvre → input toujours visible.
- [ ] **Bug typographie** (scène 2) : Le mot "Hello" tient sur **une seule ligne** dans la bulle (pas 2). Vérifie aussi tous les messages courts.
- [ ] **Bug layout petit écran** : Ouvre les DevTools, simule largeur 320px (iPhone SE) — aucun élément déborde, tout reste utilisable.

### Validation esthétique

- [ ] Reconnaissable comme Bonzini (violet/ambre/orange du logo présents partout sans saturer)
- [ ] Empty state (scène 1) donne envie de discuter (illustration custom + copy chaleureux)
- [ ] Bulles avec queue (asymétriques) donnent personnalité (vs flat rectangles)
- [ ] Background subtil avec motif aux 3 couleurs (visible si tu plisses les yeux)
- [ ] Dark mode (toggle lune) — contrastes OK, lisible
- [ ] Tu trouves ça **beau et fluide**, pas "généré par IA"

### Interactions

- [ ] Boutons : feedback visuel au tap (scale subtle)
- [ ] Réactions emoji (scène 2) : tap dessus → on/off avec compteur qui change
- [ ] Voice playback (scène 6) : tap play → barres deviennent opaques
- [ ] Quick replies (scène 1) : tap → effet visuel
- [ ] Onglets : navigation fluide entre scénarios

### Sur device réel (le plus important)

- [ ] Ouvre `chat-mockup.html` sur ton iPhone Safari
- [ ] Va scène 4 → tape sur le textarea → le clavier iOS s'ouvre → vérifie que tu vois encore l'input
- [ ] Ferme le clavier → tout revient bien en place
- [ ] Pareil sur un Android (Chrome)
- [ ] Pareil sur un petit Android (genre Galaxy A) — pas de débordement

## Ce qui n'est PAS dans le mockup (volontairement)

- ❌ Animations Framer Motion (CSS suffit pour valider le LOOK ; Framer arrive en Phase B implémentation)
- ❌ Vraies données depuis Supabase (tout est mocké)
- ❌ Vrais uploads, voix réelle, etc. (juste visualisation)
- ❌ Toutes les variantes responsive desktop (focus mobile-first ici)
- ❌ Le bottom nav de l'app (le mockup chrome remplace ça pour navigation entre scénarios)

## Comment tu réagis

### Si tu valides → GO Phase B (implémentation React)

Réponds-moi "GO Phase B" et je code les vrais composants React :
- Refonte `src/components/support/*` (gardée propre, parallèle aux anciens via `v2/`)
- Framer Motion pour les anims clés (fade-in bulles, swipe-to-reply, etc.)
- `KeyboardSafeArea` partout
- Fix du `leading-snug` et du padding pour "Hello" 1 ligne
- Tests sur device réel
- Swap progressif des imports une fois validé
- Suppression de la v1
- ~3-5 jours de dev

### Si tu veux ajustements → on itère sur le HTML

Décris ce que tu veux changer (couleurs, layout, copy, illustrations, taille de bulles, etc.) et je modifie le `chat-mockup.html` directement. On peut itérer autant que nécessaire avant de toucher au React.

### Si tu rejettes la direction visuelle → retour en plan mode

Si le style WhatsApp-twist-Bonzini ne te plaît pas, dis-le et je propose une autre direction (iMessage / Slack / autre).

## État Git

Branche : `claude/chat-solution-evaluation-ReKZS`
Fichier : `public/chat-mockup.html`
Doc : `docs/refonte-ui-chat-mockup.md`

Le mockup ne touche AUCUN code React existant. Aucun risque pour la prod.
