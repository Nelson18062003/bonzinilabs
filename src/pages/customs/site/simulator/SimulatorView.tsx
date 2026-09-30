// ============================================================
// Estimer mes droits — /douane/simulateur (site) et /m/douane/simulateur (équipe).
//
// Trois étapes courtes (le produit, le prix, la situation), le résultat
// à côté sur ordinateur, dessous sur téléphone — avec, sur téléphone et
// tablette, une barre en bas qui garde le montant sous les yeux pendant
// qu'on modifie le formulaire. Tout le scénario tient dans l'URL.
// ============================================================
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AnimatePresence, motion, useInView } from 'framer-motion';
import { ArrowDown, Calculator, Check, ChevronDown, RotateCcw, Scale, Share2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useCustomsNomenclature } from '@/hooks/useCustomsNomenclature';
import { copyToClipboard } from '@/lib/clipboard';
import { simulate, needsWeight, DEFAULT_XAF_PER, type Currency, type Incoterm, type Simulation } from '@/lib/customs/engine';
import { defaultRate, type Nomenclature, type TariffLine } from '@/lib/customs/nomenclature';
import { formatHs } from '@/lib/customs/hsCode';
import { vatExemption } from '@/lib/customs/vatExempt';
import type { TaxRegime } from '@/lib/customs/levies';
import {
  DEFAULT_STATE, bandsBetween, parseSimState, serializeSimState, toSimulationInput, vehicleKindOf, type SimState,
} from '@/lib/customs/simulatorState';
import { ratePct, xaf } from '../../format';
import { lineTitle } from '../../components/lineText';
import { Badge, Button, ButtonLink, CountUp, Input, Pills } from '../ui';
import { EASE } from '../styles';
import { ProductSearch } from './ProductSearch';
import { SimResult } from './Result';

const CURRENCIES: Currency[] = ['CNY', 'USD', 'EUR', 'XAF'];
const INCOTERMS: Incoterm[] = ['EXW', 'FOB', 'CFR', 'CIF'];
const REGIMES: TaxRegime[] = ['reel', 'simplifie', 'hors_fichier', 'exonere'];
const YEAR = new Date().getFullYear();
const EXAMPLES = [
  { key: 'regulator', code: '850440', amount: '900000' },
  { key: 'wigs', code: '670411', amount: '1000000' },
  { key: 'chairs', code: '940180', amount: '500000' },
] as const;

/** « 900000 » → « 900 000 » à l'écran ; la saisie garde les chiffres seuls. */
function groupDigits(raw: string): string {
  const [int, dec] = raw.replace(/\s/g, '').split(/[.,]/);
  const g = (int ?? '').replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return dec != null ? `${g},${dec}` : g;
}

function run(state: SimState, line: TariffLine | null, chosenDuty: number | null): Simulation | null {
  if (!line) return null;
  const duty = chosenDuty ?? defaultRate(line);
  if (duty == null) return null;
  const input = toSimulationInput(state, line.code, duty, YEAR);
  return input ? simulate(input) : null;
}

type Set = <K extends keyof SimState>(k: K, v: SimState[K]) => void;

/** Une étape : son numéro (coché quand elle est faite), son titre, son contenu. */
function Step({ n, title, done, children, aside }: { n: number; title: string; done?: boolean; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="rounded-3xl border border-dz-line bg-dz-card p-5 sm:p-6">
      <header className="mb-4 flex items-center gap-3">
        <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[14px] font-bold transition-colors',
          done ? 'bg-dz-primary text-dz-on-primary' : 'bg-dz-soft text-dz-ink2')}>
          {done ? <Check aria-hidden className="h-4 w-4" /> : n}
        </span>
        <h2 className="min-w-0 flex-1 text-[18px] font-semibold text-dz-ink">{title}</h2>
        {aside}
      </header>
      {children}
    </section>
  );
}

