# Recommandations priorisées — Plan d'action Bonzini

**Date** : 16 mai 2026
**Source** : audits Phases 1-4 (`docs/audit-landing-bonzini.md`, `docs/audit-tracking-bonzini.md`, `docs/audit-facebook-bonzini.md`, `docs/diagnostic-campagne-mai-2026.md`)
**Méthode** : matrice impact × effort. Quick wins en haut, refontes structurelles en bas. Ordre de grandeur d'impact réaliste — **aucune promesse de doublement de conversion**.
**Statut** : Phase 5 — lecture seule, aucun fichier modifié. Phase 6 (implémentation) seulement après validation par lots.

**KPI nord validé** : DM WhatsApp qualifiés entrants.

---

## Pré-requis : 1 requête SQL à exécuter (2 minutes)

Avant tout sprint d'action, requêter Supabase pour obtenir le seul chiffre business manquant. C'est gratuit, c'est rapide, et ça change drastiquement les priorités si la valeur est très haute ou très basse.

```sql
-- À adapter au schéma exact selon ton modèle ledger
SELECT
  COUNT(DISTINCT c.id) AS signups_total,
  COUNT(DISTINCT le.client_id) AS signups_with_at_least_one_payment
FROM clients c
LEFT JOIN ledger_entries le
  ON le.client_id = c.id
  AND le.created_at >= '2026-04-28'
WHERE c.created_at BETWEEN '2026-04-28' AND '2026-05-16';
```

Interprétation :
- **0–1 paying** → priorité = repenser le **qui** on cible et le **quoi** on offre. Pas la peine d'optimiser un funnel qui ramène les mauvaises personnes.
- **2–4 paying** → coût ~7,5–15 K XAF par client payant. Priorité = lower friction + Pixel pour retargeting (les hypothèses ci-dessous tiennent).
- **5+ paying** → la campagne était silencieusement rentable. Priorité = monter le volume (Click-to-WhatsApp + tracking) sans tout refondre.

À me communiquer dès que possible — la matrice ci-dessous est calibrée pour le cas médian (2–4 paying).

---

## Matrice complète — 27 actions classées par impact / effort

Légende :
- **Effort** : 🟢 < 1 h / 🟡 1-4 h / 🟠 4 h – 1 jour / 🔴 > 1 jour
- **Impact** : 1 (mineur) → 5 (changement de funnel)
- **Catégorie** : `Trust` / `WA` (WhatsApp) / `Track` (tracking) / `Brand` / `Bug` / `Perf` / `FB` / `Conv` (conversion form)

### Bloc A — Quick wins (à faire avant TOUT relance campagne) — total ~5h

Actions individuellement petites, cumulativement transformantes. **Pour moi, ce bloc est non-négociable avant de redépenser un XAF en pub.**

| # | Action | Catégorie | Effort | Impact | Gain attendu | Risque |
|---|---|---|---|---|---|---|
| **QW1** | Réparer bouton "Voir les taux" du hero (`LandingPage.tsx:171-173`) — soit ajouter onClick scroll-anchor vers simulateur, soit le retirer | Bug | 🟢 15 min | 3 | Élimine 1 signal "site cassé" pour méfiant | Aucun |
| **QW2** | Supprimer le lien `#tarifs` du nav OU créer la section tarifs (Bloc B M3) | Bug | 🟢 5 min (suppression) | 2 | Évite la promesse cassée | Aucun |
| **QW3** | Corriger l'URL dans le JSON-LD : `"url": "https://bonzini.com"` → `"https://www.bonzinilabs.com"` (`index.html:54`) | Bug / SEO | 🟢 5 min | 1 | Schema SEO propre | Aucun |
| **QW4** | **Ajouter numéro WhatsApp visible dans le hero** : badge cliquable sous le sous-titre, format `📱 +237 6 52 38 84 83` ou bouton secondaire "Discuter sur WhatsApp" qui ouvre `wa.me/237652388483?text=Bonjour, j'ai vu le site Bonzini, j'aimerais en savoir plus sur le paiement Chine` | WA | 🟢 30 min | **5** | Active le canal de conversion #1 historique. Mesure directe du KPI nord | Aucun — le numéro existe déjà |
| **QW5** | **Bouton WhatsApp flottant (FAB)** en bas droite, visible toute la page, mobile + desktop | WA | 🟡 1 h | **5** | Capture aussi les bounces "intéressés mais méfiants" qui voient le numéro à mi-page | Visuel à valider pour ne pas casser l'esthétique premium |
| **QW6** | Footer : remplacer les `href="#"` morts par les vrais liens : WhatsApp (`wa.me/...`), Facebook (URL page), email, etc. (`LandingPage.tsx:441`) | Trust + WA | 🟢 30 min | 3 | Site qui n'a pas l'air abandonné | Aucun |
| **QW7** | **Installer Meta Pixel** (`index.html`) + event `Lead` au `signup_completed` | Track | 🟡 30 min | **5** sur le moyen terme | Permet retargeting des 1 046 visiteurs perdus dès relance, et lookalike audience à partir des futurs signups | Si tu vises Europe plus tard, ajouter consent banner |
| **QW8** | **Activer Microsoft Clarity** (script à coller dans `index.html`) | Track | 🟢 5 min | 4 | Session replay + heatmaps gratuits illimités → comprendre où les gens cliquent et s'arrêtent | Aucun |
| **QW9** | **Activer Vercel Speed Insights** (package + composant `<SpeedInsights />`) | Perf | 🟢 5 min | 2 | Données Web Vitals réelles 4G CEMAC | Free tier limité, suffisant à ton volume |
| **QW10** | **Distinction des 3 CTA** : modifier `track('cta_clicked')` pour passer `cta_location: 'nav' \| 'hero' \| 'bottom'` au lieu de `page_section: 'landing'` constant (`LandingPage.tsx:473`) | Track | 🟢 10 min | 2 | Sait quel CTA convertit le mieux | Aucun |
| **QW11** | **Refaire la création du flyer en retirant la tagline "Nous vous aidons à envoyer de l'argent en Chine"** → remplacer par "Nous payons vos fournisseurs en Chine pour vous, depuis le Cameroun." | Brand | 🟡 30 min (design) | 2 | Respect règle brand, ré-aligne identité importateur | Si flyer est déjà tiré papier, peu utile sur ce support |

