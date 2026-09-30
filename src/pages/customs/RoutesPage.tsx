// ============================================================
// Routes et délais — /douane/routes (public) et /m/douane/routes (équipe).
// L'« Atlas » de Flexport, pour la Chine → le Cameroun (docs/douane/00-plan.md,
// étape 8) : par où passe la marchandise, combien de jours de l'usine à la
// destination, ce que nos propres expéditions ont réellement mis, ce qui
// peut la retarder en ce moment, et ce qu'elle émet — mer contre avion.
//
// Quatre questions (le mode, le départ, la destination, le poids), puis la
// réponse. Tout tient dans l'URL : un trajet se partage tel quel.
// ============================================================
import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ArrowRight, ChevronRight, Factory, FileCheck2, Plane, Share2, Ship, Stamp, TrainFront, Truck, Warehouse, type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatNumber } from '@/lib/formatters';
import { getCurrentLocale } from '@/i18n';
import { copyToClipboard } from '@/lib/clipboard';
import {
  Button, Card, Chip, FormField, Line, Segmented, StatusPill, TextInput, SURFACE, TEXT, TYPE,
} from '@/mobile/designKit';
import {
  AIRPORTS, AIR_ORIGINS, DESTINATIONS, EMISSIONS_SOURCE, SEA_ORIGINS, SEA_PORTS, counterpart, noticesOnRoute, placeLabel, planRoute,
  type Destination, type Leg, type RoutePlan,
} from '@/lib/logistics/atlas';
import {
  canRail, parseRouteState, serializeRouteState, switchMode, weightKg, type RouteState,
} from '@/lib/logistics/routeState';
import { phaseOf, type Notice } from '@/lib/customs/notices';
import { useObservedTransit, type ObservedLane } from '@/hooks/useObservedTransit';
import { useCustomsNotices } from '@/hooks/useCustomsNotices';
import { useAdminNotices } from '@/hooks/useCustomsReview';
import { CustomsShell, ConfidenceDot, StepTitle, type CustomsVariant } from './shared';
import { isSure } from './format';

// La carte (MapLibre) pèse : elle arrive après le reste de la page.
const RouteMap = lazy(() => import('@/components/logistics/RouteMap'));

const ICON: Record<Leg['kind'], LucideIcon> = {
  pickup: Factory, origin_port: Warehouse, sea: Ship, air: Plane, port: FileCheck2, transit: Stamp, road: Truck, rail: TrainFront, final_clearance: FileCheck2,
};
const WEIGHTS = [100, 1000, 5000, 20_000];

const kmText = (km: number) => `${formatNumber(km)} km`;
/** « 314 kg », « 12,4 t » — de CO₂e. */
const co2Text = (kg: number) => (kg < 1000 ? `${formatNumber(kg)} kg` : `${formatNumber(kg / 1000, kg < 100_000 ? 1 : 0)} t`);
const weightText = (kg: number) => (kg < 1000 ? `${formatNumber(kg)} kg` : `${formatNumber(kg / 1000, kg % 1000 ? 1 : 0)} t`);
/** « Guangzhou », « Douala », « 广州 » : la ville seule (l'icône dit déjà port ou aéroport). */
const cityName = (code: string, lang: string) => {
  const place = [...SEA_ORIGINS, ...SEA_PORTS, ...AIR_ORIGINS, ...AIRPORTS].find((p) => p.code === code);
  return place ? placeLabel(place, lang).replace(/\s*[(（].*[)）]$/, '') : code;
};