function SelectedProduct({ nom, line, lang, chosen, onChoose, onChange }: {
  nom: Nomenclature; line: TariffLine; lang: 'fr' | 'en' | 'zh'; chosen: number | null; onChoose: (r: number | null) => void; onChange: () => void;
}) {
  const { t } = useTranslation('customs');
  const heading = nom.headings.get(line.code.slice(0, 4));
  const bands = bandsBetween(line.rateMin, line.rateMax);
  const current = chosen ?? defaultRate(line);
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-[26px] font-bold leading-none tracking-[-0.02em] tabular-nums text-dz-ink">{formatHs(line.code)}</p>
          <p className="mt-2 line-clamp-3 text-[17px] font-semibold leading-snug text-dz-ink" title={lang === 'en' ? line.en : line.fr}>{lang === 'en' ? line.en : line.fr}</p>
          {heading && (
            <p className="mt-1 line-clamp-2 text-[14px] leading-snug text-dz-ink3">
              {t('sim.headingOf', { code: formatHs(line.code.slice(0, 4)) })} · {lang === 'en' ? heading.en : heading.fr}
            </p>
          )}
        </div>
        <Button variant="secondary" size="sm" onClick={onChange}>{t('sim.change')}</Button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="brand">
          {line.rateMax == null ? t('sim.rateUnknown') : line.rateMin !== line.rateMax ? t('sim.rateRange', { min: line.rateMin, max: line.rateMax }) : t('sim.rate', { rate: line.rateMax })}
        </Badge>
        {line.rateHow != null && line.rateHow > 0 && <span className="text-[14px] text-dz-ink3">{t('sim.rateInferred')}</span>}
      </div>
      {bands.length > 1 && (
        <div className="space-y-2">
          <p className="text-[14px] text-dz-ink3">{t('sim.rateChoose')}</p>
          <Pills label={t('sim.rateChoose')} options={bands.map((b) => ({ value: String(b), label: `${b} %` }))} value={String(current)}
            onChange={(v) => onChoose(Number(v) === line.rateMax ? null : Number(v))} />
        </div>
      )}
      {line.rateMax == null && (
        <div className="space-y-2">
          <label htmlFor="dz-duty" className="block text-[15px] font-semibold">{t('sim.rateManual')}</label>
          <Input id="dz-duty" inputMode="decimal" className="max-w-[160px] tabular-nums" value={chosen == null ? '' : String(chosen)}
            onChange={(e) => { const n = Number(e.target.value.replace(',', '.')); onChoose(e.target.value === '' || !Number.isFinite(n) ? null : Math.min(100, Math.max(0, n))); }} />
        </div>
      )}
    </div>
  );
}

function Toggle({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" role="checkbox" aria-checked={on} onClick={onClick}
      className={cn('flex w-full items-start gap-3 rounded-2xl border p-4 text-left text-[15px] leading-snug transition-colors',
        on ? 'border-dz-ink bg-dz-soft text-dz-ink' : 'border-dz-line text-dz-ink2 hover:border-dz-ink/25')}>
      <span className={cn('mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border', on ? 'border-dz-primary bg-dz-primary text-dz-on-primary' : 'border-dz-line')}>
        {on && <Check aria-hidden className="h-3.5 w-3.5" />}
      </span>
      {children}
    </button>
  );
}

