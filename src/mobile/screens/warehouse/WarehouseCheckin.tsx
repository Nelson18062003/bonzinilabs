// ============================================================
// ENTREPÔT — Pointer une arrivée contre le manifeste.
//
// La liste des colis attendus, client par client. Un colis présent : on le
// touche, il est pointé (vert). Un souci : on ouvre la fiche — abîmé (avec
// une note), manquant, une place (« B3 »). En haut : la progression, un
// champ pour taper ou scanner un numéro, « Tout pointer » pour le reste.
// ============================================================
import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, Check, CheckCheck, MapPin, PackageX, Search } from 'lucide-react';
import { toast } from 'sonner';
import { MobileHeader } from '@/mobile/components/layout/MobileHeader';
import { useCheckinMany, useCheckinParcel, useFlagMissing, useFindParcel, useWarehouseArrival } from '@/hooks/useWarehouse';
import { parseWarehouseScan, warehouseStage, type WarehouseParcel } from '@/lib/warehouse';
import { clientFullName, formatDims, formatKg, initials } from '@/lib/reception';
import { cn } from '@/lib/utils';
import { SURFACE, TEXT, TYPE, BottomSheet, Card, FormField, Holder, PrimaryPill, ScreenLoader, SoftPill, StatusPill, TextInput } from '@/mobile/designKit';
import { TextArea } from '@/components/form';
import { useReceptionLabels } from '@/mobile/components/reception/bits';

