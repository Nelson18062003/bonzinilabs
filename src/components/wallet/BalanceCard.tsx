import { Eye, EyeOff, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatXAF, formatCurrencyRMB, convertXAFtoRMB } from '@/lib/formatters';

interface BalanceCardProps {
  balanceXAF: number;
  /** XAF-to-RMB multiplier (e.g. 0.01176 for 85 XAF/RMB) */
  rateXafToRmb?: number;
  /** Show loading state when balance is being refreshed */
  isRefreshing?: boolean;
  /** Error state - shows fallback UI */
  hasError?: boolean;
}

export const BalanceCard = ({ balanceXAF, rateXafToRmb, isRefreshing, hasError }: BalanceCardProps) => {
  const { t } = useTranslation('client');
  const [showBalance, setShowBalance] = useState(true);
  const currentRate = rateXafToRmb ?? 11765 / 1_000_000;
  const balanceRMB = convertXAFtoRMB(balanceXAF, currentRate);

  // Error fallback
  if (hasError) {
    return (
      <div className="card-primary p-6 animate-fade-in">
        <div className="flex flex-col items-center justify-center py-4">
          <RefreshCw className="w-8 h-8 text-primary-foreground/50 mb-2" />
          <p className="text-primary-foreground/70 text-sm text-center">
            {t('wallet.balanceUnavailable')}
          </p>
          <p className="text-primary-foreground/50 text-xs mt-1">
            {t('wallet.retryLater')}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="card-primary p-6 animate-fade-in">
      {/* Header with label and toggle */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-primary-foreground/80 text-sm font-medium">{t('wallet.availableBalance')}</span>
          {isRefreshing && (
            <RefreshCw className="w-3 h-3 text-primary-foreground/60 animate-spin" />
          )}
        </div>
        <button
          onClick={() => setShowBalance(!showBalance)}
          className="w-11 h-11 flex items-center justify-center rounded-full bg-primary-foreground/10 hover:bg-primary-foreground/20 transition-colors"
          aria-label={showBalance ? t('wallet.hideBalance') : t('wallet.showBalance')}
        >
          {showBalance ? (
            <EyeOff className="w-4 h-4 text-primary-foreground/80" />
          ) : (
            <Eye className="w-4 h-4 text-primary-foreground/80" />
          )}
        </button>
      </div>

      {/* Balance Display */}
      <div className="mb-4">
        {showBalance ? (
          <>
            <p className="balance-display text-primary-foreground">
              {formatXAF(balanceXAF)} <span className="text-2xl font-medium text-primary-foreground/70">XAF</span>
            </p>
            <p className="text-lg font-semibold text-primary-foreground/80 mt-1">
              ≈ {formatCurrencyRMB(balanceRMB)}
            </p>
          </>
        ) : (
          <p className="balance-display text-primary-foreground">• • • • • •</p>
        )}
      </div>
    </div>
  );
};
