// ============================================================
// Desktop admin — charger des colis reçus dans cette boîte, en dialogue :
// la table de ce qui attend à l'entrepôt pour le client de la boîte, des
// cases à cocher par dépôt et par colis, la sélection qui s'additionne en
// bas, un seul bouton. Les colis passent à « chargé » et suivent la boîte.
// ============================================================
import { useMemo, useState } from 'react';
import { Check } from 'lucide-react';
import { toast } from 'sonner';
import { useLoadParcels, useLoadableParcels } from '@/hooks/useReception';
import { clientFullName, formatCbm, formatDims, formatKg, type ParcelWithDeposit } from '@/lib/reception';
import { LocationMark, formatDateTime, useReceptionLabels } from '@/mobile/components/reception/bits';
import { cn } from '@/lib/utils';
import { TEXT, SOFT_PILL, PRIMARY_PILL, CenterDialog, ScreenLoader, Th, Td } from '@/desktop/designKit';

function Box({ on, mixed }: { on: boolean; mixed?: boolean }) {
  return (
    <span className={cn('inline-flex h-[18px] w-[18px] items-center justify-center rounded-[4px] border', on || mixed ? 'border-foreground bg-foreground text-background' : 'border-input bg-background')}>
      {on && <Check className="h-3 w-3" strokeWidth={3} />}
      {!on && mixed && <span className="h-[2px] w-2 rounded bg-background" />}
    </span>
  );
}

