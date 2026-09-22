/**
 * Desktop admin — Cargo › Avion : les expéditions aériennes.
 * (Les deux autres parties du module : Container à /m/cargo, Réception à
 * /m/cargo/reception ; la barre d'onglets en haut passe de l'une à l'autre.)
 *
 * Même archétype que Container : en-tête (compteurs + UN CTA « Nouvelle
 * expédition »), chips d'état, table triée (en vol, préparation, arrivés,
 * remis). Sélectionner une ligne ouvre l'expédition en dialogue — la route
 * /m/cargo/avion/:airId porte la sélection (lien profond).
 */
import { useMemo, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { ChevronRight, Plane, Plus } from 'lucide-react';
import { DesktopCargoParts } from '@/components/cargo/CargoParts';
import { AirQuickView } from '@/components/cargo/air/AirQuickView';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { useAirShipments } from '@/hooks/useAirShipments';
import { airStatusMeta, flightSentence, fmtDay, formatAwb, type AirStatus } from '@/lib/airShipment';
import { formatCbm, formatKg } from '@/lib/reception';
import { cn } from '@/lib/utils';
import { SURFACE, TEXT, PRIMARY_PILL, Card, CardHeader, Chip, KV, Th, Td, StatusPill, ScreenLoader } from '@/desktop/designKit';

type Filter = 'open' | AirStatus | 'all';

export function DesktopCargoAir() {
  const { hasPermission } = useAdminAuth();
  const navigate = useNavigate();
  const { airId } = useParams<{ airId?: string }>();
  const { data, isLoading } = useAirShipments();
  const [filter, setFilter] = useState<Filter>('open');

  const all = useMemo(() => data ?? [], [data]);
  const rows = useMemo(() => filter === 'all' ? all : filter === 'open' ? all.filter((a) => a.status !== 'DELIVERED') : all.filter((a) => a.status === filter), [all, filter]);
  const counts = useMemo(() => ({
    open: all.filter((a) => a.status !== 'DELIVERED').length,
    PLANNED: all.filter((a) => a.status === 'PLANNED').length,
    DEPARTED: all.filter((a) => a.status === 'DEPARTED').length,
    ARRIVED: all.filter((a) => a.status === 'ARRIVED').length,
    DELIVERED: all.filter((a) => a.status === 'DELIVERED').length,
    all: all.length,
  }), [all]);
  const stats = useMemo(() => {
    const open = all.filter((a) => a.status !== 'DELIVERED');
    return {
      parcels: open.reduce((s, a) => s + a.parcel_count, 0),
      kg: open.reduce((s, a) => s + Number(a.total_weight_kg), 0),
      inFlight: all.filter((a) => a.status === 'DEPARTED').reduce((s, a) => s + a.parcel_count, 0),
      unpaid: open.reduce((s, a) => s + a.unpaid_count, 0),
    };
  }, [all]);

  if (!hasPermission('canViewCargo')) return <Navigate to="/m" replace />;
  const canManage = hasPermission('canManageCargo');

  return (
    <div className="flex min-h-[calc(100vh-120px)] flex-col">
      <DesktopCargoParts active="air" className="mb-4" />

      <header className="flex flex-wrap items-end justify-between gap-4">
        <p className={cn('text-[15px] font-semibold', TEXT.body)}>
          {all.length > 0 ? (
            <><span className={TEXT.strong}>{counts.open} expédition{counts.open > 1 ? 's' : ''}</span> en cours · {stats.parcels} colis · {formatKg(stats.kg)}{counts.DEPARTED > 0 && <> · <span className="font-bold text-[#0B5FA5]">{counts.DEPARTED} en vol</span></>}</>
          ) : 'Expéditions aériennes'}
        </p>
        {canManage && (
          <button type="button" onClick={() => navigate('/m/cargo/avion/nouveau')} className={cn('inline-flex h-9 items-center gap-2 px-4 text-[13px] font-bold', PRIMARY_PILL)}><Plus className="h-4 w-4" /> Nouvelle expédition</button>
        )}
      </header>

      <section className="mt-4 flex flex-wrap items-center gap-2">
        <Chip label="En cours" count={counts.open || null} active={filter === 'open'} onClick={() => setFilter('open')} />
        <Chip label="Préparation" count={counts.PLANNED || null} active={filter === 'PLANNED'} onClick={() => setFilter('PLANNED')} />
        <Chip label="En vol" count={counts.DEPARTED || null} active={filter === 'DEPARTED'} onClick={() => setFilter('DEPARTED')} />
        <Chip label="Arrivés" count={counts.ARRIVED || null} active={filter === 'ARRIVED'} onClick={() => setFilter('ARRIVED')} />
        <Chip label="Tous" count={counts.all || null} active={filter === 'all'} onClick={() => setFilter('all')} />
      </section>

      <section className="mt-4 grid grid-cols-4 gap-4">
        {[['Colis en route par avion', String(stats.parcels), 'dans les expéditions en cours'], ['En vol maintenant', String(stats.inFlight), 'partis, pas encore arrivés'], ['Poids', formatKg(stats.kg), 'le Air cargo se facture au kilo'], ['Non soldés', String(stats.unpaid), 'Douala attendra le paiement']].map(([k, v, h]) => (
          <Card key={k} className="px-5 py-4">
            <KV k={k} v={<span className="text-[22px] font-bold">{v}</span>} />
            <div className={cn('mt-1 text-[12px]', TEXT.muted)}>{h}</div>
          </Card>
        ))}
      </section>

      <Card className="mt-4 overflow-hidden p-0">
        <CardHeader title="Expéditions" meta={`${rows.length} ligne${rows.length > 1 ? 's' : ''}`} />
        {isLoading ? <ScreenLoader /> : rows.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <p className={cn('text-[14px] font-semibold', TEXT.strong)}>{filter === 'all' ? 'Aucune expédition aérienne' : 'Rien dans cet état'}</p>
            <p className={cn('mt-1 text-[13px]', TEXT.muted)}>{filter === 'all' ? 'Une LTA suffit pour commencer : les colis reçus au bureau se chargent ensuite.' : 'Cliquez « Tous » pour revoir les expéditions.'}</p>
          </div>
        ) : (
          <table className="w-full text-left">
            <thead className={SURFACE.card}>
              <tr>
                <Th first>LTA</Th>
                <Th>Vol</Th>
                <Th>État</Th>
                <Th>Départ</Th>
                <Th>Arrivée</Th>
                <Th align="right">Colis</Th>
                <Th align="right">Poids</Th>
                <Th align="right">Volume</Th>
                <Th align="right">Clients</Th>
                <Th>Paiement</Th>
                <Th last className="w-[36px]" />
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => {
                const st = airStatusMeta(a.status);
                return (
                  <tr key={a.id} onClick={() => navigate(`/m/cargo/avion/${a.id}`)} className={cn('cursor-pointer transition-colors hover:bg-muted/40', airId === a.id && 'bg-accent')}>
                    <Td first><span className="inline-flex items-center gap-2"><span className={cn('flex h-6 w-6 items-center justify-center rounded-md text-white', a.status === 'DEPARTED' ? 'bg-[#0B5FA5]' : 'bg-[#C8102E]')}><Plane className="h-3.5 w-3.5" /></span><span className={cn('font-mono text-[12px] font-bold', TEXT.strong)}>{formatAwb(a.awb_number)}</span></span></Td>
                    <Td><span className="text-[12.5px]">{flightSentence(a)}</span></Td>
                    <Td><StatusPill tone={st.tone} label={st.short} /></Td>
                    <Td><span className={cn('text-[12.5px] tabular-nums', a.departed_at ? TEXT.strong : TEXT.muted)}>{a.departed_at ? fmtDay(a.departed_at) : a.etd ? `prévu ${fmtDay(a.etd)}` : '—'}</span></Td>
                    <Td><span className={cn('text-[12.5px] tabular-nums', a.arrived_at ? TEXT.strong : TEXT.muted)}>{a.arrived_at ? fmtDay(a.arrived_at) : a.eta ? `prévue ${fmtDay(a.eta)}` : '—'}</span></Td>
                    <Td align="right"><span className="text-[13px] font-semibold tabular-nums">{a.parcel_count}</span></Td>
                    <Td align="right"><span className="text-[13px] tabular-nums">{formatKg(a.total_weight_kg)}</span></Td>
                    <Td align="right"><span className="text-[13px] tabular-nums">{formatCbm(a.total_cbm)}</span></Td>
                    <Td align="right"><span className="text-[13px] tabular-nums">{a.client_count}</span></Td>
                    <Td>{a.parcel_count === 0 ? <span className={cn('text-[12px]', TEXT.muted)}>—</span> : a.unpaid_count > 0 ? <StatusPill tone="pending" label={`${a.unpaid_count} non soldé${a.unpaid_count > 1 ? 's' : ''}`} /> : <StatusPill tone="success" label="Tout payé" />}</Td>
                    <Td last><ChevronRight className={cn('h-4 w-4', TEXT.muted)} /></Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>

      <AirQuickView airId={airId ?? null} onClose={() => navigate('/m/cargo/avion')} />
    </div>
  );
}
