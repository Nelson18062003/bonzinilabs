import { Eye, EyeOff, TrendingUp, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { formatXAF, formatCurrencyRMB, formatNumber, convertXAFtoRMB } from '@/lib/formatters';
import { useExchangeRate } from '@/hooks/useWallet';

interface BalanceCardProps {
  balanceXAF: number;
  /** Show loading state when balance is being refreshed */
  isRefreshing?: boolean;
  /** Error state - shows fallback UI */
  hasError?: boolean;
}

export const BalanceCard = ({ balanceXAF, isRefreshing, hasError }: BalanceCardProps) => {
  const [showBalance, setShowBalance] = useState(true);
  const { data: rate, isLoading: rateLoading } = useExchangeRate();
  const currentRate = rate ?? 0.01167;
  const balanceRMB = convertXAFtoRMB(balanceXAF, currentRate);

  // Calculate human-readable rate: how many XAF for 1 RMB
  const xafPerRmb = Math.round(1 / currentRate);

  // Error fallback
  if (hasError) {
    return (
      <div className="card-primary p-6 animate-fade-in">
        <div className="flex flex-col items-center justify-center py-4">
          <RefreshCw className="w-8 h-8 text-primary-foreground/50 mb-2" />
          <p className="text-primary-foreground/70 text-sm text-center">
            Solde indisponible momentanément
          </p>
          <p className="text-primary-foreground/50 text-xs mt-1">
            Veuillez réessayer dans quelques instants
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
          <span className="text-primary-foreground/80 text-sm font-medium">Solde disponible</span>
          {isRefreshing && (
            <RefreshCw className="w-3 h-3 text-primary-foreground/60 animate-spin" />
          )}
        </div>
        <button
          onClick={() => setShowBalance(!showBalance)}
          className="p-2 rounded-full bg-primary-foreground/10 hover:bg-primary-foreground/20 transition-colors"
          aria-label={showBalance ? "Masquer le solde" : "Afficher le solde"}
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

      {/* Exchange Rate */}
      <div className="flex items-center gap-2 pt-4 border-t border-primary-foreground/10">
        <TrendingUp className="w-4 h-4 text-primary-foreground/60" />
        <span className="text-sm text-primary-foreground/70">
          Taux du jour : {formatNumber(xafPerRmb)} XAF = 1 RMB
        </span>
      </div>
    </div>
  );
};
