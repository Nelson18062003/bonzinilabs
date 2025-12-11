import { MobileLayout } from '@/components/layout/MobileLayout';
import { BalanceCard } from '@/components/wallet/BalanceCard';
import { PrimaryCTA } from '@/components/wallet/PrimaryCTA';
import { QuickActions } from '@/components/wallet/QuickActions';
import { OperationsList } from '@/components/wallet/OperationsList';
import { WelcomeGreeting } from '@/components/wallet/WelcomeGreeting';
import { mockWallet, mockWalletOperations, mockUser } from '@/data/mockData';

const WalletPage = () => {
  return (
    <MobileLayout>
      <div className="px-4 pt-6 safe-area-top">
        {/* Header - Personalized Welcome (Feature 1) */}
        <div className="mb-6">
          <WelcomeGreeting 
            firstName={mockUser.firstName} 
            lastName={mockUser.lastName} 
          />
        </div>

        {/* Balance Card with Trust Badge (Feature 2) */}
        <div className="mb-6">
          <BalanceCard balanceXAF={mockWallet.balanceXAF} />
        </div>

        {/* Primary CTA (Feature 3) */}
        <div className="mb-6">
          <PrimaryCTA />
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
