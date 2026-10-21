// ============================================================
// Mobile admin — Cargo › charger des colis reçus dans cette boîte (refonte
// v2, même geste que « Charger dans l'avion », maquette 10/39).
//
// La douchette en haut ; ce qui attend à l'entrepôt pour le client de la
// boîte, client par client, avec la photo. On coche (toucher le nom coche
// tous ses colis), le bouton additionne (colis, m³) et charge. Les colis
// passent à « chargé » et suivent la boîte : parti, arrivé, livré.
// ============================================================
import { useMemo, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { useCargoShipment } from '@/hooks/useCargo';
import { useLoadParcels, useLoadableParcels } from '@/hooks/useReception';
import { clientFullName, formatCbm, formatKg, type ParcelWithDeposit } from '@/lib/reception';
import { cn } from '@/lib/utils';
import { BigButton, Dock, EmptyLine, ScreenLoader, ScreenTop, SURFACE, TEXT } from '@/mobile/designKit';
import { ParcelThumb, useReceptionLabels } from '@/mobile/components/reception/bits';
import { TickBox } from '@/mobile/components/reception/packageBits';
import { ParcelScanBox, type ScanResult } from '@/mobile/components/cargo/ParcelScanBox';
import { findScannedParcel } from '@/lib/warehouse';
import { boxNo } from './fleet';

export function MobileCargoLoadParcels() {
  const navigate = useNavigate();
  const { shipmentId } = useParams<{ shipmentId: string }>();
  const { hasPermission } = useAdminAuth();
  const labels = useReceptionLabels();
  const { data: shipment } = useCargoShipment(shipmentId ?? null);
  const { data, isLoading } = useLoadableParcels(shipmentId);
  const load = useLoadParcels();
  const [picked, setPicked] = useState<Set<string>>(new Set());

  const groups = useMemo(() => {
    const by = new Map<string, { key: string; client: ParcelWithDeposit['client']; parcels: ParcelWithDeposit[] }>();
    for (const p of data?.parcels ?? []) {
      const key = p.client?.user_id ?? '∅';
      const g = by.get(key) ?? { key, client: p.client, parcels: [] };
      g.parcels.push(p);
      by.set(key, g);
    }
    return [...by.values()];
  }, [data]);

  if (!hasPermission('canManageCargo')) return <Navigate to="/m/cargo" replace />;
  if (isLoading || !data) return <ScreenLoader className="min-h-[100dvh]" />;

  const back = `/m/cargo/${shipmentId}/colis`;
  const all = data.parcels;
  const chosen = all.filter((p) => picked.has(p.id));
  const cbm = chosen.reduce((s, p) => s + Number(p.cbm ?? 0), 0);
  const toggle = (id: string) => setPicked((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const toggleGroup = (ps: ParcelWithDeposit[]) => setPicked((s) => {
    const n = new Set(s);
    const every = ps.every((p) => n.has(p.id));
    for (const p of ps) { if (every) n.delete(p.id); else n.add(p.id); }
    return n;
  });

  // Un carton scanné (douchette ou caméra) se coche ; le rescanner ne le décoche pas.
  const onScan = (text: string): ScanResult => {
    const p = findScannedParcel(text, all);
    if (!p) return { outcome: 'unknown', text: `${text.trim()} : pas dans la liste d'attente` };
    if (picked.has(p.id)) return { outcome: 'again', text: `${p.parcel_no} déjà coché` };
    setPicked((s) => new Set(s).add(p.id));
    return { outcome: 'ok', text: `${p.parcel_no} · ${clientFullName(p.client)}` };
  };

  const submit = async () => {
    if (!shipmentId || chosen.length === 0) return;
    const res = await load.mutateAsync({ shipmentId, parcelIds: chosen.map((p) => p.id) });
    toast.success(`${res.loaded} colis chargés`, { description: `${formatKg(res.weight_kg)} · ${formatCbm(res.cbm)}` });
    navigate(back, { replace: true });
  };

  return (
    <div className={cn('flex min-h-[100dvh] flex-col', SURFACE.canvas)}>
      <ScreenTop title={shipment ? `Charger ${boxNo(shipment.container_number)}` : 'Charger la boîte'} backTo={back} step={all.length ? `${chosen.length}/${all.length}` : undefined} />
      <div className="flex-1 px-5 pb-6 pt-4">
        {all.length === 0 ? <EmptyLine>Rien n'attend à l'entrepôt pour ce client.</EmptyLine> : (
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
                          <span className={cn('block truncate text-[15px] tabular-nums', TEXT.muted)}>{[p.description || labels.kind(p.kind), formatKg(p.weight_kg), formatCbm(p.cbm)].join(' · ')}</span>
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
          {chosen.length > 0 ? `Charger ${chosen.length} colis · ${formatCbm(cbm)}` : 'Charger'}
        </BigButton>
      </Dock>
    </div>
  );
}
