import { lazy, Suspense } from "react";
import "./i18n"; // Initialize i18n before anything renders
import LandingPage from "./pages/LandingPage";
import { useCaptureUtm } from "@/hooks/useUtmTracking";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Loader2 } from "lucide-react";
import { Analytics } from "@vercel/analytics/react";
import { queryClient } from "@/lib/queryClient";

// Auth (eagerly loaded — needed for route guard)
import { AuthProvider } from "./contexts/AuthContext";
import { AdminAuthProvider } from "./contexts/AdminAuthContext";
import { ProtectedRoute } from "./components/auth/ProtectedRoute";
import { AdminRouteWrapper } from "./desktop/components/AdminRouteWrapper";
import { AdminRealtimeListener, ClientRealtimeListener } from "./hooks/useRealtimeInvalidation";
import { KeyboardFocusManager } from "./components/form/KeyboardFocusManager";

// ── Lazy-loaded Client Pages ───────────────────────────────────
const AuthPage = lazy(() => import("./pages/AuthPage"));
const AuthCallbackPage = lazy(() => import("./pages/AuthCallbackPage"));
const OnboardingPage = lazy(() => import("./pages/OnboardingPage"));
const ResetPasswordPage = lazy(() => import("./pages/ResetPasswordPage"));
const WalletPage = lazy(() => import("./pages/WalletPage"));
const DepositsPage = lazy(() => import("./pages/DepositsPage"));
const NewDepositPage = lazy(() => import("./pages/NewDepositPage"));
const DepositDetailPage = lazy(() => import("./pages/DepositDetailPage"));
const PaymentsPage = lazy(() => import("./pages/PaymentsPage"));
const NewPaymentPage = lazy(() => import("./pages/NewPaymentPage"));
const PaymentDetailPage = lazy(() => import("./pages/PaymentDetailPage"));
const EditBeneficiaryPage = lazy(() => import("./pages/EditBeneficiaryPage"));
const HistoryPage = lazy(() => import("./pages/HistoryPage"));
const ProfilePage = lazy(() => import("./pages/ProfilePage"));
const BeneficiariesPage = lazy(() => import("./pages/BeneficiariesPage"));
const ClientRatesPage = lazy(() => import("./pages/rates/ClientRatesPage").then(m => ({ default: m.ClientRatesPage })));
const NotificationsPage = lazy(() => import("./pages/NotificationsPage"));
const SupportListPage = lazy(() => import("./pages/SupportListPage"));
const SupportPage = lazy(() => import("./pages/SupportPage"));
// LandingPage is eagerly loaded (first route, no lazy delay)
const NotFound = lazy(() => import("./pages/NotFound"));

