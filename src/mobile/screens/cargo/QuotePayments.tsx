// ============================================================
// Mobile admin — Cargo › l'argent d'un dépôt : encaisser, les reçus, la
// facture. Refonte v2 (maquettes 04/07 et 04/09) :
//   · `QuotePaySheet` — la feuille « Encaisser 148 000 XAF ? » : le montant
//     (le reste, par défaut), le mode en tuiles (dont le solde du client,
//     avec avant / débité / après), le lieu, la référence, la preuve, la
//     date et la note. Le reçu PDF part aussitôt (partagé sur téléphone,
//     téléchargé sur ordinateur) ;
//   · `QuotePayments` — sous le devis, en faisant défiler la fiche : un
//     encaissement par ligne (toucher : reçu, partage, preuve, annuler avec
//     motif), puis la facture (l'établir, la télécharger, la partager) ;
//   · `useQuoteInvoice` — la facture, pour l'écran du devis (10/42).
// Encaisser et annuler : canCollectParcelPayments ; les autres voient.
// ============================================================
import { useEffect, useRef, useState } from 'react';
import { Banknote, Building2, Camera, CalendarClock, Download, Eye, FileCheck2, MoreHorizontal, Share2, Smartphone, Undo2, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { useAddQuotePayment, useCancelQuotePayment, useInvoiceQuote, usePayQuoteFromWallet, uploadPaymentProof, usePaymentProofUrl } from '@/hooks/useCargoQuote';
import { useAdminWalletByUserId } from '@/hooks/useAdminDeposits';
import { METHOD_LABEL, PLACE_SHORT, invoiceAcquitted, invoiceReadiness, quoteBalance, xaf, type PaymentMethod, type PaymentPlace, type Quote, type QuotePayment } from '@/lib/cargoQuote';
import { clientFullName, type Parcel } from '@/lib/reception';
import { CARGO_DOC_LANG_LABEL, deliverInvoicePdf, deliverReceiptPdf, downloadInvoicePdf, downloadReceiptPdf, readCargoDocLang, shareInvoicePdf, shareReceiptPdf, type CargoDocLang } from '@/lib/cargoQuotePdf';
import { canShareFiles, prefersDownload, type Outcome } from '@/components/customer-code/exportShippingLabel';
import type { ShippingSettings } from '@/lib/customerCode';
import { isValidXafAmount, MIN_PAYMENT_XAF } from '@/lib/amountLimits';
import { cn } from '@/lib/utils';
import {
  ActionSheet, BigButton, BottomSheet, ConfirmSheet, IconCircle, ItemList, ItemRow, KVBox, TEXT, TextArea, TextInput, type KV,
} from '@/mobile/designKit';
import { CapsLabel, ChipRow, UnitField } from '@/mobile/components/cargo/v2';
import { formatDateTime } from '@/mobile/components/reception/bits';

const num = (s: string) => { const v = parseFloat(s.replace(/\s/g, '').replace(',', '.')); return Number.isFinite(v) ? v : null; };
const METHODS: PaymentMethod[] = ['cash', 'mobile_money', 'bank_transfer', 'wallet', 'other'];
const METHOD_ICON: Record<PaymentMethod, React.ElementType> = { cash: Banknote, mobile_money: Smartphone, bank_transfer: Building2, wallet: Wallet, other: MoreHorizontal };
const TILE_LABEL: Record<PaymentMethod, string> = { cash: 'Espèces', mobile_money: 'Mobile', bank_transfer: 'Virement', wallet: 'Solde', other: 'Autre' };
const PLACES: PaymentPlace[] = ['guangzhou', 'douala', 'other'];

/** « Partager » : seulement là où une feuille de partage a du sens (téléphone, tablette). */
const shareable = () => canShareFiles() && !prefersDownload();

/** Un PDF à la fois, avec son sablier ; « PDF téléchargé » sauf si la feuille de partage s'est ouverte. */
function usePdfJob(lang: CargoDocLang) {
  const [busy, setBusy] = useState<string | null>(null);
  const run = async (key: string, job: () => Promise<Outcome | void>, what: string) => {
    if (busy) return;
    setBusy(key);
    try {
      if ((await job()) !== 'shared') toast.success('PDF téléchargé', { description: `${what} · ${CARGO_DOC_LANG_LABEL[lang]}` });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  };
  return { busy, run };
}

/* ── La feuille « Encaisser » (04/09) ───────────────────────────────────── */

export interface PaidResult { quote: Quote; payment: QuotePayment | null; amount: number; method: PaymentMethod }

export function QuotePaySheet({ open, onClose, quote, settings, lang, onPaid }: {
  open: boolean; onClose: () => void; quote: Quote; settings: ShippingSettings; lang?: CargoDocLang; onPaid?: (r: PaidResult) => void;
}) {
  const add = useAddQuotePayment();
  const payWallet = usePayQuoteFromWallet();
  const { data: wallet, isLoading: walletLoading } = useAdminWalletByUserId(open ? quote.client?.user_id ?? undefined : undefined);
  const fileRef = useRef<HTMLInputElement>(null);
  const balance = quoteBalance(quote);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [place, setPlace] = useState<PaymentPlace>('guangzhou');
  const [reference, setReference] = useState('');
  const [proof, setProof] = useState<File | null>(null);
  const [details, setDetails] = useState(false);
  const [paidAt, setPaidAt] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  // Chaque ouverture repart du reste à payer, en espèces.
  useEffect(() => {
    if (!open) return;
    setAmount(String(balance)); setMethod('cash'); setPlace('guangzhou'); setReference(''); setProof(null);
    setDetails(false); setPaidAt(''); setNote('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const raw = num(amount);
  const v = raw == null ? 0 : Math.round(raw);
  const walletXaf = Math.round(Number(wallet?.balance_xaf ?? 0));
  const noClient = method === 'wallet' && !quote.client?.user_id;
  const short = method === 'wallet' && !walletLoading && v > walletXaf;
  const over = raw != null && v > balance;
  const ok = isValidXafAmount(v, MIN_PAYMENT_XAF) && Number.isSafeInteger(v) && !over && !noClient && !short;

  const submit = async () => {
    if (!ok || saving) return;
    setSaving(true);
    // La preuve d'abord : si elle ne part pas, rien n'est encaissé.
    let proofPath: string | null = null;
    if (method !== 'wallet' && proof) {
      try { proofPath = await uploadPaymentProof(quote.id, proof); } catch (e) { toast.error((e as Error).message); setSaving(false); return; }
    }
    // Depuis le solde du client : la base débite le portefeuille et fait le reçu ; sinon, l'encaissement classique.
    const res = await (method === 'wallet'
      ? payWallet.mutateAsync({ quoteId: quote.id, amount: v, note: note.trim() || undefined })
      : add.mutateAsync({ quoteId: quote.id, amount: v, method, place, paidAt: paidAt ? new Date(paidAt).toISOString() : null, reference: reference.trim() || undefined, proofPath, note: note.trim() || undefined })
    ).catch(() => null); // le refus du serveur est dit par le hook : la feuille reste ouverte
    setSaving(false);
    if (!res) return;
    const { quote: fresh, payment } = res;
    onClose();
    onPaid?.({ quote: fresh, payment, amount: v, method });
    if (payment) {
      // Le reçu à remettre : partagé sur téléphone, téléchargé sur ordinateur. L'argent est déjà encaissé.
      try {
        if ((await deliverReceiptPdf(fresh, payment, settings, lang ?? readCargoDocLang())) === 'downloaded') toast.success(`Reçu ${payment.receipt_no} téléchargé`);
      } catch (e) { toast.error(`Encaissé, mais le reçu n'a pas pu être préparé : ${(e as Error).message}`); }
    }
  };

  const rows: KV[] = method === 'wallet'
    ? [
      { label: 'Solde avant', value: walletLoading ? '…' : xaf(walletXaf) },
      { label: 'Débité', value: xaf(v) },
      { label: 'Solde après', value: walletLoading ? '…' : xaf(walletXaf - v), tone: short ? 'danger' : undefined },
    ]
    : [{ label: 'Reste à payer', before: xaf(balance), value: xaf(Math.max(0, balance - v)), tone: v === balance ? 'success' : undefined }];

  return (
    <BottomSheet open={open} onClose={saving ? () => undefined : onClose}>
      <h3 className={cn('text-[22px] font-semibold leading-tight tabular-nums', TEXT.strong)}>Encaisser {xaf(ok ? v : balance)} ?</h3>
      <p className={cn('mt-1 text-[16px]', TEXT.muted)}>{[`Devis ${quote.deposit_no}`, quote.client ? clientFullName(quote.client) : null].filter(Boolean).join(' · ')}</p>

      <div className="mt-4 grid grid-cols-3 gap-2.5" role="radiogroup" aria-label="Mode de paiement">
        {METHODS.map((m) => {
          const on = m === method;
          return (
            <button key={m} type="button" role="radio" aria-checked={on} aria-label={METHOD_LABEL[m]} onClick={() => setMethod(m)}
              className={cn('flex flex-col items-center gap-2 rounded-lg border px-2 py-3', on ? 'border-2 border-[#2C2C2C] dark:border-[#E3E3E3]' : 'border-[#D9D9D9] dark:border-[#444444]')}>
              <IconCircle icon={METHOD_ICON[m]} />
              <span className={cn('text-[15px] font-semibold', TEXT.strong)}>{TILE_LABEL[m]}</span>
            </button>
          );
        })}
      </div>

      {noClient ? <p className="mt-4 text-[15px] font-medium text-[#975102] dark:text-[#E8B931]">Dépôt sans client</p> : <KVBox className="mt-4" rows={rows} />}

      <CapsLabel as="label" className="mt-5 block">Montant reçu</CapsLabel>
      <UnitField className="mt-2" unit="XAF" value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="numeric" placeholder="0" invalid={over} aria-label="Montant reçu" />
      {over && <p className="mt-1.5 text-[15px] font-medium text-[#C00F0C] dark:text-[#FCB3AD]">Plus que le reste · {xaf(balance)}</p>}

      {method !== 'wallet' && (
        <>
          <CapsLabel className="mt-5">Où</CapsLabel>
          <ChipRow<PaymentPlace> className="-mx-5 mt-2" options={PLACES.map((p) => ({ value: p, label: PLACE_SHORT[p] }))} value={place} onChange={setPlace} />
          {method !== 'cash' && (
            <TextInput value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Référence (facultatif)" aria-label="Référence de la transaction" className="mt-4 h-12" />
          )}
        </>
      )}

      <div className="-mx-5 mt-2">
        <ItemList>
          {method !== 'wallet' && (
            <>
              <input ref={fileRef} type="file" accept="image/*,application/pdf" capture="environment" className="hidden" onChange={(e) => setProof(e.target.files?.[0] ?? null)} />
              <ItemRow leading={<IconCircle icon={Camera} />} title={proof ? 'Preuve jointe' : 'Photo de la preuve'} subtitle={proof ? proof.name : 'Facultatif'} onClick={() => fileRef.current?.click()} chevron />
            </>
          )}
          {!details && <ItemRow leading={<IconCircle icon={CalendarClock} />} title={method === 'wallet' ? 'Note' : 'Date et note'} subtitle="Facultatif" onClick={() => setDetails(true)} chevron />}
        </ItemList>
      </div>
      {details && (
        <div className="mt-3 space-y-3">
          {method !== 'wallet' && (
            <div>
              <CapsLabel as="label">Date du paiement</CapsLabel>
              <TextInput type="datetime-local" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} aria-label="Date du paiement" className="mt-2 h-12" />
            </div>
          )}
          <TextArea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note" aria-label="Note" className="min-h-[64px]" />
        </div>
      )}

      <div className="mt-5">
        <BigButton onClick={() => void submit()} loading={saving} disabled={!ok}>Encaisser</BigButton>
      </div>
    </BottomSheet>
  );
}

/* ── Un motif, avant un geste qui défait ─────────────────────────────────── */

export function ReasonSheet({ open, onClose, title, subtitle, confirmLabel, suggestions = [], required = true, loading, onConfirm }: {
  open: boolean; onClose: () => void; title: React.ReactNode; subtitle?: React.ReactNode; confirmLabel: React.ReactNode;
  suggestions?: string[]; required?: boolean; loading?: boolean; onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState('');
  useEffect(() => { if (open) setReason(''); }, [open]);
  return (
    <ConfirmSheet
      open={open}
      onClose={onClose}
      danger
      title={title}
      subtitle={subtitle}
      confirmLabel={confirmLabel}
      loading={loading}
      disabled={required && !reason.trim()}
      onConfirm={() => onConfirm(reason.trim())}
    >
      {suggestions.length > 0 && (
        <div className="-mx-5 mb-3">
          <ChipRow<string> options={suggestions.map((s) => ({ value: s, label: s }))} value={reason} onChange={setReason} />
        </div>
      )}
      <TextArea value={reason} onChange={(e) => setReason(e.target.value)} placeholder={required ? 'Motif' : 'Motif (facultatif)'} aria-label="Motif" className="min-h-[72px]" />
    </ConfirmSheet>
  );
}

/* ── La facture : l'établir, puis la télécharger ou la partager ─────────── */

export function useQuoteInvoice(quote: Quote | null | undefined, parcels: Parcel[] | null | undefined, settings: ShippingSettings, lang: CargoDocLang) {
  const { hasPermission } = useAdminAuth();
  const invoice = useInvoiceQuote();
  const pdf = usePdfJob(lang);
  const [issuing, setIssuing] = useState(false);
  const canCollect = hasPermission('canCollectParcelPayments');
  const readiness = quote ? invoiceReadiness(quote, parcels) : { ready: false, acquitted: false, reason: null };
  const issue = async () => {
    if (!quote || issuing) return;
    setIssuing(true);
    try {
      const fresh = await invoice.mutateAsync(quote.id);
      if ((await deliverInvoicePdf(fresh, settings, lang)) === 'downloaded') toast.success(`Facture ${fresh.invoice_no} téléchargée`);
    } catch { /* le hook l'a dit */ } finally { setIssuing(false); }
  };
  const actions = quote ? [
    { label: readiness.acquitted ? 'Établir la facture acquittée' : 'Établir la facture', hint: readiness.acquitted ? undefined : 'Colis arrivés', icon: FileCheck2, onClick: () => void issue(), hidden: !(canCollect && readiness.ready) },
    { label: 'Télécharger la facture', hint: quote.invoice_no ?? undefined, icon: Download, onClick: () => void pdf.run('invoice', () => downloadInvoicePdf(quote, settings, lang), `Facture ${quote.invoice_no}`), hidden: !quote.invoice_no },
    { label: 'Partager la facture', icon: Share2, onClick: () => void pdf.run('invoice-share', () => shareInvoicePdf(quote, settings, lang), `Facture ${quote.invoice_no}`), hidden: !quote.invoice_no || !shareable() },
  ] : [];
  return { readiness, issue, issuing, actions, available: actions.some((a) => !a.hidden), reason: canCollect && !quote?.invoice_no ? readiness.reason : null };
}

/* ── Les encaissements, sous le devis ─────────────────────────────────────── */

function ProofLink({ path, children }: { path: string; children: (url: string | undefined) => React.ReactNode }) {
  const { data: url } = usePaymentProofUrl(path);
  return <>{children(url ?? undefined)}</>;
}

/** Ouvrir la preuve signée dans un nouvel onglet (le seau est privé). */
function ProofOpener({ path, onDone }: { path: string; onDone: () => void }) {
  const { data: url, error } = usePaymentProofUrl(path);
  useEffect(() => {
    if (url) { window.open(url, '_blank', 'noopener'); onDone(); }
    if (error) { toast.error((error as Error).message); onDone(); }
  }, [url, error, onDone]);
  return null;
}

export function QuotePayments({ quote, parcels, settings, lang }: { quote: Quote; parcels?: Parcel[] | null; settings: ShippingSettings; lang?: CargoDocLang }) {
  const { hasPermission } = useAdminAuth();
  const canCollect = hasPermission('canCollectParcelPayments');
  const cancel = useCancelQuotePayment();
  const docLang = lang ?? readCargoDocLang();
  const pdf = usePdfJob(docLang);
  const invoice = useQuoteInvoice(quote, parcels, settings, docLang);
  const acquitted = invoiceAcquitted(quote);
  const payments = quote.payments ?? [];
  const [menu, setMenu] = useState<QuotePayment | null>(null);
  const [cancelling, setCancelling] = useState<QuotePayment | null>(null);
  const [proof, setProof] = useState<string | null>(null);
  const [invoiceMenu, setInvoiceMenu] = useState(false);

  if (payments.length === 0 && !invoice.available && !quote.invoice_no) return null;
  return (
    <section className="mt-6">
      <CapsLabel>Encaissements</CapsLabel>
      <div className="-mx-5 mt-1">
        <ItemList>
          {payments.map((p) => {
            const off = !!p.cancelled_at;
            return (
              <ItemRow
                key={p.id}
                leading={p.proof_path
                  ? <ProofLink path={p.proof_path}>{(url) => url && !p.proof_path!.endsWith('.pdf')
                    ? <img src={url} alt="" className="h-11 w-11 shrink-0 rounded-full object-cover" />
                    : <IconCircle icon={METHOD_ICON[p.method]} />}</ProofLink>
                  : <IconCircle icon={METHOD_ICON[p.method]} />}
                title={<span className={cn(off && 'line-through opacity-60')}>{p.receipt_no}</span>}
                subtitle={off ? `Annulé : ${p.cancel_reason ?? ''}` : [formatDateTime(p.paid_at), METHOD_LABEL[p.method], PLACE_SHORT[p.place], p.reference].filter(Boolean).join(' · ')}
                amount={<span className={cn(off && 'line-through opacity-60')}>{xaf(p.amount_xaf)}</span>}
                tag={off ? { tone: 'danger', label: 'Annulé' } : undefined}
                onClick={off ? undefined : () => setMenu(p)}
              />
            );
          })}
          {quote.invoice_no ? (
            <ItemRow leading={<IconCircle icon={FileCheck2} />} title={`Facture ${quote.invoice_no}`} subtitle={quote.invoiced_at ? formatDateTime(quote.invoiced_at) : undefined}
              tag={acquitted ? { tone: 'success', label: 'Acquittée' } : { tone: 'pending', label: 'À payer' }} onClick={() => setInvoiceMenu(true)} chevron />
          ) : invoice.available ? (
            <ItemRow leading={<IconCircle icon={FileCheck2} />} title={invoice.readiness.acquitted ? 'Établir la facture acquittée' : 'Établir la facture'} subtitle={invoice.readiness.acquitted ? 'Tout est payé' : 'Colis arrivés'} onClick={() => setInvoiceMenu(true)} chevron />
          ) : invoice.reason && payments.length > 0 ? (
            <ItemRow leading={<IconCircle icon={FileCheck2} />} title="Facture" subtitle={invoice.reason} />
          ) : null}
        </ItemList>
      </div>

      <ActionSheet
        open={menu !== null}
        onClose={() => setMenu(null)}
        title={menu ? `${menu.receipt_no} · ${xaf(menu.amount_xaf)}` : undefined}
        actions={menu ? [
          { label: 'Télécharger le reçu', icon: Download, onClick: () => void pdf.run(`${menu.id}:dl`, () => downloadReceiptPdf(quote, menu, settings, docLang), `Reçu ${menu.receipt_no}`) },
          { label: 'Partager le reçu', icon: Share2, onClick: () => void pdf.run(`${menu.id}:share`, () => shareReceiptPdf(quote, menu, settings, docLang), `Reçu ${menu.receipt_no}`), hidden: !shareable() },
          { label: 'Voir la preuve', icon: Eye, onClick: () => setProof(menu.proof_path), hidden: !menu.proof_path },
          { label: 'Annuler l\'encaissement', icon: Undo2, danger: true, onClick: () => setCancelling(menu), hidden: !(canCollect && !acquitted) },
        ] : []}
      />
      <ActionSheet open={invoiceMenu} onClose={() => setInvoiceMenu(false)} title={quote.invoice_no ? `Facture ${quote.invoice_no}` : 'Facture'} actions={invoice.actions} />
      {proof && <ProofOpener path={proof} onDone={() => setProof(null)} />}

      <ReasonSheet
        open={cancelling !== null}
        onClose={() => setCancelling(null)}
        title="Annuler cet encaissement ?"
        subtitle={cancelling ? `${cancelling.receipt_no} · ${xaf(cancelling.amount_xaf)}${cancelling.method === 'wallet' ? ' · rendu au solde' : ''}` : undefined}
        confirmLabel="Annuler l'encaissement"
        suggestions={['Double saisie', 'Mauvais montant', 'Mauvais mode']}
        loading={cancel.isPending}
        onConfirm={(reason) => cancelling && cancel.mutate({ paymentId: cancelling.id, reason }, { onSuccess: () => setCancelling(null) })}
      />
    </section>
  );
}
