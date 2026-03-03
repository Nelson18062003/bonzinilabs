import { Link } from 'react-router-dom';
import { TrendingUp } from 'lucide-react';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { BalanceCard } from '@/components/wallet/BalanceCard';
import { QuickActions } from '@/components/wallet/QuickActions';
import { OperationsList } from '@/components/wallet/OperationsList';
import { WelcomeGreeting } from '@/components/wallet/WelcomeGreeting';
import { useMyWallet, useMyWalletOperations, useExchangeRate } from '@/hooks/useWallet';
import { useMyProfile } from '@/hooks/useProfile';
import { formatNumber } from '@/lib/formatters';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';

const WalletPage = () => {
  const { data: wallet, isLoading: walletLoading } = useMyWallet();
  const { data: operations, isLoading: opsLoading } = useMyWalletOperations();
  const { data: profile, isLoading: profileLoading } = useMyProfile();
  const { data: currentRate, isLoading: rateLoading } = useExchangeRate();

  const currentXafToRmb = currentRate ?? 0.01163;

  return (
    <MobileLayout>
      <div className="px-4 pt-6 safe-area-top">
        {/* Header - Personalized Welcome */}
        <div className="mb-6">
          {profileLoading ? (
            <Skeleton className="h-10 w-48" />
          ) : (
            <WelcomeGreeting
              firstName={profile?.first_name}
              lastName={profile?.last_name}
            />
          )}
        </div>

        {/* Balance Card */}
        <div className="mb-4">
          {walletLoading ? (
            <Skeleton className="h-40 w-full rounded-2xl" />
          ) : (
            <BalanceCard balanceXAF={wallet?.balance_xaf || 0} />
          )}
        </div>

        {/* Current Rate Card */}
        <Link to="/rates" className="block mb-6">
          <Card className="bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20 hover:border-primary/40 transition-colors">
            <CardContent className="p-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-primary/10">
                  <TrendingUp className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Taux du jour</p>
                  {rateLoading ? (
                    <Skeleton className="h-5 w-32" />
                  ) : (
                    <p className="text-sm font-semibold text-foreground">
                      1M XAF = {formatNumber(Math.round(1000000 * currentXafToRmb))} CNY
                    </p>
                  )}
                </div>
              </div>
              <span className="text-xs text-primary font-medium">Voir +</span>
            </CardContent>
          </Card>
        </Link>

        {/* Quick Actions */}
        <div className="mb-8">
          <QuickActions />
        </div>

        {/* Recent Operations */}
        {opsLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : (
          <OperationsList operations={operations || []} />
        )}
      </div>
    </MobileLayout>
  );
};

export default WalletPage;