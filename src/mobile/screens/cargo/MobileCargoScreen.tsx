/**
 * Mobile admin — Cargo (refonte v2, maquettes 04/01 et 10/30).
 *
 * L'accueil du module : le chiffre qui compte (les conteneurs en mer, dont
 * ceux en retard et ceux qui arrivent sous 7 jours), quatre gros ronds
 * (Suivre · Avion · Réception · Carte), puis les quatre conteneurs qui
 * pressent. « Tout voir » (`?vue=tous`) ouvre la liste complète avec les
 * files de l'ordinateur (Tous · En mer · Sous 7 j · À régler · Sans suivi ·
 * Livré), la recherche, et dans « … » l'armateur, la destination, le tri et
 * l'export CSV.
 */
import { useMemo, useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowDownUp, Calculator, Download, Map as MapIcon, Package, Plane, Plus, Search, Ship, Users } from 'lucide-react';
import { QueryError } from '@/components/ui/QueryError';
import { DisruptionStrip } from '@/components/cargo/DisruptionStrip';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { useCargoShipments } from '@/hooks/useCargo';
import { useCargoPartsSummary } from '@/hooks/useReception';
import { CARRIER_LABEL, bestEta, daysUntilArrival, etaSlipDays } from '@/lib/cargo/model';
import type { CargoShipment } from '@/lib/cargo/model';
import {
  ActionCircles, ActionSheet, EmptyLine, HeroFigure, ItemList, ItemRow, MoreButton, RoundButton, ScreenLoader, ScreenTop, SearchBox,
  SectionHead, TabTop, useSheet, type SheetAction,
} from '@/mobile/designKit';
import { CarrierCircle, ChipRow, TopIcon } from '@/mobile/components/cargo/v2';
import { BUCKETS, boxNo, exportFleetCsv, inBucket, shipmentLine, shipmentTag, type Bucket } from './fleet';

/** Le plus urgent d'abord : le retard (le plus long en tête), puis ce qui attend un geste, puis la plus proche arrivée. */
const TAG_RANK: Record<string, number> = { danger: 3, pending: 2, success: 1, neutral: 0, info: 0 };
function byUrgency(a: CargoShipment, b: CargoShipment): number {
  const ta = shipmentTag(a); const tb = shipmentTag(b);
  const d = TAG_RANK[tb.tone] - TAG_RANK[ta.tone];
  if (d !== 0) return d;
  const slip = etaSlipDays(b) - etaSlipDays(a);
  if (slip !== 0) return slip;
  return (bestEta(a).date?.getTime() ?? Infinity) - (bestEta(b).date?.getTime() ?? Infinity);
}

function ShipmentRow({ s, onClick }: { s: CargoShipment; onClick: () => void }) {
  return (
    <ItemRow
      leading={<CarrierCircle carrier={s.carrier} />}
      title={boxNo(s.container_number)}
      subtitle={shipmentLine(s)}
      tag={shipmentTag(s)}
      onClick={onClick}
    />
  );
}

export function MobileCargoScreen() {
  const { hasPermission } = useAdminAuth();
  const [params] = useSearchParams();
  if (!hasPermission('canViewCargo')) return <Navigate to="/m" replace />;
  return params.get('vue') === 'tous' ? <FleetList initialSearch={params.get('q') === '1'} /> : <CargoHome />;
}

