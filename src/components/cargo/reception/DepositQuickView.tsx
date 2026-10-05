// ============================================================
// Desktop admin — LA fiche d'un dépôt de colis, avec le contrôle total :
//   · en tête, les gestes : étiquettes (colis et client), ajouter un colis,
//     modifier le dépôt, changer de client, supprimer — ou rétablir ;
//   · le client (attribuer un dépôt orphelin, ou le réattribuer) ;
//   · la réception (qui l'a apporté, qui l'a reçu, quand, le fournisseur) ;
//   · les colis : chaque colis avec TOUTES ses photos, ses mesures, son état,
//     et ses gestes (photos, étiquette, modifier, supprimer) ;
//   · le devis, les encaissements, les bons de retrait, l'historique.
// Ce que la base refuse (colis parti, devis réglé), l'écran le dit avant.
// ============================================================
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Download, Images, Pencil, Plus, RotateCcw, Search, Tag, Trash2, UserSearch } from 'lucide-react';
import { toast } from 'sonner';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { useAssignDeposit, useCancelDeposit, useParcelPhotoUrl, useReceptionDeposit, useReceptionSearch, useRemoveParcel, useRestoreDeposit } from '@/hooks/useReception';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useAdminShippingSettings } from '@/hooks/useShippingSettings';
import { DEFAULT_SHIPPING_SETTINGS } from '@/lib/customerCode';
import {
  clientFullName, depositDate, depositSupplier, formatCbm, formatDims, formatKg, initials, isParcelWaiting, parcelLockReason, parcelPhotoPaths, parcelStage, sortedParcels, supplierLine, waitingWhere,
  type Parcel,
} from '@/lib/reception';
import { useCargoQuote } from '@/hooks/useCargoQuote';
import { depositTimeline } from '@/lib/parcelDepositTimeline';
import { DepositReleases, releaseIds } from '@/mobile/components/cargo/DepositReleases';
import { DepositTimeline } from '@/mobile/components/cargo/DepositTimeline';
import { ParcelPhotoViewer, useParcelViewer } from '@/mobile/components/reception/ParcelPhotoViewer';
import { Band, Fact, Facts } from '@/components/cargo/dossier/kit';
import { LocationMark, formatDateTime, useReceptionLabels } from '@/mobile/components/reception/bits';
import { downloadFile } from '@/components/customer-code/exportShippingLabel';
import { downloadQuotePdf } from '@/lib/cargoQuotePdf';
import { QuoteSection } from './QuoteSection';
import { QuotePaymentsSection } from './QuotePaymentsSection';
import { ParcelEditorDialog } from './ParcelEditorDialog';
import { DepositEditDialog } from './DepositEditDialog';
import { DepositLabelsDialog } from './DepositLabelsDialog';
import { ReasonDialog } from './ReasonDialog';
import { useParcelLabels } from './useParcelLabels';
import { DepositStatePill } from './ReceptionBits';
import { cn } from '@/lib/utils';
import { SURFACE, TEXT, SOFT_PILL, PRIMARY_PILL, DANGER_SOFT_PILL, CenterDialog, Holder, ScreenLoader, StatusPill, TextInput, Th, Td } from '@/desktop/designKit';

/** Une vignette de la bande de photos d'un colis. */
function StripThumb({ path, onClick, extra }: { path: string; onClick: () => void; extra?: number }) {
  const { data: url } = useParcelPhotoUrl(path);
  return (
    <button type="button" onClick={(e) => { e.stopPropagation(); onClick(); }} className={cn('relative h-11 w-11 shrink-0 overflow-hidden rounded-md ring-1 ring-border', SURFACE.inset)} aria-label="Voir les photos">
      {url && <img src={url} alt="" className="h-full w-full object-cover" draggable={false} />}
      {extra != null && extra > 0 && <span className="absolute inset-0 flex items-center justify-center bg-black/55 text-[12px] font-bold text-white">+{extra}</span>}
    </button>
  );
}

