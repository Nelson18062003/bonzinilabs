# 📱 Checklist de Tests Mobile - Bonzini Admin

## 🎯 Objectif
Valider l'expérience mobile-first sur tous les écrans critiques de l'interface Admin.

## 📐 Viewports à Tester

### Mobile (Priorité Haute)
- **iPhone 12 Pro** : 390 x 844px (viewport cible principal)
- **iPhone SE** : 375 x 667px (plus petit viewport iOS)
- **Android (Pixel 5)** : 360 x 640px (Android standard)

### Tablet
- **iPad** : 768 x 1024px (transition mobile → desktop)

### Desktop
- **Desktop** : 1920 x 1080px (vérification non-régression)

---

## ✅ Tests par Page

### 1. AdminPaymentsPage (`/admin/payments`)

#### Layout & Navigation
- [ ] Header responsive : titre + sous-titre + actions visibles
- [ ] Boutons actions (Scanner/Export/Créer) :
  - [ ] Mobile : full width ou icônes only, espacement généreux
  - [ ] Tablet+ : horizontal layout, labels visibles

#### Filtres
- [ ] Barre de recherche : 44px minimum touch target
- [ ] Filtres de statut :
  - [ ] Scroll horizontal smooth sur mobile
  - [ ] Pas de débordement visuel
  - [ ] Badges lisibles (text-sm = 14px minimum)
  - [ ] Touch targets 44x44px minimum
- [ ] Filtres de méthode :
  - [ ] Scroll horizontal smooth
  - [ ] Texte lisible

#### Cards de Paiement
- [ ] Padding généreux (16px mobile, 20px tablet+)
- [ ] Hiérarchie typographique claire :
  - [ ] Montant : 20px (xl) mobile, 24px (2xl) tablet+
  - [ ] Infos client : 14px minimum
  - [ ] Date : 12px minimum
- [ ] Status badge : 14px text, visible et lisible
- [ ] Icônes : 16px minimum
- [ ] Interaction touch :
  - [ ] Hover state sur desktop
  - [ ] Active state (scale-[0.99]) sur mobile

#### Performance
- [ ] Scroll 60fps sans jank
- [ ] Pas de zoom involontaire lors du tap sur inputs
- [ ] Transitions smooth

---

### 2. AdminRatesPage (`/admin/rates`)

#### Header & Taux Actuel
- [ ] Card taux actuel : responsive padding
- [ ] Typographie : 24px (3xl) mobile → 32px (4xl) tablet+
- [ ] Date mise à jour lisible

#### Filtres de Période
- [ ] Boutons période (7j/30j/3m) :
  - [ ] Scroll horizontal smooth
  - [ ] Touch targets 44x44px
  - [ ] Texte lisible (14px)
  - [ ] Pas de débordement

#### Chart ResponsiveRateChart
- [ ] Hauteur responsive :
  - [ ] Mobile : 250px
  - [ ] Tablet : 300px
  - [ ] Desktop : 350px
- [ ] Chart lisible et interactions touch fonctionnelles
- [ ] Tooltip s'affiche correctement sur tap mobile
- [ ] Axes et labels lisibles (12px minimum)

#### Tableau Historique ResponsiveRateTable
- [ ] Mobile (< 640px) :
  - [ ] Affiche cards empilées (pas table)
  - [ ] Cards avec padding généreux
  - [ ] Icônes et texte lisibles
- [ ] Tablet+ (>= 640px) :
  - [ ] Affiche table classique
  - [ ] Headers et données alignés

#### Simulateur Conversion
- [ ] Layout :
  - [ ] Mobile : stack vertical (grid-cols-1)
  - [ ] Tablet+ : 2 colonnes (grid-cols-2)
- [ ] Inputs : 44px minimum height
- [ ] Labels : 14px minimum
- [ ] Calendar :
  - [ ] Mobile : full width
  - [ ] Tablet+ : width auto

---

### 3. AdminDepositsPage (`/admin/deposits`)

