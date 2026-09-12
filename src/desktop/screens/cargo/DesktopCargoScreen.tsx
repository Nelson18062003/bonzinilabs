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
import { ChevronRight, Download, Map as MapIcon, Search as SearchIcon } from 'lucide-react';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { useCargoShipments } from '@/hooks/useCargo';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { CargoDossierDialog } from '@/components/cargo/CargoDetail';
import { CARRIER_LABEL, bestEta, daysUntilArrival, etaSlipDays, fmtDay, statusMeta } from '@/lib/cargo/model';
import { todoCounts } from '@/lib/cargo/todo';
import { exportToCSV } from '@/lib/exportCSV';
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
  const [sort, setSort] = useState<{ field: 'eta' | 'client'; asc: boolean }>({ field: 'eta', asc: true });
  const [cursor, setCursor] = useState(-1);

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
  }).sort((a, b) => {
    const dir = sort.asc ? 1 : -1;
    if (sort.field === 'client') return dir * a.client_label.localeCompare(b.client_label, 'fr');
    return dir * ((bestEta(a).date?.getTime() ?? Infinity) - (bestEta(b).date?.getTime() ?? Infinity));
  }), [all, bucket, carrier, pod, q, sort]);
  const toggleSort = (field: 'eta' | 'client') => setSort((cur) => ({ field, asc: cur.field === field ? !cur.asc : true }));
  const sortedMark = (field: 'eta' | 'client') => (sort.field === field ? (sort.asc ? 'asc' : 'desc') : null);
  const exportCsv = () => exportToCSV(
    rows.map((s) => ({ client: s.client_label, conteneur: s.container_number, bl: s.bl_number, armateur: CARRIER_LABEL[s.carrier] ?? s.carrier, navire: s.vessel_name ?? '', voyage: s.voyage ?? '', depart_promis: s.etd_promised ?? '', depart_reel: s.etd_actual?.slice(0, 10) ?? '', arrivee_promise: s.eta_promised ?? '', arrivee_armateur: s.eta_carrier?.slice(0, 10) ?? '', destination: s.pod_name, statut: statusMeta(s.status).label, fret_usd: s.freight_usd ?? '', fret_regle: s.freight_paid ? 'oui' : 'non', telex: s.telex_released ? 'oui' : 'non' })),
    [{ key: 'client', header: 'Client' }, { key: 'conteneur', header: 'Conteneur' }, { key: 'bl', header: 'B/L' }, { key: 'armateur', header: 'Armateur' }, { key: 'navire', header: 'Navire' }, { key: 'voyage', header: 'Voyage' }, { key: 'depart_promis', header: 'Départ promis' }, { key: 'depart_reel', header: 'Départ réel' }, { key: 'arrivee_promise', header: 'Arrivée promise' }, { key: 'arrivee_armateur', header: 'Arrivée armateur' }, { key: 'destination', header: 'Destination' }, { key: 'statut', header: 'Statut' }, { key: 'fret_usd', header: 'Fret (USD)' }, { key: 'fret_regle', header: 'Fret réglé' }, { key: 'telex', header: 'Télex' }],
    `bonzini-cargo-${new Date().toISOString().slice(0, 10)}.csv`,
  );
  // Clavier : ↑/↓ déplacent le curseur, Entrée ouvre, Échap ferme (02-foundation §1.4).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || openId) return;
      if (e.key === 'ArrowDown' || e.key === 'j') { e.preventDefault(); setCursor((c) => Math.min(rows.length - 1, c + 1)); }
      else if (e.key === 'ArrowUp' || e.key === 'k') { e.preventDefault(); setCursor((c) => Math.max(0, c - 1)); }
      else if (e.key === 'Enter' && cursor >= 0 && rows[cursor]) setOpenId(rows[cursor].id);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [rows, cursor, openId]);

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
          <button type="button" onClick={exportCsv} disabled={rows.length === 0} className={cn('inline-flex h-9 items-center gap-2 px-3.5 text-[13px] font-semibold disabled:opacity-50', SOFT_PILL)} title="Exporter la liste en CSV">
            <Download className="h-4 w-4" /> CSV
          </button>
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
          <CardHeader title="Ma flotte" meta={sort.field === 'eta' ? `Triés par arrivée ${sort.asc ? 'la plus proche' : 'la plus lointaine'} d'abord` : `Triés par client (${sort.asc ? 'A→Z' : 'Z→A'})`} />
          {isLoading ? (
            <ScreenLoader />
          ) : rows.length > 0 ? (
            <div className="min-h-0 flex-1 overflow-auto">
              <table className="w-full text-left">
                <thead className={cn('sticky top-0 z-10', SURFACE.card)}>
                  <tr>
                    <Th first sortable sorted={sortedMark('client')} onSort={() => toggleSort('client')}>Client</Th>
                    <Th>Conteneur</Th>
                    <Th>Navire</Th>
                    <Th sortable sorted={sortedMark('eta')} onSort={() => toggleSort('eta')}>Arrivée</Th>
                    <Th>Statut</Th>
                    <Th>À faire</Th>
                    <Th last className="w-[36px]" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((s, i) => {
                    const meta = statusMeta(s.status);
                    const eta = bestEta(s);
                    const slip = etaSlipDays(s);
                    const todo = todoCounts(s);
                    return (
                      <tr key={s.id} onClick={() => { setCursor(i); setOpenId(s.id); }} className={cn('cursor-pointer transition-colors hover:bg-muted/40', cursor === i && 'bg-accent shadow-[inset_2px_0_0_0_hsl(var(--ring))]')}>
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
                          {todo.open === 0 ? (
                            <span className={cn('text-[12.5px] font-semibold text-emerald-700 dark:text-emerald-400')}>Prêt</span>
                          ) : (
                            <span className={cn('inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[12px] font-bold tabular-nums', todo.now > 0 ? 'bg-destructive/10 text-destructive' : 'bg-muted text-foreground')}>
                              {todo.open} étape{todo.open > 1 ? 's' : ''}{todo.now > 0 ? ' · urgent' : ''}
                            </span>
                          )}
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
