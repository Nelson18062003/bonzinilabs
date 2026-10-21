// ============================================================
// Mobile admin — Cargo › Avion › une expédition (refonte v2, maquette 04/05).
//
// En grand « 6 paquets », la LTA et le vol, l'état ; la fiche en trois
// lignes (trajet et dates, fret, clients non soldés) ; puis le scan au
// départ, paquet par paquet. LE bouton du moment en bas : « Scanner les
// paquets » tant qu'il en manque, puis « L'avion est parti », puis
// « L'avion est arrivé à Douala » — les colis suivent tout seuls.
// Dans « … » : ajouter des paquets, charger des colis, modifier la fiche,
// pas parti, avis d'expédition (PDF). Les colis, client par client, avec
// « payé » ou « reste … », s'ouvrent en feuille.
// ============================================================
import { useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { FileText, PackagePlus, Pencil, Plane, ScanLine, Undo2, Users } from 'lucide-react';
import { toast } from 'sonner';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { useAirShipment, useAirUnloadParcel, useSetAirStatus } from '@/hooks/useAirShipments';
import { airStatusMeta, awbLabel, departureBlocker, groupByClient, nextAirStep, type AirParcel } from '@/lib/airShipment';
import { deliverAirNoticePdf } from '@/lib/shippingNoticePdf';
import { xaf } from '@/lib/cargoQuote';
import { clientFullName, formatKg } from '@/lib/reception';
import { cn } from '@/lib/utils';
import {
  ActionSheet, BigButton, BottomSheet, ConfirmSheet, Dock, IconCircle, Initials, ItemList, ItemRow, KVBox, MoreButton, ScreenLoader, ScreenTop, SURFACE, TEXT, Tag, type KV,
} from '@/mobile/designKit';
import { useReceptionLabels } from '@/mobile/components/reception/bits';
import { AirPackagesV2, departureCount } from '@/mobile/components/cargo/AirPackagesV2';
import { RowButton } from '@/mobile/components/cargo/v2';

const day = (iso: string | null | undefined) => (iso ? new Date(iso.length === 10 ? `${iso}T00:00:00` : iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : '—');

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
  /** Le refus du serveur sur le jalon (ex. paquets pas scannés), affiché dans la feuille. */
  const [stepError, setStepError] = useState<string | null>(null);
  const [more, setMore] = useState(false);
  const [parcelsOpen, setParcelsOpen] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [adding, setAdding] = useState(false);
  const [scannedNow, setScannedNow] = useState<Set<string>>(new Set());

  if (!hasPermission('canViewCargo')) return <Navigate to="/m" replace />;
  if (isLoading || !a) return <ScreenLoader className="min-h-[100dvh]" />;

  const canManage = hasPermission('canManageCargo');
  const st = airStatusMeta(a.status);
  const next = nextAirStep(a.status);
  const parcels = a.parcels ?? [];
  const groups = groupByClient(parcels);
  const canLoad = canManage && (a.status === 'PLANNED' || a.status === 'DEPARTED');
  const blocker = departureBlocker(a);
  const count = departureCount(a, scannedNow);
  const leftToScan = a.status === 'PLANNED' && count.total > 0 && count.scanned < count.total;

  const openConfirm = (c: 'next' | 'back') => { setStepError(null); setConfirm(c); };
  const step = async (to: 'PLANNED' | 'DEPARTED' | 'ARRIVED') => {
    setStepError(null);
    try {
      const s = await setStatus.mutateAsync({ id: a.id, status: to });
      setConfirm(null);
      toast.success(to === 'DEPARTED' ? `Parti · ${s.parcel_count} colis en vol` : to === 'ARRIVED' ? 'Arrivé à Douala' : 'Retour en préparation');
    } catch (e) {
      setStepError((e as Error).message);
    }
  };
  const notice = () => void deliverAirNoticePdf(a).then((o) => { if (o === 'downloaded') toast.success('Avis d’expédition téléchargé'); }).catch((e: Error) => toast.error(e.message));

  const rows: KV[] = [
    { label: `${a.origin} → ${a.destination}`, value: `${a.departed_at ? day(a.departed_at) : day(a.etd)} → ${a.arrived_at ? day(a.arrived_at) : day(a.eta)}` },
    { label: 'Fret', value: `${formatKg(a.total_weight_kg)} · ${a.parcel_count} colis` },
    ...(a.freight_usd != null ? [{ label: 'Prix du fret', value: `${Number(a.freight_usd).toLocaleString('fr-FR')} USD` }] : []),
    { label: 'Clients', value: `${a.client_count}${a.unpaid_count > 0 ? ` · ${a.unpaid_count} non soldé${a.unpaid_count > 1 ? 's' : ''}` : ''}`, tone: a.unpaid_count > 0 ? 'danger' as const : undefined, onClick: parcels.length ? () => setParcelsOpen(true) : undefined },
    ...((a.status === 'ARRIVED' || a.status === 'DELIVERED') ? [{ label: 'À Douala', value: `${a.checked_count ?? 0}/${a.parcel_count} pointés${(a.missing_count ?? 0) > 0 ? ` · ${a.missing_count} manquant${(a.missing_count ?? 0) > 1 ? 's' : ''}` : ''}` }] : []),
    ...(a.notes ? [{ label: 'Notes', value: a.notes }] : []),
  ];

  // Le bouton noir du moment.
  const dock = !canManage ? null
    : a.status === 'PLANNED' && parcels.length === 0 && count.total === 0 ? <BigButton onClick={() => setAdding(true)}>Ajouter des paquets</BigButton>
    : leftToScan ? <BigButton onClick={() => setScanning((v) => !v)}>{scanning ? 'Terminer le scan' : 'Scanner les paquets'}</BigButton>
    : next ? <BigButton onClick={() => openConfirm('next')}>{next.label}</BigButton>
    : null;

  const big = count.total > 0 ? `${count.total} paquet${count.total > 1 ? 's' : ''}` : `${a.parcel_count} colis`;

  return (
    <div className={cn('flex min-h-[100dvh] flex-col pb-6', SURFACE.canvas)}>
      <ScreenTop title="Avion" backTo="/m/cargo/avion" right={<MoreButton onClick={() => setMore(true)} />} />

      <div className="px-5 pt-6 text-center">
        <span className="mx-auto flex w-fit"><IconCircle icon={Plane} size="lg" /></span>
        <p className={cn('mt-4 text-[48px] font-bold leading-none tracking-[-0.03em] tabular-nums', TEXT.strong)}>{big}</p>
        <p className={cn('mt-2 text-[16px] tabular-nums', TEXT.muted)}>{[awbLabel(a), a.flight_no || a.airline].filter(Boolean).join(' · ')}</p>
        <div className="mt-3 flex justify-center"><Tag tone={st.tone}>{st.short}</Tag></div>
      </div>

      <div className="px-5 pt-6"><KVBox rows={rows} /></div>

      <AirPackagesV2
        shipment={a}
        scanning={scanning}
        adding={adding}
        onAddingChange={setAdding}
        scannedNow={scannedNow}
        onScanned={(no, add) => setScannedNow((s) => { const n = new Set(s); if (add) n.add(no); else n.delete(no); return n; })}
      />

      {parcels.length > 0 && (
        <ItemList className="pt-4">
          <ItemRow leading={<IconCircle icon={Users} />} title="Les colis, par client" subtitle={`${groups.length} client${groups.length > 1 ? 's' : ''} · ${parcels.length} colis`} onClick={() => setParcelsOpen(true)} chevron />
        </ItemList>
      )}

      {dock && <Dock>{dock}</Dock>}

      <ActionSheet
        open={more}
        onClose={() => setMore(false)}
        actions={[
          { label: 'Scanner au départ', icon: ScanLine, hidden: !canManage || a.status !== 'PLANNED' || count.total === 0 || leftToScan, onClick: () => { setMore(false); setScanning(true); } },
          { label: 'Ajouter des paquets', icon: PackagePlus, hidden: !canManage || a.status !== 'PLANNED', onClick: () => { setMore(false); setAdding(true); } },
          { label: 'Charger des colis', icon: PackagePlus, hidden: !canLoad, onClick: () => navigate(`/m/cargo/avion/${a.id}/charger`) },
          { label: 'Modifier la fiche', icon: Pencil, hidden: !canManage, onClick: () => navigate(`/m/cargo/avion/${a.id}/modifier`) },
          { label: 'L’avion n’est pas parti', icon: Undo2, hidden: !canManage || a.status !== 'DEPARTED', onClick: () => { setMore(false); openConfirm('back'); } },
          { label: 'Avis d’expédition (PDF)', icon: FileText, disabled: parcels.length === 0, onClick: () => { setMore(false); notice(); } },
        ]}
      />

      <BottomSheet open={parcelsOpen} onClose={() => setParcelsOpen(false)} title="Les colis">
        {groups.map((g) => {
          const name = g.client ? clientFullName(g.client) : 'Client à attribuer';
          return (
            <div key={g.key} className="pb-3">
              <button type="button" disabled={!g.client} onClick={() => g.client && navigate(`/m/clients/${g.client.user_id}`)} className="flex w-full items-center gap-3.5 py-3 text-left">
                <Initials name={name} />
                <span className="min-w-0 flex-1">
                  <span className={cn('block text-[17px] font-semibold', TEXT.strong)}>{name}</span>
                  <span className={cn('block text-[15px] tabular-nums', TEXT.muted)}>{[g.client?.customer_code, `${g.parcels.length} colis`, formatKg(g.kg)].filter(Boolean).join(' · ')}</span>
                </span>
                <Tag tone={g.unpaid ? 'pending' : 'success'}>{g.unpaid ? 'À encaisser' : 'Payé'}</Tag>
              </button>
              {g.parcels.map((p) => {
                const pay = payLabel(p);
                return (
                  <div key={p.id} className={cn('flex items-center gap-3 border-t py-3 pl-[58px]', SURFACE.divider)}>
                    <span className="min-w-0 flex-1">
                      <span className={cn('block truncate text-[16px] font-medium', TEXT.strong)}>{p.description || labels.kind(p.kind)}</span>
                      <span className={cn('block truncate text-[15px] tabular-nums', TEXT.muted)}>
                        {[p.parcel_no, formatKg(p.weight_kg), p.package_no].filter(Boolean).join(' · ')} · <span className={cn(pay.bad && 'font-semibold text-[#975102] dark:text-[#E8B931]')}>{pay.text}</span>
                      </span>
                    </span>
                    {/* Un colis emballé suit son paquet : il ne se retire pas seul (la base refuse). */}
                    {canManage && a.status === 'PLANNED' && !p.air_package_id && <RowButton onClick={() => unload.mutate(p.id)}>Retirer</RowButton>}
                  </div>
                );
              })}
            </div>
          );
        })}
      </BottomSheet>

      <ConfirmSheet
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        title={confirm === 'back' ? "L'avion n'est pas parti ?" : next?.label ?? ''}
        rows={[
          { label: 'Colis', value: `${parcels.length}${count.total > 0 ? ` · ${count.total} paquet${count.total > 1 ? 's' : ''}` : ''}` },
          { label: 'État', before: st.short, value: confirm === 'back' ? 'Préparation' : next?.to === 'DEPARTED' ? 'En vol' : 'Arrivé' },
        ]}
        confirmLabel="Confirmer"
        onConfirm={() => void step(confirm === 'back' ? 'PLANNED' : next!.to)}
        loading={setStatus.isPending}
      >
        {confirm === 'next' && blocker && <p className="mt-3 text-[15px] font-semibold text-[#975102] dark:text-[#E8B931]">{count.total - count.scanned} paquet{count.total - count.scanned > 1 ? 's' : ''} pas encore scanné{count.total - count.scanned > 1 ? 's' : ''}</p>}
        {stepError && <p className="mt-3 text-[15px] font-semibold text-[#C00F0C] dark:text-[#FCB3AD]">{stepError}</p>}
      </ConfirmSheet>
    </div>
  );
}