// ── Lazy-loaded Mobile Admin Pages ─────────────────────────────
const MobileLoginScreen = lazy(() => import("./mobile/screens/auth").then(m => ({ default: m.MobileLoginScreen })));
const MobileDashboard = lazy(() => import("./mobile/screens/dashboard").then(m => ({ default: m.MobileDashboard })));
const DesktopDashboard = lazy(() => import("./desktop/screens/dashboard").then(m => ({ default: m.DesktopDashboard })));
const MobileAnalyticsDashboard = lazy(() => import("./mobile/screens/analytics").then(m => ({ default: m.MobileAnalyticsDashboard })));
const DesktopAnalyticsDashboard = lazy(() => import("./desktop/screens/analytics").then(m => ({ default: m.DesktopAnalyticsDashboard })));
const MobileDepositsScreen = lazy(() => import("./mobile/screens/deposits").then(m => ({ default: m.MobileDepositsScreenV2 })));
const DesktopDepositsScreen = lazy(() => import("./desktop/screens/deposits").then(m => ({ default: m.DesktopDepositsScreen })));
const MobileDepositDetail = lazy(() => import("./mobile/screens/deposits").then(m => ({ default: m.MobileDepositDetailV2 })));
const MobileNewDeposit = lazy(() => import("./mobile/screens/deposits").then(m => ({ default: m.MobileNewDepositV2 })));
const MobilePaymentsScreen = lazy(() => import("./mobile/screens/payments").then(m => ({ default: m.MobilePaymentsScreen })));
const DesktopPaymentsScreen = lazy(() => import("./desktop/screens/payments").then(m => ({ default: m.DesktopPaymentsScreen })));
const MobilePaymentDetail = lazy(() => import("./mobile/screens/payments").then(m => ({ default: m.MobilePaymentDetail })));
const MobileNewPayment = lazy(() => import("./mobile/screens/payments").then(m => ({ default: m.MobileNewPayment })));
const MobileBeneficiaryEdit = lazy(() => import("./mobile/screens/payments").then(m => ({ default: m.MobileBeneficiaryEdit })));
const MobileClientsScreen = lazy(() => import("./mobile/screens/clients").then(m => ({ default: m.MobileClientsScreen })));
const DesktopClientsScreen = lazy(() => import("./desktop/screens/clients").then(m => ({ default: m.DesktopClientsScreen })));
const DesktopCreateClient = lazy(() => import("./desktop/screens/clients").then(m => ({ default: m.DesktopCreateClient })));
const MobileClientDetail = lazy(() => import("./mobile/screens/clients").then(m => ({ default: m.MobileClientDetail })));
const MobileCreateClient = lazy(() => import("./mobile/screens/clients").then(m => ({ default: m.MobileCreateClient })));
const MobileClientLedger = lazy(() => import("./mobile/screens/clients").then(m => ({ default: m.MobileClientLedger })));
const MobileClientBeneficiaries = lazy(() => import("./mobile/screens/clients").then(m => ({ default: m.MobileClientBeneficiaries })));
const MobileMoreScreen = lazy(() => import("./mobile/screens/more").then(m => ({ default: m.MobileMoreScreen })));
const DesktopMoreScreen = lazy(() => import("./desktop/screens/more").then(m => ({ default: m.DesktopMoreScreen })));
const DesktopHistoryScreen = lazy(() => import("./desktop/screens/more").then(m => ({ default: m.DesktopHistoryScreen })));
const MobileRatesScreen = lazy(() => import("./mobile/screens/more").then(m => ({ default: m.MobileRatesScreen })));
const MobileProofsScreen = lazy(() => import("./mobile/screens/more").then(m => ({ default: m.MobileProofsScreen })));
const MobileHistoryScreen = lazy(() => import("./mobile/screens/more").then(m => ({ default: m.MobileHistoryScreen })));
const MobileNotificationsScreen = lazy(() => import("./mobile/screens/more").then(m => ({ default: m.MobileNotificationsScreen })));
const MobileAdminsScreen = lazy(() => import("./mobile/screens/admins").then(m => ({ default: m.MobileAdminsScreen })));
const DesktopAdminsScreen = lazy(() => import("./desktop/screens/admins").then(m => ({ default: m.DesktopAdminsScreen })));
const DesktopRatesScreen = lazy(() => import("./desktop/screens/rates").then(m => ({ default: m.DesktopRatesScreen })));
const DesktopSupportScreen = lazy(() => import("./desktop/screens/support").then(m => ({ default: m.DesktopSupportScreen })));
const MobileAdminDetail = lazy(() => import("./mobile/screens/admins").then(m => ({ default: m.MobileAdminDetail })));
const MobileCreateAdmin = lazy(() => import("./mobile/screens/admins").then(m => ({ default: m.MobileCreateAdmin })));
const MobileSettingsScreen = lazy(() => import("./mobile/screens/more").then(m => ({ default: m.MobileSettingsScreen })));
const MobileBriefsScreen = lazy(() => import("./mobile/screens/more").then(m => ({ default: m.MobileBriefsScreen })));
const MobileAdminProfile = lazy(() => import("./mobile/screens/more").then(m => ({ default: m.MobileAdminProfile })));
const MobileSupportListScreen = lazy(() => import("./mobile/screens/support").then(m => ({ default: m.MobileSupportListScreen })));
const MobileSupportConversationScreen = lazy(() => import("./mobile/screens/support").then(m => ({ default: m.MobileSupportConversationScreen })));
const MobileSupportStatsScreen = lazy(() => import("./mobile/screens/support").then(m => ({ default: m.MobileSupportStatsScreen })));
const MobileCannedResponsesScreen = lazy(() => import("./mobile/screens/support").then(m => ({ default: m.MobileCannedResponsesScreen })));
const MobileQuickRepliesScreen = lazy(() => import("./mobile/screens/support").then(m => ({ default: m.MobileQuickRepliesScreen })));

// ── AI Assistant (Directeur des Opérations) ────────────────────
const MobileAssistantScreen = lazy(() => import("./mobile/screens/assistant").then(m => ({ default: m.MobileAssistantScreen })));

