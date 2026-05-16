import { useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Loader2, Plus } from 'lucide-react';
import { MobileHeader } from '@/mobile/components/layout/MobileHeader';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/form';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import {
  useCounterparties,
  useCreateCounterparty,
  useRecordUsdtPurchase,
  useTreasuryAccounts,
  useUsdtWac,
} from '@/hooks/useTreasury';
import type { Database } from '@/integrations/supabase/types';
import { cn } from '@/lib/utils';

type ChannelXaf = Database['public']['Enums']['treasury_channel_xaf'];

const CHANNELS: { value: ChannelXaf; label: string }[] = [
  { value: 'bank_transfer', label: 'Virement' },
  { value: 'mobile_money', label: 'Mobile Money' },
  { value: 'cash', label: 'Cash' },
  { value: 'other', label: 'Autre' },
];

export function MobileNewPurchase() {
  const navigate = useNavigate();
  const { hasPermission } = useAdminAuth();
  const { data: suppliers } = useCounterparties('usdt_supplier');
  const { data: xafAccounts } = useTreasuryAccounts('XAF');
  const { data: wac } = useUsdtWac();
  const create = useCreateCounterparty();
  const submit = useRecordUsdtPurchase();

  const [supplierId, setSupplierId] = useState('');
  const [accountId, setAccountId] = useState('');
  const [channel, setChannel] = useState<ChannelXaf>('bank_transfer');
  const [xafAmount, setXafAmount] = useState('');
  const [usdtAmount, setUsdtAmount] = useState('');
  const [externalRef, setExternalRef] = useState('');
  const [notes, setNotes] = useState('');

  // Inline new-supplier popover
  const [showNewSupplier, setShowNewSupplier] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');

  const xafNum = parseFloat(xafAmount.replace(/\s/g, '')) || 0;
  const usdtNum = parseFloat(usdtAmount.replace(/\s/g, '')) || 0;
  const implicitRate = usdtNum > 0 ? xafNum / usdtNum : 0;

  const wacAfter = useMemo(() => {
    if (!wac || usdtNum <= 0 || xafNum <= 0) return null;
    return wac; // We don't know prior stock; show informational rate only.
  }, [wac, usdtNum, xafNum]);

  if (!hasPermission('canManageTreasury')) {
    return <Navigate to="/m/more" replace />;
  }

  const valid = supplierId && accountId && xafNum > 0 && usdtNum > 0;

  const handleSubmit = async () => {
    if (!valid) return;
    const result = await submit.mutateAsync({
      supplier_id: supplierId,
      xaf_account_id: accountId,
      xaf_amount: xafNum,
      usdt_amount: usdtNum,
      channel,
      external_ref: externalRef || undefined,
      notes: notes || undefined,
    });
    if (result.success) navigate('/m/more/treasury');
  };

  const handleCreateSupplier = async () => {
    if (!newName.trim()) return;
    const result = await create.mutateAsync({
      type: 'usdt_supplier',
      display_name: newName.trim(),
      phone: newPhone.trim() || undefined,
    });
    if (result.success && result.id) {
      setSupplierId(result.id);
      setShowNewSupplier(false);
      setNewName('');
      setNewPhone('');
    }
  };

  return (
    <div className="flex flex-col min-h-full bg-background">
      <MobileHeader title="Nouvel achat USDT" showBack backTo="/m/more/treasury" />

      <div className="px-4 py-4 space-y-4">
        {/* Supplier */}
        <div>
          <label className="block text-[13px] font-semibold mb-1.5">Fournisseur USDT *</label>
          <div className="flex gap-2">
            <select
              value={supplierId}
              onChange={(e) => setSupplierId(e.target.value)}
              className="flex-1 h-11 px-3 rounded-xl border border-border bg-white text-[15px]"
            >
              <option value="">Sélectionner…</option>
              {(suppliers ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.display_name}
                  {s.phone ? ` · ${s.phone}` : ''}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setShowNewSupplier((v) => !v)}
              className="h-11 w-11 rounded-xl border border-border bg-white flex items-center justify-center active:bg-muted/40"
              aria-label="Nouveau fournisseur"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>
          {showNewSupplier && (
            <div className="mt-2 bg-violet-50 border border-violet-200 rounded-xl p-3 space-y-2">
              <TextField
                label="Nom fournisseur"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
              <TextField
                label="Téléphone (optionnel)"
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
              />
              <Button
                onClick={handleCreateSupplier}
                disabled={create.isPending || !newName.trim()}
                size="sm"
                className="w-full"
              >
                {create.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Créer'}
              </Button>
            </div>
          )}
        </div>

        {/* Channel */}
        <div>
          <label className="block text-[13px] font-semibold mb-1.5">Canal de paiement XAF *</label>
          <div className="grid grid-cols-4 gap-1.5">
            {CHANNELS.map((c) => (
              <button
                key={c.value}
                onClick={() => setChannel(c.value)}
                className={cn(
                  'h-10 rounded-xl text-[12px] font-semibold border-2 transition-colors',
                  channel === c.value
                    ? 'border-violet-600 bg-violet-50 text-violet-700'
                    : 'border-border bg-white text-muted-foreground',
                )}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        {/* XAF account */}
        <div>
          <label className="block text-[13px] font-semibold mb-1.5">Compte XAF débité *</label>
          <select
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            className="w-full h-11 px-3 rounded-xl border border-border bg-white text-[15px]"
          >
            <option value="">Sélectionner…</option>
            {(xafAccounts ?? []).map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
              </option>
            ))}
          </select>
        </div>

        {/* Amounts */}
        <div className="grid grid-cols-2 gap-3">
          <TextField
            label="XAF payé *"
            variant="decimal"
            value={xafAmount}
            onChange={(e) => setXafAmount(e.target.value)}
            placeholder="625000"
          />
          <TextField
            label="USDT reçu *"
            variant="decimal"
            value={usdtAmount}
            onChange={(e) => setUsdtAmount(e.target.value)}
            placeholder="1000"
          />
        </div>

        {/* Computed feedback */}
        <div className="bg-gradient-to-br from-amber-50 to-violet-50 border border-amber-200 rounded-2xl p-3.5">
          <div className="flex items-center justify-between text-[13px] mb-1">
            <span className="text-muted-foreground">Taux implicite</span>
            <span className="font-bold">
              {implicitRate > 0 ? `${implicitRate.toLocaleString('fr-FR', { maximumFractionDigits: 4 })} XAF/USDT` : '—'}
            </span>
          </div>
          <div className="flex items-center justify-between text-[13px]">
            <span className="text-muted-foreground">WAC actuel</span>
            <span className="font-bold">
              {wacAfter !== null ? `${wacAfter.toLocaleString('fr-FR', { maximumFractionDigits: 4 })} XAF/USDT` : '—'}
            </span>
          </div>
        </div>

        {/* Optional fields */}
        <TextField
          label="Référence externe (Binance, hash…)"
          value={externalRef}
          onChange={(e) => setExternalRef(e.target.value)}
        />
        <TextField
          label="Notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />

        {/* Submit */}
        <Button
          onClick={handleSubmit}
          disabled={!valid || submit.isPending}
          className="w-full h-12 text-base font-bold rounded-xl bg-violet-600 hover:bg-violet-700"
        >
          {submit.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Enregistrer l’achat'}
        </Button>
      </div>
    </div>
  );
}
