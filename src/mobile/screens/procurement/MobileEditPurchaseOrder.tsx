import { useEffect, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { MobileHeader } from '@/mobile/components/layout/MobileHeader';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { usePurchaseOrder, useUpdatePurchaseOrder } from '@/hooks/useProcurement';
import type { ProcIncoterm, ProcPoStatus } from '@/integrations/supabase/procurement';
import { FieldLabel, Pill, PrimaryPill } from '@/components/treasury/ui';
import { PROC_INPUT as INPUT, PO_STATUS_OPTIONS } from './shared';
import { cn } from '@/lib/utils';

const INCOTERMS: ProcIncoterm[] = ['EXW', 'FCA', 'FAS', 'FOB', 'CFR', 'CIF', 'CPT', 'CIP', 'DAP', 'DPU', 'DDP'];

export function MobileEditPurchaseOrder() {
  const navigate = useNavigate();
  const { poId } = useParams<{ poId: string }>();
  const { hasPermission } = useAdminAuth();
  const { data } = usePurchaseOrder(poId);
  const updatePo = useUpdatePurchaseOrder();

  const [total, setTotal] = useState('');
  const [deposit, setDeposit] = useState('');
  const [incoterm, setIncoterm] = useState<ProcIncoterm | ''>('');
  const [status, setStatus] = useState<ProcPoStatus>('open');
  const [readyDate, setReadyDate] = useState('');
  const [notes, setNotes] = useState('');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (data?.purchase_order && !loaded) {
      const po = data.purchase_order;
      setTotal(String(po.total_amount));
      setDeposit(String(po.deposit_pct));
      setIncoterm(po.incoterm ?? '');
      setStatus(po.status);
      setReadyDate(po.expected_ready_date ?? '');
      setNotes(po.notes ?? '');
      setLoaded(true);
    }
  }, [data, loaded]);

  if (!hasPermission('canManageProcurement') || !poId) {
    return <Navigate to="/m/more/procurement" replace />;
  }

  const handleSubmit = async () => {
    try {
      await updatePo.mutateAsync({
        p_purchase_order_id: poId,
        p_total_amount: total === '' ? null : Number(total),
        p_deposit_pct: deposit === '' ? null : Number(deposit),
        p_incoterm: incoterm || null,
        p_status: status,
        p_expected_ready_date: readyDate || null,
        p_notes: notes.trim() || null,
      });
      navigate(`/m/more/procurement/po/${poId}`, { replace: true });
    } catch { /* toast */ }
  };

  return (
    <div className="flex flex-col min-h-full bg-background">
      <MobileHeader title="Modifier la commande" showBack backTo={`/m/more/procurement/po/${poId}`} />
      <div className="px-5 py-6 space-y-5">
        <div className="flex gap-3">
          <div className="flex-1"><FieldLabel>Montant total</FieldLabel><input value={total} onChange={(e) => setTotal(e.target.value)} inputMode="decimal" className={INPUT} /></div>
          <div className="w-28"><FieldLabel>Acompte %</FieldLabel><input value={deposit} onChange={(e) => setDeposit(e.target.value)} inputMode="decimal" className={INPUT} /></div>
        </div>
        <div>
          <FieldLabel>Statut</FieldLabel>
          <div className="flex flex-wrap gap-2">
            {PO_STATUS_OPTIONS.map((x) => <Pill key={x.value} active={status === x.value} onClick={() => setStatus(x.value)}>{x.label}</Pill>)}
          </div>
        </div>
        <div>
          <FieldLabel>Incoterm</FieldLabel>
          <select value={incoterm} onChange={(e) => setIncoterm(e.target.value as ProcIncoterm | '')} className={INPUT}>
            <option value="">—</option>
            {INCOTERMS.map((i) => <option key={i} value={i}>{i}</option>)}
          </select>
        </div>
        <div><FieldLabel>Date de disponibilité prévue</FieldLabel><input type="date" value={readyDate} onChange={(e) => setReadyDate(e.target.value)} className={INPUT} /></div>
        <div><FieldLabel>Notes</FieldLabel><textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={cn(INPUT, 'h-auto py-3 leading-relaxed')} /></div>
        <PrimaryPill onClick={handleSubmit} disabled={updatePo.isPending} loading={updatePo.isPending} type="button">
          Enregistrer
        </PrimaryPill>
      </div>
    </div>
  );
}
