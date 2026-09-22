// ============================================================
// Mobile admin — Cargo › Avion › charger des colis reçus dans cet avion.
//
// Même geste que pour une boîte : la liste de ce qui attend (le bureau,
// Air cargo, en premier), dépôt par dépôt ; on coche ; le bas additionne ;
// on charge. Un colis non soldé se charge quand même — c'est signalé.
// ============================================================
import { useMemo, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { Check } from 'lucide-react';
import { toast } from 'sonner';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { MobileHeader } from '@/mobile/components/layout/MobileHeader';
import { useAirLoadParcels, useAirLoadableParcels, useAirShipment } from '@/hooks/useAirShipments';
import { awbLabel, flightSentence, parcelUnpaid, type AirParcel } from '@/lib/airShipment';
import { clientFullName, formatCbm, formatDims, formatKg } from '@/lib/reception';
import { cn } from '@/lib/utils';
import { SURFACE, TEXT, TYPE, Card, PrimaryPill, ScreenLoader } from '@/mobile/designKit';
import { LocationMark, formatDateTime, useReceptionLabels } from '@/mobile/components/reception/bits';
import { ParcelScanBox, type ScanResult } from '@/mobile/components/cargo/ParcelScanBox';
import { findScannedParcel } from '@/lib/warehouse';

const BOX = (on: boolean) => cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-md border', on ? 'border-[#2C2C2C] bg-[#2C2C2C] text-white dark:border-[#E3E3E3] dark:bg-[#E3E3E3] dark:text-[#1E1E1E]' : 'border-[#949494]');

export function MobileCargoAirLoad() {
  const navigate = useNavigate();
  const { airId } = useParams<{ airId: string }>();
  const { hasPermission } = useAdminAuth();
  const labels = useReceptionLabels();
  const { data: a } = useAirShipment(airId);
  const { data, isLoading } = useAirLoadableParcels(airId);
  const load = useAirLoadParcels();
  const [picked, setPicked] = useState<Set<string>>(new Set());

  const groups = useMemo(() => {
    const by = new Map<string, { deposit_no: string; opened_at?: string; location?: AirParcel['location']; client: AirParcel['client']; parcels: AirParcel[] }>();
    for (const p of data ?? []) {
      const g = by.get(p.deposit_id) ?? { deposit_no: p.deposit_no, opened_at: p.opened_at, location: p.location, client: p.client, parcels: [] };
      g.parcels.push(p); by.set(p.deposit_id, g);
    }
    return [...by.values()];
  }, [data]);

  if (!hasPermission('canManageCargo')) return <Navigate to="/m/cargo/avion" replace />;
  if (isLoading || !data) return <ScreenLoader className="min-h-[100dvh]" />;

  const chosen = data.filter((p) => picked.has(p.id));
  const kg = chosen.reduce((s, p) => s + Number(p.weight_kg ?? 0), 0);
  const cbm = chosen.reduce((s, p) => s + Number(p.cbm ?? 0), 0);
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
    <div className={cn('flex h-[100dvh] flex-col', SURFACE.canvas)}>
      <MobileHeader title="Charger dans l'avion" subtitle={a ? `${awbLabel(a)} · ${flightSentence(a)}` : undefined} showBack backTo={`/m/cargo/avion/${airId}`} />
      <div className="flex-1 space-y-5 overflow-y-auto px-4 pb-6 pt-4">
        {data.length === 0 ? (
          <Card className={cn('text-center', SURFACE.inset, 'border-0')}><p className={cn(TYPE.body, TEXT.muted)}>Rien n'attend au bureau ni à l'entrepôt.</p></Card>
        ) : (
          <>
            <p className={cn(TYPE.body, TEXT.muted)}>{data.length} colis attendent. Le bureau (Air cargo) en premier. Scannez ou cochez ceux qui montent dans cet avion.</p>
            <ParcelScanBox onScan={onScan} counter={`${chosen.length} / ${data.length}`} />
            {groups.map((g) => {
              const every = g.parcels.every((p) => picked.has(p.id));
              return (
                <Card key={g.deposit_no} className="py-0">
                  <button type="button" onClick={() => toggleGroup(g.parcels)} className="flex w-full items-center gap-3 py-3 text-left">
                    <span className={BOX(every)}>{every && <Check className="h-4 w-4" strokeWidth={3} />}</span>
                    <span className="min-w-0 flex-1">
                      <span className={cn('block tabular-nums', TYPE.bodyStrong, TEXT.strong)}>{g.deposit_no}{g.client ? ` · ${clientFullName(g.client)}` : ''}</span>
                      <span className={cn('mt-0.5 flex items-center gap-2', TYPE.small, TEXT.muted)}>{g.location && <LocationMark location={g.location} size={18} />}{g.opened_at ? formatDateTime(g.opened_at) : ''} · {g.parcels.length} colis{g.parcels.some(parcelUnpaid) ? ' · non soldé' : ' · payé'}</span>
                    </span>
                  </button>
                  {g.parcels.map((p) => {
                    const on = picked.has(p.id);
                    return (
                      <button key={p.id} type="button" onClick={() => toggle(p.id)} aria-pressed={on} className={cn('flex w-full items-center gap-3 border-t py-3 text-left', SURFACE.divider)}>
                        <span className={BOX(on)}>{on && <Check className="h-4 w-4" strokeWidth={3} />}</span>
                        <span className="min-w-0 flex-1">
                          <span className={cn('block', TYPE.body, TEXT.strong)}><span className={cn('mr-2 tabular-nums', TEXT.muted)}>{String(p.seq).padStart(2, '0')}</span>{p.description || labels.kind(p.kind)}</span>
                          <span className={cn('mt-0.5 block tabular-nums', TYPE.small, TEXT.muted)}>{formatKg(p.weight_kg)} · {formatDims(p)} · {formatCbm(p.cbm)}</span>
                        </span>
                      </button>
                    );
                  })}
                </Card>
              );
            })}
          </>
        )}
      </div>
      <div className={cn('shrink-0 space-y-3 border-t px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4', SURFACE.canvas, SURFACE.divider)}>
        <div className={cn('flex items-center justify-between', TYPE.body)}>
          <span className={TEXT.muted}>Sélection</span>
          <span className={cn('font-semibold tabular-nums', TEXT.strong)}>{chosen.length} colis · {formatKg(kg)} · {formatCbm(cbm)}</span>
        </div>
        <PrimaryPill onClick={() => void submit()} disabled={chosen.length === 0} loading={load.isPending} className="h-14 w-full text-[17px]">
          Charger {chosen.length > 0 ? `${chosen.length} colis` : ''} dans l'avion
        </PrimaryPill>
      </div>
    </div>
  );
}
