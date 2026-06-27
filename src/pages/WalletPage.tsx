// ============================================================
// APP CLIENT — WalletPage (Accueil) · refonte « Direction A ».
// Salutation · carte SOLDE premium (charbon, sans dégradé, œil masquer) ·
// actions rapides · taux du jour (4 méthodes, vrais logos) · activité
// récente. Logique 100% PRÉSERVÉE (useMyWallet, opérations, profil, taux).
// ============================================================
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { BalanceCard } from '@/components/wallet/BalanceCard';
import { QuickActions } from '@/components/wallet/QuickActions';
import { OperationsList } from '@/components/wallet/OperationsList';
import { WelcomeGreeting } from '@/components/wallet/WelcomeGreeting';
import { PaymentMethodLogo } from '@/mobile/components/payments/PaymentMethodLogo';
import { useMyWallet, useMyWalletOperations } from '@/hooks/useWallet';
import { useMyProfile } from '@/hooks/useProfile';
import { useClientRates } from '@/hooks/useDailyRates';
import { formatNumber } from '@/lib/formatters';
import { SURFACE, TEXT } from '@/mobile/designKit';
import type { DailyRate } from '@/types/rates';

const RATE_ROWS: { method: 'alipay' | 'wechat' | 'bank_transfer' | 'cash'; label: string; key: keyof Pick<DailyRate, 'rate_alipay' | 'rate_wechat' | 'rate_virement' | 'rate_cash'> }[] = [
  { method: 'alipay', label: 'Alipay', key: 'rate_alipay' },
  { method: 'wechat', label: 'WeChat', key: 'rate_wechat' },
  { method: 'bank_transfer', label: 'Virement', key: 'rate_virement' },
  { method: 'cash', label: 'Cash', key: 'rate_cash' },
];

const WalletPage = () => {
  const { t } = useTranslation('client');
  const navigate = useNavigate();
  const { data: wallet, isLoading: walletLoading } = useMyWallet();
  const { data: operations } = useMyWalletOperations();
  const { data: profile } = useMyProfile();
  const { data: clientRatesData, isLoading: rateLoading } = useClientRates();

  const rate = clientRatesData?.activeRate;

  return (
    <MobileLayout>
      <div className={cn('min-h-[100dvh] space-y-5 px-4 pb-6 pt-6', SURFACE.canvas)}>
        {/* Salutation */}
        <WelcomeGreeting
          firstName={profile?.first_name}
          lastName={profile?.last_name}
          subtitle={t('wallet.homeSubtitle', { defaultValue: 'Voici votre compte Bonzini' })}
        />

        {/* Solde */}
        {walletLoading ? (
          <div className={cn('h-[150px] animate-pulse rounded-[26px] bg-[#1C1B22]/80')} />
        ) : (
          <BalanceCard balanceXAF={wallet?.balance_xaf || 0} hasError={!walletLoading && !wallet} />
        )}

        {/* Actions rapides */}
        <QuickActions />

        {/* Taux du jour */}
        <section>
          <div className="mb-2 flex items-center justify-between px-1">
            <h2 className={cn('text-[12px] font-bold uppercase tracking-wider', TEXT.muted)}>{t('wallet.dailyRate', { defaultValue: 'Taux du jour' })}</h2>
            <button onClick={() => navigate('/rates')} className="text-[12px] font-bold text-[#5B4CC4] active:opacity-70 dark:text-[#B5AAF0]">
              {t('wallet.viewRates', { defaultValue: 'Voir les taux' })}
            </button>
          </div>
          <div className={cn('rounded-[22px] p-2', SURFACE.card, SURFACE.shadow)}>
            {rateLoading || !rate ? (
              <div className="space-y-2 p-2">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className={cn('h-9 animate-pulse rounded-xl', SURFACE.canvas)} />
                ))}
              </div>
            ) : (
              <>
                {RATE_ROWS.map((r, i) => (
                  <div key={r.method} className={cn('flex items-center gap-3 px-3 py-2.5', i < RATE_ROWS.length - 1 && 'border-b border-black/[0.05] dark:border-white/[0.07]')}>
                    <PaymentMethodLogo method={r.method} size={34} />
                    <span className={cn('flex-1 text-[14px] font-bold', TEXT.strong)}>{r.label}</span>
                    <span className={cn('text-[14px] font-black tabular-nums', TEXT.strong)}>
                      {formatNumber(rate[r.key])} <span className="text-[12px] font-bold text-[#E8932A]">¥</span>
                    </span>
                  </div>
                ))}
                <div className={cn('px-3 pb-1 pt-2 text-[11px]', TEXT.muted)}>
                  {t('wallet.ratePer', { defaultValue: 'Pour 1 000 000 XAF' })}
                </div>
              </>
            )}
          </div>
        </section>

        {/* Activité récente */}
        {operations && operations.length > 0 ? (
          <OperationsList operations={operations} />
        ) : (
          <section>
            <h2 className={cn('mb-2 px-1 text-[12px] font-bold uppercase tracking-wider', TEXT.muted)}>{t('wallet.recentOperations')}</h2>
            <div className={cn('rounded-[22px] p-8 text-center', SURFACE.card, SURFACE.shadow)}>
              <p className={cn('text-[14px]', TEXT.muted)}>{t('wallet.noOperations', { defaultValue: 'Aucune opération pour le moment.' })}</p>
            </div>
          </section>
        )}
      </div>
    </MobileLayout>
  );
};

export default WalletPage;
