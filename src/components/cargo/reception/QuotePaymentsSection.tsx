// ============================================================
// Desktop admin — les encaissements d'un devis, en section du dialogue de
// dépôt, sous « Prix et devis » : le reste à payer, la table des paiements
// (reçu, date, mode, lieu, référence, preuve, montant), la saisie en ligne
// d'un nouvel encaissement, et la facture acquittée quand tout est là.
// Réservé à canCollectParcelPayments pour agir.
// ============================================================
import { useRef, useState } from 'react';
import { Banknote, FileCheck2, Paperclip, Receipt, Undo2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { useAddQuotePayment, useCancelQuotePayment, useCargoQuote, useInvoiceQuote, uploadPaymentProof, usePaymentProofUrl } from '@/hooks/useCargoQuote';
import { useAdminShippingSettings } from '@/hooks/useShippingSettings';
import { DEFAULT_SHIPPING_SETTINGS } from '@/lib/customerCode';
import { METHOD_LABEL, PLACE_SHORT, quoteBalance, quotePaid, xaf, type PaymentMethod, type PaymentPlace, type Quote, type QuotePayment } from '@/lib/cargoQuote';
import { deliverInvoicePdf, deliverReceiptPdf } from '@/lib/cargoQuotePdf';
import type { ShippingSettings } from '@/lib/customerCode';
import { Band } from '@/components/cargo/dossier/kit';
import { formatDateTime } from '@/mobile/components/reception/bits';
import { cn } from '@/lib/utils';
import { TEXT, SOFT_PILL, PRIMARY_PILL, StatusPill, Th, Td } from '@/desktop/designKit';

const num = (s: string) => { const v = parseFloat(s.replace(/\s/g, '').replace(',', '.')); return Number.isFinite(v) ? v : null; };
const INPUT = 'h-8 rounded-md border border-input bg-background px-2 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-ring';

function ProofLink({ path }: { path: string }) {
  const { data: url } = usePaymentProofUrl(path);
  return <a href={url ?? undefined} target="_blank" rel="noreferrer" className={cn('inline-flex items-center gap-1 text-[12px] font-semibold underline-offset-2 hover:underline', TEXT.strong)}><Paperclip className="h-3.5 w-3.5" /> preuve</a>;
}

function Row({ q, p, settings, canCancel, onCancel }: { q: Quote; p: QuotePayment; settings: ShippingSettings; canCancel: boolean; onCancel: () => void }) {
  const off = !!p.cancelled_at;
  return (
    <tr className={cn(off && 'opacity-60')}>
      <Td first>
        <div className={cn('font-mono text-[12px] font-bold', TEXT.strong, off && 'line-through')}>{p.receipt_no}</div>
        {p.proof_path && <ProofLink path={p.proof_path} />}
      </Td>
      <Td><span className={cn('text-[12.5px] tabular-nums', TEXT.muted)}>{formatDateTime(p.paid_at)}</span></Td>
      <Td>
        <div className="text-[12.5px]">{METHOD_LABEL[p.method]} · {PLACE_SHORT[p.place]}{p.reference ? <span className={cn('font-mono', TEXT.muted)}> · {p.reference}</span> : null}</div>
        {off ? <div className="text-[11.5px] font-semibold text-red-700 dark:text-red-400">Annulé : {p.cancel_reason}</div> : <div className={cn('text-[11.5px]', TEXT.muted)}>{p.received_by_name ? `Reçu par ${p.received_by_name}` : ''}{p.note ? `${p.received_by_name ? ' · ' : ''}${p.note}` : ''}</div>}
      </Td>
      <Td align="right"><span className={cn('text-[13px] font-bold tabular-nums', TEXT.strong, off && 'line-through')}>{xaf(p.amount_xaf)}</span></Td>
      <Td last>
        {!off && (
          <span className="inline-flex items-center gap-1 whitespace-nowrap">
            <button type="button" onClick={() => void deliverReceiptPdf(q, p, settings)} title="Reçu (PDF)" aria-label="Reçu (PDF)" className={cn('inline-flex h-7 w-7 items-center justify-center', SOFT_PILL)}><Receipt className="h-3.5 w-3.5" /></button>
            {canCancel && <button type="button" onClick={onCancel} title="Annuler" aria-label="Annuler cet encaissement" className={cn('inline-flex h-7 w-7 items-center justify-center', SOFT_PILL)}><Undo2 className="h-3.5 w-3.5" /></button>}
          </span>
        )}
      </Td>
    </tr>
  );
}

export function QuotePaymentsSection({ depositId }: { depositId: string }) {
  const { hasPermission } = useAdminAuth();
  const canCollect = hasPermission('canCollectParcelPayments');
  const { data: quote } = useCargoQuote(depositId);
  const { data: settingsData } = useAdminShippingSettings();
  const settings = settingsData ?? DEFAULT_SHIPPING_SETTINGS;
  const add = useAddQuotePayment();
  const cancel = useCancelQuotePayment();
  const invoice = useInvoiceQuote();
  const fileRef = useRef<HTMLInputElement>(null);

  const [adding, setAdding] = useState(false);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [place, setPlace] = useState<PaymentPlace>('guangzhou');
  const [paidAt, setPaidAt] = useState('');
  const [reference, setReference] = useState('');
  const [proof, setProof] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [reason, setReason] = useState('');

  if (!quote || quote.total_xaf <= 0) return null;
  const total = Math.round(Number(quote.total_xaf));
  const paid = quotePaid(quote);
  const balance = quoteBalance(quote);
  const invoiced = !!quote.invoice_no;
  const payments = quote.payments ?? [];

  const submit = async () => {
    const v = num(amount);
    if (v == null || v <= 0) { toast.error('Indiquez le montant reçu'); return; }
    if (v > balance) { toast.error(`Le montant dépasse le reste à payer (${xaf(balance)})`); return; }
    setSaving(true);
    try {
      const proofPath = proof ? await uploadPaymentProof(quote.id, proof) : null;
      const { quote: fresh, payment } = await add.mutateAsync({ quoteId: quote.id, amount: Math.round(v), method, place, paidAt: paidAt ? new Date(paidAt).toISOString() : null, reference: reference.trim() || undefined, proofPath });
      setAdding(false); setAmount(''); setReference(''); setProof(null); setPaidAt('');
      if (payment && (await deliverReceiptPdf(fresh, payment, settings)) === 'downloaded') toast.success(`Reçu ${payment.receipt_no} téléchargé`);
    } catch (e) { toast.error((e as Error).message); } finally { setSaving(false); }
  };

  const issue = async () => {
    try {
      const fresh = await invoice.mutateAsync(quote.id);
      if ((await deliverInvoicePdf(fresh, settings)) === 'downloaded') toast.success(`Facture ${fresh.invoice_no} téléchargée`);
    } catch (e) { toast.error((e as Error).message); }
  };

  return (
    <Band
      title={<span className="inline-flex items-center gap-2">Paiement {invoiced ? <StatusPill tone="success" label={`Facture ${quote.invoice_no}`} /> : balance === 0 ? <StatusPill tone="success" label="Payé" /> : paid > 0 ? <StatusPill tone="pending" label="Partiel" /> : <StatusPill tone="neutral" label="À payer" />}</span>}
      meta={
        <span className="inline-flex items-center gap-3 tabular-nums">
          <span>Encaissé <b className={TEXT.strong}>{xaf(paid)}</b> sur {xaf(total)}</span>
          {balance > 0 && <span className="font-bold text-amber-700 dark:text-amber-400">reste {xaf(balance)}</span>}
        </span>
      }
    >
      {payments.length > 0 && (
        <div className="-mx-5 max-h-[240px] overflow-auto">
          <table className="w-full text-left">
            <thead><tr><Th first>Reçu</Th><Th>Date</Th><Th>Mode</Th><Th align="right">Montant</Th><Th last className="w-[84px]" /></tr></thead>
            <tbody>
              {payments.map((p) => <Row key={p.id} q={quote} p={p} settings={settings} canCancel={canCollect && !invoiced} onCancel={() => { setCancelId(p.id); setReason(''); }} />)}
            </tbody>
          </table>
        </div>
      )}

      {cancelId && (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-md bg-red-500/10 px-3 py-2">
          <span className="text-[12.5px] font-semibold text-red-800 dark:text-red-300">Annuler cet encaissement — pourquoi ?</span>
          <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Double saisie, mauvais montant…" autoFocus className={cn(INPUT, 'w-[260px]')} />
          <button type="button" onClick={() => { if (!reason.trim()) return; cancel.mutate({ paymentId: cancelId, reason: reason.trim() }); setCancelId(null); }} disabled={!reason.trim()} className={cn('inline-flex h-8 items-center px-3 text-[12px] font-bold disabled:opacity-50', PRIMARY_PILL)}>Confirmer</button>
          <button type="button" onClick={() => setCancelId(null)} className={cn('inline-flex h-8 items-center px-3 text-[12px] font-semibold', SOFT_PILL)}>Garder</button>
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {canCollect && !invoiced && balance > 0 && !adding && (
          <button type="button" onClick={() => { setAdding(true); setAmount(String(balance)); }} className={cn('inline-flex h-9 items-center gap-2 px-4 text-[13px] font-bold', PRIMARY_PILL)}><Banknote className="h-4 w-4" /> Encaisser</button>
        )}
        {adding && (
          <span className="flex flex-wrap items-center gap-2">
            <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="numeric" placeholder="Montant XAF" autoFocus className={cn(INPUT, 'w-[120px] text-right font-semibold tabular-nums')} aria-label="Montant reçu" />
            <select value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)} className={INPUT} aria-label="Mode">
              {(Object.keys(METHOD_LABEL) as PaymentMethod[]).map((m) => <option key={m} value={m}>{METHOD_LABEL[m]}</option>)}
            </select>
            <select value={place} onChange={(e) => setPlace(e.target.value as PaymentPlace)} className={INPUT} aria-label="Lieu">
              {(Object.keys(PLACE_SHORT) as PaymentPlace[]).map((p) => <option key={p} value={p}>{PLACE_SHORT[p]}</option>)}
            </select>
            <input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Référence" className={cn(INPUT, 'w-[150px]')} aria-label="Référence" />
            <input value={paidAt} onChange={(e) => setPaidAt(e.target.value)} type="datetime-local" className={INPUT} aria-label="Date du paiement" />
            <input ref={fileRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => setProof(e.target.files?.[0] ?? null)} />
            <button type="button" onClick={() => fileRef.current?.click()} className={cn('inline-flex h-8 items-center gap-1.5 px-3 text-[12px] font-semibold', SOFT_PILL)}><Paperclip className="h-3.5 w-3.5" /> {proof ? (proof.name.length > 18 ? `${proof.name.slice(0, 15)}…` : proof.name) : 'Preuve'}</button>
            <button type="button" onClick={() => void submit()} disabled={saving || num(amount) == null} className={cn('inline-flex h-8 items-center gap-1.5 px-3 text-[12px] font-bold disabled:opacity-50', PRIMARY_PILL)}><Receipt className="h-3.5 w-3.5" /> Enregistrer et faire le reçu</button>
            <button type="button" onClick={() => setAdding(false)} className={cn('inline-flex h-8 items-center px-3 text-[12px] font-semibold', SOFT_PILL)}>Annuler</button>
          </span>
        )}
        <span className="ml-auto flex items-center gap-2">
          {canCollect && !invoiced && balance === 0 && (
            <button type="button" onClick={() => void issue()} disabled={invoice.isPending} className={cn('inline-flex h-9 items-center gap-2 px-4 text-[13px] font-bold disabled:opacity-50', PRIMARY_PILL)}><FileCheck2 className="h-4 w-4" /> Établir la facture acquittée</button>
          )}
          {invoiced && (
            <button type="button" onClick={() => void deliverInvoicePdf(quote, settings)} className={cn('inline-flex h-9 items-center gap-2 px-3.5 text-[13px] font-semibold', SOFT_PILL)}><FileCheck2 className="h-4 w-4" /> Facture acquittée (PDF)</button>
          )}
        </span>
      </div>
    </Band>
  );
}
