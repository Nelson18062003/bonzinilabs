// ============================================================
// Simulateur de droits et taxes — /douane/simulateur (public) et
// /m/douane/simulateur (équipe). docs/douane/00-plan.md, étape 2.
//
// Quatre questions (le produit, le prix, ce que le prix comprend, la
// situation fiscale), puis la liquidation CAMCIS ligne par ligne. Tout le
// scénario tient dans l'URL : on le partage sur WhatsApp tel quel.
// ============================================================
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Share2, Scale, X, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useCustomsNomenclature } from '@/hooks/useCustomsNomenclature';
import { copyToClipboard } from '@/lib/clipboard';
import {
  Button, Card, Chip, FormField, Line, Segmented, TextInput, ScreenError, ScreenLoader, SURFACE, TEXT, TYPE,
} from '@/mobile/designKit';
import { simulate, needsWeight, DEFAULT_XAF_PER, type Currency, type Incoterm, type Simulation } from '@/lib/customs/engine';
import { defaultRate, lineContext, type Nomenclature, type TariffLine } from '@/lib/customs/nomenclature';
import { formatHs } from '@/lib/customs/hsCode';
import { vatExemption } from '@/lib/customs/vatExempt';
import type { TaxRegime } from '@/lib/customs/levies';
import {
  DEFAULT_STATE, bandsBetween, parseSimState, serializeSimState, toSimulationInput, vehicleKindOf, type SimState,
} from '@/lib/customs/simulatorState';
import { CustomsShell, StepTitle, type CustomsVariant } from './shared';
import { ratePct, xaf } from './format';
import { ProductPicker } from './components/ProductPicker';
import { SimulationResult } from './components/SimulationResult';
import { CodeNotices } from './components/CodeNotices';
import { lineTitle, rateLabel } from './components/lineText';

const CURRENCIES: Currency[] = ['CNY', 'USD', 'EUR', 'XAF'];
const INCOTERMS: Incoterm[] = ['EXW', 'FOB', 'CFR', 'CIF'];
const REGIMES: TaxRegime[] = ['reel', 'simplifie', 'hors_fichier', 'exonere'];
const YEAR = new Date().getFullYear();

/** Le taux TEC à appliquer pour un état donné, ou null s'il faut le demander. */
function dutyFor(line: TariffLine, chosen: number | null): number | null {
  if (chosen != null) return chosen;
  return defaultRate(line);
}

function run(state: SimState, line: TariffLine | null, chosenDuty: number | null): Simulation | null {
  if (!line) return null;
  const duty = dutyFor(line, chosenDuty);
  if (duty == null) return null;
  const input = toSimulationInput(state, line.code, duty, YEAR);
  return input ? simulate(input) : null;
}

