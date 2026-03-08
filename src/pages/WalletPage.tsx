import { MobileLayout } from '@/components/layout/MobileLayout';
import { BalanceCard } from '@/components/wallet/BalanceCard';
import { QuickActions } from '@/components/wallet/QuickActions';
import { OperationsList } from '@/components/wallet/OperationsList';
import { WelcomeGreeting } from '@/components/wallet/WelcomeGreeting';
import { RateCard } from '@/components/rates/RateCard';
import { useMyWallet, useMyWalletOperations } from '@/hooks/useWallet';
import { useMyProfile } from '@/hooks/useProfile';
import { useClientRates } from '@/hooks/useDailyRates';
import { Skeleton } from '@/components/ui/skeleton';

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
        <div className="mb-6">
          <RateCard
            rates={clientRatesData?.activeRate ? {
              rate_cash: clientRatesData.activeRate.rate_cash,
              rate_alipay: clientRatesData.activeRate.rate_alipay,
              rate_wechat: clientRatesData.activeRate.rate_wechat,
              rate_virement: clientRatesData.activeRate.rate_virement,
            } : null}
            effectiveAt={clientRatesData?.activeRate?.effective_at}
            isLoading={rateLoading}
            detailsHref="/rates"
          />
        </div>

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