export function RoutesPage({ variant = 'client', desktop = false }: { variant?: CustomsVariant; desktop?: boolean } = {}) {
  const { t, i18n } = useTranslation('customs');
  const lang = i18n.language ?? 'fr';
  const isAdmin = variant === 'admin';
  const [params, setParams] = useSearchParams();
  const [state, setState] = useState<RouteState>(() => parseRouteState(params));
  const set = <K extends keyof RouteState>(k: K, v: RouteState[K]) => setState((s) => ({ ...s, [k]: v }));

  // L'URL suit le formulaire (sans empiler l'historique).
  useEffect(() => {
    const id = window.setTimeout(() => setParams(serializeRouteState(state), { replace: true }), 400);
    return () => window.clearTimeout(id);
  }, [state, setParams]);

  // Espace équipe : supabaseAdmin seulement (.claude/rules/supabase-clients.md).
  const observedQ = useObservedTransit(isAdmin ? 'admin' : 'public');
  const pubNotices = useCustomsNotices(!isAdmin);
  const admNotices = useAdminNotices(isAdmin);
  const notices = useMemo(() => (isAdmin ? admNotices.data : pubNotices.data) ?? [], [isAdmin, admNotices.data, pubNotices.data]);

  const observed = observedQ.data?.byLane;
  const kg = weightKg(state);
  const plan = useMemo(() => planRoute({
    mode: state.mode, origin: state.origin, destination: state.destination, port: state.port,
    inland: canRail(state) ? state.inland : 'road', weightKg: kg, observed,
  }), [state, kg, observed]);
  const other = useMemo(() => counterpart(plan, observed), [plan, observed]);
  const onRoute = useMemo(() => noticesOnRoute(notices, plan), [notices, plan]);

  const base = isAdmin ? '/m/douane' : '/douane';
  const share = async () => {
    const url = `${window.location.origin}/douane/routes?${serializeRouteState(state)}`;
    if (navigator.share) {
      try { await navigator.share({ title: t('routes.shareText'), url }); return; } catch { /* annulé : on copie */ }
    }
    await copyToClipboard(url, t('routes.linkLabel'));
  };

  const pickLane = (lane: ObservedLane) => {
    const [o, a] = lane.lane.split('>');
    if (lane.mode === 'sea') setState((s) => ({ ...s, mode: 'sea', origin: o, port: a === 'CMDLA' ? 'CMDLA' : 'CMKBI' }));
    else setState((s) => ({ ...s, mode: 'air', origin: o, destination: a === 'NSI' ? 'yaounde' : s.destination === 'yaounde' ? 'douala' : s.destination }));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <CustomsShell title={t('routes.title')} subtitle={t('routes.subtitle')} backTo={base} variant={variant} desktop={desktop}>
      <div className="px-4 pb-12 pt-3 lg:grid lg:grid-cols-[minmax(0,400px)_minmax(0,1fr)] lg:items-start lg:gap-8">
        {/* Les questions */}
        <div className="space-y-7">
          <section className="space-y-3">
            <StepTitle n={1}>{t('routes.step1')}</StepTitle>
            <Segmented
              options={[
                { value: 'sea', label: <><Ship aria-hidden className="h-5 w-5" /> {t('routes.mode.sea')}</> },
                { value: 'air', label: <><Plane aria-hidden className="h-5 w-5" /> {t('routes.mode.air')}</> },
              ]}
              value={state.mode}
              onChange={(m) => setState((s) => switchMode(s, m))}
            />
          </section>

          <section className="space-y-3">
            <StepTitle n={2}>{t(state.mode === 'sea' ? 'routes.step2sea' : 'routes.step2air')}</StepTitle>
            <div className="flex flex-wrap gap-2">
              {(state.mode === 'sea' ? SEA_ORIGINS : AIR_ORIGINS).map((o) => (
                <Chip key={o.code} label={placeLabel(o, lang)} active={state.origin === o.code} onClick={() => set('origin', o.code)} />
              ))}
            </div>
          </section>

          <section className="space-y-3">
            <StepTitle n={3}>{t('routes.step3')}</StepTitle>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(DESTINATIONS) as Destination[]).map((d) => (
                <Chip key={d} label={placeLabel(DESTINATIONS[d], lang)} active={state.destination === d} onClick={() => set('destination', d)} />
              ))}
            </div>
            {state.mode === 'sea' && (
              <FormField label={t('routes.port')} hint={t('routes.portHint')}>
                <Segmented options={SEA_PORTS.map((p) => ({ value: p.code as RouteState['port'], label: placeLabel(p, lang) }))} value={state.port} onChange={(v) => set('port', v)} />
              </FormField>
            )}
            {canRail(state) && (
              <FormField label={t('routes.inland')} hint={t('routes.inlandHint')}>
                <Segmented
                  options={[
                    { value: 'road', label: <><Truck aria-hidden className="h-5 w-5" /> {t('routes.road')}</> },
                    { value: 'rail', label: <><TrainFront aria-hidden className="h-5 w-5" /> {t('routes.rail')}</> },
                  ]}
                  value={state.inland}
                  onChange={(v) => set('inland', v)}
                />
              </FormField>
            )}
          </section>

          <section className="space-y-3">
            <StepTitle n={4}>{t('routes.step4')}</StepTitle>
            <FormField label={t('routes.weight')} htmlFor="route-weight" hint={t('routes.weightHint')}>
              <TextInput
                id="route-weight" inputMode="numeric" value={state.weight} placeholder="1000"
                onChange={(e) => set('weight', e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="h-12 text-[20px] font-semibold tabular-nums"
              />
            </FormField>
            <div className="flex flex-wrap gap-2">
              {WEIGHTS.map((w) => <Chip key={w} label={weightText(w)} active={kg === w} onClick={() => set('weight', String(w))} />)}
            </div>
          </section>
        </div>

        {/* La réponse */}
        <div className="mt-8 space-y-5 lg:mt-0">
          <Card className="overflow-hidden p-0">
            <div className="space-y-1 p-4">
              <p className={cn(TYPE.small, TEXT.muted)}>{t('routes.doorToDoor', { dest: placeLabel(plan.destination, lang) })}</p>
              <p className={cn(TYPE.heading, 'tabular-nums', TEXT.strong)}>{t('routes.daysRange', { from: plan.days[0], to: plan.days[1] })}</p>
              <p className={cn(TYPE.body, TEXT.muted)}>
                {plan.observed
                  ? t(plan.mode === 'sea' ? 'routes.headObservedSea' : 'routes.headObservedAir', { n: plan.observed.n, median: plan.observed.median })
                  : t('routes.headMarket')}
              </p>
            </div>
            <Suspense fallback={<div className={cn('h-56 w-full lg:h-80', SURFACE.inset)} />}>
              <RouteMap plan={plan} lang={lang} focusLabels={{ all: t('routes.mapAll'), arrival: t('routes.mapArrival') }} className={cn('h-56 w-full lg:h-80', SURFACE.inset)} ariaLabel={t('routes.mapLabel', { from: placeLabel(plan.origin, lang), to: placeLabel(plan.destination, lang) })} />
            </Suspense>
            <div className="flex flex-wrap items-center justify-between gap-3 p-4">
              <p className={cn(TYPE.small, TEXT.muted)}>
                {t('routes.distance', { km: kmText(plan.km) })}{kg > 0 && ` · ${t('routes.co2Short', { co2: co2Text(plan.co2eKg) })}`}
              </p>
              <Button size="sm" variant="neutral" onClick={() => { void share(); }}><Share2 aria-hidden /> {t('routes.share')}</Button>
            </div>
          </Card>

          {plan.transit && (
            <Line>{t('routes.transitNote', { country: t(`routes.country.${plan.destination.country}`) })}</Line>
          )}

          <Timeline plan={plan} />

          <RouteNotices notices={onRoute} base={base} />

          <ObservedCard plan={plan} lanes={observedQ.data?.lanes ?? []} months={observedQ.data?.window_months ?? 18}
            min={observedQ.data?.min_count ?? 3} failed={observedQ.isError} onPick={pickLane} />

          <EmissionsCard plan={plan} other={other} kg={kg} />

          <p className={cn(TYPE.small, TEXT.muted)}>{t('routes.sources')}</p>
        </div>
      </div>
    </CustomsShell>
  );
}

