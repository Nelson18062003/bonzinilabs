# Fonctionnalité « Bénéficiaires » — Dossier de conception

Carnet de bénéficiaires réutilisables par mode de paiement, côté client **et** exploitable côté admin.

> **Source de vérité.** Ce dossier est la référence vivante de la conception. Chaque phase
> y est écrite incrémentalement. Aucune ligne de code applicatif n'est écrite avant la Phase 5
> (validée explicitement par le porteur produit).

## Suivi des phases

| Phase | Objet | Fichier | Statut |
|------:|-------|---------|--------|
| 0 | Cadrage : reformulation, 8 questions de conception + reco, 5 questions critiques | [`00-cadrage.md`](./00-cadrage.md) | ✅ Validé (QC1/3/4/5 tranchés) |
| 1 | Audit codebase (lecture seule) : stack, modèle actuel paiement/destinataire, flow, points d'extension, code mort | [`01-audit-codebase.md`](./01-audit-codebase.md) | ✅ Rendu — **feature déjà ~70 % implémentée** |
| 2 | Modélisation des données (= **design de delta**, DB préservée + étendue) | [`02-modele-donnees.md`](./02-modele-donnees.md) | ✅ Rendu — **en attente validation** |
| 3 | Design des parcours (tous les cas, client + admin) | `03-parcours.md` | ⏳ Bloqué par validation Phase 2 |
| 4 | Plan d'implémentation (lots, estimations, critères de validation) | `04-plan-implementation.md` | ⏳ |
| 5 | Implémentation (par lots, après validation) | `05-implementation.md` | ⏳ |
| 6 | Vérification (jeu de test + scénario bout-en-bout par mode) | `06-verification.md` | ⏳ |

## Règles de travail (rappel)

- **Une phase à la fois.** Pas de saut. Je rends, tu valides, on avance.
- **Lecture seule jusqu'à la Phase 5** (sauf l'écriture de ce dossier de doc).
- **Snapshot vs référence** : l'historique d'un paiement ne change jamais quand un bénéficiaire est édité ensuite. Traité explicitement.
- **Validation par mode** : un bénéficiaire ne peut jamais être incomplet pour son mode (garanti en base).
- **Caractères chinois** : saisie / validation / affichage / encodage traités, pas survolés.
- **Sécurité** : un client ne voit QUE ses bénéficiaires ; un admin voit ceux du client concerné. Pas de fuite cross-client.
- **Anti-over-engineering** : un carnet d'adresses, pas un moteur d'approbation bancaire.
- Toute affirmation sur la codebase est sourcée `fichier:ligne`, avec distinction **vérifié / supposé / à confirmer**.
