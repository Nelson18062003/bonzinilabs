/**
 * Simulateur (maquettes 08-taux/22 et 23).
 *
 * Le pays en haut à droite, la méthode en tuiles, le montant au gros
 * clavier, XAF ou ¥ RMB : « Le fournisseur reçoit ¥ … » ou « Le client paie
 * … XAF ». Toucher le résultat ouvre le détail du calcul (base, pays,
 * palier, taux appliqué « Modifier », montants à copier). « Voir la
 * cotation » ouvre l'image à partager avec les mêmes chiffres.
 */
import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Check, ChevronDown, Copy } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCountryPct } from '@/lib/countryRates';
import {
  ActionSheet, AmountDisplay, BigButton, BottomSheet, Dock, FOCUS_RING, KVBox, Keypad, MethodCircle, ScreenTop, SURFACE, TEXT, Tag,
  applyKey, formatPad, padValue, useSheet, type PadKey,
} from '@/mobile/designKit';
import type { PaymentMethodKey } from '@/types/rates';
import { CustomRateSheet } from './CustomRateSheet';
import { FlagCircle } from './parts';
import { TIER_SHORT, computeQuote, quoteSearch, readQuote, type Side } from './quoteCalc';
import { METHOD_ORDER, METHOD_SHORT, dec, nb } from './rateFormat';
import { useRatesData } from './useRatesData';

