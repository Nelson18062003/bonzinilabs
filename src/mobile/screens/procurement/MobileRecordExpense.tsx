import { useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { MobileHeader } from '@/mobile/components/layout/MobileHeader';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { useRecordExpense } from '@/hooks/useProcurement';
import type { ProcCurrency, ProcExpenseCategory } from '@/integrations/supabase/procurement';
import { FieldLabel, Pill, PrimaryPill } from '@/components/treasury/ui';
import { cn } from '@/lib/utils';

const INPUT = 'h-[52px] w-full rounded-2xl bg-muted/60 px-4 text-[15px] text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-foreground/10';
const CATEGORIES: { v: ProcExpenseCategory; l: string }[] = [
  { v: 'hotel', l: 'Hôtel' }, { v: 'transport', l: 'Transport' }, { v: 'driver', l: 'Chauffeur' },
  { v: 'meals', l: 'Repas' }, { v: 'other', l: 'Autre' },
];

export function MobileRecordExpense() {
  const navigate = useNavigate();
  const { missionId } = useParams<{ missionId: string }>();
  const { hasPermission } = useAdminAuth();
  const recordExpense = useRecordExpense();

  const [category, setCategory] = useState<ProcExpenseCategory>('transport');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState<ProcCurrency>('CNY');
  const [occurredAt, setOccurredAt] = useState('');
  const [billable, setBillable] = useState(false);
  const [notes, setNotes] = useState('');

  if (!hasPermission('canManageProcurement') || !missionId) {
    return <Navigate to="/m/more/procurement" replace />;
  }

  const amt = Number(amount);

  const handleSubmit = async () => {
    try {
      await recordExpense.mutateAsync({
        p_mission_id: missionId,
        p_category: category,
        p_amount: amt,
        p_currency: currency,
        p_occurred_at: occurredAt || undefined,
        p_billable_to_client: billable,
        p_notes: notes.trim() || null,
      });
      navigate(`/m/more/procurement/missions/${missionId}`, { replace: true });
    } catch { /* toast */ }
  };

  return (
    <div className="flex flex-col min-h-full bg-background">
      <MobileHeader title="Frais de mission" showBack backTo={`/m/more/procurement/missions/${missionId}`} />
      <div className="px-5 py-6 space-y-5">
        <div>
          <FieldLabel>Catégorie</FieldLabel>
          <div className="flex flex-wrap gap-2">{CATEGORIES.map((x) => <Pill key={x.v} active={category === x.v} onClick={() => setCategory(x.v)}>{x.l}</Pill>)}</div>
        </div>
        <div className="flex gap-3">
          <div className="flex-1"><FieldLabel>Montant *</FieldLabel><input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="0" className={INPUT} /></div>
          <div className="w-32">
            <FieldLabel>Devise</FieldLabel>
            <div className="flex gap-2"><Pill active={currency === 'CNY'} onClick={() => setCurrency('CNY')}>CNY</Pill><Pill active={currency === 'XAF'} onClick={() => setCurrency('XAF')}>XAF</Pill></div>
          </div>
        </div>
        <div><FieldLabel>Date</FieldLabel><input type="date" value={occurredAt} onChange={(e) => setOccurredAt(e.target.value)} className={INPUT} /></div>
        <button onClick={() => setBillable((v) => !v)} type="button"
          className={cn('flex h-[52px] w-full items-center justify-center gap-2 rounded-2xl text-[13px] font-semibold transition',
            billable ? 'bg-bonzini-orange/15 text-bonzini-orange' : 'bg-muted/60 text-muted-foreground')}>
          {billable ? 'Refacturable au client ✓' : 'Non refacturable'}
        </button>
        <div><FieldLabel>Notes</FieldLabel><textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={cn(INPUT, 'h-auto py-3 leading-relaxed')} /></div>
        <PrimaryPill onClick={handleSubmit} disabled={amt <= 0 || recordExpense.isPending} loading={recordExpense.isPending} type="button">Enregistrer le frais</PrimaryPill>
      </div>
    </div>
  );
}