export function TariffSimulatorPage({ variant = 'client', desktop = false }: { variant?: CustomsVariant; desktop?: boolean } = {}) {
  const { t, i18n } = useTranslation('customs');
  const lang = (i18n.language?.slice(0, 2) ?? 'fr') as 'fr' | 'en' | 'zh';
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: nom, isLoading, isError, refetch } = useCustomsNomenclature();
  const [params, setParams] = useSearchParams();
  const [state, setState] = useState<SimState>(() => parseSimState(params));
  const [picking, setPicking] = useState<'main' | 'compare' | null>(null);
  const set = <K extends keyof SimState>(k: K, v: SimState[K]) => setState((s) => ({ ...s, [k]: v }));

  // L'URL suit le formulaire (sans empiler l'historique).
  useEffect(() => {
    const id = window.setTimeout(() => setParams(serializeSimState(state), { replace: true }), 400);
    return () => window.clearTimeout(id);
  }, [state, setParams]);

  const line = nom && state.code ? nom.byCode.get(state.code) ?? null : null;
  const compareLine = nom && state.compare ? nom.byCode.get(state.compare) ?? null : null;
  const sim = useMemo(() => run(state, line, state.duty), [state, line]);
  const compareSim = useMemo(() => run(state, compareLine, null), [state, compareLine]);

  const base = variant === 'admin' ? '/m/douane' : '/douane';
  const shell = (children: React.ReactNode) => (
    <CustomsShell title={t('sim.title')} subtitle={t('sim.subtitle')} backTo={base} variant={variant} desktop={desktop}>
      {children}
    </CustomsShell>
  );

  if (isLoading) return shell(<ScreenLoader label={t('sim.loading')} />);
  if (isError || !nom) return shell(<ScreenError title={t('sim.loadError')} onRetry={() => { void refetch(); }} />);

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

  return shell(
    <div className="px-4 pb-12 pt-3 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,440px)] lg:items-start lg:gap-8">
      <div className="space-y-7">
        {/* 1. Le produit */}
        <section className="space-y-3">
          <StepTitle n={1}>{t('sim.step1')}</StepTitle>
          {line && picking !== 'main' ? (
            <SelectedProduct nom={nom} line={line} lang={lang} chosen={state.duty} onChoose={(d) => set('duty', d)} onChange={() => setPicking('main')} />
          ) : (
            <ProductPicker nom={nom} onPick={pick} autoFocus={!state.code} />
          )}
        </section>

        {/* 2. Le prix */}
        <section className="space-y-3">
          <StepTitle n={2}>{t('sim.step2')}</StepTitle>
          <FormField label={t('sim.amount')} htmlFor="sim-amount">
            <TextInput
              id="sim-amount" inputMode="decimal" value={state.amount} placeholder="100 000"
              onChange={(e) => set('amount', e.target.value.replace(/[^\d\s.,]/g, ''))}
              className="h-12 text-[20px] font-semibold tabular-nums"
            />
          </FormField>
          <Segmented
            options={CURRENCIES.map((c) => ({ value: c, label: c }))}
            value={state.currency}
            onChange={(c) => setState((s) => ({ ...s, currency: c, xaf: String(DEFAULT_XAF_PER[c]) }))}
          />
          {state.currency !== 'XAF' && (
            <FormField label={t('sim.xafPer', { cur: state.currency })} htmlFor="sim-xaf" hint={t('sim.xafHint')}>
              <TextInput id="sim-xaf" inputMode="decimal" value={state.xaf} onChange={(e) => set('xaf', e.target.value.replace(/[^\d.,]/g, ''))} className="tabular-nums" />
            </FormField>
          )}
        </section>

        {/* 3. L'incoterm, le fret, l'assurance */}
        <section className="space-y-3">
          <StepTitle n={3}>{t('sim.step3')}</StepTitle>
          <Segmented options={INCOTERMS.map((v) => ({ value: v, label: v }))} value={state.incoterm} onChange={(v) => set('incoterm', v)} />
          <Line className={TEXT.muted}>{t(`sim.incoterm.${state.incoterm}`)}</Line>
          {(state.incoterm === 'EXW' || state.incoterm === 'FOB') && (
            <FormField label={t('sim.freight')} htmlFor="sim-freight" hint={t('sim.freightHint')}>
              <TextInput id="sim-freight" inputMode="numeric" value={state.freight} onChange={(e) => set('freight', e.target.value.replace(/[^\d\s]/g, ''))} placeholder="900 000" className="tabular-nums" />
            </FormField>
          )}
          {state.incoterm !== 'CIF' && (
            <FormField label={t('sim.insurance')} htmlFor="sim-ins" hint={t('sim.insuranceHint')}>
              <TextInput id="sim-ins" inputMode="numeric" value={state.insurance} onChange={(e) => set('insurance', e.target.value.replace(/[^\d\s]/g, ''))} className="tabular-nums" />
            </FormField>
          )}
        </section>

        {/* 4. La situation : fiscale, et ce que le code demande de plus */}
        <section className="space-y-3">
          <StepTitle n={4}>{t('sim.step4')}</StepTitle>
          <div className="grid grid-cols-2 gap-2">
            {REGIMES.map((r) => (
              <Chip key={r} label={t(`sim.regime.${r}`)} active={state.regime === r} onClick={() => set('regime', r)} className="h-auto min-h-11 whitespace-normal py-2 text-left" />
            ))}
          </div>
          <Line className={TEXT.muted}>{t('sim.regimeHint')}</Line>
          {line && <SituationExtras code={line.code} state={state} set={set} />}
        </section>
      </div>

      {/* Le résultat — collant à droite sur grand écran. */}
      <aside className="mt-8 space-y-4 lg:sticky lg:top-6 lg:mt-0">
        {!sim || !line ? (
          <Card className={cn('p-5', SURFACE.inset)}>
            <Line className={TEXT.muted}>{t('sim.empty')}</Line>
          </Card>
        ) : (
          <>
            <SimulationResult sim={sim} tariff={line} />
            <CodeNotices code={line.code} variant={variant} />

            {/* Comparer deux codes : la version camerounaise du « comparer les origines » de Flexport. */}
            <Card className="space-y-3">
              <h3 className={cn('flex items-center gap-2', TYPE.bodyStrong, TEXT.strong)}>
                <Scale aria-hidden className="h-5 w-5" /> {t('sim.compareTitle')}
              </h3>
              {picking === 'compare' ? (
                <>
                  <p className={cn(TYPE.small, TEXT.muted)}>{t('sim.comparePick')}</p>
                  <ProductPicker nom={nom} onPick={pick} exclude={line.code} autoFocus inputId="customs-compare" />
                </>
              ) : compareLine && compareSim ? (
                <CompareBlock nom={nom} lang={lang} a={{ line, sim }} b={{ line: compareLine, sim: compareSim }} onRemove={() => set('compare', null)} />
              ) : (
                <Button variant="neutral" className="w-full" onClick={() => setPicking('compare')}>{t('sim.compareCta')}</Button>
              )}
            </Card>

            <div className="flex flex-col gap-2 sm:flex-row">
              <Button variant="neutral" className="flex-1" onClick={() => { void share(); }}>
                <Share2 aria-hidden /> {t('sim.shareCta')}
              </Button>
              <Button variant="subtle" className="flex-1" onClick={() => { setState(DEFAULT_STATE); setPicking('main'); }}>
                <RotateCcw aria-hidden /> {t('sim.reset')}
              </Button>
            </div>
            {variant === 'client' && (
              <Button className="w-full" onClick={() => navigate(user ? '/payments/new' : '/auth')}>{t('sim.payCta')}</Button>
            )}
          </>
        )}
      </aside>
    </div>,
  );
}

