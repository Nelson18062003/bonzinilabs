/**
 * Routes et délais — refonte v2 (maquette 10/58). Mer ou Avion ; départ et
 * arrivée en deux tuiles ; le délai porte à porte en gros (km, CO₂e) ; le
 * délai mesuré sur nos expéditions ; étape par étape en J+. Le reste du
 * calcul (port, acheminement, poids) et la carte, les autres lignes mesurées,
 * les émissions et les avis sur la route : lignes « Détails » dessous.
 * Partager : l'icône en haut. Tout tient dans l'URL, comme avant
 * (parseRouteState / serializeRouteState, planRoute, useObservedTransit admin).
 */
import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Anchor, BarChart3, Check, Factory, FileCheck2, Leaf, Map as MapIcon, Plane, Scale, Share2, Ship, Shield, Stamp, TrainFront, Truck, Warehouse, type LucideIcon,
} from 'lucide-react';
import { useAdminNotices } from '@/hooks/useCustomsReview';
import { useObservedTransit } from '@/hooks/useObservedTransit';
import { copyToClipboard } from '@/lib/clipboard';
import { formatNumber } from '@/lib/formatters';
import {
  AIR_ORIGINS, DESTINATIONS, SEA_ORIGINS, SEA_PORTS, counterpart, noticesOnRoute, placeLabel, planRoute, type Destination, type Leg,
} from '@/lib/logistics/atlas';
import { canRail, parseRouteState, serializeRouteState, switchMode, weightKg, type RouteState } from '@/lib/logistics/routeState';
import { CountryFlag } from '@/components/form/CountryFlag';
import { cn } from '@/lib/utils';
import {
  ActionSheet, BigButton, BottomSheet, BoxSegmented, FOCUS_RING, IconCircle, ItemList, ItemRow, ScreenTop, SectionHead, SURFACE, TEXT, TextInput, useSheet,
} from '@/mobile/designKit';
import { BIG_FIELD, SettingRow } from '@/mobile/screens/more/parts';
import { HeaderIcon } from '@/mobile/screens/support/CannedResponsesV2';

const RouteMap = lazy(() => import('@/components/logistics/RouteMap'));

const ICON: Record<Leg['kind'], LucideIcon> = {
  pickup: Factory, origin_port: Anchor, sea: Ship, air: Plane, port: Shield, transit: Stamp, road: Truck, rail: TrainFront, final_clearance: FileCheck2,
};
const co2 = (kg: number) => (kg < 1000 ? `${formatNumber(kg)} kg` : `${formatNumber(kg / 1000, kg < 100_000 ? 1 : 0)} t`);
/** « Guangzhou (Nansha) » → « Nansha » : la tuile n'a la place que d'un nom. */
const shortPlace = (name: string) => (name.match(/\(([^)]+)\)/)?.[1] ?? name);

