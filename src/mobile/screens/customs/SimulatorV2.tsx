/**
 * Simulateur de droits — refonte v2 (maquettes 06/10 et 06/11).
 * Écran 1 : le produit (Changer), le montant au gros clavier, la devise, la
 * conversion ; « Calculer ». Le reste du calcul — taux XAF, incoterm, fret,
 * assurance, régime, taux TEC, véhicule… — dans « … ».
 * Écran 2 : ce qu'on paie à la douane, ligne par ligne ; l'avis lié au code ;
 * Partager, Comparer avec un autre code ; « … » : le détail complet, Recommencer.
 * Même moteur et même état qu'avant (simulate, SimState dans l'URL).
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Calculator, FileText, Package, RotateCcw, Scale, X } from 'lucide-react';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { useCustomsNomenclature } from '@/hooks/useCustomsNomenclature';
import { useAdminNotices } from '@/hooks/useCustomsReview';
import { copyToClipboard } from '@/lib/clipboard';
import { simulate, needsWeight, DEFAULT_XAF_PER, type Currency, type Incoterm, type Simulation } from '@/lib/customs/engine';
import { formatHs } from '@/lib/customs/hsCode';
import type { TaxRegime } from '@/lib/customs/levies';
import { defaultRate, type Nomenclature, type TariffLine } from '@/lib/customs/nomenclature';
import { noticeMatchesCode, phaseOf } from '@/lib/customs/notices';
import {
  DEFAULT_STATE, bandsBetween, num, parseSimState, serializeSimState, toSimulationInput, vehicleKindOf, type SimState,
} from '@/lib/customs/simulatorState';
import { vatExemption } from '@/lib/customs/vatExempt';
import { cn } from '@/lib/utils';
import { ProductPicker } from '@/pages/customs/components/ProductPicker';
import { lineTitle } from '@/pages/customs/components/lineText';
import { SimResult } from '@/pages/customs/site/simulator/Result';
import { useLevyLabel } from '@/pages/customs/useCustomsText';
import {
  ActionSheet, AmountDisplay, BigButton, BottomSheet, Dock, EmptyLine, FOCUS_RING, IconCircle, ItemRow, Keypad, KVBox, MoreButton, ScreenLoader,
  ScreenTop, SURFACE, TabTop, TEXT, TextInput, applyKey, formatPad, useSheet, type PadKey,
} from '@/mobile/designKit';
import { BIG_FIELD, FieldBlock, Switch } from '@/mobile/screens/more/parts';
import { nb } from './shared';

const YEAR = new Date().getFullYear();
const CURRENCY_UNITS: { value: Currency; label: string }[] = [
  { value: 'CNY', label: '¥ RMB' }, { value: 'USD', label: 'USD' }, { value: 'EUR', label: 'EUR' }, { value: 'XAF', label: 'XAF' },
];
const PREFIX: Record<Currency, string | undefined> = { CNY: '¥', USD: '$', EUR: '€', XAF: undefined };
const INCOTERMS: Incoterm[] = ['EXW', 'FOB', 'CFR', 'CIF'];
const REGIMES: { value: TaxRegime; label: string }[] = [
  { value: 'reel', label: 'Régime du réel' }, { value: 'simplifie', label: 'Régime simplifié' },
  { value: 'hors_fichier', label: 'Hors fichier (sans NIU)' }, { value: 'exonere', label: 'Exonéré' },
];
const pct = (r: number | null) => (r == null ? '' : `${r.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} %`);

function run(state: SimState, line: TariffLine | null, chosenDuty: number | null): Simulation | null {
  if (!line) return null;
  const duty = chosenDuty ?? defaultRate(line);
  if (duty == null) return null;
  const input = toSimulationInput(state, line.code, duty, YEAR);
  return input ? simulate(input) : null;
}

export function SimulatorV2() {
  const { data: nom, isLoading, isError, refetch } = useCustomsNomenclature();
  const { currentUser } = useAdminAuth();
  const broker = currentUser?.role === 'customs_broker';
  if (isLoading) return <>{broker ? <TabTop title="Simulateur" /> : <ScreenTop title="Simulateur" backTo="/m/douane" />}<ScreenLoader /></>;
  if (isError || !nom) {
    return (
      <>
        {broker ? <TabTop title="Simulateur" /> : <ScreenTop title="Simulateur" backTo="/m/douane" />}
        <EmptyLine action={{ label: 'Réessayer', onClick: () => void refetch() }}>Le tarif n'a pas pu être chargé.</EmptyLine>
      </>
    );
  }
  return <Simulator nom={nom} broker={broker} />;
}

function Simulator({ nom, broker }: { nom: Nomenclature; broker: boolean }) {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [state, setState] = useState<SimState>(() => parseSimState(params));
  const [step, setStep] = useState<'amount' | 'result'>('amount');
  const set = <K extends keyof SimState>(k: K, v: SimState[K]) => setState((s) => ({ ...s, [k]: v }));
  useEffect(() => {
    const id = window.setTimeout(() => setParams(serializeSimState(state), { replace: true }), 400);
    return () => window.clearTimeout(id);
  }, [state, setParams]);

  const line = state.code ? nom.byCode.get(state.code) ?? null : null;
  const compareLine = state.compare ? nom.byCode.get(state.compare) ?? null : null;
  const sim = useMemo(() => run(state, line, state.duty), [state, line]);
  const compareSim = useMemo(() => run(state, compareLine, null), [state, compareLine]);

  const picker = useSheet();
  const [picking, setPicking] = useState<'main' | 'compare'>('main');
  const pick = (l: TariffLine) => {
    if (picking === 'compare') set('compare', l.code);
    else setState((s) => ({ ...s, code: l.code, duty: null, compare: s.compare === l.code ? null : s.compare }));
    picker.hide();
  };
  const openPicker = (what: 'main' | 'compare') => { setPicking(what); picker.show(); };

  const share = async () => {
    const url = `${window.location.origin}/douane/simulateur?${serializeSimState(state)}`;
    if (navigator.share) {
      try { await navigator.share({ title: 'Estimation des droits de douane', url }); return; } catch { /* annulé : on copie */ }
    }
    await copyToClipboard(url, 'Lien de la simulation');
  };
  const reset = () => { setState(DEFAULT_STATE); setStep('amount'); };

  const pickerSheet = (
    <BottomSheet open={picker.open} onClose={picker.hide} title={picking === 'compare' ? 'Comparer avec' : 'Le produit'}>
      <ProductPicker nom={nom} onPick={pick} exclude={picking === 'compare' ? state.code : null} inputId="sim-search" />
    </BottomSheet>
  );

  if (step === 'result' && sim && line) {
    return (
      <>
        <ResultStep nom={nom} line={line} sim={sim} state={state} compareLine={compareLine} compareSim={compareSim}
          onBack={() => setStep('amount')} onShare={() => void share()} onCompare={() => openPicker('compare')}
          onRemoveCompare={() => set('compare', null)} onReset={reset} onNotice={(slug) => navigate(`/m/douane/veille#${slug}`)} />
        {pickerSheet}
      </>
    );
  }
  return (
    <>
      <AmountStep nom={nom} line={line} state={state} setState={setState} broker={broker} onPick={() => openPicker('main')}
        onCalculate={() => sim && setStep('result')} canCalculate={!!sim} onReset={reset} />
      {pickerSheet}
    </>
  );
}