function CargoHome() {
  const navigate = useNavigate();
  const { hasPermission } = useAdminAuth();
  const { data, isLoading, isError, refetch } = useCargoShipments();
  const { data: parts } = useCargoPartsSummary();
  const more = useSheet();

  const all = useMemo(() => data ?? [], [data]);
  const atSea = all.filter((s) => s.status === 'AT_SEA');
  const late = all.filter((s) => s.status !== 'DELIVERED' && etaSlipDays(s) > 0).length;
  const soon = all.filter((s) => { const d = daysUntilArrival(s); return s.status !== 'DELIVERED' && d != null && d >= 0 && d <= 7; }).length;
  const top = useMemo(() => [...all].filter((s) => s.status !== 'DELIVERED').sort(byUrgency).slice(0, 4), [all]);

  const actions: SheetAction[] = [
    { label: 'Tous les conteneurs', icon: Ship, onClick: () => navigate('/m/cargo?vue=tous') },
    { label: 'Le coût à quai', icon: Calculator, onClick: () => navigate('/m/cargo/cout') },
    { label: 'Comptes cargo', icon: Users, onClick: () => navigate('/m/cargo/comptes') },
    { label: 'Exporter la flotte (CSV)', icon: Download, onClick: () => exportFleetCsv(all), disabled: all.length === 0 },
  ];

  return (
    <div className="flex min-h-full flex-col pb-6">
      <TabTop
        title="Cargo"
        right={
          <>
            <RoundButton icon={Search} ariaLabel="Chercher un conteneur" onClick={() => navigate('/m/cargo?vue=tous&q=1')} />
            <MoreButton bordered onClick={more.show} />
          </>
        }
      />

      <div className="px-5 pt-3.5">
        <HeroFigure
          label="En mer"
          value={isLoading ? '—' : atSea.length}
          unit={atSea.length > 1 ? 'conteneurs' : 'conteneur'}
          sub={[
            <><b className="font-bold">{late}</b> en retard</>,
            <><b className="font-bold">{soon}</b> arrivent sous 7 j</>,
          ]}
          onClick={() => navigate('/m/cargo?vue=tous')}
        />
      </div>

      <ActionCircles
        actions={[
          ...(hasPermission('canManageCargo') ? [{ label: 'Suivre', icon: Plus, onClick: () => navigate('/m/cargo/track') }] : [{ label: 'Suivre', icon: Search, onClick: () => navigate('/m/cargo/track') }]),
          { label: 'Avion', icon: Plane, onClick: () => navigate('/m/cargo/avion'), badge: parts?.air_open ?? 0, primary: false },
          { label: 'Réception', icon: Package, onClick: () => navigate('/m/cargo/reception'), badge: parts?.deposits_pending ?? 0, primary: false },
          { label: 'Carte', icon: MapIcon, onClick: () => navigate('/m/cargo/map'), primary: false },
        ]}
      />

      <SectionHead title="Conteneurs" link={{ label: 'Tout voir', onClick: () => navigate('/m/cargo?vue=tous') }} />
      {isLoading ? <ScreenLoader /> : isError ? (
        <div className="px-5"><QueryError what="la flotte" onRetry={() => { void refetch(); }} /></div>
      ) : top.length === 0 ? (
        <EmptyLine action={{ label: 'Suivre un conteneur', onClick: () => navigate('/m/cargo/track') }}>Aucun conteneur suivi.</EmptyLine>
      ) : (
        <ItemList>
          {top.map((s) => <ShipmentRow key={s.id} s={s} onClick={() => navigate(`/m/cargo/${s.id}`)} />)}
        </ItemList>
      )}

      <ActionSheet open={more.open} onClose={more.hide} title="Cargo" actions={actions} />
    </div>
  );
}

type Sort = 'urgent' | 'eta' | 'client';
const SORT_LABEL: Record<Sort, string> = { urgent: 'Le plus urgent', eta: 'Par arrivée', client: 'Par client' };