export function LoadParcelsDialog({ shipmentId, open, onClose, containerLabel }: { shipmentId: string; open: boolean; onClose: () => void; containerLabel?: string }) {
  const labels = useReceptionLabels();
  const { data, isLoading } = useLoadableParcels(open ? shipmentId : null);
  const load = useLoadParcels();
  const [picked, setPicked] = useState<Set<string>>(new Set());

  const groups = useMemo(() => {
    const by = new Map<string, { deposit_no: string; opened_at?: string; location?: ParcelWithDeposit['location']; client: ParcelWithDeposit['client']; parcels: ParcelWithDeposit[] }>();
    for (const p of data?.parcels ?? []) {
      const g = by.get(p.deposit_id) ?? { deposit_no: p.deposit_no, opened_at: p.opened_at, location: p.location, client: p.client, parcels: [] };
      g.parcels.push(p);
      by.set(p.deposit_id, g);
    }
    return [...by.values()];
  }, [data]);

  const all = data?.parcels ?? [];
  const chosen = all.filter((p) => picked.has(p.id));
  const kg = chosen.reduce((s, p) => s + Number(p.weight_kg ?? 0), 0);
  const cbm = chosen.reduce((s, p) => s + Number(p.cbm ?? 0), 0);
  const toggle = (id: string) => setPicked((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const toggleGroup = (ps: ParcelWithDeposit[]) => setPicked((s) => { const n = new Set(s); const every = ps.every((p) => n.has(p.id)); for (const p of ps) { if (every) n.delete(p.id); else n.add(p.id); } return n; });
  const toggleAll = () => setPicked((s) => (s.size === all.length ? new Set() : new Set(all.map((p) => p.id))));

  const submit = async () => {
    if (chosen.length === 0) return;
    const res = await load.mutateAsync({ shipmentId, parcelIds: chosen.map((p) => p.id) });
    toast.success(`${res.loaded} colis chargés`, { description: `${formatKg(res.weight_kg)} · ${formatCbm(res.cbm)}` });
    setPicked(new Set());
    onClose();
  };

  return (
    <CenterDialog
      open={open}
      onClose={onClose}
      onConfirm={() => void submit()}
      width={820}
      title={<span>Charger des colis reçus{containerLabel ? <span className={cn('ml-2 font-mono text-[13px] font-normal', TEXT.muted)}>{containerLabel}</span> : null}</span>}
      bodyClassName="-mx-5 -mb-1 mt-1"
      footer={
        <>
          <span className={cn('mr-auto text-[13px] tabular-nums', TEXT.body)}>
            <b className={TEXT.strong}>{chosen.length} colis</b> · {formatKg(kg)} · {formatCbm(cbm)}
          </span>
          <button type="button" onClick={onClose} className={cn('inline-flex h-9 items-center px-3.5 text-[13px] font-semibold', SOFT_PILL)}>Annuler</button>
          <button type="button" onClick={() => void submit()} disabled={chosen.length === 0 || load.isPending} className={cn('inline-flex h-9 items-center gap-2 px-4 text-[13px] font-bold disabled:opacity-50', PRIMARY_PILL)}>
            Charger {chosen.length > 0 ? `${chosen.length} colis` : ''} dans la boîte
          </button>
        </>
      }
    >
      {isLoading || !data ? (
        <ScreenLoader />
      ) : all.length === 0 ? (
        <p className={cn('px-5 py-10 text-center text-[13px]', TEXT.muted)}>Rien n'attend à l'entrepôt pour ce client.</p>
      ) : (
        <div className="max-h-[52vh] overflow-auto">
          <p className={cn('px-5 pb-3 pt-1 text-[13px]', TEXT.muted)}>{all.length} colis attendent à l'entrepôt{data.client_user_id ? ' pour ce client' : ''}. Cochez ceux qui montent dans cette boîte.</p>
          <table className="w-full text-left">
            <thead>
              <tr>
                <Th first className="w-[44px]"><button type="button" onClick={toggleAll} aria-label="Tout cocher"><Box on={picked.size === all.length} mixed={picked.size > 0 && picked.size < all.length} /></button></Th>
                <Th>Colis</Th>
                <Th align="right">Poids</Th>
                <Th align="right">Dimensions</Th>
                <Th align="right" last>m³</Th>
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => {
                const every = g.parcels.every((p) => picked.has(p.id));
                const some = g.parcels.some((p) => picked.has(p.id));
                return [
                  <tr key={g.deposit_no} onClick={() => toggleGroup(g.parcels)} className="cursor-pointer bg-muted/40">
                    <Td first><Box on={every} mixed={!every && some} /></Td>
                    <Td className="whitespace-normal" >
                      <span className={cn('inline-flex items-center gap-2 text-[12.5px] font-bold', TEXT.strong)}>
                        {g.location && <LocationMark location={g.location} size={16} />}
                        <span className="font-mono">{g.deposit_no}</span>
                        {g.client && <span className="font-semibold">· {clientFullName(g.client)}</span>}
                        <span className={cn('font-normal', TEXT.muted)}>· {g.opened_at ? formatDateTime(g.opened_at) : ''} · {g.parcels.length} colis</span>
                      </span>
                    </Td>
                    <Td /><Td /><Td last />
                  </tr>,
                  ...g.parcels.map((p) => {
                    const on = picked.has(p.id);
                    return (
                      <tr key={p.id} onClick={() => toggle(p.id)} className={cn('cursor-pointer transition-colors hover:bg-muted/30', on && 'bg-accent')}>
                        <Td first><Box on={on} /></Td>
                        <Td><span className={cn('mr-2 font-mono text-[12px]', TEXT.muted)}>{String(p.seq).padStart(2, '0')}</span><span className="text-[13px] font-semibold">{p.description || labels.kind(p.kind)}</span></Td>
                        <Td align="right"><span className="text-[13px] tabular-nums">{formatKg(p.weight_kg)}</span></Td>
                        <Td align="right"><span className={cn('text-[12.5px] tabular-nums', TEXT.muted)}>{formatDims(p)}</span></Td>
                        <Td align="right" last><span className="text-[13px] tabular-nums">{formatCbm(p.cbm)}</span></Td>
                      </tr>
                    );
                  }),
                ];
              })}
            </tbody>
          </table>
        </div>
      )}
    </CenterDialog>
  );
}
