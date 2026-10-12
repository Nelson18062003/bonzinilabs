/**
 * Desktop admin — Cargo › Réception : ce qui a été reçu à Guangzhou, DÉPÔT
 * PAR DÉPÔT et COLIS PAR COLIS (la barre d'onglets en haut ramène à
 * Container et Avion).
 *
 * Un dépôt (RC-000123) est ce qui est arrivé en une fois ; il contient des
 * colis (RC-000123-01, -02…), chacun avec son numéro, ses mesures et ses
 * photos. La page part de là, pas du client :
 *   · Dépôts — la liste des réceptions, la plus récente en haut ; une ligne
 *     se déplie sur ses colis, un clic ouvre la fiche (contrôle total) ;
 *   · Colis — tous les colis, un par ligne ; on en coche, on imprime leurs
 *     étiquettes d'un coup ;
 *   · Photos — le mur des photos, dépôt par dépôt, en grand d'un clic ;
 *   · Par client — ce qui attend pour chaque client (préparer un conteneur) ;
 *   · Paquets avion — les colis du bureau mis en paquets de 32 kg : créer un
 *     paquet, le remplir (douchette ou liste), le fermer, son étiquette.
 *     `?vue=paquets` y mène, `?paquet=<id>` ouvre la fiche d'un paquet.
 * « En stock » (ce qui est ici maintenant) est la vue par défaut ; on remonte
 * le temps avec la période, on retrouve les dépôts supprimés.
 * La route /m/cargo/reception/:depositId porte la fiche ouverte (lien
 * profond), `?colis=` le colis à mettre en évidence.
 * Le devis se télécharge depuis la liste (colonne Devis), sans ouvrir le
 * dépôt : un vrai fichier PDF, jamais la feuille de partage, dans la langue
 * choisie en haut (FR | EN, retenue sur l'appareil).
 */
