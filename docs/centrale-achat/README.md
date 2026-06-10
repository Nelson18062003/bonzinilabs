# Module Centrale d'achat — Conception

Conception du module **centrale d'achat** de Bonzini : gérer, pour un client importateur, le cycle complet *Sourcing → Order → Production → QC → Shipping → Delivery* sur N fournisseurs chinois, avec couche IA conversationnelle (héritière de Mola) pour piloter et générer les rapports.

**Déclencheur :** mission de mai 2026 — un client camerounais, 30+ usines visitées avec le père, > 3 M CNY d'achats, avances versées en cash/Alipay/WeChat… et aucun moyen aujourd'hui d'en produire un rapport propre.

**Méthode :** une phase à la fois, gate de validation à chaque fin de phase, apprentissage du domaine avant tout design, anti-réinvention, coût mensuel chiffré par décision, `fichier:ligne` pour le code et URL+date pour le web, niveaux de confiance 🟢/🟡/🔴 systématiques. **Aucun code avant validation de la conception.**

## Les documents

| # | Doc | Contenu | Statut |
|---|---|---|---|
| 00 | [`00-PHASE0-CADRAGE.md`](./00-PHASE0-CADRAGE.md) | État des lieux vérifié (apps, modèle d'argent, treasury, Mola, greenfield), lecture critique du brief, workflow proposé, risques, questions | ✅ livré — **gate en attente (Q-1…Q-8)** |
| 10 | `10-DOMAINE-PROCUREMENT.md` | Vocabulaire et standards du sourcing Chine (sourcé), étude Anvyl/Flexport/Alibaba/ImportYeti/QIMA + playbooks agents de sourcing, patterns à copier/éviter | ⏳ Phase 1 |
| 20 | `20-DIAGNOSTIC-TERRAIN.md` | Questionnaire père/founder, reconstitution mission mai 2026, personas, parcours actuels, pain points | ⏳ Phase 2 |
| 30 | `30-MODELE-METIER.md` | Entités, machines à états, modèle monétaire, marge/remises, intégration ledger+treasury, RLS, reporting | ⏳ Phase 3 |
| 40 | `40-UX-TERRAIN.md` | Parcours mobile terrain (capture < 30 s), offline/réseau Chine, pipeline document→OCR→validation, vue 360° | ⏳ Phase 4 |
| 50 | `50-AGENT-IA.md` | Agent centrale d'achat : tools live, capacités `@mola`, mémoire, rapports génératifs, alertes, evals | ⏳ Phase 5 |
| 60 | `60-ARCHITECTURE-COUTS.md` | Choix techniques chiffrés (OCR, traduction, stockage), coûts mensuels par palier 1/10/50 clients | ⏳ Phase 6 |
| 70 | `70-ROADMAP-LOTS.md` | Lots d'implémentation — Lot 1 = MVP interne + catch-up rétroactif mai 2026 — DoD, GO code | ⏳ Phase 7 |

- [`DECISIONS.md`](./DECISIONS.md) — journal des décisions (D-001…), chacune datée et motivée.

## Références internes
- `docs/assistant-ops/refonte/` — la refonte Mola : le précédent méthodologique et technique dont ce module hérite (convention `@mola`, eval, mémoire, coûts).
- `docs/analysis-tracabilite-chaine-valeur.md` — doctrine treasury (append-only, WAC, multi-devises) que la centrale d'achat respecte.

## État
- ✅ **Phase 0 livrée** (2026-06-10) : état des lieux complet, workflow proposé, 8 questions de gate posées.
- ⏳ En attente : validation du workflow (Q-1) et réponses Q-2…Q-8 → démarrage Phase 1.
