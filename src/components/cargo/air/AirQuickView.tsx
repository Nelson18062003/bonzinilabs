// ============================================================
// Desktop admin — une expédition aérienne en dialogue centré (le pendant de
// DepositQuickView) : la fiche (LTA, vol, dates, fret), le jalon du moment,
// les colis client par client avec « payé / reste », le chargement de colis
// reçus (table à cocher, en place), le manifeste PDF.
// ============================================================
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, FileText, PackagePlus, Pencil, PlaneLanding, PlaneTakeoff, Trash2, Undo2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { useAirLoadParcels, useAirLoadableParcels, useAirShipment, useAirUnloadParcel } from '@/hooks/useAirShipments';
import { airStatusMeta, awbLabel, flightSentence, fmtDay, groupByClient, nextAirStep, parcelUnpaid, type AirParcel } from '@/lib/airShipment';
import { deliverAirManifestPdf } from '@/lib/airManifestPdf';
import { xaf } from '@/lib/cargoQuote';
import { clientFullName, formatCbm, formatDims, formatKg, initials } from '@/lib/reception';
import { Band, Fact, Facts } from '@/components/cargo/dossier/kit';
import { LocationMark, formatDateTime, useReceptionLabels } from '@/mobile/components/reception/bits';
import { cn } from '@/lib/utils';
import { TEXT, SOFT_PILL, PRIMARY_PILL, CenterDialog, Holder, ScreenLoader, StatusPill, Th, Td } from '@/desktop/designKit';
import { useSetAirStatus } from '@/hooks/useAirShipments';

function payCell(p: AirParcel) {
  const total = Number(p.quote_total_xaf ?? 0); const paid = Number(p.quote_paid_xaf ?? 0);
  if (total <= 0) return <StatusPill tone="neutral" label="Sans prix" />;
  if (paid >= total) return <StatusPill tone="success" label={p.invoice_no ? 'Facturé' : 'Payé'} />;
  return <StatusPill tone="pending" label={`reste ${xaf(total - paid)}`} />;
}