const MobileTreasuryHome = lazy(() => import("./mobile/screens/treasury").then(m => ({ default: m.MobileTreasuryHome })));
const DesktopTreasuryHome = lazy(() => import("./desktop/screens/treasury").then(m => ({ default: m.DesktopTreasuryHome })));
const DesktopPurchasesList = lazy(() => import("./desktop/screens/treasury").then(m => ({ default: m.DesktopPurchasesList })));
const DesktopSalesList = lazy(() => import("./desktop/screens/treasury").then(m => ({ default: m.DesktopSalesList })));
const DesktopOperationsHistory = lazy(() => import("./desktop/screens/treasury").then(m => ({ default: m.DesktopOperationsHistory })));
const DesktopCounterpartiesScreen = lazy(() => import("./desktop/screens/treasury").then(m => ({ default: m.DesktopCounterpartiesScreen })));
const DesktopAccountsScreen = lazy(() => import("./desktop/screens/treasury").then(m => ({ default: m.DesktopAccountsScreen })));
const DesktopInventoryScreen = lazy(() => import("./desktop/screens/treasury").then(m => ({ default: m.DesktopInventoryScreen })));
const MobileTreasuryDashboard = lazy(() => import("./mobile/screens/treasury").then(m => ({ default: m.MobileTreasuryDashboard })));
const DesktopTreasuryDashboard = lazy(() => import("./desktop/screens/treasury").then(m => ({ default: m.DesktopTreasuryDashboard })));
const DesktopBalanceDashboard = lazy(() => import("./desktop/screens/treasury").then(m => ({ default: m.DesktopBalanceDashboard })));
const MobileTreasuryNewPurchase = lazy(() => import("./mobile/screens/treasury").then(m => ({ default: m.MobileNewPurchase })));
const MobileTreasuryNewSale = lazy(() => import("./mobile/screens/treasury").then(m => ({ default: m.MobileNewSale })));
const MobileTreasuryCounterparties = lazy(() => import("./mobile/screens/treasury").then(m => ({ default: m.MobileCounterpartiesScreen })));
const MobileTreasuryCounterpartyEdit = lazy(() => import("./mobile/screens/treasury").then(m => ({ default: m.MobileCounterpartyEdit })));
const MobileTreasuryAccounts = lazy(() => import("./mobile/screens/treasury").then(m => ({ default: m.MobileAccountsScreen })));
const MobileTreasuryInventory = lazy(() => import("./mobile/screens/treasury").then(m => ({ default: m.MobileInventoryScreen })));
const MobileTreasuryOperations = lazy(() => import("./mobile/screens/treasury").then(m => ({ default: m.MobileOperationsHistory })));
const MobileTreasuryPurchaseDetail = lazy(() => import("./mobile/screens/treasury").then(m => ({ default: m.MobilePurchaseDetail })));
const MobileTreasurySaleDetail = lazy(() => import("./mobile/screens/treasury").then(m => ({ default: m.MobileSaleDetail })));
const MobileTreasuryPurchasesList = lazy(() => import("./mobile/screens/treasury").then(m => ({ default: m.MobilePurchasesList })));
const MobileTreasurySalesList = lazy(() => import("./mobile/screens/treasury").then(m => ({ default: m.MobileSalesList })));
const MobileTreasuryBalanceDashboard = lazy(() => import("./mobile/screens/treasury").then(m => ({ default: m.MobileBalanceDashboard })));

// ── Lazy-loaded Agent Cash Screens ──────────────────────────
import { AgentCashRouteWrapper } from "./mobile/components/agent-cash/AgentCashRouteWrapper";
const AgentCashLogin = lazy(() => import("./mobile/screens/agent-cash").then(m => ({ default: m.AgentCashLogin })));
const AgentCashPayments = lazy(() => import("./mobile/screens/agent-cash").then(m => ({ default: m.AgentCashPayments })));
const AgentCashScanner = lazy(() => import("./mobile/screens/agent-cash").then(m => ({ default: m.AgentCashScanner })));
const AgentCashPaymentDetail = lazy(() => import("./mobile/screens/agent-cash").then(m => ({ default: m.AgentCashPaymentDetail })));
const AgentCashConfirm = lazy(() => import("./mobile/screens/agent-cash").then(m => ({ default: m.AgentCashConfirm })));
const AgentCashSuccess = lazy(() => import("./mobile/screens/agent-cash").then(m => ({ default: m.AgentCashSuccess })));

