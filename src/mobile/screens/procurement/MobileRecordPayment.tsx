import { useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { MobileHeader } from '@/mobile/components/layout/MobileHeader';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { usePurchaseOrder, useRecordSupplierPayment } from '@/hooks/useProcurement';
import type { ProcCurrency, ProcPaymentLeg, ProcPaymentMethod, ProcPaidBy } from '@/integrations/supabase/procurement';
import { FieldLabel, Pill, PrimaryPill, SOFT_CARD } from '@/components/treasury/ui';
import { cn } from '@/lib/utils';

const INPUT = 'h-[52px] w-full rounded-2xl bg-muted/60 px-4 text-[15px] text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-foreground/10';
const LEGS: { v: ProcPaymentLeg; l: string }[] = [
  { v: 'deposit', l: 'Acompte' }, { v: 'balance', l: 'Solde' }, { v: 'final', l: 'Final' }, { v: 'extra', l: 'Extra' },
];
const METHODS: { v: ProcPaymentMethod; l: string }[] = [
  { v: 'cash', l: 'Espèces' }, { v: 'alipay', l: 'Alipay' }, { v: 'wechat', l: 'WeChat' },
  { v: 'bank_transfer', l: 'Virement' }, { v: 'other', l: 'Autre' },
];
const PAID_BY: { v: ProcPaidBy; l: string }[] = [
  { v: 'client_direct', l: 'Client direct' }, { v: 'father_onsite', l: 'Père sur place' }, { v: 'bonzini', l: 'Bonzini' },
];

export function MobileRecordPayment() {
  const navigate = useNavigate();
  const { poId } = useParams<{ poId: string }>();
  const { hasPermission } = useAdminAuth();
  const { data: poData } = usePurchaseOrder(poId);
  const recordPayment = useRecordSupplierPayment();

  const po = poData?.purchase_order;
  const [leg, setLeg] = useState<ProcPaymentLeg>('deposit');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState<ProcCurrency>('CNY');
  const [method, setMethod] = useState<ProcPaymentMethod>('cash');
  const [paidBy, setPaidBy] = useState<ProcPaidBy | ''>('');
  const [occurredAt, setOccurredAt] = useState('');
  const [externalRef, setExternalRef] = useState('');
  const [notes, setNotes] = useState('');

  // Devise par défaut = celle de la commande (une fois chargée).
  const effectiveCurrency = po && currency === 'CNY' && po.currency !== 'CNY' ? po.currency : currency;

  if (!hasPermission('canManageProcurement') || !poId) {
    return <Navigate to="/m/more/procurement" replace />;
  }

  const amt = Number(amount);
  const canSubmit = amt > 0 && !recordPayment.isPending;

  const handleSubmit = async () => {
    try {
      await recordPayment.mutateAsync({
        p_purchase_order_id: poId,
        p_leg: leg,
        p_amount: amt,
        p_method: method,
        p_currency: effectiveCurrency,
        p_occurred_at: occurredAt || undefined,
        p_paid_by: paidBy || null,
        p_external_ref: externalRef.trim() || null,
        p_notes: notes.trim() || null,
      });
      navigate(`/m/more/procurement/po/${poId}`, { replace: true });
    } catch { /* toast */ }
  };

  return (
    <div className="flex flex-col min-h-full bg-background">
      <MobileHeader title="Enregistrer un paiement" showBack backTo={`/m/more/procurement/po/${poId}`} />

      <div className="px-5 py-6 space-y-5">
        {po && (
          <div className={cn(SOFT_CARD, 'flex items-center justify-between p-3.5')}>
            <span className="text-[12px] text-muted-foreground">{po.reference} · {po.supplier.display_name}</span>
            <span className="text-[13px] font-bold tabular-nums text-bonzini-orange">reste {po.outstanding_amount.toLocaleString('fr-FR')} {po.currency}</span>
          </div>
        )}

        <div>
          <FieldLabel>Type de versement</FieldLabel>
          <div className="flex flex-wrap gap-2">{LEGS.map((x) => <Pill key={x.v} active={leg === x.v} onClick={() => setLeg(x.v)}>{x.l}</Pill>)}</div>
        </div>

        <div className="flex gap-3">
          <div className="flex-1">
            <FieldLabel>Montant *</FieldLabel>
            <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="0" className={INPUT} />
          </div>
          <div className="w-32">
            <FieldLabel>Devise</FieldLabel>
            <div className="flex gap-2">
              <Pill active={effectiveCurrency === 'CNY'} onClick={() => setCurrency('CNY')}>CNY</Pill>
              <Pill active={effectiveCurrency === 'XAF'} onClick={() => setCurrency('XAF')}>XAF</Pill>
            </div>
          </div>
        </div>

        <div>
          <FieldLabel>Moyen</FieldLabel>
          <div className="flex flex-wrap gap-2">{METHODS.map((x) => <Pill key={x.v} active={method === x.v} onClick={() => setMethod(x.v)}>{x.l}</Pill>)}</div>
        </div>

        <div>
          <FieldLabel>Payé par</FieldLabel>
          <div className="flex flex-wrap gap-2">
            {PAID_BY.map((x) => <Pill key={x.v} active={paidBy === x.v} onClick={() => setPaidBy(paidBy === x.v ? '' : x.v)}>{x.l}</Pill>)}
          </div>
        </div>

        <div>
          <FieldLabel>Date du paiement</FieldLabel>
          <input type="date" value={occurredAt} onChange={(e) => setOccurredAt(e.target.value)} className={INPUT} />
        </div>

        <div>
          <FieldLabel>Référence externe</FieldLabel>
          <input value={externalRef} onChange={(e) => setExternalRef(e.target.value)} placeholder="N° reçu, transaction…" className={INPUT} />
        </div>

        <div>
          <FieldLabel>Notes</FieldLabel>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={cn(INPUT, 'h-auto py-3 leading-relaxed')} />
        </div>

        <PrimaryPill onClick={handleSubmit} disabled={!canSubmit} loading={recordPayment.isPending} type="button">
          Enregistrer le paiement
        </PrimaryPill>
        <p className="text-center text-[11px] text-muted-foreground">Mode attestation (preuve autonome). Le lien vers un paiement du rail viendra plus tard.</p>
      </div>
    </div>
  );
}
