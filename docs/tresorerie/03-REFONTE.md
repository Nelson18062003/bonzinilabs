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

## Version 2 (après retour : « trop chargé, trop complexe »)

- **Moins d'informations** : vue d'ensemble réduite à trois chiffres et la
  liste des dernières opérations ; table des opérations en cinq colonnes ;
  comptes en trois cartes (XAF, USDT, CNY) ; police DM Sans, cartes douces,
  devise écrite discrètement au lieu des pastilles.
- **Achat et vente sur un seul écran**, sans étapes ni « mode » : trois
  montants liés (USDT, taux, XAF ou CNY) — on en tape deux, le troisième se
  calcule (`linkedAmounts.ts`). La date (« maintenant ») et la référence /
  note sont repliées. Plus de deuxième confirmation.
- **Le reçu** (`OperationReceipt.tsx`) : l'image à envoyer au fournisseur ou
  à l'acheteur comme preuve — bande aux trois couleurs du logo, montant en
  grand, taux, montant payé ou reçu, contrepartie, compte, date, référence,
  n° d'opération (ACH-… / VTE-…). Jamais la note interne ni le coût moyen.
  « Copier l'image » (WhatsApp, WeChat) et « Télécharger » (PNG).
  Il s'affiche juste après l'enregistrement, et quand on ouvre une opération.

## Règles des formulaires

1. Un seul écran ; on tape deux montants, le troisième se calcule.
2. Achat réparti : « Plusieurs comptes ? », la répartition doit tomber juste.
3. Fermer une saisie remplie demande confirmation.
4. XAF entier et exact (`isValidXafAmount`), USDT et CNY à deux décimales ;
   une date d'opération ne peut pas être dans le futur.
5. Motif de 10 caractères au moins : ajustement, écart d'inventaire, annulation.

Captures du rendu : `captures/` (harnais `treasury-preview.html`, données fictives).
