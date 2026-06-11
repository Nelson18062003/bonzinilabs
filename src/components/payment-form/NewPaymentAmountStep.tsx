// ============================================================
// Step 2 — Enter amount. Refonte « Direction A » (designKit) :
// segment devise XAF/RMB · gros montant éditable + unité ambre ·
// résultat de conversion en bloc lilas · presets · alerte solde.
// Logique 100% PRÉSERVÉE : props/handlers inchangés (le switch de
// devise vide l'input ; preset « Tous » = min(solde, 50M) / floor(rate)).
// ============================================================
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';
import { formatXAF, formatRMB } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import { type Currency, QUICK_RMB, QUICK_XAF } from './types';
import { SURFACE, TEXT } from '@/mobile/designKit';

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
    <div className="animate-fade-in space-y-4">
      {/* Segment devise — vider l'input au changement */}
      <div className={cn('inline-flex w-full items-center gap-1 rounded-full p-1', SURFACE.canvas)}>
        {(['XAF', 'RMB'] as Currency[]).map((c) => {
          const active = currency === c;
          return (
            <button
              key={c}
              onClick={() => {
                onCurrencyChange(c);
                onInputAmountChange('');
              }}
              className={cn(
                'flex-1 rounded-full py-2 text-[13px] font-bold transition-colors',
                active ? 'bg-[#8B5CF6] text-white' : TEXT.muted,
              )}
            >
              {c === 'XAF' ? t('form.byXAF') : t('form.byRMB')}
            </button>
          );
        })}
      </div>

      {/* Carte montant — gros chiffre éditable + résultat de conversion */}
      <div className={cn('rounded-[22px] p-5', SURFACE.card, SURFACE.shadow)}>
        <div className="flex items-center justify-between">
          <span className={cn('text-[12px] font-medium', TEXT.muted)}>
            {currency === 'XAF' ? t('form.youSend') : t('form.supplierReceives')}
          </span>
          {!walletLoading && walletBalanceXaf !== undefined && (
            <span className={cn('text-[12px] tabular-nums', TEXT.muted)}>
              {t('form.balance')}: {formatXAF(walletBalanceXaf)} XAF
            </span>
          )}
        </div>
        <div className="mt-1.5 flex items-baseline gap-2">
          {/* Gros chiffre 40px (≫16px → aucun auto-zoom iOS) : input nu volontaire. */}
          {/* eslint-disable-next-line no-restricted-syntax */}
          <input
            type="text"
            inputMode="numeric"
            value={inputAmount}
            onChange={(e) => onInputAmountChange(e.target.value.replace(/[^0-9.]/g, ''))}
            placeholder="0"
            className={cn(
              'min-w-0 flex-1 bg-transparent text-[40px] font-black leading-none tabular-nums outline-none',
              'placeholder:text-[#C7C2D6] dark:placeholder:text-[#4A4658]',
              TEXT.strong,
            )}
          />
          <span className="shrink-0 text-[18px] font-extrabold text-[#E8932A]">{currency}</span>
        </div>

        <div className="mt-3 rounded-2xl bg-[#EDEAFA] p-4 dark:bg-[#221F33]">
          <div className={cn('text-[12px]', TEXT.muted)}>
            {currency === 'XAF' ? t('form.supplierReceives') : t('form.amountDebited')}
          </div>
          <div className="mt-0.5 flex items-baseline gap-1.5">
            {currency === 'XAF' ? (
              <>
                <span className="text-[22px] font-black text-[#C3BDD2] dark:text-[#5C5772]">¥</span>
                <span className={cn('text-[30px] font-black leading-none tabular-nums', TEXT.strong)}>{formatRMB(amountRMB)}</span>
              </>
            ) : (
              <>
                <span className={cn('text-[30px] font-black leading-none tabular-nums', TEXT.strong)}>{formatXAF(amountXAF)}</span>
                <span className="text-[15px] font-extrabold text-[#E8932A]">XAF</span>
              </>
            )}
          </div>
        </div>
      </div>

      {showRate && (
        <p className={cn('px-1 text-center text-[12px]', TEXT.muted)}>
          {t('form.rateApplied')} :{' '}
          <span className="font-bold tabular-nums">1 000 000 XAF = ¥{formatRMB(1_000_000 * rate)}</span>
        </p>
      )}

      {/* Presets rapides + « Tous » */}
      <div className="grid grid-cols-5 gap-2">
        {(currency === 'XAF' ? QUICK_XAF : QUICK_RMB).map((preset) => {
          const active = inputAmount === preset.toString();
          return (
            <button
              key={preset}
              onClick={() => onInputAmountChange(preset.toString())}
              className={cn(
                'rounded-xl py-2.5 text-[12px] font-bold transition-colors',
                active ? 'bg-[#8B5CF6] text-white' : cn(SURFACE.canvas, TEXT.muted),
              )}
            >
              {currency === 'XAF'
                ? preset >= 1_000_000
                  ? `${preset / 1_000_000}M`
                  : formatXAF(preset)
                : `¥${preset.toLocaleString('fr-FR')}`}
            </button>
          );
        })}
        {(() => {
          const balance = walletBalanceXaf ?? 0;
          // Cap at the 50M XAF business limit so the resulting amount stays valid.
          const maxXAF = Math.min(balance, 50_000_000);
          const allValue =
            currency === 'XAF'
              ? maxXAF
              // Truncate to keep the converted XAF ≤ wallet (rate is XAF→RMB decimal).
              : rate > 0
                ? Math.floor(maxXAF * rate)
                : 0;
          const allValueStr = allValue > 0 ? String(allValue) : '';
          const isActive = allValueStr !== '' && inputAmount === allValueStr;
          const disabled = walletLoading || allValue <= 0;
          return (
            <button
              type="button"
              disabled={disabled}
              onClick={() => allValueStr && onInputAmountChange(allValueStr)}
              className={cn(
                'rounded-xl py-2.5 text-[12px] font-bold transition-colors',
                isActive ? 'bg-[#8B5CF6] text-white' : cn(SURFACE.canvas, TEXT.muted),
                disabled && 'cursor-not-allowed opacity-40',
              )}
              aria-label={t('form.all')}
            >
              {t('form.all')}
            </button>
          );
        })()}
      </div>

      {!hasEnoughBalance && isValidAmount && (
        <div className="flex items-center gap-2 rounded-2xl bg-[#FBE7E7] p-3.5 text-[13px] text-[#C0504D] dark:bg-[#3A2526] dark:text-[#E79A9A]">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <div className="flex-1">
            <span>{t('form.insufficientBalance')}</span>
            <button onClick={() => navigate('/deposits/new')} className="ml-1 font-bold underline">
              {t('form.addFunds')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
