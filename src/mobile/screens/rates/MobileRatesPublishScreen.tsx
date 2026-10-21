/**
 * Publier de nouveaux taux — parcours en 3 étapes (maquettes 08-taux/03 à 08).
 *
 *   1/3  Partir de : la suggestion Binance (Recalculer), les taux actuels, ou
 *        une saisie à la main.
 *   2/3  Les 4 taux au gros clavier, « Pour 1 000 000 XAF » ou « Pour 1 ¥ ».
 *   3/3  La prise d'effet (maintenant, aujourd'hui, hier, autre date et heure)
 *        et l'aperçu avant → après, puis la feuille de confirmation.
 *   Succès : « Partager le flyer » tout de suite.
 *
 * Logique reprise telle quelle de l'ancien RateSetTab : valeur canonique
 * (¥ pour 1 M XAF) mémorisée derrière chaque champ en « Pour 1 ¥ » pour
 * qu'un aller-retour ne dérive pas, `rateEffectiveAt`, `create_daily_rates`
 * puis `mark_suggestion_applied` quand la suggestion a servi.
 */
import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { format, formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { ChevronRight, History, Pencil, RefreshCw, Share } from 'lucide-react';
import { cn } from '@/lib/utils';
import { parseDecimal } from '@/lib/decimalInput';
import { rateEffectiveAt, type RateDateOption } from '@/lib/rateEffectiveDate';
import { useComputeSuggestion, useCreateDailyRates, useLatestSuggestion, useMarkSuggestionApplied } from '@/hooks/useDailyRates';
import { BzDateTimeField } from '@/mobile/components/BzDateTimePicker';
import {
  BigButton, BottomSheet, BoxSegmented, ConfirmSheet, Dock, IconCircle, KVBox, Keypad, MethodCircle, ScreenError, ScreenTop, SuccessView,
  SURFACE, TEXT, applyKey, formatPad, type KV, type PadKey,
} from '@/mobile/designKit';
import type { MethodRates } from '@/lib/countryRates';
import type { PaymentMethodKey } from '@/types/rates';
import { BinanceCircle, FieldBox, GroupLabel, RadioCard } from './parts';
import { METHOD_NAME, METHOD_ORDER, dayTime, dec, hm, nb, rateGroups } from './rateFormat';
import { useRatesData } from './useRatesData';

type Direction = 'xaf_cny' | 'cny_xaf';
type Source = 'suggestion' | 'current' | 'manual';
type Values = Record<PaymentMethodKey, string>;

const EMPTY: Values = { alipay: '', wechat: '', virement: '', cash: '' };

/** Nombre → saisie du clavier (« 10870 », « 92,42 »). */
const toPad = (n: number) => (Number.isFinite(n) && n > 0 ? String(Math.round(n * 100) / 100).replace('.', ',') : '');

/** R ¥ / 1 M XAF ⇄ (1 000 000 / R) XAF / 1 ¥, arrondi à 2 décimales pour l'affichage. */
function invert(v: string): string {
  const n = parseDecimal(v);
  if (!Number.isFinite(n) || n <= 0) return v;
  return toPad(1_000_000 / n);
}

export function MobileRatesPublishScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const { activeRate, base, sheets, canManage } = useRatesData();
  const { data: suggestion } = useLatestSuggestion();
  const computeSuggestion = useComputeSuggestion();
  const createRates = useCreateDailyRates();
  const markApplied = useMarkSuggestionApplied();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [source, setSource] = useState<Source>('current');
  const [direction, setDirection] = useState<Direction>('xaf_cny');
  const [values, setValues] = useState<Values>(EMPTY);
  const [field, setField] = useState<PaymentMethodKey | null>('alipay');
  const fresh = useRef(true);
  const canonicalRef = useRef<Partial<Values>>({});
  const displayedRef = useRef<Partial<Values>>({});

  const [dateOption, setDateOption] = useState<RateDateOption>('now');
  const [custom, setCustom] = useState(() => format(new Date(), "yyyy-MM-dd'T'HH:00"));
  const [dateSheet, setDateSheet] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [done, setDone] = useState<{ rates: MethodRates; at: string } | null>(null);

  // Une suggestion existe : c'est le point de départ proposé.
  const suggestionPicked = useRef(false);
  useEffect(() => {
    if (suggestion && !suggestionPicked.current) { suggestionPicked.current = true; setSource('suggestion'); }
  }, [suggestion]);

  // « Utiliser ¥ … » depuis le marché : directement à la saisie, la suggestion posée.
  const fromMarket = (location.state as { source?: Source } | null)?.source === 'suggestion';
  const marketApplied = useRef(false);
  useEffect(() => {
    if (!fromMarket || marketApplied.current || !suggestion) return;
    marketApplied.current = true;
    start('suggestion');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromMarket, suggestion]);

  const shown = (k: PaymentMethodKey, canonical: string) => {
    canonicalRef.current[k] = canonical;
    const inv = invert(canonical);
    displayedRef.current[k] = inv;
    return inv;
  };

  const start = (src: Source) => {
    const canon: Values = src === 'suggestion' && suggestion
      ? { alipay: toPad(suggestion.suggested_rate), wechat: toPad(suggestion.suggested_rate), virement: toPad(suggestion.suggested_rate), cash: toPad(suggestion.suggested_rate) }
      : src === 'current' && base
        ? { alipay: toPad(base.alipay), wechat: toPad(base.wechat), virement: toPad(base.virement), cash: toPad(base.cash) }
        : EMPTY;
    setSource(src);
    setValues(direction === 'cny_xaf' ? (Object.fromEntries(METHOD_ORDER.map((k) => [k, shown(k, canon[k])])) as Values) : canon);
    setField('alipay');
    fresh.current = true;
    setStep(2);
  };

  const switchDirection = (d: Direction) => {
    if (d === direction) return;
    setValues((prev) => {
      const next = { ...prev };
      for (const k of METHOD_ORDER) {
        next[k] = d === 'cny_xaf'
          ? shown(k, prev[k])
          : prev[k] === displayedRef.current[k] && canonicalRef.current[k] !== undefined
            ? (canonicalRef.current[k] as string)
            : invert(prev[k]);
      }
      return next;
    });
    fresh.current = true;
    setDirection(d);
  };

  /** Valeur saisie → taux canonique ¥ / 1 M XAF, quel que soit l'affichage. */
  const canonical = (k: PaymentMethodKey): number => {
    const v = values[k];
    if (direction === 'cny_xaf') {
      if (v === displayedRef.current[k] && canonicalRef.current[k] !== undefined) {
        const exact = parseDecimal(canonicalRef.current[k] as string);
        return Number.isFinite(exact) && exact > 0 ? exact : 0;
      }
      const n = parseDecimal(v);
      return Number.isFinite(n) && n > 0 ? Math.round((1_000_000 / n) * 100) / 100 : 0;
    }
    const n = parseDecimal(v);
    return Number.isFinite(n) && n > 0 ? n : 0;
  };
  const next: MethodRates = { alipay: canonical('alipay'), wechat: canonical('wechat'), virement: canonical('virement'), cash: canonical('cash') };
  const complete = METHOD_ORDER.every((k) => next[k] > 0 && next[k] < 1_000_000);

  const onKey = (key: PadKey) => {
    if (!field) return;
    // Lu AVANT la mise à jour : React peut appeler le calcul plus tard.
    const replace = fresh.current && key !== 'back';
    fresh.current = false;
    setValues((prev) => ({ ...prev, [field]: applyKey(replace ? '' : prev[field], key, 2, 7) }));
  };

  const pick = (k: PaymentMethodKey) => { setField(k); fresh.current = true; };

  const back = () => {
    if (step === 1 || (step === 2 && fromMarket)) navigate('/m/more/rates');
    else setStep((s) => (s - 1) as 1 | 2);
  };

  const effectiveAt = () => {
    const [d, t] = custom.split('T');
    const [h, m] = (t ?? '00:00').split(':').map(Number);
    return rateEffectiveAt(dateOption, d, Number.isNaN(h) ? 0 : h, Number.isNaN(m) ? 0 : m);
  };

  const whenLabel = (): string => {
    if (dateOption === 'now') return `Maintenant, ${hm(new Date())}`;
    if (dateOption === 'today') return 'Aujourd’hui, 00:00';
    if (dateOption === 'yesterday') return 'Hier, 00:00';
    return dayTime(effectiveAt());
  };

  const publish = () => {
    if (!complete) return;
    const suggestionId = source === 'suggestion' && suggestion && !suggestion.applied ? suggestion.id : null;
    const at = effectiveAt();
    createRates.mutate(
      { rate_alipay: next.alipay, rate_wechat: next.wechat, rate_virement: next.virement, rate_cash: next.cash, effective_at: at },
      {
        onSuccess: (result) => {
          if (suggestionId && result.rate_id) markApplied.mutate({ suggestionId, rateId: result.rate_id });
          setConfirm(false);
          setDone({ rates: next, at: dateOption === 'now' ? new Date().toISOString() : at });
        },
      },
    );
  };

  if (!canManage) {
    return (
      <div className="flex min-h-full flex-col">
        <ScreenTop title="Nouveaux taux" backTo="/m/more/rates" />
        <ScreenError title="Accès réservé" description="La publication des taux demande le droit de gérer les taux." />
      </div>
    );
  }

  if (done) {
    const today = new Date(done.at).toDateString() === new Date().toDateString();
    return (
      <SuccessView
        title="Taux publiés"
        subtitle={
          <>
            Alipay ¥&nbsp;{nb(done.rates.alipay)}{'\u00A0· '}Cash ¥&nbsp;{nb(done.rates.cash)}
            <br />
            Actifs depuis {today ? hm(done.at) : dayTime(done.at)}{sheets.length > 0 ? ` · ${sheets.length} pays` : ''}
          </>
        }
        primary={{ label: <><Share className="h-5 w-5" /> Partager le flyer</>, onClick: () => navigate('/m/more/rates/flyer') }}
        secondary={{ label: 'Retour aux taux', onClick: () => navigate('/m/more/rates') }}
      />
    );
  }

  const groups = rateGroups(next, base);
  const previewRows: KV[] = groups.map((g) => ({
    label: g.label,
    before: g.prev != null ? nb(g.prev) : undefined,
    value: nb(g.value),
  }));

  return (
    <div className="flex min-h-full flex-col">
      <ScreenTop title="Nouveaux taux" step={`${step}/3`} onBack={back} />

      {step === 1 && (
        <>
          <GroupLabel>Partir de</GroupLabel>
          <div className="space-y-3 px-5">
            {suggestion && (
              <RadioCard
                selected={source === 'suggestion'}
                onClick={() => setSource('suggestion')}
                leading={<BinanceCircle />}
                title="Suggestion Binance"
                subtitle={`Il y a ${formatDistanceToNow(new Date(suggestion.computed_at), { locale: fr })}`}
              >
                <div className="px-4 pb-4">
                  <div className={cn('text-[40px] font-bold leading-none tracking-[-0.02em] tabular-nums', TEXT.strong)}>¥&nbsp;{nb(suggestion.suggested_rate)}</div>
                  <div className={cn('mt-4 rounded-lg border', SURFACE.divider)}>
                    {[
                      { place: 'Cameroun', how: `achat · max + ${dec(suggestion.cmr_margin_xaf, 0)} XAF`, value: dec(suggestion.cmr_rate_max + suggestion.cmr_margin_xaf, 2, 2), unit: 'XAF/USDT' },
                      { place: 'Chine', how: 'vente · moyenne', value: dec(suggestion.chn_rate_avg, 3, 3), unit: '¥/USDT' },
                    ].map((r) => (
                      <div key={r.place} className={cn('flex items-center justify-between gap-3 border-b px-4 py-3 last:border-b-0', SURFACE.divider)}>
                        <span className={cn('min-w-0 text-[16px] leading-snug', TEXT.muted)}>{r.place}<br />{r.how}</span>
                        <span className={cn('shrink-0 text-right text-[17px] font-semibold leading-snug tabular-nums', TEXT.strong)}>{r.value}<br /><span className={cn('text-[15px] font-medium', TEXT.muted)}>{r.unit}</span></span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 flex justify-end">
                    <button
                      type="button"
                      onClick={() => computeSuggestion.mutate()}
                      disabled={computeSuggestion.isPending}
                      className={cn('inline-flex h-12 items-center gap-2 rounded-lg border px-4 text-[17px] font-semibold disabled:opacity-60', SURFACE.divider, SURFACE.inset, TEXT.strong)}
                    >
                      <RefreshCw className={cn('h-5 w-5', computeSuggestion.isPending && 'animate-spin')} /> Recalculer
                    </button>
                  </div>
                </div>
              </RadioCard>
            )}
            {!suggestion && (
              <RadioCard
                selected={false}
                onClick={() => computeSuggestion.mutate()}
                leading={<BinanceCircle />}
                title="Suggestion Binance"
                subtitle={computeSuggestion.isPending ? 'Calcul…' : 'Calculer'}
                right={<RefreshCw className={cn('h-6 w-6', TEXT.muted, computeSuggestion.isPending && 'animate-spin')} />}
              />
            )}
            {activeRate && base && (
              <RadioCard
                selected={source === 'current'}
                onClick={() => setSource('current')}
                leading={<IconCircle icon={History} />}
                title="Taux actuels"
                subtitle={`¥ ${nb(base.alipay)} · depuis ${hm(activeRate.effective_at)}`}
              />
            )}
            <RadioCard
              selected={source === 'manual'}
              onClick={() => setSource('manual')}
              leading={<IconCircle icon={Pencil} />}
              title="Saisir à la main"
            />
          </div>
          <Dock>
            <BigButton onClick={() => start(source)} disabled={source === 'suggestion' && !suggestion}>Continuer</BigButton>
          </Dock>
        </>
      )}

      {step === 2 && (
        <>
          <div className="px-5 pt-4">
            <BoxSegmented
              ariaLabel="Sens des taux"
              options={[{ value: 'xaf_cny', label: 'Pour 1 000 000 XAF' }, { value: 'cny_xaf', label: 'Pour 1 ¥' }]}
              value={direction}
              onChange={switchDirection}
            />
          </div>
          <div className="px-5 pt-2">
            {METHOD_ORDER.map((k) => {
              const cur = base?.[k] ?? 0;
              const canon = canonical(k);
              const sub = direction === 'xaf_cny'
                ? (cur > 0 ? `Actuel ${nb(cur)}` : undefined)
                : canon > 0 ? `Soit ¥ ${nb(canon)}` : cur > 0 ? `Actuel ${dec(1_000_000 / cur, 2, 2)}` : undefined;
              const placeholder = cur > 0 ? (direction === 'xaf_cny' ? nb(cur) : dec(1_000_000 / cur, 2, 2)) : '0';
              return (
                <div key={k} className={cn('flex items-center gap-3.5 border-b py-3 last:border-b-0', SURFACE.divider)}>
                  <MethodCircle method={k} size={44} />
                  <span className="min-w-0 flex-1">
                    <span className={cn('block truncate text-[17px] font-semibold', TEXT.strong)}>{METHOD_NAME[k]}</span>
                    {sub && <span className={cn('block truncate text-[15px]', TEXT.muted)}>{sub}</span>}
                  </span>
                  <FieldBox
                    value={values[k] ? formatPad(values[k]) : ''}
                    placeholder={placeholder}
                    active={field === k}
                    onClick={() => pick(k)}
                    ariaLabel={`Taux ${METHOD_NAME[k]}`}
                  />
                </div>
              );
            })}
          </div>
          <div className="flex-1" />
          <Keypad onKey={onKey} decimals={2} className="pb-2 pt-3" />
          <Dock>
            <BigButton onClick={() => setStep(3)} disabled={!complete}>Continuer</BigButton>
          </Dock>
        </>
      )}

      {step === 3 && (
        <>
          <GroupLabel>Prise d’effet</GroupLabel>
          <div className="space-y-3 px-5">
            <RadioCard selected={dateOption === 'now'} onClick={() => setDateOption('now')} title="Maintenant" subtitle={`Aujourd’hui, ${hm(new Date())}`} />
            <RadioCard selected={dateOption === 'today'} onClick={() => setDateOption('today')} title="Aujourd’hui" subtitle="Depuis 00:00" />
            <RadioCard selected={dateOption === 'yesterday'} onClick={() => setDateOption('yesterday')} title="Hier" subtitle="Depuis 00:00" />
            <RadioCard
              selected={dateOption === 'custom'}
              onClick={() => setDateSheet(true)}
              title="Autre date et heure"
              subtitle={dateOption === 'custom' ? dayTime(effectiveAt()) : undefined}
              right={<ChevronRight className={cn('h-6 w-6', TEXT.muted)} />}
            />
          </div>
          <GroupLabel>Aperçu · Cameroun</GroupLabel>
          <div className="px-5">
            <KVBox rows={previewRows} />
          </div>
          <Dock>
            <BigButton onClick={() => setConfirm(true)} disabled={!complete}>Publier</BigButton>
          </Dock>
        </>
      )}

      <BottomSheet open={dateSheet} onClose={() => setDateSheet(false)} title="Autre date et heure">
        <BzDateTimeField value={custom} onChange={setCustom} accent="#2C2C2C" disableFuture={false} />
        <div className="mt-5">
          <BigButton onClick={() => { setDateOption('custom'); setDateSheet(false); }}>Valider</BigButton>
        </div>
      </BottomSheet>

      <ConfirmSheet
        open={confirm}
        onClose={() => setConfirm(false)}
        title={'Publier ces taux\u00A0?'}
        subtitle={`${whenLabel()}${activeRate ? ` · remplace ceux de ${hm(activeRate.effective_at)}` : ''}`}
        rows={[
          ...previewRows,
          ...(sheets.length > 1 ? [{ label: `${sheets.length - 1} autres pays`, value: 'Suivent leur écart' }] : []),
        ]}
        confirmLabel="Publier"
        onConfirm={publish}
        loading={createRates.isPending}
        disabled={!complete}
      />
    </div>
  );
}