function AmountStep({
  nom, line, state, setState, broker, onPick, onCalculate, canCalculate, onReset,
}: {
  nom: Nomenclature;
  line: TariffLine | null;
  state: SimState;
  setState: React.Dispatch<React.SetStateAction<SimState>>;
  broker: boolean;
  onPick: () => void;
  onCalculate: () => void;
  canCalculate: boolean;
  onReset: () => void;
}) {
  const more = useSheet();
  const incoterm = useSheet();
  const regime = useSheet();
  const duty = useSheet();
  const field = useSheet();
  const extras = useSheet();
  const [editing, setEditing] = useState<{ key: 'xaf' | 'freight' | 'insurance'; label: string; unit: string } | null>(null);
  const [draft, setDraft] = useState('');
  const set = <K extends keyof SimState>(k: K, v: SimState[K]) => setState((s) => ({ ...s, [k]: v }));

  // La saisie : chiffres et une virgule (au plus deux décimales), comme au clavier de Wave.
  const pad = state.amount.replace('.', ',');
  const onKey = (k: PadKey) => set('amount', applyKey(pad, k, 2, 12));
  const amount = num(state.amount);
  const xafRate = state.currency === 'XAF' ? 1 : num(state.xaf);
  const converted = amount != null && xafRate != null && state.currency !== 'XAF' ? `= ${nb(amount * xafRate)} XAF` : undefined;
  const bands = line ? bandsBetween(line.rateMin, line.rateMax) : [];
  const kind = vehicleKindOf(state.code);
  const hasExtras = !!state.code && (kind === 'car' || kind === 'utility' || kind === 'tractor' || state.code.startsWith('33') || needsWeight(state.code)
    || (vatExemption(state.code, false).exempt === 'maybe' && vatExemption(state.code, true).exempt === 'yes'));

  const openField = (key: 'xaf' | 'freight' | 'insurance', label: string, unit: string) => {
    setEditing({ key, label, unit });
    setDraft(state[key]);
    field.show();
  };

  const header = broker
    ? <TabTop title="Simulateur" right={<MoreButton bordered onClick={more.show} />} />
    : <ScreenTop title="Simulateur" backTo="/m/douane" right={<MoreButton onClick={more.show} />} />;

  return (
    <div className="flex min-h-full flex-col">
      {header}
      <div className="px-5 pt-3">
        <div className={cn('flex items-center gap-3.5 rounded-lg border px-4 py-3.5', SURFACE.divider)}>
          <IconCircle icon={Package} />
          <span className="min-w-0 flex-1">
            <span className={cn('block truncate text-[18px] font-semibold', TEXT.strong)}>{line ? lineTitle(nom, line, 'fr') : 'Choisir le produit'}</span>
            <span className={cn('block truncate text-[16px] tabular-nums', TEXT.muted)}>
              {line ? [formatHs(line.code), state.incoterm, pct(state.duty ?? defaultRate(line))].filter(Boolean).join(' · ') : 'Code SH, mot du marché'}
            </span>
          </span>
          <button type="button" onClick={onPick} className={cn('h-11 shrink-0 rounded text-[17px] font-semibold underline underline-offset-[3px]', FOCUS_RING, TEXT.strong)}>
            {line ? 'Changer' : 'Choisir'}
          </button>
        </div>
      </div>

      <AmountDisplay
        value={formatPad(pad)}
        prefix={PREFIX[state.currency]}
        suffix={state.currency === 'XAF' ? 'XAF' : undefined}
        units={CURRENCY_UNITS}
        unit={state.currency}
        onUnit={(u) => setState((s) => ({ ...s, currency: u as Currency, xaf: String(DEFAULT_XAF_PER[u as Currency]) }))}
        conversion={converted}
      />
      <div className="flex-1" />
      <Keypad onKey={onKey} decimals={2} className="pb-2 pt-6" />
      <Dock>
        <BigButton onClick={onCalculate} disabled={!canCalculate}>Calculer</BigButton>
      </Dock>

      <ActionSheet
        open={more.open}
        onClose={more.hide}
        actions={[
          { label: 'Taux XAF', hint: state.currency === 'XAF' ? undefined : `1 ${state.currency} = ${state.xaf} XAF`, icon: Calculator, onClick: () => openField('xaf', `XAF pour 1 ${state.currency}`, 'XAF'), hidden: state.currency === 'XAF' },
          { label: 'Ce que comprend le prix', hint: state.incoterm, icon: FileText, onClick: incoterm.show },
          { label: 'Fret', hint: state.freight ? `${state.freight} XAF` : 'estimé', icon: FileText, onClick: () => openField('freight', 'Fret (XAF)', 'XAF'), hidden: !(state.incoterm === 'EXW' || state.incoterm === 'FOB') },
          { label: 'Assurance', hint: state.insurance ? `${state.insurance} XAF` : 'estimée', icon: FileText, onClick: () => openField('insurance', 'Assurance (XAF)', 'XAF'), hidden: state.incoterm === 'CIF' },
          { label: 'Régime', hint: REGIMES.find((r) => r.value === state.regime)?.label, icon: Scale, onClick: regime.show },
          { label: 'Taux du droit', hint: pct(state.duty ?? (line ? defaultRate(line) : null)), icon: Scale, onClick: duty.show, hidden: bands.length < 2 },
          { label: 'Autres précisions', icon: FileText, onClick: extras.show, hidden: !hasExtras },
          { label: 'Recommencer', icon: RotateCcw, onClick: onReset },
        ]}
      />
      <ActionSheet open={incoterm.open} onClose={incoterm.hide} title="Le prix comprend" actions={INCOTERMS.map((v) => ({
        label: v, hint: v === 'EXW' ? 'Départ usine' : v === 'FOB' ? 'Chargé au port de Chine' : v === 'CFR' ? 'Fret compris' : 'Fret et assurance compris', onClick: () => set('incoterm', v),
      }))} />
      <ActionSheet open={regime.open} onClose={regime.hide} title="Régime" actions={REGIMES.map((r) => ({ label: r.label, onClick: () => set('regime', r.value) }))} />
      <ActionSheet open={duty.open} onClose={duty.hide} title="Taux du droit" actions={bands.map((b) => ({ label: `${b} %`, onClick: () => set('duty', line && b === line.rateMax ? null : b) }))} />
      <BottomSheet open={field.open} onClose={field.hide} title={editing?.label}>
        <div className="flex items-center gap-3">
          <TextInput aria-label={editing?.label} inputMode="decimal" value={draft} onChange={(e) => setDraft(e.target.value.replace(/[^\d.,\s]/g, ''))} className={cn(BIG_FIELD, 'tabular-nums')} />
          <span className={cn('text-[18px] font-semibold', TEXT.muted)}>{editing?.unit}</span>
        </div>
        <BigButton className="mt-5" onClick={() => { if (editing) set(editing.key, draft); field.hide(); }}>Enregistrer</BigButton>
      </BottomSheet>
      <BottomSheet open={extras.open} onClose={extras.hide} title="Autres précisions">
        <div className="space-y-5">
          {(kind === 'car' || kind === 'utility' || kind === 'tractor') && (
            <>
              <ToggleRow label="Véhicule d'occasion" checked={state.used} onChange={(v) => set('used', v)} />
              {state.used && (
                <FieldBlock label="Première immatriculation" htmlFor="sim-year">
                  <TextInput id="sim-year" inputMode="numeric" maxLength={4} placeholder="2016" value={state.year} onChange={(e) => set('year', e.target.value.replace(/\D/g, ''))} className={BIG_FIELD} />
                </FieldBlock>
              )}
              {kind === 'car' && (
                <FieldBlock label="Cylindrée (cm³)" htmlFor="sim-cc">
                  <TextInput id="sim-cc" inputMode="numeric" placeholder="1 998" value={state.cc} onChange={(e) => set('cc', e.target.value.replace(/\D/g, ''))} className={BIG_FIELD} />
                </FieldBlock>
              )}
              {kind === 'tractor' && <ToggleRow label="Tracteur agricole" checked={state.agricultural} onChange={(v) => set('agricultural', v)} />}
            </>
          )}
          {state.code?.startsWith('33') && <ToggleRow label="Contient de l'hydroquinone" checked={state.hydroquinone} onChange={(v) => set('hydroquinone', v)} />}
          {state.code && vatExemption(state.code, false).exempt === 'maybe' && vatExemption(state.code, true).exempt === 'yes' && kind !== 'tractor' && (
            <ToggleRow label="Usage agricole" checked={state.agriUse} onChange={(v) => set('agriUse', v)} />
          )}
          {state.code && needsWeight(state.code) && (
            <FieldBlock label="Poids net (kg)" htmlFor="sim-weight">
              <TextInput id="sim-weight" inputMode="numeric" value={state.weight} onChange={(e) => set('weight', e.target.value.replace(/[^\d\s]/g, ''))} className={BIG_FIELD} />
            </FieldBlock>
          )}
          <BigButton onClick={extras.hide}>Terminé</BigButton>
        </div>
      </BottomSheet>
    </div>
  );
}

function ToggleRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className={cn('flex items-center justify-between gap-4 border-b py-2', SURFACE.divider)}>
      <span className={cn('text-[17px]', TEXT.strong)}>{label}</span>
      <Switch label={label} checked={checked} onChange={onChange} />
    </div>
  );
}

function ResultStep({
  nom, line, sim, state, compareLine, compareSim, onBack, onShare, onCompare, onRemoveCompare, onReset, onNotice,
}: {
  nom: Nomenclature;
  line: TariffLine;
  sim: Simulation;
  state: SimState;
  compareLine: TariffLine | null;
  compareSim: Simulation | null;
  onBack: () => void;
  onShare: () => void;
  onCompare: () => void;
  onRemoveCompare: () => void;
  onReset: () => void;
  onNotice: (slug: string) => void;
}) {
  const label = useLevyLabel();
  const notices = useAdminNotices(true);
  const more = useSheet();
  const detail = useSheet();
  const hits = (notices.data ?? []).filter((n) => n.published && n.kind === 'regulation' && phaseOf(n) !== 'past' && noticeMatchesCode(n, line.code));
  const outside = sim.outside.reduce((n, l) => n + l.amount, 0);
  const rows = [
    { label: 'Valeur CAF', value: nb(sim.customsValue) },
    ...sim.dau.lines.map((l) => ({ label: `${label(l)}${l.rate != null ? ` ${pct(l.rate)}` : ''}`, value: nb(l.amount) })),
    ...(outside > 0 ? [{ label: 'Avec PVI, précompte…', value: nb(sim.totalToPay) }] : []),
  ];
  const delta = compareSim ? compareSim.dau.total - sim.dau.total : 0;

  return (
    <div className="flex min-h-full flex-col">
      <ScreenTop title="Résultat" onBack={onBack} right={<MoreButton onClick={more.show} />} />
      <div className="px-5 pb-28 pt-6">
        <div className="flex justify-center"><IconCircle icon={Package} size="lg" /></div>
        <div className={cn('mt-4 text-center text-[52px] font-bold leading-none tracking-[-0.03em] tabular-nums', TEXT.strong)}>{nb(sim.dau.total)}</div>
        <p className={cn('mt-2 text-center text-[17px]', TEXT.muted)}>XAF à payer à la douane</p>
        <p className={cn('mt-1 text-center text-[16px] tabular-nums', TEXT.muted)}>{formatHs(line.code)} · {lineTitle(nom, line, 'fr')}</p>
        <KVBox rows={rows} className="mt-6" />

        {hits.length > 0 && (
          <div className="mt-2">
            <ItemRow
              title={`${hits.length} avis sur ce code`}
              subtitle={hits[0].title}
              tag={{ tone: 'pending', label: 'À lire' }}
              chevron
              onClick={() => onNotice(hits[0].slug)}
            />
          </div>
        )}

        {compareLine && compareSim && (
          <div className="mt-6">
            <div className="flex items-center justify-between gap-3">
              <h3 className={cn('text-[20px] font-semibold', TEXT.strong)}>Avec {formatHs(compareLine.code)}</h3>
              <button type="button" onClick={onRemoveCompare} aria-label="Retirer la comparaison" className={cn('flex h-11 w-11 items-center justify-center rounded-full', FOCUS_RING, TEXT.muted)}><X className="h-5 w-5" /></button>
            </div>
            <KVBox className="mt-2" rows={[
              { label: formatHs(line.code), value: `${nb(sim.dau.total)} XAF` },
              { label: formatHs(compareLine.code), value: `${nb(compareSim.dau.total)} XAF` },
              { label: 'Écart', value: `${delta > 0 ? '+' : ''}${nb(delta)} XAF`, tone: delta > 0 ? 'danger' : delta < 0 ? 'success' : undefined },
            ]} />
            <p className={cn('mt-2 text-[16px]', TEXT.muted)}>{lineTitle(nom, compareLine, 'fr')}</p>
          </div>
        )}
      </div>
      <Dock>
        <BigButton onClick={onShare}>Partager</BigButton>
        <BigButton variant="soft" onClick={onCompare}>Comparer avec un autre code</BigButton>
      </Dock>
      <ActionSheet open={more.open} onClose={more.hide} actions={[
        { label: 'Le détail complet', icon: FileText, onClick: detail.show },
        { label: 'Recommencer', icon: RotateCcw, onClick: onReset },
      ]} />
      <BottomSheet open={detail.open} onClose={detail.hide} title="Le détail">
        {/* Le résultat complet du site Douane (ses styles vivent sous `.dz`). */}
        <div className="dz text-dz-ink"><SimResult sim={sim} tariff={line} admin /></div>
        <p className={cn('mt-3 text-[14px]', TEXT.muted)}>{state.regime === 'reel' ? 'Régime du réel' : REGIMES.find((r) => r.value === state.regime)?.label} · {state.incoterm}</p>
      </BottomSheet>
    </div>
  );
}
