/**
 * Trésorerie mobile v2 (maquettes docs/mobile-refonte/maquettes-v2/07-tresorerie
 * et 05-tresorerie-taux). Les noms en `Mobile…` sont ceux de l'ancien module,
 * gardés pour le harnais de capture (`src/__screenshot__/main.tsx`).
 */
export { TreasurerHome } from './TreasurerHome';
export { TreasuryTab } from './TreasuryTab';
export { OperationsScreen, PurchasesScreen, SalesScreen } from './OperationsScreen';
export { OperationScreen, PurchaseScreen, SaleScreen } from './OperationScreen';
export { PurchaseFlow } from './PurchaseFlow';
export { SaleFlow } from './SaleFlow';
export { AccountsScreen } from './AccountsScreen';
export { AccountScreen } from './AccountScreen';
export { AdjustFlow } from './AdjustFlow';
export { InventoryFlow } from './InventoryFlow';
export { InventoriesScreen } from './InventoriesScreen';
export { LedgerScreen } from './LedgerScreen';
export { CounterpartiesScreen, CounterpartyScreen, CounterpartyEditScreen } from './CounterpartiesScreens';
export { BalanceVisualScreen } from './BalanceVisualScreen';
export { AnalysisScreen } from './AnalysisScreen';

// Anciens noms (harnais de capture).
export { TreasuryTab as MobileTreasuryHome } from './TreasuryTab';
export { AnalysisScreen as MobileTreasuryDashboard } from './AnalysisScreen';
export { PurchaseFlow as MobileNewPurchase } from './PurchaseFlow';
export { SaleFlow as MobileNewSale } from './SaleFlow';
export { PurchasesScreen as MobilePurchasesList, SalesScreen as MobileSalesList, OperationsScreen as MobileOperationsHistory } from './OperationsScreen';
export { AccountsScreen as MobileAccountsScreen } from './AccountsScreen';
export { InventoriesScreen as MobileInventoryScreen } from './InventoriesScreen';
export { CounterpartiesScreen as MobileCounterpartiesScreen, CounterpartyScreen as MobileCounterpartyEdit } from './CounterpartiesScreens';
export { PurchaseScreen as MobilePurchaseDetail, SaleScreen as MobileSaleDetail } from './OperationScreen';
export { BalanceVisualScreen as MobileBalanceDashboard } from './BalanceVisualScreen';