/** Ce que le code demande de plus : le véhicule, l'hydroquinone, l'usage agricole, le poids. */
function Extras({ code, state, set }: { code: string; state: SimState; set: Set }) {
  const { t } = useTranslation('customs');
  const kind = vehicleKindOf(code);
  const agriMatters = vatExemption(code, false).exempt === 'maybe' && vatExemption(code, true).exempt === 'yes' && kind !== 'tractor';
  const vehicle = kind === 'car' || kind === 'utility' || kind === 'tractor';
  if (!vehicle && !code.startsWith('33') && !agriMatters && !needsWeight(code)) return null;
  return (
    <div className="space-y-4 border-t border-dz-line pt-5">
      <p className="text-[15px] font-semibold text-dz-ink">{t('site.sim.extras')}</p>
      {vehicle && (
        <div className="space-y-4">
          <Pills label={t('sim.vehicleTitle')} options={[{ value: 'new', label: t('sim.vehicleNew') }, { value: 'used', label: t('sim.vehicleUsed') }]}
            value={state.used ? 'used' : 'new'} onChange={(v) => set('used', v === 'used')} />
          <div className="grid gap-4 sm:grid-cols-2">
            {state.used && (
              <div className="space-y-2">
                <label htmlFor="dz-year" className="block text-[15px] font-semibold">{t('sim.vehicleYear')}</label>
                <Input id="dz-year" inputMode="numeric" maxLength={4} placeholder="2016" className="tabular-nums" value={state.year} onChange={(e) => set('year', e.target.value.replace(/\D/g, ''))} />
                <p className="text-[14px] text-dz-ink3">{t('sim.vehicleYearHint')}</p>
              </div>
            )}
            {kind === 'car' && (
              <div className="space-y-2">
                <label htmlFor="dz-cc" className="block text-[15px] font-semibold">{t('sim.vehicleCc')}</label>
                <Input id="dz-cc" inputMode="numeric" placeholder="1 998" className="tabular-nums" value={state.cc} onChange={(e) => set('cc', e.target.value.replace(/\D/g, ''))} />
                <p className="text-[14px] text-dz-ink3">{t('sim.vehicleCcHint')}</p>
              </div>
            )}
          </div>
          {kind === 'tractor' && <Toggle on={state.agricultural} onClick={() => set('agricultural', !state.agricultural)}>{t('sim.tractorAgricultural')}</Toggle>}
        </div>
      )}
      {code.startsWith('33') && <Toggle on={state.hydroquinone} onClick={() => set('hydroquinone', !state.hydroquinone)}>{t('sim.hydroquinone')}</Toggle>}
      {agriMatters && <Toggle on={state.agriUse} onClick={() => set('agriUse', !state.agriUse)}>{t('sim.agriUse')}</Toggle>}
      {needsWeight(code) && (
        <div className="space-y-2">
          <label htmlFor="dz-weight" className="block text-[15px] font-semibold">{t('sim.weight')}</label>
          <Input id="dz-weight" inputMode="numeric" className="max-w-[220px] tabular-nums" value={state.weight} onChange={(e) => set('weight', e.target.value.replace(/[^\d\s]/g, ''))} />
          <p className="text-[14px] text-dz-ink3">{t('sim.weightHint')}</p>
        </div>
      )}
    </div>
  );
}

