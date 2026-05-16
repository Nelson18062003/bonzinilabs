# Audit Landing Page — bonzinilabs.com

**Date** : 16 mai 2026
**Scope** : `src/pages/LandingPage.tsx` (495 lignes) + `index.html` + `src/i18n/locales/fr/landing.json`
**Méthode** : lecture statique du code source + fetch live (rendu SPA — JS requis)
**Statut** : Phase 1 — lecture seule, aucun fichier modifié.

---

## Résumé exécutif

| # | Axe | Score /5 | Verdict |
|---|---|---|---|
| 1 | Hook & proposition de valeur | **3** | OK mais flou sur l'identité de Bonzini |
| 2 | Trust signals | **1** | **Catastrophique — cause racine #1 probable** |
| 3 | Clarté du fonctionnement | **2** | Section "Tarifs" lien mort, pas de grille de prix |
| 4 | CTA | **2** | CTA secondaire cassé, CTA principal trop engageant pour trafic froid |
| 5 | Mobile-first | **3** | Globalement OK mais animations lourdes |
| 6 | Performance technique | **2** | Framer Motion + 3 polices + orbes blur = mobile low-end pénalisé |
| 7 | Adaptation marché local | **1** | **WhatsApp invisible, aucun numéro, footer mort** |
| 8 | SEO & social proof on-page | **2** | Meta OK, mais 0 témoignage, OG image faible, bug URL JSON-LD |

**Score moyen : 2,0 / 5**. La landing n'est pas catastrophique au design — elle est moderne, propre, animée. Mais elle est **conçue comme une SaaS européenne**, pas comme une fintech qui doit gagner la confiance d'un importateur camerounais sur Facebook. Les deux axes critiques pour ce marché (trust signals + adaptation locale) sont à 1/5.

---

## Axe 1 — Hook & proposition de valeur (5 premières secondes) — Score 3/5

### Observations

- **Badge hero** (`landing.json:9`) : *"Le paiement, c'est nous. Le business, c'est vous."* — slogan élégant en français business, mais **claim non prouvé** et ressemblant aux phrases marketing qu'utilisent les arnaqueurs. Un importateur camerounais qui ne connaît pas la marque le lit comme du bruit.
- **H1** (`landing.json:10-13` + `LandingPage.tsx:151-161`) : *"Votre fournisseur est **payé** avant ce soir"* — bonne accroche, orientée bénéfice. Mais **le mot "Bonzini" n'apparaît qu'en nav** (`LandingPage.tsx:85`) ; un visiteur qui arrive depuis FB n'apprend pas immédiatement ce qu'est l'entreprise.
- **Subtitle** (`landing.json:14`) : *"Alipay, WeChat, virement ou cash. Vous envoyez en francs CFA, votre fournisseur reçoit en yuan. Avec la preuve dans votre poche."* — clair et concret. Bon point.
- **Simulateur en hero** (`LandingPage.tsx:178-223`) : 360px de large, affiche XAF → CNY avec taux dynamique depuis `daily_rates`. **C'est l'élément le plus fort de la page** : preuve concrète, manipulable, valeur immédiate. À garder absolument.
- **Logo SVG inline** (`LandingPage.tsx:21-30`) avec les 3 couleurs (violet/amber/orange) → respect de la règle `CLAUDE.md > frontend.md`. Bon point.

### Points faibles

- Aucune mention de l'audience cible dans le hero ("importateurs", "commerçants", "entrepreneurs"). Le visiteur doit déduire que ça lui parle.
- "Payé avant ce soir" = promesse de délai très forte, jamais qualifiée (sous quelles conditions ?). En remittance, sur-promettre = perdre la confiance au premier raté.
- Mismatch avec la pub FB : la pub disait *"Payer vos fournisseurs en Chine n'a jamais été aussi simple"* (orienté méthode), la landing dit *"Votre fournisseur est payé avant ce soir"* (orienté délai). Cohérent mais différent — pas un problème majeur.

---

## Axe 2 — Trust signals — Score 1/5 — **CRITIQUE**

C'est l'axe le plus important pour ce marché et celui où la page échoue le plus. Voilà ce qui **manque totalement** :

