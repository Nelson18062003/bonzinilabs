/**
 * Desktop admin — Cargo, écran d'entrée : le workbench « Ma flotte ».
 *
 * Archétype 02-foundation §2.A : en-tête (titre + compteurs + UN CTA), bandeau
 * de files (chips = filtres), barre de filtres sur une ligne, table triée par
 * arrivée. Sélectionner une ligne ouvre le dossier en panneau (§2.B) — la
 * route /m/cargo/:shipmentId porte la sélection (lien profond).
 */
import { useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { ChevronRight, Map as MapIcon, Search as SearchIcon } from 'lucide-react';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { useCargoShipments } from '@/hooks/useCargo';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { CargoDetail } from '@/components/cargo/CargoDetail';
import { CARRIER_LABEL, bestEta, daysUntilArrival, etaSlipDays, fmtDay, fmtUsd, statusMeta } from '@/lib/cargo/model';
import type { CargoShipment } from '@/lib/cargo/model';
import { cn } from '@/lib/utils';
import {
  SURFACE, TEXT, PRIMARY_PILL, SOFT_PILL, Card, CardHeader, Chip, DropChip, SearchField, Th, Td, RefChip, StatusPill, ScreenLoader,
} from '@/desktop/designKit';

type Bucket = 'all' | 'route' | 'soon' | 'unpaid' | 'untracked';

function inBucket(s: CargoShipment, b: Bucket): boolean {
  if (s.status === 'DELIVERED' && b !== 'all') return false;
  switch (b) {
    case 'route': return s.status === 'AT_SEA';
    case 'soon': { const d = daysUntilArrival(s); return d != null && d >= 0 && d <= 7; }
    case 'unpaid': return !s.freight_paid || !s.telex_released;
    case 'untracked': return s.status === 'UNKNOWN';
    default: return true;
  }
}

export function DesktopCargoScreen() {
  const { hasPermission } = useAdminAuth();
  const navigate = useNavigate();
  const { shipmentId } = useParams<{ shipmentId: string }>();
  const { data, isLoading } = useCargoShipments();
  const [bucket, setBucket] = useState<Bucket>('all');
  const [search, setSearch] = useState('');
  const q = useDebouncedValue(search).trim().toLowerCase();
  const [carrier, setCarrier] = useState('all');
  const [pod, setPod] = useState('all');

  const all = useMemo(() => data ?? [], [data]);
  const counts = useMemo(() => ({
    all: all.length,
    route: all.filter((s) => inBucket(s, 'route')).length,
    soon: all.filter((s) => inBucket(s, 'soon')).length,
    unpaid: all.filter((s) => inBucket(s, 'unpaid')).length,
    untracked: all.filter((s) => inBucket(s, 'untracked')).length,
  }), [all]);

  const carrierOptions = useMemo(() => [{ value: 'all', label: 'Tous' }, ...[...new Set(all.map((s) => s.carrier))].map((c) => ({ value: c, label: CARRIER_LABEL[c] ?? c }))], [all]);
  const podOptions = useMemo(() => [{ value: 'all', label: 'Toutes' }, ...[...new Set(all.map((s) => s.pod_name))].map((p) => ({ value: p, label: p }))], [all]);

  const rows = useMemo(() => all.filter((s) => {
    if (!inBucket(s, bucket)) return false;
    if (carrier !== 'all' && s.carrier !== carrier) return false;
    if (pod !== 'all' && s.pod_name !== pod) return false;
    if (q) {
      const hay = [s.client_label, s.container_number, s.bl_number, s.vessel_name ?? '', s.pod_name].join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  }).sort((a, b) => (bestEta(a).date?.getTime() ?? Infinity) - (bestEta(b).date?.getTime() ?? Infinity)), [all, bucket, carrier, pod, q]);

  const selected = shipmentId ?? null;
  const compact = !!selected;
  useEffect(() => {
    if (selected && !isLoading && all.length && !all.some((s) => s.id === selected)) navigate('/m/cargo', { replace: true });
  }, [selected, isLoading, all, navigate]);

  if (!hasPermission('canViewCargo')) return <Navigate to="/m" replace />;

  return (
    <div className={cn('flex flex-col', compact ? 'h-[calc(100vh-120px)] min-h-[560px]' : 'min-h-[calc(100vh-120px)]')}>
      {/* ── En-tête de page ─────────────────────────────────────────────── */}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className={cn('text-[26px] font-extrabold tracking-tight', TEXT.strong)}>Cargo</h2>
          <p className={cn('mt-1 text-[14px]', TEXT.muted)}>
            {counts.all} conteneur{counts.all > 1 ? 's' : ''} suivi{counts.all > 1 ? 's' : ''}
            {counts.soon > 0 && <> · <span className="font-bold text-amber-700 dark:text-amber-400">{counts.soon} arrive{counts.soon > 1 ? 'nt' : ''} cette semaine</span></>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => navigate('/m/cargo/map')} className={cn('inline-flex h-9 items-center gap-2 px-3.5 text-[13px] font-semibold', SOFT_PILL)}>
            <MapIcon className="h-4 w-4" /> Carte
          </button>
          <button type="button" onClick={() => navigate('/m/cargo/track')} className={cn('inline-flex h-9 items-center gap-2 px-4 text-[13px] font-bold', PRIMARY_PILL)}>
            <SearchIcon className="h-4 w-4" /> Suivre un conteneur
          </button>
        </div>
      </header>

      {/* ── Files + filtres — UNE ligne ─────────────────────────────────── */}
      <section className="mt-4 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5">
          <Chip label="Tous" count={counts.all} active={bucket === 'all'} onClick={() => setBucket('all')} />
          <Chip label="En mer" count={counts.route} active={bucket === 'route'} onClick={() => setBucket('route')} />
          <Chip label="Arrivent sous 7 j" count={counts.soon || null} active={bucket === 'soon'} onClick={() => setBucket('soon')} />
          <Chip label="À régler" count={counts.unpaid || null} active={bucket === 'unpaid'} onClick={() => setBucket('unpaid')} />
          <Chip label="Sans suivi" count={counts.untracked || null} active={bucket === 'untracked'} onClick={() => setBucket('untracked')} />
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <SearchField value={search} onChange={setSearch} placeholder={compact ? 'Rechercher…' : 'Client, conteneur, B/L, navire…'} className={compact ? 'w-[200px]' : 'w-[280px]'} />
          <DropChip label="Armateur" value={carrier} options={carrierOptions} onChange={setCarrier} />
          <DropChip label="Destination" value={pod} options={podOptions} onChange={setPod} />
        </div>
      </section>

      {/* ── Table + panneau ─────────────────────────────────────────────── */}
      <div className="mt-4 flex min-h-0 flex-1 items-stretch gap-5">
        <Card className="flex min-h-0 flex-1 flex-col overflow-hidden p-0">
          <CardHeader title="Ma flotte" meta="Triés par date d'arrivée" />
          {isLoading ? (
            <ScreenLoader />
          ) : rows.length > 0 ? (
            <div className="min-h-0 flex-1 overflow-auto">
              <table className="w-full text-left">
                <thead className={cn('sticky top-0 z-10', SURFACE.card)}>
                  <tr>
                    <Th first>Client</Th>
                    <Th>Conteneur</Th>
                    {!compact && <Th>Navire</Th>}
                    <Th>Arrivée</Th>
                    <Th>Statut</Th>
                    {!compact && <Th align="right">Fret</Th>}
                    <Th last className="w-[36px]" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((s) => {
                    const meta = statusMeta(s.status);
                    const eta = bestEta(s);
                    const slip = etaSlipDays(s);
                    const active = s.id === selected;
                    return (
                      <tr
                        key={s.id}
                        onClick={() => navigate(active ? '/m/cargo' : `/m/cargo/${s.id}`)}
                        className={cn('cursor-pointer transition-colors hover:bg-muted/40', active && 'bg-accent shadow-[inset_2px_0_0_0_hsl(var(--ring))]')}
                      >
                        <Td first>
                          <div className={cn('text-[13px] font-semibold', TEXT.strong)}>{s.client_label}</div>
                          <div className={cn('text-[11.5px]', TEXT.muted)}>{CARRIER_LABEL[s.carrier] ?? s.carrier} · B/L <span className="font-mono">{s.bl_number}</span></div>
                        </Td>
                        <Td>
                          <RefChip>{s.container_number}</RefChip>
                        </Td>
                        {!compact && (
                          <Td>
                            <div className={cn('text-[13px]', TEXT.body)}>{s.vessel_name ?? <span className={TEXT.muted}>—</span>}</div>
                            {s.voyage && <div className={cn('text-[11.5px]', TEXT.muted)}>voyage {s.voyage}</div>}
                          </Td>
                        )}
                        <Td>
                          <div className={cn('text-[13px] font-semibold tabular-nums', TEXT.strong)}>{s.pod_name} · {fmtDay(eta.date)}</div>
                          <div className={cn('text-[11.5px] tabular-nums', slip > 0 ? 'font-semibold text-amber-700 dark:text-amber-400' : TEXT.muted)}>
                            {eta.source === 'promised' ? 'date du transitaire' : slip > 0 ? `+${slip} j · promis ${fmtDay(new Date(s.eta_promised + 'T12:00:00'))}` : 'armateur'}
                          </div>
                        </Td>
                        <Td>
                          <StatusPill tone={meta.tone} label={meta.label} />
                        </Td>
                        {!compact && (
                          <Td align="right">
                            <div className={cn('text-[13px] font-semibold tabular-nums', TEXT.strong)}>{fmtUsd(s.freight_usd)}</div>
                            <div className={cn('text-[11.5px]', s.freight_paid && s.telex_released ? TEXT.muted : 'text-destructive')}>
                              {s.freight_paid ? 'réglé' : 'à régler'} · télex {s.telex_released ? 'reçu' : 'non'}
                            </div>
                          </Td>
                        )}
                        <Td last>
                          <ChevronRight className={cn('h-4 w-4', TEXT.muted)} />
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className={cn('flex flex-1 flex-col items-center justify-center gap-2 px-6 py-16 text-center', TEXT.muted)}>
              <p className={cn('text-[14px] font-semibold', TEXT.strong)}>{all.length === 0 ? 'Aucun conteneur suivi' : 'Rien dans cette file'}</p>
              <p className="max-w-sm text-[13px]">
                {all.length === 0 ? 'Recherche un bill of lading ou un numéro de conteneur, puis ajoute-le à la flotte.' : 'Change de file ou élargis les filtres.'}
              </p>
              {all.length === 0 && (
                <button type="button" onClick={() => navigate('/m/cargo/track')} className={cn('mt-2 inline-flex h-9 items-center gap-2 px-4 text-[13px] font-bold', PRIMARY_PILL)}>
                  Suivre un conteneur
                </button>
              )}
            </div>
          )}
        </Card>

        {selected && (
          <aside className="w-[42%] min-w-[560px] shrink-0">
            <div className={cn('flex h-full flex-col overflow-hidden rounded-[22px]', SURFACE.card, SURFACE.shadow)}>
              <CargoDetail shipmentId={selected} onClose={() => navigate('/m/cargo')} />
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
