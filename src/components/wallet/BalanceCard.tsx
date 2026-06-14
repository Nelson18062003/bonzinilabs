import { Eye, EyeOff, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { formatNumber } from '@/lib/formatters';

interface BalanceCardProps {
  balanceXAF: number;
  /** Show loading state when balance is being refreshed */
  isRefreshing?: boolean;
  /** Error state - shows fallback UI */
  hasError?: boolean;
}

// Carte SOLDE — premium charbon, SANS dégradé (designKit). Le solde est le focal.
const CARD =
  'rounded-[26px] bg-[#1C1B22] p-6 shadow-[0_14px_40px_-16px_rgba(28,27,34,0.55)] dark:bg-[#211F2B] dark:ring-1 dark:ring-white/[0.06]';

export const BalanceCard = ({ balanceXAF, isRefreshing, hasError }: BalanceCardProps) => {
  const { t } = useTranslation('client');
  const [showBalance, setShowBalance] = useState(true);

  if (hasError) {
    return (
      <div className={cn(CARD, 'flex flex-col items-center justify-center py-8 text-center')}>
        <RefreshCw className="mb-2 h-8 w-8 text-white/50" />
        <p className="text-[14px] text-white/70">{t('wallet.balanceUnavailable')}</p>
        <p className="mt-1 text-[12px] text-white/45">{t('wallet.retryLater')}</p>
      </div>
    );
  }

  return (
    <div className={cn(CARD, 'animate-fade-in')}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-medium text-white/65">{t('wallet.availableBalance')}</span>
          {isRefreshing && <RefreshCw className="h-3.5 w-3.5 animate-spin text-white/60" />}
        </div>
        <button
          onClick={() => setShowBalance((v) => !v)}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 transition active:scale-95"
          aria-label={showBalance ? t('wallet.hideBalance') : t('wallet.showBalance')}
        >
          {showBalance ? <EyeOff className="h-4 w-4 text-white/80" /> : <Eye className="h-4 w-4 text-white/80" />}
        </button>
      </div>

      {showBalance ? (
        <div className="mt-3 flex items-baseline gap-2">
          <span className="text-[44px] font-black leading-none tracking-tight tabular-nums text-white">
            {formatNumber(balanceXAF)}
          </span>
          <span className="text-[18px] font-extrabold text-[#E8932A]">XAF</span>
        </div>
      ) : (
        <div className="mt-3 text-[40px] font-black leading-none text-white">• • • • •</div>
      )}
    </div>
  );
};
