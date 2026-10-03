// ============================================================
// Mobile admin — Cargo › Réception › le devis d'un dépôt.
//
// Une ligne par colis : au kilo, au m³ ou un montant fixe, un prix unitaire
// qu'on change du pouce, le montant qui suit ; des frais et remises en plus ;
// le total ; et « Envoyer le devis » qui produit le PDF, le remet (partagé
// sur téléphone, téléchargé sur ordinateur) et marque le devis envoyé. Le
// réceptionnaire n'arrive jamais ici : cet écran vit dans Cargo, derrière
// canPriceParcels.
//
// Le PDF, dans UNE langue (Français | English, retenue sur l'appareil — elle
// vaut aussi pour les reçus et la facture de l'écran) :
//   · « Télécharger le devis » — un fichier, TOUJOURS, jamais de feuille de
//     partage ; ouvert à tout le personnel qui voit le devis ;
//   · « Partager » — un bouton à part, seulement sur téléphone / tablette
//     (WhatsApp, WeChat) : jamais le seul moyen d'avoir le PDF.
// ============================================================
import { useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Banknote, Download, FileCheck2, FileText, Minus, Plus, Send, Share2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { MobileHeader } from '@/mobile/components/layout/MobileHeader';
import { useReceptionDeposit } from '@/hooks/useReception';
import { QUOTE_KEYS, useAddQuoteLine, useCargoQuote, useEnsureQuote, useRemoveQuoteLine, useSendQuote, useSetQuoteLine } from '@/hooks/useCargoQuote';
import { useAdminShippingSettings } from '@/hooks/useShippingSettings';
import { DEFAULT_SHIPPING_SETTINGS } from '@/lib/customerCode';
import { BASIS_UNIT, lineNeedsMeasure, quoteBalance, quotePaid, quoteStatusMeta, xaf, type Quote, type QuoteBasis, type QuoteLine } from '@/lib/cargoQuote';
import { CARGO_DOC_LANGS, CARGO_DOC_LANG_LABEL, deliverQuotePdf, downloadInvoicePdf, downloadQuotePdf, readCargoDocLang, shareInvoicePdf, shareQuotePdf, storeCargoDocLang, type CargoDocLang } from '@/lib/cargoQuotePdf';
import { canShareFiles, prefersDownload, type Outcome } from '@/components/customer-code/exportShippingLabel';
import { clientFullName, formatCbm, formatKg } from '@/lib/reception';
import { cn } from '@/lib/utils';
import { SURFACE, TEXT, TYPE, BottomSheet, Button, Card, FormField, PrimaryPill, ScreenLoader, Segmented, SoftPill, StatusPill, TextInput } from '@/mobile/designKit';
import { LocationMark, formatDateTime, useReceptionLabels } from '@/mobile/components/reception/bits';
import { QuotePayments, type PaymentRequest } from './QuotePayments';

const num = (s: string) => { const v = parseFloat(s.replace(/\s/g, '').replace(',', '.')); return Number.isFinite(v) ? v : null; };

/** FR | EN, compact ; le lecteur d'écran entend « Français », « English ». */
const LANG_OPTIONS = CARGO_DOC_LANGS.map((l) => ({
  value: l,
  label: <><span aria-hidden="true">{l.toUpperCase()}</span><span className="sr-only">{CARGO_DOC_LANG_LABEL[l]}</span></>,
}));

/** Une ligne de colis : la base, le prix, le montant. Le prix s'enregistre quand on quitte le champ. */
function ParcelLine({ line, canEdit, onSave }: { line: QuoteLine; canEdit: boolean; onSave: (patch: { basis?: QuoteBasis; unitPrice?: number | null; amount?: number | null }) => void }) {
  const [value, setValue] = useState(() => line.basis === 'fixed' ? String(line.amount_xaf ?? '') : String(line.unit_price_xaf ?? ''));
  const [basis, setBasis] = useState<QuoteBasis>(line.basis);
  const labels = useReceptionLabels();
  const needs = lineNeedsMeasure({ ...line, basis });
  const commit = () => {
    const v = num(value);
    if (v == null || v < 0) return;
    if (basis === 'fixed') { if (v !== Number(line.amount_xaf)) onSave({ basis, amount: v }); }
    else if (v !== Number(line.unit_price_xaf) || basis !== line.basis) onSave({ basis, unitPrice: v });
  };
  const changeBasis = (b: QuoteBasis) => {
    setBasis(b);
    setValue(b === 'fixed' ? String(line.amount_xaf ?? '') : String(line.unit_price_xaf ?? ''));
    if (b !== line.basis) onSave({ basis: b, unitPrice: b === 'fixed' ? null : Number(line.unit_price_xaf ?? 0), amount: b === 'fixed' ? Number(line.amount_xaf ?? 0) : null });
  };
  const measure = line.weight_kg != null || line.cbm != null ? `${formatKg(line.weight_kg)} · ${formatCbm(line.cbm)}` : 'ni pesé ni mesuré';
  return (
    <div className="space-y-3 py-4">
      <div className="flex items-start justify-between gap-3">
        <span className="min-w-0 flex-1">
          <span className={cn('block break-words', TYPE.bodyStrong, TEXT.strong)}>
            <span className={cn('mr-2 tabular-nums', TEXT.muted)}>{String(line.parcel_seq ?? line.seq).padStart(2, '0')}</span>
            {line.description || line.label || (line.kind_of_parcel ? labels.kind(line.kind_of_parcel) : 'Colis')}
          </span>
          <span className={cn('mt-0.5 block tabular-nums', TYPE.small, TEXT.muted)}>{measure}</span>
        </span>
        <span className={cn('shrink-0 text-right tabular-nums', TYPE.bodyStrong, TEXT.strong)}>{xaf(line.amount_xaf)}</span>
      </div>
      {canEdit && (
        <>
          <Segmented<QuoteBasis> value={basis} onChange={changeBasis} options={[{ value: 'per_kg', label: 'Au kilo' }, { value: 'per_cbm', label: 'Au m³' }, { value: 'fixed', label: 'Fixe' }]} />
          <div className="relative">
            <TextInput value={value} onChange={(e) => setValue(e.target.value)} onBlur={commit} inputMode="decimal" placeholder="0" className="h-12 pr-24 text-[18px] font-semibold tabular-nums" aria-label={basis === 'fixed' ? 'Montant' : 'Prix unitaire'} />
            <span className={cn('pointer-events-none absolute right-4 top-1/2 -translate-y-1/2', TYPE.small, TEXT.muted)}>{basis === 'fixed' ? 'XAF' : `XAF / ${BASIS_UNIT[basis]}`}</span>
          </div>
          {needs && <p className={cn(TYPE.small, 'text-[#975102] dark:text-[#E8B931]')}>Ce colis n'a pas de {basis === 'per_kg' ? 'poids' : 'volume'} : complétez-le à la réception, ou passez en montant fixe.</p>}
        </>
      )}
    </div>
  );
}

export function MobileCargoQuote() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { depositId } = useParams<{ depositId: string }>();
  const { hasPermission } = useAdminAuth();
  const canEdit = hasPermission('canPriceParcels');
  const { data: deposit } = useReceptionDeposit(depositId);
  const { data: quote, isLoading } = useCargoQuote(depositId);
  const { data: settings } = useAdminShippingSettings();
  const ensure = useEnsureQuote();
  const setLine = useSetQuoteLine();
  const addLine = useAddQuoteLine();
  const removeLine = useRemoveQuoteLine();
  const send = useSendQuote();
  const [extra, setExtra] = useState<'fee' | 'discount' | null>(null);
  const [label, setLabel] = useState('');
  const [amount, setAmount] = useState('');
  const [sending, setSending] = useState(false);
  const [request, setRequest] = useState<PaymentRequest>(null);
  // La langue des PDF de l'écran (devis, reçus, facture), retenue sur l'appareil.
  const [lang, setLang] = useState<CargoDocLang>(readCargoDocLang);
  // Le PDF en cours de fabrication (quelques secondes) : un geste à la fois.
  const [pdfBusy, setPdfBusy] = useState<'quote' | 'quote-share' | 'invoice' | 'invoice-share' | null>(null);
  const canCollect = hasPermission('canCollectParcelPayments');

  if (!hasPermission('canViewCargo')) return <Navigate to="/m" replace />;
  if (isLoading || !deposit) return <ScreenLoader className="min-h-[100dvh]" />;

  const name = deposit.client ? clientFullName(deposit.client) : 'Client à attribuer';
  const st = quoteStatusMeta(quote?.status);
  const locked = quote?.status === 'paid' || quote?.status === 'invoiced';
  const editable = canEdit && !locked;
  const parcelLines = quote?.lines.filter((l) => l.kind === 'parcel') ?? [];
  const extraLines = quote?.lines.filter((l) => l.kind !== 'parcel') ?? [];
  const missing = deposit.parcels.filter((p) => !parcelLines.some((l) => l.parcel_id === p.id)).length;
  const pdfSettings = settings ?? DEFAULT_SHIPPING_SETTINGS;
  // « Partager » : seulement là où une feuille de partage a du sens (téléphone, tablette).
  const canShare = canShareFiles() && !prefersDownload();

  const chooseLang = (l: CargoDocLang) => { setLang(l); storeCargoDocLang(l); };

  /**
   * Le devis tel qu'en base. Un prix s'enregistre quand on quitte le champ :
   * taper un prix puis toucher « Télécharger » ou « Envoyer » lance l'écriture
   * juste avant le geste — on l'attend (10 s au plus), sinon le PDF partirait
   * avec l'ancien prix et l'ancien total.
   */
  const savedQuote = async (q: Quote): Promise<Quote> => {
    for (let i = 0; i < 100 && qc.isMutating() > 0; i++) await new Promise((r) => setTimeout(r, 100));
    return qc.getQueryData<Quote | null>(QUOTE_KEYS.quote(q.deposit_id)) ?? q;
  };

  /** Un PDF à la fois, avec sablier ; « PDF téléchargé » sauf si la feuille de partage s'est ouverte. */
  const makePdf = async (key: NonNullable<typeof pdfBusy>, job: () => Promise<Outcome | void>, what: string) => {
    if (pdfBusy) return;
    setPdfBusy(key);
    try {
      if ((await job()) !== 'shared') toast.success('PDF téléchargé', { description: `${what} · ${CARGO_DOC_LANG_LABEL[lang]}` });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setPdfBusy(null);
    }
  };

  const sendQuote = async () => {
    if (!quote) return;
    setSending(true);
    try {
      await savedQuote(quote); // le dernier prix tapé d'abord en base
      const fresh = await send.mutateAsync(quote.id);
      // Le devis envoyé : partagé sur téléphone (WhatsApp), téléchargé sur ordinateur.
      const outcome = await deliverQuotePdf(fresh, pdfSettings, lang);
      if (outcome === 'downloaded') toast.success('PDF téléchargé');
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className={cn('flex h-[100dvh] flex-col', SURFACE.canvas)}>
      <MobileHeader title={quote ? quote.quote_no : 'Devis'} subtitle={`${deposit.deposit_no} · ${name}`} showBack backTo={`/m/cargo/reception/${deposit.id}`} />

      <div className="flex-1 space-y-5 overflow-y-auto px-4 pb-6 pt-4">
        <Card className="flex items-center gap-3">
          <LocationMark location={deposit.location} size={36} />
          <span className="min-w-0 flex-1">
            <span className={cn('block', TYPE.bodyStrong, TEXT.strong)}>{deposit.location === 'office' ? 'Air cargo' : 'Sea cargo'}</span>
            <span className={cn('block tabular-nums', TYPE.small, TEXT.muted)}>{deposit.parcels.length} colis · {formatKg(deposit.total_weight_kg)} · {formatCbm(deposit.total_cbm)} · {deposit.location === 'office' ? 'au kilo' : 'au m³'}</span>
          </span>
          <StatusPill tone={st.tone} label={st.label} />
        </Card>

        {/* Le PDF du devis : la langue, puis « Télécharger » (un fichier, toujours) et, sur téléphone, « Partager ». */}
        {quote && quote.lines.length > 0 && (
          <Card className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <span className="min-w-0">
                <span className={cn('block', TYPE.bodyStrong, TEXT.strong)}>Le devis en PDF</span>
                <span className={cn('block', TYPE.small, TEXT.muted)}>{lang === 'en' ? 'En anglais' : 'En français'} : devis, reçus, facture.</span>
              </span>
              <div role="group" aria-label="Langue du PDF" className="shrink-0">
                <Segmented<CargoDocLang> value={lang} onChange={chooseLang} options={LANG_OPTIONS} className="w-[104px] [&>button]:h-9 [&>button]:text-[14px]" />
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="neutral" onClick={() => void makePdf('quote', async () => downloadQuotePdf(await savedQuote(quote), pdfSettings, lang), `Devis ${quote.quote_no}`)} loading={pdfBusy === 'quote'} disabled={pdfBusy != null} className="min-h-12 flex-1">
                <Download /> Télécharger le devis
              </Button>
              {canShare && (
                <Button variant="neutral" onClick={() => void makePdf('quote-share', async () => shareQuotePdf(await savedQuote(quote), pdfSettings, lang), `Devis ${quote.quote_no}`)} loading={pdfBusy === 'quote-share'} disabled={pdfBusy != null} ariaLabel="Partager le devis (WhatsApp, WeChat…)" className="min-h-12 w-12 shrink-0 px-0">
                  <Share2 />
                </Button>
              )}
            </div>
          </Card>
        )}

        {!quote ? (
          <Card className="space-y-4 text-center">
            <p className={cn(TYPE.body, TEXT.muted)}>Aucun prix n'a encore été posé sur ce dépôt. Une ligne par colis sera pré-remplie au tarif du jour.</p>
            {canEdit && <PrimaryPill onClick={() => ensure.mutate(deposit.id)} loading={ensure.isPending} className="h-14 w-full text-[17px]"><FileText /> Poser les prix</PrimaryPill>}
          </Card>
        ) : (
          <>
            {missing > 0 && editable && (
              <button type="button" onClick={() => ensure.mutate(deposit.id)} className={cn('w-full rounded-lg px-4 py-3 text-left', 'bg-[#FFF1C2] text-[#682D03] dark:bg-[#522504] dark:text-[#FFF1C2]', TYPE.bodyStrong)}>
                {missing} colis ajouté{missing > 1 ? 's' : ''} depuis le devis : touchez pour les ajouter au tarif du jour.
              </button>
            )}
            <section>
              <h2 className={cn('mb-2', TYPE.lead, TEXT.strong)}>Les colis</h2>
              <Card className="py-0 [&>*]:border-b [&>*]:border-[#D9D9D9] [&>*:last-child]:border-b-0 dark:[&>*]:border-[#444444]">
                {parcelLines.map((l) => (
                  <ParcelLine key={`${l.id}-${l.basis}-${l.unit_price_xaf}-${l.amount_xaf}`} line={l} canEdit={editable} onSave={(patch) => setLine.mutate({ lineId: l.id, ...patch })} />
                ))}
              </Card>
            </section>

            <section>
              <div className="mb-2 flex items-center justify-between">
                <h2 className={cn(TYPE.lead, TEXT.strong)}>Frais et remises</h2>
                {editable && (
                  <span className="flex gap-2">
                    <SoftPill onClick={() => { setExtra('fee'); setLabel(''); setAmount(''); }} className="h-9 px-3 text-[14px]"><Plus /> Frais</SoftPill>
                    <SoftPill onClick={() => { setExtra('discount'); setLabel('Remise'); setAmount(''); }} className="h-9 px-3 text-[14px]"><Minus /> Remise</SoftPill>
                  </span>
                )}
              </div>
              {extraLines.length === 0 ? (
                <p className={cn(TYPE.small, TEXT.muted)}>Aucun frais ni remise.</p>
              ) : (
                <Card className="py-0 [&>*]:border-b [&>*]:border-[#D9D9D9] [&>*:last-child]:border-b-0 dark:[&>*]:border-[#444444]">
                  {extraLines.map((l) => (
                    <div key={l.id} className="flex items-center gap-3 py-3">
                      <span className={cn('min-w-0 flex-1 break-words', TYPE.body, TEXT.strong)}>{l.label}</span>
                      <span className={cn('shrink-0 tabular-nums', TYPE.bodyStrong, l.amount_xaf < 0 ? 'text-[#02542D] dark:text-[#CFF7D3]' : TEXT.strong)}>{xaf(l.amount_xaf)}</span>
                      {editable && <button type="button" onClick={() => removeLine.mutate(l.id)} aria-label="Retirer" className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-full', SURFACE.holder)}><Trash2 className="h-4 w-4" /></button>}
                    </div>
                  ))}
                </Card>
              )}
            </section>

            {quote.sent_at && <p className={cn(TYPE.small, TEXT.muted)}>Envoyé le {formatDateTime(quote.sent_at)}.</p>}

            {/* Phase 2 : encaisser, le reste à payer, la facture acquittée. */}
            {quote.total_xaf > 0 && <QuotePayments quote={quote} settings={pdfSettings} request={request} lang={lang} />}
          </>
        )}
      </div>

      {quote && (
        <div className={cn('shrink-0 space-y-3 border-t px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4', SURFACE.canvas, SURFACE.divider)}>
          <div className="flex items-baseline justify-between">
            <span className={cn(TYPE.body, TEXT.muted)}>{quotePaid(quote) > 0 && quoteBalance(quote) > 0 ? 'Reste à payer' : 'Total du devis'}</span>
            <span className={cn('text-[24px] font-semibold tabular-nums', TEXT.strong)}>{xaf(quotePaid(quote) > 0 && quoteBalance(quote) > 0 ? quoteBalance(quote) : quote.total_xaf)}</span>
          </div>
          {(() => {
            // L'action suivante, une seule en grand : envoyer, encaisser, facturer, ou relire.
            const balance = quoteBalance(quote); const invoiced = !!quote.invoice_no; const total = quote.total_xaf > 0;
            if (invoiced) return (
              <div className="flex gap-2">
                <Button variant="neutral" onClick={() => void makePdf('invoice', () => downloadInvoicePdf(quote, pdfSettings, lang), `Facture ${quote.invoice_no}`)} loading={pdfBusy === 'invoice'} disabled={pdfBusy != null} className="min-h-12 flex-1">
                  <Download /> Télécharger la facture
                </Button>
                {canShare && (
                  <Button variant="neutral" onClick={() => void makePdf('invoice-share', () => shareInvoicePdf(quote, pdfSettings, lang), `Facture ${quote.invoice_no}`)} loading={pdfBusy === 'invoice-share'} disabled={pdfBusy != null} ariaLabel="Partager la facture acquittée" className="min-h-12 w-12 shrink-0 px-0">
                    <Share2 />
                  </Button>
                )}
              </div>
            );
            if (canCollect && total && balance === 0) return <PrimaryPill onClick={() => setRequest({ kind: 'invoice', n: Date.now() })} className="h-14 w-full text-[17px]"><FileCheck2 /> Établir la facture acquittée</PrimaryPill>;
            if (canCollect && total && quote.status === 'sent') return (
              <div className="flex gap-2">
                <SoftPill onClick={() => void sendQuote()} disabled={sending} className="h-14 px-4 text-[15px]"><Send /> Renvoyer</SoftPill>
                <PrimaryPill onClick={() => setRequest({ kind: 'pay', n: Date.now() })} className="h-14 flex-1 text-[17px]"><Banknote /> Encaisser</PrimaryPill>
              </div>
            );
            if (canEdit && !locked) return (
              <PrimaryPill onClick={() => void sendQuote()} loading={sending} disabled={quote.lines.length === 0} className="h-14 w-full text-[17px]">
                <Send /> {quote.status === 'sent' ? 'Renvoyer le devis (PDF)' : 'Envoyer le devis (PDF)'}
              </PrimaryPill>
            );
            return null;
          })()}
        </div>
      )}

      <BottomSheet open={extra !== null} onClose={() => setExtra(null)} title={extra === 'discount' ? 'Une remise' : 'Un frais'}>
        <div className="space-y-4">
          <FormField label="Libellé" htmlFor="x-label"><TextInput id="x-label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder={extra === 'discount' ? 'Remise fidélité' : 'Emballage, frais locaux…'} autoFocus className="h-12" /></FormField>
          <FormField label="Montant" htmlFor="x-amount"><div className="relative"><TextInput id="x-amount" value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="0" className="h-12 pr-16 text-[18px] font-semibold tabular-nums" /><span className={cn('pointer-events-none absolute right-4 top-1/2 -translate-y-1/2', TYPE.small, TEXT.muted)}>XAF</span></div></FormField>
          <PrimaryPill
            onClick={() => { const v = num(amount); if (!quote || v == null || !label.trim()) return; addLine.mutate({ quoteId: quote.id, kind: extra!, label: label.trim(), amount: Math.abs(v) }); setExtra(null); }}
            disabled={!label.trim() || num(amount) == null}
            loading={addLine.isPending}
            className="h-14 w-full text-[17px]"
          >
            Ajouter
          </PrimaryPill>
          <button type="button" onClick={() => navigate(`/m/cargo/reception/${deposit.id}`)} className="hidden" aria-hidden="true" />
        </div>
      </BottomSheet>
    </div>
  );
}