export function AirQuickView({ airId, onClose }: { airId: string | null; onClose: () => void }) {
  const navigate = useNavigate();
  const { hasPermission } = useAdminAuth();
  const labels = useReceptionLabels();
  const { data: a } = useAirShipment(airId ?? undefined);
  const setStatus = useSetAirStatus();
  const unload = useAirUnloadParcel();
  const load = useAirLoadParcels();
  const [loading, setLoading] = useState(false);
  const { data: loadable } = useAirLoadableParcels(loading ? airId : null);
  const [picked, setPicked] = useState<Set<string>>(new Set());

  const canManage = hasPermission('canManageCargo');
  const parcels = useMemo(() => a?.parcels ?? [], [a]);
  const groups = useMemo(() => groupByClient(parcels), [parcels]);
  const st = a ? airStatusMeta(a.status) : null;
  const next = a ? nextAirStep(a.status) : null;
  const canLoad = !!a && canManage && (a.status === 'PLANNED' || a.status === 'DEPARTED');

  const step = async (to: 'PLANNED' | 'DEPARTED' | 'ARRIVED') => {
    if (!a) return;
    const s = await setStatus.mutateAsync({ id: a.id, status: to });
    toast.success(to === 'DEPARTED' ? `Parti · ${s.parcel_count} colis en vol` : to === 'ARRIVED' ? 'Arrivé à Douala' : 'Retour en préparation');
  };
  const toggle = (id: string) => setPicked((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const submitLoad = async () => {
    if (!a || picked.size === 0) return;
    const res = await load.mutateAsync({ id: a.id, parcelIds: [...picked] });
    toast.success(`${res.loaded} colis chargés`, { description: `${formatKg(res.weight_kg)} · ${formatCbm(res.cbm)}` });
    setPicked(new Set()); setLoading(false);
  };

  return (
    <CenterDialog
      open={!!airId}
      onClose={onClose}
      width={800}
      title={a ? (
        <span className="flex items-center gap-3">
          <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white', a.status === 'DEPARTED' ? 'bg-[#0B5FA5]' : 'bg-[#C8102E]')}><PlaneTakeoff className="h-4 w-4" /></span>
          <span className="min-w-0">
            <span className={cn('block text-[15px] font-bold tabular-nums', TEXT.strong)}>{awbLabel(a)} · {flightSentence(a)}</span>
            <span className={cn('block text-[12px]', TEXT.muted)}>{a.origin} → {a.destination} · {a.parcel_count} colis · {formatKg(a.total_weight_kg)}</span>
          </span>
          {st && <StatusPill tone={st.tone} label={st.label} className="ml-auto" />}
        </span>
      ) : 'Expédition aérienne'}
      bodyClassName="-mx-5 -mb-1 mt-1"
      footer={a ? (
        <>
          <button type="button" onClick={() => void deliverAirManifestPdf(a)} disabled={parcels.length === 0} className={cn('inline-flex h-9 items-center gap-2 px-3.5 text-[13px] font-semibold disabled:opacity-50', SOFT_PILL)}><FileText className="h-4 w-4" /> Manifeste (PDF)</button>
          {canManage && <button type="button" onClick={() => { onClose(); navigate(`/m/cargo/avion/${a.id}/modifier`); }} className={cn('inline-flex h-9 items-center gap-2 px-3.5 text-[13px] font-semibold', SOFT_PILL)}><Pencil className="h-4 w-4" /> Fiche</button>}
          {canManage && a.status === 'DEPARTED' && <button type="button" onClick={() => void step('PLANNED')} className={cn('inline-flex h-9 items-center gap-2 px-3.5 text-[13px] font-semibold', SOFT_PILL)}><Undo2 className="h-4 w-4" /> Pas parti</button>}
          {canManage && next && (
            <button type="button" onClick={() => void step(next.to)} disabled={setStatus.isPending || (a.status === 'PLANNED' && parcels.length === 0)} className={cn('inline-flex h-9 items-center gap-2 px-4 text-[13px] font-bold disabled:opacity-50', PRIMARY_PILL)}>
              {a.status === 'PLANNED' ? <PlaneTakeoff className="h-4 w-4" /> : <PlaneLanding className="h-4 w-4" />} {next.label}
            </button>
          )}
        </>
      ) : undefined}
    >
      {!a ? <ScreenLoader /> : (
        <>
          <Band first>
            <Facts cols={4}>
              <Fact label="Départ" value={a.departed_at ? formatDateTime(a.departed_at) : a.etd ? fmtDay(a.etd) : '—'} hint={a.departed_at ? 'réel' : a.etd ? 'prévu' : undefined} />
              <Fact label="Arrivée" value={a.arrived_at ? formatDateTime(a.arrived_at) : a.eta ? fmtDay(a.eta) : '—'} hint={a.arrived_at ? 'réel' : a.eta ? 'prévue' : undefined} />
              <Fact label="Fret" value={a.freight_usd != null ? `${Number(a.freight_usd).toLocaleString('fr-FR')} USD` : '—'} />
              <Fact label="Clients" value={String(a.client_count)} hint={a.unpaid_count > 0 ? `${a.unpaid_count} colis non soldé${a.unpaid_count > 1 ? 's' : ''}` : parcels.length > 0 ? 'tout payé' : undefined} />
            </Facts>
            {a.notes && <p className={cn('mt-3 text-[13px]', TEXT.muted)}>{a.notes}</p>}
          </Band>

          <Band
            title="Les colis"
            meta={<span className="inline-flex items-center gap-2">
              {parcels.length > 0 && <span>{parcels.length} colis · {formatKg(a.total_weight_kg)} · {formatCbm(a.total_cbm)}</span>}
              {canLoad && !loading && <button type="button" onClick={() => setLoading(true)} className={cn('inline-flex h-7 items-center gap-1.5 px-2.5 text-[11.5px] font-semibold', SOFT_PILL)}><PackagePlus className="h-3.5 w-3.5" /> Charger des colis</button>}
            </span>}
          >
            {loading && (
              <div className="mb-4 rounded-md border border-border p-3">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <span className={cn('text-[13px] font-semibold', TEXT.strong)}>Ce qui attend — le bureau (Air cargo) en premier</span>
                  <span className="flex items-center gap-2">
                    <button type="button" onClick={() => void submitLoad()} disabled={picked.size === 0 || load.isPending} className={cn('inline-flex h-8 items-center gap-1.5 px-3 text-[12px] font-bold disabled:opacity-50', PRIMARY_PILL)}>Charger {picked.size > 0 ? `${picked.size} colis` : ''}</button>
                    <button type="button" onClick={() => { setLoading(false); setPicked(new Set()); }} className={cn('inline-flex h-8 items-center px-3 text-[12px] font-semibold', SOFT_PILL)}>Fermer</button>
                  </span>
                </div>
                {!loadable ? <ScreenLoader /> : loadable.length === 0 ? <p className={cn('py-3 text-center text-[13px]', TEXT.muted)}>Rien n'attend au bureau ni à l'entrepôt.</p> : (
                  <div className="max-h-[260px] overflow-auto">
                    <table className="w-full text-left">
                      <thead><tr><Th first className="w-[36px]" /><Th>Colis</Th><Th>Client</Th><Th>Lieu</Th><Th align="right">Poids</Th><Th align="right">m³</Th><Th last>Devis</Th></tr></thead>
                      <tbody>
                        {loadable.map((p) => {
                          const on = picked.has(p.id);
                          return (
                            <tr key={p.id} onClick={() => toggle(p.id)} className={cn('cursor-pointer hover:bg-muted/40', on && 'bg-accent')}>
                              <Td first><span className={cn('flex h-5 w-5 items-center justify-center rounded border', on ? 'border-foreground bg-foreground text-background' : 'border-muted-foreground')}>{on && <Check className="h-3.5 w-3.5" strokeWidth={3} />}</span></Td>
                              <Td><div className={cn('font-mono text-[12px] font-bold', TEXT.strong)}>{p.parcel_no}</div><div className={cn('text-[12px]', TEXT.muted)}>{p.description || labels.kind(p.kind)}</div></Td>
                              <Td><span className="text-[12.5px]">{p.client ? clientFullName(p.client) : 'À attribuer'}</span></Td>
                              <Td>{p.location && <span className="inline-flex items-center gap-1.5 text-[12px]"><LocationMark location={p.location} size={16} />{labels.location(p.location)}</span>}</Td>
                              <Td align="right"><span className="text-[12.5px] tabular-nums">{formatKg(p.weight_kg)}</span></Td>
                              <Td align="right"><span className="text-[12.5px] tabular-nums">{formatCbm(p.cbm)}</span></Td>
                              <Td last>{payCell(p)}</Td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
            {groups.length === 0 ? (
              <p className={cn('py-4 text-center text-[13px]', TEXT.muted)}>Aucun colis dans cette expédition.</p>
            ) : (
              <div className="-mx-5 max-h-[380px] overflow-auto">
                <table className="w-full text-left">
                  <thead><tr><Th first>N°</Th><Th>Client</Th><Th>Ce qu'il y a dedans</Th><Th align="right">Poids</Th><Th align="right">m³</Th><Th>Devis</Th><Th last className="w-[36px]" /></tr></thead>
                  <tbody>
                    {groups.map((g) => {
                      const name = g.client ? clientFullName(g.client) : 'Client à attribuer';
                      return g.parcels.map((p, i) => (
                        <tr key={p.id}>
                          <Td first><span className={cn('font-mono text-[12px] font-bold', TEXT.strong)}>{p.parcel_no}</span></Td>
                          <Td>{i === 0 && (
                            <span className="inline-flex items-center gap-2">
                              <Holder size="sm" tone={g.client ? 'neutral' : 'pending'}>{g.client ? initials(name) : '?'}</Holder>
                              <span className="min-w-0"><span className={cn('block text-[13px] font-semibold', TEXT.strong)}>{name}</span><span className={cn('block font-mono text-[11px]', TEXT.muted)}>{g.client?.customer_code ?? ''}</span></span>
                            </span>
                          )}</Td>
                          <Td><span className="text-[12.5px]">{p.description || labels.kind(p.kind)}</span></Td>
                          <Td align="right"><span className="text-[12.5px] tabular-nums">{formatKg(p.weight_kg)}</span></Td>
                          <Td align="right"><span className="text-[12.5px] tabular-nums">{formatCbm(p.cbm)}</span><div className={cn('text-[11px] tabular-nums', TEXT.muted)}>{formatDims(p)}</div></Td>
                          <Td>{payCell(p)}</Td>
                          <Td last>{canManage && a.status === 'PLANNED' && <button type="button" onClick={() => unload.mutate(p.id)} aria-label={`Retirer ${p.parcel_no}`} className={cn('inline-flex h-7 w-7 items-center justify-center', SOFT_PILL)}><Trash2 className="h-3.5 w-3.5" /></button>}</Td>
                        </tr>
                      ));
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {parcels.some(parcelUnpaid) && <p className={cn('mt-3 text-[12px]', TEXT.muted)}>Un colis non soldé voyage quand même ; Douala ne le remettra qu'une fois le devis réglé.</p>}
          </Band>
        </>
      )}
    </CenterDialog>
  );
}
