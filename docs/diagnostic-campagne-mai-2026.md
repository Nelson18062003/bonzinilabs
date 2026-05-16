# Diagnostic Campagne du 28 avril 2026 — Synthèse cross-volets

**Date** : 16 mai 2026
**Scope** : synthèse des Phases 1 (landing) + 2 (tracking) + 3 (Facebook) en un diagnostic unique
**Méthode** : classement des causes racines par **impact × probabilité × statut de preuve**
**Statut** : Phase 4 — lecture seule, aucun fichier modifié.

---

## TL;DR — Ce qui s'est probablement passé en 5 lignes

1. La campagne FB a touché ~75 K personnes au Cameroun pour 30 K XAF. **Le créatif a fait son job** (CTR 1,39 %).
2. **Mais l'ad a été configurée pour pousser vers la landing au lieu d'ouvrir WhatsApp directement** → 0 DM entrant alors que c'est ton canal de conversion historique.
3. Les ~1 046 clics ont atterri sur une **landing qui ne propose nulle part de WhatsApp** (lien mort dans footer) et qui force un **signup à 5 étapes / 11 champs** avant tout contact humain.
4. Résultat : 10–15 signups (CR landing ~1 %, bas mais pas absurde pour fintech cold). Ton père et toi avez dû ensuite **appeler/écrire les 10–15 manuellement** — inversion du funnel naturel, non scalable.
5. **Sans Meta Pixel installé**, les 1 046 visiteurs sont perdus pour retargeting → la prochaine campagne devra **tout payer à nouveau pour le même trafic**.

**La sous-performance n'est pas une seule erreur — c'est une chaîne de 3 erreurs qui se cumulent.** Aucune n'est isolée fatale, mais ensemble elles tuent le ROAS.

---

## Le funnel observé (la seule donnée dure)

```
75 300 personnes touchées (unique reach FB)
        │
        │  CTR 1,39 %  ← performance correcte, créatif OK
        ▼
 1 046 clics vers la landing
        │
        │  ??? bounces / abandons   ← TROU TRACKING
        ▼
   ?? signups commencés   ← TROU TRACKING (5 étapes non instrumentées)
        │
        │  CR estimé ~1 %
        ▼
  10–15 signups complétés
        │
        │  contact manuel sortant par toi
        ▼
   0 DM WhatsApp entrants
        │
   ??? premier paiement effectué   ← TROU TRACKING + non instrumenté
```

**Sur ce funnel, on a 3 chiffres durs (75 300 / 1 046 / 0 DM) et 1 estimation (10–15). Tout le reste est noir.**

---

## Top causes racines — classement par impact × probabilité

Échelle :
- **Impact** : 1 (mineur) → 5 (tueur de campagne)
- **Probabilité** : % que ce soit une cause significative de la sous-performance (basé sur preuves dispos)
- **Statut** : `Démontré` / `Hypothèse forte` / `À tester`

### Rang 1 — Mauvais format publicitaire (Web Traffic vs Click-to-WhatsApp)

| | |
|---|---|
| **Impact** | 5/5 |
| **Probabilité** | 90 % |
| **Statut** | Hypothèse forte (à confirmer avec capture Ads Manager) |
| **Source audit** | Phase 3, section 4 |

**Pourquoi** : tu as toi-même dit que 90 % de ton funnel historique convertit en DM WhatsApp. Avoir choisi un objectif "Trafic vers site web" / "En savoir plus" au lieu d'un objectif "Click-to-WhatsApp" = route le budget vers le canal qui ne convertit pas.

**Preuves directes** : 0 DM entrant sur 75 300 personnes touchées (démontré). Ce résultat est **impossible** si le bouton CTA de l'ad avait été "Envoyer un message WhatsApp" — par construction du format Meta Ads, ce bouton ouvre directement WhatsApp. Donc le bouton était autre chose.

**Si tu veux contre-tester** : capture Meta Ads Manager → vérifie le "Bouton d'appel à l'action" de la pub.

---

### Rang 2 — Landing sans WhatsApp, signup trop lourd, zéro trust

| | |
|---|---|
| **Impact** | 5/5 |
| **Probabilité** | 85 % |
| **Statut** | Démontré (code + structure) + Hypothèse forte (impact comportemental) |
| **Source audit** | Phase 1, axes 2 + 4 + 7 |

