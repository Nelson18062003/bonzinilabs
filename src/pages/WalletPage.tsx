import { MobileLayout } from '@/components/layout/MobileLayout';
import { BalanceCard } from '@/components/wallet/BalanceCard';
import { QuickActions } from '@/components/wallet/QuickActions';
import { OperationsList } from '@/components/wallet/OperationsList';
import { mockWallet, mockWalletOperations, currentRate } from '@/data/mockData';
import { TrendingUp } from 'lucide-react';

const WalletPage = () => {
  return (
    <MobileLayout>
      <div className="px-4 pt-6 safe-area-top">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-sm text-muted-foreground">Bonjour, Jean 👋</p>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-success/10 text-success text-xs font-medium">
            <TrendingUp className="w-3 h-3" />
            <span>1 XAF = {currentRate.xafToRmb} RMB</span>
          </div>
        </div>

        {/* Balance Card */}
        <div className="mb-6">
          <BalanceCard balanceXAF={mockWallet.balanceXAF} />
        </div>

        {/* Quick Actions */}
        <div className="mb-8">
          <QuickActions />
        </div>

        {/* Recent Operations */}
        <OperationsList operations={mockWalletOperations} />
      </div>
    </MobileLayout>
  );
};

export default WalletPage;
