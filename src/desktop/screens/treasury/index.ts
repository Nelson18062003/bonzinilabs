/**
 * Trésorerie desktop — surface publique.
 *
 * Le module tient désormais en UN écran à six vues
 * (docs/admin-redesign/07-treasury-module.md) plus deux saisies (achat,
 * vente) qui s'ouvrent en fenêtre par-dessus la vue courante.
 * Les anciens écrans par-page (Home/Dashboard/Accounts/Inventory/Operations/
 * Purchases/Sales/Counterparties) sont remplacés : leurs routes redirigent
 * vers la vue correspondante.
 */
export { DesktopTreasuryScreen } from './DesktopTreasuryScreen';
export { type TreasuryView, treasuryPaths, TREASURY_VIEWS } from './treasuryNav';
export { DesktopNewPurchase } from './DesktopNewPurchase';
export { DesktopNewSale } from './DesktopNewSale';
export { DesktopBalanceDashboard } from './DesktopBalanceDashboard';
