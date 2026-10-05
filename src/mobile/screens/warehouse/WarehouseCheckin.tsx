// ============================================================
// ENTREPÔT — Pointer les colis d'une arrivée, contre le manifeste.
//
// Le geste rapide : un colis est là, en bon état → on touche sa ligne, il
// est pointé (vert, une vibration). Tout le reste (abîmé, manquant, déjà
// pointé) passe par SA fiche, un écran à part, via le chevron. En haut : la
// progression et un champ pour taper un numéro. En bas : « Tout pointer » et
// « Terminer » (le bilan). La place (« B3 ») est un réglage discret.
//
// Avion avec paquets de 32 kg : d'abord les PAQUETS. « Paquets reçus 3 / 5 »
// en grand, ceux qui manquent en rouge, un scan PQ-… les reçoit un par un.
// Puis chaque paquet s'ouvre (?paquet=PQ-…) et ses colis se pointent comme
// avant, « Tout pointer » compris. Les colis hors paquet restent en dessous.
// ============================================================
import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { CheckCheck, ClipboardCheck, MapPin, PackageOpen, PackageX } from 'lucide-react';
import { toast } from 'sonner';
import { MobileHeader } from '@/mobile/components/layout/MobileHeader';
import { useCheckinMany, useCheckinParcel, useFindParcel, useFlagMissingMany, useSetArrivalPackage, useWarehouseArrival } from '@/hooks/useWarehouse';
import { useOpenAirPackage, useReceiveAirPackage } from '@/hooks/useAirPackages';
import { fmtKg1, type AirPackage } from '@/lib/airPackage';
import { isProvisionalAwb } from '@/lib/airShipment';
import {
  PACKAGE_STAGE_META, checkinSummary, findScannedParcel, groupParcelsByClient, isPending, nParcels, packageReceivedWord, packageStage,
  packagesProgress, parcelsByPackage, parseWarehouseScan, type WarehouseParcel,
} from '@/lib/warehouse';
import { cn } from '@/lib/utils';
import { SURFACE, TEXT, TYPE, BottomSheet, Card, FormField, PrimaryPill, ScreenError, ScreenLoader, SoftPill, StatusPill, TextInput } from '@/mobile/designKit';
import { formatDateTime } from '@/mobile/components/reception/bits';
import { BottomBar, ClientHead, ParcelLine } from '@/mobile/components/warehouse/bits';
import { PackageChip, PackageMark, PackageRow, PackagesCounter, PackagesVerdict, ScanNotice } from '@/mobile/components/warehouse/packages';
import { ParcelScanBox, type ScanResult } from '@/mobile/components/cargo/ParcelScanBox';

const PLACE_KEY = 'bonzini-warehouse-place';
const readPlace = () => { try { return sessionStorage.getItem(PLACE_KEY) ?? ''; } catch { return ''; } };

/** Ce que l'écran des arrivées passe quand il a reçu un paquet par le lien /w/arrivees?paquet=… */
type LinkState = { packageScan?: ScanResult } | null;

/** Le grand compteur des colis pointés, avec ce qui reste, abîmé, manquant. */
function CheckinCounter({ sum, label = 'Pointés' }: { sum: ReturnType<typeof checkinSummary>; label?: string }) {
  return (
    <>
      <div className="flex items-end justify-between gap-3">
        <span>
          <span className={cn('block', TYPE.small, TEXT.muted)}>{label}</span>
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
    </>
  );
}