function SelectedProduct({
  nom, line, lang, chosen, onChoose, onChange,
}: {
  nom: Nomenclature;
  line: TariffLine;
  lang: 'fr' | 'en' | 'zh';
  chosen: number | null;
  onChoose: (rate: number | null) => void;
  onChange: () => void;
}) {
  const { t } = useTranslation('customs');
  const ctx = lineContext(nom, line.code);
  const bands = bandsBetween(line.rateMin, line.rateMax);
  const current = chosen ?? defaultRate(line);
  return (
    <Card className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className={cn('text-[22px] font-semibold tabular-nums', TEXT.strong)}>{formatHs(line.code)}</p>
          <p className={cn('mt-1 text-[16px] leading-snug', TEXT.body)}>{lineTitle(nom, line, lang)}</p>
          {ctx.chapter && (
            <p className={cn('mt-1 text-[14px] leading-snug', TEXT.muted)}>
              {t('sim.headingOf', { code: formatHs(line.code.slice(0, 4)) })} · {lang === 'en' ? ctx.chapter.en : ctx.chapter.fr}
            </p>
          )}
        </div>
        <Button size="sm" variant="neutral" onClick={onChange} className="shrink-0 px-3">{t('sim.change')}</Button>
      </div>

      <div className={cn('rounded-lg px-3 py-2.5', SURFACE.inset)}>
        <p className={cn(TYPE.bodyStrong, TEXT.strong)}>
          {line.rateMax == null
            ? t('sim.rateUnknown')
            : line.rateMin !== line.rateMax
              ? t('sim.rateRange', { min: line.rateMin, max: line.rateMax })
              : t('sim.rate', { rate: line.rateMax })}
        </p>
        {line.rateHow != null && line.rateHow > 0 && <p className={cn(TYPE.small, TEXT.muted)}>{t('sim.rateInferred')}</p>}
      </div>

      {bands.length > 1 && (
        <div className="space-y-2">
          <p className={cn(TYPE.small, TEXT.muted)}>{t('sim.rateChoose')}</p>
          <div className="flex flex-wrap gap-2">
            {bands.map((b) => (
              <Chip key={b} label={`${b} %`} active={current === b} onClick={() => onChoose(b === line.rateMax ? null : b)} />
            ))}
          </div>
        </div>
      )}
      {line.rateMax == null && (
        <FormField label={t('sim.rateManual')} htmlFor="sim-duty">
          <TextInput
            id="sim-duty" inputMode="decimal" value={chosen == null ? '' : String(chosen)}
            onChange={(e) => { const n = Number(e.target.value.replace(',', '.')); onChoose(e.target.value === '' || !Number.isFinite(n) ? null : Math.min(100, Math.max(0, n))); }}
            className="tabular-nums"
          />
        </FormField>
      )}
      {/* Pour le résumé de la ligne dans un partage, le taux s'écrit aussi en clair. */}
      <span className="sr-only">{rateLabel(line)}</span>
    </Card>
  );
}

