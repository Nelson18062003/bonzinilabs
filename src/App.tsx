import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";

// Pages
import WalletPage from "./pages/WalletPage";
import DepositsPage from "./pages/DepositsPage";
import NewDepositPage from "./pages/NewDepositPage";
import PaymentsPage from "./pages/PaymentsPage";
import NewPaymentPage from "./pages/NewPaymentPage";
import HistoryPage from "./pages/HistoryPage";
import ProfilePage from "./pages/ProfilePage";
import BeneficiariesPage from "./pages/BeneficiariesPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner position="top-center" />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<WalletPage />} />
          <Route path="/deposits" element={<DepositsPage />} />
          <Route path="/deposits/new" element={<NewDepositPage />} />
          <Route path="/payments" element={<PaymentsPage />} />
          <Route path="/payments/new" element={<NewPaymentPage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/beneficiaries" element={<BeneficiariesPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