**Total Bloc A** : ~4 h 40 de travail dev + 30 min design. Faisable sur 1 journée seule. **Impact cumulé : décisif**.

---

### Bloc B — Corrections moyennes (sprint d'une semaine, ~25h cumulé)

À faire après le Bloc A, idéalement avant la relance de campagne. Apporte les éléments structurels manquants (trust + simplification funnel + tracking détaillé).

| # | Action | Catégorie | Effort | Impact | Gain attendu | Risque |
|---|---|---|---|---|---|---|
| **M1** | **Section "Qui sommes-nous"** sur la landing : photo père + fils (vraies photos), nom complet, courte histoire (3-4 phrases : "Bonzini est né de notre expérience d'importateurs frustrés par les paiements vers la Chine"), adresse physique Cameroun, et si RCCM dispo, le numéro. Place : entre HowItWorks et Methods. | Trust | 🟠 4 h | **5** | Première vraie défense anti-méfiance | Demande photos OK + courage de mettre les vrais noms |
| **M2** | **Section témoignages** : récolter 3 quotes (texte ou audio WhatsApp) des 10-15 signups existants, avec photo + premier prénom + ville + commerce. **Demander permission explicite par WhatsApp**. | Trust | 🟠 4 h (incl. relance) | **5** | Signal social authentique. Plus efficace que tout autre signal | Risque que tu n'aies que 1-2 témoignages au lieu de 3 → ok, garde 1 fort, place-le bien |
| **M3** | **Créer la section "Tarifs"** anchor `#tarifs` : grille XAF/CNY par mode de paiement (Alipay / WeChat / Virement / Cash), affichage du taux du jour, fourchette montants. Transparence prix. | Trust + Bug | 🟠 4 h | 4 | Tue les peurs "frais cachés" + remplit la promesse du nav. Élément différenciateur vs concurrents opaques | Risque : à toi de tenir cette grille à jour, sinon claim "pas de frais cachés" devient mensonger |
| **M4** | **Bouton "Discuter sur WhatsApp" en CTA primaire du hero** (à la place ou en addition de "Envoyer un paiement") | WA + Conv | 🟢 30 min | **4** | Réduit la barrière d'engagement pour cold traffic | Réduit le nombre de signups directs mais augmente probablement les DM qualifiés (notre KPI nord) |
| **M5** | **Events funnel signup** dans `AuthPage.tsx` : `signup_started` au mount step 0, `signup_step_completed` à chaque transition, `signup_abandoned` au beforeunload. Avec `signupStep` en propriété. | Track | 🟡 2 h | 4 | Saura enfin où les gens abandonnent dans les 5 étapes | Aucun |
| **M6** | **Events landing détaillés** : scroll depth (25/50/75/100%), section vue (Hero/Simulator/HowItWorks/Methods/FAQ/CTAbottom), simulator changement montant, FAQ click | Track | 🟡 3 h | 4 | Diagnostic précis du bounce point | Surveille les quotas Vercel Analytics (limite events Hobby) |
| **M7** | **Réécrire la FAQ** avec les VRAIES objections de cold traffic CEMAC, dans cet ordre : *(1) Qui êtes-vous vraiment ? (2) Comment je sais que ce n'est pas une arnaque ? (3) Que se passe-t-il si le paiement échoue côté Chine ? (4) Êtes-vous agréés par la BEAC ? (5) Combien de paiements avez-vous déjà traités ? (6) Comment je récupère mon argent si je change d'avis ?* Garder 2-3 questions techniques (montant min, délai) en bas. | Trust | 🟠 4 h | 4 | Devient la 2ème ligne de défense anti-méfiance | Demande honnêteté sur les réponses (volume traité, agrément) — ne pas inventer |
| **M8** | **Page FB — refresh visuel** : photo de couverture brandée (le flyer reformulé sans "envoyer de l'argent"), photo de profil = logo Bonzini propre, bio claire ("Bonzini Trading — Payez vos fournisseurs chinois en XAF. Cameroun ⇄ Chine. WhatsApp : +237 6 52 38 84 83"), catégorie "Service financier" ou "Société de transfert d'argent" selon le permis légal | FB + Trust | 🟠 4 h (côté équipe) | 3 | Améliore la conversion follower + crédibilité quand quelqu'un vérifie la page après l'ad | À aligner avec le statut juridique réel |
| **M9** | **Activer les Recommandations** sur la page FB + relancer les 10-15 signups par WhatsApp pour qu'ils laissent un avis 5★ | FB + Trust | 🟡 1 h + temps social | 4 | Avis publics visibles transforment les 82 partages de la pub en conversions indirectes | Demande effort relationnel — pas tout le monde laissera un avis |
| **M10** | **Configurer la prochaine campagne en Click-to-WhatsApp Ads** (objectif Messages, plateforme WhatsApp). Tester en split 50/50 avec Web Traffic sur ~15 K XAF chaque branche. | WA + FB | 🟡 1 h config + tests | **5** | Active le canal de conversion historique. Données comparées en 14 jours = sait définitivement quel format performe sur ton marché | Si WhatsApp Business n'est pas configuré, faire ça avant |
| **M11** | **Configurer WhatsApp Business officiel** pour le numéro Bonzini : nom officiel, description, horaires, lien site, réponses rapides, statut professionnel | WA + Trust | 🟡 2 h | 3 | Tag "Business" visible côté prospect = signal de pro | Aucun |
| **M12** | **UTM systématique** sur toutes les futures URL pub : `?utm_source=facebook&utm_medium=paid_social&utm_campaign=<nom>&utm_content=<variant>` | Track | 🟢 5 min par campagne | 3 | Attribution propre + comparabilité entre campagnes | Discipline opérationnelle à tenir |

