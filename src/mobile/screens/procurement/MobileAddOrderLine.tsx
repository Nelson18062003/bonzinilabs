import { useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { MobileHeader } from '@/mobile/components/layout/MobileHeader';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { useAddOrderLine } from '@/hooks/useProcurement';
import { FieldLabel, PrimaryPill } from '@/components/treasury/ui';
import { cn } from '@/lib/utils';

const INPUT = 'h-[52px] w-full rounded-2xl bg-muted/60 px-4 text-[15px] text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-foreground/10';

export function MobileAddOrderLine() {
  const navigate = useNavigate();
  const { poId } = useParams<{ poId: string }>();
  const { hasPermission } = useAdminAuth();
  const addLine = useAddOrderLine();

  const [description, setDescription] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('');
  const [unitPrice, setUnitPrice] = useState('');
  const [moq, setMoq] = useState('');
  const [leadTime, setLeadTime] = useState('');
  const [hsCode, setHsCode] = useState('');

  if (!hasPermission('canManageProcurement') || !poId) {
    return <Navigate to="/m/more/procurement" replace />;
  }

  const lineTotal = (Number(quantity) || 0) * (Number(unitPrice) || 0);
  const canSubmit = description.trim().length > 0 && !addLine.isPending;

  const handleSubmit = async () => {
    try {
      await addLine.mutateAsync({
        p_purchase_order_id: poId,
        p_description: description.trim(),
        p_quantity: Number(quantity) || 0,
        p_unit: unit.trim() || null,
        p_unit_price: Number(unitPrice) || 0,
        p_moq: moq ? Number(moq) : null,
        p_lead_time_days: leadTime ? Number(leadTime) : null,
        p_hs_code: hsCode.trim() || null,
      });
      navigate(`/m/more/procurement/po/${poId}`, { replace: true });
    } catch { /* toast */ }
  };

  return (
    <div className="flex flex-col min-h-full bg-background">
      <MobileHeader title="Nouvelle ligne" showBack backTo={`/m/more/procurement/po/${poId}`} />

      <div className="px-5 py-6 space-y-5">
        <div>
          <FieldLabel>Description *</FieldLabel>
          <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Produit / SKU" className={INPUT} />
        </div>

        <div className="flex gap-3">
          <div className="flex-1"><FieldLabel>Quantité</FieldLabel><input value={quantity} onChange={(e) => setQuantity(e.target.value)} inputMode="decimal" placeholder="0" className={INPUT} /></div>
          <div className="w-28"><FieldLabel>Unité</FieldLabel><input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="pcs" className={INPUT} /></div>
        </div>

        <div className="flex gap-3">
          <div className="flex-1"><FieldLabel>Prix unitaire</FieldLabel><input value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} inputMode="decimal" placeholder="0" className={INPUT} /></div>
          <div className="flex-1"><FieldLabel>MOQ</FieldLabel><input value={moq} onChange={(e) => setMoq(e.target.value)} inputMode="decimal" className={INPUT} /></div>
        </div>

        <div className="flex gap-3">
          <div className="flex-1"><FieldLabel>Délai (jours)</FieldLabel><input value={leadTime} onChange={(e) => setLeadTime(e.target.value)} inputMode="numeric" className={INPUT} /></div>
          <div className="flex-1"><FieldLabel>Code HS</FieldLabel><input value={hsCode} onChange={(e) => setHsCode(e.target.value)} className={INPUT} /></div>
        </div>

        {lineTotal > 0 && (
          <div className="rounded-2xl bg-muted/60 px-4 py-3 text-center text-[13px] text-muted-foreground">
            Total ligne : <span className="font-bold tabular-nums text-foreground">{lineTotal.toLocaleString('fr-FR')}</span>
          </div>
        )}

        <PrimaryPill onClick={handleSubmit} disabled={!canSubmit} loading={addLine.isPending} type="button">
          Ajouter la ligne
        </PrimaryPill>
      </div>
    </div>
  );
}
