// ============================================================
// MODULE TAUX — RateSimulatorTab (simulateur de conversion)
// Présentation migrée sur le design kit (Ofspace/Mola), calquée
// sur la maquette validée rates.tsx : carte blanche, segment
// devise, montant + raccourcis, méthodes en grille avec vrais
// logos, pays en grille, résultat en gros (SimulatorResult).
// Logique 100% PRÉSERVÉE : calculateFinalRate / getBaseRate /
// convertCNYtoXAF, result memo, handleCurrencySwitch (conversion
// XAF↔CNY), minAmountCNY, quick amounts, emptyMessage.
// ============================================================
import { useState, useMemo } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TextField } from '@/components/form';
import { PAYMENT_METHODS, COUNTRIES, MIN_AMOUNT_XAF } from '@/types/rates';
import type { PaymentMethodKey, RateAdjustment, DailyRate, InputCurrency } from '@/types/rates';
import { calculateFinalRate, getBaseRate, convertCNYtoXAF } from '@/lib/rateCalculation';
import { formatNumber } from '@/lib/formatters';
import { SURFACE, TEXT, ScreenError } from '@/mobile/designKit';
import { SimulatorResult } from '../components/SimulatorResult';
import { MethodLogo } from '../components/MethodLogo';

interface RateSimulatorTabProps {
  activeRate: DailyRate | null | undefined;
  adjustments: RateAdjustment[];
  isLoading: boolean;
  isError?: boolean;
}

const QUICK_AMOUNTS_XAF = ['50000', '250000', '500000', '1000000', '2000000'];
const QUICK_AMOUNTS_CNY = ['100', '1000', '5000', '10000', '100000'];

function getQuickLabel(value: string, currency: InputCurrency): string {
  const num = parseInt(value);
  if (currency === 'xaf') {
    return num >= 1_000_000 ? `${num / 1_000_000}M` : `${num / 1_000}K`;
  }
  return num >= 1_000 ? `${num / 1_000}K` : `${num}`;
}