export function WarehouseCheckin() {
  const navigate = useNavigate();
  const { kind, id } = useParams<{ kind: 'air' | 'sea'; id: string }>();
  const labels = useReceptionLabels();
  const { data, isLoading } = useWarehouseArrival(kind, id);
  const checkin = useCheckinParcel();
  const checkinMany = useCheckinMany();
  const flag = useFlagMissing();
  const find = useFindParcel();
  const [query, setQuery] = useState('');
  const [place, setPlace] = useState('');
  const [open, setOpen] = useState<WarehouseParcel | null>(null);
  const [note, setNote] = useState('');
  const [rowPlace, setRowPlace] = useState('');

  const parcels = useMemo(() => data?.parcels ?? [], [data]);
  const groups = useMemo(() => {
    const by = new Map<string, { client: WarehouseParcel['client']; parcels: WarehouseParcel[] }>();
    for (const p of parcels) { const k = p.client?.user_id ?? '∅'; const g = by.get(k) ?? { client: p.client, parcels: [] }; g.parcels.push(p); by.set(k, g); }
    return [...by.values()];
  }, [parcels]);
  const pending = parcels.filter((p) => !p.checked_in_at && !p.delivered_at && p.condition !== 'missing');
  const checked = parcels.filter((p) => p.checked_in_at && !p.delivered_at).length;
  const delivered = parcels.filter((p) => p.delivered_at).length;
  const missing = parcels.filter((p) => p.condition === 'missing').length;

  const tap = (p: WarehouseParcel) => {
    if (p.delivered_at) return;
    if (p.checked_in_at || p.condition === 'missing') { setOpen(p); setNote(p.condition_note ?? ''); setRowPlace(p.warehouse_location ?? ''); return; }
    try { navigator.vibrate?.(40); } catch { /* pas de vibreur */ }
    checkin.mutate({ parcelId: p.id, location: place || undefined, condition: 'ok' });
  };

  const lookup = async () => {
    const scan = parseWarehouseScan(query);
    if (!scan || scan.kind !== 'parcel') { toast.error('Tapez un numéro de colis, comme RC-000123-01'); return; }
    const local = parcels.find((p) => p.parcel_no === scan.no);
    if (local) { tap(local); setQuery(''); return; }
    try {
      const p = await find.mutateAsync(scan.no);
      toast.error(`${p.parcel_no} n'est pas dans cette arrivée`, { description: p.awb_number ? `Il voyage par LTA ${p.awb_number}` : p.container_number ? `Il voyage dans ${p.container_number}` : 'Il n\'a pas quitté la Chine' });
    } catch (e) { toast.error((e as Error).message); }
  };

  return (
    <div className={cn('flex min-h-full flex-col', SURFACE.canvas)}>
      <MobileHeader title={data?.label ?? 'Arrivée'} subtitle={data?.sub ?? undefined} showBack backTo="/w/arrivees" />
      {isLoading || !data ? <ScreenLoader className="min-h-[60dvh]" /> : (
        <div className="space-y-5 px-4 pb-10 pt-4">
          <Card className="space-y-3">
            <div className="flex items-end justify-between">
              <span>
                <span className={cn('block', TYPE.small, TEXT.muted)}>Pointés</span>
                <span className={cn('block text-[28px] font-semibold leading-tight tabular-nums', TEXT.strong)}>{checked + delivered} <span className={cn('text-[18px] font-normal', TEXT.muted)}>/ {parcels.length}</span></span>
              </span>
              <span className={cn('text-right tabular-nums', TYPE.small, TEXT.muted)}>
                {pending.length > 0 && <span className="block font-semibold text-[#975102] dark:text-[#E8B931]">{pending.length} à pointer</span>}
                {missing > 0 && <span className="block font-semibold text-[#C00F0C] dark:text-[#EC221F]">{missing} manquant{missing > 1 ? 's' : ''}</span>}
                {delivered > 0 && <span className="block">{delivered} déjà remis</span>}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-[#E6E6E6] dark:bg-[#444444]"><div className="h-full rounded-full bg-[#14AE5C] transition-all" style={{ width: `${parcels.length ? Math.round(((checked + delivered) / parcels.length) * 100) : 0}%` }} /></div>
            <div className="relative">
              <Search className={cn('pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2', TEXT.muted)} />
              <TextInput value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void lookup(); }} inputMode="text" placeholder="Numéro de colis, scanné ou tapé" className="h-12 pl-12" aria-label="Numéro de colis" />
            </div>
            <div className="relative">
              <MapPin className={cn('pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2', TEXT.muted)} />
              <TextInput value={place} onChange={(e) => setPlace(e.target.value)} placeholder="Place pour les prochains pointés (B3, zone 2…)" className="h-12 pl-12" aria-label="Place dans l'entrepôt" />
            </div>
            {pending.length > 0 && (
              <PrimaryPill onClick={() => checkinMany.mutate({ parcelIds: pending.map((p) => p.id), location: place || undefined })} loading={checkinMany.isPending} className="h-14 w-full text-[17px]">
                <CheckCheck /> Tout pointer ({pending.length}) — tout est là, conforme
              </PrimaryPill>
            )}
          </Card>

          {groups.map((g) => {
            const name = g.client ? clientFullName(g.client) : 'Client à attribuer';
            return (
              <Card key={g.client?.user_id ?? 'none'} className="py-0">
                <div className="flex items-center gap-3 py-3">
                  <Holder size="md" tone={g.client ? 'neutral' : 'pending'}>{g.client ? initials(name) : '?'}</Holder>
                  <span className="min-w-0 flex-1">
                    <span className={cn('block', TYPE.bodyStrong, TEXT.strong)}>{name}</span>
                    <span className={cn('block tabular-nums', TYPE.small, TEXT.muted)}>{g.client?.customer_code ? `${g.client.customer_code} · ` : ''}{g.parcels.length} colis</span>
                  </span>
                </div>
                {g.parcels.map((p) => {
                  const st = warehouseStage(p);
                  const done = !!p.checked_in_at || !!p.delivered_at;
                  return (
                    <button key={p.id} type="button" onClick={() => tap(p)} disabled={!!p.delivered_at} className={cn('flex w-full items-center gap-3 border-t py-3 text-left', SURFACE.divider, p.delivered_at && 'opacity-60')}>
                      <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border-2', done && p.condition !== 'damaged' ? 'border-[#14AE5C] bg-[#14AE5C] text-white' : p.condition === 'damaged' ? 'border-[#E8B931] bg-[#E8B931] text-[#1E1E1E]' : p.condition === 'missing' ? 'border-[#EC221F] text-[#EC221F]' : 'border-[#949494]')}>
                        {done && p.condition !== 'damaged' && <Check className="h-5 w-5" strokeWidth={3} />}
                        {p.condition === 'damaged' && <AlertTriangle className="h-5 w-5" />}
                        {p.condition === 'missing' && <PackageX className="h-5 w-5" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className={cn('block tabular-nums', TYPE.body, TEXT.strong)}><b>{p.parcel_no}</b> · {p.description || labels.kind(p.kind)}</span>
                        <span className={cn('block tabular-nums', TYPE.small, TEXT.muted)}>{formatKg(p.weight_kg)} · {formatDims(p)}{p.warehouse_location ? ` · place ${p.warehouse_location}` : ''}{p.condition_note ? ` · ${p.condition_note}` : ''}</span>
                      </span>
                      <StatusPill tone={st.tone} label={st.label} />
                    </button>
                  );
                })}
              </Card>
            );
          })}
        </div>
      )}

      <BottomSheet open={open !== null} onClose={() => setOpen(null)} title={open?.parcel_no}>
        {open && (
          <div className="space-y-4">
            <p className={cn(TYPE.body, TEXT.muted)}>{open.description || labels.kind(open.kind)} · {formatKg(open.weight_kg)} · {open.client ? clientFullName(open.client) : 'client à attribuer'}</p>
            <FormField label="Place dans l'entrepôt" htmlFor="ck-place"><TextInput id="ck-place" value={rowPlace} onChange={(e) => setRowPlace(e.target.value)} placeholder="B3, zone fragile…" className="h-12" /></FormField>
            <TextArea id="ck-note" label="Remarque (abîmé, ouvert, mouillé…)" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Facultatif" controlClassName="min-h-[64px]" />
            <div className="grid grid-cols-1 gap-2">
              <PrimaryPill onClick={() => { checkin.mutate({ parcelId: open.id, location: rowPlace || undefined, condition: 'ok' }); setOpen(null); }} className="h-14 w-full text-[17px]"><Check /> Présent, conforme</PrimaryPill>
              <SoftPill onClick={() => { checkin.mutate({ parcelId: open.id, location: rowPlace || undefined, condition: 'damaged', note }); setOpen(null); }} className="h-12 w-full text-[16px]"><AlertTriangle /> Présent, abîmé</SoftPill>
              {open.condition === 'missing' ? (
                <SoftPill onClick={() => { flag.mutate({ parcelId: open.id, missing: false }); setOpen(null); }} className="h-12 w-full text-[16px]">Finalement retrouvé</SoftPill>
              ) : (
                <SoftPill onClick={() => { flag.mutate({ parcelId: open.id, missing: true, note }); setOpen(null); }} className="h-12 w-full text-[16px] text-[#C00F0C] dark:text-[#EC221F]"><PackageX /> Manquant, jamais vu</SoftPill>
              )}
            </div>
            <button type="button" className="hidden" aria-hidden="true" onClick={() => navigate('/w')} />
          </div>
        )}
      </BottomSheet>
    </div>
  );
}
