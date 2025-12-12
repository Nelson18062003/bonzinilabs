import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";

// Auth
import { AuthProvider } from "./contexts/AuthContext";
import { ProtectedRoute } from "./components/auth/ProtectedRoute";
import AuthPage from "./pages/AuthPage";

// Client Pages
import WalletPage from "./pages/WalletPage";
import DepositsPage from "./pages/DepositsPage";
import NewDepositPage from "./pages/NewDepositPage";
import DepositDetailPage from "./pages/DepositDetailPage";
import PaymentsPage from "./pages/PaymentsPage";
import NewPaymentPage from "./pages/NewPaymentPage";
import HistoryPage from "./pages/HistoryPage";
import ProfilePage from "./pages/ProfilePage";
import BeneficiariesPage from "./pages/BeneficiariesPage";
import NotFound from "./pages/NotFound";

// Admin Pages
import { AdminLoginPage } from "./pages/admin/AdminLoginPage";
import { AdminDashboard } from "./pages/admin/AdminDashboard";
import { AdminClientsPage } from "./pages/admin/AdminClientsPage";
import { AdminClientDetailPage } from "./pages/admin/AdminClientDetailPage";
import { AdminWalletsPage } from "./pages/admin/AdminWalletsPage";
import { AdminWalletDetailPage } from "./pages/admin/AdminWalletDetailPage";
import { AdminDepositsPage } from "./pages/admin/AdminDepositsPage";
import { AdminDepositDetailPage } from "./pages/admin/AdminDepositDetailPage";
import { AdminPaymentsPage } from "./pages/admin/AdminPaymentsPage";
import { AdminPaymentDetailPage } from "./pages/admin/AdminPaymentDetailPage";
import { AdminRatesPage } from "./pages/admin/AdminRatesPage";
import { AdminProofsPage } from "./pages/admin/AdminProofsPage";
import { AdminHistoryPage } from "./pages/admin/AdminHistoryPage";
import { AdminNotificationsPage } from "./pages/admin/AdminNotificationsPage";
import { AdminUsersPage } from "./pages/admin/AdminUsersPage";

// Admin Auth
import { AdminAuthProvider } from "./contexts/AdminAuthContext";
import { ProtectedAdminRoute } from "./components/admin/ProtectedAdminRoute";

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
            
            {/* Protected Client Routes */}
            <Route path="/" element={<ProtectedRoute><WalletPage /></ProtectedRoute>} />
            <Route path="/deposits" element={<ProtectedRoute><DepositsPage /></ProtectedRoute>} />
            <Route path="/deposits/new" element={<ProtectedRoute><NewDepositPage /></ProtectedRoute>} />
            <Route path="/deposits/:depositId" element={<ProtectedRoute><DepositDetailPage /></ProtectedRoute>} />
            <Route path="/payments" element={<ProtectedRoute><PaymentsPage /></ProtectedRoute>} />
            <Route path="/payments/new" element={<ProtectedRoute><NewPaymentPage /></ProtectedRoute>} />
            <Route path="/history" element={<ProtectedRoute><HistoryPage /></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
            <Route path="/beneficiaries" element={<ProtectedRoute><BeneficiariesPage /></ProtectedRoute>} />
            
            {/* Admin Routes */}
            <Route path="/admin/login" element={
              <AdminAuthProvider>
                <AdminLoginPage />
              </AdminAuthProvider>
            } />
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
            <Route path="/admin/payments/:paymentId" element={
              <AdminAuthProvider>
                <ProtectedAdminRoute><AdminPaymentDetailPage /></ProtectedAdminRoute>
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
            
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