function Compare({ nom, lang, a, b, onRemove }: {
  nom: Nomenclature; lang: 'fr' | 'en' | 'zh'; a: { line: TariffLine; sim: Simulation }; b: { line: TariffLine; sim: Simulation }; onRemove: () => void;
}) {
  const { t } = useTranslation('customs');
  const delta = b.sim.dau.total - a.sim.dau.total;
  const code = formatHs(b.line.code);
  const rows: [string, (s: Simulation) => string][] = [
    [t('levy.DDI', { defaultValue: 'Droit de douane' }), (s) => ratePct(s.dau.lines.find((x) => x.code === 'DDI')?.rate ?? 0)],
    [t('levy.DAC', { defaultValue: "Droit d'accises" }), (s) => ratePct(s.excise.rate)],
    [t('levy.TVA', { defaultValue: 'TVA' }), (s) => (s.vat.exempt === 'yes' ? t('sim.exempt') : ratePct(19.25))],
  ];
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-baseline gap-x-5 gap-y-2 text-[15px]">
        <span />
        <span className="text-right font-bold tabular-nums">{formatHs(a.line.code)}</span>
        <span className="text-right font-bold tabular-nums">{code}</span>
        {rows.map(([label, f]) => (
          <div key={label} className="contents">
            <span className="text-dz-ink3">{label}</span>
            <span className="text-right tabular-nums text-dz-ink2">{f(a.sim)}</span>
            <span className="text-right tabular-nums text-dz-ink2">{f(b.sim)}</span>
          </div>
        ))}
        <span className="border-t border-dz-line pt-2 font-semibold">{t('sim.total')}</span>
        <span className="border-t border-dz-line pt-2 text-right font-semibold tabular-nums">{xaf(a.sim.dau.total)}</span>
        <span className="border-t border-dz-line pt-2 text-right font-semibold tabular-nums">{xaf(b.sim.dau.total)}</span>
      </div>
      <p className="text-[14px] text-dz-ink3">{code} · {lineTitle(nom, b.line, lang)}</p>
      <p className={cn('rounded-2xl px-4 py-3 text-[15px] font-semibold', delta > 0 ? 'bg-dz-warn-soft text-dz-warn' : delta < 0 ? 'bg-dz-good-soft text-dz-good' : 'bg-dz-soft text-dz-ink2')}>
        {delta > 0 ? t('sim.compareMore', { code, amount: xaf(delta) }) : delta < 0 ? t('sim.compareLess', { code, amount: xaf(-delta) }) : t('sim.compareSame', { code })}
      </p>
      <Button variant="ghost" size="sm" onClick={onRemove}><X aria-hidden /> {t('sim.compareRemove')}</Button>
    </div>
  );
}