#### Stats Cards
- [ ] Mobile : scroll horizontal smooth
- [ ] Desktop (lg+) : grid 6 colonnes
- [ ] Cards : 100px width mobile, texte lisible
- [ ] Nombres : 20px (xl), labels : 12px (xs)

#### Filtres
- [ ] Recherche : full width mobile
- [ ] Select statut/méthode :
  - [ ] Mobile : full width
  - [ ] Tablet+ : width fixe (160px)
- [ ] Touch targets 44px minimum

#### Liste Dépôts
- [ ] Cards responsive :
  - [ ] Padding : 12px mobile, 16px tablet+
  - [ ] Avatar : 36px mobile, 40px tablet+
  - [ ] Textes lisibles (14px minimum)
  - [ ] Status badge visible
- [ ] Boutons actions :
  - [ ] Height 32px (h-8)
  - [ ] Icônes 12px
  - [ ] Labels : visible tablet+ seulement
- [ ] Active state sur tap

#### Delete Dialog
- [ ] Max width : 90vw mobile, 512px tablet+
- [ ] Footer :
  - [ ] Mobile : flex-col (boutons empilés)
  - [ ] Tablet+ : flex-row (boutons côte à côte)
- [ ] Boutons full width mobile

---

### 4. AdminDashboard (`/admin`)

#### Stats Grid
- [ ] AdminStatGrid responsive :
  - [ ] Mobile : 2 colonnes
  - [ ] Desktop : 4 colonnes
- [ ] Cards lisibles avec icônes

#### Taux du Jour Card
- [ ] Card gradient primary visible
- [ ] Texte contrasté et lisible

#### Two Column Layout
- [ ] Mobile : stack vertical (1 colonne)
- [ ] Tablet+ : 2 colonnes côte à côte
- [ ] Pending Deposits & Payments cards :
  - [ ] Header padding : 16px mobile, 20px tablet+
  - [ ] Items padding : 12px mobile, 16px tablet+
  - [ ] Avatars : 32px mobile, 36px tablet+

#### Activité Récente
- [ ] Items lisibles
- [ ] Avatars : 28px mobile, 32px tablet+
- [ ] Texte tronqué correctement

---

## 🔍 Vérifications WCAG AA

### Taille de Texte
- [ ] Aucun texte < 14px (0.875rem) sauf exceptions justifiées
- [ ] text-xs (12px) utilisé uniquement pour métadonnées secondaires
- [ ] Labels et contenus principaux >= 14px

### Touch Targets
- [ ] Tous les boutons >= 44x44px
- [ ] Inputs >= 44px height
- [ ] Badges cliquables >= 44x44px
- [ ] Espacement >= 8px entre éléments tactiles adjacents

### Contraste
- [ ] Texte foreground/background : ratio >= 4.5:1
- [ ] Texte muted-foreground : ratio >= 4.5:1
- [ ] Icons et badges : contraste suffisant

### Navigation Clavier
- [ ] Tab order logique sur tous les formulaires
- [ ] Focus visible sur tous les éléments interactifs
- [ ] Pas de keyboard trap

---

## ⚡ Tests de Performance

### Scroll Performance
- [ ] Scroll containers (AdminScrollContainer) :
  - [ ] 60fps sans jank
  - [ ] scrollbar-hide fonctionne (scrollbar masquée mais scroll actif)
  - [ ] Smooth scroll sur mobile

### Chart Rendering
- [ ] ResponsiveRateChart render < 300ms sur mobile
- [ ] Pas de freeze lors du tap/zoom

### Page Load
- [ ] First Contentful Paint < 1.5s sur 3G
- [ ] Time to Interactive < 3s sur 3G
- [ ] Pas de layout shift

### Animations
- [ ] Transitions smooth (200ms)
- [ ] Pas de jank sur active states (scale-[0.99])
- [ ] Hover states désactivés sur touch devices

---

## 🧪 Tests Spécifiques Mobile

### iOS Safari
- [ ] Pas de zoom involontaire lors du focus input (16px minimum)
- [ ] Safe areas respectées (padding-bottom/top)
- [ ] Scroll bounce natif préservé
- [ ] Touch callout désactivé si nécessaire

