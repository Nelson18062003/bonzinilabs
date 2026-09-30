// ============================================================
// Délais de transport — /douane/routes (site public) et /m/douane/routes (équipe).
// L'« Atlas » de Flexport, pour la Chine → le Cameroun (docs/douane/00-plan.md,
// étape 8).
//
// Une ligne de questions (le mode, le départ, la destination, le poids),
// puis la réponse dans l'ordre où on la lit : combien de jours, par où,
// étape par étape ; enfin ce que nos expéditions ont vraiment mis, ce
// qui peut retarder, et ce que la marchandise émet. Tout tient dans l'URL.
// ============================================================
import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ArrowRight, CheckCircle2, ChevronRight, Factory, FileCheck2, Plane, Share2, Ship, Stamp, TrainFront, Truck, Warehouse, type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatNumber } from '@/lib/formatters';
import { getCurrentLocale } from '@/i18n';
import { copyToClipboard } from '@/lib/clipboard';
import {
  AIRPORTS, AIR_ORIGINS, DESTINATIONS, EMISSIONS_SOURCE, SEA_ORIGINS, SEA_PORTS, counterpart, noticesOnRoute, placeLabel, planRoute,
  type Destination, type Leg, type RoutePlan,
} from '@/lib/logistics/atlas';
import { canRail, parseRouteState, serializeRouteState, switchMode, weightKg, type RouteState } from '@/lib/logistics/routeState';
import { phaseOf, type Notice } from '@/lib/customs/notices';
import { useObservedTransit, type ObservedLane } from '@/hooks/useObservedTransit';
import { useCustomsNotices } from '@/hooks/useCustomsNotices';
import { useAdminNotices } from '@/hooks/useCustomsReview';
import { CustomsShell, type CustomsVariant } from './shared';
import { isSure } from './format';
import { SiteLayout } from './site/SiteLayout';
import { Badge, Container, CountUp, Input, PageIntro, Pills, Reveal, Select } from './site/ui';

// La carte (MapLibre) pèse : elle arrive après le reste de la page.
const RouteMap = lazy(() => import('@/components/logistics/RouteMap'));

const ICON: Record<Leg['kind'], LucideIcon> = {
  pickup: Factory, origin_port: Warehouse, sea: Ship, air: Plane, port: FileCheck2, transit: Stamp, road: Truck, rail: TrainFront, final_clearance: FileCheck2,
};

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
  const { t } = useTranslation('customs');
  if (variant === 'admin') {
    return (
      <CustomsShell title={t('routes.title')} subtitle={t('routes.subtitle')} backTo="/m/douane" variant="admin" desktop={desktop}>
        <div className="dz bg-dz-bg px-4 pb-12 pt-4 text-dz-ink"><RoutesView admin /></div>
      </CustomsShell>
    );
  }
  return (
    <SiteLayout>
      <PageIntro title={t('site.routes.title')} subtitle={t('site.routes.subtitle')} back={{ to: '/douane', label: t('site.badge') }} />
      <Container className="pb-20"><RoutesView /></Container>
    </SiteLayout>
  );
}

