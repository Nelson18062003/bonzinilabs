// ============================================================
// Mobile admin — Cargo › le devis › ses encaissements.
//
// Ce qu'on lit d'abord : le reste à payer, en grand. Puis chaque
// encaissement, une ligne : le reçu, la date, le mode, le montant — et sa
// preuve (photo) quand il y en a une. « Encaisser » ouvre une feuille : le
// montant (le reste, par défaut), le mode, le lieu (Guangzhou avant le
// départ, Douala au retrait), la photo de la preuve, une référence. Le reçu
// PDF part aussitôt dans la feuille de partage. Quand tout est là : la
// facture acquittée, le document final.
// Réservé à canCollectParcelPayments ; les autres voient, sans agir.
// ============================================================
import { useEffect, useRef, useState } from 'react';
import { Banknote, Camera, FileCheck2, FileText, Receipt, Undo2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { useAddQuotePayment, useCancelQuotePayment, useInvoiceQuote, usePayQuoteFromWallet, uploadPaymentProof, usePaymentProofUrl } from '@/hooks/useCargoQuote';
import { WalletBalanceCard } from '@/mobile/components/cargo/WalletBalanceCard';
import { METHOD_LABEL, PLACE_SHORT, quoteBalance, quotePaid, xaf, type PaymentMethod, type PaymentPlace, type Quote, type QuotePayment } from '@/lib/cargoQuote';
import { deliverInvoicePdf, deliverReceiptPdf } from '@/lib/cargoQuotePdf';
import type { ShippingSettings } from '@/lib/customerCode';
import { cn } from '@/lib/utils';
import { SURFACE, TEXT, TYPE, BottomSheet, Card, FormField, PrimaryPill, Segmented, SoftPill, TextInput } from '@/mobile/designKit';
import { TextArea } from '@/components/form';
import { formatDateTime } from '@/mobile/components/reception/bits';

const num = (s: string) => { const v = parseFloat(s.replace(/\s/g, '').replace(',', '.')); return Number.isFinite(v) ? v : null; };
const METHODS: PaymentMethod[] = ['cash', 'wallet', 'mobile_money', 'bank_transfer', 'other'];

/** Quatre modes en deux rangées : à 320 px, une seule ligne ne tient pas. */
function MethodGrid({ value, onChange }: { value: PaymentMethod; onChange: (m: PaymentMethod) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Mode de paiement">
      {METHODS.map((m) => {
        const active = m === value;
        return (
          <button key={m} type="button" role="radio" aria-checked={active} onClick={() => onChange(m)}
            className={cn('h-12 rounded-lg px-3 text-[16px] font-semibold transition-colors', active ? 'bg-[#2C2C2C] text-[#F5F5F5] dark:bg-[#E3E3E3] dark:text-[#1E1E1E]' : 'bg-[#F5F5F5] text-[#1E1E1E] dark:bg-[#383838] dark:text-[#F5F5F5]')}>
            {METHOD_LABEL[m]}
          </button>
        );
      })}
    </div>
  );
}

/** La photo de la preuve, en vignette signée (le seau est privé). */
function ProofThumb({ path }: { path: string }) {
  const { data: url } = usePaymentProofUrl(path);
  const isPdf = path.endsWith('.pdf');
  return (
    <a href={url ?? undefined} target="_blank" rel="noreferrer" aria-label="Voir la preuve" className={cn('flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg', SURFACE.holder)}>
      {url && !isPdf ? <img src={url} alt="" className="h-full w-full object-cover" /> : <FileText className="h-5 w-5" />}
    </a>
  );
}

function PaymentRow({ q, p, settings, canCancel, onCancel }: { q: Quote; p: QuotePayment; settings: ShippingSettings; canCancel: boolean; onCancel: () => void }) {
  const off = !!p.cancelled_at;
  return (
    <div className="space-y-3 py-4">
      <div className="flex items-start gap-3">
        {p.proof_path ? <ProofThumb path={p.proof_path} /> : <span className={cn('flex h-14 w-14 shrink-0 items-center justify-center rounded-lg', SURFACE.holder)}><Banknote className="h-5 w-5" /></span>}
        <span className="min-w-0 flex-1">
          <span className={cn('flex items-baseline justify-between gap-3', off && 'line-through opacity-60')}>
            <span className={cn(TYPE.bodyStrong, TEXT.strong)}>{p.receipt_no}</span>
            <span className={cn('shrink-0 tabular-nums', TYPE.bodyStrong, TEXT.strong)}>{xaf(p.amount_xaf)}</span>
          </span>
          <span className={cn('mt-0.5 block', TYPE.small, TEXT.muted)}>{formatDateTime(p.paid_at)} · {METHOD_LABEL[p.method]}{p.reference ? ` · ${p.reference}` : ''} · {PLACE_SHORT[p.place]}</span>
          {p.received_by_name && !off && <span className={cn('block', TYPE.small, TEXT.muted)}>Reçu par {p.received_by_name}</span>}
          {off && <span className={cn('mt-1 block', TYPE.small, 'text-[#C00F0C] dark:text-[#EC221F]')}>Annulé : {p.cancel_reason}</span>}
          {p.note && !off && <span className={cn('mt-1 block', TYPE.small, TEXT.body)}>{p.note}</span>}
        </span>
      </div>
      {!off && (
        <div className="flex gap-2">
          <SoftPill onClick={() => void deliverReceiptPdf(q, p, settings)} className="h-10 flex-1 text-[15px]"><Receipt /> Reçu (PDF)</SoftPill>
          {canCancel && <SoftPill onClick={onCancel} className="h-10 px-4 text-[15px]"><Undo2 /> Annuler</SoftPill>}
        </div>
      )}
    </div>
  );
}

/** Ce que la barre du bas de l'écran peut demander à cette section : ouvrir la feuille « Encaisser », ou établir la facture. */
export type PaymentRequest = { kind: 'pay' | 'invoice'; n: number } | null;

export function QuotePayments({ quote, settings, request }: { quote: Quote; settings: ShippingSettings; request?: PaymentRequest }) {
  const { hasPermission } = useAdminAuth();
  const canCollect = hasPermission('canCollectParcelPayments');
  const add = useAddQuotePayment();
  const payWallet = usePayQuoteFromWallet();
  const cancel = useCancelQuotePayment();
  const invoice = useInvoiceQuote();
  const fileRef = useRef<HTMLInputElement>(null);

  const total = Math.round(Number(quote.total_xaf ?? 0));
  const paid = quotePaid(quote);
  const balance = quoteBalance(quote);
  const invoiced = !!quote.invoice_no;
  const payments = quote.payments ?? [];

  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [place, setPlace] = useState<PaymentPlace>('guangzhou');
  const [paidAt, setPaidAt] = useState('');
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');
  const [proof, setProof] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [invoicing, setInvoicing] = useState(false);

  const openSheet = () => { setAmount(String(balance)); setMethod('cash'); setPlace('guangzhou'); setPaidAt(''); setReference(''); setNote(''); setProof(null); setOpen(true); };

  const submit = async () => {
    const v = num(amount);
    if (v == null || v <= 0 || !Number.isSafeInteger(Math.round(v))) { toast.error('Indiquez le montant reçu'); return; }
    if (v > balance) { toast.error(`Le montant dépasse le reste à payer (${xaf(balance)})`); return; }
    setSaving(true);
    try {
      // Depuis le solde du client : la base débite le portefeuille et fait le reçu ; sinon, l'encaissement classique.
      const { quote: fresh, payment } = method === 'wallet'
        ? await payWallet.mutateAsync({ quoteId: quote.id, amount: Math.round(v), note: note.trim() || undefined })
        : await (async () => {
          const proofPath = proof ? await uploadPaymentProof(quote.id, proof) : null;
          return add.mutateAsync({ quoteId: quote.id, amount: Math.round(v), method, place, paidAt: paidAt ? new Date(paidAt).toISOString() : null, reference: reference.trim() || undefined, proofPath, note: note.trim() || undefined });
        })();
      setOpen(false);
      if (payment) {
        const outcome = await deliverReceiptPdf(fresh, payment, settings);
        if (outcome === 'downloaded') toast.success(`Reçu ${payment.receipt_no} téléchargé`);
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const issueInvoice = async () => {
    setInvoicing(true);
    try {
      const fresh = await invoice.mutateAsync(quote.id);
      if ((await deliverInvoicePdf(fresh, settings)) === 'downloaded') toast.success(`Facture ${fresh.invoice_no} téléchargée`);
    } catch (e) { toast.error((e as Error).message); } finally { setInvoicing(false); }
  };

  // La barre du bas demande « Encaisser » ou « Facture » : on obéit une fois par demande.
  const lastRequest = useRef(0);
  useEffect(() => {
    if (!request || request.n === lastRequest.current) return;
    lastRequest.current = request.n;
    if (request.kind === 'pay' && canCollect && !invoiced && balance > 0) openSheet();
    if (request.kind === 'invoice' && canCollect && !invoiced && balance === 0 && total > 0) void issueInvoice();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request]);

  return (
    <section className="space-y-3">
      <h2 className={cn(TYPE.lead, TEXT.strong)}>Paiement</h2>

      {/* Le reste à payer, en grand ; ou « Payé » ; ou la facture. */}
      <Card className="space-y-3">
        <div className="flex items-end justify-between gap-3">
          <span>
            <span className={cn('block', TYPE.small, TEXT.muted)}>{invoiced ? `Facture acquittée ${quote.invoice_no}` : balance > 0 ? 'Reste à payer' : 'Entièrement payé'}</span>
            <span className={cn('block text-[28px] font-semibold leading-tight tabular-nums', balance > 0 && !invoiced ? 'text-[#975102] dark:text-[#E8B931]' : 'text-[#02542D] dark:text-[#CFF7D3]')}>{xaf(balance > 0 ? balance : total)}</span>
          </span>
          <span className={cn('shrink-0 whitespace-nowrap text-right tabular-nums', TYPE.small, TEXT.muted)}>
            <span className="block">Devis {xaf(total)}</span>
            <span className="block">Encaissé {xaf(paid)}</span>
          </span>
        </div>
        {canCollect && !invoiced && balance > 0 && total > 0 && (
          <PrimaryPill onClick={openSheet} className="h-14 w-full text-[17px]"><Banknote /> Encaisser</PrimaryPill>
        )}
        {canCollect && !invoiced && balance === 0 && total > 0 && (
          <PrimaryPill onClick={() => void issueInvoice()} loading={invoicing} className="h-14 w-full text-[17px]"><FileCheck2 /> Établir la facture acquittée</PrimaryPill>
        )}
        {invoiced && (
          <SoftPill onClick={() => void deliverInvoicePdf(quote, settings)} className="h-12 w-full text-[16px]"><FileCheck2 /> Facture acquittée (PDF)</SoftPill>
        )}
        {!canCollect && !invoiced && balance > 0 && <p className={cn(TYPE.small, TEXT.muted)}>Seules les opérations encaissent.</p>}
      </Card>

      {payments.length > 0 && (
        <Card className="py-0 [&>*]:border-b [&>*]:border-[#D9D9D9] [&>*:last-child]:border-b-0 dark:[&>*]:border-[#444444]">
          {payments.map((p) => (
            <PaymentRow key={p.id} q={quote} p={p} settings={settings} canCancel={canCollect && !invoiced} onCancel={() => { setCancelId(p.id); setReason(''); }} />
          ))}
        </Card>
      )}

      {/* La feuille « Encaisser ». */}
      <BottomSheet open={open} onClose={() => !saving && setOpen(false)} title="Encaisser un paiement">
        <div className="space-y-4">
          <FormField label="Montant reçu" htmlFor="pay-amount" hint={`Reste à payer : ${xaf(balance)}`}>
            <div className="relative">
              <TextInput id="pay-amount" value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="numeric" placeholder="0" autoFocus className="h-14 pr-16 text-[22px] font-semibold tabular-nums" />
              <span className={cn('pointer-events-none absolute right-4 top-1/2 -translate-y-1/2', TYPE.small, TEXT.muted)}>XAF</span>
            </div>
          </FormField>
          <FormField label="Comment" htmlFor="pay-method"><MethodGrid value={method} onChange={setMethod} /></FormField>
          {method === 'wallet' ? (
            <WalletBalanceCard userId={quote.client?.user_id} amount={Math.round(num(amount) ?? 0)} />
          ) : (
            <>
              <FormField label="Où" htmlFor="pay-place">
                <Segmented<PaymentPlace> value={place} onChange={setPlace} options={[{ value: 'guangzhou', label: 'Guangzhou' }, { value: 'douala', label: 'Douala' }, { value: 'other', label: 'Ailleurs' }]} />
              </FormField>
              <FormField label="La preuve" htmlFor="pay-proof" hint="Photo du reçu Mobile Money, du bordereau de virement, du billet compté.">
                <input ref={fileRef} id="pay-proof" type="file" accept="image/*,application/pdf" capture="environment" className="hidden" onChange={(e) => setProof(e.target.files?.[0] ?? null)} />
                <SoftPill onClick={() => fileRef.current?.click()} className="h-12 w-full text-[16px]"><Camera /> {proof ? proof.name.length > 28 ? `${proof.name.slice(0, 25)}…` : proof.name : 'Prendre la photo de la preuve'}</SoftPill>
              </FormField>
              {method !== 'cash' && (
                <FormField label="Référence de la transaction" htmlFor="pay-ref">
                  <TextInput id="pay-ref" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="N° Mobile Money, référence du virement" className="h-12" />
                </FormField>
              )}
              <FormField label="Date du paiement" htmlFor="pay-date" hint="Laissez vide si c'est maintenant.">
                <TextInput id="pay-date" type="datetime-local" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} className="h-12" />
              </FormField>
            </>
          )}
          <TextArea id="pay-note" label="Note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Facultatif" controlClassName="min-h-[64px]" />
          <PrimaryPill onClick={() => void submit()} loading={saving} disabled={num(amount) == null} className="h-14 w-full text-[17px]"><Receipt /> Enregistrer et faire le reçu</PrimaryPill>
        </div>
      </BottomSheet>

      {/* La feuille « Annuler cet encaissement ». */}
      <BottomSheet open={cancelId !== null} onClose={() => setCancelId(null)} title="Annuler cet encaissement">
        <div className="space-y-4">
          <p className={cn(TYPE.body, TEXT.muted)}>L'encaissement reste visible, barré, avec votre motif. Le reste à payer remonte d'autant.{payments.find((p) => p.id === cancelId)?.method === 'wallet' ? ' Le montant retourne sur le solde du client.' : ''}</p>
          <TextArea id="cancel-reason" label="Pourquoi" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Double saisie, mauvais montant…" controlClassName="min-h-[72px]" />
          <PrimaryPill danger onClick={() => { if (!cancelId || !reason.trim()) return; cancel.mutate({ paymentId: cancelId, reason: reason.trim() }); setCancelId(null); }} disabled={!reason.trim()} loading={cancel.isPending} className="h-14 w-full text-[17px]">
            <Undo2 /> Annuler l'encaissement
          </PrimaryPill>
        </div>
      </BottomSheet>
    </section>
  );
}
