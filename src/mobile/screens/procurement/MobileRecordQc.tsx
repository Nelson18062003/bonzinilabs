import { useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { MobileHeader } from '@/mobile/components/layout/MobileHeader';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { useRecordQc } from '@/hooks/useProcurement';
import type { ProcQcType, ProcQcInspectorKind, ProcQcResult } from '@/integrations/supabase/procurement';
import { FieldLabel, Pill, PrimaryPill } from '@/components/treasury/ui';
import { PROC_INPUT as INPUT } from './shared';
import { cn } from '@/lib/utils';
const TYPES: { v: ProcQcType; l: string }[] = [
  { v: 'PPI', l: 'Pré-prod (PPI)' }, { v: 'DUPRO', l: 'En cours (DUPRO)' }, { v: 'PSI', l: 'Final (PSI)' }, { v: 'loading', l: 'Chargement' },
];
const KINDS: { v: ProcQcInspectorKind; l: string }[] = [{ v: 'internal', l: 'Interne' }, { v: 'third_party', l: 'Tiers' }];
const RESULTS: { v: ProcQcResult; l: string }[] = [
  { v: 'pass', l: 'Conforme' }, { v: 'conditional', l: 'Sous réserve' }, { v: 'fail', l: 'Non conforme' },
];

export function MobileRecordQc() {
  const navigate = useNavigate();
  const { poId } = useParams<{ poId: string }>();
  const { hasPermission } = useAdminAuth();
  const recordQc = useRecordQc();

  const [type, setType] = useState<ProcQcType>('PSI');
  const [kind, setKind] = useState<ProcQcInspectorKind>('internal');
  const [result, setResult] = useState<ProcQcResult>('pass');
  const [inspector, setInspector] = useState('');
  const [aql, setAql] = useState('');
  const [occurredAt, setOccurredAt] = useState('');
  const [notes, setNotes] = useState('');

  if (!hasPermission('canManageProcurement') || !poId) {
    return <Navigate to="/m/more/procurement" replace />;
  }

  const handleSubmit = async () => {
    try {
      await recordQc.mutateAsync({
        p_purchase_order_id: poId,
        p_inspection_type: type,
        p_inspector_kind: kind,
        p_result: result,
        p_inspector_name: inspector.trim() || null,
        p_aql_level: aql.trim() || null,
        p_occurred_at: occurredAt || undefined,
        p_notes: notes.trim() || null,
      });
      navigate(`/m/more/procurement/po/${poId}`, { replace: true });
    } catch { /* toast */ }
  };

  return (
    <div className="flex flex-col min-h-full bg-background">
      <MobileHeader title="Inspection qualité" showBack backTo={`/m/more/procurement/po/${poId}`} />
      <div className="px-5 py-6 space-y-5">
        <div>
          <FieldLabel>Type d'inspection</FieldLabel>
          <div className="flex flex-wrap gap-2">{TYPES.map((x) => <Pill key={x.v} active={type === x.v} onClick={() => setType(x.v)}>{x.l}</Pill>)}</div>
        </div>
        <div>
          <FieldLabel>Inspecteur</FieldLabel>
          <div className="flex gap-2">{KINDS.map((x) => <Pill key={x.v} active={kind === x.v} onClick={() => setKind(x.v)}>{x.l}</Pill>)}</div>
        </div>
        <div>
          <FieldLabel>Résultat</FieldLabel>
          <div className="flex flex-wrap gap-2">{RESULTS.map((x) => <Pill key={x.v} active={result === x.v} onClick={() => setResult(x.v)}>{x.l}</Pill>)}</div>
        </div>
        <div className="flex gap-3">
          <div className="flex-1"><FieldLabel>Nom inspecteur</FieldLabel><input value={inspector} onChange={(e) => setInspector(e.target.value)} className={INPUT} /></div>
          <div className="w-28"><FieldLabel>Niveau AQL</FieldLabel><input value={aql} onChange={(e) => setAql(e.target.value)} placeholder="2.5" className={INPUT} /></div>
        </div>
        <div><FieldLabel>Date</FieldLabel><input type="date" value={occurredAt} onChange={(e) => setOccurredAt(e.target.value)} className={INPUT} /></div>
        <div><FieldLabel>Notes / défauts</FieldLabel><textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className={cn(INPUT, 'h-auto py-3 leading-relaxed')} /></div>
        <PrimaryPill onClick={handleSubmit} disabled={recordQc.isPending} loading={recordQc.isPending} type="button">Enregistrer l'inspection</PrimaryPill>
      </div>
    </div>
  );
}
