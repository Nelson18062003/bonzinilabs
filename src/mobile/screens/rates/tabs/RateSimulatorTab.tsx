// ============================================================
// MODULE TAUX — RateSimulatorTab (simulateur de conversion)
// Disposition ÉPURÉE fidèle à la maquette validée rates.tsx :
// UNE carte blanche = segment devise (Depuis XAF/CNY) · gros
// montant + unité ambre · 4 méthodes en grille (tuile active
// remplie lilas) · bloc résultat lilas « Votre fournisseur
// reçoit ¥ ». Le pays est une option discrète (puces). Le détail
// complet du calcul reste accessible en repli (« Voir le détail »).
// Logique 100% PRÉSERVÉE : calculateFinalRate / getBaseRate /
// convertCNYtoXAF, result memo, handleCurrencySwitch (conversion
// XAF↔CNY), minAmountCNY, handleAmountChange, emptyMessage.
// ============================================================
import { useState, useMemo } from 'react';
import { ChevronDown, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
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

export function RateSimulatorTab({ activeRate, adjustments, isLoading, isError }: RateSimulatorTabProps) {
  const [amount, setAmount] = useState('500000');
  const [method, setMethod] = useState<PaymentMethodKey>('cash');
  const [country, setCountry] = useState('cameroun');
  const [inputCurrency, setInputCurrency] = useState<InputCurrency>('xaf');
  const [showDetail, setShowDetail] = useState(false);

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

  const emptyMessage = !activeRate
    ? 'Aucun taux actif'
    : inputCurrency === 'xaf'
    ? `Saisissez un montant ≥ ${formatNumber(MIN_AMOUNT_XAF)} XAF`
    : minAmountCNY
    ? `Saisissez un montant ≥ ${formatNumber(minAmountCNY)} CNY`
    : 'Saisissez un montant valide';

  const methodLabel = PAYMENT_METHODS.find((p) => p.key === method)?.label ?? method;

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
    <div className="space-y-2">
      {/* ── Carte unique, fidèle à la maquette validée ── */}
      <div className={cn('rounded-[22px] p-4', SURFACE.card, SURFACE.shadow)}>
        {/* Segment devise — Depuis XAF / Depuis CNY (option discrète) */}
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
                {c === 'xaf' ? 'Depuis XAF' : 'Depuis CNY'}
              </button>
            );
          })}
        </div>

        {/* Montant — gros chiffre éditable + unité ambre */}
        <div className="mt-4">
          <label htmlFor="sim-amount" className={cn('text-[12px] font-medium', TEXT.muted)}>
            Montant
          </label>
          <div className="mt-1 flex items-baseline gap-2">
            {/* Champ « gros chiffre » de la maquette : 40px (très au-dessus de 16px,
                aucun risque d'auto-zoom iOS) → input nu volontaire pour l'inline ¥/XAF. */}
            {/* eslint-disable-next-line no-restricted-syntax */}
            <input
              id="sim-amount"
              inputMode="numeric"
              value={numAmount > 0 ? formatNumber(numAmount) : ''}
              onChange={handleAmountChange}
              placeholder={inputCurrency === 'xaf' ? '500 000' : '5 000'}
              className={cn(
                'min-w-0 flex-1 bg-transparent text-[40px] font-black leading-none tabular-nums outline-none',
                'placeholder:text-[#C7C2D6] dark:placeholder:text-[#4A4658]',
                TEXT.strong,
              )}
            />
            <span className="shrink-0 text-[18px] font-extrabold text-[#E8932A]">
              {inputCurrency === 'xaf' ? 'XAF' : 'CNY'}
            </span>
          </div>
        </div>

        {/* Méthodes — grille 4, tuile active remplie (lilas) */}
        <div className="mt-4 grid grid-cols-4 gap-2">
          {PAYMENT_METHODS.map((pm) => {
            const active = method === pm.key;
            return (
              <button
                key={pm.key}
                onClick={() => setMethod(pm.key)}
                aria-pressed={active}
                className={cn(
                  'flex flex-col items-center gap-1.5 rounded-2xl p-2 transition active:scale-[0.97]',
                  active ? 'bg-[#EDEAFA] dark:bg-[#2A2738]' : '',
                )}
              >
                <MethodLogo method={pm.key} size={38} />
                <span className={cn('text-[10px] font-semibold', active ? TEXT.strong : TEXT.muted)}>
                  {pm.label}
                </span>
              </button>
            );
          })}
        </div>

        {/* Pays du client — option discrète (puces défilantes) */}
        <div className="mt-3 -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {COUNTRIES.map((c) => {
            const active = country === c.key;
            return (
              <button
                key={c.key}
                onClick={() => setCountry(c.key)}
                className={cn(
                  'shrink-0 rounded-full px-3 py-1.5 text-[12px] font-semibold transition-colors',
                  active ? 'bg-[#8B5CF6] text-white' : cn(SURFACE.canvas, TEXT.muted),
                )}
              >
                {c.label}
              </button>
            );
          })}
        </div>

        {/* Résultat — bloc lilas « Votre fournisseur reçoit ¥ » (maquette) */}
        {result ? (
          <div className="mt-4 rounded-2xl bg-[#EDEAFA] p-4 dark:bg-[#221F33]">
            <div className={cn('text-[12px] font-medium', TEXT.muted)}>Votre fournisseur reçoit</div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-[28px] font-black text-[#C3BDD2] dark:text-[#5C5772]">¥</span>
              <span className={cn('text-[40px] font-black leading-none tabular-nums', TEXT.strong)}>
                {result.amountCNY.toLocaleString('fr-FR', { maximumFractionDigits: 2 })}
              </span>
            </div>
            <div className={cn('mt-1.5 text-[12px]', TEXT.muted)}>
              via {methodLabel} · vous payez{' '}
              <span className="font-semibold tabular-nums">
                {result.amountXAF.toLocaleString('fr-FR')} XAF
              </span>
            </div>
          </div>
        ) : (
          <div className="mt-4 rounded-2xl bg-[#EDEAFA]/60 p-5 text-center dark:bg-[#221F33]/60">
            <div className={cn('text-[13px]', TEXT.muted)}>{emptyMessage}</div>
          </div>
        )}
      </div>

      {/* Détail complet du calcul — option discrète, repli (transparence préservée) */}
      {result && (
        <>
          <button
            type="button"
            onClick={() => setShowDetail((v) => !v)}
            aria-expanded={showDetail}
            className={cn('flex w-full items-center justify-center gap-1 py-1.5 text-[12px] font-semibold', TEXT.muted)}
          >
            {showDetail ? 'Masquer le détail' : 'Voir le détail du calcul'}
            <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', !showDetail && '-rotate-90')} />
          </button>
          {showDetail && (
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
          )}
        </>
      )}
    </div>
  );
}