### Ce qui manque (factuel, par recherche dans le code)

| Élément attendu en remittance Afrique | Présent ? | Localisation |
|---|---|---|
| Photo équipe (visages réels) | ❌ | nulle part |
| Témoignages clients (vidéo ou texte avec nom/photo) | ❌ | nulle part |
| Logos de banques/partenaires | ❌ | nulle part |
| Mention RCCM / numéro d'entreprise | ❌ | nulle part |
| Adresse physique (siège Yaoundé/Douala) | ❌ | nulle part |
| Badge sécurité / chiffrement / KYC | ❌ | nulle part |
| Ancienneté ("Depuis YYYY", "X mois d'activité") | ❌ | nulle part |
| Volume de transactions effectuées | ❌ | les stats sont marketing (5 pays, 4 modes), pas du social proof |
| Mentions légales fonctionnelles | ❌ | `LandingPage.tsx:441` — tous les liens footer sont `href="#"` mort |
| Page À propos / fondateur | ❌ | lien footer mort |
| Lien vers Facebook/Instagram Bonzini | ❌ | aucun lien social dans le footer |
| Avis Google / Trustpilot | ❌ | nulle part |
| Numéro WhatsApp affiché | ❌ | "WhatsApp" est un texte dans le footer avec `href="#"` mort (`LandingPage.tsx:422`) |

### Ce qui est présent comme "trust" mais qui ne marche pas

- Bandeau "Instantané" (`landing.json:22`) répété → claim non prouvé.
- Stats hero (`LandingPage.tsx:251-254`) : "5 pays / 4 modes / <5 min / 0 frais cachés" → aucune n'est un signal de confiance. Ce sont des features, pas des preuves.
- FAQ (`landing.json:83-90`) traite des questions techniques (montant min, taux, délai) **mais aucune des objections de méfiance**. Les vraies questions qu'un importateur se pose :
  - "Comment je sais que vous n'allez pas garder mon argent ?"
  - "Que se passe-t-il si le paiement échoue côté Chine ?"
  - "Êtes-vous agréés par la BEAC / le Ministère des Finances ?"
  - "Qui êtes-vous ?"
  - "Combien de paiements avez-vous déjà traités ?"
  - "Comment je récupère mon argent si je change d'avis ?"

  Aucune n'est traitée.

### Diagnostic axe 2

**Hypothèse forte (non démontrée par data mais structurellement très probable)** : sur 1 046 clics depuis la pub FB, une partie significative des bounces vient de cet axe. Un visiteur fintech-méfiant arrive, ne reconnaît aucun signal de légitimité, repart. Le créatif FB a fait son travail (générer la curiosité), la landing échoue à transformer la curiosité en confiance.

---

## Axe 3 — Clarté du fonctionnement — Score 2/5

### Observations

- **Section "Comment ça marche"** (`LandingPage.tsx:277-308`) : 4 étapes, design clair, animations Reveal. **Point fort**.
- **MAIS** la section nav annonce 3 ancres : `#fonctionnement`, `#tarifs`, `#faq` (`LandingPage.tsx:68-72`). Vérifié dans le code :
  - `#fonctionnement` → existe (`LandingPage.tsx:281`)
  - `#tarifs` → **N'EXISTE PAS** dans la page. Lien mort.
  - `#faq` → existe (`LandingPage.tsx:356`)
- **Pas de grille tarifaire**. Le hero affiche un taux dynamique, l'utilisateur ne peut pas voir la structure des frais avant de signer. Pour un produit qui clame "0 frais cachés" (`landing.json:43`), c'est paradoxal — il faut MONTRER la grille.
- **FAQ trop superficielle** (6 questions, aucune sur la sécurité/légitimité, voir axe 2).
- "5 minutes" annoncé sur les étapes (`landing.json:48`) → encore une sur-promesse qui n'est jamais qualifiée.

### Problème spécifique CEMAC

L'étape 04 (`landing.json:53`) dit *"Votre fournisseur reçoit les fonds immédiatement"*. Sur Alipay/WeChat oui (avec réserves), sur virement bancaire chinois c'est **faux** (1-3 jours). Cette phrase mélange les modes et fait une promesse intenable. Un importateur qui s'est fait avoir une fois ne pardonne pas.