// ── Dev-only showcase for form primitives (stripped in prod by dead-code elim) ──
const FormShowcase = lazy(() =>
  import("./components/form/__showcase__/FormShowcase").then(m => ({ default: m.FormShowcase })),
);

function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>
  );
}

function UtmCapture() {
  useCaptureUtm();
  return null;
}

const App = () => (
  <ErrorBoundary>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Sonner position="top-center" />
          <Analytics />
          <BrowserRouter>
            <UtmCapture />
            <AuthProvider>
            <ClientRealtimeListener />
            <AdminAuthProvider>
            <AdminRealtimeListener />
            <KeyboardFocusManager />
              <Suspense fallback={<PageLoader />}>
              <Routes>
                {/* Auth Routes */}
                <Route path="/auth" element={<AuthPage />} />
                <Route path="/auth/callback" element={<AuthCallbackPage />} />
                <Route path="/auth/reset-password" element={<ResetPasswordPage />} />
                <Route path="/onboarding" element={<ProtectedRoute requireComplete={false}><OnboardingPage /></ProtectedRoute>} />

                {/* Landing Page (public) */}
                <Route path="/" element={<LandingPage />} />

                {/* Protected Client Routes */}
                <Route path="/wallet" element={<ProtectedRoute><WalletPage /></ProtectedRoute>} />
                <Route path="/deposits" element={<ProtectedRoute><DepositsPage /></ProtectedRoute>} />
                <Route path="/deposits/new" element={<ProtectedRoute><NewDepositPage /></ProtectedRoute>} />
                <Route path="/deposits/:depositId" element={<ProtectedRoute><DepositDetailPage /></ProtectedRoute>} />
                <Route path="/payments" element={<ProtectedRoute><PaymentsPage /></ProtectedRoute>} />
                <Route path="/payments/new" element={<ProtectedRoute><NewPaymentPage /></ProtectedRoute>} />
                <Route path="/payments/:paymentId" element={<ProtectedRoute><PaymentDetailPage /></ProtectedRoute>} />
                <Route path="/payments/:paymentId/edit-beneficiary" element={<ProtectedRoute><EditBeneficiaryPage /></ProtectedRoute>} />
                <Route path="/history" element={<ProtectedRoute><HistoryPage /></ProtectedRoute>} />
                <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
                <Route path="/beneficiaries" element={<ProtectedRoute><BeneficiariesPage /></ProtectedRoute>} />
                <Route path="/rates" element={<ProtectedRoute><ClientRatesPage /></ProtectedRoute>} />
                <Route path="/notifications" element={<ProtectedRoute><NotificationsPage /></ProtectedRoute>} />
                <Route path="/support" element={<ProtectedRoute><SupportListPage /></ProtectedRoute>} />
                <Route path="/support/:conversationId" element={<ProtectedRoute><SupportPage /></ProtectedRoute>} />

                {/* Mobile Admin Routes */}
                <Route path="/m/login" element={<AdminRouteWrapper requireAuth={false} showTabBar={false}><MobileLoginScreen /></AdminRouteWrapper>} />
                <Route path="/m" element={<AdminRouteWrapper desktop={<DesktopDashboard />}><MobileDashboard /></AdminRouteWrapper>} />
                <Route path="/m/deposits" element={<AdminRouteWrapper desktop={<DesktopDepositsScreen />}><MobileDepositsScreen /></AdminRouteWrapper>} />
                <Route path="/m/deposits/new" element={<AdminRouteWrapper showTabBar={false} desktop={<MobileNewDeposit desktop />}><MobileNewDeposit /></AdminRouteWrapper>} />
                <Route path="/m/deposits/:depositId" element={<AdminRouteWrapper showTabBar={false} desktop={<DesktopDepositsScreen />}><MobileDepositDetail /></AdminRouteWrapper>} />
                <Route path="/m/payments" element={<AdminRouteWrapper desktop={<DesktopPaymentsScreen />}><MobilePaymentsScreen /></AdminRouteWrapper>} />
                <Route path="/m/payments/new" element={<AdminRouteWrapper showTabBar={false} desktop={<MobileNewPayment desktop />}><MobileNewPayment /></AdminRouteWrapper>} />
                <Route path="/m/payments/:paymentId" element={<AdminRouteWrapper desktop={<DesktopPaymentsScreen />}><MobilePaymentDetail /></AdminRouteWrapper>} />
                <Route path="/m/payments/:paymentId/edit-beneficiary" element={<AdminRouteWrapper><MobileBeneficiaryEdit /></AdminRouteWrapper>} />
                <Route path="/m/dashboard" element={<AdminRouteWrapper desktop={<DesktopAnalyticsDashboard />}><MobileAnalyticsDashboard /></AdminRouteWrapper>} />
                <Route path="/m/clients" element={<AdminRouteWrapper desktop={<DesktopClientsScreen />}><MobileClientsScreen /></AdminRouteWrapper>} />
                <Route path="/m/clients/new" element={<AdminRouteWrapper showTabBar={false} desktop={<DesktopCreateClient />}><MobileCreateClient /></AdminRouteWrapper>} />
                <Route path="/m/clients/:clientId" element={<AdminRouteWrapper showTabBar={false} desktop={<DesktopClientsScreen />}><MobileClientDetail /></AdminRouteWrapper>} />
                <Route path="/m/clients/:clientId/ledger" element={<AdminRouteWrapper><MobileClientLedger /></AdminRouteWrapper>} />
                <Route path="/m/clients/:clientId/beneficiaries" element={<AdminRouteWrapper showTabBar={false}><MobileClientBeneficiaries /></AdminRouteWrapper>} />
                <Route path="/m/assistant" element={<AdminRouteWrapper showTabBar={false}><MobileAssistantScreen /></AdminRouteWrapper>} />
                <Route path="/m/more" element={<AdminRouteWrapper desktop={<DesktopMoreScreen />}><MobileMoreScreen /></AdminRouteWrapper>} />
                <Route path="/m/more/rates" element={<AdminRouteWrapper desktop={<DesktopRatesScreen />}><MobileRatesScreen /></AdminRouteWrapper>} />
                <Route path="/m/more/proofs" element={<AdminRouteWrapper><MobileProofsScreen /></AdminRouteWrapper>} />
                <Route path="/m/more/history" element={<AdminRouteWrapper desktop={<DesktopHistoryScreen />}><MobileHistoryScreen /></AdminRouteWrapper>} />
                <Route path="/m/more/notifications" element={<AdminRouteWrapper><MobileNotificationsScreen /></AdminRouteWrapper>} />
                <Route path="/m/more/admins" element={<AdminRouteWrapper desktop={<DesktopAdminsScreen />}><MobileAdminsScreen /></AdminRouteWrapper>} />
                <Route path="/m/more/admins/new" element={<AdminRouteWrapper><MobileCreateAdmin /></AdminRouteWrapper>} />
                <Route path="/m/more/admins/:adminId" element={<AdminRouteWrapper desktop={<DesktopAdminsScreen />}><MobileAdminDetail /></AdminRouteWrapper>} />
                <Route path="/m/more/settings" element={<AdminRouteWrapper desktop={<MobileSettingsScreen desktop />}><MobileSettingsScreen /></AdminRouteWrapper>} />
                <Route path="/m/more/briefs" element={<AdminRouteWrapper><MobileBriefsScreen /></AdminRouteWrapper>} />
                <Route path="/m/more/profile" element={<AdminRouteWrapper desktop={<MobileAdminProfile desktop />}><MobileAdminProfile /></AdminRouteWrapper>} />

                {/* Support Chat — visible only to roles with canAccessSupportChat */}
                <Route path="/m/support" element={<AdminRouteWrapper desktop={<DesktopSupportScreen />}><MobileSupportListScreen /></AdminRouteWrapper>} />
                <Route path="/m/support/stats" element={<AdminRouteWrapper showTabBar={false}><MobileSupportStatsScreen /></AdminRouteWrapper>} />
                <Route path="/m/support/:conversationId" element={<AdminRouteWrapper showTabBar={false} desktop={<DesktopSupportScreen />}><MobileSupportConversationScreen /></AdminRouteWrapper>} />
                <Route path="/m/more/canned-responses" element={<AdminRouteWrapper showTabBar={false}><MobileCannedResponsesScreen /></AdminRouteWrapper>} />
                <Route path="/m/more/quick-replies" element={<AdminRouteWrapper showTabBar={false}><MobileQuickRepliesScreen /></AdminRouteWrapper>} />

                {/* Treasury (visible only to roles with canViewTreasury — guard is in-screen) */}
                <Route path="/m/more/treasury" element={<AdminRouteWrapper desktop={<DesktopTreasuryHome />}><MobileTreasuryHome /></AdminRouteWrapper>} />
                <Route path="/m/more/treasury/dashboard" element={<AdminRouteWrapper desktop={<DesktopTreasuryDashboard />}><MobileTreasuryDashboard /></AdminRouteWrapper>} />
                <Route path="/m/more/treasury/purchase" element={<AdminRouteWrapper showTabBar={false} desktop={<MobileTreasuryNewPurchase desktop />}><MobileTreasuryNewPurchase /></AdminRouteWrapper>} />
                <Route path="/m/more/treasury/sale" element={<AdminRouteWrapper showTabBar={false} desktop={<MobileTreasuryNewSale desktop />}><MobileTreasuryNewSale /></AdminRouteWrapper>} />
                <Route path="/m/more/treasury/counterparties" element={<AdminRouteWrapper desktop={<DesktopCounterpartiesScreen />}><MobileTreasuryCounterparties /></AdminRouteWrapper>} />
                <Route path="/m/more/treasury/counterparties/:counterpartyId" element={<AdminRouteWrapper showTabBar={false}><MobileTreasuryCounterpartyEdit /></AdminRouteWrapper>} />
                <Route path="/m/more/treasury/accounts" element={<AdminRouteWrapper desktop={<DesktopAccountsScreen />}><MobileTreasuryAccounts /></AdminRouteWrapper>} />
                <Route path="/m/more/treasury/inventory" element={<AdminRouteWrapper desktop={<DesktopInventoryScreen />}><MobileTreasuryInventory /></AdminRouteWrapper>} />
                <Route path="/m/more/treasury/operations" element={<AdminRouteWrapper desktop={<DesktopOperationsHistory />}><MobileTreasuryOperations /></AdminRouteWrapper>} />
                <Route path="/m/more/treasury/purchases" element={<AdminRouteWrapper desktop={<DesktopPurchasesList />}><MobileTreasuryPurchasesList /></AdminRouteWrapper>} />
                <Route path="/m/more/treasury/purchases/:operationId" element={<AdminRouteWrapper showTabBar={false}><MobileTreasuryPurchaseDetail /></AdminRouteWrapper>} />
                <Route path="/m/more/treasury/sales" element={<AdminRouteWrapper desktop={<DesktopSalesList />}><MobileTreasurySalesList /></AdminRouteWrapper>} />
                <Route path="/m/more/treasury/balance-dashboard" element={<AdminRouteWrapper desktop={<DesktopBalanceDashboard />}><MobileTreasuryBalanceDashboard /></AdminRouteWrapper>} />
                <Route path="/m/more/treasury/sales/:operationId" element={<AdminRouteWrapper showTabBar={false}><MobileTreasurySaleDetail /></AdminRouteWrapper>} />

                {/* Agent Cash Routes */}
                <Route path="/a/login" element={<AgentCashRouteWrapper requireAuth={false} showTabBar={false}><AgentCashLogin /></AgentCashRouteWrapper>} />
                <Route path="/a" element={<AgentCashRouteWrapper><AgentCashPayments /></AgentCashRouteWrapper>} />
                <Route path="/a/scan" element={<AgentCashRouteWrapper><AgentCashScanner /></AgentCashRouteWrapper>} />
                <Route path="/a/payment/:paymentId" element={<AgentCashRouteWrapper><AgentCashPaymentDetail /></AgentCashRouteWrapper>} />
                <Route path="/a/payment/:paymentId/confirm" element={<AgentCashRouteWrapper showTabBar={false}><AgentCashConfirm /></AgentCashRouteWrapper>} />
                <Route path="/a/payment/:paymentId/success" element={<AgentCashRouteWrapper showTabBar={false}><AgentCashSuccess /></AgentCashRouteWrapper>} />

                {/* Dev-only form primitives showcase. Only mounted in dev builds. */}
                {import.meta.env.DEV && (
                  <Route path="/dev/form-showcase" element={<FormShowcase />} />
                )}

                <Route path="*" element={<NotFound />} />
              </Routes>
              </Suspense>
            </AdminAuthProvider>
            </AuthProvider>
          </BrowserRouter>
        </TooltipProvider>
        <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-left" />
      </QueryClientProvider>
    </ThemeProvider>
  </ErrorBoundary>
);

export default App;
