# Phase 3 — Matrice de solutions

**Mode** : analyse, pas de code.
**Décisions déjà actées** (sortie phase 0+1) :
- Build maison sur stack Supabase, **pas de SaaS payant** (budget = 0).
- WhatsApp **hors scope**.
- UI admin obligatoire dans `/m/support` (réponse via app admin, pas via Telegram).
- Notification admin via **bot Telegram** en parallèle (push hors-app).
- Notification client **in-app only** au MVP.
- 6e onglet `BottomNav` côté client.
- Rôles admin avec accès : super_admin, support, customer_success, ops.
- 2-3 admins simultanés à court terme.

→ La matrice ne compare donc plus *build vs buy*. Elle compare des **variantes de scope/cadence** du build Supabase + 2 options rejetées documentées pour intégrité.

---

## 1. Critères de scoring et pondérations

Pondérations 1 (faible) → 5 (critique) calibrées sur les contraintes du projet :

| Critère | Pondération | Justification |
|---|---|---|
| **Coût dev initial** | 5 | Équipe limitée (1.5 dev), tout jour compte |
| **Coût mensuel récurrent** | 5 | Budget = 0, hard constraint |
| **Trust client** | 5 | Positionnement produit : "vous n'êtes pas abandonné" |
| **Support voice** | 5 | Indispensable (cadrage user, ne veut pas de frustration) |
| **Confort opé père** | 4 | Capital mais pas le seul utilisateur côté admin |
| **Robustesse 3G/4G CEMAC** | 4 | Mobile-first, données coûteuses |
| **Évolutivité** | 3 | Croissance attendue mais pas explosive court terme |
| **Vendor lock-in** | 3 | Important mais pas premier ordre vu stack Supabase déjà choisie |
| **Total pondération** | **34** | |

Score par critère : 1 (mauvais) → 5 (excellent). **Score final = Σ(score × pondération) / (5 × 34) = pourcentage.**

---

## 2. Options retenues à comparer (4 réelles + 2 rejetées documentées)

### A. Build complet "MVP riche", one-shot

**Description** : on développe tout d'un bloc avant mise en prod.
- Schema DB : `chat_conversations` + `chat_messages` + bucket `chat-media`.
- Côté client : page Support (liste conversation + chat unique), input texte/voice/photo/vidéo/fichier, accusé de lecture, indicateur "en train d'écrire", affichage "temps de réponse moyen aujourd'hui".
- Côté admin : `MobileSupportListScreen` + `MobileSupportConversationScreen`, mêmes capacités d'envoi.
- Bot Telegram : Edge Function appelée par trigger PG sur INSERT message client → POST à Telegram Bot API avec deeplink `/m/support/:id`.
- Permission `canAccessSupportChat` ajoutée.
- i18n FR/EN/ZH.

**Estimation effort** : ~3 semaines pleines (1 dev).
**Mise en prod** : un seul gros lot, à T+3 semaines.

| Critère | Score | Commentaire |
|---|---|---|
| Coût dev initial | 2 | 3 semaines bloquantes, gros bloc |
| Coût mensuel | 5 | 0 € au-delà du Supabase déjà payé |
| Trust client | 5 | Toutes les features différenciatrices actives day-one |
| Support voice | 5 | Jour 1 (à condition que les tests iOS Safari passent — risque résiduel) |
| Confort opé père | 4 | UI native dans l'admin Bonzini qu'il connaît déjà |
| Robustesse 3G/4G | 4 | Supabase Realtime résilient ; voice upload sur 3G nécessite compression côté client |
| Évolutivité | 4 | Supabase tient jusqu'à ~10k users actifs simultanés sans souci |
| Vendor lock-in | 3 | Code applicatif portable, dépendance Supabase Realtime + Storage |
| **Score** | **138/170 = 81 %** | |

---

### B. Build minimal "texte + photos uniquement", ship vite

**Description** : on ship en 1 semaine, voice/vidéo absents, on les ajoutera plus tard si vraiment demandé.

**Estimation effort** : ~5-7 jours.
**Mise en prod** : T+1 semaine.

| Critère | Score | Commentaire |
|---|---|---|
| Coût dev initial | 4 | Le moins cher en dev |
| Coût mensuel | 5 | 0 € |
| Trust client | 3 | Module présent mais frustre (preuve audio = standard WhatsApp africain) |
| Support voice | 1 | Non livré → frustration des clients qui s'attendent à voice |
| Confort opé père | 4 | Idem A |
| Robustesse 3G/4G | 5 | Texte + photo = très léger |
| Évolutivité | 4 | Idem A |
| Vendor lock-in | 3 | Idem A |
| **Score** | **122/170 = 72 %** | |