**Total Bloc B** : ~30 h (mix dev + récolte + design + admin). Faisable sur 1-2 semaines selon disponibilité.

---

### Bloc C — Refontes structurelles (sprint plusieurs semaines, à séquencer)

À engager **après** la première relance de campagne réussie avec Blocs A+B. Plus coûteux, plus risqué, mais permet de scaler.

| # | Action | Catégorie | Effort | Impact | Gain attendu | Risque |
|---|---|---|---|---|---|---|
| **R1** | **Simplification radicale du signup** : 5 étapes / 11 champs → 2 étapes / 3 champs (téléphone + prénom + langue préférée). Le reste (KYC complet : nom complet, DOB, adresse, entreprise) demandé **après** premier contact WhatsApp ou avant premier paiement seulement. | Conv | 🔴 1 semaine | **5** | Probablement le plus gros levier de conversion landing. Hypothèse : taux de complétion signup ×2-3 si bien fait | Demande retravailler le trigger `handle_new_user` + flow KYC. Side-effects à tester. |
| **R2** | **Vidéo explicative 30s** en français adapté CEMAC : ton père qui parle face caméra ("Je m'appelle X, je suis camerounais, j'ai 30 ans d'expérience dans le commerce avec la Chine, voici comment je vous aide à payer en sécurité") + 10s de démo de l'app + numéro WhatsApp en fin. Place : hero ou section dédiée sous le simulateur. | Trust | 🔴 1-2 semaines | **5** | Le format vidéo + visage humain est le plus puissant signal de confiance en marché méfiant. En CEMAC, contenu vidéo se partage massivement en WhatsApp | Demande tournage (smartphone OK), montage (gratuit CapCut), validation père. Risque de procrastination. |
| **R3** | **Plan éditorial Facebook hebdomadaire** : 1 post éducationnel (ex: "Comment vérifier qu'un fournisseur Alipay est légitime"), 1 post social proof (témoignage / capture d'un paiement réussi anonymisé), 1 post promo (taux du jour, nouvelle fonctionnalité). Régularité > qualité parfaite. | FB | 🔴 effort récurrent (~3 h/semaine, ton père idéalement) | 4 | Construit la confiance dans le temps. Améliore CPM des futures campagnes (page active = boost organique algorithmique) | Demande discipline. Risque d'abandon après 2 semaines |
| **R4** | **Programme "premier client"** : récolter avec consentement témoignage **vidéo** (15-30s, smartphone) des 5 premiers clients qui paient. Format : "Je suis X, j'ai payé Y yuan à mon fournisseur en 5 minutes avec Bonzini". Incentive : 10 % rabais sur 3e paiement. | Trust + FB | 🔴 2-4 semaines | **5** | Le social proof vidéo authentique change radicalement la perception. Diffusable sur landing + page FB + DM WhatsApp | Demande relation client + permission. Lent à construire |
| **R5** | **Stratégie SEO long terme** : 5-10 articles de blog sur les vraies questions des importateurs ("Comment payer un fournisseur Alipay depuis le Cameroun", "Taux yuan XAF du jour", "Liste des marchés gros à Yiwu", "Documents douaniers Cameroun"), maillage interne, schema FAQ. | SEO | 🔴 1-2 mois | 3 (long terme) | Trafic organique gratuit récurrent. Indépendance des ads | Pas de gain court terme. Mois 6+ minimum avant impact |
| **R6** | **Refonte SPA → SSR/SSG** sur la landing (Next.js / Astro) pour rendu HTML brut côté crawler | Perf + SEO | 🔴 1-2 semaines | 2 | Page indexable par crawlers SEO sans JS, meilleur LCP | Refactor non trivial — à faire seulement si SEO devient une priorité |
| **R7** | **Bot WhatsApp de qualification** (réponses rapides + redirections automatiques selon mot-clé) | WA | 🔴 1 semaine + intégration tier | 3 | Soulage ton père sur les premiers échanges. Scale ce qui n'était pas scalable | Demande pas trop d'automation au début (la confiance vient du contact humain) |

---

## Ordre d'exécution recommandé — 3 scénarios

Choisis selon ton temps disponible.

### Scénario 1 : "Quick relaunch" (5 jours) — minimum viable avant relance

| Jour | Actions | Total |
|---|---|---|
| **J1** | QW1 + QW2 + QW3 + QW6 + QW10 (tous les bugs/petits fixes) + QW7 Meta Pixel | 2 h |
| **J2** | QW4 + QW5 (WhatsApp visible + FAB) + QW8 Clarity + QW9 Speed Insights + QW11 reformulation flyer | 2,5 h |
| **J3** | M5 funnel signup events + M10 Click-to-WhatsApp Ads config + M12 UTM systématique | 3 h |
| **J4** | M2 récolte témoignages (relance WhatsApp aux 10-15 existants) + M9 demande avis FB | 4 h |
| **J5** | M11 WhatsApp Business + M8 refresh page FB (par ton père) | 4 h |

**Total ~15 h.** À la fin : Pixel installé, WhatsApp partout, témoignages en cours de récolte, page FB plus pro, nouvelle campagne Click-to-WhatsApp prête à lancer.

### Scénario 2 : "Foundation strong" (2 semaines) — recommandé

Scénario 1 + en parallèle/après :
- M1 section "Qui sommes-nous" (4 h)
- M3 section Tarifs (4 h)
- M4 bouton WhatsApp en CTA hero (30 min)
- M6 events landing détaillés (3 h)
- M7 réécriture FAQ (4 h)

**Total ~30 h cumulés sur 2 semaines.** À la fin : landing avec trust signals + WhatsApp dominant + tracking complet + page FB refreshed + nouveau format pub testé.

### Scénario 3 : "Full rebuild" (1-2 mois) — si tu veux scaler

Scénario 2 + Bloc C séquencé :
- Semaine 3 : R1 simplification signup
- Semaine 4-5 : R2 vidéo explicative
- Semaine 4+ : R3 plan éditorial FB hebdomadaire (récurrent)
- Mois 2 : R4 programme premier client
- Mois 3+ : R5 SEO long terme (si pertinent)

---

## Ce que je RECOMMANDE — pas du marketing speak, des chiffres réalistes

### Sur la prochaine campagne (relance Click-to-WhatsApp)

Hypothèses basées sur ordre de grandeur fintech B2B émergente (à valider avec ta propre data) :
- **CTR Click-to-WhatsApp Ads** typiquement 30-100 % plus haut que Web Traffic sur des budgets équivalents (les gens cliquent plus facilement quand ils savent qu'ils vont juste ouvrir WhatsApp, pas remplir un formulaire). Ordre de grandeur, à mesurer.
- **Taux de conversion DM → paiement** dépend entièrement de la qualité de l'échange humain côté père/toi. En remittance trust-sensitive, 10–30 % des DM qualifiés convertissent en signup actif si bien géré.
- **Coût par DM qualifié** dans des contextes similaires : 500–2 000 XAF (~0,8–3 €). Ordre de grandeur, à confirmer.

**Avec 30 K XAF en Click-to-WhatsApp**, hypothèse réaliste : 20–60 DM entrants (vs 0 sur la campagne d'avril). **C'est un changement de fonctionnement, pas un "x2 de conversion"**.

### Sur la conversion landing (si tu fais aussi Web Traffic)

Si tu maintiens une fraction du budget en Web Traffic en plus de Click-to-WhatsApp :
- Bloc A seul (QW1-QW11) → amélioration estimée du **bounce rate 5–15 %** (élimine le sentiment "site cassé/abandonné"). Pas un doublement.
- Bloc A + M1 + M2 + M3 + M4 + M7 → amélioration **CR landing estimé 30–80 %** (passage de ~1 % à 1,3–1,8 %). Toujours pas un doublement strict. Reste fondamentalement limité par signup 5 étapes.
- Bloc A + B + R1 (simplification signup) → là on peut viser un **CR ×2 (1 % → 2 %)**, mais c'est plusieurs semaines de travail.

**Aucune action seule ne double la conversion.** Les gains se cumulent. Méfie-toi des promesses de doublement instantané.

---

## Risques transverses à signaler

1. **Risque de cannibalisation du canal direct** : ajouter WhatsApp partout = plus de gens te DM toi (et ton père). Le bottleneck devient ta capacité humaine. À 50 DM/semaine, ça reste gérable. À 200/semaine, vous craquez. Anticiper la mise en place du Bot M7 ou d'un agent quand le volume monte.

2. **Risque de violation RGPD si tu vises l'Europe plus tard** : Meta Pixel + Clarity sans consent banner = illégal en EU. Pas un problème CEMAC aujourd'hui, mais à régler avant toute expansion EU.

3. **Risque "trust signals mensongers"** : si tu mets "100 paiements traités" alors que tu en as 10, et qu'un client le découvre, la confiance est détruite définitivement. **Toujours indiquer le chiffre réel** ou rien. Préfère "Service lancé en 2026, en croissance" à un chiffre inventé.

4. **Risque budget pub** : Click-to-WhatsApp Ads peut générer un afflux de DM, mais ces leads sont aussi plus volatiles. Si ton père est en déplacement 3 jours et personne ne répond, les leads se refroidissent. Caler la dispo équipe avant relance.

5. **Risque "trop de simplification"** : R1 (signup 2 champs) augmente les signups bruts mais peut empirer la qualité (gens moins engagés). Mesurer signups → paiement et pas que signups bruts.

---

## Ce qui reste hors scope de cette phase

- **App mobile client** : explicitement hors scope par toi en Phase 0
- **Module admin / dashboard interne** : non audité
- **Stratégie produit long terme** (nouvelles fonctionnalités, géographies) : pas l'objet de cet audit

---

## Validation avant Phase 6

Avant que je touche au code, tu valides :

1. **Le Scénario d'exécution** : Scénario 1 (Quick relaunch 5j), Scénario 2 (Foundation strong 2 semaines, recommandé), ou Scénario 3 (Full rebuild) ?
2. **Le périmètre du premier lot d'implémentation** : on commence par quel sous-ensemble du Bloc A ? Je propose les **5 quick wins les plus impactants en ordre** : QW1 (bouton "Voir les taux" cassé) + QW2/QW3 (bugs) + QW4 (WhatsApp dans hero) + QW5 (FAB WhatsApp) + QW7 (Meta Pixel). ~3h total.
3. **Une fois ce premier lot validé**, je l'implémente, fais `npm run type-check` + `npm run build`, et te demande la validation avant le lot suivant.

**Rappel des principes du brief** :
- Aucun code modifié avant validation
- Implémentation par lots successifs
- Test mobile-first à chaque lot
- Toujours respecter règles `frontend.md`, `database.md`, `security.md`

Quel scénario tu choisis ?
