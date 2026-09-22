// ============================================================
// ENTREPÔT — Pointer les colis d'une arrivée, contre le manifeste.
//
// Le geste rapide : un colis est là, en bon état → on touche sa ligne, il
// est pointé (vert, une vibration). Tout le reste (abîmé, manquant, déjà
// pointé) passe par SA fiche, un écran à part, via le chevron. En haut : la
// progression et un champ pour taper un numéro. En bas : « Tout pointer » et
// « Terminer » (le bilan). La place (« B3 ») est un réglage discret.
// ============================================================
import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { CheckCheck, ClipboardCheck, MapPin } from 'lucide-react';
import { toast } from 'sonner';
import { MobileHeader } from '@/mobile/components/layout/MobileHeader';
import { useCheckinMany, useCheckinParcel, useFindParcel, useWarehouseArrival } from '@/hooks/useWarehouse';
import { checkinSummary, findScannedParcel, groupParcelsByClient, isPending, nParcels, parseWarehouseScan, type WarehouseParcel } from '@/lib/warehouse';
import { cn } from '@/lib/utils';
import { SURFACE, TEXT, TYPE, BottomSheet, Card, FormField, PrimaryPill, ScreenError, ScreenLoader, SoftPill, TextInput } from '@/mobile/designKit';
import { BottomBar, ClientHead, ParcelLine } from '@/mobile/components/warehouse/bits';
import { ParcelScanBox, type ScanResult } from '@/mobile/components/cargo/ParcelScanBox';

const PLACE_KEY = 'bonzini-warehouse-place';
const readPlace = () => { try { return sessionStorage.getItem(PLACE_KEY) ?? ''; } catch { return ''; } };