export function MobileRatesSimulatorScreen() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const initial = useMemo(() => readQuote(params), [params]);
  const { activeRate, adjustments, sheets } = useRatesData();

  const [amountStr, setAmountStr] = useState(String(initial.amount));
  const [side, setSide] = useState<Side>(initial.side);
  const [method, setMethod] = useState<PaymentMethodKey>(initial.method);
  const [country, setCountry] = useState(initial.country);
  const [customRate, setCustomRate] = useState<number>(initial.customRate);
  const countries = useSheet();
  const detail = useSheet();
  const customSheet = useSheet();
  const [copied, setCopied] = useState<string | null>(null);

  const amount = Math.round(padValue(amountStr));
  const q = { amount, side, method, country, customRate };
  const result = computeQuote(activeRate, adjustments, q);
  const sheet = sheets.find((s) => s.key === country) ?? sheets.find((s) => s.isReference);
  const countryLabel = sheet?.label ?? 'Cameroun';

  const onKey = (k: PadKey) => setAmountStr((s) => applyKey(s, k, 0, 12));

  const switchSide = (next: string) => {
    const s = next === 'cny' ? 'cny' : 'xaf';
    if (s === side) return;
    if (result) setAmountStr(String(s === 'cny' ? Math.round(result.amountCNY) : result.amountXAF));
    setSide(s);
  };

  const copy = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(id);
      setTimeout(() => setCopied((c) => (c === id ? null : c)), 1600);
    } catch {
      toast.error('Copie impossible sur cet appareil');
    }
  };

  const copyBtn = (id: string, text: string) => (
    <button type="button" onClick={() => void copy(id, text)} aria-label={`Copier ${text}`} className={cn('-my-2 -mr-2 flex h-11 w-11 items-center justify-center rounded-full', FOCUS_RING, TEXT.strong)}>
      {copied === id ? <Check className="h-5 w-5" /> : <Copy className="h-5 w-5" />}
    </button>
  );

  const xafText = result ? `${result.amountXAF.toLocaleString('fr-FR')} XAF` : '';
  const cnyText = result ? `¥${Math.round(result.amountCNY).toLocaleString('fr-FR')}` : '';

  return (
    <div className="flex min-h-full flex-col">
      <ScreenTop
        title="Simulateur"
        backTo="/m/more/rates"
        right={
          <button type="button" onClick={countries.show} className={cn('inline-flex h-11 items-center gap-2 rounded-lg pl-2 pr-3 text-[17px] font-semibold', SURFACE.inset, FOCUS_RING, TEXT.strong)}>
            <FlagCircle iso={sheet?.iso ?? 'CM'} size={28} />
            <span className="max-w-[120px] truncate">{countryLabel}</span>
            <ChevronDown className="h-5 w-5" />
          </button>
        }
      />

      <div className="grid grid-cols-4 gap-2.5 px-5 pt-4">
        {METHOD_ORDER.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setMethod(k)}
            aria-pressed={method === k}
            className={cn(
              'flex flex-col items-center gap-2 rounded-lg border px-1 py-3',
              FOCUS_RING,
              method === k ? 'border-[#2C2C2C] ring-1 ring-[#2C2C2C] dark:border-[#E3E3E3] dark:ring-[#E3E3E3]' : SURFACE.divider,
            )}
          >
            <MethodCircle method={k} size={38} />
            <span className={cn('max-w-full truncate text-[15px] font-semibold', TEXT.strong)}>{METHOD_SHORT[k]}</span>
          </button>
        ))}
      </div>

      <AmountDisplay
        value={formatPad(amountStr)}
        prefix={side === 'cny' ? '¥' : undefined}
        units={[{ value: 'xaf', label: 'XAF' }, { value: 'cny', label: '¥ RMB' }]}
        unit={side}
        onUnit={switchSide}
        conversion={
          result ? (
            <button type="button" onClick={detail.show} className={cn('-my-2.5 rounded px-2 py-2.5 underline-offset-4 active:underline', FOCUS_RING)}>
              {side === 'xaf'
                ? <>Le fournisseur reçoit <b className="font-bold">¥&nbsp;{nb(result.amountCNY)}</b></>
                : <>Le client paie <b className="font-bold">{nb(result.amountXAF)}&nbsp;XAF</b></>}
            </button>
          ) : activeRate ? 'Saisissez un montant' : 'Aucun taux publié'
        }
        note={
          result
            ? result.custom
              ? `Taux personnalisé · ¥ ${dec(result.finalRate)}`
              : `${TIER_SHORT[result.auto?.tierKey ?? 't3']} · ¥ ${dec(result.finalRate)}`
            : undefined
        }
      />

      <div className="flex-1" />
      <Keypad onKey={onKey} className="pb-2 pt-4" />
      <Dock>
        <BigButton onClick={() => navigate(`/m/more/rates/quote?${quoteSearch(q)}`)} disabled={!result}>Voir la cotation</BigButton>
      </Dock>

      <ActionSheet
        open={countries.open}
        onClose={countries.hide}
        title="Pays du client"
        actions={sheets.map((s) => ({
          label: <span className="inline-flex items-center gap-3"><FlagCircle iso={s.iso} size={32} />{s.label}</span>,
          hint: s.isReference ? 'Référence' : `Écart ${formatCountryPct(s.percentage)}`,
          onClick: () => setCountry(s.key),
        }))}
      />

      <BottomSheet open={detail.open} onClose={detail.hide}>
        <h3 className={cn('text-[22px] font-semibold leading-tight', TEXT.strong)}>Détail du calcul</h3>
        <p className={cn('mt-1 text-[16px]', TEXT.muted)}>{METHOD_SHORT[method]} · {countryLabel}</p>
        {result && (
          <KVBox
            className="mt-4"
            rows={[
              ...(result.auto
                ? [
                    { label: 'Taux de base', value: <span className={cn(result.custom && 'opacity-50')}>{dec(result.auto.baseRate)}</span> },
                    { label: `Pays · ${countryLabel}`, value: <span className={cn(result.custom && 'opacity-50')}>{formatCountryPct(result.auto.countryPct)}</span> },
                    { label: `Palier · ${TIER_SHORT[result.auto.tierKey].replace(' XAF', '')}`, value: <span className={cn(result.custom && 'opacity-50')}>{formatCountryPct(result.auto.tierPct)}</span> },
                  ]
                : []),
              {
                label: result.custom ? <span className="inline-flex items-center gap-2">Taux appliqué <Tag tone="pending">Personnalisé</Tag></span> : 'Taux appliqué',
                value: (
                  <span className="inline-flex items-center gap-5">
                    {dec(result.finalRate)}
                    <button type="button" onClick={customSheet.show} className={cn('-my-2 py-2 font-semibold underline underline-offset-[3px]', TEXT.strong)}>Modifier</button>
                  </span>
                ),
              },
              { label: 'Le client paie', value: <span className="inline-flex items-center gap-3">{nb(result.amountXAF)} XAF{copyBtn('xaf', xafText)}</span> },
              { label: 'Le fournisseur reçoit', value: <span className="inline-flex items-center gap-3">¥ {nb(result.amountCNY)}{copyBtn('cny', cnyText)}</span> },
            ]}
          />
        )}
        <div className="mt-5">
          <BigButton onClick={() => { detail.hide(); navigate(`/m/more/rates/quote?${quoteSearch(q)}`); }} disabled={!result}>Voir la cotation</BigButton>
        </div>
      </BottomSheet>

      <CustomRateSheet
        open={customSheet.open}
        onClose={customSheet.hide}
        auto={result?.auto?.finalRate ?? null}
        custom={customRate}
        onApply={setCustomRate}
      />
    </div>
  );
}
