import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";

// Client Pages
import WalletPage from "./pages/WalletPage";
import DepositsPage from "./pages/DepositsPage";
import NewDepositPage from "./pages/NewDepositPage";
import PaymentsPage from "./pages/PaymentsPage";
import NewPaymentPage from "./pages/NewPaymentPage";
import HistoryPage from "./pages/HistoryPage";
import ProfilePage from "./pages/ProfilePage";
import BeneficiariesPage from "./pages/BeneficiariesPage";
import NotFound from "./pages/NotFound";

// Admin Pages
import { AdminDashboard } from "./pages/admin/AdminDashboard";
import { AdminClientsPage } from "./pages/admin/AdminClientsPage";
import { AdminWalletsPage } from "./pages/admin/AdminWalletsPage";
import { AdminDepositsPage } from "./pages/admin/AdminDepositsPage";
import { AdminPaymentsPage } from "./pages/admin/AdminPaymentsPage";
import { AdminRatesPage } from "./pages/admin/AdminRatesPage";
import { AdminProofsPage } from "./pages/admin/AdminProofsPage";
import { AdminHistoryPage } from "./pages/admin/AdminHistoryPage";
import { AdminNotificationsPage } from "./pages/admin/AdminNotificationsPage";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner position="top-center" />
      <BrowserRouter>
        <Routes>
          {/* Client Routes */}
          <Route path="/" element={<WalletPage />} />
          <Route path="/deposits" element={<DepositsPage />} />
          <Route path="/deposits/new" element={<NewDepositPage />} />
          <Route path="/payments" element={<PaymentsPage />} />
          <Route path="/payments/new" element={<NewPaymentPage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/beneficiaries" element={<BeneficiariesPage />} />
          
          {/* Admin Routes */}
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/clients" element={<AdminClientsPage />} />
          <Route path="/admin/wallets" element={<AdminWalletsPage />} />
          <Route path="/admin/deposits" element={<AdminDepositsPage />} />
          <Route path="/admin/payments" element={<AdminPaymentsPage />} />
          <Route path="/admin/rates" element={<AdminRatesPage />} />
          <Route path="/admin/proofs" element={<AdminProofsPage />} />
          <Route path="/admin/history" element={<AdminHistoryPage />} />
          <Route path="/admin/notifications" element={<AdminNotificationsPage />} />
          
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
