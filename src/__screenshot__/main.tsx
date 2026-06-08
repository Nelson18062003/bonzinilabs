/**
 * DEV-ONLY screenshot harness — renders a single Treasury screen with a fake
 * admin auth context (full permissions). Data comes from the live hooks, whose
 * network calls are intercepted by the Playwright runner (tools/shoot.mjs) and
 * answered with fixtures — so nothing real is contacted.
 *
 * Usage: /screenshot.html?screen=home&theme=dark
 * Not part of the production build (separate root entry, never imported by App).
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AdminAuthContext } from '@/contexts/AdminAuthContext';
import '@/index.css';
import '@/i18n';
import {
  MobileTreasuryHome,
  MobileTreasuryDashboard,
  MobileNewPurchase,
  MobileNewSale,
  MobilePurchasesList,
  MobileSalesList,
  MobileOperationsHistory,
  MobileAccountsScreen,
  MobileInventoryScreen,
  MobileCounterpartiesScreen,
  MobileCounterpartyEdit,
  MobilePurchaseDetail,
  MobileSaleDetail,
  MobileBalanceDashboard,
} from '@/mobile/screens/treasury';
import { DirectionA, DirectionB, DirectionC } from './directions';
import { DashDirA, DashDirB, DashDirC } from './dashDirections';
import { MolaCards } from './molaCards';
import { MolaNav } from './molaNav';
import { MolaScreen } from './molaScreen';
import { MobileAssistantScreen } from '@/mobile/screens/assistant';
import { Flyer } from './flyer';
import { Kit } from './kit';
import { MobileDashboard } from '@/mobile/screens/dashboard';
import { MobileAnalyticsDashboard } from '@/mobile/screens/analytics';
import {
  MobileMoreScreen,
  MobileSettingsScreen,
  MobileAdminProfile,
  MobileNotificationsScreen,
  MobileHistoryScreen,
  MobileProofsScreen,
} from '@/mobile/screens/more';
import { MobileClientsScreen } from '@/mobile/screens/clients/MobileClientsScreen';
import { MobileClientDetail } from '@/mobile/screens/clients/MobileClientDetail';
import { MobileCreateClient } from '@/mobile/screens/clients/MobileCreateClient';
import { MobileClientLedger } from '@/mobile/screens/clients/MobileClientLedger';
import MobileClientBeneficiaries from '@/mobile/screens/clients/MobileClientBeneficiaries';
import {
  MobileDepositsScreenV2,
  MobileDepositDetailV2,
  MobileNewDepositV2,
} from '@/mobile/screens/deposits';
import { MobileNewPayment } from '@/mobile/screens/payments';
import { MobileRatesScreen } from '@/mobile/screens/rates/MobileRatesScreen';
import {
  MobileAdminsScreen,
  MobileCreateAdmin,
  MobileAdminDetail,
} from '@/mobile/screens/admins';

// `path` (optional) renders the component inside a matching <Route> so
// useParams() resolves — needed for the detail/edit screens.
const SCREENS: Record<string, { Comp: React.ComponentType; route: string; path?: string }> = {
  'dir-a': { Comp: DirectionA, route: '/' },
  'dir-b': { Comp: DirectionB, route: '/' },
  'dir-c': { Comp: DirectionC, route: '/' },
  'dash-a': { Comp: DashDirA, route: '/' },
  'dash-b': { Comp: DashDirB, route: '/' },
  'dash-c': { Comp: DashDirC, route: '/' },
  mola: { Comp: MolaCards, route: '/' },
  'mola-nav': { Comp: MolaNav, route: '/' },
  'mola-screen': { Comp: MolaScreen, route: '/' },
  'mola-real': { Comp: MobileAssistantScreen, route: '/m/more/assistant' },
  flyer: { Comp: Flyer, route: '/' },
  kit: { Comp: Kit, route: '/' },
  'dashboard-home': { Comp: MobileDashboard, route: '/m' },
  analytics: { Comp: MobileAnalyticsDashboard, route: '/m/dashboard' },
  home: { Comp: MobileTreasuryHome, route: '/m/more/treasury' },
  dashboard: { Comp: MobileTreasuryDashboard, route: '/m/more/treasury/dashboard' },
  'new-purchase': { Comp: MobileNewPurchase, route: '/m/more/treasury/purchase' },
  'new-sale': { Comp: MobileNewSale, route: '/m/more/treasury/sale' },
  purchases: { Comp: MobilePurchasesList, route: '/m/more/treasury/purchases' },
  sales: { Comp: MobileSalesList, route: '/m/more/treasury/sales' },
  operations: { Comp: MobileOperationsHistory, route: '/m/more/treasury/operations' },
  accounts: { Comp: MobileAccountsScreen, route: '/m/more/treasury/accounts' },
  inventory: { Comp: MobileInventoryScreen, route: '/m/more/treasury/inventory' },
  counterparties: { Comp: MobileCounterpartiesScreen, route: '/m/more/treasury/counterparties' },
  'balance-dashboard': { Comp: MobileBalanceDashboard, route: '/m/more/treasury/balance-dashboard' },
  'purchase-detail': { Comp: MobilePurchaseDetail, route: '/m/more/treasury/purchases/p1', path: '/m/more/treasury/purchases/:operationId' },
  'sale-detail': { Comp: MobileSaleDetail, route: '/m/more/treasury/sales/sa1', path: '/m/more/treasury/sales/:operationId' },
  'counterparty-edit': { Comp: MobileCounterpartyEdit, route: '/m/more/treasury/counterparties/s1', path: '/m/more/treasury/counterparties/:counterpartyId' },
  // More module (Phase 2 M1)
  more: { Comp: MobileMoreScreen, route: '/m/more' },
  'more-settings': { Comp: MobileSettingsScreen, route: '/m/more/settings' },
  'more-profile': { Comp: MobileAdminProfile, route: '/m/more/profile' },
  'more-notifications': { Comp: MobileNotificationsScreen, route: '/m/more/notifications' },
  'more-history': { Comp: MobileHistoryScreen, route: '/m/more/history' },
  'more-proofs': { Comp: MobileProofsScreen, route: '/m/more/proofs' },
  // Clients module (Phase 2 M2)
  clients: { Comp: MobileClientsScreen, route: '/m/clients' },
  'client-detail': { Comp: MobileClientDetail, route: '/m/clients/u1', path: '/m/clients/:clientId' },
  'client-create': { Comp: MobileCreateClient, route: '/m/clients/new' },
  'client-ledger': { Comp: MobileClientLedger, route: '/m/clients/u1/ledger', path: '/m/clients/:clientId/ledger' },
  'client-beneficiaries': { Comp: MobileClientBeneficiaries, route: '/m/clients/u1/beneficiaries', path: '/m/clients/:clientId/beneficiaries' },
  // Deposits module (Phase 2 M3)
  deposits: { Comp: MobileDepositsScreenV2, route: '/m/deposits' },
  'deposit-detail': { Comp: MobileDepositDetailV2, route: '/m/deposits/d1', path: '/m/deposits/:depositId' },
  'deposit-new': { Comp: MobileNewDepositV2, route: '/m/deposits/new' },
  // Payments module (Phase 2 M4)
  'payment-new': { Comp: MobileNewPayment, route: '/m/payments/new' },
  // Rates module (Phase 2 M5)
  rates: { Comp: MobileRatesScreen, route: '/m/rates' },
  // Admins module (Phase 2 M6)
  admins: { Comp: MobileAdminsScreen, route: '/m/more/admins' },
  'admin-create': { Comp: MobileCreateAdmin, route: '/m/more/admins/new' },
  'admin-detail': { Comp: MobileAdminDetail, route: '/m/more/admins/a1', path: '/m/more/admins/:adminId' },
};

const params = new URLSearchParams(window.location.search);
const screenKey = params.get('screen') ?? 'home';
const theme = params.get('theme') ?? 'light';
if (theme === 'dark') document.documentElement.classList.add('dark');
// Seed next-themes so components reading useTheme() (e.g. RateCard) resolve correctly.
try { window.localStorage.setItem('theme', theme); } catch { /* ignore */ }
// Preview-only font toggle (?font=dm) to compare DM Sans vs the default Inter.
if (params.get('font') === 'dm') document.documentElement.style.fontFamily = "'DM Sans', sans-serif";

