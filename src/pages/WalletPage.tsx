import { Link } from 'react-router-dom';
import { TrendingUp } from 'lucide-react';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { BalanceCard } from '@/components/wallet/BalanceCard';
import { QuickActions } from '@/components/wallet/QuickActions';
import { OperationsList } from '@/components/wallet/OperationsList';
import { WelcomeGreeting } from '@/components/wallet/WelcomeGreeting';
import { useMyWallet, useMyWalletOperations } from '@/hooks/useWallet';
import { useMyProfile } from '@/hooks/useProfile';
import { useClientRates } from '@/hooks/useDailyRates';
import { formatNumber } from '@/lib/formatters';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';

const WalletPage = () => {
  const { data: wallet, isLoading: walletLoading } = useMyWallet();
  const { data: operations, isLoading: opsLoading } = useMyWalletOperations();
  const { data: profile, isLoading: profileLoading } = useMyProfile();
  const { data: clientRatesData, isLoading: rateLoading } = useClientRates();

  // rate_alipay is "CNY per 1M XAF" (e.g. 11765 means 1M XAF = 11 765 CNY)
  const alipayRate = clientRatesData?.activeRate?.rate_alipay ?? 11765;
  // Convert to XAF-to-RMB multiplier (e.g. 11765 / 1M = 0.011765)
  const rateXafToRmb = alipayRate / 1_000_000;

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
            <BalanceCard balanceXAF={wallet?.balance_xaf || 0} rateXafToRmb={rateXafToRmb} />
          )}
        </div>

        {/* Current Rate Card */}
        <Link to="/rates" className="block mb-6">
          <Card className="bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20 hover:border-primary/40 transition-colors">
            <CardContent className="p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-full bg-primary/10">
                    <TrendingUp className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Taux du jour</p>
                    <p className="text-xs text-muted-foreground">1M XAF =</p>
                  </div>
                </div>
                <span className="text-xs text-primary font-medium">Voir +</span>
              </div>
              {rateLoading ? (
                <Skeleton className="h-16 w-full" />
              ) : clientRatesData?.activeRate ? (
                <div className="grid grid-cols-2 gap-1.5">
                  {[
                    { label: 'Alipay', icon: '支', rate: clientRatesData.activeRate.rate_alipay, color: '#1677ff' },
                    { label: 'WeChat', icon: '微', rate: clientRatesData.activeRate.rate_wechat, color: '#07c160' },
                    { label: 'Virement', icon: '🏦', rate: clientRatesData.activeRate.rate_virement, color: '#8b5cf6' },
                    { label: 'Cash', icon: '¥', rate: clientRatesData.activeRate.rate_cash, color: '#dc2626' },
                  ].map(({ label, icon, rate, color }) => (
                    <div key={label} className="flex items-center gap-1.5 px-2 py-1 rounded bg-background/50">
                      <span className="text-xs font-bold" style={{ color }}>{icon}</span>
                      <span className="text-[11px] text-muted-foreground flex-1">{label}</span>
                      <span className="text-xs font-semibold" style={{ fontVariantNumeric: 'tabular-nums' }}>¥{formatNumber(Math.round(rate))}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic">Non configuré</p>
              )}
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