function RoutesView({ admin = false }: { admin?: boolean }) {
  const { t, i18n } = useTranslation('customs');
  const lang = i18n.language ?? 'fr';
  const [params, setParams] = useSearchParams();
  const [state, setState] = useState<RouteState>(() => parseRouteState(params));
  const set = <K extends keyof RouteState>(k: K, v: RouteState[K]) => setState((s) => ({ ...s, [k]: v }));

  useEffect(() => {
    const id = window.setTimeout(() => setParams(serializeRouteState(state), { replace: true }), 400);
    return () => window.clearTimeout(id);
  }, [state, setParams]);

  // Espace équipe : supabaseAdmin seulement (.claude/rules/supabase-clients.md).
  const observedQ = useObservedTransit(admin ? 'admin' : 'public');
  const pubNotices = useCustomsNotices(!admin);
  const admNotices = useAdminNotices(admin);
  const notices = useMemo(() => (admin ? admNotices.data : pubNotices.data) ?? [], [admin, admNotices.data, pubNotices.data]);

  const observed = observedQ.data?.byLane;
  const kg = weightKg(state);
  const plan = useMemo(() => planRoute({
    mode: state.mode, origin: state.origin, destination: state.destination, port: state.port,
    inland: canRail(state) ? state.inland : 'road', weightKg: kg, observed,
  }), [state, kg, observed]);
  const other = useMemo(() => counterpart(plan, observed), [plan, observed]);
  const onRoute = useMemo(() => noticesOnRoute(notices, plan), [notices, plan]);
  const base = admin ? '/m/douane' : '/douane';

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
    <div className="space-y-6">
      {/* Les questions, sur une ligne à l'ordinateur. */}
      <section className="space-y-5 rounded-3xl border border-dz-line bg-dz-card p-5 sm:p-6">
        <Pills label={t('routes.step1')} value={state.mode} onChange={(m) => setState((s) => switchMode(s, m))}
          options={[
            { value: 'sea', label: <><Ship aria-hidden className="h-[18px] w-[18px]" /> {t('routes.mode.sea')}</> },
            { value: 'air', label: <><Plane aria-hidden className="h-[18px] w-[18px]" /> {t('routes.mode.air')}</> },
          ]} />
        <div className="grid grid-cols-2 gap-x-3 gap-y-4 sm:gap-4 lg:grid-cols-[repeat(auto-fit,minmax(170px,1fr))]">
          <Q wide label={t('site.routes.from')} id="dz-from">
            <Select id="dz-from" value={state.origin} onChange={(e) => set('origin', e.target.value)}>
              {(state.mode === 'sea' ? SEA_ORIGINS : AIR_ORIGINS).map((o) => <option key={o.code} value={o.code}>{placeLabel(o, lang)}</option>)}
            </Select>
          </Q>
          <Q wide label={t('site.routes.to')} id="dz-to">
            <Select id="dz-to" value={state.destination} onChange={(e) => set('destination', e.target.value as Destination)}>
              {(Object.keys(DESTINATIONS) as Destination[]).map((d) => <option key={d} value={d}>{placeLabel(DESTINATIONS[d], lang)}</option>)}
            </Select>
          </Q>
          {state.mode === 'sea' && (
            <Q label={t('routes.port')} id="dz-port">
              <Select id="dz-port" value={state.port} onChange={(e) => set('port', e.target.value as RouteState['port'])}>
                {SEA_PORTS.map((p) => <option key={p.code} value={p.code}>{placeLabel(p, lang)}</option>)}
              </Select>
            </Q>
          )}
          {canRail(state) && (
            <Q label={t('routes.inland')} id="dz-inland">
              <Select id="dz-inland" value={state.inland} onChange={(e) => set('inland', e.target.value as RouteState['inland'])}>
                <option value="road">{t('routes.road')}</option>
                <option value="rail">{t('routes.rail')}</option>
              </Select>
            </Q>
          )}
          <Q label={t('site.routes.weight')} id="dz-kg">
            <div className="relative">
              <Input id="dz-kg" inputMode="numeric" value={state.weight} placeholder="1000" className="pr-12 tabular-nums"
                onChange={(e) => set('weight', e.target.value.replace(/\D/g, '').slice(0, 6))} />
              <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[15px] font-semibold text-dz-ink3">kg</span>
            </div>
          </Q>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:items-start">
        <div className="min-w-0 space-y-4">
          {/* La réponse. */}
          <div className="rounded-3xl bg-dz-primary p-6 text-dz-on-primary sm:p-7">
            <p className="text-[15px] opacity-70">{t('routes.doorToDoor', { dest: placeLabel(plan.destination, lang) })}</p>
            <p className="mt-2 text-[40px] font-bold leading-none tracking-[-0.03em] sm:text-[46px]">
              <CountUp value={plan.days[0]} format={(n) => String(Math.round(n))} />–<CountUp value={plan.days[1]} format={(n) => String(Math.round(n))} />
              <span className="ml-2 text-[22px] font-semibold opacity-80 sm:text-[26px]">{t('site.routes.days')}</span>
            </p>
            <p className="mt-3 max-w-[52ch] text-[15px] opacity-70">
              {plan.observed
                ? t(plan.mode === 'sea' ? 'routes.headObservedSea' : 'routes.headObservedAir', { n: plan.observed.n, median: plan.observed.median })
                : t('routes.headMarket')}
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-dz-on-primary/10 px-3 py-1.5 text-[14px] font-semibold tabular-nums">{t('routes.distance', { km: kmText(plan.km) })}</span>
              {kg > 0 && <span className="rounded-full bg-dz-on-primary/10 px-3 py-1.5 text-[14px] font-semibold tabular-nums">{t('routes.co2Short', { co2: co2Text(plan.co2eKg) })}</span>}
              <button type="button" onClick={() => { void share(); }}
                className="ml-auto inline-flex h-9 items-center gap-2 rounded-full border border-dz-on-primary/20 px-4 text-[14px] font-semibold transition-colors hover:bg-dz-on-primary/10">
                <Share2 aria-hidden className="h-4 w-4" /> {t('routes.share')}
              </button>
            </div>
          </div>

          <div className="overflow-hidden rounded-3xl border border-dz-line bg-dz-card">
            <Suspense fallback={<div className="h-64 w-full animate-pulse bg-dz-soft sm:h-80 lg:h-[420px]" />}>
              <RouteMap plan={plan} lang={lang} focusLabels={{ all: t('routes.mapAll'), arrival: t('routes.mapArrival') }}
                className="h-64 w-full bg-dz-soft sm:h-80 lg:h-[420px]" ariaLabel={t('routes.mapLabel', { from: placeLabel(plan.origin, lang), to: placeLabel(plan.destination, lang) })} />
            </Suspense>
            <div className="h-3" />
          </div>

          {plan.transit && (
            <p className="rounded-2xl bg-dz-warn-soft p-4 text-[15px] leading-snug text-dz-ink">
              {t('routes.transitNote', { country: t(`routes.country.${plan.destination.country}`) })}
            </p>
          )}
        </div>

        <Steps plan={plan} />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Reveal><ObservedCard plan={plan} lanes={observedQ.data?.lanes ?? []} months={observedQ.data?.window_months ?? 18}
          min={observedQ.data?.min_count ?? 3} failed={observedQ.isError} onPick={pickLane} /></Reveal>
        <Reveal delay={0.05}><EmissionsCard plan={plan} other={other} kg={kg} /></Reveal>
        <Reveal delay={0.1} className="md:col-span-2 xl:col-span-1"><RouteNotices notices={onRoute} base={base} /></Reveal>
      </div>

      <p className="max-w-[80ch] text-[14px] leading-relaxed text-dz-ink3">{t('routes.sources')}</p>
    </div>
  );
}