---

## Axe 4 — CTA — Score 2/5

### Observations

- **3 CTA primaires identiques** menant tous au signup `/auth?mode=signup` (`LandingPage.tsx:471-480`) :
  - Nav `Envoyer un paiement` (ligne 93)
  - Hero `Envoyer un paiement` (ligne 168)
  - Bottom CTASection `Commencer maintenant` (ligne 396)
- **CTA secondaire HERO CASSÉ** : `LandingPage.tsx:171-173` — le bouton "Voir les taux" n'a **aucun onClick**. Cliquer = rien ne se passe. **C'est un bug fonctionnel** sur un élément above-the-fold. Pour un visiteur méfiant qui essaie un bouton et constate qu'il ne marche pas → signal d'arnaque immédiat.
- **Tracking CTA** (`LandingPage.tsx:471-479`) : event `cta_clicked` envoyé à `@vercel/analytics` avec UTM. C'est mieux que rien — mais Vercel Analytics ne mesure pas le bounce avec précision et pas de funnel custom natif. Sera détaillé en Phase 2.
- **Aucun CTA vers WhatsApp**. Pour un trafic froid fintech CEMAC où le canal de confiance est WhatsApp, c'est l'erreur stratégique #1.
- **Friction signup** : `/auth?mode=signup` → l'utilisateur doit créer un compte (email, mot de passe, vraisemblablement OTP) **avant tout contact humain**. À ce stade de méfiance, c'est trop d'engagement.

### Hiérarchie suggérée pour trafic froid (à valider en Phase 5)

1. **CTA primaire** : "Discuter sur WhatsApp" (numéro pré-rempli avec message contextuel)
2. **CTA secondaire** : "Simuler un paiement" (anchor vers le simulateur, déjà présent)
3. **CTA tertiaire** : "Créer mon compte" (pour ceux qui ont déjà confiance)

---

## Axe 5 — Mobile-first — Score 3/5

### Observations

- H1 `clamp(38px, 6.5vw, 68px)` (`LandingPage.tsx:151`) → bon scaling
- Stats `clamp(48px, 8vw, 72px)` (`LandingPage.tsx:262`) → bon
- H2 `clamp(32px, 5vw, 52px)` (`LandingPage.tsx:286`) → bon
- Hero a `padding: '100px 24px 60px'` (`LandingPage.tsx:134`) → 24px de padding latéral mobile = OK mais juste.
- **Simulateur** (`LandingPage.tsx:178`) : `width: 360, flexShrink: 0` → 360px fixe. Sur écran 360px de large (Android low-end fréquent en CEMAC), il occupe 100% sans marge. Sur 320px (iPhone SE/anciens), **il déborde**.
- Hero `flexWrap: 'wrap'` (`LandingPage.tsx:141`) → simulateur passe sous le texte sur mobile. OK mais le simulateur étant **l'élément de preuve le plus puissant**, le pousser sous le pli est dommage.
- Hamburger menu OK (`LandingPage.tsx:97-115`).
- Touch targets : boutons CTA `padding: '16px 32px'` → assez grands, OK.
- Pas de popup intrusive — bon point.

### Points faibles mobile spécifiques CEMAC

