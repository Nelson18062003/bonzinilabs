/**
 * Desktop admin — Cargo, écran d'entrée : le workbench « Ma flotte ».
 *
 * Archétype 02-foundation §2.A : en-tête (titre + compteurs + UN CTA), bandeau
 * de files (chips = filtres), barre de filtres sur une ligne, table triée par
 * arrivée. Sélectionner une ligne ouvre le dossier en panneau (§2.B) — la
 * route /m/cargo/:shipmentId porte la sélection (lien profond).
 */
import { useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { ChevronRight, Map as MapIcon, Search as SearchIcon } from 'lucide-react';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { useCargoShipments } from '@/hooks/useCargo';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { CargoDossierDialog } from '@/components/cargo/CargoDetail';
import { CARRIER_LABEL, bestEta, daysUntilArrival, etaSlipDays, fmtDay, statusMeta } from '@/lib/cargo/model';
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
  const [openId, setOpenId] = useState<string | null>(null);
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

  useEffect(() => {
    if (openId && !isLoading && all.length && !all.some((s) => s.id === openId)) setOpenId(null);
  }, [openId, isLoading, all]);

  if (!hasPermission('canViewCargo')) return <Navigate to="/m" replace />;

  return (
    <div className="flex min-h-[calc(100vh-120px)] flex-col">
      {/* ── En-tête de page ─────────────────────────────────────────────── */}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <p className={cn('text-[15px] font-semibold', TEXT.body)}>
          {counts.all} conteneur{counts.all > 1 ? 's' : ''} suivi{counts.all > 1 ? 's' : ''}
          {counts.soon > 0 && <> · <span className="font-bold text-amber-700 dark:text-amber-400">{counts.soon} arrive{counts.soon > 1 ? 'nt' : ''} cette semaine</span></>}
        </p>
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
          <SearchField value={search} onChange={setSearch} placeholder="Client, conteneur, B/L, navire…" className="w-[280px]" />
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
                    <Th>Navire</Th>
                    <Th>Arrivée</Th>
                    <Th>Statut</Th>
                    <Th>Fret · télex</Th>
                    <Th last className="w-[36px]" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((s) => {
                    const meta = statusMeta(s.status);
                    const eta = bestEta(s);
                    const slip = etaSlipDays(s);
                    return (
                      <tr key={s.id} onClick={() => setOpenId(s.id)} className="cursor-pointer transition-colors hover:bg-muted/40">
                        <Td first>
                          <div className={cn('text-[13px] font-semibold', TEXT.strong)}>{s.client_label}</div>
                          <div className={cn('text-[11.5px]', TEXT.muted)}>{CARRIER_LABEL[s.carrier] ?? s.carrier} · B/L <span className="font-mono">{s.bl_number}</span></div>
                        </Td>
                        <Td>
                          <RefChip>{s.container_number}</RefChip>
                        </Td>
                        <Td>
                          <div className={cn('text-[13px]', TEXT.body)}>{s.vessel_name ?? <span className={TEXT.muted}>—</span>}</div>
                          {s.voyage && <div className={cn('text-[11.5px]', TEXT.muted)}>voyage {s.voyage}</div>}
                        </Td>
                        <Td>
                          <div className={cn('text-[13px] font-semibold tabular-nums', TEXT.strong)}>{s.pod_name} · {fmtDay(eta.date)}</div>
                          <div className={cn('text-[11.5px] tabular-nums', slip > 0 ? 'font-semibold text-amber-700 dark:text-amber-400' : TEXT.muted)}>
                            {eta.source === 'promised' ? 'date du transitaire' : slip > 0 ? `+${slip} j · promis ${fmtDay(new Date(s.eta_promised + 'T12:00:00'))}` : 'armateur'}
                          </div>
                        </Td>
                        <Td>
                          <StatusPill tone={meta.tone} label={meta.label} />
                        </Td>
                        <Td>
                          <div className={cn('text-[12.5px] font-semibold', s.freight_paid && s.telex_released ? 'text-emerald-700 dark:text-emerald-400' : 'text-destructive')}>
                            {s.freight_paid ? 'Fret réglé' : 'Fret à régler'} · télex {s.telex_released ? 'reçu' : 'non reçu'}
                          </div>
                        </Td>
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

      </div>

      <CargoDossierDialog shipmentId={openId} onClose={() => setOpenId(null)} />
    </div>
  );
}
