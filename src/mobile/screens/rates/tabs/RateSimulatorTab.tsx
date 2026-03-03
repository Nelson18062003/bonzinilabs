import { useState, useMemo } from 'react';
import { Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { PAYMENT_METHODS, COUNTRIES } from '@/types/rates';
import type { PaymentMethodKey, RateAdjustment, DailyRate } from '@/types/rates';
import { calculateFinalRate, getBaseRate } from '@/lib/rateCalculation';
import { SimulatorResult } from '../components/SimulatorResult';

interface RateSimulatorTabProps {
  activeRate: DailyRate | null | undefined;
  adjustments: RateAdjustment[];
  isLoading: boolean;
  isError?: boolean;
}

const QUICK_AMOUNTS = ['50000', '250000', '500000', '1000000', '2000000'];

export function RateSimulatorTab({ activeRate, adjustments, isLoading, isError }: RateSimulatorTabProps) {
  const [amount, setAmount] = useState('500000');
  const [method, setMethod] = useState<PaymentMethodKey>('cash');
  const [country, setCountry] = useState('cameroun');

  const countryAdjs = useMemo(
    () => adjustments.filter((a) => a.type === 'country'),
    [adjustments],
  );
  const tierAdjs = useMemo(
    () => adjustments.filter((a) => a.type === 'tier'),
    [adjustments],
  );

  const result = useMemo(() => {
    if (!activeRate) return null;
    const amountXAF = parseFloat(amount) || 0;
    if (amountXAF < 10000) return null;

    const baseRate = getBaseRate(activeRate, method);
    const countryAdj = countryAdjs.find((c) => c.key === country);
    const countryPct = countryAdj?.percentage ?? 0;

    const calc = calculateFinalRate(baseRate, countryPct, amountXAF, tierAdjs);
    const tierAdj = tierAdjs.find((t) => t.key === calc.tierKey);

    return {
      amountXAF,
      amountCNY: calc.amountCNY,
      baseRate,
      countryAdj: countryPct,
      tierAdj: tierAdj?.percentage ?? 0,
      tierKey: calc.tierKey,
      finalRate: calc.finalRate,
    };
  }, [activeRate, amount, method, country, countryAdjs, tierAdjs]);

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

        {/* Amount */}
        <div className="mb-4">
          <label className="text-[13px] font-semibold text-muted-foreground block mb-1.5">
            Montant (XAF)
          </label>
          <Input
            type="text"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))}
            className="text-lg font-bold"
            placeholder="500 000"
          />
          <div className="flex gap-1.5 mt-2">
            {QUICK_AMOUNTS.map((v) => {
              const num = parseInt(v);
              const label = num >= 1_000_000 ? `${num / 1_000_000}M` : `${num / 1_000}K`;
              return (
                <button
                  key={v}
                  onClick={() => setAmount(v)}
                  className={`flex-1 py-2 rounded-lg text-[11px] font-semibold cursor-pointer transition-colors ${
                    amount === v
                      ? 'border-2 border-purple-600 bg-purple-50 text-purple-600'
                      : 'border border-border bg-white text-muted-foreground'
                  }`}
                >
                  {label}
                </button>
              );
            })}
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
                  background:
                    method === pm.key ? `${pm.color}10` : 'white',
                }}
              >
                <span className="text-lg">{pm.icon}</span>
                <span className="text-[13px] font-semibold text-foreground">
                  {pm.label}
                </span>
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
        />
      ) : (
        <div className="bg-muted/50 rounded-2xl p-6 text-center">
          <div className="text-sm text-muted-foreground">
            {!activeRate
              ? 'Aucun taux actif'
              : 'Saisissez un montant >= 10 000 XAF'}
          </div>
        </div>
      )}
    </div>
  );
}