// Full-permission fake admin so permission guards pass.
const fakeAuth = {
  currentUser: { id: 'demo', email: 'demo@bonzini.com', firstName: 'Demo', lastName: 'Admin', role: 'super_admin' },
  isAuthenticated: true,
  isLoading: false,
  hasPermission: () => true,
  profile: { first_name: 'Demo', last_name: 'Admin' },
  login: async () => {},
  logout: async () => {},
  refresh: async () => {},
  canManageUsers: true,
} as unknown as React.ContextType<typeof AdminAuthContext>;

const qc = new QueryClient({
  defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false, staleTime: 60_000 } },
});

const entry = SCREENS[screenKey] ?? SCREENS.home;
const Screen = entry.Comp;

createRoot(document.getElementById('root')!).render(
  <ThemeProvider attribute="class" defaultTheme={theme} enableSystem={false}>
    <QueryClientProvider client={qc}>
      <AdminAuthContext.Provider value={fakeAuth}>
        <MemoryRouter initialEntries={[entry.route]}>
          {entry.path ? (
            <Routes>
              <Route path={entry.path} element={<Screen />} />
            </Routes>
          ) : (
            <Screen />
          )}
        </MemoryRouter>
      </AdminAuthContext.Provider>
    </QueryClientProvider>
  </ThemeProvider>,
);
