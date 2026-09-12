/**
 * Desktop admin — Cargo · Carte (docs/cargo/module-app/02-carte-flexport.md).
 *
 * Panneau latéral synchronisé (recherche, filtres, conteneurs groupés par
 * navire ; survol = surbrillance, clic = recadrage + carte navire) et la carte
 * avec ses couches, « tout voir » et plein écran.
 */
import { useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { ArrowLeft, Expand, Globe2, Layers, Maximize2, Minimize2, Ship } from 'lucide-react';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { useCargoShipments, useCargoVesselPositions } from '@/hooks/useCargo';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { CargoMap } from '@/components/cargo/CargoMap';
import { DEFAULT_LAYERS } from '@/lib/cargo/layers';
import type { MapLayers } from '@/lib/cargo/layers';
import { CargoDossierDialog } from '@/components/cargo/CargoDetail';
import { groupVessels } from '@/lib/cargo/vessels';
import { LIVE_STATUS_LABEL, vesselLiveStatus } from '@/lib/cargo/geo';
import { bestEta, daysUntilArrival, etaSlipDays, fmtDay, positionAge, statusMeta } from '@/lib/cargo/model';
import type { CargoShipment } from '@/lib/cargo/model';
import { cn } from '@/lib/utils';
import { SURFACE, TEXT, SOFT_PILL, PRIMARY_PILL, Card, Chip, SearchField, RefChip, StatusPill } from '@/desktop/designKit';

type Filter = 'all' | 'route' | 'soon' | 'unpaid' | 'nopos';

function ShipmentRow({ s, onOpen }: { s: CargoShipment; onOpen: () => void }) {
  const meta = statusMeta(s.status);
  const slip = etaSlipDays(s);
  const d = daysUntilArrival(s);
  const alerts: string[] = [];
  if (slip > 0) alerts.push(`+${slip} j`);
  if (d != null && d >= 0 && d <= 7 && !s.telex_released) alerts.push('télex manquant');
  return (
    <button type="button" onClick={onOpen} className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-muted/50">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className={cn('text-[13px] font-semibold', TEXT.strong)}>{s.client_label}</span>
          <RefChip className="text-[11px]">{s.container_number}</RefChip>
        </div>
        <div className={cn('mt-0.5 flex flex-wrap items-center gap-x-2 text-[12px]', TEXT.muted)}>
          <span>{s.pod_name} · {fmtDay(bestEta(s).date)}</span>
          {alerts.map((a) => <span key={a} className="font-semibold text-amber-700 dark:text-amber-400">{a}</span>)}
        </div>
      </div>
      <StatusPill tone={meta.tone} label={meta.label} />
    </button>
  );
}

export function DesktopCargoMap() {
  const { hasPermission } = useAdminAuth();
  const navigate = useNavigate();
  const { data: shipments } = useCargoShipments();
  const { data: positions } = useCargoVesselPositions();
  const [selected, setSelected] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const q = useDebouncedValue(search).trim().toLowerCase();
  const [layers, setLayers] = useState<MapLayers>(DEFAULT_LAYERS);
  const [layersOpen, setLayersOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [globe, setGlobe] = useState(false);
  const [fitNonce, setFitNonce] = useState(1);
  const [resizeNonce, setResizeNonce] = useState(0);

  const all = useMemo(() => (shipments ?? []).filter((s) => s.status !== 'DELIVERED'), [shipments]);
  const rows = useMemo(() => all.filter((s) => {
    if (filter === 'route' && s.status !== 'AT_SEA') return false;
    if (filter === 'soon') { const d = daysUntilArrival(s); if (d == null || d < 0 || d > 7) return false; }
    if (filter === 'unpaid' && s.freight_paid && s.telex_released) return false;
    if (filter === 'nopos' && s.vessel_imo) return false;
    if (q && ![s.client_label, s.container_number, s.bl_number, s.vessel_name ?? '', s.pod_name].join(' ').toLowerCase().includes(q)) return false;
    return true;
  }), [all, filter, q]);
  const vessels = useMemo(() => groupVessels(rows, positions ?? []), [rows, positions]);
  const withoutPosition = rows.filter((s) => !vessels.some((v) => v.shipments.includes(s)));
  const latest = (positions ?? []).map((p) => p.reported_at).sort().pop() ?? null;

  if (!hasPermission('canViewCargo')) return <Navigate to="/m" replace />;

  const toggleFullscreen = () => { setFullscreen((f) => !f); setResizeNonce((n) => n + 1); };

  return (
    <div className={cn('flex flex-col', fullscreen ? 'fixed inset-0 z-[60] bg-background p-4' : 'min-h-[calc(100vh-120px)]')}>
      {!fullscreen && (
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <button type="button" onClick={() => navigate('/m/cargo')} className={cn('mb-1 inline-flex items-center gap-1 text-[12px] font-semibold', TEXT.muted)}>
              <ArrowLeft className="h-3.5 w-3.5" /> Ma flotte
            </button>
            <p className={cn('text-[15px] font-semibold', TEXT.body)}>
              {vessels.length} navire{vessels.length > 1 ? 's' : ''} · {rows.length} conteneur{rows.length > 1 ? 's' : ''}
              {latest && <span className={TEXT.muted}> · positions AIS, dernier relevé {positionAge({ reported_at: latest })}</span>}
            </p>
          </div>
        </header>
      )}

      <div className={cn('flex min-h-0 flex-1 gap-5', !fullscreen && 'mt-4')}>
        {/* ── Panneau latéral ─────────────────────────────────────────── */}
        <Card className="flex w-[340px] shrink-0 flex-col overflow-hidden p-0">
          <div className="space-y-2 border-b border-black/[0.06] p-3 dark:border-white/[0.06]">
            <SearchField value={search} onChange={setSearch} placeholder="Client, conteneur, navire, port…" className="w-full" />
            <div className="flex flex-wrap gap-1.5">
              <Chip label="Tous" count={all.length} active={filter === 'all'} onClick={() => setFilter('all')} />
              <Chip label="En mer" active={filter === 'route'} onClick={() => setFilter('route')} />
              <Chip label="Sous 7 j" active={filter === 'soon'} onClick={() => setFilter('soon')} />
              <Chip label="À régler" active={filter === 'unpaid'} onClick={() => setFilter('unpaid')} />
              <Chip label="Sans position" active={filter === 'nopos'} onClick={() => setFilter('nopos')} />
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            {vessels.map((v) => {
              const imo = v.position.vessel_imo;
              const st = vesselLiveStatus(v.position);
              const on = selected === imo;
              return (
                <div
                  key={imo}
                  onMouseEnter={() => setHovered(imo)}
                  onMouseLeave={() => setHovered(null)}
                  className={cn('mb-1.5 rounded-xl p-1.5 transition-colors', on ? 'bg-accent ring-1 ring-ring/40' : 'hover:bg-muted/30')}
                >
                  <button type="button" onClick={() => setSelected(on ? null : imo)} className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left">
                    <i className={`cargo-dot is-${st} shrink-0`} />
                    <span className="min-w-0 flex-1">
                      <span className={cn('block truncate text-[13px] font-bold', TEXT.strong)}>{v.position.vessel_name ?? imo}</span>
                      <span className={cn('block text-[11.5px]', TEXT.muted)}>
                        {LIVE_STATUS_LABEL[st]}{v.position.speed_kn != null && st !== 'stale' ? ` · ${v.position.speed_kn} nd` : ''} · {positionAge(v.position)}
                      </span>
                    </span>
                    <span className={cn('shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-bold tabular-nums', SURFACE.holder)}>{v.shipments.length}</span>
                  </button>
                  {v.shipments.map((s) => <ShipmentRow key={s.id} s={s} onOpen={() => setOpenId(s.id)} />)}
                </div>
              );
            })}
            {withoutPosition.length > 0 && (
              <div className="mb-1.5 rounded-xl p-1.5">
                <div className={cn('flex items-center gap-2 px-2 py-1.5 text-[11px] font-bold uppercase tracking-wider', TEXT.muted)}>
                  <Ship className="h-3.5 w-3.5" /> Sans position ({withoutPosition.length})
                </div>
                {withoutPosition.map((s) => <ShipmentRow key={s.id} s={s} onOpen={() => setOpenId(s.id)} />)}
                <p className={cn('px-2 pb-1 text-[11.5px]', TEXT.muted)}>Armateur pas encore interrogeable : on ne place rien au hasard sur la carte.</p>
              </div>
            )}
            {rows.length === 0 && <p className={cn('p-4 text-center text-[13px]', TEXT.muted)}>Rien ne correspond.</p>}
          </div>
        </Card>

        {/* ── Carte ────────────────────────────────────────────────────── */}
        <Card className="relative flex min-h-0 flex-1 flex-col overflow-hidden p-0">
          <CargoMap
            shipments={rows}
            positions={positions ?? []}
            layers={layers}
            globe={globe}
            selectedVesselImo={selected}
            hoveredVesselImo={hovered}
            onSelectVessel={setSelected}
            onOpenShipment={setOpenId}
            fitNonce={fitNonce}
            resizeNonce={resizeNonce}
            className={cn('flex-1', fullscreen ? 'min-h-0' : 'min-h-[520px]')}
          />
          {/* Outils : couches · tout voir · plein écran */}
          <div className="absolute right-3 top-3 z-20 flex items-center gap-1.5">
            <div className="relative">
              <button type="button" onClick={() => setLayersOpen((o) => !o)} className={cn('flex h-8 items-center gap-1.5 px-2.5 text-[12px] font-semibold', SOFT_PILL)}>
                <Layers className="h-3.5 w-3.5" /> Couches
              </button>
              {layersOpen && (
                <div className={cn('absolute right-0 top-[calc(100%+6px)] w-[180px] rounded-xl p-1.5', SURFACE.card, 'ring-1 ring-black/[0.10] dark:ring-white/[0.10]')}>
                  {([['routes', 'Trajets'], ['ports', 'Ports'], ['labels', 'Étiquettes']] as [keyof MapLayers, string][]).map(([k, label]) => (
                    <label key={k} className={cn('flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-[13px] hover:bg-muted/50', TEXT.strong)}>
                      <input id={`cargo-layer-${k}`} type="checkbox" checked={layers[k]} onChange={(e) => setLayers({ ...layers, [k]: e.target.checked })} className="h-3.5 w-3.5 accent-current" />
                      {label}
                    </label>
                  ))}
                </div>
              )}
            </div>
            <button type="button" onClick={() => setGlobe((g) => !g)} className={cn('flex h-8 items-center gap-1.5 px-2.5 text-[12px] font-semibold', globe ? PRIMARY_PILL : SOFT_PILL)} title="Vue globe">
              <Globe2 className="h-3.5 w-3.5" /> Globe
            </button>
            <button type="button" onClick={() => { setSelected(null); setFitNonce((n) => n + 1); }} className={cn('flex h-8 items-center gap-1.5 px-2.5 text-[12px] font-semibold', SOFT_PILL)} title="Tout voir">
              <Expand className="h-3.5 w-3.5" /> Tout voir
            </button>
            <button type="button" onClick={toggleFullscreen} className={cn('flex h-8 w-8 items-center justify-center', SOFT_PILL)} aria-label={fullscreen ? 'Quitter le plein écran' : 'Plein écran'}>
              {fullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
            </button>
          </div>
          {/* Légende */}
          <div className={cn('flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-black/[0.06] px-4 py-2 text-[11.5px] dark:border-white/[0.06]', TEXT.muted)}>
            <span className="inline-flex items-center gap-1.5"><i className="cargo-dot is-underway" /> en route</span>
            <span className="inline-flex items-center gap-1.5"><i className="cargo-dot is-moored" /> à quai</span>
            <span className="inline-flex items-center gap-1.5"><i className="cargo-dot is-anchored" /> au mouillage</span>
            <span className="inline-flex items-center gap-1.5"><i className="cargo-dot is-stale" /> hors couverture</span>
            <span>badge = conteneurs à bord · trait plein = parcouru · pointillé = restant</span>
          </div>
        </Card>
      </div>

      <CargoDossierDialog shipmentId={openId} onClose={() => setOpenId(null)} />
    </div>
  );
}