function FleetList({ initialSearch }: { initialSearch: boolean }) {
  const navigate = useNavigate();
  const { data, isLoading, isError, refetch } = useCargoShipments();
  const [bucket, setBucket] = useState<Bucket>('all');
  const [searching, setSearching] = useState(initialSearch);
  const [query, setQuery] = useState('');
  const [carrier, setCarrier] = useState('all');
  const [pod, setPod] = useState('all');
  const [sort, setSort] = useState<Sort>('urgent');
  const [pick, setPick] = useState<'carrier' | 'pod' | 'sort' | null>(null);
  const more = useSheet();

  const all = useMemo(() => data ?? [], [data]);
  const carriers = useMemo(() => [...new Set(all.map((s) => s.carrier))], [all]);
  const pods = useMemo(() => [...new Set(all.map((s) => s.pod_name).filter(Boolean))], [all]);
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = all.filter((s) => {
      if (!inBucket(s, bucket)) return false;
      if (carrier !== 'all' && s.carrier !== carrier) return false;
      if (pod !== 'all' && s.pod_name !== pod) return false;
      if (q) {
        const hay = [s.client_label, s.container_number, s.bl_number, s.vessel_name ?? '', s.pod_name, s.pol_name ?? ''].join(' ').toLowerCase();
        if (!hay.includes(q) && !hay.replace(/\s/g, '').includes(q.replace(/\s/g, ''))) return false;
      }
      return true;
    });
    if (sort === 'client') return list.sort((a, b) => a.client_label.localeCompare(b.client_label, 'fr'));
    if (sort === 'eta') return list.sort((a, b) => (bestEta(a).date?.getTime() ?? Infinity) - (bestEta(b).date?.getTime() ?? Infinity));
    return list.sort(byUrgency);
  }, [all, bucket, carrier, pod, query, sort]);

  const options = BUCKETS.map((b) => ({ value: b.value, label: b.label, count: all.filter((s) => inBucket(s, b.value)).length }));
  const pickActions: SheetAction[] = pick === 'carrier'
    ? [{ label: 'Tous les armateurs', onClick: () => setCarrier('all') }, ...carriers.map((c) => ({ label: CARRIER_LABEL[c] ?? c, onClick: () => setCarrier(c) }))]
    : pick === 'pod'
      ? [{ label: 'Toutes les destinations', onClick: () => setPod('all') }, ...pods.map((p) => ({ label: p, onClick: () => setPod(p) }))]
      : (Object.keys(SORT_LABEL) as Sort[]).map((k) => ({ label: SORT_LABEL[k], onClick: () => setSort(k) }));

  return (
    <div className="flex min-h-full flex-col pb-6">
      <ScreenTop
        title="Conteneurs"
        backTo="/m/cargo"
        right={
          <>
            <TopIcon icon={Search} ariaLabel="Chercher" onClick={() => setSearching((v) => !v)} />
            <MoreButton onClick={more.show} />
          </>
        }
      />
      {searching && (
        <div className="px-5 pt-3">
          <SearchBox value={query} onChange={setQuery} placeholder="Client, conteneur, B/L, navire, port" autoFocus />
        </div>
      )}
      <DisruptionStrip shipments={all} className="px-5" />
      <ChipRow className="pt-3" options={options} value={bucket} onChange={setBucket} />

      {isLoading ? <ScreenLoader /> : isError ? (
        <div className="px-5 pt-4"><QueryError what="la flotte" onRetry={() => { void refetch(); }} /></div>
      ) : rows.length === 0 ? (
        <EmptyLine>{query ? 'Aucun conteneur ne correspond.' : 'Aucun conteneur dans cette file.'}</EmptyLine>
      ) : (
        <ItemList className="pt-1">
          {rows.map((s) => <ShipmentRow key={s.id} s={s} onClick={() => navigate(`/m/cargo/${s.id}`)} />)}
        </ItemList>
      )}

      <ActionSheet
        open={more.open}
        onClose={more.hide}
        title="Conteneurs"
        actions={[
          { label: 'Armateur', hint: carrier === 'all' ? 'Tous' : CARRIER_LABEL[carrier] ?? carrier, icon: Ship, onClick: () => setPick('carrier') },
          { label: 'Destination', hint: pod === 'all' ? 'Toutes' : pod, icon: MapIcon, onClick: () => setPick('pod') },
          { label: 'Trier', hint: SORT_LABEL[sort], icon: ArrowDownUp, onClick: () => setPick('sort') },
          { label: 'Exporter la liste (CSV)', icon: Download, onClick: () => exportFleetCsv(rows), disabled: rows.length === 0 },
        ]}
      />
      <ActionSheet open={pick != null} onClose={() => setPick(null)} title={pick === 'carrier' ? 'Armateur' : pick === 'pod' ? 'Destination' : 'Trier'} actions={pickActions} />
    </div>
  );
}
