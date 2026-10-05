# Trésorerie — la refonte du module desktop (octobre 2026)

Suite de `01-CARTOGRAPHIE.md` et `02-DIAGNOSTIC.md`. Ce qui a été refait, et
ce qui ne l'a **pas** été.

## Périmètre

- **Refait** : la structure du module, la navigation, tous les écrans et tous
  les formulaires du desktop admin.
- **Pas touché** : les calculs (coût moyen, bénéfice, marge, taux de revient),
  les RPC et leurs paramètres, les soldes, le lien avec les dépôts. Les
  formulaires envoient exactement ce qu'envoyaient les anciens.
- **Mobile** : inchangé (phase 2).

## Six rubriques, pilotées par l'adresse

| Rubrique | Adresse | Contenu |
|---|---|---|
| Vue d'ensemble | `/m/more/treasury` | soldes XAF / CNY, stock et coût moyen, dernières opérations, raccourcis |
| Opérations | `/operations[?type=purchase\|sale\|voided]` | table filtrable + fiche à droite (`/operations/:kind/:id`) |
| Comptes | `/accounts`, `/accounts/:id` | soldes par devise ; page d'un compte : mouvements avec solde après, inventaires |
| Contreparties | `/counterparties[?type=cny_buyer]`, `/counterparties/:id` | fournisseurs USDT, acheteurs CNY, fiche avec chiffres de la période |
| Analyse | `/analysis` | bénéfice, marge, revient, taux client ; volumes ; courbes ; meilleures contreparties |
| Contrôle | `/ledger`, `/inventory`, `/balance-dashboard` | grand livre (une devise à la fois), historique des inventaires, visuel des soldes |

Les saisies `/purchase` et `/sale` s'ouvrent en panneau par-dessus la rubrique
courante. Les anciens chemins mobiles (`/purchases/:id`, `/dashboard`…) mènent
au même endroit sur ordinateur.

## Les fichiers

- `tstyle.ts` — jetons, recettes de boutons, `parseAmount`, `reasonError`.
- `tkit.tsx` — le kit : montants avec devise écrite, cartes, tables à lignes
  cliquables au clavier, états chargement / erreur / vide, sélecteur avec
  recherche, champ de montant, date et heure, panneau latéral, fenêtre,
  confirmation. Rendu en ligne (pas de portail) pour hériter de `.admin-theme`.
- `treasuryNav.ts` — rubriques, chemins, lecture de l'adresse.
- `treasuryActions.ts` — une vue demande (ajuster, inventorier, modifier,
  annuler), la coquille ouvre la fenêtre.
- `operationView.ts` — un achat ou une vente lu pour l'écran (taux AVEC unité).
- `treasuryLabels.ts` — libellés du grand livre (vraies valeurs des énumérations).
- Écrans : `OverviewView`, `OperationsView`, `AccountsView`,
  `CounterpartiesView`, `TreasuryAnalysisView`, `ControlView`.
- Formulaires : `PurchaseForm`, `SaleForm`, `AccountForms` (ajuster,
  inventorier), `CounterpartyForm`, `VoidForm`.

## Règles des formulaires

1. Étapes numérotées ; une valeur calculée est montrée dans un encadré.
2. On tape deux valeurs, la troisième se calcule (USDT, montant, taux).
3. Achat réparti : la répartition doit tomber juste sur le total.
4. « Vérifier et enregistrer » montre un récapitulatif (stock et coût moyen
   avant → après) ; rien n'est écrit avant la confirmation.
5. Fermer une saisie remplie demande confirmation.
6. XAF entier et exact (`isValidXafAmount`), USDT et CNY à deux décimales ;
   une date d'opération ne peut pas être dans le futur.
7. Motif de 10 caractères au moins : ajustement, écart d'inventaire, annulation.

Captures du rendu : `captures/` (harnais `treasury-preview.html`, données fictives).
