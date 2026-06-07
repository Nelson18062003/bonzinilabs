import { useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { MobileHeader } from '@/mobile/components/layout/MobileHeader';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { useLogProductionEvent } from '@/hooks/useProcurement';
import type { ProcProductionStatus } from '@/integrations/supabase/procurement';
import { FieldLabel, Pill, PrimaryPill } from '@/components/treasury/ui';
import { PROC_INPUT as INPUT, PROD_STATUS_OPTIONS } from './shared';
import { cn } from '@/lib/utils';

export function MobileLogProduction() {
  const navigate = useNavigate();
  const { poId } = useParams<{ poId: string }>();
  const { hasPermission } = useAdminAuth();
  const logEvent = useLogProductionEvent();

  const [status, setStatus] = useState<ProcProductionStatus>('in_production');
  const [occurredAt, setOccurredAt] = useState('');
  const [note, setNote] = useState('');

  if (!hasPermission('canManageProcurement') || !poId) {
    return <Navigate to="/m/more/procurement" replace />;
  }

  const handleSubmit = async () => {
    try {
      await logEvent.mutateAsync({
        p_purchase_order_id: poId,
        p_status: status,
        p_occurred_at: occurredAt || undefined,
        p_note: note.trim() || null,
      });
      navigate(`/m/more/procurement/po/${poId}`, { replace: true });
    } catch { /* toast */ }
  };

  return (
    <div className="flex flex-col min-h-full bg-background">
      <MobileHeader title="Étape de production" showBack backTo={`/m/more/procurement/po/${poId}`} />
      <div className="px-5 py-6 space-y-5">
        <div>
          <FieldLabel>Statut</FieldLabel>
          <div className="flex flex-wrap gap-2">{PROD_STATUS_OPTIONS.map((x) => <Pill key={x.value} active={status === x.value} onClick={() => setStatus(x.value)}>{x.label}</Pill>)}</div>
        </div>
        <div><FieldLabel>Date</FieldLabel><input type="date" value={occurredAt} onChange={(e) => setOccurredAt(e.target.value)} className={INPUT} /></div>
        <div><FieldLabel>Note</FieldLabel><textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} className={cn(INPUT, 'h-auto py-3 leading-relaxed')} /></div>
        <PrimaryPill onClick={handleSubmit} disabled={logEvent.isPending} loading={logEvent.isPending} type="button">Enregistrer l'étape</PrimaryPill>
      </div>
    </div>
  );
}
