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
//
// Refonte v2 (maquette 04/15) : la progression en barre, la douchette, les
// puces Tous · À pointer · Manquants, une ligne par colis (photo prise à
// Guangzhou à droite). Toucher = pointé en bon état ; appui long (ou la
// photo) = sa fiche (abîmé, place, manquant). « Tout pointer », la place de
// rangement et « Déclarer les manquants » sont dans « … ».
// ============================================================
import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { CheckCheck, MapPin, PackageX } from 'lucide-react';
import { toast } from 'sonner';
import { useCheckinMany, useCheckinParcel, useFindParcel, useFlagMissingMany, useSetArrivalPackage, useWarehouseArrival } from '@/hooks/useWarehouse';
import { useOpenAirPackage, useReceiveAirPackage } from '@/hooks/useAirPackages';
import { fmtKg1, type AirPackage } from '@/lib/airPackage';
import { isProvisionalAwb } from '@/lib/airShipment';
import {
  PACKAGE_STAGE_META, checkinSummary, findScannedParcel, groupParcelsByClient, isPending, nParcels, packageReceivedWord, packageStage,
  packagesProgress, parcelsByPackage, parseWarehouseScan, type WarehouseParcel,
} from '@/lib/warehouse';
import { cn } from '@/lib/utils';
import {
  ActionSheet, BigButton, BottomSheet, ConfirmSheet, Dock, EmptyLine, MoreButton, ScreenLoader, ScreenTop, SURFACE, TEXT, TYPE, Tag, TextInput, useSheet,
} from '@/mobile/designKit';
import { ParcelThumb, formatDateTime } from '@/mobile/components/reception/bits';
import { clientFullName } from '@/lib/reception';
import { PackageRow, PackagesCounter, PackagesVerdict, ScanNotice } from '@/mobile/components/warehouse/packages';
import { ParcelScanBox, type ScanResult } from '@/mobile/components/cargo/ParcelScanBox';
import { ChipRow, InkProgress, StateCircle, useLongPress } from '@/mobile/components/cargo/v2';

const PLACE_KEY = 'bonzini-warehouse-place';
const readPlace = () => { try { return sessionStorage.getItem(PLACE_KEY) ?? ''; } catch { return ''; } };

/** Ce que l'écran des arrivées passe quand il a reçu un paquet par le lien /w/arrivees?paquet=… */
type LinkState = { packageScan?: ScanResult } | null;

type Filter = 'all' | 'todo' | 'missing';

