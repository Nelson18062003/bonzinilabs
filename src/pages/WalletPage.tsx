import { MobileLayout } from '@/components/layout/MobileLayout';
import { BalanceCard } from '@/components/wallet/BalanceCard';
import { QuickActions } from '@/components/wallet/QuickActions';
import { OperationsList } from '@/components/wallet/OperationsList';
import { mockWallet, mockWalletOperations } from '@/data/mockData';

const WalletPage = () => {
  return (
    <MobileLayout>
      <div className="px-4 pt-6 safe-area-top">
        {/* Header */}
        <div className="mb-6">
          <p className="text-sm text-muted-foreground">Bonjour, Jean 👋</p>
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