→ **Option de "ship rapide" mais le voice manquant est en contradiction directe avec une contrainte critique posée par l'utilisateur.** À éliminer sauf revirement.

---

### C. Build maison + lib chat UI open-source (ex: react-chat-elements, stream-chat-react façade UI only)

**Description** : on garde backend Supabase maison, on emprunte une UI de chat prête.

**Vérifications faites** :
- `react-chat-elements` : lib UI pure, MIT, ~100 KB. Texte + image + audio waveform. Pas tellement maintenue (dernière release 2024). [à confirmer maintenance 2026]
- `stream-chat-react` : couplé au backend Stream (SaaS payant). UI seule non utilisable proprement.
- D'autres options (chat-ui-kit-react) existent mais sont plus axées AI/chatbot que support humain.

| Critère | Score | Commentaire |
|---|---|---|
| Coût dev initial | 3 | Économie sur 3-4 composants UI, mais intégration custom + adaptation Tailwind = friction |
| Coût mensuel | 5 | 0 € |
| Trust client | 3 | UI moins distinctive, perte de l'avantage "design Bonzini" (cohérence brand) |
| Support voice | 3 | Dépend de la lib, intégration audio souvent partielle / désuète |
| Confort opé père | 3 | Cohérence visuelle moindre avec le reste de l'admin |
| Robustesse 3G/4G | 3 | Bundle +100 KB, perf moyenne sur 3G |
| Évolutivité | 3 | Lib pas tellement maintenue |
| Vendor lock-in | 2 | Dépendance npm externe peu active |
| **Score** | **109/170 = 64 %** | |

→ **À éliminer.** L'économie est marginale, le coût en distinctivité produit (le quick-win UX du benchmark) trop fort. On veut "Équipe Bonzini" cohérent avec la charte, pas une UI générique.

---

### F. Build maison "2 lots rapprochés" (RECOMMANDATION PRÉ-PHASE 4) ⭐

**Description** : pareil que A en termes de scope final, mais split en deux lots avec mise en prod intermédiaire.

- **Lot 1 (semaine 1)** : Schema + RLS + bucket. Chat texte + images. UI client + admin de base. Notif in-app + bot Telegram. Affichage "temps de réponse moyen". Ship en prod.
- **Lot 2 (semaine 2-3)** : Voice messages (`MediaRecorder` + waveform), vidéo, fichiers PDF. Indicateur "en train d'écrire" (Broadcast). Accusé de lecture. Tests iOS Safari poussés. Ship en prod.

**Estimation effort** : 5-7 jours (lot 1) + 7-10 jours (lot 2) = **~2.5 semaines** total, mais avec valeur livrée dès la fin de semaine 1.

| Critère | Score | Commentaire |
|---|---|---|
| Coût dev initial | 3 | Légèrement moins que A car focus, ship rapide réduit risques |
| Coût mensuel | 5 | 0 € |
| Trust client | 4 | Lot 1 livre déjà la promesse (chat in-app + photos + temps réponse). Voice arrive à J+10. |
| Support voice | 4 | Livré au lot 2 (à J+10-J+14), pas jour 1 |
| Confort opé père | 4 | Idem A |
| Robustesse 3G/4G | 4 | Idem A |
| Évolutivité | 4 | Idem A |
| Vendor lock-in | 3 | Idem A |
| **Score** | **133/170 = 78 %** | |

**Pourquoi F malgré un score absolu inférieur à A** :
- Cadence d'apprentissage : on observe le comportement réel des clients (ratio voice/texte, taille typique des médias, latence acceptée) **avant** de coder la partie la plus risquée (audio iOS Safari).
- Risque réduit : le voice iOS Safari peut foirer en prod, isoler ce lot évite de bloquer tout le reste.
- Trust : promesse partiellement livrée à J+7 = mieux que rien à J+21.
- L'écart 78 % vs 81 % est dans la marge d'erreur ; le bénéfice produit/risque penche pour F.

---

### D. (Rejetée mais documentée) SaaS gratuit type Crisp / Tawk.to embedded

**Pourquoi rejetée d'emblée** : tu as tranché "budget = 0, pas de SaaS".

**Pour mémoire si ça change** :
- **Crisp** [tarif à confirmer mai 2026] : free tier annoncé pour 2 agents, fonctionnalités limitées. Voice messages, fichiers : à confirmer dans tier gratuit. Plan Mini ~25 €/mois/agent au-delà → vite >100 €/mois à 4 agents.
- **Tawk.to** [tarif à confirmer mai 2026] : gratuit illimité agents, ads "Powered by Tawk" présent par défaut. Voice messages : non supporté nativement. Fichiers : oui.
- Inconvénients de fond : UI étrangère à la charte Bonzini, lock-in fort, données support hors de la DB Bonzini (pas de jointure avec `clients`, `payments`).

