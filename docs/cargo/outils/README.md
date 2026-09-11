# docs/cargo/outils — Outils opérationnels Cargo

| Fichier | Rôle |
|---|---|
| `Bonzini-Comparateur-Cotations-Fret.xlsx` | **Le livrable** — grille de comparaison des cotations de fret maritime |
| `generer-comparateur.py` | Script qui régénère le classeur (`python3 generer-comparateur.py`) |

## Comparateur de cotations

Sert à comparer plusieurs offres de transport maritime pour un même conteneur
**sur le total réel**, et non sur le prix affiché. Le piège du métier est
qu'une offre annoncée moins chère devient plus chère une fois les surcharges
ajoutées (THC, BAF, ISPS, documentation, marchandises dangereuses…).

**4 onglets :**

1. **Mode d'emploi** — code couleur et marche à suivre
2. **Avant de commencer** — documents KYC exigés à l'inscription chez les
   armateurs, données de la simulation, ordres de grandeur de contrôle
3. **Comparateur** — la grille : 5 offres en colonnes, ~15 postes de coût en
   lignes, totaux en USD et en FCFA, plus une section « ce qui n'est pas un
   prix » (transbordements, franchise, garantie de chargement)
4. **Historique** — journal des cotations. Au fil des conteneurs, il devient
   une base de données de prix sur le corridor Chine → Douala.

## Notes

- Les cellules à fond jaune sont les seules à remplir ; le reste est calculé.
- Les fourchettes de prix de l'onglet 2 sont des **relevés de marché non
  officiels** — elles servent à détecter une cotation aberrante, jamais à
  construire un prix client.
- Les formules n'ont pas pu être recalculées à la génération (LibreOffice
  indisponible dans l'environnement de build) ; les plages ont été vérifiées
  manuellement et n'utilisent que des fonctions compatibles Excel 2007
  (`SUM`, `IFERROR`, `AVERAGE`, `MIN`, `MAX`).
