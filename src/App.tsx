import { lazy, Suspense } from "react";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Loader2 } from "lucide-react";
import { Analytics } from "@vercel/analytics/react";

// Auth (eagerly loaded — needed for route guard)
import { AuthProvider } from "./contexts/AuthContext";
import { ProtectedRoute } from "./components/auth/ProtectedRoute";
import { MobileRouteWrapper } from "./mobile/components/MobileRouteWrapper";

// ── Lazy-loaded Client Pages ───────────────────────────────────
const AuthPage = lazy(() => import("./pages/AuthPage"));
const ResetPasswordPage = lazy(() => import("./pages/ResetPasswordPage"));
const WalletPage = lazy(() => import("./pages/WalletPage"));
const DepositsPage = lazy(() => import("./pages/DepositsPage"));
const NewDepositPage = lazy(() => import("./pages/NewDepositPage"));
const DepositDetailPage = lazy(() => import("./pages/DepositDetailPage"));
const PaymentsPage = lazy(() => import("./pages/PaymentsPage"));
const NewPaymentPage = lazy(() => import("./pages/NewPaymentPage"));
const PaymentDetailPage = lazy(() => import("./pages/PaymentDetailPage"));
const HistoryPage = lazy(() => import("./pages/HistoryPage"));
const ProfilePage = lazy(() => import("./pages/ProfilePage"));
const BeneficiariesPage = lazy(() => import("./pages/BeneficiariesPage"));
const ClientRatesPage = lazy(() => import("./pages/ClientRatesPage").then(m => ({ default: m.ClientRatesPage })));
const NotificationsPage = lazy(() => import("./pages/NotificationsPage"));
const LandingPage = lazy(() => import("./pages/LandingPage"));
const NotFound = lazy(() => import("./pages/NotFound"));

// ── Lazy-loaded Mobile Admin Pages ─────────────────────────────
const MobileLoginScreen = lazy(() => import("./mobile/screens/auth").then(m => ({ default: m.MobileLoginScreen })));
const MobileDashboard = lazy(() => import("./mobile/screens/dashboard").then(m => ({ default: m.MobileDashboard })));
const MobileDepositsScreen = lazy(() => import("./mobile/screens/deposits").then(m => ({ default: m.MobileDepositsScreen })));
const MobileDepositDetail = lazy(() => import("./mobile/screens/deposits").then(m => ({ default: m.MobileDepositDetail })));
const MobileNewDeposit = lazy(() => import("./mobile/screens/deposits").then(m => ({ default: m.MobileNewDeposit })));
const MobilePaymentsScreen = lazy(() => import("./mobile/screens/payments").then(m => ({ default: m.MobilePaymentsScreen })));
const MobilePaymentDetail = lazy(() => import("./mobile/screens/payments").then(m => ({ default: m.MobilePaymentDetail })));
const MobileNewPayment = lazy(() => import("./mobile/screens/payments").then(m => ({ default: m.MobileNewPayment })));
const MobileBeneficiaryEdit = lazy(() => import("./mobile/screens/payments").then(m => ({ default: m.MobileBeneficiaryEdit })));
const MobileClientsScreen = lazy(() => import("./mobile/screens/clients").then(m => ({ default: m.MobileClientsScreen })));
const MobileClientDetail = lazy(() => import("./mobile/screens/clients").then(m => ({ default: m.MobileClientDetail })));
const MobileCreateClient = lazy(() => import("./mobile/screens/clients").then(m => ({ default: m.MobileCreateClient })));
const MobileClientLedger = lazy(() => import("./mobile/screens/clients").then(m => ({ default: m.MobileClientLedger })));
const MobileMoreScreen = lazy(() => import("./mobile/screens/more").then(m => ({ default: m.MobileMoreScreen })));
const MobileRatesScreen = lazy(() => import("./mobile/screens/more").then(m => ({ default: m.MobileRatesScreen })));
const MobileProofsScreen = lazy(() => import("./mobile/screens/more").then(m => ({ default: m.MobileProofsScreen })));
const MobileHistoryScreen = lazy(() => import("./mobile/screens/more").then(m => ({ default: m.MobileHistoryScreen })));
const MobileNotificationsScreen = lazy(() => import("./mobile/screens/more").then(m => ({ default: m.MobileNotificationsScreen })));
const MobileAdminsScreen = lazy(() => import("./mobile/screens/admins").then(m => ({ default: m.MobileAdminsScreen })));
const MobileAdminDetail = lazy(() => import("./mobile/screens/admins").then(m => ({ default: m.MobileAdminDetail })));
const MobileCreateAdmin = lazy(() => import("./mobile/screens/admins").then(m => ({ default: m.MobileCreateAdmin })));
const MobileSettingsScreen = lazy(() => import("./mobile/screens/more").then(m => ({ default: m.MobileSettingsScreen })));

// ── Lazy-loaded Agent Cash Screens ──────────────────────────
import { AgentCashRouteWrapper } from "./mobile/components/agent-cash/AgentCashRouteWrapper";
const AgentCashLogin = lazy(() => import("./mobile/screens/agent-cash").then(m => ({ default: m.AgentCashLogin })));
const AgentCashPayments = lazy(() => import("./mobile/screens/agent-cash").then(m => ({ default: m.AgentCashPayments })));
const AgentCashScanner = lazy(() => import("./mobile/screens/agent-cash").then(m => ({ default: m.AgentCashScanner })));
const AgentCashPaymentDetail = lazy(() => import("./mobile/screens/agent-cash").then(m => ({ default: m.AgentCashPaymentDetail })));
const AgentCashConfirm = lazy(() => import("./mobile/screens/agent-cash").then(m => ({ default: m.AgentCashConfirm })));
const AgentCashSuccess = lazy(() => import("./mobile/screens/agent-cash").then(m => ({ default: m.AgentCashSuccess })));