// ─── Étape par étape ────────────────────────────────────────────────────────

function Timeline({ plan }: { plan: RoutePlan }) {
  const { t } = useTranslation('customs');
  let lo = 0, hi = 0;
  return (
    <Card className="space-y-1 p-4">
      <h2 className={cn(TYPE.lead, TEXT.strong)}>{t('routes.stepsTitle')}</h2>
      <p className={cn(TYPE.small, TEXT.muted)}>{t('routes.stepsHint')}</p>
      <ol className="pt-3">
        {plan.legs.map((leg, i) => {
          lo += leg.days[0]; hi += leg.days[1];
          return <LegRow key={`${leg.kind}-${i}`} leg={leg} mode={plan.mode} end={[lo, hi]} last={i === plan.legs.length - 1} />;
        })}
      </ol>
    </Card>
  );
}

function LegRow({ leg, mode, end, last }: { leg: Leg; mode: RoutePlan['mode']; end: [number, number]; last: boolean }) {
  const { t, i18n } = useTranslation('customs');
  const lang = i18n.language ?? 'fr';
  const Icon = ICON[leg.kind];
  const key = leg.kind === 'pickup' || leg.kind === 'port' || leg.kind === 'transit' ? `${leg.kind}_${mode}` : leg.kind;
  const vars = { from: leg.from ? placeLabel(leg.from, lang) : '', to: placeLabel(leg.to, lang), via: leg.via ?? '' };
  const facts = [leg.km > 0 ? kmText(leg.km) : null, leg.co2eKg > 0 ? t('routes.co2Short', { co2: co2Text(leg.co2eKg) }) : null].filter(Boolean);
  return (
    <li className="flex gap-3">
      <div className="flex flex-col items-center">
        <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-full', SURFACE.holder)}><Icon aria-hidden className="h-[18px] w-[18px]" /></span>
        {!last && <span aria-hidden className={cn('my-1 w-px flex-1 border-l', SURFACE.divider)} />}
      </div>
      <div className={cn('min-w-0 flex-1 space-y-1', !last && 'pb-5')}>
        <div className="flex items-start justify-between gap-3">
          <p className={cn('min-w-0 pt-1.5', TYPE.bodyStrong, TEXT.strong)}>{t(`routes.leg.${key}`, vars)}</p>
          <p className="shrink-0 pt-1.5 text-right">
            <span className={cn('block tabular-nums', TYPE.bodyStrong, TEXT.strong)}>
              {leg.days[0] === leg.days[1] ? t('routes.daysOne', { count: leg.days[0] }) : t('routes.daysShort', { from: leg.days[0], to: leg.days[1] })}
            </span>
            <span className={cn('block tabular-nums', TYPE.small, TEXT.muted)}>
              {end[0] === end[1] ? t('routes.endsAt', { day: end[0] }) : t('routes.endsBy', { from: end[0], to: end[1] })}
            </span>
          </p>
        </div>
        <p className={cn(TYPE.body, TEXT.body)}>{t(`routes.legDesc.${key}`, vars)}</p>
        <div className={cn('flex flex-wrap items-center gap-x-3 gap-y-1', TYPE.small, TEXT.muted)}>
          <span className="inline-flex items-center gap-1.5">
            <ConfidenceDot sure={isSure(leg.confidence)} />
            {leg.observed ? t('routes.conf.observe', { n: leg.observed.n }) : t(`routes.conf.${leg.confidence}`)}
          </span>
          {facts.length > 0 && <span className="tabular-nums">{facts.join(' · ')}</span>}
        </div>
      </div>
    </li>
  );
}