/** Ce que le code demande de plus : le véhicule, l'hydroquinone, l'usage agricole, le poids. */
function SituationExtras({ code, state, set }: { code: string; state: SimState; set: <K extends keyof SimState>(k: K, v: SimState[K]) => void }) {
  const { t } = useTranslation('customs');
  const kind = vehicleKindOf(code);
  const agriMatters = vatExemption(code, false).exempt === 'maybe' && vatExemption(code, true).exempt === 'yes' && kind !== 'tractor';
  return (
    <div className="space-y-4">
      {(kind === 'car' || kind === 'utility' || kind === 'tractor') && (
        <Card className="space-y-3">
          <h3 className={cn(TYPE.bodyStrong, TEXT.strong)}>{t('sim.vehicleTitle')}</h3>
          <Segmented
            options={[{ value: 'new', label: t('sim.vehicleNew') }, { value: 'used', label: t('sim.vehicleUsed') }]}
            value={state.used ? 'used' : 'new'}
            onChange={(v) => set('used', v === 'used')}
          />
          {state.used && (
            <FormField label={t('sim.vehicleYear')} htmlFor="sim-year" hint={t('sim.vehicleYearHint')}>
              <TextInput id="sim-year" inputMode="numeric" maxLength={4} value={state.year} onChange={(e) => set('year', e.target.value.replace(/\D/g, ''))} placeholder="2016" className="tabular-nums" />
            </FormField>
          )}
          {kind === 'car' && (
            <FormField label={t('sim.vehicleCc')} htmlFor="sim-cc" hint={t('sim.vehicleCcHint')}>
              <TextInput id="sim-cc" inputMode="numeric" value={state.cc} onChange={(e) => set('cc', e.target.value.replace(/\D/g, ''))} placeholder="1 998" className="tabular-nums" />
            </FormField>
          )}
          {kind === 'tractor' && (
            <Chip label={t('sim.tractorAgricultural')} active={state.agricultural} onClick={() => set('agricultural', !state.agricultural)} className="w-full justify-center" />
          )}
        </Card>
      )}
      {code.startsWith('33') && (
        <Chip label={t('sim.hydroquinone')} active={state.hydroquinone} onClick={() => set('hydroquinone', !state.hydroquinone)} className="h-auto min-h-11 w-full whitespace-normal py-2" />
      )}
      {agriMatters && (
        <Chip label={t('sim.agriUse')} active={state.agriUse} onClick={() => set('agriUse', !state.agriUse)} className="h-auto min-h-11 w-full whitespace-normal py-2" />
      )}
      {needsWeight(code) && (
        <FormField label={t('sim.weight')} htmlFor="sim-weight" hint={t('sim.weightHint')}>
          <TextInput id="sim-weight" inputMode="numeric" value={state.weight} onChange={(e) => set('weight', e.target.value.replace(/[^\d\s]/g, ''))} className="tabular-nums" />
        </FormField>
      )}
    </div>
  );
}

function CompareBlock({
  nom, lang, a, b, onRemove,
}: {
  nom: Nomenclature;
  lang: 'fr' | 'en' | 'zh';
  a: { line: TariffLine; sim: Simulation };
  b: { line: TariffLine; sim: Simulation };
  onRemove: () => void;
}) {
  const { t } = useTranslation('customs');
  const delta = b.sim.dau.total - a.sim.dau.total;
  const code = formatHs(b.line.code);
  const rows: [string, (s: Simulation, l: TariffLine) => string][] = [
    [t('levy.DDI', { defaultValue: 'Droit de douane' }), (s) => `${s.dau.lines.find((x) => x.code === 'DDI')?.rate ?? 0} %`],
    [t('levy.DAC', { defaultValue: "Droit d'accises" }), (s) => `${s.excise.rate} %`],
    [t('levy.TVA', { defaultValue: 'TVA' }), (s) => (s.vat.exempt === 'yes' ? t('sim.exempt') : ratePct(19.25))],
    [t('sim.total'), (s) => xaf(s.dau.total)],
  ];
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-x-3 gap-y-1.5 text-[15px]">
        <span />
        <span className={cn('text-right font-semibold tabular-nums', TEXT.strong)}>{formatHs(a.line.code)}</span>
        <span className={cn('text-right font-semibold tabular-nums', TEXT.strong)}>{code}</span>
        {rows.map(([label, f]) => (
          <div key={label} className="contents">
            <span className={TEXT.muted}>{label}</span>
            <span className={cn('text-right tabular-nums', TEXT.body)}>{f(a.sim, a.line)}</span>
            <span className={cn('text-right tabular-nums', TEXT.body)}>{f(b.sim, b.line)}</span>
          </div>
        ))}
      </div>
      <p className={cn(TYPE.small, TEXT.muted)}>{lineTitle(nom, b.line, lang)}</p>
      <Line tone={delta > 0 ? 'bad' : delta < 0 ? 'good' : undefined}>
        {delta > 0
          ? t('sim.compareMore', { code, amount: xaf(delta) })
          : delta < 0
            ? t('sim.compareLess', { code, amount: xaf(-delta) })
            : t('sim.compareSame', { code })}
      </Line>
      <Button size="sm" variant="subtle" onClick={onRemove}><X aria-hidden /> {t('sim.compareRemove')}</Button>
    </div>
  );
}

export default TariffSimulatorPage;
