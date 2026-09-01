/**
 * Trésorerie desktop — surface publique.
 *
 * Le module tient désormais en UN écran à quatre vues
 * (docs/admin-redesign/07-treasury-module.md) plus deux pages de création.
 * Les anciens écrans par-page (Home/Dashboard/Accounts/Inventory/Operations/
 * Purchases/Sales/Counterparties) sont remplacés : leurs routes redirigent
 * vers la vue correspondante.
 */
export { DesktopTreasuryScreen, type TreasuryView } from './DesktopTreasuryScreen';
export { DesktopNewPurchase } from './DesktopNewPurchase';
export { DesktopNewSale } from './DesktopNewSale';
export { DesktopBalanceDashboard } from './DesktopBalanceDashboard';