// ─── Ce qui peut retarder, en ce moment ─────────────────────────────────────

function RouteNotices({ notices, base }: { notices: Notice[]; base: string }) {
  const { t } = useTranslation('customs');
  const navigate = useNavigate();
  if (notices.length === 0) {
    return <p className={cn(TYPE.body, TEXT.muted)}>{t('routes.noticesNone')}</p>;
  }
  return (
    <Card className="space-y-1 p-4">
      <h2 className={cn(TYPE.lead, TEXT.strong)}>{t('routes.noticesTitle')}</h2>
      <ul className={cn('divide-y', SURFACE.divider)}>
        {notices.map((n) => {
          // Le titre d'une perturbation porte déjà ses dates : pas de seconde ligne.
          const phase = phaseOf(n);
          return (
            <li key={n.id}>
              <button type="button" onClick={() => navigate(`${base}/veille#${n.slug}`)}
                className="flex w-full items-center gap-3 py-3 text-left">
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusPill tone="pending" label={t(`watch.phase.${phase}`)} />
                    {n.delay_days != null && n.delay_days > 0 && (
                      <span className={cn(TYPE.smallStrong, TEXT.strong)}>{t('routes.noticeDelay', { count: n.delay_days })}</span>
                    )}
                  </div>
                  <p className={cn(TYPE.bodyStrong, TEXT.strong)}>{n.title}</p>
                </div>
                <ChevronRight aria-hidden className={cn('h-5 w-5 shrink-0', TEXT.muted)} />
              </button>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

// ─── Ce que nos expéditions ont vraiment mis ───────────────────────────────

function ObservedCard({ plan, lanes, months, min, failed, onPick }: {
  plan: RoutePlan; lanes: ObservedLane[]; months: number; min: number; failed: boolean; onPick: (l: ObservedLane) => void;
}) {
  const { t, i18n } = useTranslation('customs');
  const lang = i18n.language ?? 'fr';
  const o = plan.observed;
  const pct = (x: number) => new Intl.NumberFormat(getCurrentLocale(), { style: 'percent', maximumFractionDigits: 0 }).format(x);
  const known = (l: ObservedLane) => {
    const [a, b] = l.lane.split('>');
    return l.mode === 'sea'
      ? SEA_ORIGINS.some((p) => p.code === a) && SEA_PORTS.some((p) => p.code === b)
      : AIR_ORIGINS.some((p) => p.code === a) && AIRPORTS.some((p) => p.code === b);
  };
  const others = lanes.filter((l) => l.lane !== plan.lane || l.mode !== plan.mode);

  return (
    <Card className="space-y-3 p-4">
      <h2 className={cn(TYPE.lead, TEXT.strong)}>{t('routes.obsTitle')}</h2>
      {o ? (
        <>
          <dl className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-2">
            <dt className={cn(TYPE.body, TEXT.muted)}>{t('routes.obsMedian')}</dt>
            <dd className={cn('text-right tabular-nums', TYPE.bodyStrong, TEXT.strong)}>{t('routes.daysOne', { count: o.median })}</dd>
            <dt className={cn(TYPE.body, TEXT.muted)}>{t('routes.obsHalf')}</dt>
            <dd className={cn('text-right tabular-nums', TYPE.bodyStrong, TEXT.strong)}>{t('routes.daysRange', { from: o.p25, to: o.p75 })}</dd>
            {o.promised_median != null && (
              <>
                <dt className={cn(TYPE.body, TEXT.muted)}>{t('routes.obsPromised')}</dt>
                <dd className={cn('text-right tabular-nums', TYPE.bodyStrong, TEXT.strong)}>{t('routes.daysOne', { count: o.promised_median })}</dd>
              </>
            )}
            {o.late_share != null && (
              <>
                <dt className={cn(TYPE.body, TEXT.muted)}>{t('routes.obsLate')}</dt>
                <dd className={cn('text-right tabular-nums', TYPE.bodyStrong, TEXT.strong)}>{pct(o.late_share)}</dd>
              </>
            )}
          </dl>
          {o.promised_median != null && o.median - o.promised_median >= 3 && (
            <Line tone="warn">{t('routes.obsGap', { count: o.median - o.promised_median })}</Line>
          )}
          <p className={cn(TYPE.small, TEXT.muted)}>
            {t(plan.mode === 'sea' ? 'routes.obsHowSea' : 'routes.obsHowAir', { n: o.n, months, from: placeLabel(plan.origin, lang), to: placeLabel(plan.arrival, lang) })}
          </p>
        </>
      ) : (
        <Line>{failed ? t('routes.obsError') : t('routes.obsNone', { min, months })}</Line>
      )}
      {others.length > 0 && (
        <div className="space-y-2 pt-1">
          <p className={cn(TYPE.smallStrong, TEXT.muted)}>{t('routes.obsOther')}</p>
          <ul className={cn('divide-y', SURFACE.divider)}>
            {others.map((l) => {
              const [a, b] = l.lane.split('>');
              const label = (
                <>
                  <span className="min-w-0 flex-1">
                    <span className={cn('flex flex-wrap items-center gap-x-1.5', TYPE.body, TEXT.body)}>
                      {l.mode === 'sea' ? <Ship aria-label={t('routes.mode.sea')} className="h-4 w-4 shrink-0" /> : <Plane aria-label={t('routes.mode.air')} className="h-4 w-4 shrink-0" />}
                      <span>{cityName(a, lang)}</span>
                      <ArrowRight aria-hidden className="h-4 w-4 shrink-0" />
                      <span>{cityName(b, lang)}</span>
                    </span>
                    <span className={cn('block', TYPE.small, TEXT.muted)}>{t('routes.obsCount', { count: l.n })}</span>
                  </span>
                  <span className={cn('shrink-0 tabular-nums', TYPE.bodyStrong, TEXT.strong)}>{t('routes.daysOne', { count: l.median })}</span>
                </>
              );
              return (
                <li key={`${l.mode}-${l.lane}`}>
                  {known(l) ? (
                    <button type="button" onClick={() => onPick(l)} className="flex w-full items-center gap-3 py-2.5 text-left">{label}</button>
                  ) : (
                    <div className="flex items-center gap-3 py-2.5">{label}</div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </Card>
  );
}

// ─── Mer contre avion ───────────────────────────────────────────────────────

function EmissionsCard({ plan, other, kg }: { plan: RoutePlan; other: RoutePlan; kg: number }) {
  const { t, i18n } = useTranslation('customs');
  if (kg <= 0) {
    return (
      <Card className="space-y-2 p-4">
        <h2 className={cn(TYPE.lead, TEXT.strong)}>{t('routes.co2Title')}</h2>
        <Line>{t('routes.co2NoWeight')}</Line>
      </Card>
    );
  }
  const sea = plan.mode === 'sea' ? plan : other;
  const air = plan.mode === 'air' ? plan : other;
  const max = Math.max(sea.co2eKg, air.co2eKg, 1);
  const ratio = sea.co2eKg > 0 ? Math.round(air.co2eKg / sea.co2eKg) : null;
  const rows = [
    { mode: 'sea' as const, p: sea, icon: Ship },
    { mode: 'air' as const, p: air, icon: Plane },
  ];
  return (
    <Card className="space-y-4 p-4">
      <div className="space-y-1">
        <h2 className={cn(TYPE.lead, TEXT.strong)}>{t('routes.co2Title')}</h2>
        <p className={cn(TYPE.small, TEXT.muted)}>{t('routes.co2For', { weight: weightText(kg), dest: placeLabel(plan.destination, i18n.language ?? 'fr') })}</p>
      </div>
      <div className="space-y-3">
        {rows.map(({ mode, p, icon: Icon }) => {
          const current = mode === plan.mode;
          return (
            <div key={mode} className="space-y-1.5">
              <div className="flex items-baseline justify-between gap-3">
                <span className={cn('inline-flex items-center gap-2', current ? cn(TYPE.bodyStrong, TEXT.strong) : cn(TYPE.body, TEXT.muted))}>
                  <Icon aria-hidden className="h-4 w-4" /> {t(`routes.mode.${mode}`)}
                  <span className={cn('tabular-nums', TYPE.small, TEXT.muted)}>· {t('routes.daysShort', { from: p.days[0], to: p.days[1] })}</span>
                </span>
                <span className={cn('tabular-nums', current ? cn(TYPE.bodyStrong, TEXT.strong) : cn(TYPE.body, TEXT.muted))}>{t('routes.co2Short', { co2: co2Text(p.co2eKg) })}</span>
              </div>
              <div className={cn('h-2.5 w-full overflow-hidden rounded-full', SURFACE.inset)}>
                <div className={cn('h-full rounded-full', current ? 'bg-[#1E1E1E] dark:bg-[#F5F5F5]' : 'bg-[#9E9E9E] dark:bg-[#8A8A8A]')}
                  style={{ width: `${Math.max(1.5, (p.co2eKg / max) * 100)}%` }} />
              </div>
            </div>
          );
        })}
      </div>
      {ratio != null && ratio >= 2 && (
        <Line>
          {plan.mode === 'sea'
            ? t('routes.co2VsAir', { ratio, from: air.days[0], to: air.days[1] })
            : t('routes.co2VsSea', { ratio, from: sea.days[0], to: sea.days[1] })}
        </Line>
      )}
      <p className={cn(TYPE.small, TEXT.muted)}>{t('routes.co2Method', { source: EMISSIONS_SOURCE })}</p>
    </Card>
  );
}

export default RoutesPage;