- Animations Framer Motion + orbes blur `filter: blur(80px)` (`LandingPage.tsx:137-138`) → coûteux GPU sur Android entrée de gamme. Pas mesuré, hypothèse.
- 3 polices Google Fonts à charger (`index.html:18`) + `Noto Sans SC` pour les caractères chinois → poids data non négligeable sur 3G/4G payée.
- Pas de version dégradée pour `prefers-reduced-motion` (peut-être existant mais pas dans le hero/orbes que j'ai lus).

---

## Axe 6 — Performance technique — Score 2/5

**Note : je n'ai pas lancé de Lighthouse réel — chiffres à mesurer en Phase 2.**

### Indices statiques

- **Framer Motion** chargé partout (Reveal sur chaque section, Counter animé, animations hero) — librairie ~50-70 KB gzip.
- **3 polices Google Fonts** (Syne, DM Sans, Noto Sans SC) avec 5+ poids chacune (`index.html:18`). Estimation : ~200-400 KB de webfonts si tous les poids sont utilisés. Bon point : chargement non-bloquant avec `media="print" onload="this.media='all'"`.
- **Orbes hero** avec `conic-gradient` + `filter: blur(80px)` + animations CSS continues (`LandingPage.tsx:137-138`) → coûteux à compositer sur GPU mobile bas de gamme.
- **Animation Counter** (`LandingPage.tsx:45-55`) avec setState à chaque frame pendant 2s × 4 stats = 240+ re-renders par animation. Pas catastrophique mais évitable.
- **Supabase query au load** (`LandingPage.tsx:461-469`) pour `daily_rates`. Une requête HTTP supplémentaire au paint. Acceptable si CDN edge proche, mais Supabase est sur AWS Frankfurt → latence visible Cameroun (~150-300ms).
- **Aucune image lourde** détectée — bon point (la landing est presque entièrement SVG + CSS).

### À mesurer en Phase 2

- Lighthouse mobile (LCP, FCP, CLS, TBT, TTI) sur 4G Slow simulé
- Poids total page first load
- Nombre de requêtes
- Score Web Vitals réel via Vercel Analytics (si activé)

---

## Axe 7 — Adaptation marché local — Score 1/5 — **CRITIQUE**

### Observations

| Élément local attendu | Présent ? |
|---|---|
| Numéro WhatsApp affiché (above-the-fold) | ❌ — texte "WhatsApp" en footer avec lien mort (`LandingPage.tsx:422`) |
| Numéro de téléphone format +237 | ❌ — nulle part |
| Adresse physique Yaoundé/Douala | ❌ — nulle part |
| Devise XAF affichée | ✅ — bien, dans simulateur et texte |
| Mention Cameroun en hero | ❌ — seulement dans le ticker (`landing.json:30`) qui défile vite |
| Pays CEMAC listés | ✅ — dans FAQ (`landing.json:89`) et ticker |
| Français adapté Afrique francophone | ⚠️ — le français employé est plutôt européen ("optimisé selon le volume", "écosystème WeChat") — pas mauvais mais pas idiomatique CEMAC |
| Bouton WhatsApp flottant (FAB) | ❌ — absent |
| Mention "agréé BEAC" ou équivalent | ❌ — nulle part |

### Constat dur

Pour un service qui dit cibler "les importateurs CEMAC" et qui a 90% de son funnel de conversion historique en DM WhatsApp (selon ton brief), **la landing ne propose à aucun moment de prendre WhatsApp**. C'est probablement la cause directe du "0 DM WA reçus" sur la campagne (sur ~1 046 clics).

---

## Axe 8 — SEO & social proof on-page — Score 2/5

### SEO technique

- ✅ `<title>` clair et bien rédigé (`index.html:26`) : *"Bonzini — Payez vos fournisseurs chinois en XAF"*
- ✅ Meta description optimisée (`index.html:27`)
- ✅ Meta keywords (`index.html:28`) — minoritaire en valeur SEO 2026 mais ne nuit pas
- ✅ JSON-LD Schema.org `FinancialService` présent (`index.html:45-56`)
- ✅ OG title/description/image (`index.html:32-37`)
- ✅ Twitter card (`index.html:39-43`)

### Bugs SEO trouvés

- **`index.html:54`** : `"url": "https://bonzini.com"` dans le JSON-LD. **Le site est bonzinilabs.com**. URL incorrecte dans le schema. À corriger.
- **OG image** = `/assets/bonzini-logo.jpg` (`index.html:35`) — c'est juste le logo. Pour un share Facebook/WhatsApp, une OG image marketing (1200×630) avec texte vendeur génère beaucoup plus de clics qu'un logo seul.
- **SPA-rendered** : le fetch live n'a renvoyé que le `<title>`. Les crawlers SEO qui n'exécutent pas JS (DuckDuckGo, Yandex, certains bots) ne voient pas le contenu. Google le voit mais avec délai d'indexation. À considérer si SEO organique est un objectif futur.

### Social proof on-page

- ❌ **0 témoignage** (texte, photo, vidéo)
- ❌ **0 chiffre social** ("X paiements traités", "X clients satisfaits")
- ❌ **0 vidéo explicative** (en CEMAC où le contenu vidéo a une portée énorme via WhatsApp)
- ❌ **0 logo client** ("ils nous font confiance")
- ❌ Les stats hero sont des features, pas du social proof

---

## Tracking installé (préparation Phase 2)

À noter pour la Phase 2, mais déjà dans le code :

- **`@vercel/analytics`** importé `LandingPage.tsx:6`
- **Event `cta_clicked`** envoyé avec UTM `LandingPage.tsx:473-478`
- **Hook `useUtmTracking`** existant `LandingPage.tsx:7` (à auditer en Phase 2)
- **Pas de Meta Pixel** trouvé dans `index.html` → **handicap majeur** pour retargeting FB Ads (audience de visiteurs landing perdue)
- **Pas de Google Analytics / GA4** trouvé

**Conclusion partielle** : tu as un tracking minimal (Vercel) mais pas l'infra pour retargeter sur Facebook ni pour mesurer le funnel détaillé (scroll, sections vues, abandon formulaire signup). Détails en Phase 2.

---

## Diagnostic d'ensemble (axes les plus impactants)

Classement par **impact probable sur le bounce de la campagne d'avril** :

1. **Axe 2 (Trust)** — score 1/5 — probablement la **cause racine #1**. Sans signaux de légitimité, un trafic froid méfiant ne convertit pas. Hypothèse forte, non démontrée faute de tracking détaillé.
2. **Axe 7 (Marché local)** — score 1/5 — **cause racine #2 démontrée** par "0 DM WhatsApp reçus" alors que c'est ton canal historique. La landing détourne du canal qui marche.
3. **Axe 4 (CTA)** — score 2/5 — friction signup trop forte + CTA secondaire cassé. Aggrave les deux ci-dessus.
4. **Axe 3 (Clarté)** — score 2/5 — section "Tarifs" promise en nav mais inexistante = perte de confiance.
5. **Axes 1, 5, 6, 8** — 2-3/5 — non bloquants individuellement mais à améliorer en seconde vague.

---

## Ce qui est démontré vs hypothèse

| Constat | Statut |
|---|---|
| `#tarifs` est un lien mort | **Démontré** (`LandingPage.tsx:71`, anchor absente) |
| Bouton "Voir les taux" sans onClick | **Démontré** (`LandingPage.tsx:171-173`) |
| Aucun témoignage on-page | **Démontré** (recherche dans le JSON et le code) |
| Aucun WhatsApp affiché | **Démontré** (`LandingPage.tsx:422` lien mort) |
| Footer tous liens morts | **Démontré** (`LandingPage.tsx:441` tous `href="#"`) |
| URL JSON-LD incorrecte | **Démontré** (`index.html:54`) |
| Vercel Analytics installé | **Démontré** (`LandingPage.tsx:6`) |
| Pas de Meta Pixel | **Démontré** (recherche dans `index.html`) |
| Animations lourdes mobile low-end | **Hypothèse** (à mesurer Lighthouse Phase 2) |
| Trust est la cause #1 du bounce | **Hypothèse forte** (cohérent avec contexte CEMAC, à valider par data) |
| Mismatch ad → landing message | **Léger** (cohérent globalement, créatif Phase 3) |

---

## Limites de l'audit

- **Pas de Lighthouse mesuré** (sera fait Phase 2)
- **Pas de funnel data** : on ne sait pas si le bounce vient du hero, des étapes, du CTA, du signup → manque de tracking détaillé (objet de Phase 2)
- **Pas de session recording** : je ne peux pas voir où les utilisateurs s'arrêtent
- **Pas de tests utilisateurs** : tous les insights sur "le visiteur méfiant pense X" sont des hypothèses fondées sur la littérature CRO + ton brief, pas sur des verbatims utilisateurs

---

## Recommandation de transition Phase 2

Avant toute optimisation, il faut **mesurer pour pouvoir optimiser**. La Phase 2 va auditer ce qui est tracké aujourd'hui et lister le minimum à ajouter (Meta Pixel pour retargeting, événements scroll/section/CTA détaillés, mesure du funnel signup) avant la prochaine campagne — sinon on rejoue à l'aveugle.
