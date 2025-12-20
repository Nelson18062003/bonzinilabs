import { Eye, EyeOff, TrendingUp, Shield } from 'lucide-react';
import { useState } from 'react';
import { formatXAF, formatRMB, convertXAFtoRMB } from '@/lib/formatters';
import { useExchangeRate } from '@/hooks/useWallet';

interface BalanceCardProps {
  balanceXAF: number;
}

export const BalanceCard = ({ balanceXAF }: BalanceCardProps) => {
  const [showBalance, setShowBalance] = useState(true);
  const { data: rate } = useExchangeRate();
  const currentRate = rate ?? 0.01167;
  const balanceRMB = convertXAFtoRMB(balanceXAF, currentRate);

  return (
    <div className="card-primary p-6 animate-fade-in">
      {/* Header with label and toggle */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-primary-foreground/80 text-sm font-medium">Solde disponible</span>
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
            <div className="flex items-baseline">
              <span className="balance-display text-primary-foreground">
                {formatXAF(balanceXAF)}
              </span>
              <span className="balance-currency text-primary-foreground/70">XAF</span>
            </div>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-primary-foreground/60 text-sm">≈</span>
              <span className="text-xl font-semibold text-primary-foreground/90">
                ¥ {formatRMB(balanceRMB)}
              </span>
              <span className="text-primary-foreground/60 text-sm">RMB</span>
            </div>
          </>
        ) : (
          <div className="flex items-baseline">
            <span className="balance-display text-primary-foreground">• • • • • •</span>
          </div>
        )}
      </div>
      
      {/* Exchange Rate */}
      <div className="flex items-center gap-2 pt-4 border-t border-primary-foreground/10">
        <TrendingUp className="w-4 h-4 text-primary-foreground/60" />
        <span className="text-sm text-primary-foreground/70">
          Taux du jour : 1 XAF = {currentRate.toFixed(5)} RMB
        </span>
      </div>

      {/* Trust Badge - Feature 2 */}
      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-primary-foreground/10">
        <Shield className="w-4 h-4 text-primary-foreground/70" />
        <span className="text-xs text-primary-foreground/70">
          Votre solde est 100% sécurisé
        </span>
      </div>
    </div>
  );
};
