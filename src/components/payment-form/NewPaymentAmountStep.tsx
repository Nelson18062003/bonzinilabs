// ============================================================
// Step 2 — Enter amount.
// Currency tabs (XAF / RMB), big amount input, live conversion,
// quick-pick presets, insufficient-balance alert with deposit CTA.
// ============================================================
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ArrowRightLeft, AlertCircle } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatXAF, formatRMB } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import { type Currency, QUICK_RMB, QUICK_XAF } from './types';

interface Props {
  currency: Currency;
  onCurrencyChange: (currency: Currency) => void;
  inputAmount: string;
  onInputAmountChange: (value: string) => void;
  rate: number;
  amountXAF: number;
  amountRMB: number;
  walletBalanceXaf: number | undefined;
  walletLoading: boolean;
  hasEnoughBalance: boolean;
  isValidAmount: boolean;
  showRate: boolean;
}

export function NewPaymentAmountStep({
  currency,
  onCurrencyChange,
  inputAmount,
  onInputAmountChange,
  rate,
  amountXAF,
  amountRMB,
  walletBalanceXaf,
  walletLoading,
  hasEnoughBalance,
  isValidAmount,
  showRate,
}: Props) {
  const { t } = useTranslation('payments');
  const navigate = useNavigate();

  return (
    <div className="animate-fade-in space-y-6">
      {showRate && (
        <div className="card-glass p-4 text-center">
          <p className="text-sm text-muted-foreground mb-1">{t('form.rateApplied')}</p>
          <p className="text-lg font-bold text-foreground">
            1 000 000 XAF = ¥{formatRMB(1_000_000 * rate)}
          </p>
        </div>
      )}

      <Tabs
        value={currency}
        onValueChange={(v) => {
          onCurrencyChange(v as Currency);
          onInputAmountChange('');
        }}
      >
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="XAF">{t('form.byXAF')}</TabsTrigger>
          <TabsTrigger value="RMB">{t('form.byRMB')}</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="card-primary p-6">
        <div className="flex items-center justify-between mb-4">
          <span className="text-primary-foreground/70 text-sm">
            {currency === 'XAF' ? t('form.youSend') : t('form.supplierReceives')}
          </span>
          {!walletLoading && walletBalanceXaf !== undefined && (
            <span className="text-primary-foreground/70 text-sm">
              {t('form.balance')}: {formatXAF(walletBalanceXaf)} XAF
            </span>
          )}
        </div>
        <div className="flex items-center justify-center gap-2 mb-4">
          <input
            type="text"
            inputMode="numeric"
            value={inputAmount}
            onChange={(e) => onInputAmountChange(e.target.value.replace(/[^0-9.]/g, ''))}
            placeholder="0"
            className="amount-input text-primary-foreground placeholder:text-primary-foreground/30"
          />
          <span className="text-xl font-medium text-primary-foreground/70">{currency}</span>
        </div>
        <div className="flex items-center justify-center gap-3 py-3 border-t border-primary-foreground/10">
          <ArrowRightLeft className="w-5 h-5 text-primary-foreground/50" />
        </div>
        <div className="text-center">
          <span className="text-primary-foreground/70 text-sm">
            {currency === 'XAF' ? t('form.supplierReceives') : t('form.amountDebited')}
          </span>
          <p className="text-3xl font-bold text-primary-foreground mt-1">
            {currency === 'XAF' ? (
              `¥${formatRMB(amountRMB)}`
            ) : (
              <>
                {formatXAF(amountXAF)}
                <span className="text-lg font-medium text-primary-foreground/70 ml-2">XAF</span>
              </>
            )}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2">
        {(currency === 'XAF' ? QUICK_XAF : QUICK_RMB).map((preset) => (
          <button
            key={preset}
            onClick={() => onInputAmountChange(preset.toString())}
            className={cn(
              'py-3 rounded-xl font-medium transition-colors text-sm',
              inputAmount === preset.toString()
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary text-foreground hover:bg-secondary/80',
            )}
          >
            {currency === 'XAF'
              ? preset >= 1_000_000
                ? `${preset / 1_000_000}M`
                : formatXAF(preset)
              : `¥${preset.toLocaleString('fr-FR')}`}
          </button>
        ))}
      </div>

      {!hasEnoughBalance && isValidAmount && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-destructive/10 text-destructive text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <div className="flex-1">
            <span>{t('form.insufficientBalance')}</span>
            <button
              onClick={() => navigate('/deposits/new')}
              className="ml-1 underline font-medium"
            >
              {t('form.addFunds')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