const queryClient = new QueryClient();

function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>
  );
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
            <AuthProvider>
              <Suspense fallback={<PageLoader />}>
              <Routes>
                {/* Auth Routes */}
                <Route path="/auth" element={<AuthPage />} />
                <Route path="/auth/reset-password" element={<ResetPasswordPage />} />

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
                <Route path="/history" element={<ProtectedRoute><HistoryPage /></ProtectedRoute>} />
                <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
                <Route path="/beneficiaries" element={<ProtectedRoute><BeneficiariesPage /></ProtectedRoute>} />
                <Route path="/rates" element={<ProtectedRoute><ClientRatesPage /></ProtectedRoute>} />
                <Route path="/notifications" element={<ProtectedRoute><NotificationsPage /></ProtectedRoute>} />

                {/* Mobile Admin Routes */}
                <Route path="/m/login" element={<MobileRouteWrapper requireAuth={false} showTabBar={false}><MobileLoginScreen /></MobileRouteWrapper>} />
                <Route path="/m" element={<MobileRouteWrapper><MobileDashboard /></MobileRouteWrapper>} />
                <Route path="/m/deposits" element={<MobileRouteWrapper><MobileDepositsScreen /></MobileRouteWrapper>} />
                <Route path="/m/deposits/new" element={<MobileRouteWrapper><MobileNewDeposit /></MobileRouteWrapper>} />
                <Route path="/m/deposits/:depositId" element={<MobileRouteWrapper><MobileDepositDetail /></MobileRouteWrapper>} />
                <Route path="/m/payments" element={<MobileRouteWrapper><MobilePaymentsScreen /></MobileRouteWrapper>} />
                <Route path="/m/payments/new" element={<MobileRouteWrapper><MobileNewPayment /></MobileRouteWrapper>} />
                <Route path="/m/payments/:paymentId" element={<MobileRouteWrapper><MobilePaymentDetail /></MobileRouteWrapper>} />
                <Route path="/m/payments/:paymentId/edit-beneficiary" element={<MobileRouteWrapper><MobileBeneficiaryEdit /></MobileRouteWrapper>} />
                <Route path="/m/clients" element={<MobileRouteWrapper><MobileClientsScreen /></MobileRouteWrapper>} />
                <Route path="/m/clients/new" element={<MobileRouteWrapper><MobileCreateClient /></MobileRouteWrapper>} />
                <Route path="/m/clients/:clientId" element={<MobileRouteWrapper><MobileClientDetail /></MobileRouteWrapper>} />
                <Route path="/m/clients/:clientId/ledger" element={<MobileRouteWrapper><MobileClientLedger /></MobileRouteWrapper>} />
                <Route path="/m/more" element={<MobileRouteWrapper><MobileMoreScreen /></MobileRouteWrapper>} />
                <Route path="/m/more/rates" element={<MobileRouteWrapper><MobileRatesScreen /></MobileRouteWrapper>} />
                <Route path="/m/more/proofs" element={<MobileRouteWrapper><MobileProofsScreen /></MobileRouteWrapper>} />
                <Route path="/m/more/history" element={<MobileRouteWrapper><MobileHistoryScreen /></MobileRouteWrapper>} />
                <Route path="/m/more/notifications" element={<MobileRouteWrapper><MobileNotificationsScreen /></MobileRouteWrapper>} />
                <Route path="/m/more/admins" element={<MobileRouteWrapper><MobileAdminsScreen /></MobileRouteWrapper>} />
                <Route path="/m/more/admins/new" element={<MobileRouteWrapper><MobileCreateAdmin /></MobileRouteWrapper>} />
                <Route path="/m/more/admins/:adminId" element={<MobileRouteWrapper><MobileAdminDetail /></MobileRouteWrapper>} />
                <Route path="/m/more/settings" element={<MobileRouteWrapper><MobileSettingsScreen /></MobileRouteWrapper>} />

                {/* Agent Cash Routes */}
                <Route path="/a/login" element={<AgentCashRouteWrapper requireAuth={false} showTabBar={false}><AgentCashLogin /></AgentCashRouteWrapper>} />
                <Route path="/a" element={<AgentCashRouteWrapper><AgentCashPayments /></AgentCashRouteWrapper>} />
                <Route path="/a/scan" element={<AgentCashRouteWrapper><AgentCashScanner /></AgentCashRouteWrapper>} />
                <Route path="/a/payment/:paymentId" element={<AgentCashRouteWrapper><AgentCashPaymentDetail /></AgentCashRouteWrapper>} />
                <Route path="/a/payment/:paymentId/confirm" element={<AgentCashRouteWrapper showTabBar={false}><AgentCashConfirm /></AgentCashRouteWrapper>} />
                <Route path="/a/payment/:paymentId/success" element={<AgentCashRouteWrapper showTabBar={false}><AgentCashSuccess /></AgentCashRouteWrapper>} />

                <Route path="*" element={<NotFound />} />
              </Routes>
              </Suspense>
            </AuthProvider>
          </BrowserRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  </ErrorBoundary>
);

export default App;