export function WarehouseCheckin() {
  const navigate = useNavigate();
  const location = useLocation();
  const { kind, id } = useParams<{ kind: 'air' | 'sea'; id: string }>();
  const [params, setParams] = useSearchParams();
  const focusNo = params.get('paquet');
  const { data, isLoading, error, refetch } = useWarehouseArrival(kind, id);
  const checkin = useCheckinParcel();
  const checkinMany = useCheckinMany();
  const flagMany = useFlagMissingMany();
  const find = useFindParcel();
  const receive = useReceiveAirPackage();
  const openPkg = useOpenAirPackage();
  const setArrivalPackage = useSetArrivalPackage();
  const [place, setPlace] = useState(readPlace);
  const [placeOpen, setPlaceOpen] = useState(false);
  const [placeDraft, setPlaceDraft] = useState('');
  const [allOpen, setAllOpen] = useState(false);
  const [lostOpen, setLostOpen] = useState(false);
  const [openingId, setOpeningId] = useState<string | null>(null);
  // Un paquet reçu par le lien du scanner (/w/arrivees?paquet=…) : on montre ce qu'il en est, une fois.
  const [notice, setNotice] = useState<ScanResult | null>(() => (location.state as LinkState)?.packageScan ?? null);

  useEffect(() => {
    if ((location.state as LinkState)?.packageScan) navigate({ pathname: location.pathname, search: location.search }, { replace: true, state: null });
  }, [location.state, location.pathname, location.search, navigate]);

  const parcels = useMemo(() => data?.parcels ?? [], [data]);
  const packages = useMemo(() => data?.packages ?? [], [data]);
  const hasPackages = packages.length > 0;
  const split = useMemo(() => parcelsByPackage(parcels), [parcels]);
  const progress = packagesProgress(packages);
  const focus = (focusNo && packages.find((k) => k.package_no === focusNo)) || null;
  const focusStage = focus ? packageStage(focus) : null;
  // Les colis que cet écran montre : ceux du paquet ouvert, les colis hors paquet, ou toute l'arrivée.
  const scope = useMemo(() => (focus ? split.byPackage.get(focus.id) ?? [] : hasPackages ? split.loose : parcels), [focus, split, hasPackages, parcels]);
  const groups = useMemo(() => groupParcelsByClient(scope), [scope]);
  const sum = checkinSummary(focus || !hasPackages ? scope : parcels);
  const pending = scope.filter(isPending);
  const canTap = !focus || focusStage === 'opened';
  const base = `/w/arrivees/${kind}/${id}`;

  const savePlace = (v: string) => { setPlace(v); try { sessionStorage.setItem(PLACE_KEY, v); } catch { /* privé */ } };
  const open = (p: WarehouseParcel) => navigate(`${base}/colis/${p.id}${focus ? `?paquet=${encodeURIComponent(focus.package_no)}` : ''}`);
  const tap = (p: WarehouseParcel) => {
    if (!isPending(p)) { open(p); return; }
    try { navigator.vibrate?.(40); } catch { /* pas de vibreur */ }
    checkin.mutate({ parcelId: p.id, location: place || undefined, condition: 'ok' });
  };
  const showPackage = (no: string) => { setNotice(null); setParams({ paquet: no }); };
  const openPackage = (k: AirPackage) => {
    setOpeningId(k.id);
    openPkg.mutate(k.id, {
      onSuccess: (pkg) => { if (kind && id) setArrivalPackage(kind, id, pkg); toast.success(`${pkg.package_no} ouvert : pointez ses colis`); if (!focus) showPackage(pkg.package_no); },
      onSettled: () => setOpeningId(null),
    });
  };

  // Un paquet scanné (PQ-…) : reçu à l'entrepôt, le compteur avance.
  const receivePackage = async (no: string): Promise<ScanResult> => {
    if (kind !== 'air') return { outcome: 'unknown', text: `${no} est un paquet avion : il ne voyage pas dans cette boîte` };
    try {
      const r = await receive.mutateAsync(no);
      if (id) setArrivalPackage('air', id, r.package);
      return packageReceivedWord(r, id);
    } catch (e) { return { outcome: 'refused', text: (e as Error).message }; }
  };

  // Une lecture (douchette, caméra, numéro tapé) : un paquet → reçu ; un colis présent et pas
  // encore vu → pointé, déjà vu → on le dit, pas dans cette arrivée → on dit où il est.
  const onScan = async (text: string): Promise<ScanResult> => {
    setNotice(null);
    const scan = parseWarehouseScan(text);
    if (scan?.kind === 'package') return receivePackage(scan.no);
    const local = findScannedParcel(text, parcels);
    if (local) {
      const tag = local.package_no ? ` · ${local.package_no}` : '';
      if (local.delivered_at) return { outcome: 'refused', text: `${local.parcel_no} a déjà été remis` };
      // Déclaré manquant (un paquet perdu, retrouvé) : le lire, c'est le retrouver.
      const found = local.condition === 'missing' && !local.checked_in_at;
      if (!isPending(local) && !found) return { outcome: 'again', text: `${local.parcel_no} déjà pointé${tag}` };
      try {
        await checkin.mutateAsync({ parcelId: local.id, location: place || undefined, condition: 'ok' });
        return { outcome: 'ok', text: `${local.parcel_no} ${found ? 'retrouvé, pointé' : 'pointé'}${place ? ` · ${place}` : ''}${tag}` };
      } catch (e) { return { outcome: 'refused', text: (e as Error).message }; }
    }
    if (!scan || scan.kind !== 'parcel') return { outcome: 'unknown', text: `${text.trim()} : ce n'est pas un numéro de colis${kind === 'air' ? ' ni de paquet' : ''}` };
    try {
      const p = await find.mutateAsync(scan.no);
      const where = p.awb_number ? (isProvisionalAwb(p.awb_number) ? 'il voyage par une autre expédition' : `il voyage par LTA ${p.awb_number}`) : p.container_number ? `il voyage dans ${p.container_number}` : 'il n\'a pas quitté la Chine';
      return { outcome: 'unknown', text: `${p.parcel_no} n'est pas dans cette arrivée : ${where}` };
    } catch { return { outcome: 'unknown', text: `${text.trim()} : colis inconnu` }; }
  };

  if (isLoading) return <ScreenLoader className="min-h-[100dvh]" />;
  if (error || !data) return <ScreenError description={(error as Error | null)?.message ?? 'Arrivée introuvable'} onRetry={() => void refetch()} />;

  const placeButton = (
    <button type="button" onClick={() => { setPlaceDraft(place); setPlaceOpen(true); }} className={cn('flex h-10 w-full items-center gap-2 text-left', TYPE.small, TEXT.muted)}>
      <MapPin className="h-4 w-4 shrink-0" />
      <span className="flex-1">{place ? <>Les colis pointés vont en <b className={TEXT.strong}>{place}</b></> : 'Où rangez-vous les colis ? (facultatif)'}</span>
      <span className={cn('font-semibold', TEXT.strong)}>{place ? 'Changer' : 'Indiquer'}</span>
    </button>
  );
  const parcelGroups = groups.map((g) => (
    <Card key={g.client?.user_id ?? 'none'} className="py-0">
      <div className="py-3"><ClientHead client={g.client} size="md" sub={`${g.client?.customer_code ? `${g.client.customer_code} · ` : ''}${nParcels(g.parcels.length)}`} /></div>
      {g.parcels.map((p) => (
        <ParcelLine key={p.id} parcel={p} onTap={canTap ? () => tap(p) : undefined} onOpen={() => open(p)} disabled={!!p.delivered_at}
          badge={p.package_no ? <PackageChip no={p.package_no} /> : undefined} />
      ))}
    </Card>
  ));
  const sheets = (
    <>
      <BottomSheet open={placeOpen} onClose={() => setPlaceOpen(false)} title="Où rangez-vous les colis ?">
        <div className="space-y-4">
          <p className={cn(TYPE.body, TEXT.muted)}>Une étagère, une zone : « B3 », « zone fragile ». Elle sera notée sur chaque colis pointé après.</p>
          <FormField label="Place dans l'entrepôt" htmlFor="wh-place"><TextInput id="wh-place" value={placeDraft} onChange={(e) => setPlaceDraft(e.target.value)} placeholder="B3" autoFocus className="h-14 text-[18px]" /></FormField>
          <PrimaryPill onClick={() => { savePlace(placeDraft.trim()); setPlaceOpen(false); }} className="h-14 w-full text-[17px]">{placeDraft.trim() ? `Ranger en ${placeDraft.trim()}` : 'Sans place'}</PrimaryPill>
        </div>
      </BottomSheet>

      <BottomSheet open={allOpen} onClose={() => setAllOpen(false)} title={`Tout pointer (${pending.length})`}>
        <div className="space-y-4">
          <p className={cn(TYPE.body, TEXT.strong)}>
            {focus ? `Les ${nParcels(pending.length)} restants du paquet ${focus.package_no} sont tous là, en bon état ?`
              : hasPackages ? `Les ${nParcels(pending.length)} hors paquet restants sont tous là, en bon état ?`
              : `Les ${nParcels(pending.length)} restants sont tous là, en bon état ?`}
          </p>
          <p className={cn(TYPE.body, TEXT.muted)}>Si un colis est abîmé ou manque, pointez-le d'abord depuis sa fiche.</p>
          <PrimaryPill onClick={() => { checkinMany.mutate({ parcelIds: pending.map((p) => p.id), location: place || undefined }, { onSuccess: () => { setAllOpen(false); toast.success(`${nParcels(pending.length)} pointés`); } }); }} loading={checkinMany.isPending} className="h-14 w-full text-[17px]"><CheckCheck /> Oui, tout pointer</PrimaryPill>
          <SoftPill onClick={() => setAllOpen(false)} className="h-12 w-full text-[16px]">Non, je vérifie</SoftPill>
        </div>
      </BottomSheet>
    </>
  );

  /* ── Un paquet, ouvert (ou à ouvrir) : ses colis ─────────────────────── */
  if (focus && focusStage) {
    const meta = PACKAGE_STAGE_META[focusStage];
    return (
      <div className={cn('flex min-h-full flex-col', SURFACE.canvas)}>
        <MobileHeader title={focus.package_no} subtitle={data.label} showBack backTo={base} />
        <div className="space-y-5 px-4 pb-44 pt-4">
          <Card className="space-y-3">
            <div className="flex items-center gap-3">
              <PackageMark stage={focusStage} size={48} />
              <span className="min-w-0 flex-1">
                <span className={cn('block tabular-nums', TYPE.title, TEXT.strong)}>{focus.package_no}</span>
                <span className={cn('block tabular-nums', TYPE.small, TEXT.muted)}>{[nParcels(scope.length), Number(focus.net_weight_kg) > 0 ? fmtKg1(focus.net_weight_kg) : null].filter(Boolean).join(' · ')}</span>
              </span>
              <StatusPill tone={meta.tone} label={meta.label} />
            </div>
            {focusStage === 'opened' ? (
              <>
                <CheckinCounter sum={sum} label="Colis pointés dans ce paquet" />
                <ParcelScanBox onScan={onScan} placeholder="Scannez un carton ou tapez son numéro" />
                {placeButton}
              </>
            ) : focusStage === 'received' ? (
              <p className={cn(TYPE.body, TEXT.body)}>Reçu{focus.received_at ? ` le ${formatDateTime(focus.received_at)}` : ''}. Ouvrez-le, puis pointez chacun de ses colis.</p>
            ) : (
              <div className="space-y-1 rounded-lg border-2 border-[#EC221F] bg-[#FEE9E7] p-3 dark:bg-[#900B09]/30" role="alert">
                <p className={cn(TYPE.bodyStrong, 'text-[#900B09] dark:text-[#FDD3D0]')}>Ce paquet n'a pas été reçu</p>
                <p className={cn(TYPE.small, 'text-[#900B09] dark:text-[#FDD3D0]')}>Il est là mais son étiquette ne se lit pas ? Ouvrez-le quand même. Refusé au départ ou perdu ? Déclarez ses colis manquants.</p>
              </div>
            )}
            {notice && <ScanNotice result={notice} />}
          </Card>

          <p className={cn(TYPE.body, TEXT.muted)}>
            {focusStage === 'opened' ? 'Scannez chaque carton du paquet, ou touchez un colis présent pour le pointer. Un souci ? Ouvrez sa fiche avec la flèche.' : `Dans ce paquet : ${nParcels(scope.length)}. Ils se pointent une fois le paquet ouvert.`}
          </p>
          {parcelGroups}

          {focusStage === 'expected' && pending.length > 0 && (
            <SoftPill onClick={() => setLostOpen(true)} className="h-12 w-full text-[16px] text-[#900B09] dark:text-[#FDD3D0]"><PackageX /> Il n'est pas arrivé : déclarer ses {pending.length} colis manquants</SoftPill>
          )}
        </div>

        <BottomBar>
          {focusStage === 'opened' && pending.length > 0 && (
            <SoftPill onClick={() => setAllOpen(true)} className="h-12 w-full text-[16px]"><CheckCheck /> Tout pointer ce paquet ({pending.length})</SoftPill>
          )}
          {focusStage !== 'opened' && (
            <PrimaryPill onClick={() => openPackage(focus)} loading={openPkg.isPending} className="h-14 w-full text-[17px]"><PackageOpen /> Ouvrir le paquet</PrimaryPill>
          )}
          {focusStage === 'opened'
            ? <PrimaryPill onClick={() => navigate(base)} className="h-14 w-full text-[17px]">Retour aux paquets</PrimaryPill>
            : <SoftPill onClick={() => navigate(base)} className="h-12 w-full text-[16px]">Retour aux paquets</SoftPill>}
        </BottomBar>

        {sheets}
        <BottomSheet open={lostOpen} onClose={() => setLostOpen(false)} title={`Déclarer ${pending.length} manquant${pending.length > 1 ? 's' : ''}`}>
          <div className="space-y-4">
            <p className={cn(TYPE.body, TEXT.strong)}>Le paquet {focus.package_no} n'est pas arrivé : {pending.map((p) => p.parcel_no).join(', ')}.</p>
            <p className={cn(TYPE.body, TEXT.muted)}>L'équipe le verra et cherchera avec Guangzhou. S'il arrive plus tard, scannez-le : ses colis se pointeront.</p>
            <PrimaryPill onClick={() => flagMany.mutate({ parcelIds: pending.map((p) => p.id), note: `Paquet ${focus.package_no} non reçu à Douala` }, { onSuccess: (r) => { setLostOpen(false); toast.success(`${nParcels(r.flagged)} déclarés manquants`); } })} loading={flagMany.isPending} className="h-14 w-full bg-[#C00F0C] text-[17px] text-white dark:bg-[#EC221F] dark:text-white"><PackageX /> Oui, manquants</PrimaryPill>
            <SoftPill onClick={() => setLostOpen(false)} className="h-12 w-full text-[16px]">Annuler</SoftPill>
          </div>
        </BottomSheet>
      </div>
    );
  }

  /* ── L'arrivée : les paquets d'abord (avion), puis les colis ─────────── */
  return (
    <div className={cn('flex min-h-full flex-col', SURFACE.canvas)}>
      <MobileHeader title={data.label} subtitle={data.sub ?? undefined} showBack backTo="/w/arrivees" />
      <div className="space-y-5 px-4 pb-44 pt-4">
        {hasPackages && (
          <>
            <Card className="space-y-3">
              <PackagesCounter progress={progress} />
              <ParcelScanBox onScan={onScan} placeholder="Scannez un paquet (PQ-…) ou un carton" />
              {notice && <ScanNotice result={notice} />}
            </Card>
            <PackagesVerdict progress={progress} onShow={showPackage} />
            <section>
              <h2 className={cn('mb-1', TYPE.lead, TEXT.strong)}>Les paquets</h2>
              <p className={cn('mb-3', TYPE.body, TEXT.muted)}>Ouvrez chaque paquet reçu, puis pointez ses colis.</p>
              <Card className="py-0">
                {packages.map((k) => {
                  const s = checkinSummary(split.byPackage.get(k.id) ?? []);
                  return <PackageRow key={k.id} pkg={k} count={s} onShow={() => showPackage(k.package_no)} onOpen={() => openPackage(k)} opening={openingId === k.id} />;
                })}
              </Card>
            </section>
          </>
        )}

        <Card className="space-y-3">
          <CheckinCounter sum={sum} label={hasPackages ? 'Colis pointés (tous paquets)' : 'Pointés'} />
          {!hasPackages && <ParcelScanBox onScan={onScan} placeholder="Scannez un carton ou tapez son numéro" />}
          {!hasPackages && notice && <ScanNotice result={notice} />}
          {placeButton}
        </Card>

        {hasPackages ? (
          split.loose.length > 0 && (
            <div>
              <h2 className={cn('mb-1', TYPE.lead, TEXT.strong)}>Colis hors paquet</h2>
              <p className={cn(TYPE.body, TEXT.muted)}>Ils ont voyagé seuls : touchez un colis présent pour le pointer.</p>
            </div>
          )
        ) : (
          <p className={cn(TYPE.body, TEXT.muted)}>Scannez l'étiquette Bonzini de chaque carton, ou touchez un colis présent pour le pointer. Un souci ? Ouvrez sa fiche avec la flèche.</p>
        )}

        {parcelGroups}
      </div>

      <BottomBar>
        {pending.length > 0 && (
          <SoftPill onClick={() => setAllOpen(true)} className="h-12 w-full text-[16px]"><CheckCheck /> {hasPackages ? `Tout pointer hors paquet (${pending.length})` : `Tout pointer (${pending.length})`}</SoftPill>
        )}
        <PrimaryPill onClick={() => navigate(`${base}/bilan`)} className="h-14 w-full text-[17px]"><ClipboardCheck /> Terminer le pointage</PrimaryPill>
      </BottomBar>

      {sheets}
    </div>
  );
}
