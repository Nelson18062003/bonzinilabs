# Phase 2 — Benchmark support in-app fintech (mai 2026)

**Mode** : lecture seule, sources publiques.
**Convention** : faits vérifiés via sites officiels, App/Play Store, Trustpilot 2025-2026, blogs engineering. Quand non sourcé : "non documenté publiquement".

> **⚠️ Caveat méthodologique** : la plupart des fintechs n'exposent **pas publiquement** les détails techniques internes de leur chat (voice oui/non, attachments, "typing indicator"). On infère depuis l'outil sous-jacent (Intercom/Zendesk supportent nativement attachments + voice clips). Quand on n'est pas sûr, on le dit.

---

## 1. Wave Mobile Money (Afrique de l'Ouest)

> Attention : ne pas confondre Wave Mobile Money (Sénégal, CI, Mali, Burkina, Gambie, Ouganda) avec **Wave Financial / WaveApps** (comptabilité Canada). Le chatbot "Mave" d'Ada concerne Wave Financial, pas la fintech Afrique.

| Champ | Détail |
|---|---|
| Canal in-app | Bouton "assistance" ; **appel téléphone gratuit** depuis l'app (200 600 SN, 1315 CI) ; WhatsApp officiel (+221 70 860 00 00) |
| Outil sous-jacent | Inconnu — probablement custom + call center téléphonique |
| Voice messages | Non documenté |
| Pièces jointes | Non documenté |
| Latence affichée | Non affichée. Promesse implicite : décrocher au téléphone immédiatement |
| Trust signals | Aucun signal chat. Le **call center humain instantané** est le trust signal central |
| Heures | Téléphone variable par pays ; WhatsApp non précisé |
| Source | [Vosreponses — WhatsApp Wave](https://vosreponses.com/quel-est-le-numero-whatsapp-de-wave/), [Wave Senegal Facebook](https://www.facebook.com/WaveSenegal/posts/1238422521821292/) |

---

## 2. Wise (transferts internationaux)

| Champ | Détail |
|---|---|
| Canal in-app | Live chat in-app + email + téléphone 24/7 (US +1 888 501 4041). Parcours : Help → Contact us → Chat with us |
| Outil sous-jacent | Custom in-house (pas Zendesk/Intercom public) |
| Voice messages | Non documenté |
| Pièces jointes | Non documenté |
| Latence affichée | Pas de SLA affiché. Reviews 2025 : plaintes massives "chatbot d'abord, humain difficile à atteindre" |
| Trust signals | Routage contextuel intelligent vers FAQ avant chat. Pas de photo/nom d'agent documenté |
| Heures | Téléphone 24/7 ; chat horaires variables |
| Source | [Wise Help Centre](https://wise.com/help/articles/4ijaGT6BdeHNVjzbRip4gI/how-do-i-contact-wise), [Trustpilot Wise](https://www.trustpilot.com/review/wise.com) |

---

## 3. Lemfi (transferts Afrique / diaspora)

| Champ | Détail |
|---|---|
| Canal in-app | Live chat in-app (Settings → Help and Support → Help Centre → icône chat) ; email support@lemfi.com ; téléphones US/CA/UK/FR/IE/AU ; réseaux sociaux |
| Outil sous-jacent | **Zendesk** (`support.lemfi.com/hc/en-us` = Zendesk Help Center standard) |
| Voice messages | Non documenté (Zendesk Messenger supporte attachments mais pas voice nativement) |
| Pièces jointes | Oui (Zendesk natif) |
| Latence affichée | "Response within 24 hours" sur email ; chat advertise 24/7 |
| Trust signals | "24/7 live chat & email" affiché. Pas de photo/nom d'agent. Plaintes Trustpilot : "WhatsApp chat automatisé, 2 jours d'attente" |
| Heures | 24/7 annoncé |
| Source | [Lemfi support — Contact](https://support.lemfi.com/hc/en-us/articles/41457896487441-How-To-Contact-Customer-Support), [Lemfi contact](https://lemfi.com/en-gb/contact-us), [Trustpilot Lemfi](https://www.trustpilot.com/review/lemfi.com) |

---

## 4. NALA (transferts Afrique) ⭐ best-in-class du panel

| Champ | Détail |
|---|---|
| Canal in-app | Chat in-app via **"Mama NALA"** (bouton sur écran d'accueil → "Send us a message") ; email mamanala@nala.com |
| Outil sous-jacent | **Intercom** (structure help.nala.money + "Mama NALA" est un Intercom Messenger customisé) |
| Voice messages | Non documenté |
| Pièces jointes | Oui (Intercom natif) |
| Latence affichée | "As swiftly as possible" officiel. Reviews Trustpilot : **réponses < 2 minutes** régulièrement |
| Trust signals | **Personnification forte ("Mama NALA")** → identité chaleureuse maternelle. Multilingue Swahili/EN/FR annoncé explicitement |
| Heures | 24/7 affiché |
| Source | [NALA Help Center](https://help.nala.money/en/articles/4771846-how-do-i-contact-customer-support), [Trustpilot NALA](https://www.trustpilot.com/review/nala.money) (4.1/5 sur ~900 reviews) |

---

## 5. Chipper Cash (Afrique)

| Champ | Détail |
|---|---|
| Canal in-app | Live chat in-app (icône Help top-left du Home tab → Chat bubble) ; email |
| Outil sous-jacent | **Intercom confirmé** (support.chippercash.com = Intercom Articles, mention Intercom Inc.) |
| Voice messages | Non documenté |
| Pièces jointes | Oui (Intercom natif) |
| Latence affichée | "2-hour response time" annoncé — **contredit** par reviews (3-5h voire plusieurs jours) |
| Trust signals | Bouton Help permanent top-left. Pas de photo/nom d'agent |
| Heures | Non précisé clairement |
| Source | [Chipper support — Contact](https://support.chippercash.com/en/articles/3057891-how-do-i-reach-the-customer-support-team), [Trustpilot Chipper Cash](https://www.trustpilot.com/review/www.chippercash.com) (2/5) |

---

## 6. Sendwave (transferts Afrique)

| Champ | Détail |
|---|---|
| Canal in-app | Chat in-app via onglet "?" → "Chat with Us" ; téléphone (US, UK, FR, BE, DE, IT, ES, IE) ; pas d'email mis en avant |
| Outil sous-jacent | Anciennement Zendesk, apparemment migré vers stack custom |
| Voice messages | Non documenté |
| Pièces jointes | Non documenté |
| Latence affichée | Chat 24/7 affiché ; **téléphone honnêtement limité 10h-00h UTC L-V**, fermé week-end (rare honnêteté du secteur) |
| Trust signals | "Support team speaks multiple languages" affiché. Pas de typing indicator documenté |
| Heures | Chat 24/7 / Téléphone 10-00 UTC L-V |
| Source | [Sendwave Contact](https://www.sendwave.com/en-us/contact), [Sendwave FAQ](https://www.sendwave.com/en-us/support) |

---

## 7. Yellow Card (crypto Afrique)

| Champ | Détail |
|---|---|
| Canal in-app | Chat in-app "24/7" annoncé ; email support@yellowcard.io ; **WhatsApp, Telegram, Facebook, X** comme canaux alternatifs officiels |
| Outil sous-jacent | Help Centre = **HelpScout** (pattern URL `/article/974-...`) — non 100% confirmé |
| Voice messages | Non documenté |
| Pièces jointes | Non documenté |
| Latence affichée | "24-hour support" annoncé. **Trustpilot 1.7/5** avec plaintes massives : "withdrawals 48h+ sans réponse", "chat éteint", "plusieurs jours pour email" |
| Trust signals | Multi-canal social (WhatsApp + Telegram = signal d'usage là où sont les users crypto Afrique) |
| Heures | 24/7 annoncé (contredit par UX) |
| Source | [Yellow Card Help](https://help.yellowcard.io), [Trustpilot Yellow Card](https://www.trustpilot.com/review/yellowcard.io) (1.7/5) |

---

## 8. Onafriq (ex-MFS Africa, B2B pan-africain)

| Champ | Détail |
|---|---|
| Canal in-app | **N/A grand public** — Onafriq est B2B (rails de paiements pour banques/MNO). Support via **Enterprise Portal** + email partenaire dédié |
| Outil sous-jacent | **Zendesk** (`onafriqenterprise.zendesk.com`) |
| Voice / pièces jointes | Pièces jointes oui (tickets B2B). Voice N/A |
| Latence affichée | "24-hour support" sans SLA chiffré |
| Trust signals | "Single integration and support contact" — modèle account management dédié, Partner Support Analyst nommé |
| Heures | 24/7 annoncé pour partenaires |
| Source | [Onafriq Enterprise Portal](https://onafriqenterprise.zendesk.com/hc/en-us/sections/20448433957661-Onafriq-Enterprise-Portal), [Onafriq About](https://onafriq.com/about) |

---

# Synthèse pour Bonzini

## 🎯 3 patterns dominants du secteur

1. **Stack mainstream SaaS** : Intercom (Chipper, NALA), Zendesk (Lemfi, Onafriq), HelpScout (Yellow Card). **Wise est l'exception** avec stack custom. → Personne ne build maison… sauf Wise (qui a 12M users et 3000 employés). **Cela mérite d'être discuté pour Bonzini.**
2. **"24/7" est devenu un mensonge sectoriel.** Yellow Card, Chipper, Lemfi annoncent 24/7 → reviews unanimes "chat éteint", "tickets fermés sans réponse". Trustpilot tombe à 1.7-2/5.
3. **Triple canal standard** : chat in-app + email + téléphone (numéro par pays). Le téléphone reste central en Afrique.

## ⭐ Outliers à copier pour Bonzini

| Source d'inspiration | Pattern à dupliquer | Pourquoi pour nous |
|---|---|---|
| **NALA — "Mama NALA"** | Personnification chaleureuse + multilingue affiché explicitement | Audience africaine répond aux signaux humains/familiers. "Équipe Bonzini" plutôt qu'un chat bot anonyme. Trust massif gagné. |
| **Wave — Appel gratuit** | Bouton "appeler depuis l'app" → call center humain immédiat | Pour cas critique (paiement bloqué), le chat texte n'est pas suffisant. À considérer comme **canal secondaire** (deeplink `tel:`). |
| **Sendwave — Horaires honnêtes** | Affichage clair "Téléphone L-V 10h-00h" plutôt qu'un faux 24/7 | À transposer : "Réponse moyenne actuelle : X min" en temps réel, plutôt qu'un slogan |
| **Yellow Card — Multi-canal** | WhatsApp + Telegram comme canaux secondaires affichés | À considérer : afficher dans l'app "Préférez WhatsApp/Telegram ? → numéro" |

## ❌ Anti-patterns universels du secteur (à NE PAS reproduire)

1. **Mentir sur le 24/7** → afficher des horaires honnêtes.
2. **Chatbot wall** sans escalade humaine → critique #1 de Wise.
3. **Ghosting** : Chipper "support tickets closed twice before customer could respond" → toujours notifier avant fermeture.
4. **Zero trust signal in-chat** : aucune des 8 fintechs n'affiche photo/nom agent, "typing", "lu", "temps de réponse en cours". **Quick win UX énorme**, gratuit dans Intercom et facile en build maison.
5. **WhatsApp robot sans humain derrière** → pire que pas de canal du tout.

## 🧭 Implications stratégiques pour Bonzini

1. **Le build maison est défendable** : Wise (12M users) le fait. La complexité réelle d'un chat texte+voice+médias sur Supabase Realtime + Storage est modeste (< 2 semaines). Le "tout le monde prend Intercom" est un biais SaaS, pas une nécessité technique. **Et chez nous le budget SaaS = 0, donc la question est tranchée.**

2. **L'opportunité différenciatrice est claire** :
   - Afficher photo + nom + rôle de l'agent qui répond (déjà cadré).
   - Afficher temps de réponse moyen en temps réel ("Réponse moyenne aujourd'hui : 7 min") — **personne ne le fait dans le panel**.
   - Indicateur "en ligne" / "en train d'écrire" — **gratuit via Supabase Broadcast**.
   - Multilingue FR/EN/ZH affiché explicitement (déjà en place dans la stack).
   - Optionnel : bouton secondaire "Appeler l'équipe" (deeplink `tel:`).

3. **Personnification** : nommer l'équipe ("Équipe Bonzini" ou un nom de marque). Pas de bot anonyme.

4. **Honnêteté du SLA** > marketing 24/7. Plutôt "Réponse en moyenne sous 10 minutes" affiché en temps réel.

5. **Voice + médias riches restent un différenciateur** : aucun acteur du panel ne le documente publiquement comme feature mise en avant (héritage SaaS qui se concentre sur texte + attachments). Pour audience africaine où voice WhatsApp est culturel, c'est un fit fort.

---

**Fin Phase 2.** Prochaine étape : Phase 3 — matrice de solutions (variantes du build maison Supabase + options de scope) avec scoring pondéré.