**Pourquoi** : sur les 1 046 clics qui sont quand même arrivés sur la landing, on a probablement perdu la plupart par cumul de :
- ❌ Aucun WhatsApp visible (lien `href="#"` mort dans footer, `LandingPage.tsx:422`)
- ❌ Bouton "Voir les taux" cassé (`LandingPage.tsx:171-173`, pas de onClick)
- ❌ Lien `#tarifs` dans nav mais section absente
- ❌ Signup 5 étapes / 11 champs (`AuthPage.tsx:77`) → friction massive pour cold traffic méfiant
- ❌ 0 témoignage, 0 photo équipe, 0 RCCM, 0 adresse, 0 ancienneté, 0 chiffre social

**Preuves directes** : tout est démontré dans le code (Phase 1).

**Ce qui reste hypothèse** : la part exacte du bounce attribuable à chaque facteur. On ne pourra pas trancher tant qu'on n'a pas Microsoft Clarity + events funnel signup (Phase 2 P1.5 et P0.3).

---

### Rang 3 — Pas de Meta Pixel → perte sèche des 1 046 visiteurs

| | |
|---|---|
| **Impact** | 4/5 (sur le moyen terme) |
| **Probabilité** | 100 % |
| **Statut** | Démontré |
| **Source audit** | Phase 2, trou n°1 |

**Pourquoi** : sans Pixel, impossible de :
- Retargeter les 1 046 visiteurs sur les campagnes suivantes (le scénario "ils sont déjà venus une fois, on les recroise" est mort)
- Créer une Lookalike Audience à partir des 10–15 signups (la fonction publicitaire la plus rentable en fintech Meta Ads)
- Faire optimiser FB sur la conversion réelle au lieu de sur les clics

**Conséquence** : la prochaine campagne devra **repayer le CPM complet** pour toucher le même type d'audience, sans bénéfice cumulatif des 1 046 premiers visites. C'est l'erreur la plus chère sur le moyen terme.

---

### Rang 4 — Page FB ne convertit pas en confiance

| | |
|---|---|
| **Impact** | 3/5 |
| **Probabilité** | 75 % |
| **Statut** | Démontré (0 follower gagné) + Hypothèse forte (pour les causes exactes) |
| **Source audit** | Phase 3, métriques + section 8 |