import { Fragment, useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { ChevronDown, ChevronRight, Download, FileDown, Images, Package, PackagePlus, Tag, X } from 'lucide-react';
import { toast } from 'sonner';
import { DesktopCargoParts } from '@/components/cargo/CargoParts';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { useReceptionBoard, useReceptionStock, type BoardScope } from '@/hooks/useReception';
import { useWarehouseDay } from '@/hooks/useWarehouse';
import { useAdminShippingSettings } from '@/hooks/useShippingSettings';
import { fetchCargoQuote } from '@/hooks/useCargoQuote';
import { CARGO_DOC_LANGS, CARGO_DOC_LANG_LABEL, downloadReceptionPdf, readCargoDocLang, storeCargoDocLang, type CargoDocLang } from '@/lib/cargoQuotePdf';
import { DEFAULT_SHIPPING_SETTINGS } from '@/lib/customerCode';
import { xaf as fmtXaf } from '@/lib/cargoQuote';
import {
  clientFullName, depositDate, depositInQueue, depositMatches, formatCbm, formatDims, formatKg, initials, isParcelIncomplete, isParcelWaiting, listDate,
  parcelInQueue, parcelPhotoPaths, parcelStage, parcelsHere, sortedParcels, RECEPTION_QUEUES,
  type Deposit, type Parcel, type ReceptionLocation, type ReceptionQueue,
} from '@/lib/reception';
import { exportToCSV } from '@/lib/exportCSV';
import { LocationMark, formatDateTime, useReceptionLabels } from '@/mobile/components/reception/bits';
import { ParcelPhotoViewer, useParcelViewer } from '@/mobile/components/reception/ParcelPhotoViewer';
import { DepositQuickView } from '@/components/cargo/reception/DepositQuickView';
import { ClientParcelsQuickView } from '@/components/cargo/reception/ClientParcelsQuickView';
import { DepositLabelsDialog } from '@/components/cargo/reception/DepositLabelsDialog';
import { CoverThumb, DepositStatePill, PhotoTile, QuoteCell } from '@/components/cargo/reception/ReceptionBits';
import { openForPrint, useParcelLabels, type LabelItem } from '@/components/cargo/reception/useParcelLabels';
import { downloadFile } from '@/components/customer-code/exportShippingLabel';
import { PackageChip } from '@/components/cargo/air/AirPackagesPanel';
import { DesktopPackagesView } from '@/components/cargo/packages/DesktopPackagesView';
import { filterPackages, knownClientCodes, usePackingBoard, type PackageScope } from '@/components/cargo/packages/usePackingBoard';
import { plural } from '@/lib/cargo/plain';
import { PackageWorkbench } from '@/components/cargo/packages/PackageWorkbench';
import { packRefusal, packageStatusMeta } from '@/lib/airPackage';
import { PackDialog } from '@/components/cargo/packages/PackDialog';
import { Btn, GroupTick, SelectionBar, Tick } from '@/components/cargo/packages/bits';
import { toggleId } from '@/components/cargo/packages/selection';
import { cn } from '@/lib/utils';
import { SURFACE, TEXT, SOFT_PILL, PRIMARY_PILL, Card, CardHeader, Chip, DropChip, Holder, KV, PaginationBar, ScreenLoader, SearchField, StatusPill, Th, Td } from '@/desktop/designKit';

type View = 'deposits' | 'parcels' | 'photos' | 'clients' | 'packages';
type Period = 'stock' | 'today' | 'week' | 'month' | 'quarter' | 'all' | 'cancelled';

const VIEWS: { key: View; label: string }[] = [
  { key: 'deposits', label: 'Dépôts' },
  { key: 'parcels', label: 'Colis' },
  { key: 'photos', label: 'Photos' },
  { key: 'clients', label: 'Par client' },
  { key: 'packages', label: 'Paquets avion' },
];
const PACKAGE_SCOPES: { value: PackageScope; label: string }[] = [
  { value: 'bureau', label: 'Au bureau' },
  { value: 'all', label: 'Les 300 derniers' },
];
const PERIODS: { value: Period; label: string }[] = [
  { value: 'stock', label: 'En stock' },
  { value: 'today', label: "Aujourd'hui" },
  { value: 'week', label: '7 jours' },
  { value: 'month', label: '30 jours' },
  { value: 'quarter', label: '90 jours' },
  { value: 'all', label: 'Tout' },
  { value: 'cancelled', label: 'Supprimés' },
];
const QUEUE_LABEL: Record<ReceptionQueue, string> = {
  all: 'Tous', waiting: 'En attente', loaded: 'Partis', pending: 'À attribuer', incomplete: 'Incomplets', nophoto: 'Sans photo', open: 'En cours',
};
const PAGE = { deposits: 40, parcels: 80, photos: 16 } as const;
const VIEW_KEY = 'bonzini-reception-view';

function periodQuery(p: Period): { scope: BoardScope; from: Date | null; to: Date | null } {
  if (p === 'stock') return { scope: 'stock', from: null, to: null };
  if (p === 'cancelled' || p === 'all') return { scope: p === 'all' ? 'all' : 'cancelled', from: null, to: null };
  const from = new Date(); from.setHours(0, 0, 0, 0);
  from.setDate(from.getDate() - (p === 'today' ? 0 : p === 'week' ? 6 : p === 'month' ? 29 : 89));
  return { scope: 'all', from, to: null };
}

function readView(): View {
  try { const v = localStorage.getItem(VIEW_KEY); return v === 'parcels' || v === 'photos' || v === 'clients' || v === 'packages' ? v : 'deposits'; } catch { return 'deposits'; }
}

/** Au-delà, les étiquettes d'une sélection se font en plusieurs fois : un QR et une page par colis pèsent sur le navigateur. */
const MAX_BULK_LABELS = 200;

export function DesktopCargoReception() {
  const { hasPermission } = useAdminAuth();
  const navigate = useNavigate();
  const { depositId } = useParams<{ depositId?: string }>();
  const [params, setParams] = useSearchParams();
  const focusParcel = params.get('colis');
  // La fiche d'un paquet ouverte (lien profond) ; `?vue=paquets` : la vue des paquets.
  const packageId = params.get('paquet');
  const labels = useReceptionLabels();
  const [view, setViewState] = useState<View>(() => (params.get('vue') === 'paquets' ? 'packages' : readView()));
  const [pkScope, setPkScope] = useState<PackageScope>('bureau');
  const [period, setPeriod] = useState<Period>('stock');
  const [where, setWhere] = useState<'all' | ReceptionLocation>('all');
  const [queue, setQueue] = useState<ReceptionQueue>('all');
  const [query, setQuery] = useState('');
  const [receivedBy, setReceivedBy] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // Les dépôts cochés (vue Dépôts) : leurs colis encore ici forment la sélection.
  const [selDeposits, setSelDeposits] = useState<Set<string>>(new Set());
  const [packItems, setPackItems] = useState<LabelItem[] | null>(null);
  const [clientId, setClientId] = useState<string | null>(null);
  const [labelsFor, setLabelsFor] = useState<Deposit | null>(null);
  const [viewerDeposit, setViewerDeposit] = useState<Deposit | null>(null);
  const [bulkBusy, setBulkBusy] = useState<'pdf' | 'print' | null>(null);
  // Les devis en cours de fabrication (un sablier par ligne), et la langue des PDF.
  const [quoteBusy, setQuoteBusy] = useState<Set<string>>(new Set());
  const [docLang, setDocLangState] = useState<CargoDocLang>(readCargoDocLang);
  const qc = useQueryClient();
  const viewer = useParcelViewer();

  const setView = (v: View) => { setViewState(v); setPage(1); try { localStorage.setItem(VIEW_KEY, v); } catch { /* préférence perdue : sans gravité */ } };
  // Arrivé par ?vue=paquets (le lien « Préparer des paquets » d'une expédition) : la vue est retenue, le lien s'efface.
  const vueParam = params.get('vue');
  useEffect(() => {
    if (vueParam !== 'paquets') return;
    setView('packages');
    setParams((cur) => { const n = new URLSearchParams(cur); n.delete('vue'); return n; }, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vueParam]);
  useEffect(() => { setPage(1); }, [period, where, queue, query, receivedBy]);
  useEffect(() => { setSelected(new Set()); setSelDeposits(new Set()); }, [period, where]);
  // La fiche d'un dépôt peut changer la langue : on la relit quand elle se ferme.
  useEffect(() => { setDocLangState(readCargoDocLang()); }, [depositId]);
  const setDocLang = (l: CargoDocLang) => { setDocLangState(l); storeCargoDocLang(l); };

  const pq = useMemo(() => periodQuery(period), [period]);
  const board = useReceptionBoard({ scope: pq.scope, location: where === 'all' ? null : where, from: pq.from, to: pq.to });
  const stock = useReceptionStock(where === 'all' ? null : where);
  // Les paquets avion : la liste (le compteur de l'onglet), et les colis du bureau à emballer
  // seulement quand ils servent (la vue Paquets, « Bureau · Air », la fiche d'un paquet).
  const packing = usePackingBoard({ scope: pkScope, enabled: hasPermission('canViewCargo'), boardEnabled: view === 'packages' || where === 'office' || !!packageId });
  const shownPackages = useMemo(() => filterPackages(packing.packages.data ?? [], packing.contents, query), [packing.packages.data, packing.contents, query]);
  /** `replace` : d'un paquet au suivant (« Commencer un nouveau paquet »), le retour arrière ne rouvre pas l'ancien. */
  const openPackage = (id: string, replace = false) => {
    setParams((cur) => { const n = new URLSearchParams(cur); n.set('paquet', id); return n; }, { replace });
  };
  const closePackage = () => setParams((cur) => { const n = new URLSearchParams(cur); n.delete('paquet'); return n; }, { replace: true });
  const { data: settingsData } = useAdminShippingSettings();
  const settings = settingsData ?? DEFAULT_SHIPPING_SETTINGS;
  // Douala : ce que l'entrepôt de destination voit (pointage, attente, remises), pour qui peut y agir.
  const seesDouala = hasPermission('canReleaseParcels') || hasPermission('canReceiveAtDestination');
  const douala = useWarehouseDay(seesDouala);

  // En stock, un colis déjà parti n'est pas « ici » : il reste visible dans la fiche de son dépôt.
  const inScope = (p: Parcel, d: Deposit) => period !== 'stock' || isParcelWaiting(p) || d.status === 'open';

  // 1. Recherche + réceptionnaire : la base de tout ce qui suit (compteurs compris).
  const base = useMemo(() => {
    const all = board.data?.deposits ?? [];
    return all.filter((d) => (!receivedBy || d.received_by === receivedBy) && depositMatches(d, query));
  }, [board.data, receivedBy, query]);
  // Un dépôt réduit à ce qui compte pour la vue (en stock : ses colis encore ici).
  const scoped = (d: Deposit): Deposit => (period === 'stock' ? { ...d, parcels: d.parcels.filter((p) => inScope(p, d)) } : d);
  // 2. La file.
  const deposits = useMemo(() => base.filter((d) => depositInQueue(scoped(d), queue)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [base, queue, period]);
  // Une recherche qui vise un colis (son numéro, son bordereau, son contenu) ne garde que lui ;
  // une recherche qui vise le dépôt (client, fournisseur…) garde tous ses colis.
  const parcelRows = useMemo<LabelItem[]>(() => deposits.flatMap((d) => sortedParcels(d.parcels)
    .filter((p) => inScope(p, d) && parcelInQueue(p, d, queue) && (!query.trim() || depositMatches({ ...d, parcels: [p] }, query)))
    .map((parcel) => ({ parcel, deposit: d }))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [deposits, queue, query, period]);

  const counts = useMemo(() => {
    const c = {} as Record<ReceptionQueue, number>;
    for (const q of RECEPTION_QUEUES) c[q] = base.filter((d) => depositInQueue(scoped(d), q)).length;
    return c;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base, period]);

  // Les chiffres de ce qui est listé (hors file) : cohérents avec la liste.
  const kpi = useMemo(() => {
    const ps = base.flatMap((d) => d.parcels.filter((p) => inScope(p, d)));
    return {
      deposits: base.length,
      parcels: ps.length,
      kg: ps.reduce((s, p) => s + Number(p.weight_kg ?? 0), 0),
      cbm: ps.reduce((s, p) => s + Number(p.cbm ?? 0), 0),
      noWeight: ps.filter((p) => p.weight_kg == null).length,
      noDims: ps.filter((p) => p.cbm == null).length,
      photos: ps.reduce((s, p) => s + parcelPhotoPaths(p).length, 0),
      noPhoto: ps.filter((p) => parcelPhotoPaths(p).length === 0).length,
      clients: new Set(base.filter((d) => d.client).map((d) => d.client!.user_id)).size,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base, period]);

  // Le travail de chaque réceptionnaire, sur ce qui est listé.
  const staff = useMemo(() => {
    const m = new Map<string, { id: string; name: string; deposits: number; parcels: number; kg: number; cbm: number; incomplete: number; pending: number }>();
    for (const d of (board.data?.deposits ?? []).filter((x) => depositMatches(x, query))) {
      const r = m.get(d.received_by) ?? { id: d.received_by, name: d.received_by_name || 'Réceptionnaire', deposits: 0, parcels: 0, kg: 0, cbm: 0, incomplete: 0, pending: 0 };
      const ps = d.parcels.filter((p) => inScope(p, d));
      r.deposits += 1; r.parcels += ps.length;
      r.kg += ps.reduce((s, p) => s + Number(p.weight_kg ?? 0), 0);
      r.cbm += ps.reduce((s, p) => s + Number(p.cbm ?? 0), 0);
      r.incomplete += ps.filter(isParcelIncomplete).length;
      if (!d.client) r.pending += 1;
      m.set(d.received_by, r);
    }
    return [...m.values()].sort((a, b) => b.parcels - a.parcels);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [board.data, query, period]);

  // La sélection → étiquettes en lot, ou « Mettre en paquet ». Vue Colis : les colis cochés ;
  // vue Dépôts : les colis encore ici des dépôts cochés. Une seule barre pour les deux.
  const selectedItems = useMemo<LabelItem[]>(() => (view === 'deposits'
    ? deposits.filter((d) => selDeposits.has(d.id)).flatMap((d) => sortedParcels(d.parcels).filter((p) => inScope(p, d)).map((parcel) => ({ parcel, deposit: d })))
    : view === 'parcels' ? parcelRows.filter((r) => selected.has(r.parcel.id)) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [view, deposits, selDeposits, parcelRows, selected, period]);
  const tooMany = selectedItems.length > MAX_BULK_LABELS;
  const bulk = useParcelLabels(selectedItems, settings, selectedItems.length > 0 && !tooMany);
  const packableCount = useMemo(() => selectedItems.filter((r) => packRefusal(r.parcel, r.deposit) === null).length, [selectedItems]);
  const clearSelection = () => { setSelected(new Set()); setSelDeposits(new Set()); };

  if (!hasPermission('canViewCargo')) return <Navigate to="/m" replace />;

  const stats = stock.data?.stats;
  const byClient = stock.data?.by_client ?? [];
  // Un dépôt ouvert depuis la fiche d'un paquet garde le paquet dans le lien : on y revient en fermant le dépôt.
  const openDepositId = (id: string, parcelId?: string) => {
    const q = new URLSearchParams();
    if (parcelId) q.set('colis', parcelId);
    if (packageId) q.set('paquet', packageId);
    const qs = q.toString();
    navigate(`/m/cargo/reception/${id}${qs ? `?${qs}` : ''}`);
  };
  const openDeposit = (d: Deposit, parcelId?: string) => openDepositId(d.id, parcelId);
  const openViewer = (d: Deposit, parcelId?: string, k = 0) => {
    const sorted = sortedParcels(d.parcels);
    setViewerDeposit({ ...d, parcels: sorted });
    viewer.open(Math.max(0, parcelId ? sorted.findIndex((p) => p.id === parcelId) : sorted.findIndex((p) => parcelPhotoPaths(p).length > 0)), k);
  };

  const runBulk = async (what: 'pdf' | 'print') => {
    setBulkBusy(what);
    try {
      const ids = selectedItems.map((r) => r.parcel.id);
      const file = await bulk.pdfFile(ids, `bonzini-etiquettes-${new Date().toISOString().slice(0, 10)}-${ids.length}-colis.pdf`);
      if (what === 'print' && openForPrint(file)) return;
      downloadFile(file);
      toast.success(`PDF de ${ids.length - bulk.skipped} étiquette${ids.length - bulk.skipped > 1 ? 's' : ''} téléchargé`, bulk.skipped > 0 ? { description: `${bulk.skipped} colis sans client ignoré(s)` } : undefined);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBulkBusy(null);
    }
  };

  // La barre de la sélection, la même dans Dépôts et dans Colis : mettre en paquet, étiquettes.
  const canPack = hasPermission('canReceiveParcels');
  const selectionBar = selectedItems.length > 0 && (
    <SelectionBar
      label={`${plural(selectedItems.length, 'colis sélectionné', 'colis sélectionnés')}${view === 'deposits' ? ` · ${plural(new Set(selectedItems.map((r) => r.deposit.id)).size, 'dépôt')}` : ''}`}
      meta={<>
        {formatKg(selectedItems.reduce((s, r) => s + Number(r.parcel.weight_kg ?? 0), 0))} · {formatCbm(selectedItems.reduce((s, r) => s + Number(r.parcel.cbm ?? 0), 0))}
        {bulk.skipped > 0 && ` · ${bulk.skipped} sans client (pas d'étiquette)`}
        {tooMany && <span className="font-semibold text-amber-700 dark:text-amber-400"> · {MAX_BULK_LABELS} étiquettes au plus par PDF : allégez la sélection</span>}
      </>}
      onClear={clearSelection}
    >
      {bulk.nodes}
      {canPack && (
        <Btn kind={packableCount > 0 ? 'primary' : 'soft'} size="sm" onClick={() => setPackItems(selectedItems)} disabled={packableCount === 0}
          title={packableCount === 0 ? 'Aucun de ces colis ne peut entrer dans un paquet : entrepôt (bateau), sans client, pas pesé, déjà emballé ou parti.' : undefined}>
          <PackagePlus /> Mettre en paquet{packableCount > 0 && packableCount < selectedItems.length ? ` (${packableCount})` : ''}
        </Btn>
      )}
      <Btn onClick={() => void runBulk('pdf')} disabled={!bulk.ready || bulkBusy !== null} loading={bulkBusy === 'pdf'} size="sm"><FileDown /> Étiquettes (PDF)</Btn>
      <Btn onClick={() => void runBulk('print')} disabled={!bulk.ready || bulkBusy !== null} loading={bulkBusy === 'print'} size="sm"><Tag /> Imprimer</Btn>
    </SelectionBar>
  );

  // Le devis d'un dépôt, téléchargé depuis la liste : un fichier, jamais la feuille de partage.
  const downloadQuote = async (d: Deposit) => {
    if (quoteBusy.has(d.id)) return;
    // La langue affichée en haut fait foi (relue sur l'appareil à la fermeture de la fiche) :
    // même si le stockage est bloqué, le PDF sort dans la langue que l'on voit.
    const lang = docLang;
    setQuoteBusy((s) => new Set(s).add(d.id));
    try {
      const q = await fetchCargoQuote(qc, d.id);
      if (!q) throw new Error(`Le dépôt ${d.deposit_no} n'a pas encore de devis`);
      // Comme dans la fiche : un devis sans ligne ne donne pas de PDF (il serait vide).
      if (q.lines.length === 0) throw new Error(`Le devis ${q.quote_no} n'a aucune ligne`);
      await downloadReceptionPdf({ deposit: d, quote: q }, settings, lang);
      toast.success('PDF téléchargé', { description: `Bon de réception et devis ${q.quote_no} · ${CARGO_DOC_LANG_LABEL[lang]}` });
    } catch (e) {
      toast.error((e as Error).message || 'Le devis n’a pas pu être téléchargé');
    } finally {
      setQuoteBusy((s) => { const n = new Set(s); n.delete(d.id); return n; });
    }
  };

  const exportCsv = () => {
    const stamp = new Date().toISOString().slice(0, 10);
    if (view === 'packages') {
      exportToCSV(
        shownPackages.map((k) => ({ paquet: k.package_no, etat: packageStatusMeta(k.status).label, colis: k.parcel_count, clients: k.client_count, codes: knownClientCodes(k, packing.contents)?.join(' ') ?? '', poids_colis_kg: Number(k.net_weight_kg), poids_pese_kg: k.gross_weight_kg ?? '', dimensions_cm: k.length_cm != null && k.width_cm != null && k.height_cm != null ? `${k.length_cm}x${k.width_cm}x${k.height_cm}` : '', commence_le: formatDateTime(k.created_at), ferme_le: k.sealed_at ? formatDateTime(k.sealed_at) : '', lta: k.awb_number ?? '', vol: k.flight_no ?? '', refus: k.refusal_reason ?? '' })),
        [{ key: 'paquet', header: 'Paquet' }, { key: 'etat', header: 'État' }, { key: 'colis', header: 'Colis' }, { key: 'clients', header: 'Clients' }, { key: 'codes', header: 'Codes clients' }, { key: 'poids_colis_kg', header: 'Poids des colis (kg)' }, { key: 'poids_pese_kg', header: 'Poids pesé (kg)' }, { key: 'dimensions_cm', header: 'Dimensions (cm)' }, { key: 'commence_le', header: 'Commencé le' }, { key: 'ferme_le', header: 'Fermé le' }, { key: 'lta', header: 'LTA' }, { key: 'vol', header: 'Vol' }, { key: 'refus', header: "Motif du refus à l'aéroport" }],
        `bonzini-paquets-avion-${stamp}.csv`,
      );
      return;
    }
    if (view === 'parcels' || view === 'photos') {
      exportToCSV(
        parcelRows.map(({ parcel: p, deposit: d }) => ({ colis: p.parcel_no, depot: d.deposit_no, recu_le: formatDateTime(depositDate(d)), client: d.client ? clientFullName(d.client) : '', code: d.client?.customer_code ?? '', lieu: labels.location(d.location), type: labels.kind(p.kind), contenu: p.description ?? '', bordereau: p.courier_waybill ?? '', poids_kg: p.weight_kg ?? '', longueur_cm: p.length_cm ?? '', largeur_cm: p.width_cm ?? '', hauteur_cm: p.height_cm ?? '', volume_m3: p.cbm ?? '', photos: parcelPhotoPaths(p).length, etat: parcelStage(p, d.location).label })),
        [{ key: 'colis', header: 'N° colis' }, { key: 'depot', header: 'Dépôt' }, { key: 'recu_le', header: 'Reçu le' }, { key: 'client', header: 'Client' }, { key: 'code', header: 'Code' }, { key: 'lieu', header: 'Lieu' }, { key: 'type', header: 'Type' }, { key: 'contenu', header: 'Contenu' }, { key: 'bordereau', header: 'Bordereau' }, { key: 'poids_kg', header: 'Poids (kg)' }, { key: 'longueur_cm', header: 'L (cm)' }, { key: 'largeur_cm', header: 'l (cm)' }, { key: 'hauteur_cm', header: 'H (cm)' }, { key: 'volume_m3', header: 'Volume (m³)' }, { key: 'photos', header: 'Photos' }, { key: 'etat', header: 'État' }],
        `bonzini-reception-colis-${stamp}.csv`,
      );
      return;
    }
    exportToCSV(
      deposits.map((d) => ({ numero: d.deposit_no, date: formatDateTime(depositDate(d)), client: d.client ? clientFullName(d.client) : '', code: d.client?.customer_code ?? '', lieu: labels.location(d.location), apporte_par: labels.broughtBy(d.brought_by), fournisseur: d.supplier_name ?? '', colis: d.parcels.length, poids_kg: Number(d.total_weight_kg), volume_m3: Number(d.total_cbm), photos: d.parcels.reduce((s, p) => s + parcelPhotoPaths(p).length, 0), recu_par: d.received_by_name ?? '', etat: d.status === 'cancelled' ? `Supprimé : ${d.cancel_reason ?? ''}` : labels.status(d).label, devis: d.quote_no ?? '', devis_total_xaf: d.quote_total_xaf ?? '' })),
      [{ key: 'numero', header: 'N°' }, { key: 'date', header: 'Reçu le' }, { key: 'client', header: 'Client' }, { key: 'code', header: 'Code' }, { key: 'lieu', header: 'Lieu' }, { key: 'apporte_par', header: 'Apporté par' }, { key: 'fournisseur', header: 'Fournisseur' }, { key: 'colis', header: 'Colis' }, { key: 'poids_kg', header: 'Poids (kg)' }, { key: 'volume_m3', header: 'Volume (m³)' }, { key: 'photos', header: 'Photos' }, { key: 'recu_par', header: 'Reçu par' }, { key: 'etat', header: 'État' }, { key: 'devis', header: 'Devis' }, { key: 'devis_total_xaf', header: 'Total devis (XAF)' }],
      `bonzini-reception-depots-${stamp}.csv`,
    );
  };

  // Le mur de photos : un dépôt par bloc, ses colis de la file (avec ou sans photo) en tuiles.
  // Calculé AVANT la pagination : un dépôt sans tuile ne laisse pas de trou dans une page.
  const wall = view !== 'photos' ? [] : deposits.map((d) => {
    const ps = sortedParcels(d.parcels).filter((p) => inScope(p, d) && parcelInQueue(p, d, queue) && (!query.trim() || depositMatches({ ...d, parcels: [p] }, query)));
    const tiles = ps.flatMap((p) => {
      const paths = parcelPhotoPaths(p);
      return paths.length === 0 ? [{ p, path: null as string | null, k: 0, n: 0 }] : paths.map((path, k) => ({ p, path, k, n: paths.length }));
    });
    return { d, count: ps.length, tiles };
  }).filter((w) => w.tiles.length > 0);

  // ── Pagination ─────────────────────────────────────────────────────────
  const listLen = view === 'packages' ? shownPackages.length : view === 'parcels' ? parcelRows.length : view === 'photos' ? wall.length : deposits.length;
  const per = view === 'parcels' ? PAGE.parcels : view === 'photos' ? PAGE.photos : PAGE.deposits;
  const pages = Math.max(1, Math.ceil(listLen / per));
  const cur = Math.min(page, pages);
  const slice = <T,>(xs: T[]) => xs.slice((cur - 1) * per, cur * per);
  const pager = listLen > per && (
    <PaginationBar page={cur} pages={pages} onPage={setPage} total={String(listLen)}
      rangeLabel={`${(cur - 1) * per + 1}–${Math.min(cur * per, listLen)}`} />
  );

  const loading = board.isLoading;
  const empty = (msg: string) => <p className={cn('px-5 py-12 text-center text-[13px]', TEXT.muted)}>{msg}</p>;
  const emptyMsg = query.trim() ? `Rien ne correspond à « ${query.trim()} ».` : period === 'stock' ? "Rien n'attend à l'entrepôt ni au bureau." : period === 'cancelled' ? 'Aucun dépôt supprimé.' : 'Aucune réception sur cette période.';

  return (
    <div className="flex min-h-[calc(100vh-120px)] flex-col">
      {/* ── Les parties du module : Container · Avion · Réception (ici) ── */}
      <DesktopCargoParts active="reception" className="mb-4" />

      {/* ── En-tête : ce qui est ici, maintenant ───────────────────────── */}
      <header className="flex flex-wrap items-center justify-between gap-3">
        <p className={cn('text-[15px] font-semibold', TEXT.body)}>
          {view === 'packages' ? (
            <>
              <span className={TEXT.strong}>{packing.packable ? `${packing.packable.ready.length} colis avion à emballer` : 'Paquets avion'}</span>
              {packing.packages.data && <> · {plural(packing.openCount, 'paquet')} en cours · 32 kg au plus par paquet</>}
            </>
          ) : stats ? (
            <>
              <span className={TEXT.strong}>{stats.parcels} colis</span> à l'entrepôt et au bureau · {formatCbm(stats.cbm)} · {formatKg(stats.weight_kg)} · {stats.clients} client{stats.clients > 1 ? 's' : ''}
              {stats.pending > 0 && <> · <button type="button" onClick={() => { setPeriod('stock'); setQueue('pending'); }} className="font-bold text-amber-700 underline-offset-2 hover:underline dark:text-amber-400">{stats.pending} à attribuer</button></>}
            </>
          ) : 'Réception des colis'}
        </p>
        <div className="flex items-center gap-2">
          <SearchField value={query} onChange={setQuery} placeholder={view === 'packages' ? 'PQ-…, RC-…, BZ-…, client, LTA…' : 'RC-…, BZ-…, client, bordereau, contenu…'} className="w-[320px]" />
          {view === 'packages'
            ? <DropChip label="Paquets" value={pkScope} options={PACKAGE_SCOPES} onChange={setPkScope} />
            : <DropChip label="Période" value={period} options={PERIODS} onChange={(p) => { setPeriod(p); if (p === 'cancelled' || (p === 'stock' && queue === 'loaded')) setQueue('all'); }} />}
          {view === 'deposits' && (
            <div role="radiogroup" aria-label="Langue des devis" title="Langue des devis téléchargés" className="flex items-center gap-1">
              <span className={cn('pl-1 pr-0.5 text-[12px] font-semibold', TEXT.muted)}>Devis</span>
              {CARGO_DOC_LANGS.map((l) => (
                <button key={l} type="button" role="radio" aria-checked={docLang === l} aria-label={CARGO_DOC_LANG_LABEL[l]} title={`Devis en ${CARGO_DOC_LANG_LABEL[l]}`}
                  onClick={() => setDocLang(l)} className={cn('inline-flex h-9 min-w-[38px] items-center justify-center px-2.5 text-[12px] font-bold', docLang === l ? PRIMARY_PILL : SOFT_PILL)}>
                  {l.toUpperCase()}
                </button>
              ))}
            </div>
          )}
          <button type="button" onClick={exportCsv} disabled={listLen === 0} className={cn('inline-flex h-9 items-center gap-2 px-3.5 text-[13px] font-semibold disabled:opacity-50', SOFT_PILL)}>
            <Download className="h-4 w-4" /> CSV
          </button>
        </div>
      </header>

      {/* ── Les chiffres de ce qui est listé ───────────────────────────── */}
      {view !== 'packages' && <section className="mt-4 grid grid-cols-4 gap-4">
        {([
          ['Colis', String(kpi.parcels), `dans ${kpi.deposits} dépôt${kpi.deposits > 1 ? 's' : ''} · ${kpi.clients} client${kpi.clients > 1 ? 's' : ''}`, null],
          ['Poids', formatKg(kpi.kg), kpi.noWeight > 0 ? `${kpi.noWeight} colis sans poids` : 'tous pesés', kpi.noWeight > 0 ? 'incomplete' : null],
          ['Volume', formatCbm(kpi.cbm), kpi.noDims > 0 ? `${kpi.noDims} colis sans dimensions` : 'tous mesurés', kpi.noDims > 0 ? 'incomplete' : null],
          ['Photos', String(kpi.photos), kpi.noPhoto > 0 ? `${kpi.noPhoto} colis sans photo` : 'chaque colis en a', kpi.noPhoto > 0 ? 'nophoto' : null],
        ] as [string, string, string, ReceptionQueue | null][]).map(([k, v, h, q]) => (
          <Card key={k} className="px-5 py-4">
            <KV k={k} v={<span className="text-[22px] font-bold">{loading ? '…' : v}</span>} />
            {q ? (
              <button type="button" onClick={() => setQueue(q)} className="mt-1 text-[12px] font-semibold text-amber-700 underline-offset-2 hover:underline dark:text-amber-400">{h}</button>
            ) : <div className={cn('mt-1 text-[12px]', TEXT.muted)}>{h}</div>}
          </Card>
        ))}
      </section>}

      {/* ── Vues, lieu, files ──────────────────────────────────────────── */}
      <section className="mt-5 flex flex-wrap items-end justify-between gap-3 border-b border-border">
        <div role="tablist" aria-label="Vues de la réception" className="flex gap-6">
          {VIEWS.map((v) => (
            <button key={v.key} type="button" role="tab" aria-selected={view === v.key} onClick={() => setView(v.key)}
              className={cn('-mb-px border-b-2 pb-2.5 text-[14px] transition-colors', view === v.key ? cn('border-foreground font-bold', TEXT.strong) : cn('border-transparent font-medium hover:text-foreground', TEXT.muted))}>
              {v.label}
              <span className={cn('ml-1.5 text-[12px] font-normal tabular-nums', TEXT.muted)}>
                {v.key === 'deposits' ? deposits.length : v.key === 'parcels' ? parcelRows.length : v.key === 'photos' ? parcelRows.reduce((s, r) => s + parcelPhotoPaths(r.parcel).length, 0) : v.key === 'packages' ? (packing.packages.data ? shownPackages.length : '') : byClient.length}
              </span>
            </button>
          ))}
        </div>
        {view !== 'packages' && <div className="flex items-center gap-1.5 pb-2">
          <Chip label="Partout" active={where === 'all'} onClick={() => setWhere('all')} />
          <Chip label={<span className="inline-flex items-center gap-1.5"><LocationMark location="warehouse" size={16} /> Entrepôt · Sea</span>} active={where === 'warehouse'} onClick={() => setWhere('warehouse')} />
          <Chip label={<span className="inline-flex items-center gap-1.5"><LocationMark location="office" size={16} /> Bureau · Air</span>} active={where === 'office'} onClick={() => setWhere('office')} />
        </div>}
      </section>
      {/* Au bureau, les colis avion partent en paquets de 32 kg : le chemin vers la mise en paquets. */}
      {where === 'office' && view !== 'packages' && view !== 'clients' && packing.packable && (packing.packable.ready.length > 0 || packing.openCount > 0) && (
        <button type="button" onClick={() => setView('packages')}
          className="mt-3 flex w-full items-center gap-3 rounded-lg border border-indigo-200 bg-indigo-50/70 px-4 py-2.5 text-left transition-colors hover:bg-indigo-50 dark:border-indigo-900/60 dark:bg-indigo-950/30 dark:hover:bg-indigo-950/50">
          <Package className="h-4 w-4 shrink-0 text-indigo-700 dark:text-indigo-300" />
          <span className="min-w-0 flex-1 text-[13px] text-indigo-900 dark:text-indigo-200">
            <span className="font-bold">{plural(packing.packable.ready.length, 'colis avion prêt', 'colis avion prêts')} à mettre en paquet</span>
            {packing.openCount > 0 && ` · ${plural(packing.openCount, 'paquet')} en cours`}
            <span className="text-indigo-800/80 dark:text-indigo-300/80"> — un paquet fermé (32 kg au plus) part ensuite avec un vol.</span>
          </span>
          <span className="inline-flex shrink-0 items-center gap-1 text-[13px] font-bold text-indigo-800 dark:text-indigo-200">Faire les paquets <ChevronRight className="h-4 w-4" /></span>
        </button>
      )}
      {view !== 'clients' && view !== 'packages' && (
        <section className="mt-3 flex flex-wrap items-center gap-1.5">
          {RECEPTION_QUEUES
            .filter((q) => !(period === 'stock' && q === 'loaded'))
            .map((q) => <Chip key={q} label={q === 'all' && period === 'stock' ? 'Tout le stock' : QUEUE_LABEL[q]} count={q === 'all' ? null : counts[q] || null} active={queue === q} onClick={() => setQueue(q)} />)}
          {receivedBy && (
            <button type="button" onClick={() => setReceivedBy(null)} className={cn('ml-1 inline-flex h-9 items-center gap-1.5 px-3 text-[12px] font-semibold', SOFT_PILL)}>
              Reçu par {staff.find((s) => s.id === receivedBy)?.name ?? '…'} <X className="h-3.5 w-3.5" />
            </button>
          )}
          {board.data?.truncated && <span className={cn('ml-auto text-[12px]', TEXT.muted)}>Les {board.data.deposits.length} plus récents sur {board.data.total} — affinez la période</span>}
        </section>
      )}

      {/* ── La vue + la colonne de droite ──────────────────────────────── */}
      {view === 'packages' ? (
        <div className="mt-4">
          <DesktopPackagesView query={query} scope={pkScope} canWrite={hasPermission('canReceiveParcels')} canShip={hasPermission('canReceiveParcels') || hasPermission('canManageCargo')} packing={packing}
            onOpenPackage={(id) => openPackage(id)} onOpenDeposit={openDepositId} onOpenFlight={(id) => navigate(`/m/cargo/avion/${id}`)} />
        </div>
      ) : (
      <div className="mt-4 flex min-h-0 flex-1 flex-col gap-5">
        <Card className="overflow-x-auto p-0">
          {view === 'clients' ? (
            <>
              <CardHeader title="Ce qui attend, par client" meta={`${byClient.length} ligne${byClient.length > 1 ? 's' : ''} · en stock`} />
              {stock.isLoading ? <ScreenLoader /> : byClient.length === 0 ? empty("Rien n'attend à l'entrepôt ni au bureau.") : (
                <table className="w-full text-left">
                  <thead className={SURFACE.card}>
                    <tr><Th first>Client</Th><Th>Lieu</Th><Th align="right">Dépôts</Th><Th align="right">Colis</Th><Th align="right">Poids</Th><Th align="right">Volume</Th><Th>Dernière réception</Th><Th last className="w-[36px]" /></tr>
                  </thead>
                  <tbody>
                    {byClient.map((row, i) => {
                      const name = row.client ? clientFullName(row.client) : 'Client à attribuer';
                      return (
                        <tr key={`${row.client?.user_id ?? 'none'}-${row.location}-${i}`} onClick={() => (row.client ? setClientId(row.client.user_id) : (setView('deposits'), setPeriod('stock'), setQueue('pending')))} className="cursor-pointer transition-colors hover:bg-muted/40">
                          <Td first>
                            <div className="flex items-center gap-2.5">
                              <Holder size="sm" tone={row.client ? 'neutral' : 'pending'}>{row.client ? initials(name) : '?'}</Holder>
                              <div>
                                <div className={cn('text-[13px] font-semibold', TEXT.strong)}>{name}</div>
                                {row.client && <div className={cn('font-mono text-[11.5px]', TEXT.muted)}>{row.client.customer_code}{row.client.city ? ` · ${row.client.city}` : ''}</div>}
                              </div>
                            </div>
                          </Td>
                          <Td><span className="inline-flex items-center gap-1.5 text-[12.5px]"><LocationMark location={row.location} size={18} />{row.location === 'warehouse' ? 'Entrepôt' : 'Bureau'}</span></Td>
                          <Td align="right"><span className="text-[13px] tabular-nums">{row.deposits}</span></Td>
                          <Td align="right"><span className="text-[13px] font-semibold tabular-nums">{row.parcels}</span></Td>
                          <Td align="right"><span className="text-[13px] tabular-nums">{formatKg(row.weight_kg)}</span></Td>
                          <Td align="right"><span className="text-[13px] tabular-nums">{formatCbm(row.cbm)}</span></Td>
                          <Td><span className={cn('text-[12.5px] tabular-nums', TEXT.muted)}>{formatDateTime(row.last_at)}</span></Td>
                          <Td last><ChevronRight className={cn('h-4 w-4', TEXT.muted)} /></Td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </>
          ) : loading ? <ScreenLoader /> : board.error ? empty((board.error as Error).message) : view === 'deposits' ? (
            deposits.length === 0 ? empty(emptyMsg) : (
              <>
                {selectionBar}
                <table className="w-full text-left">
                  <thead className={SURFACE.card}>
                    <tr>
                      <Th first className="w-[34px]">
                        <GroupTick ids={slice(deposits).map((d) => d.id)} selected={selDeposits} setSelected={setSelDeposits} label="Tous les dépôts de cette page" />
                      </Th>
                      <Th className="w-[34px]" />
                      <Th>Dépôt · reçu le</Th>
                      <Th>Client</Th>
                      <Th align="right">Colis</Th>
                      <Th>Photos</Th>
                      <Th align="right">Poids · m³</Th>
                      <Th>État</Th>
                      <Th>Devis</Th>
                      <Th last className="w-[44px]" />
                    </tr>
                  </thead>
                  <tbody>
                    {slice(deposits).map((d) => {
                      const open = expanded.has(d.id);
                      const sorted = sortedParcels(d.parcels);
                      const covers = sorted.filter((p) => parcelPhotoPaths(p).length > 0);
                      const photos = sorted.reduce((s, p) => s + parcelPhotoPaths(p).length, 0);
                      return (
                        <Fragment key={d.id}>
                          <tr onClick={() => openDeposit(d)} className={cn('cursor-pointer transition-colors hover:bg-muted/40', (depositId === d.id || selDeposits.has(d.id)) && 'bg-accent', d.status === 'cancelled' && 'opacity-70')}>
                            <Td first>
                              <Tick on={selDeposits.has(d.id)} label={`Sélectionner ${d.deposit_no}`} onChange={() => setSelDeposits((s) => toggleId(s, d.id))} />
                            </Td>
                            <Td>
                              <button type="button" aria-label={open ? 'Replier' : 'Déplier les colis'} aria-expanded={open} onClick={(e) => { e.stopPropagation(); setExpanded((s) => toggleId(s, d.id)); }} className="flex h-7 w-7 items-center justify-center rounded-md hover:bg-accent">
                                {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                              </button>
                            </Td>
                            <Td>
                              <span className="flex items-center gap-2.5">
                                <LocationMark location={d.location} size={22} />
                                <span>
                                  <span className={cn('block font-mono text-[12.5px] font-bold', TEXT.strong)}>{d.deposit_no}</span>
                                  <span className={cn('block text-[11.5px] tabular-nums', TEXT.muted)} title={formatDateTime(depositDate(d))}>{listDate(depositDate(d))} · {d.received_by_name || '—'}</span>
                                </span>
                              </span>
                            </Td>
                            <Td className="max-w-[220px]">
                              <div className={cn('truncate text-[13px] font-semibold', d.client ? TEXT.strong : 'text-amber-700 dark:text-amber-400')}>{d.client ? clientFullName(d.client) : 'À attribuer'}</div>
                              <div className={cn('truncate text-[11.5px]', TEXT.muted)}>{d.client ? <span className="font-mono">{d.client.customer_code}</span> : 'client inconnu'}{d.supplier_name ? ` · ${d.supplier_name}` : ''}</div>
                            </Td>
                            <Td align="right"><span className="text-[13px] font-semibold tabular-nums">{parcelsHere(d)}</span></Td>
                            <Td>
                              <span className="flex items-center gap-1">
                                {covers.slice(0, 3).map((p) => <CoverThumb key={p.id} parcel={p} size="h-8 w-8" onClick={() => openViewer(d, p.id)} />)}
                                {photos === 0 ? <span className="text-[12px] font-semibold text-amber-700 dark:text-amber-400">aucune</span> : covers.length > 3 && <span className={cn('pl-1 text-[11.5px] tabular-nums', TEXT.muted)}>+{covers.length - 3}</span>}
                              </span>
                            </Td>
                            <Td align="right">
                              <span className="block text-[13px] tabular-nums">{formatKg(d.total_weight_kg)}</span>
                              <span className={cn('block text-[11.5px] tabular-nums', TEXT.muted)}>{formatCbm(d.total_cbm)}</span>
                            </Td>
                            <Td><DepositStatePill deposit={d} /></Td>
                            {/* Dépôt supprimé : son devis est figé (la fiche ne le propose plus), pas de PDF depuis la liste. */}
                            <Td><QuoteCell deposit={d} onDownload={d.status === 'cancelled' ? undefined : () => void downloadQuote(d)} busy={quoteBusy.has(d.id)} /></Td>
                            <Td last>
                              <button type="button" disabled={!d.client || d.parcels.length === 0} title={d.client ? 'Étiquettes du dépôt' : 'Attribuez d’abord le dépôt'} aria-label="Étiquettes du dépôt"
                                onClick={(e) => { e.stopPropagation(); setLabelsFor(d); }} className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-accent disabled:opacity-30">
                                <Tag className="h-4 w-4" />
                              </button>
                            </Td>
                          </tr>
                          {open && sorted.map((p) => {
                            const st = parcelStage(p, d.location);
                            return (
                              <tr key={p.id} onClick={() => openDeposit(d, p.id)} className={cn('cursor-pointer bg-muted/25 transition-colors hover:bg-muted/50', !inScope(p, d) && 'opacity-60')}>
                                <Td first />
                                <Td />
                                <Td><span className={cn('pl-8 font-mono text-[12px]', TEXT.muted)}>{p.parcel_no}</span></Td>
                                <Td className="max-w-[240px]">
                                  <span className="flex items-center gap-2.5">
                                    <CoverThumb parcel={p} size="h-8 w-8" onClick={() => openViewer(d, p.id)} />
                                    <span className="min-w-0">
                                      <span className={cn('block truncate text-[12.5px] font-semibold', TEXT.strong)}>{p.description || labels.kind(p.kind)}</span>
                                      {p.courier_waybill && <span className={cn('block font-mono text-[11px]', TEXT.muted)}>{p.courier_waybill}</span>}
                                    </span>
                                  </span>
                                </Td>
                                <Td />
                                <Td><span className={cn('text-[11.5px] tabular-nums', parcelPhotoPaths(p).length ? TEXT.muted : 'font-semibold text-amber-700 dark:text-amber-400')}>{parcelPhotoPaths(p).length ? `${parcelPhotoPaths(p).length} photo${parcelPhotoPaths(p).length > 1 ? 's' : ''}` : 'sans photo'}</span></Td>
                                <Td align="right">
                                  <span className={cn('block text-[12.5px] tabular-nums', p.weight_kg == null && 'font-semibold text-amber-700 dark:text-amber-400')}>{formatKg(p.weight_kg)}</span>
                                  <span className={cn('block text-[11px] tabular-nums', TEXT.muted)} title={formatDims(p)}>{formatCbm(p.cbm)}</span>
                                </Td>
                                <Td>
                                  <span className="flex flex-wrap items-center gap-1.5">
                                    <StatusPill tone={st.tone} label={st.label} />
                                    {p.package_no && p.air_package_id && (
                                      <button type="button" title={`Ouvrir le paquet ${p.package_no}`} onClick={(e) => { e.stopPropagation(); openPackage(p.air_package_id!); }} className="rounded-md hover:ring-1 hover:ring-foreground/40">
                                        <PackageChip packageNo={p.package_no} variant="desktop" />
                                      </button>
                                    )}
                                  </span>
                                </Td>
                                <Td colSpan={2} last />
                              </tr>
                            );
                          })}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
                {pager}
              </>
            )
          ) : view === 'parcels' ? (
            parcelRows.length === 0 ? empty(emptyMsg) : (
              <>
                {selectionBar}
                <table className="w-full text-left">
                  <thead className={SURFACE.card}>
                    <tr>
                      <Th first className="w-[34px]">
                        {/* La case de l'en-tête coche la PAGE affichée, pas toutes les pages. */}
                        <GroupTick ids={slice(parcelRows).map((r) => r.parcel.id)} selected={selected} setSelected={setSelected} label="Tout sélectionner (cette page)" />
                      </Th>
                      <Th>Photo</Th>
                      <Th>Colis · reçu le</Th>
                      <Th>Ce qu'il y a dedans</Th>
                      <Th align="right">Poids</Th>
                      <Th align="right">Volume</Th>
                      <Th>Client</Th>
                      <Th last>État</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {slice(parcelRows).map(({ parcel: p, deposit: d }) => {
                      const st = d.status === 'cancelled' ? { tone: 'danger' as const, label: 'Dépôt supprimé' } : parcelStage(p, d.location);
                      const on = selected.has(p.id);
                      return (
                        <tr key={p.id} onClick={() => openDeposit(d, p.id)} className={cn('cursor-pointer transition-colors hover:bg-muted/40', on && 'bg-accent/60')}>
                          <Td first>
                            <Tick on={on} label={`Sélectionner ${p.parcel_no}`} onChange={() => setSelected((s) => toggleId(s, p.id))} />
                          </Td>
                          <Td><CoverThumb parcel={p} onClick={() => openViewer(d, p.id)} /></Td>
                          <Td>
                            <span className="flex items-center gap-2">
                              <LocationMark location={d.location} size={18} />
                              <span>
                                <span className={cn('block font-mono text-[12.5px] font-bold', TEXT.strong)}>{p.parcel_no}</span>
                                <span className={cn('block text-[11.5px] tabular-nums', TEXT.muted)} title={formatDateTime(depositDate(d))}>{listDate(depositDate(d))}</span>
                              </span>
                            </span>
                          </Td>
                          <Td className="max-w-[220px]">
                            <div className={cn('truncate text-[13px] font-semibold', TEXT.strong)}>{p.description || labels.kind(p.kind)}</div>
                            {p.courier_waybill && <div className={cn('truncate font-mono text-[11px]', TEXT.muted)}>{p.courier_waybill}</div>}
                          </Td>
                          <Td align="right"><span className={cn('text-[13px] tabular-nums', p.weight_kg == null && 'font-semibold text-amber-700 dark:text-amber-400')}>{formatKg(p.weight_kg)}</span></Td>
                          <Td align="right">
                            <span className="block text-[13px] tabular-nums">{formatCbm(p.cbm)}</span>
                            <span className={cn('block text-[11px] tabular-nums', TEXT.muted)}>{formatDims(p)}</span>
                          </Td>
                          <Td className="max-w-[180px]">
                            <div className={cn('truncate text-[12.5px] font-semibold', d.client ? TEXT.strong : 'text-amber-700 dark:text-amber-400')}>{d.client ? clientFullName(d.client) : 'À attribuer'}</div>
                            {d.client && <div className={cn('font-mono text-[11px]', TEXT.muted)}>{d.client.customer_code}</div>}
                          </Td>
                          <Td last>
                            <span className="flex flex-wrap items-center gap-1.5">
                              <StatusPill tone={st.tone} label={st.label} />
                              {p.package_no && p.air_package_id && (
                                      <button type="button" title={`Ouvrir le paquet ${p.package_no}`} onClick={(e) => { e.stopPropagation(); openPackage(p.air_package_id!); }} className="rounded-md hover:ring-1 hover:ring-foreground/40">
                                        <PackageChip packageNo={p.package_no} variant="desktop" />
                                      </button>
                                    )}
                            </span>
                          </Td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {pager}
              </>
            )
          ) : (
            /* ── Le mur de photos, dépôt par dépôt ─────────────────────── */
            wall.length === 0 ? empty(emptyMsg) : (
              <>
                <div className="divide-y divide-border">
                  {slice(wall).map(({ d, count, tiles }) => {
                    return (
                      <section key={d.id} className="px-5 py-4">
                        <button type="button" onClick={() => openDeposit(d)} className="mb-3 flex w-full items-center gap-3 text-left">
                          <LocationMark location={d.location} size={22} />
                          <span className="min-w-0 flex-1">
                            <span className={cn('block text-[13.5px] font-bold', TEXT.strong)}>
                              <span className="font-mono">{d.deposit_no}</span> · {d.client ? clientFullName(d.client) : <span className="text-amber-700 dark:text-amber-400">À attribuer</span>}
                            </span>
                            <span className={cn('block text-[12px] tabular-nums', TEXT.muted)}>
                              {formatDateTime(depositDate(d))} · par {d.received_by_name || '—'} · {count} colis · {tiles.filter((t) => t.path).length} photo{tiles.filter((t) => t.path).length > 1 ? 's' : ''}
                            </span>
                          </span>
                          <DepositStatePill deposit={d} />
                          <ChevronRight className={cn('h-4 w-4', TEXT.muted)} />
                        </button>
                        <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-2.5">
                          {tiles.map((t) => (
                            <PhotoTile key={`${t.p.id}-${t.k}`} path={t.path} caption={t.p.parcel_no} sub={t.n > 1 ? `${t.k + 1}/${t.n}` : t.p.weight_kg != null ? formatKg(t.p.weight_kg) : undefined}
                              onClick={() => (t.path ? openViewer(d, t.p.id, t.k) : openDeposit(d, t.p.id))} />
                          ))}
                        </div>
                      </section>
                    );
                  })}
                </div>
                {pager}
              </>
            )
          )}
        </Card>

        {/* ── Sous la liste : Douala, et le travail de chaque réceptionnaire ── */}
        <div className={cn('grid items-start gap-5', seesDouala && douala.data ? 'grid-cols-2' : 'grid-cols-1')}>
          {seesDouala && douala.data && (
            <Card className="overflow-hidden p-0">
              <CardHeader title="À Douala" meta={<a href="/w" className={cn('text-[12px] font-semibold underline-offset-2 hover:underline', TEXT.strong)}>ouvrir l'app entrepôt</a>} />
              <div className="grid grid-cols-2 gap-x-5 gap-y-3 px-5 py-4">
                <KV k="À pointer" v={douala.data.stats.to_checkin} />
                <KV k="Attendent leur client" v={douala.data.stats.waiting} />
                <KV k="Remis aujourd'hui" v={douala.data.stats.delivered_today} />
                <KV k="Manquants" v={<span className={douala.data.stats.missing > 0 ? 'text-red-700 dark:text-red-400' : undefined}>{douala.data.stats.missing}</span>} />
              </div>
              {douala.data.waiting_by_client.length > 0 && (
                <ul className="border-t border-black/[0.05] dark:border-white/[0.05]">
                  {douala.data.waiting_by_client.slice(0, 5).map((w) => {
                    const name = w.client ? clientFullName(w.client) : 'Client à attribuer';
                    return (
                      <li key={w.client?.user_id ?? 'none'} className="flex items-center gap-3 border-t border-black/[0.05] px-5 py-3 first:border-t-0 dark:border-white/[0.05]">
                        <Holder size="sm">{w.client ? initials(name) : '?'}</Holder>
                        <span className="min-w-0 flex-1">
                          <span className={cn('block truncate text-[13px] font-semibold', TEXT.strong)}>{name}</span>
                          <span className={cn('block text-[12px] tabular-nums', TEXT.muted)}>{w.parcels} colis · {formatKg(w.weight_kg)}</span>
                        </span>
                        {w.unpaid ? <StatusPill tone="pending" label={w.balance_xaf > 0 ? `reste ${fmtXaf(w.balance_xaf)}` : 'À encaisser'} /> : <StatusPill tone="success" label="Payé" />}
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>
          )}
          <Card className="overflow-hidden p-0">
            <CardHeader title="Par réceptionnaire" meta={PERIODS.find((p) => p.value === period)?.label.toLowerCase()} />
            {loading ? <ScreenLoader /> : staff.length === 0 ? (
              <p className={cn('px-5 py-8 text-center text-[13px]', TEXT.muted)}>Personne sur cette vue.</p>
            ) : (
              <ul className={cn(!(seesDouala && douala.data) && 'grid grid-cols-3')}>
                {staff.map((r) => (
                  <li key={r.id}>
                    <button type="button" onClick={() => setReceivedBy((cur) => (cur === r.id ? null : r.id))} aria-pressed={receivedBy === r.id}
                      className={cn('flex w-full items-start gap-3 border-t border-black/[0.05] px-5 py-3.5 text-left transition-colors hover:bg-muted/40 dark:border-white/[0.05]', receivedBy === r.id && 'bg-accent')}>
                      <Holder size="md">{initials(r.name)}</Holder>
                      <span className="min-w-0 flex-1">
                        <span className={cn('block text-[13px] font-bold', TEXT.strong)}>{r.name}</span>
                        <span className={cn('mt-0.5 block text-[12px] tabular-nums', TEXT.muted)}>{r.deposits} dépôt{r.deposits > 1 ? 's' : ''} · {r.parcels} colis</span>
                        <span className={cn('block text-[12px] tabular-nums', TEXT.muted)}>{formatKg(r.kg)} · {formatCbm(r.cbm)}</span>
                        {(r.incomplete > 0 || r.pending > 0) && (
                          <span className="mt-2 flex flex-wrap gap-1.5">
                            {r.incomplete > 0 && <StatusPill tone="pending" label={`${r.incomplete} incomplet${r.incomplete > 1 ? 's' : ''}`} />}
                            {r.pending > 0 && <StatusPill tone="danger" label={`${r.pending} à attribuer`} />}
                          </span>
                        )}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
        <p className={cn('-mt-1 px-1 text-[12px] leading-snug', TEXT.muted)}>
          <Images className="mr-1 inline h-3.5 w-3.5" />Cliquez une vignette pour voir les photos en grand (← → pour passer d'une photo à l'autre). Cliquez un dépôt pour le modifier, ajouter ou supprimer un colis, imprimer ses étiquettes.
        </p>
      </div>
      )}

      {/* La fiche d'un paquet (lien profond ?paquet=) ; un dépôt ouvert depuis elle s'empile par-dessus, elle reste montée. */}
      {packageId && (
        <PackageWorkbench key={packageId} packageId={packageId} packable={packing.packable}
          onClose={closePackage} onOpenPackage={(id) => openPackage(id, true)} onOpenDeposit={openDepositId} onOpenFlight={(id) => navigate(`/m/cargo/avion/${id}`)} />
      )}
      <ClientParcelsQuickView clientId={clientId} onClose={() => setClientId(null)} onOpenDeposit={(id) => { setClientId(null); navigate(`/m/cargo/reception/${id}`); }} />
      <DepositQuickView depositId={depositId ?? null} focusParcelId={focusParcel} onClose={() => navigate(packageId ? `/m/cargo/reception?${new URLSearchParams({ paquet: packageId }).toString()}` : '/m/cargo/reception')} />
      {labelsFor && <DepositLabelsDialog deposit={labelsFor} open onClose={() => setLabelsFor(null)} />}
      <PackDialog
        open={!!packItems}
        items={packItems ?? []}
        onClose={() => setPackItems(null)}
        onDone={clearSelection}
        onOpenPackage={(id) => { setPackItems(null); openPackage(id); }}
        onShowPackages={() => { setPackItems(null); setView('packages'); }}
      />

      {viewerDeposit && (
        <ParcelPhotoViewer
          parcels={viewerDeposit.parcels.map((p) => ({ ...p, note: parcelStage(p, viewerDeposit.location).label }))}
          index={viewer.index} close={() => { viewer.close(); setViewerDeposit(null); }} setIndex={viewer.setIndex} photo={viewer.photo} setPhoto={viewer.setPhoto}
          title={`${viewerDeposit.deposit_no}${viewerDeposit.client ? ` · ${clientFullName(viewerDeposit.client)}` : ''}`}
        />
      )}
    </div>
  );
}
