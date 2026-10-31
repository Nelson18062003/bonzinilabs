// ============================================================
// Mobile admin — Cargo › Avion › charger des colis reçus dans cet avion
// (refonte v2, maquette 10/39). La douchette ou la saisie en haut ; ce qui
// attend (le bureau, Air cargo, en premier), client par client, avec la
// photo ; on coche (toucher le nom d'un client coche tous ses colis) ; le
// bouton additionne et charge. Un colis non soldé se charge quand même —
// c'est signalé.
// ============================================================
import { useMemo, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { useAirLoadParcels, useAirLoadableParcels } from '@/hooks/useAirShipments';
import { parcelUnpaid, type AirParcel } from '@/lib/airShipment';
import { clientFullName, formatCbm, formatKg } from '@/lib/reception';
import { cn } from '@/lib/utils';
import { BigButton, Dock, EmptyLine, ScreenLoader, ScreenTop, SURFACE, TEXT } from '@/mobile/designKit';
import { ParcelThumb, useReceptionLabels } from '@/mobile/components/reception/bits';
import { TickBox } from '@/mobile/components/reception/packageBits';
import { ParcelScanBox, type ScanResult } from '@/mobile/components/cargo/ParcelScanBox';
import { findScannedParcel } from '@/lib/warehouse';

export function MobileCargoAirLoad() {
  const navigate = useNavigate();
  const { airId } = useParams<{ airId: string }>();
  const { hasPermission } = useAdminAuth();
  const labels = useReceptionLabels();
  const { data, isLoading } = useAirLoadableParcels(airId);
  const load = useAirLoadParcels();
  const [picked, setPicked] = useState<Set<string>>(new Set());

  const groups = useMemo(() => {
    const by = new Map<string, { key: string; client: AirParcel['client']; parcels: AirParcel[] }>();
    for (const p of data ?? []) {
      const key = p.client?.user_id ?? '∅';
      const g = by.get(key) ?? { key, client: p.client, parcels: [] };
      g.parcels.push(p); by.set(key, g);
    }
    return [...by.values()];
  }, [data]);

  if (!hasPermission('canManageCargo')) return <Navigate to="/m/cargo/avion" replace />;
  if (isLoading || !data) return <ScreenLoader className="min-h-[100dvh]" />;

  const chosen = data.filter((p) => picked.has(p.id));
  const kg = chosen.reduce((s, p) => s + Number(p.weight_kg ?? 0), 0);
  const toggle = (id: string) => setPicked((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const toggleGroup = (ps: AirParcel[]) => setPicked((s) => { const n = new Set(s); const every = ps.every((p) => n.has(p.id)); for (const p of ps) { if (every) n.delete(p.id); else n.add(p.id); } return n; });
  // Un carton scanné (douchette ou caméra) se coche ; le rescanner ne le décoche pas.
  const onScan = (text: string): ScanResult => {
    const p = findScannedParcel(text, data);
    if (!p) return { outcome: 'unknown', text: `${text.trim()} : pas dans la liste d'attente` };
    if (picked.has(p.id)) return { outcome: 'again', text: `${p.parcel_no} déjà coché` };
    setPicked((s) => new Set(s).add(p.id));
    return { outcome: 'ok', text: `${p.parcel_no} · ${clientFullName(p.client)}` };
  };

  const submit = async () => {
    if (!airId || chosen.length === 0) return;
    const res = await load.mutateAsync({ id: airId, parcelIds: chosen.map((p) => p.id) });
    toast.success(`${res.loaded} colis chargés`, { description: `${formatKg(res.weight_kg)} · ${formatCbm(res.cbm)}` });
    navigate(`/m/cargo/avion/${airId}`, { replace: true });
  };

  return (
    <div className={cn('flex min-h-[100dvh] flex-col', SURFACE.canvas)}>
      <ScreenTop title="Charger dans l'avion" backTo={`/m/cargo/avion/${airId}`} step={data.length ? `${chosen.length}/${data.length}` : undefined} />
      <div className="flex-1 px-5 pb-6 pt-4">
        {data.length === 0 ? <EmptyLine>Rien n'attend au bureau ni à l'entrepôt.</EmptyLine> : (
          <>
            <ParcelScanBox onScan={onScan} placeholder="Scannez ou tapez RC-…" />
            {groups.map((g) => {
              const every = g.parcels.every((p) => picked.has(p.id));
              const name = g.client ? clientFullName(g.client) : 'Sans client';
              return (
                <section key={g.key} className="pt-5">
                  <button type="button" onClick={() => toggleGroup(g.parcels)} aria-pressed={every}
                    className={cn('text-left text-[14px] font-semibold uppercase tracking-[0.06em]', TEXT.muted)}>
                    {name} · {g.parcels.length} colis
                  </button>
                  {g.parcels.map((p) => {
                    const on = picked.has(p.id);
                    return (
                      <button key={p.id} type="button" onClick={() => toggle(p.id)} role="checkbox" aria-checked={on}
                        className={cn('flex w-full items-center gap-3.5 border-b py-3 text-left last:border-b-0', SURFACE.divider)}>
                        <TickBox on={on} />
                        <ParcelThumb path={p.photo_path} />
                        <span className="min-w-0 flex-1">
                          <span className={cn('block text-[17px] font-semibold tabular-nums', TEXT.strong)}>{p.parcel_no}</span>
                          <span className={cn('block truncate text-[15px] tabular-nums', TEXT.muted)}>
                            {[p.description || labels.kind(p.kind), formatKg(p.weight_kg)].join(' · ')}
                            {parcelUnpaid(p) && <span className="font-semibold text-[#975102] dark:text-[#E8B931]"> · non soldé</span>}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </section>
              );
            })}
          </>
        )}
      </div>
      <Dock>
        <BigButton onClick={() => void submit()} disabled={chosen.length === 0} loading={load.isPending}>
          {chosen.length > 0 ? `Charger ${chosen.length} colis · ${formatKg(kg)}` : 'Charger'}
        </BigButton>
      </Dock>
    </div>
  );
}
