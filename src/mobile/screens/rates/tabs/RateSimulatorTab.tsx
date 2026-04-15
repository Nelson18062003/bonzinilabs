import { useState, useMemo } from 'react';
import { Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { PAYMENT_METHODS, COUNTRIES, MIN_AMOUNT_XAF } from '@/types/rates';
import type { PaymentMethodKey, RateAdjustment, DailyRate, InputCurrency } from '@/types/rates';
import { calculateFinalRate, getBaseRate, convertCNYtoXAF } from '@/lib/rateCalculation';
import { formatNumber } from '@/lib/formatters';
import { SimulatorResult } from '../components/SimulatorResult';

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
    ? `Saisissez un montant >= ${formatNumber(MIN_AMOUNT_XAF)} XAF`
    : minAmountCNY
    ? `Saisissez un montant >= ${formatNumber(minAmountCNY)} CNY`
    : 'Saisissez un montant valide';

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="bg-red-50 rounded-2xl p-6 text-center border border-red-200">
        <div className="text-red-600 font-semibold text-sm mb-1">Erreur de chargement</div>
        <div className="text-muted-foreground text-xs">
          Impossible de charger les donnees. Verifiez que la migration SQL a ete executee.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-[14px] p-4 shadow-sm">
        <h3 className="text-base font-bold text-foreground mb-1">Simulateur de taux</h3>
        <p className="text-xs text-muted-foreground mb-4">
          Testez n'importe quelle combinaison.
        </p>

        {/* Currency selector */}
        <div className="mb-4">
          <label className="text-[13px] font-semibold text-muted-foreground block mb-1.5">
            Devise de saisie
          </label>
          <div className="grid grid-cols-2 gap-2">
            {(['xaf', 'cny'] as InputCurrency[]).map((c) => (
              <button
                key={c}
                onClick={() => handleCurrencySwitch(c)}
                className={`py-2.5 rounded-xl text-[13px] font-bold cursor-pointer border-2 transition-colors ${
                  inputCurrency === c
                    ? 'border-purple-600 bg-purple-50 text-purple-600'
                    : 'border-border bg-white text-muted-foreground'
                }`}
              >
                {c === 'xaf' ? 'XAF (Franc CFA)' : 'CNY (¥ RMB)'}
              </button>
            ))}
          </div>
        </div>

        {/* Amount */}
        <div className="mb-4">
          <label className="text-[13px] font-semibold text-muted-foreground block mb-1.5">
            Montant ({inputCurrency === 'xaf' ? 'XAF' : 'CNY'})
          </label>
          <Input
            type="text"
            inputMode="numeric"
            value={numAmount > 0 ? formatNumber(numAmount) : ''}
            onChange={handleAmountChange}
            className="text-lg font-bold"
            placeholder={inputCurrency === 'xaf' ? '500 000' : '5 000'}
          />
          <div className="flex gap-1.5 mt-2">
            {quickAmounts.map((v) => (
              <button
                key={v}
                onClick={() => setAmount(v)}
                className={`flex-1 py-2 rounded-lg text-[11px] font-semibold cursor-pointer transition-colors ${
                  amount === v
                    ? 'border-2 border-purple-600 bg-purple-50 text-purple-600'
                    : 'border border-border bg-white text-muted-foreground'
                }`}
              >
                {getQuickLabel(v, inputCurrency)}
              </button>
            ))}
          </div>
        </div>

        {/* Payment method */}
        <div className="mb-4">
          <label className="text-[13px] font-semibold text-muted-foreground block mb-1.5">
            Mode de paiement
          </label>
          <div className="grid grid-cols-2 gap-2">
            {PAYMENT_METHODS.map((pm) => (
              <button
                key={pm.key}
                onClick={() => setMethod(pm.key)}
                className="p-3 rounded-xl flex items-center gap-2 cursor-pointer transition-colors"
                style={{
                  border:
                    method === pm.key
                      ? `2px solid ${pm.color}`
                      : '2px solid var(--border)',
                  background: method === pm.key ? `${pm.color}10` : 'white',
                }}
              >
                <span className="text-lg">{pm.icon}</span>
                <span className="text-[13px] font-semibold text-foreground">{pm.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Country */}
        <div>
          <label className="text-[13px] font-semibold text-muted-foreground block mb-1.5">
            Pays du client
          </label>
          <div className="grid grid-cols-3 gap-1.5">
            {COUNTRIES.map((c) => (
              <button
                key={c.key}
                onClick={() => setCountry(c.key)}
                className={`py-2.5 px-1.5 rounded-xl flex flex-col items-center gap-1 cursor-pointer border-2 transition-colors ${
                  country === c.key
                    ? 'border-purple-600 bg-purple-50'
                    : 'border-border bg-white'
                }`}
              >
                <span className="text-xl">{c.flag}</span>
                <span
                  className={`text-[10px] font-semibold ${
                    country === c.key ? 'text-purple-600' : 'text-muted-foreground'
                  }`}
                >
                  {c.label}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Result */}
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
        <div className="bg-muted/50 rounded-2xl p-6 text-center">
          <div className="text-sm text-muted-foreground">{emptyMessage}</div>
        </div>
      )}
    </div>
  );
}
