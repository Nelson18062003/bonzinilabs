// ============================================================
// Mobile admin — Cargo › Réception › LA fiche d'un dépôt, avec le contrôle
// total de la version ordinateur (DepositQuickView). Refonte v2 (maquettes
// 04/07, 04/08, 04/09) :
//   · le client en carte (toucher : sa fiche) et l'état du dépôt ;
//   · « 3 colis · 62,4 kg · 0,84 m³ », chaque colis avec sa photo ; toucher
//     un colis : ses photos, le modifier (photos, couverture, mesures, état,
//     bordereau), son étiquette, le conteneur, le supprimer (motif) ;
//     « Ajouter un colis » ;
//   · le devis (montant, envoyé le…, À payer) → l'écran du devis ;
//   · en faisant défiler : les encaissements (reçus, annuler), la facture,
//     les bons de retrait, la réception (apporté par, reçu par, fournisseur,
//     notes) et l'historique ;
//   · le bouton noir : Encaisser le reste (feuille 04/09), ou Attribuer un
//     dépôt orphelin, ou Poser les prix, ou Rétablir un dépôt supprimé ;
//   · « … » : Modifier le dépôt, Réattribuer, Étiquettes des colis,
//     Étiquette client, Bon de réception (PDF), Devis (PDF) FR · EN, Photos,
//     Supprimer le dépôt (motif).
// Ce que la base refuse (colis parti, devis réglé), l'écran le dit avant.
// ============================================================
import { useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Container, FileText, Images, Pencil, Plane, Plus, Tag as TagIcon, Trash2, UserRound, UserSearch } from 'lucide-react';
import { toast } from 'sonner';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { useAssignDeposit, useCancelDeposit, useReceptionDeposit, useReceptionSearch, useRemoveParcel, useRestoreDeposit } from '@/hooks/useReception';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { clientFullName, depositSupplier, formatCbm, formatKg, parcelLockReason, parcelPhotoPaths, parcelStage, sortedParcels, supplierLine, type Parcel } from '@/lib/reception';
import { useCargoQuote } from '@/hooks/useCargoQuote';
import { invoiceAcquitted, quoteBalance, quotePaid, xaf, METHOD_LABEL } from '@/lib/cargoQuote';
import { CARGO_DOC_LANGS, CARGO_DOC_LANG_LABEL, downloadReceiptPdf, downloadReceptionPdf, readCargoDocLang, type CargoDocLang } from '@/lib/cargoQuotePdf';
import { useAdminShippingSettings } from '@/hooks/useShippingSettings';
import { DEFAULT_SHIPPING_SETTINGS } from '@/lib/customerCode';
import { depositTimeline } from '@/lib/parcelDepositTimeline';
import { DepositReleases, releaseIds } from '@/mobile/components/cargo/DepositReleases';
import { DepositTimeline } from '@/mobile/components/cargo/DepositTimeline';
import { ParcelPhotoViewer, useParcelViewer } from '@/mobile/components/reception/ParcelPhotoViewer';
import { InternalLabelSheet } from '@/mobile/components/reception/InternalLabelSheet';
import { ReceptionLabelSheet } from '@/mobile/components/reception/ReceptionLabelSheet';
import { ParcelLine, formatDateTime, useReceptionLabels } from '@/mobile/components/reception/bits';
import { CapsLabel, TapBox, type TapRow } from '@/mobile/components/cargo/v2';
import { cn } from '@/lib/utils';
import {
  ActionSheet, BigButton, BottomSheet, ConfirmSheet, Dock, EmptyLine, IconCircle, Initials, ItemList, ItemRow, KVBox, MoreButton, ScreenLoader, ScreenTop, SearchBox, SuccessView,
  SURFACE, TEXT, TONE_PILL, Tag, useSheet, type KV, type SheetAction,
} from '@/mobile/designKit';
import { QuotePaySheet, QuotePayments, ReasonSheet, type PaidResult } from './QuotePayments';
import { DepositEditSheet } from './DepositEditSheet';

const DATE_SHORT = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' });

