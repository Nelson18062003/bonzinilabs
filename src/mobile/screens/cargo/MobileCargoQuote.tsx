// ============================================================
// Mobile admin — Cargo › Réception › le devis d'un dépôt. Refonte v2
// (maquette 10/42) : le total en grand, le client, le mode et le volume,
// l'état ; une ligne par colis (toucher : au kilo, au m³ ou fixe, et le
// prix), les frais et remises, le total ; la langue du PDF (FR | EN) ;
// « Envoyer / Renvoyer le devis » en noir, « Frais, remise » et « Facture »
// dessous. En haut : télécharger le bon de réception et devis (un fichier,
// toujours) et, sur téléphone, le partager (WhatsApp, WeChat).
// L'encaissement est sur la fiche du dépôt (04/07, 04/09) ; ici, il reste
// le geste principal quand le devis ne se modifie plus.
// Le réceptionnaire n'arrive jamais ici : canPriceParcels pour écrire.
// ============================================================
import { useEffect, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { Download, Minus, Plus, Share2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { useReceptionDeposit } from '@/hooks/useReception';
import { useAddQuoteLine, useCargoQuote, useEnsureQuote, useRemoveQuoteLine, useSendQuote, useSetQuoteLine } from '@/hooks/useCargoQuote';
import { useAdminShippingSettings } from '@/hooks/useShippingSettings';
import { DEFAULT_SHIPPING_SETTINGS } from '@/lib/customerCode';
import { BASIS_UNIT, invoiceAcquitted, lineAmount, lineNeedsMeasure, quoteBalance, quotePaid, xaf, type QuoteBasis, type QuoteLine } from '@/lib/cargoQuote';
import { CARGO_DOC_LANGS, CARGO_DOC_LANG_LABEL, deliverReceptionPdf, downloadReceptionPdf, readCargoDocLang, shareReceptionPdf, storeCargoDocLang, type CargoDocLang } from '@/lib/cargoQuotePdf';
import { canShareFiles, prefersDownload } from '@/components/customer-code/exportShippingLabel';
import { clientFullName, formatCbm, formatKg } from '@/lib/reception';
import { cn } from '@/lib/utils';
import {
  ActionSheet, BigButton, BigFigure, BottomSheet, BoxSegmented, Dock, EmptyLine, IconCircle, ItemList, ItemRow, KVBox, ScreenLoader, ScreenTop, SURFACE, TEXT, TONE_PILL, Tag, TextInput,
} from '@/mobile/designKit';
import { ChipRow, TapBox, TopIcon, UnitField, type TapRow } from '@/mobile/components/cargo/v2';
import { formatDateTime, useReceptionLabels } from '@/mobile/components/reception/bits';
import { QuotePaySheet, useQuoteInvoice } from './QuotePayments';

const num = (s: string) => { const v = parseFloat(s.replace(/\s/g, '').replace(',', '.')); return Number.isFinite(v) ? v : null; };
/** « 17 820 » : le montant sans l'unité (la colonne des lignes, le grand chiffre). */
const formatXafPlain = (n: number | null | undefined) => xaf(n).replace(/\s?XAF$/, '');
const BASES: { value: QuoteBasis; label: string }[] = [{ value: 'per_kg', label: 'Au kilo' }, { value: 'per_cbm', label: 'Au m³' }, { value: 'fixed', label: 'Fixe' }];

/** La quantité d'une ligne de colis selon la base (le poids, ou le volume). */
const qtyFor = (l: QuoteLine, b: QuoteBasis): number | null => (b === 'per_kg' ? l.weight_kg ?? null : b === 'per_cbm' ? l.cbm ?? null : null);
/** « 0,108 m³ » : le volume à trois décimales, comme sur la ligne du colis. */
const cbm3 = (v: number | null | undefined) => (v == null ? '— m³' : `${Number(v).toLocaleString('fr-FR', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} m³`);
const qtyLabel = (l: QuoteLine) => (l.basis === 'per_kg' ? formatKg(l.weight_kg) : l.basis === 'per_cbm' ? cbm3(l.cbm) : 'fixe');

/** Le prix d'une ligne de colis, en feuille : la base, le prix, le montant qui suit. */
function LineSheet({ line, onClose }: { line: QuoteLine | null; onClose: () => void }) {
  const setLine = useSetQuoteLine();
  const [basis, setBasis] = useState<QuoteBasis>('per_cbm');
  const [value, setValue] = useState('');
  useEffect(() => {
    if (!line) return;
    setBasis(line.basis);
    setValue(String(line.basis === 'fixed' ? line.amount_xaf ?? '' : line.unit_price_xaf ?? ''));
  }, [line]);
  if (!line) return <BottomSheet open={false} onClose={onClose}>{null}</BottomSheet>;
  const changeBasis = (b: QuoteBasis) => {
    setBasis(b);
    setValue(String(b === 'fixed' ? line.amount_xaf ?? '' : line.basis === 'fixed' ? '' : line.unit_price_xaf ?? ''));
  };
  const v = num(value);
  const okValue = v != null && v >= 0 && Number.isSafeInteger(Math.round(v));
  const preview = okValue ? lineAmount(basis, qtyFor(line, basis), basis === 'fixed' ? null : v, basis === 'fixed' ? v : null) : null;
  const needs = lineNeedsMeasure({ ...line, basis, quantity: qtyFor(line, basis) });
  const save = () => {
    if (!okValue) return;
    const patch = basis === 'fixed' ? { basis, amount: Math.round(v!), unitPrice: null } : { basis, unitPrice: v!, amount: null };
    setLine.mutate({ lineId: line.id, ...patch }, { onSuccess: onClose });
  };
  return (
    <BottomSheet open onClose={setLine.isPending ? () => undefined : onClose} title={line.description || line.label || line.parcel_no || 'Colis'}>
      <p className={cn('-mt-1 text-[16px] tabular-nums', TEXT.muted)}>{[line.parcel_no, formatKg(line.weight_kg), cbm3(line.cbm)].filter(Boolean).join(' · ')}</p>
      <ChipRow<QuoteBasis> className="-mx-5 mt-4" options={BASES} value={basis} onChange={changeBasis} />
      <UnitField className="mt-4" unit={basis === 'fixed' ? 'XAF' : `XAF / ${BASIS_UNIT[basis]}`} value={value} onChange={(e) => setValue(e.target.value)} placeholder="0" aria-label={basis === 'fixed' ? 'Montant' : 'Prix unitaire'} />
      {needs ? (
        <p className="mt-2 text-[15px] font-medium text-[#975102] dark:text-[#E8B931]">{basis === 'per_kg' ? 'Sans poids' : 'Sans volume'} : à mesurer, ou fixe</p>
      ) : preview != null && (
        <KVBox className="mt-4" rows={[{ label: 'Montant', before: xaf(line.amount_xaf), value: xaf(preview) }]} />
      )}
      <div className="mt-5"><BigButton onClick={save} loading={setLine.isPending} disabled={!okValue}>Enregistrer</BigButton></div>
    </BottomSheet>
  );
}

/** Frais et remises, en feuille : ceux déjà posés (retirer), puis en ajouter un. */
function ExtrasSheet({ open, onClose, quoteId, lines, editable }: { open: boolean; onClose: () => void; quoteId: string; lines: QuoteLine[]; editable: boolean }) {
  const addLine = useAddQuoteLine();
  const removeLine = useRemoveQuoteLine();
  const [mode, setMode] = useState<'fee' | 'discount' | null>(null);
  const [label, setLabel] = useState('');
  const [amount, setAmount] = useState('');
  useEffect(() => { if (open) setMode(null); }, [open]);
  const start = (k: 'fee' | 'discount') => { setMode(k); setLabel(k === 'discount' ? 'Remise' : ''); setAmount(''); };
  const v = num(amount);
  const ok = !!label.trim() && v != null && v > 0 && Number.isSafeInteger(Math.round(v));
  const add = () => { if (!ok || !mode) return; addLine.mutate({ quoteId, kind: mode, label: label.trim(), amount: Math.round(Math.abs(v!)) }, { onSuccess: () => setMode(null) }); };

  return (
    <BottomSheet open={open} onClose={onClose} title={mode === 'fee' ? 'Un frais' : mode === 'discount' ? 'Une remise' : 'Frais, remise'}>
      {mode ? (
        <div className="space-y-3">
          <TextInput value={label} onChange={(e) => setLabel(e.target.value)} placeholder={mode === 'discount' ? 'Remise fidélité' : 'Manutention, emballage…'} aria-label="Libellé" autoFocus className="h-14 text-[17px]" />
          <UnitField unit="XAF" value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="numeric" placeholder="0" aria-label="Montant" />
          <div className="pt-2"><BigButton onClick={add} loading={addLine.isPending} disabled={!ok}>Ajouter</BigButton></div>
        </div>
      ) : (
        <>
          {lines.length === 0 ? <p className={cn('text-[16px]', TEXT.muted)}>Aucun frais ni remise</p> : (
            <div className="-mx-5">
              <ItemList>
                {lines.map((l) => (
                  <ItemRow key={l.id} title={l.label ?? (l.kind === 'discount' ? 'Remise' : 'Frais')} subtitle={l.kind === 'discount' ? 'Remise' : 'Frais'}
                    amount={xaf(l.amount_xaf)}
                    right={editable ? (
                      <button type="button" onClick={() => removeLine.mutate(l.id)} disabled={removeLine.isPending} aria-label={`Retirer ${l.label ?? ''}`} className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-full', SURFACE.holder)}>
                        <Trash2 className="h-5 w-5" />
                      </button>
                    ) : undefined} />
                ))}
              </ItemList>
            </div>
          )}
          {editable && (
            <div className="-mx-5 mt-2">
              <ItemList>
                <ItemRow leading={<IconCircle icon={Plus} />} title="Ajouter un frais" onClick={() => start('fee')} />
                <ItemRow leading={<IconCircle icon={Minus} />} title="Ajouter une remise" onClick={() => start('discount')} />
              </ItemList>
            </div>
          )}
        </>
      )}
    </BottomSheet>
  );
}

export function MobileCargoQuote() {
  const { depositId } = useParams<{ depositId: string }>();
  const { hasPermission } = useAdminAuth();
  const canEdit = hasPermission('canPriceParcels');
  const canCollect = hasPermission('canCollectParcelPayments');
  const labels = useReceptionLabels();
  const { data: deposit } = useReceptionDeposit(depositId);
  const { data: quote, isLoading } = useCargoQuote(depositId);
  const { data: settings } = useAdminShippingSettings();
  const pdfSettings = settings ?? DEFAULT_SHIPPING_SETTINGS;
  const ensure = useEnsureQuote();
  const send = useSendQuote();
  const [lang, setLang] = useState<CargoDocLang>(readCargoDocLang);
  const [lineOpen, setLineOpen] = useState<QuoteLine | null>(null);
  const [extrasOpen, setExtrasOpen] = useState(false);
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [paying, setPaying] = useState(false);
  const [sending, setSending] = useState(false);
  const [pdfBusy, setPdfBusy] = useState<'dl' | 'share' | null>(null);
  const invoice = useQuoteInvoice(quote, deposit?.parcels, pdfSettings, lang);

  if (!hasPermission('canViewCargo')) return <Navigate to="/m" replace />;
  const back = `/m/cargo/reception/${depositId}`;
  if (isLoading || !deposit) {
    return <div className={cn('flex min-h-[100dvh] flex-col', SURFACE.canvas)}><ScreenTop title="Devis" backTo={back} /><ScreenLoader /></div>;
  }

  const name = deposit.client ? clientFullName(deposit.client) : 'Client à attribuer';
  const mode = deposit.location === 'warehouse' ? 'bateau' : 'avion';
  const measure = deposit.location === 'warehouse' ? formatCbm(deposit.total_cbm) : formatKg(deposit.total_weight_kg);
  // Payé, ou facturé : une facture ne se modifie plus, même pas encore réglée.
  const locked = quote?.status === 'paid' || quote?.status === 'invoiced' || !!quote?.invoice_no;
  const editable = canEdit && !locked && deposit.status !== 'cancelled';
  const parcelLines = quote?.lines.filter((l) => l.kind === 'parcel') ?? [];
  const extraLines = quote?.lines.filter((l) => l.kind !== 'parcel') ?? [];
  const missing = deposit.parcels.filter((p) => !parcelLines.some((l) => l.parcel_id === p.id)).length;
  const canShare = canShareFiles() && !prefersDownload();
  const total = Math.round(Number(quote?.total_xaf ?? 0));
  const balance = quote ? quoteBalance(quote) : 0;
  const canPay = !!quote && canCollect && !invoiceAcquitted(quote) && total > 0 && balance > 0 && deposit.status !== 'cancelled';
  const tag = !quote || total <= 0 ? { tone: 'neutral' as const, label: 'Sans prix' }
    : balance === 0 ? { tone: 'success' as const, label: quote.invoice_no ? 'Facturé' : 'Payé' }
    : quotePaid(quote) > 0 ? { tone: 'pending' as const, label: `Reste ${xaf(balance)}` }
    : { tone: 'pending' as const, label: 'À payer' };

  const chooseLang = (l: CargoDocLang) => { setLang(l); storeCargoDocLang(l); };
  const pdf = async (kind: 'dl' | 'share') => {
    if (pdfBusy) return;
    setPdfBusy(kind);
    try {
      const input = { deposit, quote: quote ?? null };
      if (kind === 'dl') { await downloadReceptionPdf(input, pdfSettings, lang); toast.success('PDF téléchargé', { description: `${deposit.deposit_no} · ${CARGO_DOC_LANG_LABEL[lang]}` }); }
      else if ((await shareReceptionPdf(input, pdfSettings, lang)) !== 'shared') toast.success('PDF téléchargé');
    } catch (e) { toast.error((e as Error).message); } finally { setPdfBusy(null); }
  };
  const sendQuote = async () => {
    if (!quote || sending) return;
    setSending(true);
    const fresh = await send.mutateAsync(quote.id).catch(() => null); // un refus est dit par le hook
    try {
      // Le devis envoyé : partagé sur téléphone (WhatsApp), téléchargé sur ordinateur.
      if (fresh && (await deliverReceptionPdf({ deposit, quote: fresh }, pdfSettings, lang)) === 'downloaded') toast.success('PDF téléchargé');
    } catch (e) { toast.error((e as Error).message); } finally { setSending(false); }
  };

  const rows: TapRow[] = [
    ...parcelLines.map((l): TapRow => ({
      label: <>{l.description || l.label || labels.kind(l.kind_of_parcel ?? 'carton')} · {qtyLabel(l)}{lineNeedsMeasure(l) && <span className="ml-1.5 align-middle"><Tag tone="pending">À mesurer</Tag></span>}</>,
      value: formatXafPlain(l.amount_xaf),
      onClick: editable ? () => setLineOpen(l) : undefined,
    })),
    ...extraLines.map((l): TapRow => ({ label: l.label ?? 'Frais', value: formatXafPlain(l.amount_xaf), onClick: editable ? () => setExtrasOpen(true) : undefined })),
    { label: 'Total', value: xaf(total), strong: true },
  ];

  // Le bouton noir : envoyer tant que le devis se modifie ; sinon encaisser ; sinon la facture.
  const primary = !quote
    ? (canEdit && deposit.status !== 'cancelled' ? <BigButton onClick={() => ensure.mutate(deposit.id)} loading={ensure.isPending}>Poser les prix</BigButton> : null)
    : editable
      ? <BigButton onClick={() => void sendQuote()} loading={sending} disabled={quote.lines.length === 0}>{quote.status === 'sent' ? 'Renvoyer le devis' : 'Envoyer le devis'}</BigButton>
      : canPay
        ? <BigButton onClick={() => setPaying(true)}>Encaisser {xaf(balance)}</BigButton>
        : invoice.available ? <BigButton onClick={() => setInvoiceOpen(true)}>Facture</BigButton> : null;
  const secondaries = quote ? [
    editable || extraLines.length > 0 ? <BigButton key="x" variant="soft" onClick={() => setExtrasOpen(true)}>Frais, remise</BigButton> : null,
    (editable || canPay) && invoice.available ? <BigButton key="f" variant="soft" onClick={() => setInvoiceOpen(true)}>Facture</BigButton> : null,
  ].filter(Boolean) : [];

  return (
    <div className={cn('flex min-h-[100dvh] flex-col', SURFACE.canvas)}>
      <ScreenTop
        title={`Devis · ${deposit.deposit_no}`}
        backTo={back}
        right={deposit.parcels.length > 0 ? (
          <span className="flex">
            <TopIcon icon={Download} onClick={() => void pdf('dl')} ariaLabel="Télécharger le bon de réception et devis (PDF)" disabled={pdfBusy !== null} />
            {canShare && <TopIcon icon={Share2} onClick={() => void pdf('share')} ariaLabel="Partager le devis (WhatsApp, WeChat…)" disabled={pdfBusy !== null} />}
          </span>
        ) : undefined}
      />

      <div className="flex-1 px-5 pb-6 pt-6">
        <BigFigure center value={formatXafPlain(total)} unit="XAF" note={<span className={TEXT.muted}>{[name, mode, measure].join(' · ')}</span>} />
        <div className="mt-3 text-center"><Tag tone={tag.tone}>{tag.label}</Tag></div>

        {!quote ? (
          <div className="mt-6"><EmptyLine>Aucun prix posé</EmptyLine></div>
        ) : (
          <>
            {missing > 0 && editable && (
              <button type="button" onClick={() => ensure.mutate(deposit.id)} disabled={ensure.isPending} className={cn('mt-6 w-full rounded-lg px-4 py-3 text-left text-[16px] font-semibold', TONE_PILL.pending)}>
                {missing} colis sans prix · Ajouter au tarif du jour
              </button>
            )}
            <TapBox className="mt-6" rows={rows} />
            <BoxSegmented<CargoDocLang> className="mt-4" ariaLabel="Langue du PDF" value={lang} onChange={chooseLang}
              options={CARGO_DOC_LANGS.map((l) => ({ value: l, label: l.toUpperCase() }))} />
            {quote.sent_at && <p className={cn('mt-3 text-center text-[15px]', TEXT.muted)}>Envoyé le {formatDateTime(quote.sent_at)}</p>}
          </>
        )}
      </div>

      {(primary || secondaries.length > 0) && (
        <>
          {secondaries.length > 0 && <div aria-hidden style={{ height: 66 }} />}
          <Dock>
            {primary}
            {secondaries.length > 0 && <div className={cn('grid gap-2.5', secondaries.length > 1 ? 'grid-cols-2' : 'grid-cols-1')}>{secondaries}</div>}
          </Dock>
        </>
      )}

      <LineSheet line={lineOpen} onClose={() => setLineOpen(null)} />
      {quote && <ExtrasSheet open={extrasOpen} onClose={() => setExtrasOpen(false)} quoteId={quote.id} lines={extraLines} editable={editable} />}
      <ActionSheet open={invoiceOpen} onClose={() => setInvoiceOpen(false)} title={quote?.invoice_no ? `Facture ${quote.invoice_no}` : 'Facture'} actions={invoice.actions} />
      {quote && <QuotePaySheet open={paying} onClose={() => setPaying(false)} quote={quote} settings={pdfSettings} lang={lang} />}
    </div>
  );
}