/** Les photos d'un colis, en bande : trois vignettes, puis « +n ». Sans photo : un appel à en ajouter. */
function PhotoStrip({ parcel, onOpen, onAdd }: { parcel: Parcel; onOpen: (k: number) => void; onAdd?: () => void }) {
  const paths = parcelPhotoPaths(parcel);
  if (paths.length === 0) {
    return onAdd ? (
      <button type="button" onClick={(e) => { e.stopPropagation(); onAdd(); }} className="flex h-11 w-[100px] items-center justify-center gap-1 rounded-md border border-dashed border-amber-400 text-[11px] font-semibold text-amber-700 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-950/40">
        <Plus className="h-3.5 w-3.5" /> Photo
      </button>
    ) : <span className="flex h-11 w-11 items-center justify-center rounded-md border border-dashed border-border text-[10px] text-muted-foreground">—</span>;
  }
  const shown = paths.slice(0, 3);
  return (
    <span className="flex gap-1">
      {shown.map((p, k) => <StripThumb key={p} path={p} onClick={() => onOpen(k)} extra={k === shown.length - 1 ? paths.length - shown.length : undefined} />)}
    </span>
  );
}

export function DepositQuickView({ depositId, onClose, focusParcelId }: { depositId: string | null; onClose: () => void; focusParcelId?: string | null }) {
  const navigate = useNavigate();
  const { hasPermission, currentUser } = useAdminAuth();
  const labels = useReceptionLabels();
  const { data: d, error: loadError } = useReceptionDeposit(depositId ?? undefined);
  const { data: quote } = useCargoQuote(depositId ?? undefined);
  const { data: settingsData } = useAdminShippingSettings();
  const settings = settingsData ?? DEFAULT_SHIPPING_SETTINGS;
  const viewer = useParcelViewer();

  // Changer de client
  const [assigning, setAssigning] = useState(false);
  const [query, setQuery] = useState('');
  const debounced = useDebouncedValue(query, 250);
  const search = useReceptionSearch(assigning ? debounced : '');
  const assign = useAssignDeposit();

  // Les dialogues de la fiche
  const [editor, setEditor] = useState<{ parcel: Parcel | null } | null>(null);
  const [editingDeposit, setEditingDeposit] = useState(false);
  const [labelsFor, setLabelsFor] = useState<{ tab: 'parcels' | 'client'; parcelId?: string } | null>(null);
  const [removing, setRemoving] = useState<Parcel | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const removeParcel = useRemoveParcel();
  const cancelDeposit = useCancelDeposit();
  const restoreDeposit = useRestoreDeposit();

  useEffect(() => {
    if (depositId) return;
    setAssigning(false); setQuery(''); viewer.close(); setEditor(null); setEditingDeposit(false); setLabelsFor(null); setRemoving(null); setCancelling(false);
  }, [depositId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Arrivé depuis la vue Colis : le colis demandé est mis en évidence — une fois,
  // pas à chaque rafraîchissement (on corrige peut-être un autre colis entre-temps).
  const rowRefs = useRef(new Map<string, HTMLTableRowElement>());
  const scrolledTo = useRef<string | null>(null);
  const loaded = !!d;
  useEffect(() => {
    const key = `${depositId}:${focusParcelId}`;
    if (!loaded || !focusParcelId || scrolledTo.current === key) return;
    scrolledTo.current = key;
    const t = setTimeout(() => rowRefs.current.get(focusParcelId)?.scrollIntoView({ block: 'center', behavior: 'smooth' }), 150);
    return () => clearTimeout(t);
  }, [loaded, depositId, focusParcelId]);

  const parcels = useMemo(() => sortedParcels(d?.parcels ?? []), [d?.parcels]);
  const labelMaker = useParcelLabels(useMemo(() => (d ? parcels.map((parcel) => ({ parcel, deposit: d })) : []), [d, parcels]), settings, !!d && !!d.client);
  const [labelBusy, setLabelBusy] = useState<string | null>(null);
  const [quoteBusy, setQuoteBusy] = useState(false);

  const cancelled = d?.status === 'cancelled';
  const isCargo = hasPermission('canManageCargo');
  const owner = !!d && d.received_by === currentUser?.id && hasPermission('canReceiveParcels');
  const paid = quote?.status === 'paid' || quote?.status === 'invoiced';
  const departed = parcels.filter((p) => parcelLockReason(p) !== null);
  const canEditDeposit = !!d && !cancelled && (isCargo || (d.status === 'open' && owner));
  const canAddParcel = !!d && !cancelled && !(d.status === 'closed' && paid) && (isCargo || (d.status === 'open' && owner));
  const canEditParcels = !!d && !cancelled && (isCargo || owner);
  const canCancel = !!d && !cancelled && (isCargo || (d.status === 'open' && owner));
  const cancelBlock = departed.length > 0 ? 'Des colis sont déjà emballés dans un paquet avion ou partis' : (quote && (quote.amount_paid_xaf > 0 || paid || quote.invoice_no)) ? 'Des encaissements existent : annulez-les d’abord' : null;
  const removeBlock = (p: Parcel): string | null => {
    if (!d || cancelled) return 'Dépôt supprimé';
    if (!(isCargo || (d.status === 'open' && owner))) return 'Réservé à l’équipe cargo';
    const lock = parcelLockReason(p);
    if (lock) return lock;
    if (paid || (quote && (quote.amount_paid_xaf > 0 || quote.invoice_no))) return 'Le devis a déjà reçu des encaissements';
    if (d.status === 'closed' && parcels.length <= 1) return 'Dernier colis : supprimez plutôt le dépôt';
    return null;
  };

  const name = d?.client ? clientFullName(d.client) : 'Client à attribuer';
  const waiting = parcels.filter(isParcelWaiting).length;
  const supplier = d ? depositSupplier(d) : null;
  const photoCount = parcels.reduce((n, p) => n + parcelPhotoPaths(p).length, 0);
  const events = d ? depositTimeline(d, quote) : [];
  const kgMissing = parcels.filter((p) => p.weight_kg == null).length;

  const downloadOne = async (p: Parcel) => {
    setLabelBusy(p.id);
    try { downloadFile(await labelMaker.pdfFile([p.id], `bonzini-etiquette-${p.parcel_no}.pdf`)); toast.success(`Étiquette ${p.parcel_no} téléchargée`); }
    catch (e) { toast.error((e as Error).message); }
    finally { setLabelBusy(null); }
  };

  const action = (Icon: typeof Tag, label: string, onClick: () => void, opts: { primary?: boolean; danger?: boolean; disabled?: boolean; title?: string } = {}) => (
    <button type="button" onClick={onClick} disabled={opts.disabled} title={opts.title}
      className={cn('inline-flex h-9 items-center gap-2 px-3.5 text-[13px] font-semibold disabled:opacity-45', opts.primary ? PRIMARY_PILL : opts.danger ? DANGER_SOFT_PILL : SOFT_PILL)}>
      <Icon className="h-4 w-4" /> {label}
    </button>
  );
  const iconBtn = (Icon: typeof Tag, label: string, onClick: () => void, opts: { danger?: boolean; disabled?: boolean; title?: string; busy?: boolean } = {}) => (
    <button type="button" onClick={(e) => { e.stopPropagation(); onClick(); }} disabled={opts.disabled || opts.busy} title={opts.title ?? label} aria-label={label}
      className={cn('flex h-8 w-8 items-center justify-center rounded-md transition-colors disabled:opacity-35', opts.danger ? 'text-destructive hover:bg-destructive/10' : 'hover:bg-accent', TEXT.strong, opts.danger && 'text-destructive')}>
      <Icon className={cn('h-4 w-4', opts.busy && 'animate-pulse')} />
    </button>
  );

  return (
    <CenterDialog
      open={!!depositId}
      onClose={onClose}
      width={1040}
      title={
        d ? (
          <span className="flex items-center gap-3">
            <LocationMark location={d.location} size={32} />
            <span className="min-w-0">
              <span className={cn('block text-[16px] font-bold tabular-nums', TEXT.strong)}>{d.deposit_no} · {name}</span>
              <span className={cn('block text-[12px]', TEXT.muted)}>{labels.location(d.location)} · reçu le {formatDateTime(depositDate(d))}{d.received_by_name ? ` par ${d.received_by_name}` : ''}</span>
            </span>
            <span className="ml-auto"><DepositStatePill deposit={d} /></span>
          </span>
        ) : 'Dépôt'
      }
      bodyClassName="-mx-5 -mb-1 mt-1"
      footer={d?.client ? (
        <button type="button" onClick={() => { onClose(); navigate(`/m/clients/${d.client!.user_id}`); }} className={cn('ml-auto inline-flex h-9 items-center gap-2 px-3.5 text-[13px] font-semibold', SOFT_PILL)}>
          Fiche client <ArrowRight className="h-4 w-4" />
        </button>
      ) : undefined}
    >
      {!d ? (
        loadError ? (
          <p className="px-5 py-10 text-center text-[13px] text-destructive">{(loadError as Error).message || 'Dépôt introuvable'}</p>
        ) : <ScreenLoader />
      ) : (
        <>
          {labelMaker.nodes}

          {/* ── Les gestes du dépôt ─────────────────────────────────────── */}
          <div className="flex flex-wrap items-center gap-2 px-5 pb-4">
            {action(Tag, 'Étiquettes', () => setLabelsFor({ tab: 'parcels' }), { primary: true, disabled: !d.client || parcels.length === 0, title: !d.client ? 'Attribuez d’abord le dépôt à un client' : undefined })}
            {d.client && action(Download, 'Étiquette client', () => setLabelsFor({ tab: 'client' }))}
            {canAddParcel && action(Plus, 'Ajouter un colis', () => setEditor({ parcel: null }))}
            {canEditDeposit && action(Pencil, 'Modifier le dépôt', () => setEditingDeposit(true))}
            {photoCount > 0 && action(Images, `Photos (${photoCount})`, () => viewer.open(Math.max(0, parcels.findIndex((p) => parcelPhotoPaths(p).length > 0))))}
            <span className="ml-auto" />
            {canCancel && action(Trash2, 'Supprimer', () => setCancelling(true), { danger: true, disabled: !!cancelBlock, title: cancelBlock ? `Suppression impossible : ${cancelBlock}` : 'Supprimer le dépôt' })}
            {cancelled && isCargo && action(RotateCcw, 'Rétablir', () => restoreDeposit.mutate(d.id, { onSuccess: () => toast.success(`Dépôt ${d.deposit_no} rétabli`) }), { disabled: restoreDeposit.isPending })}
          </div>

          {cancelled && (
            <div className="mx-5 mb-4 rounded-md bg-destructive/10 px-4 py-3 text-[13px] text-destructive">
              <span className="font-bold">Dépôt supprimé</span>
              {d.cancelled_at && <> le {formatDateTime(d.cancelled_at)}</>}{d.cancelled_by_name && <> par {d.cancelled_by_name}</>}
              {d.cancel_reason && <> — « {d.cancel_reason} »</>}. Il n'apparaît plus dans le stock ni dans les chargements.
            </div>
          )}

          {/* ── Le client ──────────────────────────────────────────────── */}
          <Band first>
            <div className="flex items-center gap-3">
              <Holder size="lg" tone={d.client ? 'neutral' : 'pending'}>{d.client ? initials(name) : '?'}</Holder>
              <div className="min-w-0 flex-1">
                <div className={cn('text-[14px] font-bold', TEXT.strong)}>{name}</div>
                <div className={cn('text-[12px]', TEXT.muted)}>
                  {d.client ? [d.client.customer_code, d.client.phone, d.client.company_name, d.client.city, d.client.account_name ? `compte ${d.client.account_name}` : null].filter(Boolean).join(' · ') : 'Personne ne sait encore à qui il est. Rappelez, ou attendez que le client se manifeste.'}
                </div>
              </div>
              {!cancelled && ((!d.client && hasPermission('canReceiveParcels')) || (d.client && isCargo)) && (
                <button type="button" onClick={() => setAssigning((v) => !v)} className={cn('inline-flex h-9 items-center gap-2 px-3.5 text-[13px] font-semibold', d.client ? SOFT_PILL : PRIMARY_PILL)}>
                  <UserSearch className="h-4 w-4" /> {d.client ? 'Changer de client' : 'Attribuer à un client'}
                </button>
              )}
            </div>
            {assigning && (
              <div className="mt-4 space-y-1.5">
                <div className="relative">
                  <Search className={cn('pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2', TEXT.muted)} />
                  <TextInput value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Nom, téléphone, BZ-…" autoFocus className="h-10 rounded-md pl-9 text-[13.5px]" />
                </div>
                {(search.data ?? []).filter((c) => c.user_id !== d.client?.user_id).map((c) => {
                  const n = clientFullName(c);
                  return (
                    <button
                      key={c.user_id}
                      type="button"
                      disabled={assign.isPending}
                      onClick={async () => {
                        await assign.mutateAsync({ depositId: d.id, clientUserId: c.user_id });
                        toast.success(d.client ? 'Dépôt réattribué' : 'Dépôt attribué', { description: n });
                        setAssigning(false); setQuery('');
                      }}
                      className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left hover:bg-accent disabled:opacity-50"
                    >
                      <Holder size="sm">{initials(n)}</Holder>
                      <span className="min-w-0 flex-1">
                        <span className={cn('block truncate text-[13px] font-semibold', TEXT.strong)}>{n} <span className={cn('font-mono text-[12px]', TEXT.muted)}>{c.customer_code}</span></span>
                        <span className={cn('block truncate text-[12px]', TEXT.muted)}>{[c.phone, c.city, c.account_name ? `compte ${c.account_name}` : null].filter(Boolean).join(' · ')}</span>
                      </span>
                    </button>
                  );
                })}
                {d.client && <p className={cn('px-1 text-[12px]', TEXT.muted)}>Les étiquettes déjà imprimées portent l'ancien code client : réimprimez-les après le changement.</p>}
              </div>
            )}
          </Band>

          {/* ── La réception ───────────────────────────────────────────── */}
          <Band title="La réception">
            <Facts cols={4}>
              <Fact label="Apporté par" value={labels.broughtBy(d.brought_by)} hint={d.representative_name ? `${d.representative_name}${d.representative_phone ? ` · ${d.representative_phone}` : ''}` : undefined} />
              <Fact label="Reçu par" value={d.received_by_name ?? '—'} hint={d.status === 'open' ? 'saisie en cours' : undefined} />
              <Fact label="Reçu le" value={formatDateTime(depositDate(d))} hint={d.closed_at && d.opened_at !== d.closed_at ? `ouvert le ${formatDateTime(d.opened_at)}` : undefined} />
              <Fact label="Total" value={`${parcels.length} colis · ${formatKg(d.total_weight_kg)}`} hint={`${formatCbm(d.total_cbm)}${kgMissing > 0 ? ` · ${kgMissing} sans poids` : ''}`} />
            </Facts>
            <div className="mt-4"><Facts cols={2}>
              <Fact label="Fournisseur" value={supplier ? supplierLine(supplier) : '—'} hint={supplier ? [supplier.email, supplier.wechat ? `WeChat ${supplier.wechat}` : null, supplier.address].filter(Boolean).join(' · ') || undefined : 'Non renseigné à la réception'} />
              <Fact label="Notes" value={d.notes || '—'} />
            </Facts></div>
          </Band>

          {/* ── Les colis ──────────────────────────────────────────────── */}
          <Band
            title="Les colis"
            meta={`${photoCount} photo${photoCount > 1 ? 's' : ''} · ${waiting} ${waitingWhere([d.location])}${parcels.length - waiting > 0 ? ` · ${parcels.length - waiting} partis` : ''}`}
          >
            {parcels.length === 0 ? (
              <p className={cn('py-6 text-center text-[13px]', TEXT.muted)}>Aucun colis dans ce dépôt.{canAddParcel && ' Ajoutez-en un.'}</p>
            ) : (
              <div className="-mx-5 max-h-[460px] overflow-auto">
                <table className="w-full text-left">
                  <thead className={cn('sticky top-0 z-[1]', SURFACE.card)}>
                    <tr>
                      <Th first>Photos</Th>
                      <Th>N°</Th>
                      <Th>Ce qu'il y a dedans</Th>
                      <Th align="right">Poids</Th>
                      <Th align="right">Dimensions</Th>
                      <Th align="right">m³</Th>
                      <Th>État</Th>
                      <Th last align="right"><span className="sr-only">Actions</span></Th>
                    </tr>
                  </thead>
                  <tbody>
                    {parcels.map((p, i) => {
                      const stage = parcelStage(p, d.location);
                      const lock = parcelLockReason(p);
                      const rb = removeBlock(p);
                      return (
                        <tr key={p.id} ref={(el) => { if (el) rowRefs.current.set(p.id, el); else rowRefs.current.delete(p.id); }}
                          onClick={() => (canEditParcels ? setEditor({ parcel: p }) : viewer.open(i))}
                          className={cn('cursor-pointer transition-colors hover:bg-muted/40', focusParcelId === p.id && 'bg-amber-50 dark:bg-amber-950/30')}>
                          <Td first><PhotoStrip parcel={p} onOpen={(k) => viewer.open(i, k)} onAdd={canEditParcels ? () => setEditor({ parcel: p }) : undefined} /></Td>
                          <Td><span className={cn('font-mono text-[12px] font-bold', TEXT.strong)}>{p.parcel_no}</span></Td>
                          <Td className="max-w-[240px] whitespace-normal">
                            <div className={cn('text-[13px] font-semibold', TEXT.strong)}>{p.description || labels.kind(p.kind)}</div>
                            <div className={cn('text-[11.5px]', TEXT.muted)}>{p.description ? labels.kind(p.kind) : ''}{p.courier_waybill && <span className="font-mono">{p.description ? ' · ' : ''}{p.courier_waybill}</span>}</div>
                          </Td>
                          <Td align="right"><span className={cn('text-[13px] tabular-nums', p.weight_kg == null && 'font-semibold text-amber-700 dark:text-amber-400')}>{formatKg(p.weight_kg)}</span></Td>
                          <Td align="right"><span className={cn('text-[12.5px] tabular-nums', TEXT.muted)}>{formatDims(p)}</span></Td>
                          <Td align="right"><span className="text-[13px] tabular-nums">{formatCbm(p.cbm)}</span></Td>
                          <Td>
                            {stage.inBox && p.shipment_id ? (
                              <button type="button" onClick={(e) => { e.stopPropagation(); onClose(); navigate(`/m/cargo/${p.shipment_id}/chargement`); }}>
                                <StatusPill tone={stage.tone} label={stage.label} />
                              </button>
                            ) : <StatusPill tone={stage.tone} label={stage.label} />}
                          </Td>
                          <Td last align="right">
                            <span className="inline-flex items-center gap-0.5">
                              {iconBtn(Images, 'Voir les photos', () => viewer.open(i), { disabled: parcelPhotoPaths(p).length === 0 })}
                              {iconBtn(Tag, 'Télécharger l’étiquette', () => void downloadOne(p), { disabled: !d.client || !labelMaker.ready, busy: labelBusy === p.id, title: !d.client ? 'Attribuez d’abord le dépôt' : 'Télécharger l’étiquette (PDF)' })}
                              {canEditParcels && iconBtn(Pencil, 'Modifier', () => setEditor({ parcel: p }), { title: lock ? `${lock} — photos seulement` : 'Modifier le colis' })}
                              {canEditParcels && iconBtn(Trash2, 'Supprimer', () => setRemoving(p), { danger: true, disabled: !!rb, title: rb ?? 'Supprimer le colis' })}
                            </span>
                          </Td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Band>

          {/* Un dépôt supprimé ne se chiffre ni ne s'encaisse plus (la base le refuse aussi). */}
          {cancelled ? (
            quote && (
              <Band title="Prix et devis">
                <div className="flex items-center justify-between gap-4">
                  <p className={cn('text-[13px]', TEXT.muted)}>Le devis {quote.quote_no} est conservé, figé : rétablissez le dépôt pour l'envoyer ou l'encaisser.</p>
                  <button
                    type="button"
                    disabled={quoteBusy}
                    onClick={async () => {
                      setQuoteBusy(true);
                      try { await downloadQuotePdf(quote, settings); toast.success(`Devis ${quote.quote_no} téléchargé`); }
                      catch (e) { toast.error((e as Error).message); }
                      finally { setQuoteBusy(false); }
                    }}
                    className={cn('inline-flex h-9 shrink-0 items-center gap-2 px-3.5 text-[13px] font-semibold disabled:opacity-50', SOFT_PILL)}
                  >
                    <Download className="h-4 w-4" /> Télécharger le devis
                  </button>
                </div>
              </Band>
            )
          ) : (
            <>
              <QuoteSection deposit={d} />
              <QuotePaymentsSection depositId={d.id} />
            </>
          )}
          {releaseIds(d.parcels).length > 0 && (
            <Band title="Les bons de retrait"><DepositReleases parcels={d.parcels} /></Band>
          )}
          <Band title="L'historique"><DepositTimeline events={events} flat /></Band>

          <ParcelPhotoViewer
            parcels={parcels.map((p) => ({ ...p, note: parcelStage(p, d.location).label }))}
            index={viewer.index} close={viewer.close} setIndex={viewer.setIndex} photo={viewer.photo} setPhoto={viewer.setPhoto}
            title={d.deposit_no}
          />
          <ParcelEditorDialog deposit={d} parcel={editor?.parcel ?? null} open={!!editor} onClose={() => setEditor(null)} />
          <DepositEditDialog deposit={{ ...d, quote_status: quote?.status ?? d.quote_status }} open={editingDeposit} onClose={() => setEditingDeposit(false)} />
          <DepositLabelsDialog deposit={d} open={!!labelsFor} onClose={() => setLabelsFor(null)} initialTab={labelsFor?.tab} focusParcelId={labelsFor?.parcelId} />
          <ReasonDialog
            open={!!removing}
            onClose={() => setRemoving(null)}
            title={`Supprimer le colis ${removing?.parcel_no ?? ''}`}
            confirmLabel="Supprimer le colis"
            requireReason={d.status === 'closed'}
            busy={removeParcel.isPending}
            suggestions={['Doublon', 'Saisi par erreur', 'Repris par le fournisseur', 'Fusionné avec un autre colis']}
            onConfirm={(reason) => removing && removeParcel.mutate({ parcelId: removing.id, reason }, { onSuccess: () => { toast.success(`Colis ${removing.parcel_no} supprimé`); setRemoving(null); } })}
          >
            Le colis sort du dépôt, ses photos avec lui ; {quote ? 'sa ligne de devis est retirée et le total recalculé ; ' : ''}les totaux du dépôt suivent. Son numéro n'est jamais redonné.
          </ReasonDialog>
          <ReasonDialog
            open={cancelling}
            onClose={() => setCancelling(false)}
            title={`Supprimer le dépôt ${d.deposit_no}`}
            confirmLabel="Supprimer le dépôt"
            busy={cancelDeposit.isPending}
            suggestions={['Saisi en double', 'Saisi par erreur', 'Colis repartis chez le fournisseur']}
            onConfirm={(reason) => cancelDeposit.mutate({ depositId: d.id, reason }, { onSuccess: () => { toast.success(`Dépôt ${d.deposit_no} supprimé`); setCancelling(false); } })}
          >
            Le dépôt et ses {parcels.length} colis disparaissent du stock, des listes et des chargements. Rien n'est effacé : il reste dans « Supprimés » et se rétablit d'un clic.
          </ReasonDialog>
        </>
      )}
    </CenterDialog>
  );
}