export function MobileCargoDepositDetail() {
  const navigate = useNavigate();
  const { depositId } = useParams<{ depositId: string }>();
  const { hasPermission, currentUser } = useAdminAuth();
  const labels = useReceptionLabels();
  const { data: deposit, isLoading, error, refetch } = useReceptionDeposit(depositId);
  const { data: quote } = useCargoQuote(depositId);
  const { data: settingsData } = useAdminShippingSettings();
  const settings = settingsData ?? DEFAULT_SHIPPING_SETTINGS;
  const viewer = useParcelViewer();
  const more = useSheet();

  const [assignOpen, setAssignOpen] = useState(false);
  const [query, setQuery] = useState('');
  const debounced = useDebouncedValue(query, 250);
  const search = useReceptionSearch(assignOpen ? debounced : '');
  const assign = useAssignDeposit();
  const removeParcel = useRemoveParcel();
  const cancelDeposit = useCancelDeposit();
  const restoreDeposit = useRestoreDeposit();

  const [parcelMenu, setParcelMenu] = useState<Parcel | null>(null);
  const [removing, setRemoving] = useState<Parcel | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [editing, setEditing] = useState(false);
  const [labelsFor, setLabelsFor] = useState<{ parcelId?: string } | null>(null);
  const [clientLabel, setClientLabel] = useState(false);
  const [langMenu, setLangMenu] = useState(false);
  const [paying, setPaying] = useState(false);
  const [paid, setPaid] = useState<PaidResult | null>(null);
  const [pdfBusy, setPdfBusy] = useState(false);

  const parcels = useMemo(() => sortedParcels(deposit?.parcels ?? []), [deposit?.parcels]);
  // Arrivé d'un colis (vue Colis, ?colis=…) : ses gestes s'ouvrent, une fois.
  const [params] = useSearchParams();
  const focusId = params.get('colis');
  const focused = useRef<string | null>(null);
  useEffect(() => {
    if (!focusId || focused.current === focusId) return;
    const p = parcels.find((x) => x.id === focusId);
    if (p) { focused.current = focusId; setParcelMenu(p); }
  }, [focusId, parcels]);

  if (!hasPermission('canViewCargo')) return <Navigate to="/m" replace />;
  if (!deposit) {
    return (
      <div className={cn('flex min-h-[100dvh] flex-col', SURFACE.canvas)}>
        <ScreenTop title="Dépôt" backTo="/m/cargo/reception" />
        {isLoading ? <ScreenLoader /> : <EmptyLine action={{ label: 'Réessayer', onClick: () => void refetch() }}>{(error as Error | null)?.message ?? 'Dépôt introuvable'}</EmptyLine>}
      </div>
    );
  }

  // Les gestes, miroir de la version ordinateur (et de ce que la base accepte).
  const cancelled = deposit.status === 'cancelled';
  const isCargo = hasPermission('canManageCargo');
  const owner = deposit.received_by === currentUser?.id && hasPermission('canReceiveParcels');
  const canCollect = hasPermission('canCollectParcelPayments');
  const quotePaidOut = quote?.status === 'paid' || quote?.status === 'invoiced';
  const departed = parcels.filter((p) => parcelLockReason(p) !== null);
  const canEditDeposit = !cancelled && (isCargo || (deposit.status === 'open' && owner));
  const canAddParcel = !cancelled && !(deposit.status === 'closed' && quotePaidOut) && (isCargo || (deposit.status === 'open' && owner));
  const canEditParcels = !cancelled && (isCargo || owner);
  const canCancel = !cancelled && (isCargo || (deposit.status === 'open' && owner));
  const canAssign = !cancelled && ((!deposit.client && hasPermission('canReceiveParcels')) || (!!deposit.client && isCargo));
  const cancelBlock = departed.length > 0 ? 'Colis déjà emballés ou partis' : (quote && (quote.amount_paid_xaf > 0 || quotePaidOut || quote.invoice_no)) ? 'Annulez d’abord les encaissements' : null;
  const removeBlock = (p: Parcel): string | null => {
    if (cancelled) return 'Dépôt supprimé';
    if (!(isCargo || (deposit.status === 'open' && owner))) return 'Réservé à l’équipe cargo';
    const lock = parcelLockReason(p);
    if (lock) return lock;
    if (quotePaidOut || (quote && (quote.amount_paid_xaf > 0 || quote.invoice_no))) return 'Le devis a déjà reçu des encaissements';
    if (deposit.status === 'closed' && parcels.length <= 1) return 'Dernier colis : supprimez le dépôt';
    return null;
  };

  const name = deposit.client ? clientFullName(deposit.client) : 'Client à attribuer';
  const st = labels.status(deposit);
  const photoCount = parcels.reduce((n, p) => n + parcelPhotoPaths(p).length, 0);
  const supplier = depositSupplier(deposit);
  const events = depositTimeline(deposit, quote);
  const mode = deposit.location === 'warehouse' ? 'Bateau' : 'Avion';
  const total = Math.round(Number(quote?.total_xaf ?? 0));
  const balance = quote ? quoteBalance(quote) : 0;
  const acquitted = quote ? invoiceAcquitted(quote) : false;
  const canPay = !!quote && !cancelled && canCollect && !acquitted && total > 0 && balance > 0;

  const openParcel = (p: Parcel) => setParcelMenu(p);
  const receiptPdf = async (lang: CargoDocLang, withQuote: boolean) => {
    if (pdfBusy) return;
    setPdfBusy(true);
    try {
      await downloadReceptionPdf({ deposit, quote: withQuote ? quote ?? null : null }, settings, lang);
      toast.success(withQuote ? `Devis ${quote?.quote_no ?? deposit.deposit_no} téléchargé` : `Bon de réception ${deposit.deposit_no} téléchargé`, { description: CARGO_DOC_LANG_LABEL[lang] });
    } catch (e) { toast.error((e as Error).message); } finally { setPdfBusy(false); }
  };

  // Après l'encaissement : le succès, avec « Encaisser le reste » quand il en reste.
  if (paid) {
    const left = quoteBalance(paid.quote);
    return (
      <div className={cn('min-h-[100dvh]', SURFACE.canvas)}>
        <SuccessView
          title="Encaissé"
          subtitle={[xaf(paid.amount), METHOD_LABEL[paid.method], paid.payment?.receipt_no].filter(Boolean).join(' · ')}
          rows={[{ label: 'Reste à payer', value: xaf(left), tone: left === 0 ? 'success' : undefined }]}
          primary={left > 0 ? { label: 'Encaisser le reste', onClick: () => { setPaid(null); setPaying(true); } } : { label: 'Retour au dépôt', onClick: () => setPaid(null) }}
          secondary={paid.payment ? { label: `Reçu ${paid.payment.receipt_no} (PDF)`, onClick: () => void downloadReceiptPdf(paid.quote, paid.payment!, settings).then(() => toast.success('PDF téléchargé'), (e: Error) => toast.error(e.message)) } : undefined}
        />
      </div>
    );
  }

  const actions: SheetAction[] = [
    { label: 'Modifier le dépôt', icon: Pencil, onClick: () => setEditing(true), hidden: !canEditDeposit },
    { label: deposit.client ? 'Réattribuer' : 'Attribuer à un client', icon: UserSearch, onClick: () => { setQuery(''); setAssignOpen(true); }, hidden: !canAssign },
    { label: 'Étiquettes des colis', hint: labels.parcels(parcels.length), icon: TagIcon, onClick: () => setLabelsFor({}), hidden: !deposit.client || parcels.length === 0 },
    { label: 'Étiquette client', icon: TagIcon, onClick: () => setClientLabel(true), hidden: !deposit.client },
    { label: 'Bon de réception (PDF)', icon: FileText, onClick: () => void receiptPdf(readCargoDocLang(), false), hidden: parcels.length === 0 },
    { label: 'Devis (PDF)', hint: 'FR · EN', icon: FileText, onClick: () => setLangMenu(true), hidden: !quote || total <= 0 },
    { label: `Photos (${photoCount})`, icon: Images, onClick: () => viewer.open(Math.max(0, parcels.findIndex((p) => parcelPhotoPaths(p).length > 0))), hidden: photoCount === 0 },
    { label: 'Fiche client', icon: UserRound, onClick: () => navigate(`/m/clients/${deposit.client!.user_id}`), hidden: !deposit.client },
    { label: 'Supprimer le dépôt', hint: cancelBlock ?? undefined, icon: Trash2, danger: true, disabled: !!cancelBlock, onClick: () => setCancelling(true), hidden: !canCancel },
  ];

  // Le devis, en deux lignes (04/07) ; un toucher ouvre l'écran du devis.
  const devis = () => navigate(`/m/cargo/reception/${deposit.id}/devis`);
  const devisRows: TapRow[] = quote
    ? [
      { label: `Devis · ${deposit.location === 'office' ? formatKg(deposit.total_weight_kg) : formatCbm(deposit.total_cbm)}`, value: xaf(total), onClick: devis },
      ...(quotePaid(quote) > 0 && balance > 0 ? [{ label: 'Reste à payer', value: xaf(balance), onClick: devis }] : []),
      {
        label: quote.sent_at ? `Envoyé le ${DATE_SHORT.format(new Date(quote.sent_at))}` : quote.status === 'draft' ? 'Pas encore envoyé' : quote.quote_no,
        value: total <= 0 ? <Tag tone="neutral">Sans prix</Tag> : balance === 0 ? <Tag tone="success">Payé</Tag> : <Tag tone="pending">À payer</Tag>,
        onClick: devis,
      },
    ]
    : [{ label: 'Devis', value: <Tag tone="neutral">Sans prix</Tag>, onClick: devis }];

  const receptionRows: KV[] = [
    { label: 'Apporté par', value: `${labels.broughtBy(deposit.brought_by)}${deposit.representative_name ? ` · ${deposit.representative_name}` : ''}` },
    { label: 'Reçu par', value: `${deposit.received_by_name ?? '—'} · ${formatDateTime(deposit.closed_at ?? deposit.opened_at)}` },
    { label: 'Fournisseur', value: supplier ? supplierLine(supplier) : '—' },
    ...(deposit.notes ? [{ label: 'Notes', value: deposit.notes }] : []),
  ];

  const pm = parcelMenu;
  const pmBlock = pm ? removeBlock(pm) : null;
  const pmLock = pm ? parcelLockReason(pm) : null;

  let dock: React.ReactNode = null;
  if (cancelled && isCargo) dock = <BigButton onClick={() => setRestoring(true)}>Rétablir le dépôt</BigButton>;
  else if (!deposit.client && canAssign) dock = <BigButton onClick={() => { setQuery(''); setAssignOpen(true); }}>Attribuer à un client</BigButton>;
  else if (canPay) dock = <BigButton onClick={() => setPaying(true)}>Encaisser {xaf(balance)}</BigButton>;
  else if (!quote && !cancelled && hasPermission('canPriceParcels') && parcels.length > 0) dock = <BigButton onClick={() => navigate(`/m/cargo/reception/${deposit.id}/devis`)}>Poser les prix</BigButton>;

  return (
    <div className={cn('flex min-h-[100dvh] flex-col', SURFACE.canvas)}>
      <ScreenTop title={deposit.deposit_no} backTo="/m/cargo/reception" right={<MoreButton onClick={more.show} />} />

      <div className="flex-1 px-5 pb-6 pt-4">
        {cancelled && (
          <p className={cn('mb-4 rounded-lg px-4 py-3 text-[16px]', TONE_PILL.danger)}>
            <span className="font-semibold">Dépôt supprimé</span>
            {deposit.cancelled_at && ` le ${formatDateTime(deposit.cancelled_at)}`}{deposit.cancelled_by_name && ` par ${deposit.cancelled_by_name}`}
            {deposit.cancel_reason && ` · « ${deposit.cancel_reason} »`}
          </p>
        )}

        {/* Le client, en une carte ; sans client, un toucher l'attribue. */}
        <button
          type="button"
          disabled={!deposit.client && !canAssign}
          onClick={() => (deposit.client ? navigate(`/m/clients/${deposit.client.user_id}`) : setAssignOpen(true))}
          className="flex w-full items-center gap-3.5 rounded-lg border border-[#D9D9D9] px-4 py-3.5 text-left active:bg-[#F5F5F5] disabled:cursor-default dark:border-[#444444] dark:active:bg-[#383838]"
        >
          {deposit.client ? <Initials name={name} /> : <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#FFF1C2] text-[18px] font-semibold text-[#682D03]">?</span>}
          <span className="min-w-0 flex-1">
            <span className={cn('block truncate text-[17px] font-semibold', TEXT.strong)}>{name}</span>
            <span className={cn('block truncate text-[15px] tabular-nums', TEXT.muted)}>{[deposit.client?.customer_code, deposit.client?.account_name, mode].filter(Boolean).join(' · ')}</span>
          </span>
          <Tag tone={cancelled ? 'danger' : st.tone === 'info' ? 'pending' : st.tone}>{cancelled ? 'Supprimé' : st.label}</Tag>
        </button>

        <CapsLabel className="mt-6">{labels.parcels(parcels.length)} · {formatKg(deposit.total_weight_kg)} · {formatCbm(deposit.total_cbm)}</CapsLabel>
        {parcels.length === 0 ? (
          <EmptyLine>Aucun colis</EmptyLine>
        ) : (
          <div className="mt-1">
            {parcels.map((p) => {
              const stage = parcelStage(p, deposit.location);
              return (
                <ParcelLine
                  key={p.id}
                  parcel={p}
                  onClick={() => openParcel(p)}
                  subtitle={stage.inBox ? `${p.parcel_no} · ${stage.label}` : undefined}
                />
              );
            })}
          </div>
        )}
        {canAddParcel && (
          <ItemList className="-mx-5">
            <ItemRow leading={<IconCircle icon={Plus} />} title="Ajouter un colis" onClick={() => navigate(`/m/cargo/reception/${deposit.id}/colis`)} />
          </ItemList>
        )}

        <TapBox className="mt-5" rows={devisRows} />

        {quote && total > 0 && !cancelled && <QuotePayments quote={quote} parcels={deposit.parcels} settings={settings} />}

        {releaseIds(deposit.parcels).length > 0 && (
          <section className="mt-6">
            <CapsLabel>Bons de retrait</CapsLabel>
            <div className="mt-2"><DepositReleases parcels={deposit.parcels} /></div>
          </section>
        )}

        <CapsLabel className="mt-6">Réception</CapsLabel>
        <KVBox className="mt-2" rows={receptionRows} />

        <CapsLabel className="mt-6">Historique</CapsLabel>
        <div className="mt-2"><DepositTimeline events={events} /></div>
      </div>

      {dock && <Dock>{dock}</Dock>}

      <ActionSheet open={more.open} onClose={more.hide} title={deposit.deposit_no} actions={actions} />
      <ActionSheet
        open={langMenu}
        onClose={() => setLangMenu(false)}
        title={`Devis ${quote?.quote_no ?? ''}`}
        actions={CARGO_DOC_LANGS.map((l) => ({ label: CARGO_DOC_LANG_LABEL[l], icon: FileText, onClick: () => void receiptPdf(l, true) }))}
      />
      <ActionSheet
        open={pm !== null}
        onClose={() => setParcelMenu(null)}
        title={pm ? `${pm.parcel_no}${pm.description ? ` · ${pm.description}` : ''}` : undefined}
        actions={pm ? [
          { label: 'Voir les photos', icon: Images, onClick: () => viewer.open(parcels.indexOf(pm)), hidden: parcelPhotoPaths(pm).length === 0 },
          { label: pmLock ? 'Photos du colis' : 'Modifier le colis', hint: pmLock ?? `${formatKg(pm.weight_kg)} · ${formatCbm(pm.cbm)}`, icon: Pencil, onClick: () => navigate(`/m/cargo/reception/${deposit.id}/colis/${pm.id}`), hidden: !canEditParcels },
          { label: 'Étiquette du colis', icon: TagIcon, onClick: () => setLabelsFor({ parcelId: pm.id }), hidden: !deposit.client },
          { label: 'Voir le conteneur', hint: pm.container_number ?? undefined, icon: Container, onClick: () => navigate(`/m/cargo/${pm.shipment_id}/colis`), hidden: !pm.shipment_id },
          { label: 'Voir l’expédition avion', hint: pm.awb_number ?? undefined, icon: Plane, onClick: () => navigate(`/m/cargo/avion/${pm.air_shipment_id}`), hidden: !pm.air_shipment_id },
          { label: 'Supprimer le colis', hint: pmBlock ?? undefined, icon: Trash2, danger: true, disabled: !!pmBlock, onClick: () => setRemoving(pm), hidden: !canEditParcels },
        ] : []}
      />

      {quote && <QuotePaySheet open={paying} onClose={() => setPaying(false)} quote={quote} settings={settings} onPaid={setPaid} />}
      <DepositEditSheet deposit={{ ...deposit, quote_status: quote?.status ?? deposit.quote_status }} open={editing} onClose={() => setEditing(false)} />
      {deposit.client && <InternalLabelSheet open={!!labelsFor} onClose={() => setLabelsFor(null)} deposit={deposit} settings={settings} startParcelId={labelsFor?.parcelId} />}
      {deposit.client && <LanguageProvider><ReceptionLabelSheet open={clientLabel} onClose={() => setClientLabel(false)} client={deposit.client} settings={settings} /></LanguageProvider>}
      <ParcelPhotoViewer
        parcels={parcels.map((p) => ({ ...p, note: parcelStage(p, deposit.location).label }))}
        index={viewer.index} close={viewer.close} setIndex={viewer.setIndex} photo={viewer.photo} setPhoto={viewer.setPhoto}
        title={deposit.deposit_no}
      />

      <ReasonSheet
        open={removing !== null}
        onClose={() => setRemoving(null)}
        title={`Supprimer le colis ${removing?.parcel_no ?? ''} ?`}
        subtitle={removing ? `${removing.description ?? labels.kind(removing.kind)} · ${formatKg(removing.weight_kg)}` : undefined}
        confirmLabel="Supprimer le colis"
        required={deposit.status === 'closed'}
        suggestions={['Doublon', 'Saisi par erreur', 'Repris par le fournisseur', 'Fusionné avec un autre colis']}
        loading={removeParcel.isPending}
        onConfirm={(reason) => removing && removeParcel.mutate({ parcelId: removing.id, reason }, { onSuccess: () => { toast.success(`Colis ${removing.parcel_no} supprimé`); setRemoving(null); } })}
      />
      <ReasonSheet
        open={cancelling}
        onClose={() => setCancelling(false)}
        title={`Supprimer le dépôt ${deposit.deposit_no} ?`}
        subtitle={`${labels.parcels(parcels.length)} · se rétablit`}
        confirmLabel="Supprimer le dépôt"
        suggestions={['Saisi en double', 'Saisi par erreur', 'Colis repartis chez le fournisseur']}
        loading={cancelDeposit.isPending}
        onConfirm={(reason) => cancelDeposit.mutate({ depositId: deposit.id, reason }, { onSuccess: () => { toast.success(`Dépôt ${deposit.deposit_no} supprimé`); setCancelling(false); } })}
      />
      <ConfirmSheet
        open={restoring}
        onClose={() => setRestoring(false)}
        title={`Rétablir ${deposit.deposit_no} ?`}
        subtitle={name}
        rows={[{ label: 'Colis', value: labels.parcels(parcels.length) }]}
        confirmLabel="Rétablir"
        loading={restoreDeposit.isPending}
        onConfirm={() => restoreDeposit.mutate(deposit.id, { onSuccess: () => { toast.success(`Dépôt ${deposit.deposit_no} rétabli`); setRestoring(false); } })}
      />

      <BottomSheet open={assignOpen} onClose={() => setAssignOpen(false)} title={deposit.client ? 'Réattribuer' : 'Attribuer à un client'}>
        <SearchBox value={query} onChange={setQuery} placeholder="Nom, téléphone, BZ-…" autoFocus />
        {deposit.client && <p className={cn('mt-2 text-[15px]', TEXT.muted)}>Étiquettes à réimprimer</p>}
        <div className="-mx-5 mt-2">
          <ItemList>
            {(search.data ?? []).filter((c) => c.user_id !== deposit.client?.user_id).map((c) => {
              const n = clientFullName(c);
              return (
                <ItemRow
                  key={c.user_id}
                  leading={<Initials name={n} />}
                  title={n}
                  subtitle={[c.customer_code, c.phone, c.account_name ? `compte ${c.account_name}` : null].filter(Boolean).join(' · ')}
                  onClick={assign.isPending ? undefined : async () => {
                    await assign.mutateAsync({ depositId: deposit.id, clientUserId: c.user_id }).then(() => {
                      toast.success(deposit.client ? 'Dépôt réattribué' : 'Dépôt attribué', { description: n });
                      setAssignOpen(false);
                    }, () => undefined);
                  }}
                />
              );
            })}
          </ItemList>
        </div>
      </BottomSheet>
    </div>
  );
}
