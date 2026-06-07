import { useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { MobileHeader } from '@/mobile/components/layout/MobileHeader';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { usePurchaseOrder, useSetCommission } from '@/hooks/useProcurement';
import type { ProcCommissionMode, ProcCurrency } from '@/integrations/supabase/procurement';
import { FieldLabel, Pill, PrimaryPill, SOFT_CARD } from '@/components/treasury/ui';
import { cn } from '@/lib/utils';

const INPUT = 'h-[52px] w-full rounded-2xl bg-muted/60 px-4 text-[15px] text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-foreground/10';

export function MobileSetCommission() {
  const navigate = useNavigate();
  const { poId, missionId } = useParams<{ poId?: string; missionId?: string }>();
  const { hasPermission } = useAdminAuth();
  const setCommission = useSetCommission();
  const { data: poData } = usePurchaseOrder(poId);

  const po = poData?.purchase_order;
  const resolvedMissionId = missionId ?? po?.mission.id;

  const [mode, setMode] = useState<ProcCommissionMode>('percentage');
  const [value, setValue] = useState('');
  const [base, setBase] = useState('');
  const [factoryCost, setFactoryCost] = useState('');
  const [clientPrice, setClientPrice] = useState('');
  const [discount, setDiscount] = useState('');
  const [clientVisible, setClientVisible] = useState(false);
  const [currency, setCurrency] = useState<ProcCurrency>('CNY');
  const [notes, setNotes] = useState('');

  if (!hasPermission('canManageProcurement') || (!poId && !missionId)) {
    return <Navigate to="/m/more/procurement" replace />;
  }

  // Base par défaut = total de la commande (au niveau PO).
  const baseNum = Number(base) || (po ? po.total_amount : 0);
  const valNum = Number(value) || 0;
  const computedAmount = mode === 'percentage' ? (baseNum * valNum) / 100 : valNum;
  const computedPct = mode === 'fixed_amount' ? (baseNum > 0 ? (valNum / baseNum) * 100 : 0) : valNum;
  const effectiveCurrency = po && currency === 'CNY' && po.currency !== 'CNY' ? po.currency : currency;
  const backTo = poId ? `/m/more/procurement/po/${poId}` : `/m/more/procurement/missions/${missionId}`;

  const handleSubmit = async () => {
    if (!resolvedMissionId) return;
    try {
      await setCommission.mutateAsync({
        p_mission_id: resolvedMissionId,
        p_purchase_order_id: poId ?? null,
        p_input_mode: mode,
        p_input_value: valNum,
        p_base_amount: baseNum,
        p_factory_cost: factoryCost ? Number(factoryCost) : null,
        p_client_price: clientPrice ? Number(clientPrice) : null,
        p_negotiated_discount: discount ? Number(discount) : null,
        p_client_visible: clientVisible,
        p_currency: effectiveCurrency,
        p_notes: notes.trim() || null,
      });
      navigate(backTo, { replace: true });
    } catch { /* toast */ }
  };

  return (
    <div className="flex flex-col min-h-full bg-background">
      <MobileHeader title="Commission Bonzini" showBack backTo={backTo} />
      <div className="px-5 py-6 space-y-5">
        <div>
          <FieldLabel>Mode</FieldLabel>
          <div className="flex gap-2">
            <Pill active={mode === 'percentage'} onClick={() => setMode('percentage')}>Pourcentage</Pill>
            <Pill active={mode === 'fixed_amount'} onClick={() => setMode('fixed_amount')}>Montant fixe</Pill>
          </div>
        </div>

        <div className="flex gap-3">
          <div className="flex-1">
            <FieldLabel>{mode === 'percentage' ? 'Pourcentage (%)' : 'Montant'}</FieldLabel>
            <input value={value} onChange={(e) => setValue(e.target.value)} inputMode="decimal" placeholder="0" className={INPUT} />
          </div>
          <div className="flex-1">
            <FieldLabel>Base de calcul</FieldLabel>
            <input value={base} onChange={(e) => setBase(e.target.value)} inputMode="decimal" placeholder={po ? String(po.total_amount) : '0'} className={INPUT} />
          </div>
        </div>

        <div className={cn(SOFT_CARD, 'flex items-center justify-between p-3.5')}>
          <span className="text-[12px] text-muted-foreground">Commission calculée</span>
          <span className="text-[15px] font-extrabold tabular-nums text-bonzini-violet">
            {computedAmount.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} {effectiveCurrency}
            <span className="ml-1 text-[12px] font-medium text-muted-foreground">({computedPct.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} %)</span>
          </span>
        </div>

        <details className="rounded-2xl bg-muted/40 p-3.5">
          <summary className="cursor-pointer text-[13px] font-semibold text-foreground">Marge interne (optionnel)</summary>
          <div className="mt-3 space-y-3">
            <div className="flex gap-3">
              <div className="flex-1"><FieldLabel>Coût usine</FieldLabel><input value={factoryCost} onChange={(e) => setFactoryCost(e.target.value)} inputMode="decimal" className={INPUT} /></div>
              <div className="flex-1"><FieldLabel>Prix client</FieldLabel><input value={clientPrice} onChange={(e) => setClientPrice(e.target.value)} inputMode="decimal" className={INPUT} /></div>
            </div>
            <div><FieldLabel>Remise négociée</FieldLabel><input value={discount} onChange={(e) => setDiscount(e.target.value)} inputMode="decimal" className={INPUT} /></div>
          </div>
        </details>

        <div className="flex gap-3">
          <div className="flex-1">
            <FieldLabel>Devise</FieldLabel>
            <div className="flex gap-2">
              <Pill active={effectiveCurrency === 'CNY'} onClick={() => setCurrency('CNY')}>CNY</Pill>
              <Pill active={effectiveCurrency === 'XAF'} onClick={() => setCurrency('XAF')}>XAF</Pill>
            </div>
          </div>
          <button onClick={() => setClientVisible((v) => !v)} type="button"
            className={cn('flex h-[52px] flex-1 items-center justify-center gap-2 self-end rounded-2xl text-[13px] font-semibold transition',
              clientVisible ? 'bg-bonzini-violet/15 text-bonzini-violet' : 'bg-muted/60 text-muted-foreground')}>
            {clientVisible ? 'Visible client ✓' : 'Masquée au client'}
          </button>
        </div>

        <div><FieldLabel>Notes</FieldLabel><textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={cn(INPUT, 'h-auto py-3 leading-relaxed')} /></div>

        <PrimaryPill onClick={handleSubmit} disabled={valNum <= 0 || setCommission.isPending} loading={setCommission.isPending} type="button">
          Enregistrer la commission
        </PrimaryPill>
      </div>
    </div>
  );
}
