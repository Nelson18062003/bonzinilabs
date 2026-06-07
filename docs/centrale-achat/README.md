# Module « Centrale d'Achat » — Dossier de conception

> Système de gestion **sourcing → commande → production → QC → expédition → livraison**
> pour les missions d'achat des clients de Bonzini en Chine, avec une **couche IA native**
> (ingestion + pilotage + reporting) construite dans la lignée de Mola, sans ses défauts.

> **Source de vérité.** Ce dossier est la référence vivante de la conception. Chaque phase y est
> écrite incrémentalement. **Aucune ligne de code applicatif n'est écrite avant la phase
> d'implémentation, validée explicitement par le porteur produit.** Seuls les fichiers de
> documentation sont créés avant.

---

## Pourquoi ce module existe (histoire déclenchante)

Mai 2026 : un client camerounais vient en Chine. Le père accompagne dans **30+ usines** (voitures,
meubles, matériaux, fenêtres…). Avances déposées chez chaque fournisseur (cash, Alipay, WeChat).
Volume total **> 3 M CNY**. Aujourd'hui, **impossible de produire un rapport propre** : tout est
dispersé entre photos, PDFs, conversations WeChat, et la mémoire du père. 1 client comme ça
aujourd'hui ; 5, 10, 50 demain. **Sans système, ingérable.**

---

## Suivi des phases (proposition — à valider en Phase 0)

| Phase | Objet | Fichier | Statut |
|------:|-------|---------|--------|
| 0 | **Cadrage & diagnostic de l'existant** : reformulation, diagnostic Bonzini/Mola, réutilisable vs manquant, proposition de workflow, questions de conception | [`00-cadrage.md`](./00-cadrage.md) | ✅ **Validé** (4 forks tranchés : workflow approuvé · agent à commission · étendre Mola · pas de POC précoce) |
| 1 | **Apprentissage du domaine procurement** (OBLIGATOIRE) : glossaire vérifié (cycle PI/PO/CI, deposit/balance 30/70, Incoterms 2020, AQL/ISO 2859-1 & types PSI/DUPRO, LCL/FCL, **compliance CEMAC**) + étude Anvyl(→Sage) / Flexport / Alibaba / **agences-portail** (emprunter/jeter) | [`01-domaine.md`](./01-domaine.md) | ✅ **Validé** (4 forks + custody Cas 3 tranchés) |
| 2 | **Modèle conceptuel & entités** (conçu AI-first) : 10 entités `proc_*`, master-data partagée vs par-client, modèle d'argent Cas 3 (attestation + lien rail), commission double-mode, append-only, RLS, coûts | [`02-modele-donnees.md`](./02-modele-donnees.md) | ✅ **Validé** (rôle `sourcing_agent` cumulé, gate solde souple, QC interne/tiers) |
| 3 | **Couche IA (le cœur)** : extension de Mola (pas un fork). **RÉVISÉ : pas d'OCR/analyse de doc.** Saisie **manuelle (formulaires) ou dictée à Mola** ; **photos = preuves**. Capacités `@mola`, RAG métier, self-correction, reporting PDF, anti-bugs Mola, coûts réduits | [`03-couche-ia.md`](./03-couche-ia.md) | ✅ **Validé (direction)** — pivot « pas d'OCR » tranché (3 Q mineures ouvertes) |
| 4 | **Parcours & UX terrain** (révisé) : saisie formulaire/dictée + photos-preuves, control tower, mission/fournisseur/PO 360, rapport PDF, in-app only, wireframes | [`04-parcours.md`](./04-parcours.md) | ⏳ **Rendu — en attente de validation** (4 questions ouvertes) |
| 5 | **Plan d'implémentation par lots** : lots ordonnés + estimations + critères de « fait », **catch-up rétroactif mission mai 2026 en Lot 1** | `05-plan-implementation.md` | À venir |
| 6 | **Implémentation** (après GO explicite), par lots | `06-implementation.md` | À venir |
| 7 | **Vérification** : type-check + build + jeu d'eval + scénario bout-en-bout (le rapport mai 2026 = test d'acceptation) | `07-verification.md` | À venir |

---

## Règles de travail (rappel)

- **Une phase à la fois.** Pas de saut. Je rends, tu valides, on avance.
- **Apprentissage du domaine obligatoire (Phase 1)** : aucun design avant de connaître le vocabulaire
  et les patterns du procurement. Anti-réinvention : si Anvyl/Flexport/Alibaba ont résolu un
  sous-problème, on l'étudie avant de proposer.
- **Lecture seule jusqu'à la Phase 6** (sauf l'écriture de ce dossier de doc).
- **IA en couche au-dessus, pas en remplacement.** Une base métier propre d'abord ; l'IA hallucine
  sur des données pourries. Mais la base est conçue **AI-first** dès la Phase 2.
- **Hériter de Mola sans répéter ses erreurs** : outils qui inspectent la base en temps réel,
  mémoire à l'endroit, vision activée, self-correction, parité outil↔plateforme.
- **Père sur le terrain = persona #1.** Si ce n'est pas utilisable depuis un téléphone en Chine
  pendant une visite d'usine, ça ne sert à rien.
- **Documents hétérogènes = réalité** (photos floues, exports WeChat, PDFs scannés) → acceptés tels
  quels, OCR best-effort, validation humaine.
- **Cash sans reçu = réalité** → workflow d'attestation conçu pour cette réalité.
- **Audit trail non négociable** (argent du client).
- **Coût mensuel chiffré** pour chaque décision (stockage, OCR, inférence).
- **`fichier:ligne`** pour toute affirmation codebase ; **URL + date** pour la recherche web.
- **Vérifié / supposé / à confirmer** systématique.

**Légende confiance :** 🟢 vérifié (lecture directe / `fichier:ligne`) · 🟡 supposé (déduit, à valider)
· 🔴 à confirmer (décision métier / mesure / config prod).