function EmptyResult({ onExample }: { onExample: (e: typeof EXAMPLES[number]) => void }) {
  const { t } = useTranslation('customs');
  return (
    <div className="rounded-3xl border border-dashed border-dz-line bg-dz-soft p-6 sm:p-7">
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-dz-card text-dz-brand"><Calculator aria-hidden className="h-6 w-6" /></span>
      <p className="mt-5 text-[18px] font-semibold text-dz-ink">{t('site.sim.emptyTitle')}</p>
      <p className="mt-1 text-[15px] text-dz-ink3">{t('site.sim.emptyBody')}</p>
      <p className="mt-6 text-[13px] font-semibold uppercase tracking-[0.1em] text-dz-ink3">{t('site.sim.tryExample')}</p>
      <ul className="mt-3 space-y-2">
        {EXAMPLES.map((e) => (
          <li key={e.key}>
            <button type="button" onClick={() => onExample(e)}
              className="flex w-full items-center justify-between gap-3 rounded-2xl border border-dz-line bg-dz-card px-4 py-3 text-left transition-colors hover:border-dz-ink/25">
              <span className="min-w-0">
                <span className="block text-[15px] font-semibold text-dz-ink">{t(`site.home.ex.${e.key}`)}</span>
                <span className="block text-[14px] tabular-nums text-dz-ink3">{formatHs(e.code)} · {xaf(Number(e.amount))} CIF</span>
              </span>
              <ArrowDown aria-hidden className="h-4 w-4 shrink-0 -rotate-90 text-dz-ink3" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function SimulatorView({ admin = false }: { admin?: boolean }) {
  const { t } = useTranslation('customs');
  const { data: nom, isLoading, isError, refetch } = useCustomsNomenclature();
  if (isLoading) {
    return (
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px]" aria-busy="true" aria-label={t('sim.loading')}>
        <div className="space-y-4">{[0, 1].map((i) => <div key={i} className="h-48 animate-pulse rounded-3xl bg-dz-soft" />)}</div>
        <div className="hidden h-80 animate-pulse rounded-3xl bg-dz-soft lg:block" />
      </div>
    );
  }
  if (isError || !nom) {
    return (
      <div className="rounded-3xl border border-dz-line bg-dz-card p-6">
        <p className="text-[17px] font-semibold">{t('sim.loadError')}</p>
        <Button className="mt-4" variant="secondary" onClick={() => { void refetch(); }}><RotateCcw aria-hidden /> {t('site.retry')}</Button>
      </div>
    );
  }
  return <SimulatorBody nom={nom} admin={admin} />;
}

/** Monté une fois le tarif chargé : l'observateur du résultat s'accroche alors à un élément qui existe. */
function SimulatorBody({ nom, admin }: { nom: Nomenclature; admin: boolean }) {
  const { t, i18n } = useTranslation('customs');
  const lang = (i18n.language?.slice(0, 2) ?? 'fr') as 'fr' | 'en' | 'zh';
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const [initialQ] = useState(() => params.get('q') ?? '');
  const [state, setState] = useState<SimState>(() => parseSimState(params));
  const [picking, setPicking] = useState<'main' | 'compare' | null>(null);
  const [situationOpen, setSituationOpen] = useState(false);
  const set: Set = (k, v) => setState((s) => ({ ...s, [k]: v }));
  const resultRef = useRef<HTMLDivElement>(null);
  const resultSeen = useInView(resultRef, { margin: '0px 0px -30% 0px' });

  useEffect(() => {
    const id = window.setTimeout(() => setParams(serializeSimState(state), { replace: true }), 400);
    return () => window.clearTimeout(id);
  }, [state, setParams]);

  const line = state.code ? nom.byCode.get(state.code) ?? null : null;
  const compareLine = state.compare ? nom.byCode.get(state.compare) ?? null : null;
  const sim = useMemo(() => run(state, line, state.duty), [state, line]);
  const compareSim = useMemo(() => run(state, compareLine, null), [state, compareLine]);
  const wide = typeof window !== 'undefined' && window.matchMedia?.('(min-width: 1024px)').matches;

  const pick = (l: TariffLine) => {
    if (picking === 'compare') set('compare', l.code);
    else setState((s) => ({ ...s, code: l.code, duty: null, compare: s.compare === l.code ? null : s.compare }));
    setPicking(null);
  };
  const share = async () => {
    const url = `${window.location.origin}/douane/simulateur?${serializeSimState(state)}`;
    if (navigator.share) {
      try { await navigator.share({ title: t('sim.shareText'), url }); return; } catch { /* annulé : on copie */ }
    }
    await copyToClipboard(url, t('sim.linkLabel'));
  };
  const example = (e: typeof EXAMPLES[number]) => setState({ ...DEFAULT_STATE, code: e.code, amount: e.amount, currency: 'XAF', xaf: '1', incoterm: 'CIF' });
  const priceDone = !!state.amount && Number(state.amount.replace(/\D/g, '')) > 0;

  return (
    <>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,440px)] lg:items-start lg:gap-10">
        <div className="min-w-0 space-y-4">
          <Step n={1} title={t('site.sim.stepProduct')} done={!!line && picking !== 'main'}>
            {line && picking !== 'main' ? (
              <SelectedProduct nom={nom} line={line} lang={lang} chosen={state.duty} onChoose={(d) => set('duty', d)} onChange={() => setPicking('main')} />
            ) : (
              <ProductSearch nom={nom} onPick={pick} initialQuery={state.code ? '' : initialQ} autoFocus={wide && !state.code} />
            )}
          </Step>

          <Step n={2} title={t('site.sim.stepPrice')} done={priceDone}>
            <div className="space-y-5">
              <div className="space-y-2">
                <label htmlFor="dz-amount" className="block text-[15px] font-semibold">{t('sim.amount')}</label>
                <div className="relative">
                  <Input id="dz-amount" inputMode="decimal" placeholder="100 000" value={groupDigits(state.amount)}
                    onChange={(e) => set('amount', e.target.value.replace(/[^\d.,]/g, ''))}
                    className="h-14 rounded-2xl pr-20 text-[22px] font-semibold tabular-nums" />
                  <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[15px] font-semibold text-dz-ink3">{state.currency}</span>
                </div>
                <Pills label={t('site.sim.currency')} options={CURRENCIES.map((c) => ({ value: c, label: c }))} value={state.currency}
                  onChange={(c) => setState((s) => ({ ...s, currency: c, xaf: String(DEFAULT_XAF_PER[c]) }))} />
              </div>
              {state.currency !== 'XAF' && (
                <div className="flex flex-wrap items-center gap-3">
                  <label htmlFor="dz-xaf" className="text-[15px] font-semibold">{t('site.sim.ratePer', { cur: state.currency })}</label>
                  <Input id="dz-xaf" inputMode="decimal" value={state.xaf} onChange={(e) => set('xaf', e.target.value.replace(/[^\d.,]/g, ''))}
                    className="h-11 w-28 text-center tabular-nums" />
                  <span className="text-[15px] text-dz-ink3">F CFA</span>
                  <p className="w-full text-[14px] text-dz-ink3">{t('sim.xafHint')}</p>
                </div>
              )}
              <div className="space-y-2">
                <p className="text-[15px] font-semibold">{t('site.sim.includes')}</p>
                <Pills label={t('site.sim.includes')} options={INCOTERMS.map((v) => ({ value: v, label: v }))} value={state.incoterm} onChange={(v) => set('incoterm', v)} />
                <p className="text-[14px] text-dz-ink3">{t(`sim.incoterm.${state.incoterm}`)}</p>
              </div>
              {state.incoterm !== 'CIF' && (
                <div className="grid gap-4 sm:grid-cols-2">
                  {(state.incoterm === 'EXW' || state.incoterm === 'FOB') && (
                    <div className="space-y-2">
                      <label htmlFor="dz-freight" className="block text-[15px] font-semibold">{t('sim.freight')}</label>
                      <Input id="dz-freight" inputMode="numeric" placeholder="900 000" className="tabular-nums" value={state.freight} onChange={(e) => set('freight', e.target.value.replace(/[^\d\s]/g, ''))} />
                      <p className="text-[14px] text-dz-ink3">{t('sim.freightHint')}</p>
                    </div>
                  )}
                  <div className="space-y-2">
                    <label htmlFor="dz-ins" className="block text-[15px] font-semibold">{t('sim.insurance')}</label>
                    <Input id="dz-ins" inputMode="numeric" className="tabular-nums" value={state.insurance} onChange={(e) => set('insurance', e.target.value.replace(/[^\d\s]/g, ''))} />
                    <p className="text-[14px] text-dz-ink3">{t('sim.insuranceHint')}</p>
                  </div>
                </div>
              )}
            </div>
          </Step>

          <Step n={3} title={t('sim.step4')} done>
            <button type="button" onClick={() => setSituationOpen((o) => !o)} aria-expanded={situationOpen}
              className="flex w-full items-center justify-between gap-3 rounded-2xl border border-dz-line px-4 py-3 text-left transition-colors hover:border-dz-ink/25">
              <span className="min-w-0">
                <span className="block text-[16px] font-semibold text-dz-ink">{t(`sim.regime.${state.regime}`)}</span>
                <span className="block text-[14px] text-dz-ink3">{t('site.sim.situationHint')}</span>
              </span>
              <ChevronDown aria-hidden className={cn('h-5 w-5 shrink-0 text-dz-ink3 transition-transform duration-300', situationOpen && 'rotate-180')} />
            </button>
            <AnimatePresence initial={false}>
              {situationOpen && (
                <motion.div key="reg" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3, ease: EASE }} className="overflow-hidden">
                  <div role="radiogroup" aria-label={t('sim.step4')} className="grid gap-2 pt-3 sm:grid-cols-2">
                    {REGIMES.map((r) => (
                      <button key={r} type="button" role="radio" aria-checked={state.regime === r} onClick={() => { set('regime', r); setSituationOpen(false); }}
                        className={cn('rounded-2xl border px-4 py-3 text-left text-[15px] font-semibold transition-colors',
                          state.regime === r ? 'border-dz-ink bg-dz-soft text-dz-ink' : 'border-dz-line text-dz-ink2 hover:border-dz-ink/25')}>
                        {t(`sim.regime.${r}`)}
                      </button>
                    ))}
                  </div>
                  <p className="pt-3 text-[14px] text-dz-ink3">{t('sim.regimeHint')}</p>
                </motion.div>
              )}
            </AnimatePresence>
            {line && <div className="mt-5"><Extras code={line.code} state={state} set={set} /></div>}
          </Step>
        </div>

        <aside ref={resultRef} className="min-w-0 scroll-mt-24 space-y-4 lg:sticky lg:top-24">
          {!sim || !line ? (
            <EmptyResult onExample={example} />
          ) : (
            <>
              <SimResult sim={sim} tariff={line} admin={admin} />
              <div className="rounded-3xl border border-dz-line bg-dz-card p-5 sm:p-6">
                <h3 className="flex items-center gap-2 text-[16px] font-semibold"><Scale aria-hidden className="h-[18px] w-[18px] text-dz-brand" /> {t('sim.compareTitle')}</h3>
                <div className="mt-4">
                  {picking === 'compare' ? (
                    <div className="space-y-3">
                      <p className="text-[14px] text-dz-ink3">{t('sim.comparePick')}</p>
                      <ProductSearch nom={nom} onPick={pick} exclude={line.code} autoFocus inputId="dz-compare" />
                      <Button variant="ghost" size="sm" onClick={() => setPicking(null)}>{t('site.close')}</Button>
                    </div>
                  ) : compareLine && compareSim ? (
                    <Compare nom={nom} lang={lang} a={{ line, sim }} b={{ line: compareLine, sim: compareSim }} onRemove={() => set('compare', null)} />
                  ) : (
                    <Button variant="secondary" className="h-auto min-h-12 w-full whitespace-normal py-3 text-center" onClick={() => setPicking('compare')}>{t('sim.compareCta')}</Button>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="secondary" onClick={() => { void share(); }}><Share2 aria-hidden /> {t('site.sim.share')}</Button>
                <Button variant="ghost" onClick={() => { setState(DEFAULT_STATE); setPicking('main'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}><RotateCcw aria-hidden /> {t('site.sim.reset')}</Button>
              </div>
              {!admin && <ButtonLink to={user ? '/payments/new' : '/auth'} variant="brand" size="lg" className="w-full">{t('site.home.payCta')}</ButtonLink>}
              <p className="text-[14px] leading-relaxed text-dz-ink3">{t('sim.disclaimer')} {t('sim.sources')}</p>
            </>
          )}
        </aside>
      </div>

      {/* Téléphone et tablette : le montant reste visible pendant qu'on modifie. */}
      <AnimatePresence>
        {sim && !resultSeen && (
          <motion.div key="bar" initial={{ y: 90, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 90, opacity: 0 }} transition={{ duration: 0.3, ease: EASE }}
            className="fixed inset-x-0 bottom-0 z-30 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:hidden">
            <button type="button" onClick={() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
              className="mx-auto flex w-full max-w-[640px] items-center justify-between gap-4 rounded-2xl bg-dz-primary px-5 py-3.5 text-left text-dz-on-primary shadow-[0_18px_40px_-12px_rgba(19,13,30,.55)]">
              <span className="min-w-0">
                <span className="block text-[13px] font-medium opacity-70">{t('sim.headline')}</span>
                <span className="block text-[22px] font-bold leading-tight"><CountUp value={sim.dau.total} format={xaf} /></span>
              </span>
              <span className="inline-flex items-center gap-1.5 text-[15px] font-semibold">{t('site.sim.see')} <ArrowDown aria-hidden className="h-4 w-4" /></span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
