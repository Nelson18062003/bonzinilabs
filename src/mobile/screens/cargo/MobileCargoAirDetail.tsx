// ============================================================
// Mobile admin — Cargo › Avion › une expédition.
//
// En haut la fiche (LTA, vol, dates) et l'état. Puis LE bouton du moment :
// « L'avion est parti » ou « L'avion est arrivé à Douala » — les colis
// suivent tout seuls. Puis les colis, client par client, avec « payé » ou
// « reste … » (ce que Douala regardera). « Charger des colis » tant que
// l'avion n'est pas arrivé ; « Manifeste (PDF) » toujours.
// ============================================================
import { useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { FileText, PackagePlus, Pencil, Plane, PlaneLanding, PlaneTakeoff, Trash2, Undo2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { MobileHeader } from '@/mobile/components/layout/MobileHeader';
import { useAirShipment, useAirUnloadParcel, useSetAirStatus } from '@/hooks/useAirShipments';
import { airStatusMeta, awbLabel, flightSentence, fmtDay, groupByClient, nextAirStep, parcelUnpaid, type AirParcel } from '@/lib/airShipment';
import { deliverAirManifestPdf } from '@/lib/airManifestPdf';
import { xaf } from '@/lib/cargoQuote';
import { clientFullName, formatCbm, formatDims, formatKg, initials } from '@/lib/reception';
import { cn } from '@/lib/utils';
import { SURFACE, TEXT, TYPE, BottomSheet, Card, Holder, PrimaryPill, Row, ScreenLoader, SoftPill, StatusPill } from '@/mobile/designKit';
import { formatDateTime, useReceptionLabels } from '@/mobile/components/reception/bits';

function payLabel(p: AirParcel): { text: string; bad: boolean } {
  const total = Number(p.quote_total_xaf ?? 0); const paid = Number(p.quote_paid_xaf ?? 0);
  if (total <= 0) return { text: 'sans prix', bad: true };
  if (paid >= total) return { text: p.invoice_no ? `facturé ${p.invoice_no}` : 'payé', bad: false };
  return { text: `reste ${xaf(total - paid)}`, bad: true };
}

export function MobileCargoAirDetail() {
  const navigate = useNavigate();
  const { airId } = useParams<{ airId: string }>();
  const { hasPermission } = useAdminAuth();
  const labels = useReceptionLabels();
  const { data: a, isLoading } = useAirShipment(airId);
  const setStatus = useSetAirStatus();
  const unload = useAirUnloadParcel();
  const [confirm, setConfirm] = useState<'next' | 'back' | null>(null);

  if (!hasPermission('canViewCargo')) return <Navigate to="/m" replace />;
  if (isLoading || !a) return <ScreenLoader className="min-h-[100dvh]" />;

  const canManage = hasPermission('canManageCargo');
  const st = airStatusMeta(a.status);
  const next = nextAirStep(a.status);
  const parcels = a.parcels ?? [];
  const groups = groupByClient(parcels);
  const canLoad = canManage && (a.status === 'PLANNED' || a.status === 'DEPARTED');

  const step = async (to: 'PLANNED' | 'DEPARTED' | 'ARRIVED') => {
    setConfirm(null);
    const s = await setStatus.mutateAsync({ id: a.id, status: to });
    toast.success(to === 'DEPARTED' ? `Parti · ${s.parcel_count} colis en vol` : to === 'ARRIVED' ? 'Arrivé à Douala' : 'Retour en préparation');
  };

  return (
    <div className={cn('flex min-h-full flex-col', SURFACE.canvas)}>
      <MobileHeader title={awbLabel(a)} subtitle={flightSentence(a)} showBack backTo="/m/cargo/avion" />

      <div className="space-y-5 px-4 pb-10 pt-4">
        <Card className="space-y-3">
          <div className="flex items-center gap-3">
            <span className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-white', a.status === 'DEPARTED' ? 'bg-[#0B5FA5]' : 'bg-[#C8102E]')}><Plane className="h-6 w-6" /></span>
            <span className="min-w-0 flex-1">
              <span className={cn('block', TYPE.bodyStrong, TEXT.strong)}>{a.origin} → {a.destination}</span>
              <span className={cn('block tabular-nums', TYPE.small, TEXT.muted)}>{a.parcel_count} colis · {formatKg(a.total_weight_kg)} · {formatCbm(a.total_cbm)}</span>
            </span>
            <StatusPill tone={st.tone} label={st.short} />
          </div>
          <div className={cn('border-t', SURFACE.divider)}>
            <Row label="Départ" value={a.departed_at ? `Parti le ${formatDateTime(a.departed_at)}` : a.etd ? `Prévu le ${fmtDay(a.etd)}` : '—'} />
            <Row label="Arrivée" value={a.arrived_at ? `Arrivé le ${formatDateTime(a.arrived_at)}` : a.eta ? `Prévue le ${fmtDay(a.eta)}` : '—'} />
            {a.freight_usd != null && <Row label="Fret" value={`${Number(a.freight_usd).toLocaleString('fr-FR')} USD`} />}
            {a.notes && <Row label="Notes" value={a.notes} />}
          </div>
          {canManage && next && (
            <PrimaryPill onClick={() => setConfirm('next')} className="h-14 w-full text-[17px]" disabled={a.status === 'PLANNED' && parcels.length === 0}>
              {a.status === 'PLANNED' ? <PlaneTakeoff /> : <PlaneLanding />} {next.label}
            </PrimaryPill>
          )}
          {canManage && a.status === 'PLANNED' && parcels.length === 0 && <p className={cn(TYPE.small, TEXT.muted)}>Chargez des colis avant de marquer le départ.</p>}
          <div className="flex flex-wrap gap-2">
            <SoftPill onClick={() => void deliverAirManifestPdf(a)} disabled={parcels.length === 0} className="h-11 flex-1 text-[15px]"><FileText /> Manifeste (PDF)</SoftPill>
            {canManage && <SoftPill onClick={() => navigate(`/m/cargo/avion/${a.id}/modifier`)} className="h-11 px-4 text-[15px]"><Pencil /> Fiche</SoftPill>}
            {canManage && a.status === 'DEPARTED' && <SoftPill onClick={() => setConfirm('back')} className="h-11 px-4 text-[15px]"><Undo2 /> Pas parti</SoftPill>}
          </div>
        </Card>

        <section>
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className={cn(TYPE.lead, TEXT.strong)}>Les colis</h2>
            <span className={cn('tabular-nums', TYPE.small, a.unpaid_count > 0 ? 'font-semibold text-[#975102] dark:text-[#E8B931]' : TEXT.muted)}>
              {a.unpaid_count > 0 ? `${a.unpaid_count} non soldé${a.unpaid_count > 1 ? 's' : ''}` : parcels.length > 0 ? 'tout payé' : ''}
            </span>
          </div>
          {canLoad && (
            <PrimaryPill onClick={() => navigate(`/m/cargo/avion/${a.id}/charger`)} className="mb-3 h-14 w-full text-[17px]"><PackagePlus /> Charger des colis</PrimaryPill>
          )}
          {groups.length === 0 ? (
            <Card className={cn('text-center', SURFACE.inset, 'border-0')}><p className={cn(TYPE.body, TEXT.muted)}>Aucun colis dans cette expédition.</p></Card>
          ) : groups.map((g) => {
            const name = g.client ? clientFullName(g.client) : 'Client à attribuer';
            return (
              <Card key={g.key} className="mb-3 py-0">
                <button type="button" disabled={!g.client} onClick={() => g.client && navigate(`/m/clients/${g.client.user_id}`)} className="flex w-full items-center gap-3 py-3 text-left">
                  <Holder size="md" tone={g.client ? 'neutral' : 'pending'}>{g.client ? initials(name) : '?'}</Holder>
                  <span className="min-w-0 flex-1">
                    <span className={cn('block', TYPE.bodyStrong, TEXT.strong)}>{name}</span>
                    <span className={cn('block tabular-nums', TYPE.small, TEXT.muted)}>{g.client?.customer_code ? `${g.client.customer_code} · ` : ''}{g.parcels.length} colis · {formatKg(g.kg)}</span>
                  </span>
                  {g.unpaid ? <StatusPill tone="pending" label="À encaisser" /> : <StatusPill tone="success" label="Payé" />}
                </button>
                {g.parcels.map((p) => {
                  const pay = payLabel(p);
                  return (
                    <div key={p.id} className={cn('flex items-center gap-3 border-t py-3', SURFACE.divider)}>
                      <span className="min-w-0 flex-1">
                        <span className={cn('block', TYPE.body, TEXT.strong)}><span className={cn('mr-2 tabular-nums', TEXT.muted)}>{p.parcel_no}</span>{p.description || labels.kind(p.kind)}</span>
                        <span className={cn('mt-0.5 block tabular-nums', TYPE.small, TEXT.muted)}>{formatKg(p.weight_kg)} · {formatDims(p)} · <span className={cn(pay.bad && 'font-semibold text-[#975102] dark:text-[#E8B931]')}>{pay.text}</span></span>
                      </span>
                      {canManage && a.status === 'PLANNED' && (
                        <button type="button" onClick={() => unload.mutate(p.id)} aria-label={`Retirer ${p.parcel_no}`} className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-full', SURFACE.holder)}><Trash2 className="h-4 w-4" /></button>
                      )}
                    </div>
                  );
                })}
              </Card>
            );
          })}
          {parcels.some(parcelUnpaid) && <p className={cn(TYPE.small, TEXT.muted)}>Un colis non soldé voyage quand même ; Douala ne le remettra qu'une fois le devis réglé.</p>}
        </section>
      </div>

      <BottomSheet open={confirm !== null} onClose={() => setConfirm(null)} title={confirm === 'back' ? "L'avion n'est pas parti ?" : next?.label}>
        <div className="space-y-4">
          <p className={cn(TYPE.body, TEXT.muted)}>
            {confirm === 'back' ? `Les ${parcels.length} colis repassent « chargés », en préparation.` : a.status === 'PLANNED' ? `Les ${parcels.length} colis passent « en vol ». Le client peut voir que sa marchandise a quitté la Chine.` : `Les ${parcels.length} colis passent « arrivés ». L'entrepôt de Douala pourra les pointer et les remettre.`}
          </p>
          <PrimaryPill onClick={() => void step(confirm === 'back' ? 'PLANNED' : next!.to)} loading={setStatus.isPending} className="h-14 w-full text-[17px]">Confirmer</PrimaryPill>
        </div>
      </BottomSheet>
    </div>
  );
}