### Android Chrome
- [ ] Inputs avec bon type (number, tel, email)
- [ ] Autocomplete fonctionnel
- [ ] Back button navigation OK
- [ ] Pull-to-refresh désactivé si nécessaire

### Gestures
- [ ] Swipe horizontal sur scroll containers fonctionne
- [ ] Pinch-to-zoom désactivé sur layout (si voulu)
- [ ] Long press n'interfère pas avec interactions

---

## 🐛 Bugs Courants à Vérifier

### Layout
- [ ] Pas de débordement horizontal
- [ ] Pas de contenu tronqué de manière incorrecte
- [ ] Padding/margin cohérents

### Typography
- [ ] Pas de texte trop petit (< 14px)
- [ ] Pas de texte qui se chevauche
- [ ] Ellipsis fonctionne (truncate)

### Interactions
- [ ] Pas de double-tap zoom involontaire
- [ ] Boutons répondent au premier tap
- [ ] Pas de click delay (300ms)

### Performance
- [ ] Pas de memory leak sur scroll
- [ ] Charts ne ralentissent pas la page
- [ ] Images optimisées et lazy-loaded

---

## ✅ Critères de Validation

### Must Have (Bloquant)
- ✅ Toutes les pages critiques (Payments, Rates, Deposits, Dashboard) fonctionnelles sur iPhone 12 Pro (390px)
- ✅ Aucun texte < 14px sauf métadonnées secondaires
- ✅ Tous les touch targets >= 44x44px
- ✅ Pas de débordement horizontal
- ✅ Inputs 16px minimum (évite zoom iOS)

### Should Have (Important)
- ⚠️ Scroll 60fps sur la plupart des devices
- ⚠️ Charts responsive et interactifs
- ⚠️ Active states visibles sur mobile
- ⚠️ Navigation clavier fonctionnelle

### Nice to Have (Améliorations futures)
- 💡 Bottom sheets au lieu de Select dropdowns
- 💡 Swipe gestures pour actions
- 💡 Pull-to-refresh sur listes
- 💡 Animations avancées (skeleton loaders)

---

## 📊 Outils de Test

### Browser DevTools
- Chrome DevTools → Device Mode
- Safari Web Inspector → Responsive Design Mode
- Firefox Responsive Design Mode

### Real Devices (Recommandé)
- iPhone physique (Safari)
- Android physique (Chrome)

### Automated Testing
```bash
# Lighthouse audit (mobile)
npm run lighthouse

# Accessibility audit
npm run a11y

# Visual regression (optionnel)
npm run percy
```

### Browser Stack / Sauce Labs
- Tests cross-browser automatisés
- Real device cloud

---

## 📝 Rapport de Test Template

```markdown
### Test Run: [Date]
**Device:** [iPhone 12 Pro / Android Pixel 5 / etc.]
**Browser:** [Safari 17 / Chrome 120 / etc.]
**Viewport:** [390x844 / 360x640 / etc.]

#### Pages Testées
- [ ] AdminPaymentsPage: ✅ / ❌
- [ ] AdminRatesPage: ✅ / ❌
- [ ] AdminDepositsPage: ✅ / ❌
- [ ] AdminDashboard: ✅ / ❌

#### Issues Trouvés
1. [Description du bug]
   - Severity: High / Medium / Low
   - Screenshot: [lien]
   - Steps to reproduce: [...]

#### Performance
- Scroll FPS: [60fps / 45fps / etc.]
- Chart render: [150ms / 400ms / etc.]
- Page load (3G): [2.1s / 3.5s / etc.]

#### Conclusion
[Résumé global, prêt pour prod ou non]
```

---

## 🚀 Prochaines Étapes

1. **Tester manuellement** sur iPhone 12 Pro (390px) en priorité
2. **Corriger** les bugs bloquants trouvés
3. **Valider** sur Android (360px)
4. **Lighthouse audit** pour accessibilité et performance
5. **Déploiement** une fois tous les Must Have validés
