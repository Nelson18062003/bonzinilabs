import { useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { Search, Check, X, Plus } from 'lucide-react';
import { MobileHeader } from '@/mobile/components/layout/MobileHeader';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { useSuppliers, useCreatePurchaseOrder, useUpsertSupplier } from '@/hooks/useProcurement';
import type { ProcCurrency, ProcIncoterm } from '@/integrations/supabase/procurement';
import { FieldLabel, Pill, PrimaryPill, SOFT_CARD } from '@/components/treasury/ui';
import { PROC_INPUT as INPUT } from './shared';
import { cn } from '@/lib/utils';

const INCOTERMS: ProcIncoterm[] = ['EXW', 'FCA', 'FAS', 'FOB', 'CFR', 'CIF', 'CPT', 'CIP', 'DAP', 'DPU', 'DDP'];

export function MobileNewPurchaseOrder() {
  const navigate = useNavigate();
  const { missionId } = useParams<{ missionId: string }>();
  const { hasPermission } = useAdminAuth();
  const createPo = useCreatePurchaseOrder();
  const upsertSupplier = useUpsertSupplier();

  const [search, setSearch] = useState('');
  const [supplier, setSupplier] = useState<{ id: string; name: string } | null>(null);
  const { data: supData } = useSuppliers(search);

  const [currency, setCurrency] = useState<ProcCurrency>('CNY');
  const [total, setTotal] = useState('');
  const [deposit, setDeposit] = useState('30');
  const [incoterm, setIncoterm] = useState<ProcIncoterm | ''>('');
  const [readyDate, setReadyDate] = useState('');
  const [notes, setNotes] = useState('');

  if (!hasPermission('canManageProcurement') || !missionId) {
    return <Navigate to="/m/more/procurement" replace />;
  }

  const suppliers = supData?.suppliers ?? [];
  const exactMatch = suppliers.some((s) => s.display_name.toLowerCase() === search.trim().toLowerCase());
  const canSubmit = !!supplier && !createPo.isPending;

  const quickCreate = async () => {
    try {
      const r = await upsertSupplier.mutateAsync({ p_display_name: search.trim() });
      setSupplier({ id: r.supplier_id, name: search.trim() });
      setSearch('');
    } catch { /* toast */ }
  };

  const handleSubmit = async () => {
    if (!supplier) return;
    try {
      const r = await createPo.mutateAsync({
        p_mission_id: missionId,
        p_supplier_id: supplier.id,
        p_currency: currency,
        p_total_amount: Number(total) || 0,
        p_deposit_pct: Number(deposit) || 0,
        p_incoterm: incoterm || null,
        p_expected_ready_date: readyDate || null,
        p_notes: notes.trim() || null,
      });
      navigate(`/m/more/procurement/po/${r.purchase_order_id}`, { replace: true });
    } catch { /* toast */ }
  };

  return (
    <div className="flex flex-col min-h-full bg-background">
      <MobileHeader title="Nouvelle commande" showBack backTo={`/m/more/procurement/missions/${missionId}`} />

      <div className="px-5 py-6 space-y-5">
        {/* Fournisseur */}
        <div>
          <FieldLabel>Fournisseur *</FieldLabel>
          {supplier ? (
            <div className={cn(SOFT_CARD, 'flex items-center gap-3 p-3.5')}>
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-bonzini-violet/15 text-bonzini-violet"><Check className="h-4 w-4" /></div>
              <div className="min-w-0 flex-1 truncate text-[14px] font-semibold text-foreground">{supplier.name}</div>
              <button onClick={() => setSupplier(null)} aria-label="Changer" className="text-muted-foreground active:opacity-70"><X className="h-5 w-5" /></button>
            </div>
          ) : (
            <>
              <div className="relative">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher un fournisseur…" className={cn(INPUT, 'pl-11')} />
              </div>
              {search.trim().length >= 2 && (
                <div className={cn(SOFT_CARD, 'mt-2 max-h-56 divide-y divide-border overflow-y-auto')}>
                  {suppliers.map((s) => (
                    <button key={s.id} onClick={() => { setSupplier({ id: s.id, name: s.display_name }); setSearch(''); }}
                      className="flex w-full items-center justify-between p-3.5 text-left active:bg-muted/50">
                      <span className="truncate text-[14px] font-medium text-foreground">{s.display_name}</span>
                      {s.city && <span className="ml-3 shrink-0 text-[12px] text-muted-foreground">{s.city}</span>}
                    </button>
                  ))}
                  {!exactMatch && (
                    <button onClick={quickCreate} disabled={upsertSupplier.isPending}
                      className="flex w-full items-center gap-2 p-3.5 text-left text-bonzini-violet active:bg-muted/50">
                      <Plus className="h-4 w-4" /> <span className="text-[14px] font-semibold">Créer « {search.trim()} »</span>
                    </button>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Devise */}
        <div>
          <FieldLabel>Devise</FieldLabel>
          <div className="flex gap-2">
            <Pill active={currency === 'CNY'} onClick={() => setCurrency('CNY')}>CNY (¥)</Pill>
            <Pill active={currency === 'XAF'} onClick={() => setCurrency('XAF')}>XAF</Pill>
          </div>
        </div>

        {/* Montants */}
        <div className="flex gap-3">
          <div className="flex-1">
            <FieldLabel>Montant total</FieldLabel>
            <input value={total} onChange={(e) => setTotal(e.target.value)} inputMode="decimal" placeholder="0" className={INPUT} />
          </div>
          <div className="w-28">
            <FieldLabel>Acompte %</FieldLabel>
            <input value={deposit} onChange={(e) => setDeposit(e.target.value)} inputMode="decimal" className={INPUT} />
          </div>
        </div>

        {/* Incoterm */}
        <div>
          <FieldLabel>Incoterm</FieldLabel>
          <select value={incoterm} onChange={(e) => setIncoterm(e.target.value as ProcIncoterm | '')} className={INPUT}>
            <option value="">—</option>
            {INCOTERMS.map((i) => <option key={i} value={i}>{i}</option>)}
          </select>
        </div>

        {/* Date prévue + notes */}
        <div>
          <FieldLabel>Date de disponibilité prévue</FieldLabel>
          <input type="date" value={readyDate} onChange={(e) => setReadyDate(e.target.value)} className={INPUT} />
        </div>
        <div>
          <FieldLabel>Notes</FieldLabel>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={cn(INPUT, 'h-auto py-3 leading-relaxed')} />
        </div>

        <PrimaryPill onClick={handleSubmit} disabled={!canSubmit} loading={createPo.isPending} type="button">
          Créer la commande
        </PrimaryPill>
      </div>
    </div>
  );
}