export function RoutesV2() {
  const { t, i18n } = useTranslation('customs');
  const lang = i18n.language ?? 'fr';
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [state, setState] = useState<RouteState>(() => parseRouteState(params));
  const set = <K extends keyof RouteState>(k: K, v: RouteState[K]) => setState((s) => ({ ...s, [k]: v }));
  useEffect(() => {
    const id = window.setTimeout(() => setParams(serializeRouteState(state), { replace: true }), 400);
    return () => window.clearTimeout(id);
  }, [state, setParams]);

  const observedQ = useObservedTransit('admin');
  const notices = useAdminNotices(true);
  const observed = observedQ.data?.byLane;
  const kg = weightKg(state);
  const plan = useMemo(() => planRoute({
    mode: state.mode, origin: state.origin, destination: state.destination, port: state.port,
    inland: canRail(state) ? state.inland : 'road', weightKg: kg, observed,
  }), [state, kg, observed]);
  const other = useMemo(() => counterpart(plan, observed), [plan, observed]);
  const onRoute = useMemo(() => noticesOnRoute(notices.data ?? [], plan), [notices.data, plan]);

  const fromSheet = useSheet();
  const toSheet = useSheet();
  const portSheet = useSheet();
  const inlandSheet = useSheet();
  const weightSheet = useSheet();
  const mapSheet = useSheet();
  const lanesSheet = useSheet();
  const co2Sheet = useSheet();
  const [weightDraft, setWeightDraft] = useState(state.weight);

  const share = async () => {
    const url = `${window.location.origin}/douane/routes?${serializeRouteState(state)}`;
    if (navigator.share) {
      try { await navigator.share({ title: t('routes.shareText'), url }); return; } catch { /* annulé : on copie */ }
    }
    await copyToClipboard(url, t('routes.linkLabel'));
  };

  const origins = state.mode === 'sea' ? SEA_ORIGINS : AIR_ORIGINS;
  const destName = placeLabel(plan.destination, lang);
  let lo = 0, hi = 0;
  const lanes = (observedQ.data?.lanes ?? []).slice(0, 8);

  return (
    <div className="flex min-h-full flex-col pb-10">
      <ScreenTop title="Routes et délais" backTo="/m/douane" right={<HeaderIcon icon={Share2} label="Partager le trajet" onClick={() => void share()} />} />
      <div className="space-y-3 px-5 pt-5">
        <BoxSegmented<'sea' | 'air'>
          ariaLabel="Mode"
          value={state.mode}
          onChange={(m) => setState((s) => switchMode(s, m))}
          options={[{ value: 'sea', label: 'Mer' }, { value: 'air', label: 'Avion' }]}
        />
        <div className="grid grid-cols-2 gap-3">
          <PlaceTile iso="CN" label={shortPlace(placeLabel(plan.origin, lang))} onClick={fromSheet.show} aria="Départ" />
          <PlaceTile iso={plan.destination.country} label={destName} onClick={toSheet.show} aria="Arrivée" />
        </div>
        <div className={cn('rounded-lg border px-[18px] pb-4 pt-[18px]', SURFACE.divider)}>
          <div className={cn('text-[17px] font-medium', TEXT.muted)}>De l'usine du fournisseur à {destName}</div>
          <div className={cn('mt-1.5 text-[44px] font-bold leading-none tracking-[-0.02em] tabular-nums', TEXT.strong)}>
            {plan.days[0]} à {plan.days[1]}<span className={cn('ml-2 text-[22px] font-semibold', TEXT.muted)}>jours</span>
          </div>
          <div className={cn('mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[17px]', TEXT.body)}>
            <span>≈ <b className="font-bold">{formatNumber(plan.km)}</b> km</span>
            {kg > 0 && <span><b className="font-bold">{co2(plan.co2eKg)}</b> CO₂e</span>}
          </div>
        </div>
        {plan.observed && (
          <p className={cn('flex items-center gap-2.5 text-[16px]', TEXT.body)}>
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#CFF7D3] text-[#02542D]"><Check className="h-4 w-4" strokeWidth={3} /></span>
            Mesuré sur {plan.observed.n} expéditions : {plan.observed.median} j
          </p>
        )}
        {plan.transit && (
          <p className="text-[16px] font-semibold text-[#975102] dark:text-[#E8B931]">Transit par le Cameroun : dédouanement à {destName}.</p>
        )}
      </div>

      <SectionHead title="Étape par étape" />
      <ItemList>
        {plan.legs.map((leg, i) => {
          lo += leg.days[0]; hi += leg.days[1];
          const key = leg.kind === 'pickup' || leg.kind === 'port' || leg.kind === 'transit' ? `${leg.kind}_${plan.mode}` : leg.kind;
          const vars = { from: leg.from ? placeLabel(leg.from, lang) : '', to: shortPlace(placeLabel(leg.to, lang)), via: leg.via ?? '' };
          return (
            <ItemRow
              key={`${leg.kind}-${i}`}
              leading={<IconCircle icon={ICON[leg.kind]} />}
              title={t(`routes.leg.${key}`, vars)}
              right={<span className={cn('shrink-0 text-[17px] font-bold tabular-nums', TEXT.strong)}>{lo === hi ? `J+${lo}` : `J+${lo} à ${hi}`}</span>}
            />
          );
        })}
      </ItemList>

      {onRoute.length > 0 && (
        <>
          <SectionHead title="Ce qui peut retarder" />
          <ItemList>
            {onRoute.map((n) => (
              <ItemRow
                key={n.id}
                leading={<IconCircle icon={Anchor} />}
                title={n.title}
                subtitle={n.delay_days ? `retard ≈ ${n.delay_days} j` : undefined}
                tag={{ tone: n.severity === 'high' ? 'danger' : 'pending', label: n.severity === 'high' ? 'Fort' : n.severity === 'medium' ? 'Moyen' : 'Faible' }}
                onClick={() => navigate(`/m/douane/veille#${n.slug}`)}
              />
            ))}
          </ItemList>
        </>
      )}

      <SectionHead title="Détails" />
      <div className="px-5">
        {state.mode === 'sea' && <SettingRow icon={Warehouse} label="Port d'arrivée" value={shortPlace(SEA_PORTS.find((p) => p.code === state.port)?.name ?? state.port)} onClick={portSheet.show} />}
        {canRail(state) && <SettingRow icon={TrainFront} label="Acheminement" value={state.inland === 'rail' ? 'Train' : 'Route'} onClick={inlandSheet.show} />}
        <SettingRow icon={Scale} label="Poids" value={`${formatNumber(kg)} kg`} onClick={() => { setWeightDraft(state.weight); weightSheet.show(); }} />
        <SettingRow icon={MapIcon} label="Voir la carte" onClick={mapSheet.show} />
        <SettingRow icon={BarChart3} label="Délais mesurés" value={lanes.length ? `${lanes.length} lignes` : undefined} onClick={lanesSheet.show} />
        {kg > 0 && <SettingRow icon={Leaf} label="Mer ou avion · CO₂e" onClick={co2Sheet.show} />}
      </div>

      <ActionSheet open={fromSheet.open} onClose={fromSheet.hide} title="Départ" actions={origins.map((o) => ({ label: placeLabel(o, lang), hint: o.code === state.origin ? 'Choisi' : undefined, onClick: () => set('origin', o.code) }))} />
      <ActionSheet open={toSheet.open} onClose={toSheet.hide} title="Arrivée" actions={(Object.keys(DESTINATIONS) as Destination[]).map((d) => ({ label: placeLabel(DESTINATIONS[d], lang), hint: d === state.destination ? 'Choisi' : undefined, onClick: () => set('destination', d) }))} />
      <ActionSheet open={portSheet.open} onClose={portSheet.hide} title="Port d'arrivée" actions={SEA_PORTS.map((p) => ({ label: placeLabel(p, lang), hint: p.code === state.port ? 'Choisi' : undefined, onClick: () => set('port', p.code as RouteState['port']) }))} />
      <ActionSheet open={inlandSheet.open} onClose={inlandSheet.hide} title="Acheminement" actions={[
        { label: 'Par la route', icon: Truck, onClick: () => set('inland', 'road') },
        { label: 'Par le train', icon: TrainFront, onClick: () => set('inland', 'rail') },
      ]} />
      <BottomSheet open={weightSheet.open} onClose={weightSheet.hide} title="Poids">
        <div className="flex items-center gap-3">
          <TextInput aria-label="Poids en kg" inputMode="numeric" value={weightDraft} onChange={(e) => setWeightDraft(e.target.value.replace(/\D/g, '').slice(0, 6))} className={cn(BIG_FIELD, 'tabular-nums')} />
          <span className={cn('text-[18px] font-semibold', TEXT.muted)}>kg</span>
        </div>
        <BigButton className="mt-5" onClick={() => { set('weight', weightDraft); weightSheet.hide(); }}>Calculer</BigButton>
      </BottomSheet>
      <BottomSheet open={mapSheet.open} onClose={mapSheet.hide} title="La carte">
        <Suspense fallback={<div className="h-72 w-full animate-pulse rounded-lg bg-[#F5F5F5]" />}>
          {mapSheet.open && (
            <RouteMap plan={plan} lang={lang} focusLabels={{ all: t('routes.mapAll'), arrival: t('routes.mapArrival') }} className="h-72 w-full overflow-hidden rounded-lg bg-[#F5F5F5]" ariaLabel={t('routes.mapLabel', { from: placeLabel(plan.origin, lang), to: placeLabel(plan.destination, lang) })} />
          )}
        </Suspense>
      </BottomSheet>
      <BottomSheet open={lanesSheet.open} onClose={lanesSheet.hide} title="Délais mesurés">
        {lanes.length === 0 ? (
          <p className={cn('text-[16px]', TEXT.muted)}>{observedQ.isError ? "Les délais mesurés n'ont pas pu être chargés." : 'Pas encore assez d’expéditions mesurées.'}</p>
        ) : (
          <div>
            {lanes.map((l) => {
              const [a, b] = l.lane.split('>');
              return (
                <ItemRow
                  key={`${l.mode}-${l.lane}`}
                  leading={<IconCircle icon={l.mode === 'sea' ? Ship : Plane} />}
                  title={`${a} → ${b}`}
                  subtitle={`${l.n} expéditions`}
                  right={<span className={cn('shrink-0 text-[17px] font-bold tabular-nums', TEXT.strong)}>{l.median} j</span>}
                  onClick={() => {
                    lanesSheet.hide();
                    if (l.mode === 'sea') setState((s) => ({ ...s, mode: 'sea', origin: a, port: b === 'CMDLA' ? 'CMDLA' : 'CMKBI' }));
                    else setState((s) => ({ ...s, mode: 'air', origin: a, destination: b === 'NSI' ? 'yaounde' : s.destination === 'yaounde' ? 'douala' : s.destination }));
                  }}
                />
              );
            })}
          </div>
        )}
      </BottomSheet>
      <BottomSheet open={co2Sheet.open} onClose={co2Sheet.hide} title="Mer ou avion">
        <div>
          {(plan.mode === 'sea' ? [plan, other] : [other, plan]).map((p) => (
            <ItemRow
              key={p.mode}
              leading={<IconCircle icon={p.mode === 'sea' ? Ship : Plane} />}
              title={p.mode === 'sea' ? 'Mer' : 'Avion'}
              subtitle={`${p.days[0]} à ${p.days[1]} jours`}
              right={<span className={cn('shrink-0 text-[17px] font-bold tabular-nums', TEXT.strong)}>{co2(p.co2eKg)} CO₂e</span>}
            />
          ))}
        </div>
      </BottomSheet>
    </div>
  );
}

function PlaceTile({ iso, label, onClick, aria }: { iso: string; label: string; onClick: () => void; aria: string }) {
  return (
    <button type="button" onClick={onClick} aria-label={`${aria} : ${label}`} className={cn('flex h-[60px] min-w-0 items-center gap-3 rounded-lg border px-4 text-left active:bg-[#F5F5F5] dark:active:bg-[#383838]', SURFACE.field, FOCUS_RING)}>
      <CountryFlag iso={iso} size={26} className="shrink-0" />
      <span className={cn('min-w-0 truncate text-[18px]', TEXT.strong)}>{label}</span>
    </button>
  );
}
