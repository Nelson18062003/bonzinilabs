# Audit Tracking & Funnel — bonzinilabs.com

**Date** : 16 mai 2026
**Scope** : tracking installé sur la landing + parcours signup
**Méthode** : lecture statique du code, recherche `track(`, audit du hook UTM, parcours du formulaire signup
**Statut** : Phase 2 — lecture seule, aucun fichier modifié.

---

## Résumé exécutif

**Tu n'es pas à zéro tracking.** Vercel Analytics + UTM first-touch + 2 events custom sont en place. C'est même mieux que beaucoup de fintechs débutantes.

**Mais tu es aveugle sur 3 choses critiques pour optimiser** :

1. **Funnel signup** : tu ne sais pas où les gens abandonnent dans les 5 étapes du formulaire (11 champs). Tu ne sais pas si tes 10-15 signups sont sur 50 qui ont commencé ou sur 300.
2. **Funnel landing** : tu ne sais pas si les visiteurs ont vu le simulateur, lu la FAQ, scrollé jusqu'au CTA bottom. Tu ne peux pas dire "ils sont partis avant de voir X".
3. **Retargeting Facebook** : pas de Meta Pixel → les 1 046 clics qui n'ont pas converti sont **perdus définitivement**. Tu ne peux pas les recibler. C'est probablement la plus grosse perte sèche de la campagne d'avril.

**Verdict** : avant toute autre optimisation, instrumente. Sinon Phase 5–6 = on tire au pif.

---

## Ce qui EST installé aujourd'hui (état des lieux)

### 1. Vercel Analytics auto-pageviews

- **Où** : `src/App.tsx:14` import + `src/App.tsx:117` `<Analytics />`
- **Ce que ça mesure** : pageviews par route, vues uniques, top pages, vues par pays, vues par device. Données disponibles dans le dashboard Vercel.
- **Limite** : pas de funnel custom natif, pas de cohort, pas de propriétés user. Le free tier Vercel a une **limite de 2 500 events / mois** (à vérifier selon ton plan actuel) — au-delà, soit upgrade ($10/mo Pro pour 25K events), soit ils sont droppés silencieusement.

### 2. UTM first-touch attribution

- **Où** : `src/hooks/useUtmTracking.ts` (89 lignes)
- **Ce que ça fait** :
  - Capture `utm_source / utm_medium / utm_campaign / utm_content / utm_term` depuis l'URL au premier chargement
  - Stocke dans `localStorage` sous la clé `bonzini_utm`
  - **First-touch** (jamais écrasé) — bonne décision pour attribution
  - Cleared après signup réussi (`clearStoredUtm` ligne 71)
- **Activé globalement** : `src/App.tsx:106` `useCaptureUtm()`
- **Verdict** : **du bon travail**. C'est ce qui te permet de relier un signup à la campagne d'origine — à condition que l'URL de la pub FB ait des UTM (voir question critique en bas).

### 3. Events custom (2 seulement)

| Event | Fichier | Ce qui est envoyé |
|---|---|---|
| `cta_clicked` | `LandingPage.tsx:473-478` | `utm_source`, `utm_medium`, `utm_campaign`, `page_section: 'landing'` |
| `signup_completed` | `AuthPage.tsx:344-348` | `utm_source`, `utm_medium`, `utm_campaign` |

**Problèmes de ces events** :
- `cta_clicked` est tiré pour **les 3 CTA primaires** (nav, hero, bottom CTA) — tous avec le même `page_section: 'landing'` constant. Impossible de savoir lequel des 3 convertit le mieux.
- `signup_completed` ne signale que le **succès final**. Aucun signal sur les abandons intermédiaires.

### 4. Tracking auth (côté Supabase)

- L'inscription appelle `signUp()` (`AuthPage.tsx:332`) qui crée la session Supabase puis la table `clients` via le trigger `handle_new_user`. Les nouveaux comptes sont datés et requêtables côté DB.
- **Conclusion utile** : tu peux **historiquement** compter combien de comptes ont été créés par jour depuis Supabase — c'est ta source de vérité pour les 10-15 signups dont tu parlais. Tu n'as pas besoin d'analytics pour ça.

