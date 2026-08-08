/**
 * Simulateur client — « combien mon fournisseur reçoit-il ? »
 *
 * Rebuilt off `@/mobile/screens/rates/tabs/RateSimulatorTab`, which the phone
 * still owns. That version rendered 14 controls: a 36px currency segment, a
 * 40px bare number field, four 75px method tiles, six 30px country chips and
 * the detail toggle.
 *
 * Two of those groups changed shape:
 *   · **the six country chips became one `Select`.** A client has one country
 *     and it is Cameroun in the overwhelming majority of the questions support
 *     answers, so five of the six chips were permanently idle pixels on the
 *     busiest row of the screen.
 *   · **the simulator no longer renders at all without a published rate.** All
 *     fourteen controls used to be live with no rate in the system, and the
 *     only thing they could produce was « Aucun taux actif » — one sentence is
 *     a better answer than fourteen dead controls.
 *
 * The currency segment reads `XAF` / `CNY`, matching the publish panel's
 * segment; the two used to say `Depuis XAF` and `Pour 1M XAF` for what an
 * operator reads as the same choice.
 *
 * **Every number is computed by the same code as before**: `getBaseRate`,
 * `calculateFinalRate`, `convertCNYtoXAF`, the `result` memo, the two-way
 * `handleCurrencySwitch` conversion, `minAmountCNY`, the digits-only
 * `handleAmountChange` and the `emptyMessage` ladder are moved verbatim.
 */
import { useState, useMemo } from 'react';
import { AlertTriangle, CalendarClock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PAYMENT_METHODS, COUNTRIES, TIERS, MIN_AMOUNT_XAF } from '@/types/rates';
import type { PaymentMethodKey, RateAdjustment, DailyRate, InputCurrency } from '@/types/rates';
import { calculateFinalRate, getBaseRate, convertCNYtoXAF } from '@/lib/rateCalculation';
import { formatNumber } from '@/lib/formatters';
import { MethodLogo } from '@/mobile/screens/rates/components/MethodLogo';
import { DS, DT, DFG } from '@/desktop/ui/tokens';
import {
  Chip,
  DataRow,
  EmptyState,
  Field,
  Figure,
  Input,
  Panel,
  PanelHead,
  Segment,
  Select,
  Spinner,
} from '@/desktop/ui/primitives';
import { Disclosure } from './Disclosure';

interface RateSimulatorPanelProps {
  activeRate: DailyRate | null | undefined;
  adjustments: RateAdjustment[];
  isLoading: boolean;
  isError?: boolean;
}