**Score indicatif si le constraint tombait** : ~63 %.

---

### E. (Rejetée mais documentée) WhatsApp Business API + deeplink

**Pourquoi rejetée d'emblée** : tu as tranché "WhatsApp hors scope".

**Pour mémoire** : WhatsApp Business Cloud API (Meta) [tarification à confirmer mai 2026]
- Tarification par conversation initiée (catégorie service / marketing / utility / authentication), variable selon pays.
- Vérification business Meta (~2-4 semaines), templates approuvés requis pour messages sortants hors fenêtre 24h.
- Côté UX : un client clique sur "Contacter le support" → ouvre WhatsApp → tape son message dans WhatsApp. **Mais c'est exactement le pattern qu'on cherche à résoudre** (perte de trace, dépendance à WhatsApp).
- Voice et médias : natifs WhatsApp.

À ne ressortir que si Bonzini tombait sur un mur technique majeur côté build maison.

---

## 3. Tableau récapitulatif

| Option | Coût dev | Coût/mois | Trust | Voice | Confort opé | 3G/4G | Évol. | Lock-in | **Score** |
|---|---|---|---|---|---|---|---|---|---|
| **A. Build complet one-shot** | 2 | 5 | 5 | 5 | 4 | 4 | 4 | 3 | **81 %** |
| **F. Build 2 lots ⭐** | 3 | 5 | 4 | 4 | 4 | 4 | 4 | 3 | **78 %** |
| **B. Texte+photo only** | 4 | 5 | 3 | 1 | 4 | 5 | 4 | 3 | **72 %** |
| **C. Build + UI lib OSS** | 3 | 5 | 3 | 3 | 3 | 3 | 3 | 2 | **64 %** |
| D. SaaS gratuit (rejetée) | 5 | 2 | 2 | 3 | 5 | 3 | 4 | 1 | 63 % |
| E. WhatsApp Business (rejetée) | 4 | 3 | 4 | 5 | 3 | 4 | 3 | 1 | (non scorée — viole contrainte) |

---

## 4. Observations clés et arbitrages

1. **A et F sont à 3 points d'écart** (81 % vs 78 %). Dans cette plage, le score ne tranche pas — c'est l'**arbitrage cadence / risque / apprentissage** qui décide. La recommandation phase 4 penchera vers **F** sauf si tu privilégies un ship unique propre (A).

2. **B (texte+photos only)** est techniquement défendable et "ship encore plus vite" mais **viole frontalement la contrainte voice** que tu as posée. Hors recommandation principale.

3. **C (lib OSS UI)** n'apporte pas l'économie attendue parce que :
   - Les libs UI chat libres sont peu maintenues.
   - L'intégration Tailwind/charte demande quasi autant d'effort que d'écrire les composants.
   - On perd le quick win "design distinctif" qui est précisément le différenciateur Bonzini vs le panel fintech.

4. **Risque commun A et F** : le voice iOS Safari. C'est le seul vrai risque technique du projet. Mitigations :
   - Tester `MediaRecorder` sur iOS Safari 14.1, 16, 17 **avant** de promettre voice au client.
   - Fallback gracieux si pas supporté : masquer le bouton micro + afficher "envoyez un message texte ou une photo".
   - Format `audio/mp4` pour iOS, `audio/webm` pour Chrome/Firefox/Edge.

5. **Risque commun à toutes les options** : pas de Web Push client au MVP → si le client ferme l'app, il rate la réponse. Mitigations :
   - Affichage "Temps de réponse moyen aujourd'hui : 7 min" pour rassurer.
   - Badge non-lu visible dès la prochaine ouverture de l'app.
   - Email de notification (lot 3 éventuel) si client n'a pas ouvert l'app dans les X minutes après réponse admin. **À évaluer phase 6.**

6. **Charge serveur estimée** : à 100 conversations/jour × 20 messages × 1 KB = 2 MB/jour de DB, + 100 médias × 500 KB = 50 MB/jour de storage. Supabase free tier ou starter encaisse sans souci. **Aucun coût marginal à prévoir avant ~5 000 conversations/jour.**

---

**Fin Phase 3.** Prochaine étape : Phase 4 — recommandation argumentée d'**une option principale + une fallback**, sortie dans `docs/reco-solution-support.md`.