export function RateSimulatorTab({ activeRate, adjustments, isLoading, isError }: RateSimulatorTabProps) {
  const [amount, setAmount] = useState('500000');
  const [method, setMethod] = useState<PaymentMethodKey>('cash');
  const [country, setCountry] = useState('cameroun');
  const [inputCurrency, setInputCurrency] = useState<InputCurrency>('xaf');

  const countryAdjs = useMemo(
    () => adjustments.filter((a) => a.type === 'country'),
    [adjustments],
  );
  const tierAdjs = useMemo(
    () => adjustments.filter((a) => a.type === 'tier'),
    [adjustments],
  );

  const numAmount = parseInt(amount) || 0;

  // Dynamic minimum in CNY for the current method/country/tier config
  const minAmountCNY = useMemo(() => {
    if (!activeRate) return null;
    const baseRate = getBaseRate(activeRate, method);
    const countryPct = countryAdjs.find((c) => c.key === country)?.percentage ?? 0;
    const { finalRate } = calculateFinalRate(baseRate, countryPct, MIN_AMOUNT_XAF, tierAdjs);
    const ratePerUnit = finalRate / 1_000_000;
    return ratePerUnit > 0 ? Math.ceil(MIN_AMOUNT_XAF * ratePerUnit) : null;
  }, [activeRate, method, country, countryAdjs, tierAdjs]);

  const handleCurrencySwitch = (newCurrency: InputCurrency) => {
    if (newCurrency === inputCurrency) return;

    if (!activeRate || numAmount <= 0) {
      setInputCurrency(newCurrency);
      return;
    }

    const baseRate = getBaseRate(activeRate, method);
    const countryPct = countryAdjs.find((c) => c.key === country)?.percentage ?? 0;

    if (newCurrency === 'cny') {
      // XAF → CNY: convert the current XAF amount to CNY
      const { amountCNY } = calculateFinalRate(baseRate, countryPct, numAmount, tierAdjs);
      setAmount(String(Math.round(amountCNY)));
    } else {
      // CNY → XAF: convert the current CNY amount to XAF
      const xaf = convertCNYtoXAF(numAmount, baseRate, countryPct, tierAdjs);
      setAmount(String(xaf));
    }

    setInputCurrency(newCurrency);
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\s/g, '').replace(/\./g, '').replace(/,/g, '');
    if (/^\d*$/.test(val)) {
      setAmount(val);
    }
  };

  const result = useMemo(() => {
    if (!activeRate) return null;
    const num = parseInt(amount) || 0;
    if (num <= 0) return null;

    const baseRate = getBaseRate(activeRate, method);
    const countryAdj = countryAdjs.find((c) => c.key === country);
    const countryPct = countryAdj?.percentage ?? 0;

    const amountXAF =
      inputCurrency === 'xaf'
        ? num
        : convertCNYtoXAF(num, baseRate, countryPct, tierAdjs);

    if (amountXAF < MIN_AMOUNT_XAF) return null;

    const calc = calculateFinalRate(baseRate, countryPct, amountXAF, tierAdjs);
    const tierAdj = tierAdjs.find((t) => t.key === calc.tierKey);

    return {
      inputCurrency,
      inputAmount: num,
      amountXAF,
      amountCNY: calc.amountCNY,
      baseRate,
      countryAdj: countryPct,
      tierAdj: tierAdj?.percentage ?? 0,
      tierKey: calc.tierKey,
      finalRate: calc.finalRate,
    };
  }, [activeRate, amount, method, country, inputCurrency, countryAdjs, tierAdjs]);

  const quickAmounts = inputCurrency === 'xaf' ? QUICK_AMOUNTS_XAF : QUICK_AMOUNTS_CNY;

  const emptyMessage = !activeRate
    ? 'Aucun taux actif'
    : inputCurrency === 'xaf'
    ? `Saisissez un montant ≥ ${formatNumber(MIN_AMOUNT_XAF)} XAF`
    : minAmountCNY
    ? `Saisissez un montant ≥ ${formatNumber(minAmountCNY)} CNY`
    : 'Saisissez un montant valide';

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-[#8B5CF6]" />
      </div>
    );
  }

  if (isError) {
    return (
      <ScreenError
        title="Erreur de chargement"
        description="Impossible de charger les données. Vérifiez que la migration SQL a été exécutée."
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className={cn('rounded-[18px] p-4', SURFACE.card, SURFACE.shadow)}>
        <h3 className={cn('mb-1 text-[16px] font-bold', TEXT.strong)}>Simulateur de taux</h3>
        <p className={cn('mb-4 text-[12px]', TEXT.muted)}>
          Testez n'importe quelle combinaison.
        </p>

        {/* Segment devise de saisie */}
        <div className="mb-4">
          <label className={cn('mb-1.5 block text-[13px] font-semibold', TEXT.muted)}>
            Devise de saisie
          </label>
          <div className={cn('inline-flex w-full items-center gap-1 rounded-full p-1', SURFACE.canvas)}>
            {(['xaf', 'cny'] as InputCurrency[]).map((c) => {
              const active = inputCurrency === c;
              return (
                <button
                  key={c}
                  onClick={() => handleCurrencySwitch(c)}
                  className={cn(
                    'flex-1 rounded-full py-2 text-[13px] font-bold transition-colors',
                    active ? 'bg-[#8B5CF6] text-white' : TEXT.muted,
                  )}
                >
                  {c === 'xaf' ? 'XAF (Franc CFA)' : 'CNY (¥ RMB)'}
                </button>
              );
            })}
          </div>
        </div>

        {/* Montant */}
        <div className="mb-4">
          <TextField
            label={`Montant (${inputCurrency === 'xaf' ? 'XAF' : 'CNY'})`}
            labelClassName={cn('text-[13px] font-semibold', TEXT.muted)}
            variant="numeric"
            value={numAmount > 0 ? formatNumber(numAmount) : ''}
            onChange={handleAmountChange}
            controlClassName="text-[18px] font-extrabold tabular-nums"
            placeholder={inputCurrency === 'xaf' ? '500 000' : '5 000'}
          />
          <div className="mt-2 flex gap-1.5">
            {quickAmounts.map((v) => {
              const active = amount === v;
              return (
                <button
                  key={v}
                  onClick={() => setAmount(v)}
                  className={cn(
                    'flex-1 rounded-lg py-2 text-[11px] font-bold transition-colors',
                    active ? 'bg-[#8B5CF6] text-white' : cn(SURFACE.canvas, TEXT.muted),
                  )}
                >
                  {getQuickLabel(v, inputCurrency)}
                </button>
              );
            })}
          </div>
        </div>

        {/* Mode de paiement — grille avec vrais logos */}
        <div className="mb-4">
          <label className={cn('mb-1.5 block text-[13px] font-semibold', TEXT.muted)}>
            Mode de paiement
          </label>
          <div className="grid grid-cols-2 gap-2">
            {PAYMENT_METHODS.map((pm) => {
              const active = method === pm.key;
              return (
                <button
                  key={pm.key}
                  onClick={() => setMethod(pm.key)}
                  className={cn(
                    'flex items-center gap-2 rounded-xl p-2.5 transition active:scale-[0.98]',
                    SURFACE.canvas,
                  )}
                  style={active ? { boxShadow: `0 0 0 2px ${pm.color}` } : undefined}
                >
                  <MethodLogo method={pm.key} size={28} />
                  <span className={cn('text-[13px] font-semibold', TEXT.strong)}>{pm.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Pays du client — grille */}
        <div>
          <label className={cn('mb-1.5 block text-[13px] font-semibold', TEXT.muted)}>
            Pays du client
          </label>
          <div className="grid grid-cols-3 gap-1.5">
            {COUNTRIES.map((c) => {
              const active = country === c.key;
              return (
                <button
                  key={c.key}
                  onClick={() => setCountry(c.key)}
                  className={cn(
                    'flex flex-col items-center gap-1 rounded-xl px-1.5 py-2.5 transition active:scale-[0.98]',
                    SURFACE.canvas,
                  )}
                  style={active ? { boxShadow: '0 0 0 2px #8B5CF6' } : undefined}
                >
                  <span className="text-xl">{c.flag}</span>
                  <span className={cn('text-[10px] font-semibold', active ? 'text-[#5B4CC4] dark:text-[#B5AAF0]' : TEXT.muted)}>
                    {c.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Résultat */}
      {result ? (
        <SimulatorResult
          amountXAF={result.amountXAF}
          amountCNY={result.amountCNY}
          baseRate={result.baseRate}
          countryAdj={result.countryAdj}
          tierAdj={result.tierAdj}
          tierKey={result.tierKey}
          finalRate={result.finalRate}
          methodKey={method}
          countryKey={country}
          inputCurrency={result.inputCurrency}
          inputAmount={result.inputAmount}
        />
      ) : (
        <div className={cn('rounded-2xl p-6 text-center', SURFACE.card, SURFACE.shadow)}>
          <div className={cn('text-[14px]', TEXT.muted)}>{emptyMessage}</div>
        </div>
      )}
    </div>
  );
}