export function WarehouseCheckin() {
  const navigate = useNavigate();
  const { kind, id } = useParams<{ kind: 'air' | 'sea'; id: string }>();
  const { data, isLoading, error, refetch } = useWarehouseArrival(kind, id);
  const checkin = useCheckinParcel();
  const checkinMany = useCheckinMany();
  const find = useFindParcel();
  const [place, setPlace] = useState(readPlace);
  const [placeOpen, setPlaceOpen] = useState(false);
  const [placeDraft, setPlaceDraft] = useState('');
  const [allOpen, setAllOpen] = useState(false);

  const parcels = useMemo(() => data?.parcels ?? [], [data]);
  const groups = useMemo(() => groupParcelsByClient(parcels), [parcels]);
  const sum = checkinSummary(parcels);
  const pending = parcels.filter(isPending);
  const base = `/w/arrivees/${kind}/${id}`;

  const savePlace = (v: string) => { setPlace(v); try { sessionStorage.setItem(PLACE_KEY, v); } catch { /* privé */ } };
  const open = (p: WarehouseParcel) => navigate(`${base}/colis/${p.id}`);
  const tap = (p: WarehouseParcel) => {
    if (!isPending(p)) { open(p); return; }
    try { navigator.vibrate?.(40); } catch { /* pas de vibreur */ }
    checkin.mutate({ parcelId: p.id, location: place || undefined, condition: 'ok' });
  };

  // Une lecture (douchette, caméra, numéro tapé) : présent et pas encore vu → pointé,
  // déjà vu → on le dit, pas dans cette arrivée → on dit où il est.
  const onScan = async (text: string): Promise<ScanResult> => {
    const local = findScannedParcel(text, parcels);
    if (local) {
      if (local.delivered_at) return { outcome: 'refused', text: `${local.parcel_no} a déjà été remis` };
      if (!isPending(local)) return { outcome: 'again', text: `${local.parcel_no} déjà pointé` };
      try {
        await checkin.mutateAsync({ parcelId: local.id, location: place || undefined, condition: 'ok' });
        return { outcome: 'ok', text: `${local.parcel_no} pointé${place ? ` · ${place}` : ''}` };
      } catch (e) { return { outcome: 'refused', text: (e as Error).message }; }
    }
    const scan = parseWarehouseScan(text);
    if (!scan || scan.kind !== 'parcel') return { outcome: 'unknown', text: `${text.trim()} : ce n'est pas un numéro de colis` };
    try {
      const p = await find.mutateAsync(scan.no);
      const where = p.awb_number ? `il voyage par LTA ${p.awb_number}` : p.container_number ? `il voyage dans ${p.container_number}` : 'il n\'a pas quitté la Chine';
      return { outcome: 'unknown', text: `${p.parcel_no} n'est pas dans cette arrivée : ${where}` };
    } catch { return { outcome: 'unknown', text: `${text.trim()} : colis inconnu` }; }
  };

  if (isLoading) return <ScreenLoader className="min-h-[100dvh]" />;
  if (error || !data) return <ScreenError description={(error as Error | null)?.message ?? 'Arrivée introuvable'} onRetry={() => void refetch()} />;

  return (
    <div className={cn('flex min-h-full flex-col', SURFACE.canvas)}>
      <MobileHeader title={data.label} subtitle={data.sub ?? undefined} showBack backTo="/w/arrivees" />
      <div className="space-y-5 px-4 pb-44 pt-4">
        <Card className="space-y-3">
          <div className="flex items-end justify-between gap-3">
            <span>
              <span className={cn('block', TYPE.small, TEXT.muted)}>Pointés</span>
              <span className={cn('block text-[32px] font-semibold leading-tight tabular-nums', TEXT.strong)}>{sum.seen} <span className={cn('text-[18px] font-normal', TEXT.muted)}>/ {sum.total}</span></span>
            </span>
            <span className={cn('text-right tabular-nums', TYPE.small, TEXT.muted)}>
              {sum.pending > 0 ? <span className="block font-semibold text-[#975102] dark:text-[#E8B931]">{sum.pending} à pointer</span> : <span className="block font-semibold text-[#009951] dark:text-[#14AE5C]">Tout est pointé</span>}
              {sum.damaged > 0 && <span className="block">{sum.damaged} abîmé{sum.damaged > 1 ? 's' : ''}</span>}
              {sum.missing > 0 && <span className="block font-semibold text-[#C00F0C] dark:text-[#EC221F]">{sum.missing} manquant{sum.missing > 1 ? 's' : ''}</span>}
              {sum.delivered > 0 && <span className="block">{sum.delivered} déjà remis</span>}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-[#E6E6E6] dark:bg-[#444444]"><div className="h-full rounded-full bg-[#14AE5C] transition-all" style={{ width: `${sum.total ? Math.round((sum.seen / sum.total) * 100) : 0}%` }} /></div>
          <ParcelScanBox onScan={onScan} placeholder="Scannez un carton ou tapez son numéro" />
          <button type="button" onClick={() => { setPlaceDraft(place); setPlaceOpen(true); }} className={cn('flex h-10 w-full items-center gap-2 text-left', TYPE.small, TEXT.muted)}>
            <MapPin className="h-4 w-4 shrink-0" />
            <span className="flex-1">{place ? <>Les colis pointés vont en <b className={TEXT.strong}>{place}</b></> : 'Où rangez-vous les colis ? (facultatif)'}</span>
            <span className={cn('font-semibold', TEXT.strong)}>{place ? 'Changer' : 'Indiquer'}</span>
          </button>
        </Card>

        <p className={cn(TYPE.body, TEXT.muted)}>Scannez l'étiquette Bonzini de chaque carton, ou touchez un colis présent pour le pointer. Un souci ? Ouvrez sa fiche avec la flèche.</p>

        {groups.map((g) => (
          <Card key={g.client?.user_id ?? 'none'} className="py-0">
            <div className="py-3"><ClientHead client={g.client} size="md" sub={`${g.client?.customer_code ? `${g.client.customer_code} · ` : ''}${nParcels(g.parcels.length)}`} /></div>
            {g.parcels.map((p) => <ParcelLine key={p.id} parcel={p} onTap={() => tap(p)} onOpen={() => open(p)} disabled={!!p.delivered_at} />)}
          </Card>
        ))}
      </div>

      <BottomBar>
        {pending.length > 0 && (
          <SoftPill onClick={() => setAllOpen(true)} className="h-12 w-full text-[16px]"><CheckCheck /> Tout pointer ({pending.length})</SoftPill>
        )}
        <PrimaryPill onClick={() => navigate(`${base}/bilan`)} className="h-14 w-full text-[17px]"><ClipboardCheck /> Terminer le pointage</PrimaryPill>
      </BottomBar>

      <BottomSheet open={placeOpen} onClose={() => setPlaceOpen(false)} title="Où rangez-vous les colis ?">
        <div className="space-y-4">
          <p className={cn(TYPE.body, TEXT.muted)}>Une étagère, une zone : « B3 », « zone fragile ». Elle sera notée sur chaque colis pointé après.</p>
          <FormField label="Place dans l'entrepôt" htmlFor="wh-place"><TextInput id="wh-place" value={placeDraft} onChange={(e) => setPlaceDraft(e.target.value)} placeholder="B3" autoFocus className="h-14 text-[18px]" /></FormField>
          <PrimaryPill onClick={() => { savePlace(placeDraft.trim()); setPlaceOpen(false); }} className="h-14 w-full text-[17px]">{placeDraft.trim() ? `Ranger en ${placeDraft.trim()}` : 'Sans place'}</PrimaryPill>
        </div>
      </BottomSheet>

      <BottomSheet open={allOpen} onClose={() => setAllOpen(false)} title={`Tout pointer (${pending.length})`}>
        <div className="space-y-4">
          <p className={cn(TYPE.body, TEXT.strong)}>Les {nParcels(pending.length)} restants sont tous là, en bon état ?</p>
          <p className={cn(TYPE.body, TEXT.muted)}>Si un colis est abîmé ou manque, pointez-le d'abord depuis sa fiche.</p>
          <PrimaryPill onClick={() => { checkinMany.mutate({ parcelIds: pending.map((p) => p.id), location: place || undefined }, { onSuccess: () => { setAllOpen(false); toast.success(`${nParcels(pending.length)} pointés`); } }); }} loading={checkinMany.isPending} className="h-14 w-full text-[17px]"><CheckCheck /> Oui, tout pointer</PrimaryPill>
          <SoftPill onClick={() => setAllOpen(false)} className="h-12 w-full text-[16px]">Non, je vérifie</SoftPill>
        </div>
      </BottomSheet>
    </div>
  );
}