---

## Ce qui MANQUE (les trous)

### Trou n°1 — **Pas de Meta Pixel** — IMPACT MAXIMAL

- **Fichier** : `index.html` (audité, aucun script `fbevents.js` / `_fbq`)
- **Conséquence directe** :
  - **Impossible de retargeter** les 1 046 visiteurs landing → ils sont perdus pour toujours
  - **Impossible de créer une audience Lookalike** depuis tes signups (la fonctionnalité publicitaire FB la plus rentable en fintech)
  - **Pas d'optimisation FB Ads sur conversion** : Facebook ne peut pas optimiser la diffusion vers les profils qui convertissent, donc il diffuse à ceux qui *cliquent* (souvent les wrong fit)
- **Hypothèse forte** : sur les 30 000 XAF de la campagne, sans pixel, FB a optimisé pour des clics peu qualifiés. Une partie significative des 1 046 clics étaient probablement des curieux, pas des importateurs.

### Trou n°2 — **Funnel signup non instrumenté**

`AuthPage.tsx` a un `signupStep: 0 | 1 | 2 | 3 | 4` (`AuthPage.tsx:77`) — **5 étapes**. Le formulaire collecte ~11 champs : firstName, lastName, phone, DOB (3 sous-champs), companyName, activitySector, neighborhood, city, country, email, password, confirmPassword.

Pour un trafic froid méfiant, c'est **énorme**. Et tu ne mesures **aucun abandon par étape**.

- Si 80% abandonnent à l'étape 1 (info perso) → problème de friction / méfiance
- Si 80% abandonnent à l'étape 3 (companyName / activitySector) → champs "business" trop intimidants
- Si 80% abandonnent à l'étape 5 (password / confirm) → ils sont arrivés au bout mais bloquent sur le mot de passe
- **Aujourd'hui tu ne sais pas lequel.**

### Trou n°3 — Funnel landing non instrumenté

Aucun event pour :
- **Scroll depth** (25/50/75/100%)
- **Section vue** (Hero, Simulator, HowItWorks, Methods, FAQ, CTA bottom)
- **Interactions avec le simulateur** (changement de montant — `LandingPage.tsx:212`)
- **FAQ ouverte** (et laquelle — `LandingPage.tsx:368`)
- **Time on page** au-delà du pageview brut Vercel

Sans ces signaux : impossible de dire "le bounce vient du hero" vs "le bounce vient après la section méthodes" vs "ils lisent la FAQ mais ne cliquent pas le CTA".

### Trou n°4 — Pas de signal WhatsApp

- Pas de bouton WhatsApp sur la landing (Phase 1 axe 7)
- Donc pas d'event `whatsapp_clicked` à mesurer
- Conséquence : tu mesures un canal (signup web) en ignorant le canal de conversion historique (WhatsApp). Cohérent avec "0 DM reçus" — la mesure et le produit sont alignés sur la mauvaise stratégie.

### Trou n°5 — Aucun event "valeur business"