**Pourquoi** : **0 nouveau follower sur 75 300 personnes touchées** est un signal fort. Cumul probable de :
- Page jeune (probablement < 6 mois — à confirmer)
- Photo de profil / couverture peut-être pas optimisées (non auditable sans capture)
- Pas d'avis / recommandations clients (catégorie probablement non activée)
- Posts organiques irréguliers ou de qualité faible (tu l'as dit toi-même en Phase 0)
- Pas de social proof visible (catégorie "Recommandations" probablement off)

**Indice positif caché** : 82 partages = les gens **partagent en DM** pour demander un avis avant de cliquer. Ils CHERCHENT activement une validation. Si la page FB avait des avis publics, ces 82 partages aboutiraient à plus de conversions indirectes.

---

### Rang 5 — Violations brand "envoyer de l'argent" (créatif + copy)

| | |
|---|---|
| **Impact** | 2/5 |
| **Probabilité** | 60 % |
| **Statut** | Démontré (visuel + copy) + Hypothèse modérée (impact comportemental) |
| **Source audit** | Phase 3, sections 2 + 3 |

**Pourquoi** : ta propre règle brand interdit "envoyer de l'argent" car ça active les filtres mentaux "arnaque transfert d'argent" très présents en CEMAC, et confond l'identité (importateur ≠ money sender). La pub viole la règle 2 fois (tagline flyer + bullet 2 du copy).

**Pourquoi seulement impact 2/5** : la phrase est noyée dans un contexte clair de "fournisseurs en Chine". Le top-hook "Payer vos fournisseurs en Chine" reste dominant. L'impact existe mais ce n'est pas le facteur tueur principal. À corriger pour la prochaine campagne, mais pas l'explication n°1 de la sous-perf.

---

### Rang 6 — Ciblage Meta Ads probablement trop large

| | |
|---|---|
| **Impact** | 3/5 |
| **Probabilité** | 65 % |
| **Statut** | Hypothèse modérée |
| **Source audit** | Phase 3, section 7 (non auditable sans capture) |

**Pourquoi** : 75 K reach unique sur ~30 K XAF en CEMAC avec CPM bas suggère ciblage assez large. Le "Boost Publication" rapide Meta propose par défaut une audience suggérée souvent trop large. Si tu n'as pas explicitement précisé "intérêts importation / Alibaba / Yiwu / commerce de gros / e-commerce business" + "âge 25–55" + "Yaoundé/Douala" + "chefs d'entreprise / employés autonomes", Meta a diffusé large.

**À tester** : la prochaine campagne avec un ciblage volontairement étroit (au prix d'un CPM plus haut) → comparer CR et coût par signup.

---

### Rang 7 — Aucun tracking funnel signup

| | |
|---|---|
| **Impact** | 4/5 (pour optimiser) — 2/5 (pour la perf passée) |
| **Probabilité** | 100 % |
| **Statut** | Démontré |
| **Source audit** | Phase 2, trou n°2 |

**Pourquoi** : on ne peut pas savoir où les gens abandonnent dans les 5 étapes du formulaire signup. Donc on ne peut pas optimiser intelligemment. C'est moins une cause de la sous-perf passée qu'un **bloqueur pour toute optimisation future**.

---

### Rang 8 — Performance mobile non mesurée (animations lourdes)

| | |
|---|---|
| **Impact** | 2/5 (estimation) |
| **Probabilité** | 40 % |
| **Statut** | Hypothèse modérée |
| **Source audit** | Phase 1, axe 5 + 6 |

**Pourquoi** : Framer Motion + 3 polices Google Fonts + orbes blur conic-gradient = lourd pour Android low-end sur 3G/4G CEMAC. Mais non mesuré. À vérifier avec Lighthouse + Vercel Speed Insights (Phase 2 P1.7).

---

## Matrice de synthèse — démontré / hypothèse / à tester

| Cause | Démontré | Hypothèse forte | À tester (A/B ou data) |
|---|---|---|---|
| Mauvais format ad (Web vs Click-to-WA) | 0 DM entrant | Impact massif | A/B Click-to-WA vs Web sur prochaine campagne |
| WhatsApp absent landing | Code | Cause directe friction | – |
| Signup 5 étapes trop lourd | Code | Impact friction | Events funnel signup pour mesurer |
| Trust signals absents | Code | Cause bounce méfiance | Tests utilisateurs CEMAC ou Clarity heatmaps |
| Pas de Meta Pixel | Code (absence) | Perte retargeting | – |
| Page FB pauvre | 0 follower gagné | Causes exactes | Captures FB à fournir |
| Violations brand "envoyer de l'argent" | Visuel + copy | Impact comportemental | A/B copy "payer" vs "envoyer" |
| Ciblage trop large | – | 65 % probable | Capture Ads Manager ou test ciblage étroit |
| Perf mobile dégradée | – | 40 % probable | Lighthouse + Speed Insights |
| Lien `#tarifs` mort + bouton "Voir les taux" cassé | Code | Méfiance immédiate | – |

---

## Ce qu'on NE peut PAS conclure (limites honnêtes)

1. **Quelle proportion exacte des 1 046 clics venait de la vraie cible** (importateurs vs curieux) → sans capture Ads Manager + sans Pixel, inconnu.
2. **Le bounce rate réel de la landing** → estimation 70–90 % cohérente fintech cold, mais non mesuré.
3. **À quelle étape du formulaire signup les gens abandonnent** → tracking absent.
4. **Si les 10–15 signups étaient des leads qualifiés** (premier paiement à venir) ou des curieux → métrique "premier paiement" non trackée.
5. **Si la campagne aurait été rentable à terme** → manque LTV moyen client connu.
6. **Si le créatif visuel performe mieux ou moins bien qu'un alternatif** → 1 seul créatif testé, pas d'A/B.
7. **Quelle part du bounce vient du device** (mobile low-end vs desktop) → Vercel Analytics le sait peut-être déjà, à requêter.

---

## Le seul vrai chiffre de qualité à valider en interne (avant Phase 5)

**Sur les 10–15 signups d'avril, combien ont effectué au moins 1 paiement à ce jour (16 mai) ?**

C'est requêtable directement en SQL :
```sql
-- À adapter au schéma exact (clients, ledger_entries)
SELECT
  COUNT(DISTINCT c.id) AS signups,
  COUNT(DISTINCT CASE WHEN le.amount > 0 THEN c.id END) AS paying_signups
FROM clients c
LEFT JOIN ledger_entries le ON le.client_id = c.id
  AND le.type = 'payment'  -- adapter à ton enum
WHERE c.created_at BETWEEN '2026-04-28' AND '2026-05-16';
```

Si le résultat est :
- **0–1 paying** : la campagne a essentiellement attiré des curieux, le coût d'acquisition n'a pas généré de business. Décision pour la suite : repenser l'offre ou changer drastiquement le ciblage.
- **3–5 paying** : la campagne a délivré du business mais à coût élevé (~6–10 K XAF par client payant). Acceptable si LTV ≥ 30 K XAF.
- **8+ paying** : la campagne a été un succès silencieux et tu sous-estimes le résultat. Le problème est juste de mesure, pas de stratégie.

**Tu peux requêter ça côté Supabase et me dire le chiffre** — ça changera fortement les priorités de la Phase 5.

---

## Narratif probable (ce qui s'est passé étape par étape)

1. **Tu lances un Boost Publication FB** avec un visuel propre + une copy correcte + 30 K XAF de budget, ciblage suggéré par Meta (probablement assez large).
2. **Meta diffuse à 75 K personnes uniques au Cameroun en 2 semaines**. Le CPM bas suggère du ciblage large. Une fraction (estimée 10–30 %) sont des importateurs réels.
3. **Le créatif performe correctement** : 1,39 % CTR, ce qui est honnête pour fintech cold.
4. **1 046 personnes cliquent et arrivent sur la landing**. Elles s'attendent (depuis l'ad) à trouver facilement WhatsApp pour poser leurs questions.
5. **Elles ne trouvent pas WhatsApp**. Elles voient un site moderne, propre, mais sans aucune preuve de légitimité (pas d'équipe, pas de témoignage, pas d'adresse, pas de RCCM). Le bouton "Voir les taux" ne fait rien quand on clique. Le lien "Tarifs" du menu mène à du vide.
6. **80–90 % rebondissent immédiatement** (cohérent benchmarks fintech cold).
7. **Une minorité (~50–100 ?) commence le signup**. Découvre un formulaire à 5 étapes / 11 champs. La plupart abandonnent. ~10–15 vont jusqu'au bout — probablement les moins méfiants, ou ceux qui te connaissent déjà.
8. **Toi et ton père contactez manuellement les 10–15 par WhatsApp** pour les rassurer et les onboarder. Inversion du funnel naturel. Très coûteux en temps.
9. **0 DM entrant** sur la durée parce que la pub pointait vers la landing, pas vers WhatsApp.
10. **Les 1 046 visiteurs perdus le sont définitivement** : pas de Meta Pixel pour les retargeter.

---

## Ce que la Phase 5 va construire

Maintenant qu'on a le diagnostic, la Phase 5 doit produire **une matrice impact / effort priorisée** avec :

- **Quick wins (< 4h)** : ce qu'on peut corriger immédiatement (bug "Voir les taux", lien `#tarifs`, ajout numéro WhatsApp visible, Meta Pixel)
- **Corrections moyennes (4 h – 1 jour)** : trust signals minimaux, simplification signup, événements tracking funnel, bouton WhatsApp flottant
- **Refontes structurelles (> 1 semaine)** : section témoignages avec vrais clients, vidéo explicative, refonte page FB, click-to-WhatsApp ads
- **Pour chaque reco** : ce qui change, gain attendu (ordre de grandeur réaliste sans promesse de doublement), risque, coût en temps

**Avant Phase 5, j'ai besoin de** :

1. Le résultat de la requête SQL ci-dessus (combien des 10–15 signups ont payé)
2. Idéalement les captures Phase 3 (Ads Manager + page FB), sinon on note la limite et on avance
3. Validation de la métrique nord proposée en Phase 0 : **DM WhatsApp qualifiés entrants** (tu m'avais dit "je te laisse décider" — je propose qu'on confirme ça comme KPI nord pour la prochaine campagne)
