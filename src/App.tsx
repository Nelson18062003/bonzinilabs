import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ErrorBoundary } from "@/components/ErrorBoundary";

// Auth
import { AuthProvider } from "./contexts/AuthContext";
import { ProtectedRoute } from "./components/auth/ProtectedRoute";
import AuthPage from "./pages/AuthPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";

// Client Pages
import WalletPage from "./pages/WalletPage";
import DepositsPage from "./pages/DepositsPage";
import NewDepositPage from "./pages/NewDepositPage";
import DepositDetailPage from "./pages/DepositDetailPage";
import PaymentsPage from "./pages/PaymentsPage";
import NewPaymentPage from "./pages/NewPaymentPage";
import PaymentDetailPage from "./pages/PaymentDetailPage";
import HistoryPage from "./pages/HistoryPage";
import ProfilePage from "./pages/ProfilePage";
import BeneficiariesPage from "./pages/BeneficiariesPage";
import { ClientRatesPage } from "./pages/ClientRatesPage";
import NotificationsPage from "./pages/NotificationsPage";
import NotFound from "./pages/NotFound";

// Mobile Admin Pages
import { MobileRouteWrapper } from "./mobile/components/MobileRouteWrapper";
import { MobileLoginScreen } from "./mobile/screens/auth";
import { MobileDashboard } from "./mobile/screens/dashboard";
import { MobileDepositsScreen, MobileDepositDetail, MobileNewDeposit } from "./mobile/screens/deposits";
import { MobilePaymentsScreen, MobilePaymentDetail, MobileNewPayment } from "./mobile/screens/payments";
import { MobileClientsScreen, MobileClientDetail } from "./mobile/screens/clients";
import { MobileMoreScreen, MobileRatesScreen, MobileProofsScreen, MobileHistoryScreen } from "./mobile/screens/more";

const queryClient = new QueryClient();

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner position="top-center" />
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              {/* Auth Routes */}
              <Route path="/auth" element={<AuthPage />} />
              <Route path="/auth/reset-password" element={<ResetPasswordPage />} />

              {/* Protected Client Routes */}
              <Route path="/" element={<ProtectedRoute><WalletPage /></ProtectedRoute>} />
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
              <Route path="/m/clients" element={<MobileRouteWrapper><MobileClientsScreen /></MobileRouteWrapper>} />
              <Route path="/m/clients/:clientId" element={<MobileRouteWrapper><MobileClientDetail /></MobileRouteWrapper>} />
              <Route path="/m/more" element={<MobileRouteWrapper><MobileMoreScreen /></MobileRouteWrapper>} />
              <Route path="/m/more/rates" element={<MobileRouteWrapper><MobileRatesScreen /></MobileRouteWrapper>} />
              <Route path="/m/more/proofs" element={<MobileRouteWrapper><MobileProofsScreen /></MobileRouteWrapper>} />
              <Route path="/m/more/history" element={<MobileRouteWrapper><MobileHistoryScreen /></MobileRouteWrapper>} />

              <Route path="*" element={<NotFound />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