/** Une question du formulaire. `wide` : toute la largeur sur téléphone (les noms de ports sont longs). */
function Q({ label, id, children, wide }: { label: string; id: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className={cn('min-w-0 space-y-2', wide && 'col-span-2 sm:col-span-1')}>
      <label htmlFor={id} className="block text-[14px] font-semibold text-dz-ink2">{label}</label>
      {children}
    </div>
  );
}

// ─── Étape par étape ────────────────────────────────────────────────────────

function Steps({ plan }: { plan: RoutePlan }) {
  const { t, i18n } = useTranslation('customs');
  const lang = i18n.language ?? 'fr';
  let lo = 0, hi = 0;
  return (
    <section className="rounded-3xl border border-dz-line bg-dz-card p-5 sm:p-6">
      <h2 className="text-[20px] font-bold tracking-[-0.01em]">{t('routes.stepsTitle')}</h2>
      <p className="mt-1 text-[14px] text-dz-ink3">{t('site.routes.stepsHint')}</p>
      <ol className="mt-5">
        {plan.legs.map((leg, i) => {
          lo += leg.days[0]; hi += leg.days[1];
          const Icon = ICON[leg.kind];
          const key = leg.kind === 'pickup' || leg.kind === 'port' || leg.kind === 'transit' ? `${leg.kind}_${plan.mode}` : leg.kind;
          const vars = { from: leg.from ? placeLabel(leg.from, lang) : '', to: placeLabel(leg.to, lang), via: leg.via ?? '' };
          const last = i === plan.legs.length - 1;
          const facts = [leg.km > 0 ? kmText(leg.km) : null, leg.co2eKg > 0 ? t('routes.co2Short', { co2: co2Text(leg.co2eKg) }) : null].filter(Boolean);
          return (
            <li key={`${leg.kind}-${i}`} className="flex gap-4">
              <div className="flex flex-col items-center">
                <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-full',
                  leg.kind === 'sea' || leg.kind === 'air' ? 'bg-dz-primary text-dz-on-primary' : 'bg-dz-soft text-dz-ink2')}>
                  <Icon aria-hidden className="h-[18px] w-[18px]" />
                </span>
                {!last && <span aria-hidden className="my-1 w-px flex-1 bg-dz-line" />}
              </div>
              <div className={cn('min-w-0 flex-1', !last && 'pb-5')}>
                <div className="flex items-start justify-between gap-3 pt-2">
                  <p className="min-w-0 text-[16px] font-semibold leading-snug text-dz-ink">{t(`routes.leg.${key}`, vars)}</p>
                  <p className="shrink-0 text-right">
                    <span className="block whitespace-nowrap text-[16px] font-bold tabular-nums">
                      {leg.days[0] === leg.days[1] ? t('routes.daysOne', { count: leg.days[0] }) : t('routes.daysShort', { from: leg.days[0], to: leg.days[1] })}
                    </span>
                    <span className="block whitespace-nowrap text-[13px] tabular-nums text-dz-ink3">
                      {lo === hi ? t('routes.endsAt', { day: lo }) : t('routes.endsBy', { from: lo, to: hi })}
                    </span>
                  </p>
                </div>
                <p className="mt-1 text-[14px] leading-snug text-dz-ink3">{t(`routes.legDesc.${key}`, vars)}</p>
                <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-dz-ink3">
                  <span className="inline-flex items-center gap-1.5">
                    <span aria-hidden className={cn('h-2 w-2 rounded-full', isSure(leg.confidence) ? 'bg-dz-good' : 'bg-dz-gold')} />
                    {leg.observed ? t('routes.conf.observe', { n: leg.observed.n }) : t(`routes.conf.${leg.confidence}`)}
                  </span>
                  {facts.length > 0 && <span className="tabular-nums">{facts.join(' · ')}</span>}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
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
  const others = lanes.filter((l) => l.lane !== plan.lane || l.mode !== plan.mode).filter(known).slice(0, 4);
  const stats = o ? [
    [t('routes.obsMedian'), t('routes.daysOne', { count: o.median })],
    [t('routes.obsHalf'), t('routes.daysShort', { from: o.p25, to: o.p75 })],
    ...(o.promised_median != null ? [[t('site.routes.promised'), t('routes.daysOne', { count: o.promised_median })]] : []),
    ...(o.late_share != null ? [[t('site.routes.late'), pct(o.late_share)]] : []),
  ] : [];

  return (
    <section className="h-full rounded-3xl border border-dz-line bg-dz-card p-5 sm:p-6">
      <h2 className="text-[18px] font-bold">{t('routes.obsTitle')}</h2>
      {o ? (
        <>
          <dl className="mt-4 grid grid-cols-2 gap-2">
            {stats.map(([k, v]) => (
              <div key={k} className="rounded-2xl bg-dz-soft px-4 py-3">
                <dt className="text-[13px] leading-snug text-dz-ink3">{k}</dt>
                <dd className="mt-1 text-[20px] font-bold tabular-nums">{v}</dd>
              </div>
            ))}
          </dl>
          {o.promised_median != null && o.median - o.promised_median >= 3 && (
            <p className="mt-3 rounded-2xl bg-dz-warn-soft px-4 py-3 text-[15px] font-semibold text-dz-warn">{t('routes.obsGap', { count: o.median - o.promised_median })}</p>
          )}
          <p className="mt-3 text-[14px] leading-snug text-dz-ink3">
            {t(plan.mode === 'sea' ? 'routes.obsHowSea' : 'routes.obsHowAir', { n: o.n, months, from: placeLabel(plan.origin, lang), to: placeLabel(plan.arrival, lang) })}
          </p>
        </>
      ) : (
        <p className="mt-3 text-[15px] leading-snug text-dz-ink2">{failed ? t('routes.obsError') : t('routes.obsNone', { min, months })}</p>
      )}
      {others.length > 0 && (
        <div className="mt-5 border-t border-dz-line pt-4">
          <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-dz-ink3">{t('routes.obsOther')}</p>
          <ul className="mt-2">
            {others.map((l) => {
              const [a, b] = l.lane.split('>');
              return (
                <li key={`${l.mode}-${l.lane}`}>
                  <button type="button" onClick={() => onPick(l)} className="-mx-2 flex w-[calc(100%+1rem)] items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-dz-soft">
                    {l.mode === 'sea' ? <Ship aria-label={t('routes.mode.sea')} className="h-4 w-4 shrink-0 text-dz-ink3" /> : <Plane aria-label={t('routes.mode.air')} className="h-4 w-4 shrink-0 text-dz-ink3" />}
                    <span className="min-w-0 flex-1 text-[15px]">{cityName(a, lang)} <ArrowRight aria-hidden className="inline h-3.5 w-3.5 text-dz-ink3" /> {cityName(b, lang)}</span>
                    <span className="shrink-0 text-[15px] font-semibold tabular-nums">{t('routes.daysOne', { count: l.median })}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}

// ─── Mer contre avion ───────────────────────────────────────────────────────

function EmissionsCard({ plan, other, kg }: { plan: RoutePlan; other: RoutePlan; kg: number }) {
  const { t, i18n } = useTranslation('customs');
  if (kg <= 0) {
    return (
      <section className="h-full rounded-3xl border border-dz-line bg-dz-card p-5 sm:p-6">
        <h2 className="text-[18px] font-bold">{t('routes.co2Title')}</h2>
        <p className="mt-3 text-[15px] text-dz-ink2">{t('routes.co2NoWeight')}</p>
      </section>
    );
  }
  const sea = plan.mode === 'sea' ? plan : other;
  const air = plan.mode === 'air' ? plan : other;
  const max = Math.max(sea.co2eKg, air.co2eKg, 1);
  const ratio = sea.co2eKg > 0 ? Math.round(air.co2eKg / sea.co2eKg) : null;
  return (
    <section className="h-full rounded-3xl border border-dz-line bg-dz-card p-5 sm:p-6">
      <h2 className="text-[18px] font-bold">{t('routes.co2Title')}</h2>
      <p className="mt-1 text-[14px] text-dz-ink3">{t('routes.co2For', { weight: weightText(kg), dest: placeLabel(plan.destination, i18n.language ?? 'fr') })}</p>
      <div className="mt-5 space-y-4">
        {([['sea', sea, Ship], ['air', air, Plane]] as const).map(([mode, p, Icon]) => {
          const current = mode === plan.mode;
          return (
            <div key={mode} className="space-y-1.5">
              <div className="flex items-baseline justify-between gap-3">
                <span className={cn('inline-flex items-center gap-2 text-[15px]', current ? 'font-semibold text-dz-ink' : 'text-dz-ink3')}>
                  <Icon aria-hidden className="h-4 w-4" /> {t(`routes.mode.${mode}`)}
                  <span className="text-[13px] tabular-nums text-dz-ink3">· {t('routes.daysShort', { from: p.days[0], to: p.days[1] })}</span>
                </span>
                <span className={cn('whitespace-nowrap text-[15px] tabular-nums', current ? 'font-bold' : 'text-dz-ink3')}>{t('routes.co2Short', { co2: co2Text(p.co2eKg) })}</span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-dz-soft">
                <div className={cn('h-full rounded-full transition-[width] duration-700', current ? 'bg-dz-primary' : 'bg-dz-ink3/40')} style={{ width: `${Math.max(1.5, (p.co2eKg / max) * 100)}%` }} />
              </div>
            </div>
          );
        })}
      </div>
      {ratio != null && ratio >= 2 && (
        <p className="mt-5 text-[15px] leading-snug text-dz-ink2">
          {plan.mode === 'sea' ? t('routes.co2VsAir', { ratio, from: air.days[0], to: air.days[1] }) : t('routes.co2VsSea', { ratio, from: sea.days[0], to: sea.days[1] })}
        </p>
      )}
      <p className="mt-3 text-[13px] leading-snug text-dz-ink3">{t('routes.co2Method', { source: EMISSIONS_SOURCE })}</p>
    </section>
  );
}

// ─── Ce qui peut retarder ───────────────────────────────────────────────────

function RouteNotices({ notices, base }: { notices: Notice[]; base: string }) {
  const { t } = useTranslation('customs');
  return (
    <section className="h-full rounded-3xl border border-dz-line bg-dz-card p-5 sm:p-6">
      <h2 className="text-[18px] font-bold">{t('routes.noticesTitle')}</h2>
      {notices.length === 0 ? (
        <p className="mt-3 flex items-center gap-2 text-[15px] text-dz-ink2">
          <CheckCircle2 aria-hidden className="h-5 w-5 shrink-0 text-dz-good" /> {t('routes.noticesNone')}
        </p>
      ) : (
        <ul className="mt-3">
          {notices.map((n) => (
            <li key={n.id}>
              <Link to={`${base}/veille#${n.slug}`} className="-mx-2 flex items-center gap-3 rounded-xl px-2 py-3 hover:bg-dz-soft">
                <span className="min-w-0 flex-1 space-y-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <Badge tone="warn">{t(`watch.phase.${phaseOf(n)}`)}</Badge>
                    {n.delay_days != null && n.delay_days > 0 && <span className="text-[14px] font-semibold">{t('routes.noticeDelay', { count: n.delay_days })}</span>}
                  </span>
                  <span className="block text-[15px] font-semibold leading-snug">{n.title}</span>
                </span>
                <ChevronRight aria-hidden className="h-5 w-5 shrink-0 text-dz-ink3" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default RoutesPage;
