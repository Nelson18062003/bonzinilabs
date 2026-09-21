// ============================================================
// ENTREPÔT — Encaisser à Douala. Un devis à solder à la fois : le reste à
// payer en grand, le montant reçu (le reste, par défaut), comment (quatre
// boutons), une référence si ce n'est pas des espèces, une photo de la
// preuve si on veut. « Encaisser » : le reçu part aussitôt, et, quand tout
// est soldé, on revient aux colis pour la remise. Le lieu est toujours
// Douala, la date toujours maintenant : rien à choisir.
// ============================================================
import { useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Banknote, Camera, Check, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { MobileHeader } from '@/mobile/components/layout/MobileHeader';
import { useClientAtWarehouse } from '@/hooks/useWarehouse';
import { useAddQuotePayment, useCargoQuote, uploadPaymentProof } from '@/hooks/useCargoQuote';
import { useAdminShippingSettings } from '@/hooks/useShippingSettings';
import { DEFAULT_SHIPPING_SETTINGS } from '@/lib/customerCode';
import { METHOD_LABEL, xaf, type PaymentMethod } from '@/lib/cargoQuote';
import { deliverReceiptPdf } from '@/lib/cargoQuotePdf';
import { releaseBlockers, type ClientQuoteSummary } from '@/lib/warehouse';
import { cn } from '@/lib/utils';
import { SURFACE, TEXT, TYPE, Card, FormField, PrimaryPill, ScreenError, ScreenLoader, SoftPill, TextInput } from '@/mobile/designKit';
import { ClientHead, WhQuestion } from '@/mobile/components/warehouse/bits';
import { readReleaseDraft } from './releaseDraft';

const METHODS: PaymentMethod[] = ['cash', 'mobile_money', 'bank_transfer', 'other'];
const num = (s: string) => { const v = parseFloat(s.replace(/\s/g, '').replace(',', '.')); return Number.isFinite(v) ? v : null; };

/** Le formulaire d'un devis : ce qu'il reste, ce qu'on reçoit, comment. */
function PayForm({ summary, onDone }: { summary: ClientQuoteSummary; onDone: () => void }) {
  const { data: q, isLoading } = useCargoQuote(summary.deposit_id);
  const { data: settings } = useAdminShippingSettings();
  const add = useAddQuotePayment();
  const fileRef = useRef<HTMLInputElement>(null);
  const [amount, setAmount] = useState(String(summary.balance_xaf));
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [reference, setReference] = useState('');
  const [proof, setProof] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  if (isLoading || !q) return <ScreenLoader />;
  const balance = Math.max(0, Math.round(Number(q.total_xaf) - Number(q.amount_paid_xaf)));
  const v = num(amount);
  const ok = v != null && v > 0 && Number.isSafeInteger(Math.round(v)) && Math.round(v) <= balance;
  const partial = ok && Math.round(v!) < balance;

  const submit = async () => {
    if (!ok) { toast.error(v != null && v > balance ? `Le montant dépasse le reste à payer (${xaf(balance)})` : 'Indiquez le montant reçu'); return; }
    setSaving(true);
    try {
      const proofPath = proof ? await uploadPaymentProof(q.id, proof) : null;
      const { quote: fresh, payment } = await add.mutateAsync({ quoteId: q.id, amount: Math.round(v!), method, place: 'douala', reference: reference.trim() || undefined, proofPath });
      if (payment) { const out = await deliverReceiptPdf(fresh, payment, settings ?? DEFAULT_SHIPPING_SETTINGS); if (out === 'downloaded') toast.success(`Reçu ${payment.receipt_no} téléchargé`); }
      onDone();
    } catch (e) { toast.error((e as Error).message); } finally { setSaving(false); }
  };

  return (
    <div className="space-y-5">
      <Card className="space-y-1">
        <span className={cn('block', TYPE.small, TEXT.muted)}>Reste à payer · {summary.deposit_no}{summary.quote_no ? ` · ${summary.quote_no}` : ''}</span>
        <span className={cn('block text-[32px] font-semibold leading-tight tabular-nums text-[#975102] dark:text-[#E8B931]')}>{xaf(balance)}</span>
        <span className={cn('block tabular-nums', TYPE.small, TEXT.muted)}>Devis {xaf(q.total_xaf)} · déjà encaissé {xaf(q.amount_paid_xaf)}</span>
      </Card>
      <FormField label="Montant reçu" htmlFor="wp-amount" hint={partial ? `Il restera ${xaf(balance - Math.round(v!))} : la remise attendra le solde.` : 'Le reste, sauf si le client paie en plusieurs fois.'}>
        <div className="relative">
          <TextInput id="wp-amount" value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="numeric" placeholder="0" className="h-16 pr-16 text-[26px] font-semibold tabular-nums" />
          <span className={cn('pointer-events-none absolute right-4 top-1/2 -translate-y-1/2', TYPE.body, TEXT.muted)}>XAF</span>
        </div>
      </FormField>
      <FormField label="Comment" htmlFor="wp-method">
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Mode de paiement">
          {METHODS.map((m) => (
            <button key={m} type="button" role="radio" aria-checked={m === method} onClick={() => setMethod(m)}
              className={cn('h-14 rounded-lg px-3 text-[16px] font-semibold transition-colors', m === method ? 'bg-[#2C2C2C] text-[#F5F5F5] dark:bg-[#E3E3E3] dark:text-[#1E1E1E]' : 'bg-[#F5F5F5] text-[#1E1E1E] dark:bg-[#383838] dark:text-[#F5F5F5]')}>
              {METHOD_LABEL[m]}
            </button>
          ))}
        </div>
      </FormField>
      {method !== 'cash' && (
        <FormField label="Référence de l'opération" htmlFor="wp-ref" hint="Le numéro de la transaction, sur le téléphone du client ou le bordereau."><TextInput id="wp-ref" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Facultatif" className="h-12" /></FormField>
      )}
      <div>
        <input ref={fileRef} type="file" accept="image/*,application/pdf" capture="environment" className="hidden" onChange={(e) => setProof(e.target.files?.[0] ?? null)} />
        <SoftPill onClick={() => fileRef.current?.click()} className="h-12 w-full text-[16px]"><Camera /> {proof ? `Preuve : ${proof.name}` : 'Photographier la preuve (facultatif)'}</SoftPill>
      </div>
      <PrimaryPill onClick={() => void submit()} disabled={!ok} loading={saving} className="h-14 w-full text-[17px]"><Banknote /> Encaisser {ok ? xaf(Math.round(v!)) : ''}</PrimaryPill>
    </div>
  );
}

export function WarehousePay() {
  const navigate = useNavigate();
  const { code } = useParams<{ code: string }>();
  const { data, isLoading, error, refetch } = useClientAtWarehouse(code);
  const [which, setWhich] = useState<string | null>(null);
  if (isLoading) return <ScreenLoader className="min-h-[100dvh]" />;
  if (error || !data) return <ScreenError description={(error as Error | null)?.message ?? 'Client introuvable'} onRetry={() => void refetch()} />;

  const draft = readReleaseDraft(code);
  const chosen = draft ? data.ready.filter((p) => draft.ids.includes(p.id)) : data.ready;
  const due = releaseBlockers(chosen.length ? chosen : data.ready, data.quotes).filter((q) => q.total_xaf > 0 && q.balance_xaf > 0);
  const current = due.length === 1 ? due[0] : due.find((q) => q.id === which) ?? null;
  const back = `/w/remise/${code}`;
  const afterPay = () => { void refetch(); setWhich(null); if (due.length <= 1) { toast.success('Payé : vous pouvez remettre les colis'); navigate(back, { replace: true }); } };

  return (
    <div className={cn('flex min-h-full flex-col', SURFACE.canvas)}>
      <MobileHeader title="Encaisser" subtitle="Douala, au retrait" showBack backTo={current && due.length > 1 ? undefined : back} onBack={current && due.length > 1 ? () => setWhich(null) : undefined} />
      <div className="space-y-5 px-4 pb-10 pt-4">
        <Card><ClientHead client={data.client} size="md" /></Card>
        {due.length === 0 ? (
          <>
            <div className="flex flex-col items-center py-4 text-center">
              <span className="flex h-20 w-20 items-center justify-center rounded-full bg-[#14AE5C] text-white"><Check className="h-10 w-10" strokeWidth={3} /></span>
              <p className={cn('mt-4', TYPE.heading, TEXT.strong)}>Tout est payé</p>
              <p className={cn('mt-1', TYPE.body, TEXT.muted)}>Vous pouvez remettre les colis.</p>
            </div>
            <PrimaryPill onClick={() => navigate(back, { replace: true })} className="h-14 w-full text-[17px]">Retour aux colis</PrimaryPill>
          </>
        ) : current ? (
          <>
            <WhQuestion title="Combien recevez-vous ?" help="Le reçu part dans la foulée. Rien ne sort avant le solde." />
            <PayForm key={current.id} summary={current} onDone={afterPay} />
          </>
        ) : (
          <>
            <WhQuestion title="Quel devis solder ?" help={`${due.length} devis restent à payer pour ces colis. Un à la fois.`} />
            <Card className="py-0">
              {due.map((q) => (
                <button key={q.id} type="button" onClick={() => setWhich(q.id)} className={cn('flex w-full items-center gap-3 border-b py-3 text-left last:border-b-0', SURFACE.divider)}>
                  <span className="min-w-0 flex-1">
                    <span className={cn('block tabular-nums', TYPE.bodyStrong, TEXT.strong)}>{q.deposit_no}{q.quote_no ? ` · ${q.quote_no}` : ''}</span>
                    <span className={cn('block tabular-nums', TYPE.small, TEXT.muted)}>Reste {xaf(q.balance_xaf)} sur {xaf(q.total_xaf)}</span>
                  </span>
                  <ChevronRight className={cn('h-5 w-5 shrink-0', TEXT.muted)} />
                </button>
              ))}
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
