/**
 * Taux — carte B « Simulateur » (docs/admin-redesign/06).
 *
 * Deux colonnes internes : saisie à gauche (montant, mode, pays), résultat à
 * droite avec le détail du calcul TOUJOURS visible — au téléphone c'était un
 * accordéon, sur un grand écran le cacher n'a aucun sens : l'admin dicte le
 * taux final au client en direct. Logique de calcul identique au mobile
 * (calculateFinalRate / convertCNYtoXAF, convergence de tranche).
 */
import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { PAYMENT_METHODS, COUNTRIES, MIN_AMOUNT_XAF, TIERS } from '@/types/rates';
import type { PaymentMethodKey, RateAdjustment, DailyRate, InputCurrency } from '@/types/rates';
import { calculateFinalRate, getBaseRate, convertCNYtoXAF } from '@/lib/rateCalculation';
import { formatNumber } from '@/lib/formatters';
import { SURFACE, TEXT, Card, CardHeader, Chip } from '@/desktop/designKit';
import { MethodLogo } from '@/mobile/screens/rates/components/MethodLogo';

interface Props {
  activeRate: DailyRate | null | undefined;
  adjustments: RateAdjustment[];
}

export function RateSimulatorCard({ activeRate, adjustments }: Props) {
  const [amount, setAmount] = useState('500000');
  const [method, setMethod] = useState<PaymentMethodKey>('cash');
  const [country, setCountry] = useState('cameroun');
  const [inputCurrency, setInputCurrency] = useState<InputCurrency>('xaf');

  const countryAdjs = useMemo(() => adjustments.filter((a) => a.type === 'country'), [adjustments]);
  const tierAdjs = useMemo(() => adjustments.filter((a) => a.type === 'tier'), [adjustments]);
  const numAmount = parseInt(amount) || 0;

  // Bascule XAF↔CNY en convertissant le montant courant (contrat mobile).
  const handleCurrencySwitch = (next: InputCurrency) => {
    if (next === inputCurrency) return;
    if (activeRate && numAmount > 0) {
      const baseRate = getBaseRate(activeRate, method);
      const countryPct = countryAdjs.find((c) => c.key === country)?.percentage ?? 0;
      if (next === 'cny') {
        const { amountCNY } = calculateFinalRate(baseRate, countryPct, numAmount, tierAdjs);
        setAmount(String(Math.round(amountCNY)));
      } else {
        setAmount(String(convertCNYtoXAF(numAmount, baseRate, countryPct, tierAdjs)));
      }
    }
    setInputCurrency(next);
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\s/g, '').replace(/\./g, '').replace(/,/g, '');
    if (/^\d*$/.test(val)) setAmount(val);
  };

  const result = useMemo(() => {
    if (!activeRate || numAmount <= 0) return null;
    const baseRate = getBaseRate(activeRate, method);
    const countryPct = countryAdjs.find((c) => c.key === country)?.percentage ?? 0;
    const amountXAF = inputCurrency === 'xaf' ? numAmount : convertCNYtoXAF(numAmount, baseRate, countryPct, tierAdjs);
    if (amountXAF < MIN_AMOUNT_XAF) return null;
    const calc = calculateFinalRate(baseRate, countryPct, amountXAF, tierAdjs);
    return {
      amountXAF,
      amountCNY: calc.amountCNY,
      baseRate,
      countryPct,
      tierPct: tierAdjs.find((t) => t.key === calc.tierKey)?.percentage ?? 0,
      tierKey: calc.tierKey,
      finalRate: calc.finalRate,
    };
  }, [activeRate, numAmount, method, country, inputCurrency, countryAdjs, tierAdjs]);

  const methodLabel = PAYMENT_METHODS.find((p) => p.key === method)?.label ?? method;
  const countryLabel = COUNTRIES.find((c) => c.key === country)?.label ?? country;
  const tierLabel = TIERS.find((t) => t.key === result?.tierKey)?.shortLabel;
  const adjClass = (v: number) =>
    v < 0 ? 'text-[#C0504D] dark:text-[#E79A9A]' : 'text-[#2E7D52] dark:text-[#7FCBA0]';

  return (
    <Card className="p-0">
      <CardHeader title="Simulateur" meta={activeRate ? 'sur les taux actifs' : 'aucun taux actif'} />
      <div className="grid grid-cols-[1fr_260px] items-stretch gap-4 p-4">
        {/* ── Saisie ── */}
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <Chip label="Depuis XAF" active={inputCurrency === 'xaf'} onClick={() => handleCurrencySwitch('xaf')} />
            <Chip label="Depuis CNY" active={inputCurrency === 'cny'} onClick={() => handleCurrencySwitch('cny')} />
          </div>

          <div className="mt-3">
            <label htmlFor="desk-sim-amount" className={cn('text-[11px] font-bold uppercase tracking-wider', TEXT.muted)}>
              Montant
            </label>
            <div className="mt-0.5 flex items-baseline gap-2">
              {/* Gros chiffre (32px, aucun risque d'auto-zoom) → input nu voulu. */}
              {/* eslint-disable-next-line no-restricted-syntax */}
              <input
                id="desk-sim-amount"
                inputMode="numeric"
                value={numAmount > 0 ? formatNumber(numAmount) : ''}
                onChange={handleAmountChange}
                placeholder={inputCurrency === 'xaf' ? '500 000' : '5 000'}
                className={cn(
                  'min-w-0 flex-1 bg-transparent text-[32px] font-black leading-none tabular-nums outline-none',
                  'placeholder:text-[#C7C2D6] dark:placeholder:text-[#4A4658]',
                  TEXT.strong,
                )}
              />
              <span className="shrink-0 text-[15px] font-extrabold text-[#E8932A]">
                {inputCurrency === 'xaf' ? 'XAF' : 'CNY'}
              </span>
            </div>
          </div>

          <div className="mt-3.5 grid grid-cols-4 gap-1.5">
            {PAYMENT_METHODS.map((pm) => {
              const active = method === pm.key;
              return (
                <button
                  key={pm.key}
                  type="button"
                  onClick={() => setMethod(pm.key)}
                  aria-pressed={active}
                  className={cn(
                    'flex flex-col items-center gap-1 rounded-xl py-2 transition',
                    active ? 'bg-[#EDEAFA] dark:bg-[#2A2738]' : 'hover:bg-black/[0.03] dark:hover:bg-white/[0.04]',
                  )}
                >
                  <MethodLogo method={pm.key} size={28} />
                  <span className={cn('text-[10px] font-semibold', active ? TEXT.strong : TEXT.muted)}>{pm.label}</span>
                </button>
              );
            })}
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {COUNTRIES.map((c) => (
              <Chip key={c.key} label={c.label} active={country === c.key} onClick={() => setCountry(c.key)} />
            ))}
          </div>
        </div>

        {/* ── Résultat + détail permanent ── */}
        <div className="flex flex-col rounded-2xl bg-[#EDEAFA] p-3.5 dark:bg-[#2F2C3D]">
          {result ? (
            <>
              <div className={cn('text-[11px] font-medium', TEXT.muted)}>Le fournisseur reçoit</div>
              <div className="mt-0.5 flex items-baseline gap-1.5">
                <span className="text-[20px] font-black text-[#C3BDD2] dark:text-[#5C5772]">¥</span>
                <span className={cn('text-[30px] font-black leading-none tabular-nums', TEXT.strong)}>
                  {result.amountCNY.toLocaleString('fr-FR', { maximumFractionDigits: 2 })}
                </span>
              </div>
              <div className={cn('mt-1 text-[11px]', TEXT.muted)}>
                via {methodLabel} · le client paie{' '}
                <b className="tabular-nums">{result.amountXAF.toLocaleString('fr-FR')} XAF</b>
              </div>

              <div className="mt-3 space-y-1.5 border-t border-black/[0.06] pt-2.5 text-[12px] dark:border-white/[0.08]">
                <div className="flex justify-between gap-2">
                  <span className={TEXT.muted}>Taux base</span>
                  <span className={cn('font-semibold tabular-nums', TEXT.strong)}>{result.baseRate.toLocaleString('fr-FR')}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className={cn('truncate', TEXT.muted)}>Pays ({countryLabel})</span>
                  <span className={cn('font-semibold tabular-nums', adjClass(result.countryPct))}>{result.countryPct}%</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className={TEXT.muted}>Tranche ({tierLabel})</span>
                  <span className={cn('font-semibold tabular-nums', adjClass(result.tierPct))}>{result.tierPct}%</span>
                </div>
                <div className="flex justify-between gap-2 border-t border-black/[0.06] pt-1.5 dark:border-white/[0.08]">
                  <span className={cn('font-bold', TEXT.strong)}>Taux final</span>
                  <span className="font-black tabular-nums text-[#5B4CC4] dark:text-[#B5AAF0]">
                    {result.finalRate.toLocaleString('fr-FR', { maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </>
          ) : (
            <div className={cn('m-auto text-center text-[12px]', TEXT.muted)}>
              {!activeRate ? 'Aucun taux actif' : 'Saisissez un montant'}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