export function RateSimulatorPanel({
  activeRate,
  adjustments,
  isLoading,
  isError,
}: RateSimulatorPanelProps) {
  const [amount, setAmount] = useState('500000');
  const [method, setMethod] = useState<PaymentMethodKey>('cash');
  const [country, setCountry] = useState('cameroun');
  const [inputCurrency, setInputCurrency] = useState<InputCurrency>('xaf');

  const countryAdjs = useMemo(() => adjustments.filter((a) => a.type === 'country'), [adjustments]);
  const tierAdjs = useMemo(() => adjustments.filter((a) => a.type === 'tier'), [adjustments]);

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
      inputCurrency === 'xaf' ? num : convertCNYtoXAF(num, baseRate, countryPct, tierAdjs);

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
  const countryLabel = COUNTRIES.find((c) => c.key === country)?.label ?? country;
  const tierShort = TIERS.find((t) => t.key === result?.tierKey)?.shortLabel ?? result?.tierKey;

  if (isLoading) {
    return (
      <Panel>
        <PanelHead title="Simulateur client" />
        <Spinner />
      </Panel>
    );
  }

  if (isError) {
    return (
      <Panel>
        <PanelHead title="Simulateur client" />
        <EmptyState
          icon={AlertTriangle}
          title="Erreur de chargement"
          hint="Impossible de charger les données. Vérifiez que la migration SQL a été exécutée."
        />
      </Panel>
    );
  }

  /* Sans taux publié le simulateur n'a rien à calculer : une phrase plutôt que
     quatorze contrôles vivants qui ne peuvent produire qu'un message vide. */
  if (!activeRate) {
    return (
      <Panel>
        <PanelHead title="Simulateur client" />
        <EmptyState
          icon={CalendarClock}
          title="Aucun taux actif"
          hint="Publiez le taux du jour pour simuler ce qu'un client règle et ce que son fournisseur reçoit."
        />
      </Panel>
    );
  }

  return (
    <div className="space-y-4">
      <Panel>
        <PanelHead
          title="Simulateur client"
          hint="Taux de base + ajustement pays + ajustement tranche"
        />

        <div className="space-y-4 p-4">
          <div className="flex items-center justify-between gap-3">
            <span className={cn(DT.micro, DFG.faint)}>Devise saisie</span>
            <Segment
              value={inputCurrency}
              onChange={handleCurrencySwitch}
              options={[
                { value: 'xaf', label: 'XAF' },
                { value: 'cny', label: 'CNY' },
              ]}
            />
          </div>

          <Field label="Montant">
            <div className="flex items-center gap-2">
              <Input
                inputMode="numeric"
                value={numAmount > 0 ? formatNumber(numAmount) : ''}
                onChange={handleAmountChange}
                placeholder={inputCurrency === 'xaf' ? '500 000' : '5 000'}
                className="text-right font-bold tabular-nums"
              />
              <span className={cn(DT.label, DFG.muted, 'w-8 shrink-0')}>
                {inputCurrency === 'xaf' ? 'XAF' : 'CNY'}
              </span>
            </div>
          </Field>

          <div>
            <span className={cn(DT.label, DFG.base, 'mb-1 block font-semibold')}>Méthode</span>
            <div className="flex flex-wrap gap-2">
              {PAYMENT_METHODS.map((pm) => (
                <Chip
                  key={pm.key}
                  active={method === pm.key}
                  onClick={() => setMethod(pm.key)}
                  aria-label={`Méthode ${pm.label}`}
                >
                  <MethodLogo method={pm.key} size={24} />
                  {pm.label}
                </Chip>
              ))}
            </div>
          </div>

          <Field label="Pays du client">
            <Select value={country} onChange={(e) => setCountry(e.target.value)}>
              {COUNTRIES.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.flag} {c.label}
                </option>
              ))}
            </Select>
          </Field>

          {result ? (
            <div className={cn('rounded-lg p-4', DS.well)}>
              <p className={cn(DT.micro, DFG.faint)}>Votre fournisseur reçoit</p>
              <p className="mt-2">
                <Figure
                  size="hero"
                  value={`¥ ${result.amountCNY.toLocaleString('fr-FR', { maximumFractionDigits: 2 })}`}
                />
              </p>
              <p className={cn(DT.body, DFG.muted, 'mt-2')}>
                via {methodLabel} · vous payez{' '}
                <span className={cn('font-semibold tabular-nums', DFG.strong)}>
                  {result.amountXAF.toLocaleString('fr-FR')} XAF
                </span>
              </p>
            </div>
          ) : (
            <div className={cn('rounded-lg p-4', DS.well)}>
              <p className={cn(DT.body, DFG.muted)}>{emptyMessage}</p>
            </div>
          )}
        </div>
      </Panel>

      {/* Détail complet du calcul — repli, transparence préservée. */}
      {result ? (
        <Disclosure title="Détail du calcul">
          <div className="px-1">
            {result.inputCurrency === 'cny' ? (
              <DataRow
                label="Saisie CNY"
                value={<Figure value={`${result.inputAmount.toLocaleString('fr-FR')} CNY`} />}
              />
            ) : null}
            <DataRow
              label={result.inputCurrency === 'cny' ? 'Équivalent XAF' : 'Vous réglez'}
              value={<Figure value={`${result.amountXAF.toLocaleString('fr-FR')} XAF`} />}
            />
            <DataRow
              label="Le client reçoit"
              value={
                <Figure
                  value={`¥ ${result.amountCNY.toLocaleString('fr-FR', { maximumFractionDigits: 2 })}`}
                />
              }
            />
            <DataRow
              label={`Taux base (${methodLabel})`}
              value={<Figure value={`${result.baseRate.toLocaleString('fr-FR')} CNY`} />}
            />
            <DataRow
              label={`Ajust. pays (${countryLabel})`}
              value={
                <Figure
                  value={`${result.countryAdj} %`}
                  tone={result.countryAdj < 0 ? 'negative' : 'positive'}
                />
              }
            />
            <DataRow
              label={`Ajust. tranche (${tierShort})`}
              value={
                <Figure
                  value={`${result.tierAdj} %`}
                  tone={result.tierAdj < 0 ? 'negative' : 'positive'}
                />
              }
            />
            <DataRow
              label="Taux final appliqué"
              value={
                <Figure
                  value={result.finalRate.toLocaleString('fr-FR', { maximumFractionDigits: 2 })}
                  unit="CNY"
                />
              }
            />
            <p className={cn(DT.label, DFG.faint, 'pt-2')}>
              {result.amountXAF.toLocaleString('fr-FR')} XAF ×{' '}
              {result.finalRate.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} / 1 000 000 ={' '}
              {result.amountCNY.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} CNY
            </p>
          </div>
        </Disclosure>
      ) : null}
    </div>
  );
}