Le vrai succès business n'est pas le signup. C'est **le premier paiement effectué**. Or aucun event business n'est tracké :
- `payment_initiated` (l'utilisateur a cliqué "nouveau paiement")
- `payment_submitted` (formulaire envoyé)
- `payment_confirmed` (admin a validé)

Sans ces events, tu ne peux pas calculer : *"sur 12 signups campagne avril, combien ont fait au moins 1 paiement ?"* — alors que c'est **le KPI nord qui justifie ou non le coût d'acquisition**.

### Trou n°6 — Distinction des 3 CTA primaires

Comme noté plus haut, les 3 boutons CTA tirent le même event avec la même propriété. Petit trou, fix trivial (10 min), mais important pour la suite.

### Trou n°7 — Web Vitals non mesurés

Vercel Analytics ne mesure pas LCP/FID/CLS en prod. Il existe **Vercel Speed Insights** (séparé, gratuit avec limite) qu'il faudrait activer si on veut savoir si la page rame sur 4G CEMAC.

---

## Question critique à résoudre AVANT toute conclusion

**Tes URL de pub FB d'avril avaient-elles des paramètres UTM ?**

Si la pub linkait vers `https://bonzinilabs.com/` **sans UTM**, alors :
- `utm_source` était `null` → stocké comme `null` en localStorage
- Le code fallback (`AuthPage.tsx:345-347`) écrit `'direct'` dans `utm_source`
- **Tu ne peux pas distinguer aujourd'hui** les signups campagne FB des signups organiques / bouche-à-oreille

Si la pub linkait avec UTM (`?utm_source=facebook&utm_medium=cpc&utm_campaign=launch_avril_2026`), alors tu peux requêter Supabase pour compter exactement les signups attribués à la campagne.

**À me confirmer en fin de phase**. Si tu n'as pas mis d'UTM, ce n'est pas grave — c'est la prochaine campagne qu'il faut tagger. Mais pour les 10-15 signups d'avril, on perd l'attribution propre.

---

## Plan d'instrumentation minimal — priorisé par impact / effort

**Règle** : je distingue P0 (à faire avant tout relance campagne), P1 (à faire dans la semaine post-relance), P2 (nice-to-have).

### P0 — Bloquant avant prochaine campagne

| # | Action | Effort | Impact | Coût € |
|---|---|---|---|---|
| **P0.1** | **Installer Meta Pixel** dans `index.html` + event `Lead` au signup_completed | 30 min | **Très élevé** — débloque retargeting + lookalike + optim conversion | 0 |
| **P0.2** | **UTM-tagger toutes les URL de pub** avec `?utm_source=facebook&utm_medium=paid_social&utm_campaign=<nom_campagne>&utm_content=<variant_creatif>` | 5 min par lien | Élevé — attribution propre, base de tout le ROAS | 0 |
| **P0.3** | **Events funnel signup** : `signup_started`, `signup_step_completed` (avec n° étape), `signup_abandoned` (sur unload). Permet de voir QUELLE étape tue le funnel | 2h dev | Très élevé — saura où optimiser le form | 0 |
| **P0.4** | **CTA distinct** : modifier `cta_clicked` pour passer `cta_location: 'nav' \| 'hero' \| 'bottom'` au lieu de `page_section: 'landing'` | 10 min | Moyen — saura quel CTA convertit le mieux | 0 |

### P1 — À ajouter dans la semaine

| # | Action | Effort | Impact | Coût € |
|---|---|---|---|---|
| **P1.1** | **Scroll depth events** (25/50/75/100%) via IntersectionObserver | 30 min | Moyen | 0 |
| **P1.2** | **Section vue** : 1 event par section (hero, simulator, howItWorks, methods, faq, bottom_cta) | 1h | Élevé — diagnostic du point de bounce | 0 |
| **P1.3** | **Simulator interaction event** : quand user change le montant (`LandingPage.tsx:212`) | 10 min | Moyen — signal d'intérêt fort | 0 |
| **P1.4** | **FAQ click event** avec la question ouverte | 15 min | Moyen — quelles objections les gens cherchent à résoudre | 0 |
| **P1.5** | **Microsoft Clarity** (gratuit, illimité) : heatmaps + session replay. Voir littéralement où les gens bougent et où ils s'arrêtent | 5 min install | **Très élevé** pour le diagnostic qualitatif | 0 |
| **P1.6** | **Event `payment_initiated`** + `payment_submitted` dans le module paiement → calcul ROI réel d'acquisition | 1h | Élevé — KPI nord business | 0 |
| **P1.7** | **Vercel Speed Insights** activé pour mesurer LCP/CLS réel en prod sur 4G CEMAC | 5 min | Moyen — confirme/infirme hypothèse perf | 0–0,5 €/mo (free tier limité) |

### P2 — Nice-to-have, après relance

| # | Action | Effort | Impact | Coût € |
|---|---|---|---|---|
| **P2.1** | GA4 (gratuit, funnel avancé) si Vercel devient limitant | 30 min | Faible (Clarity + Vercel + Pixel suffisent pour cette taille) | 0 |
| **P2.2** | Dashboard interne `analytics_summary` dans Supabase (vue agrégeant signups par campagne, par étape, par jour) | 3h | Moyen — autonomie reporting | 0 |
| **P2.3** | Consent banner RGPD-compliant (cookies tracking) | 1-2h | Faible légalement en CEMAC, élevé si tu cibles aussi Europe plus tard | 0 |

**Total effort P0** : ~3h de dev. **Total effort P0 + P1** : ~8h de dev. **Coût matériel** : 0 €. Tout est gratuit / inclus dans le tier free.

---

## Ordre d'exécution recommandé (concret)

Si tu veux relancer une campagne dans les 2 semaines :

**Jour 1 (2h)** : P0.1 Meta Pixel + P0.4 CTA distinct + P0.2 UTM tagging des futures URL.
**Jour 2 (2h)** : P0.3 funnel signup events.
**Jour 3 (1h)** : P1.5 Clarity + P1.7 Speed Insights (5 min chacun) + P1.1 scroll depth.
**Jour 4 (2h)** : P1.2 section vue + P1.3 simulator + P1.4 FAQ.
**Jour 5 (1h)** : P1.6 events payment.

Total : 5 sessions, 8h cumulé. Faisable en 1 semaine en alternance.

**Après ces 5 jours**, tu lances une campagne et tu auras **enfin** la data pour itérer intelligemment au lieu de tirer dans le vide.

---

## Ce qui est démontré vs hypothèse

| Constat | Statut |
|---|---|
| Vercel Analytics installé, 2 events custom | **Démontré** (`App.tsx:14,117`, `LandingPage.tsx:6,473`, `AuthPage.tsx:5,344`) |
| UTM first-touch propre, persisté localStorage, cleared post-signup | **Démontré** (`useUtmTracking.ts`) |
| Pas de Meta Pixel | **Démontré** (recherche dans `index.html` et code) |
| Signup = 5 étapes / 11 champs | **Démontré** (`AuthPage.tsx:77`, `AuthPage.tsx:66-87`) |
| Aucun event d'abandon signup | **Démontré** (seul `signup_completed` existe) |
| Sans Pixel, FB n'a pas optimisé sur conversion en avril | **Hypothèse forte** (par construction du système Meta Ads) |
| 10-15 signups attribués campagne | **Estimation utilisateur** — à confirmer en requêtant Supabase sur la fenêtre + UTM si présents |
| Le bounce vient majoritairement du formulaire signup vs landing | **Hypothèse non testable** sans funnel events |

---

## Questions à valider avant Phase 3

1. **Tes URL de pub FB avaient-elles des UTM ?** Si non, on perd l'attribution propre des 10-15 signups d'avril. Pas grave si on accepte de partir "campagne suivante = baseline propre".
2. **Quel plan Vercel** (Hobby gratuit / Pro) ? Si Hobby, on est limité à 2 500 events/mois — il faudra prioriser quels events sont vraiment utiles.
3. **OK pour ajouter Meta Pixel, Clarity, Speed Insights** (3 outils tiers, traceurs cross-site) sans consent banner pour l'instant, vu cible CEMAC ? Tu prends la décision, je signale juste le risque légal théorique (faible en pratique sur ce marché aujourd'hui).

---

## Recommandation de transition vers Phase 3

Phase 2 conclut sur : **avant toute optim landing, instrumenter (P0 + P1, ~8h)**. Mais l'instrumentation seule ne te dira pas pourquoi la pub elle-même n'a pas mieux performé.

**Phase 3 = audit Facebook** (la page Bonzini Trading + le créatif sponsorisé du 28 avril). Là on cherche : la page FB inspire-t-elle confiance ? Le créatif et la copy sont-ils alignés avec la landing ? Le ciblage Meta Ads a-t-il bien été configuré pour "importateurs entrepreneurs" comme tu le voulais ?

C'est probablement là qu'on trouvera la moitié manquante du diagnostic : l'audit montre une landing à 2/5 mais l'autre moitié, c'est le créatif et le ciblage upstream.