/** Une ligne du pointage : toucher = pointé en bon état ; appui long ou photo = sa fiche. */
function CheckRow({ p, onTap, onOpen, canTap }: { p: WarehouseParcel; onTap: () => void; onOpen: () => void; canTap: boolean }) {
  const long = useLongPress(onOpen);
  const missing = p.condition === 'missing' && !p.checked_in_at;
  const damaged = p.condition === 'damaged';
  const seen = !!p.checked_in_at || !!p.delivered_at;
  const who = p.client ? clientFullName(p.client) : 'Client à attribuer';
  const detail = damaged && p.condition_note ? p.condition_note : seen && p.warehouse_location ? `Rangée ${p.warehouse_location}` : p.description || p.kind;
  return (
    <div className={cn('flex w-full items-center gap-3 border-b py-3.5 last:border-b-0', SURFACE.divider, p.delivered_at && 'opacity-60')}>
      <button
        type="button"
        disabled={!!p.delivered_at}
        onClick={() => { if (long.fired.current) return; if (canTap) onTap(); else onOpen(); }}
        {...long.handlers}
        className="flex min-w-0 flex-1 select-none items-center gap-3.5 text-left active:opacity-70"
      >
        <StateCircle state={missing ? 'alert' : damaged ? 'warn' : seen ? 'done' : 'todo'} />
        <span className="min-w-0 flex-1">
          <span className={cn('block truncate text-[17px] font-semibold tabular-nums', TEXT.strong)}>{p.parcel_no}</span>
          <span className={cn('block truncate text-[15px]', TEXT.muted)}>{who} · {detail}</span>
        </span>
      </button>
      {missing ? <Tag tone="danger">Manquant</Tag>
        : damaged ? <Tag tone="pending">Abîmé</Tag>
        : p.delivered_at ? <Tag tone="neutral">Remis</Tag>
        : seen ? <Tag tone="success">Pointé</Tag>
        : <button type="button" onClick={onOpen} aria-label={`Fiche de ${p.parcel_no}`} className="shrink-0 rounded-lg active:opacity-70"><ParcelThumb path={p.photo_path} size="h-[52px] w-[52px]" /></button>}
    </div>
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
  const [filter, setFilter] = useState<Filter>('all');
  const more = useSheet();
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
  if (error || !data) {
    return (
      <div className={cn('flex min-h-[100dvh] flex-col', SURFACE.canvas)}>
        <ScreenTop title="Pointer" backTo="/w/arrivees" />
        <EmptyLine action={{ label: 'Réessayer', onClick: () => void refetch() }}>{(error as Error | null)?.message ?? 'Arrivée introuvable'}</EmptyLine>
      </div>
    );
  }

  const flat = groups.flatMap((g) => g.parcels);
  const missingList = flat.filter((p) => p.condition === 'missing' && !p.checked_in_at);
  const shown = filter === 'todo' ? flat.filter(isPending) : filter === 'missing' ? missingList : flat;
  const chips = (
    <ChipRow<Filter>
      className="-mx-5"
      options={[
        { value: 'all', label: 'Tous', count: flat.length },
        { value: 'todo', label: 'À pointer', count: pending.length },
        { value: 'missing', label: 'Manquants', count: missingList.length },
      ]}
      value={filter}
      onChange={setFilter}
    />
  );
  const rows = shown.length === 0 ? <EmptyLine>{filter === 'todo' ? 'Tout est pointé.' : filter === 'missing' ? 'Aucun manquant.' : 'Aucun colis.'}</EmptyLine> : (
    <div>
      {shown.map((p) => <CheckRow key={p.id} p={p} canTap={canTap && isPending(p)} onTap={() => tap(p)} onOpen={() => open(p)} />)}
    </div>
  );
  const placeSheet = (
    <BottomSheet open={placeOpen} onClose={() => setPlaceOpen(false)} title="Où rangez-vous les colis ?">
      <div className="space-y-4">
        <TextInput value={placeDraft} onChange={(e) => setPlaceDraft(e.target.value)} placeholder="B3" aria-label="Place dans l'entrepôt" autoFocus className="h-14 text-[18px]" />
        <BigButton onClick={() => { savePlace(placeDraft.trim()); setPlaceOpen(false); }}>{placeDraft.trim() ? `Ranger en ${placeDraft.trim()}` : 'Sans place'}</BigButton>
      </div>
    </BottomSheet>
  );
  const allSheet = (
    <ConfirmSheet
      open={allOpen}
      onClose={() => setAllOpen(false)}
      title={`Tout pointer (${pending.length}) ?`}
      subtitle={focus ? `Paquet ${focus.package_no} · tous là, en bon état` : hasPackages ? 'Hors paquet · tous là, en bon état' : 'Tous là, en bon état'}
      rows={[{ label: 'Colis', value: nParcels(pending.length) }, ...(place ? [{ label: 'Rangée', value: place }] : [])]}
      confirmLabel="Oui, tout pointer"
      cancelLabel="Non, je vérifie"
      loading={checkinMany.isPending}
      onConfirm={() => checkinMany.mutate({ parcelIds: pending.map((p) => p.id), location: place || undefined }, { onSuccess: () => { setAllOpen(false); toast.success(`${nParcels(pending.length)} pointés`); } })}
    />
  );
  const placeAction = { label: 'Où ranger', hint: place ? `Rangée ${place}` : 'Facultatif', icon: MapPin, onClick: () => { setPlaceDraft(place); setPlaceOpen(true); } };

  /* ── Un paquet, ouvert (ou à ouvrir) : ses colis ─────────────────────── */
  if (focus && focusStage) {
    const meta = PACKAGE_STAGE_META[focusStage];
    return (
      <div className={cn('flex min-h-[100dvh] flex-col', SURFACE.canvas)}>
        <ScreenTop title={focus.package_no} backTo={base} step={focusStage === 'opened' ? `${sum.seen}/${sum.total}` : undefined} right={<MoreButton onClick={more.show} />} />
        <div className="space-y-4 px-5 pb-6 pt-4">
          {focusStage === 'opened' ? (
            <>
              <InkProgress value={sum.seen} max={sum.total} label="Colis pointés" />
              <ParcelScanBox onScan={onScan} placeholder="Scanner ou saisir RC-…" />
            </>
          ) : (
            <div className="space-y-2 text-center">
              <Tag tone={meta.tone}>{meta.label}</Tag>
              <p className={cn('text-[16px]', TEXT.muted)}>
                {focusStage === 'received' ? `Reçu${focus.received_at ? ` le ${formatDateTime(focus.received_at)}` : ''} · ${nParcels(scope.length)}` : `Pas reçu · ${nParcels(scope.length)}${Number(focus.net_weight_kg) > 0 ? ` · ${fmtKg1(focus.net_weight_kg)}` : ''}`}
              </p>
            </div>
          )}
          {notice && <ScanNotice result={notice} />}
          {chips}
          {rows}
        </div>

        <Dock>
          {focusStage === 'opened'
            ? <BigButton onClick={() => navigate(base)}>Retour aux paquets</BigButton>
            : <BigButton onClick={() => openPackage(focus)} loading={openPkg.isPending}>Ouvrir le paquet</BigButton>}
        </Dock>

        <ActionSheet
          open={more.open}
          onClose={more.hide}
          title={focus.package_no}
          actions={[
            { label: `Tout pointer ce paquet (${pending.length})`, icon: CheckCheck, onClick: () => setAllOpen(true), hidden: focusStage !== 'opened' || pending.length === 0 },
            placeAction,
            { label: `Déclarer ses ${pending.length} colis manquants`, icon: PackageX, danger: true, onClick: () => setLostOpen(true), hidden: focusStage !== 'expected' || pending.length === 0 },
          ]}
        />
        {placeSheet}
        {allSheet}
        <ConfirmSheet
          open={lostOpen}
          danger
          onClose={() => setLostOpen(false)}
          title={`Déclarer ${pending.length} manquant${pending.length > 1 ? 's' : ''} ?`}
          subtitle={`Paquet ${focus.package_no} non reçu`}
          rows={[{ label: 'Colis', value: pending.map((p) => p.parcel_no).slice(0, 3).join(', ') + (pending.length > 3 ? '…' : '') }]}
          confirmLabel="Oui, manquants"
          loading={flagMany.isPending}
          onConfirm={() => flagMany.mutate({ parcelIds: pending.map((p) => p.id), note: `Paquet ${focus.package_no} non reçu à Douala` }, { onSuccess: (r) => { setLostOpen(false); toast.success(`${nParcels(r.flagged)} déclarés manquants`); } })}
        />
      </div>
    );
  }

  /* ── L'arrivée : les paquets d'abord (avion), puis les colis ─────────── */
  return (
    <div className={cn('flex min-h-[100dvh] flex-col', SURFACE.canvas)}>
      <ScreenTop title={data.label} backTo="/w/arrivees" step={`${sum.seen}/${sum.total}`} right={<MoreButton onClick={more.show} />} />
      <div className="space-y-4 px-5 pb-6 pt-4">
        <InkProgress value={sum.seen} max={sum.total} label="Colis pointés" />
        <ParcelScanBox onScan={onScan} placeholder={hasPackages ? 'Scanner un paquet (PQ-…) ou RC-…' : 'Scanner ou saisir RC-…'} />
        {notice && <ScanNotice result={notice} />}

        {hasPackages && (
          <>
            <PackagesCounter progress={progress} />
            <PackagesVerdict progress={progress} onShow={showPackage} />
            <div>
              {packages.map((k) => {
                const c = checkinSummary(split.byPackage.get(k.id) ?? []);
                return <PackageRow key={k.id} pkg={k} count={c} onShow={() => showPackage(k.package_no)} onOpen={() => openPackage(k)} opening={openingId === k.id} />;
              })}
            </div>
          </>
        )}

        {(!hasPackages || split.loose.length > 0) && (
          <>
            {hasPackages && <p className={cn('pt-2', TYPE.lead, TEXT.strong)}>Colis hors paquet</p>}
            {chips}
            {rows}
          </>
        )}
      </div>

      <Dock>
        <BigButton onClick={() => navigate(`${base}/bilan`)}>Terminer le pointage</BigButton>
      </Dock>

      <ActionSheet
        open={more.open}
        onClose={more.hide}
        title={data.label}
        actions={[
          { label: hasPackages ? `Tout pointer hors paquet (${pending.length})` : `Tout pointer (${pending.length})`, icon: CheckCheck, onClick: () => setAllOpen(true), hidden: pending.length === 0 },
          placeAction,
          { label: 'Déclarer les manquants', hint: 'Au bilan du pointage', icon: PackageX, onClick: () => navigate(`${base}/bilan`) },
        ]}
      />
      {placeSheet}
      {allSheet}
    </div>
  );
}
