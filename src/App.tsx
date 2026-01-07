import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";

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
import NotFound from "./pages/NotFound";

// Admin Pages
import { AdminLoginPage } from "./pages/admin/AdminLoginPage";
import { AdminResetPasswordPage } from "./pages/admin/AdminResetPasswordPage";
import { AdminDashboard } from "./pages/admin/AdminDashboard";
import { AdminClientsPage } from "./pages/admin/AdminClientsPage";
import { AdminClientDetailPage } from "./pages/admin/AdminClientDetailPage";
import { AdminWalletsPage } from "./pages/admin/AdminWalletsPage";
import { AdminWalletDetailPage } from "./pages/admin/AdminWalletDetailPage";
import { AdminDepositsPage } from "./pages/admin/AdminDepositsPage";
import { AdminDepositDetailPage } from "./pages/admin/AdminDepositDetailPage";
import { AdminNewDepositPage } from "./pages/admin/AdminNewDepositPage";
import { AdminPaymentsPage } from "./pages/admin/AdminPaymentsPage";
import { AdminPaymentDetailPage } from "./pages/admin/AdminPaymentDetailPage";
import { AdminNewPaymentPage } from "./pages/admin/AdminNewPaymentPage";
import AdminCashScanPage from "./pages/admin/AdminCashScanPage";
import { AdminRatesPage } from "./pages/admin/AdminRatesPage";
import { AdminProofsPage } from "./pages/admin/AdminProofsPage";
import { AdminHistoryPage } from "./pages/admin/AdminHistoryPage";
import { AdminNotificationsPage } from "./pages/admin/AdminNotificationsPage";
import { AdminUsersPage } from "./pages/admin/AdminUsersPage";

// Admin Auth
import { AdminAuthProvider } from "./contexts/AdminAuthContext";
import { ProtectedAdminRoute } from "./components/admin/ProtectedAdminRoute";

// Agent Pages
import AgentLoginPage from "./pages/agent/AgentLoginPage";
import AgentPaymentsPage from "./pages/agent/AgentPaymentsPage";
import AgentPaymentDetailPage from "./pages/agent/AgentPaymentDetailPage";
import AgentScanPage from "./pages/agent/AgentScanPage";

// Agent Auth
import { AgentAuthProvider } from "./contexts/AgentAuthContext";
import { LanguageProvider } from "./contexts/LanguageContext";
import { ProtectedAgentRoute } from "./components/agent/ProtectedAgentRoute";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner position="top-center" />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            {/* Auth Route */}
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
            
            {/* Admin Routes */}
            <Route path="/admin/login" element={
              <AdminAuthProvider>
                <AdminLoginPage />
              </AdminAuthProvider>
            } />
            <Route path="/admin/reset-password" element={<AdminResetPasswordPage />} />
            <Route path="/admin" element={
              <AdminAuthProvider>
                <ProtectedAdminRoute><AdminDashboard /></ProtectedAdminRoute>
              </AdminAuthProvider>
            } />
            <Route path="/admin/clients" element={
              <AdminAuthProvider>
                <ProtectedAdminRoute><AdminClientsPage /></ProtectedAdminRoute>
              </AdminAuthProvider>
            } />
            <Route path="/admin/clients/:clientId" element={
              <AdminAuthProvider>
                <ProtectedAdminRoute><AdminClientDetailPage /></ProtectedAdminRoute>
              </AdminAuthProvider>
            } />
            <Route path="/admin/wallets" element={
              <AdminAuthProvider>
                <ProtectedAdminRoute><AdminWalletsPage /></ProtectedAdminRoute>
              </AdminAuthProvider>
            } />
            <Route path="/admin/wallets/:clientId" element={
              <AdminAuthProvider>
                <ProtectedAdminRoute><AdminWalletDetailPage /></ProtectedAdminRoute>
              </AdminAuthProvider>
            } />
            <Route path="/admin/deposits" element={
              <AdminAuthProvider>
                <ProtectedAdminRoute><AdminDepositsPage /></ProtectedAdminRoute>
              </AdminAuthProvider>
            } />
            <Route path="/admin/deposits/new" element={
              <AdminAuthProvider>
                <ProtectedAdminRoute><AdminNewDepositPage /></ProtectedAdminRoute>
              </AdminAuthProvider>
            } />
            <Route path="/admin/deposits/:depositId" element={
              <AdminAuthProvider>
                <ProtectedAdminRoute><AdminDepositDetailPage /></ProtectedAdminRoute>
              </AdminAuthProvider>
            } />
            <Route path="/admin/payments" element={
              <AdminAuthProvider>
                <ProtectedAdminRoute><AdminPaymentsPage /></ProtectedAdminRoute>
              </AdminAuthProvider>
            } />
            <Route path="/admin/payments/new" element={
              <AdminAuthProvider>
                <ProtectedAdminRoute><AdminNewPaymentPage /></ProtectedAdminRoute>
              </AdminAuthProvider>
            } />
            <Route path="/admin/payments/:paymentId" element={
              <AdminAuthProvider>
                <ProtectedAdminRoute><AdminPaymentDetailPage /></ProtectedAdminRoute>
              </AdminAuthProvider>
            } />
            <Route path="/admin/payments/cash-scan" element={
              <AdminAuthProvider>
                <ProtectedAdminRoute><AdminCashScanPage /></ProtectedAdminRoute>
              </AdminAuthProvider>
            } />
            <Route path="/admin/rates" element={
              <AdminAuthProvider>
                <ProtectedAdminRoute><AdminRatesPage /></ProtectedAdminRoute>
              </AdminAuthProvider>
            } />
            <Route path="/admin/proofs" element={
              <AdminAuthProvider>
                <ProtectedAdminRoute><AdminProofsPage /></ProtectedAdminRoute>
              </AdminAuthProvider>
            } />
            <Route path="/admin/history" element={
              <AdminAuthProvider>
                <ProtectedAdminRoute><AdminHistoryPage /></ProtectedAdminRoute>
              </AdminAuthProvider>
            } />
            <Route path="/admin/notifications" element={
              <AdminAuthProvider>
                <ProtectedAdminRoute><AdminNotificationsPage /></ProtectedAdminRoute>
              </AdminAuthProvider>
            } />
            <Route path="/admin/users" element={
              <AdminAuthProvider>
                <ProtectedAdminRoute><AdminUsersPage /></ProtectedAdminRoute>
              </AdminAuthProvider>
            } />

            {/* Agent Cash Routes */}
            <Route path="/agent/login" element={
              <LanguageProvider>
                <AgentAuthProvider>
                  <AgentLoginPage />
                </AgentAuthProvider>
              </LanguageProvider>
            } />
            <Route path="/agent/payments" element={
              <LanguageProvider>
                <AgentAuthProvider>
                  <ProtectedAgentRoute><AgentPaymentsPage /></ProtectedAgentRoute>
                </AgentAuthProvider>
              </LanguageProvider>
            } />
            <Route path="/agent/payments/:paymentId" element={
              <LanguageProvider>
                <AgentAuthProvider>
                  <ProtectedAgentRoute><AgentPaymentDetailPage /></ProtectedAgentRoute>
                </AgentAuthProvider>
              </LanguageProvider>
            } />
            <Route path="/agent/scan" element={
              <LanguageProvider>
                <AgentAuthProvider>
                  <ProtectedAgentRoute><AgentScanPage /></ProtectedAgentRoute>
                </AgentAuthProvider>
              </LanguageProvider>
            } />
            
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
