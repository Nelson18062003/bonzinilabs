import { useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Loader2, Plus, AlertTriangle } from 'lucide-react';
import { MobileHeader } from '@/mobile/components/layout/MobileHeader';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/form';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import {
  useCounterparties,
  useCreateCounterparty,
  useRecordUsdtSale,
  useTreasuryAccounts,
  useUsdtStock,
  useUsdtWac,
} from '@/hooks/useTreasury';

export function MobileNewSale() {
  const navigate = useNavigate();
  const { hasPermission } = useAdminAuth();
  const { data: buyers } = useCounterparties('cny_buyer');
  const { data: cnyAccounts } = useTreasuryAccounts('CNY');
  const { data: wac } = useUsdtWac();
  const { data: stock } = useUsdtStock();
  const create = useCreateCounterparty();
  const submit = useRecordUsdtSale();

  const [buyerId, setBuyerId] = useState('');
  const [cnyAccountId, setCnyAccountId] = useState('');
  const [usdtAmount, setUsdtAmount] = useState('');
  const [cnyAmount, setCnyAmount] = useState('');
  const [externalRef, setExternalRef] = useState('');
  const [notes, setNotes] = useState('');

  const [showNewBuyer, setShowNewBuyer] = useState(false);
  const [newName, setNewName] = useState('');
  const [newCompany, setNewCompany] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newWechat, setNewWechat] = useState('');

  const usdtNum = parseFloat(usdtAmount.replace(/\s/g, '')) || 0;
  const cnyNum = parseFloat(cnyAmount.replace(/\s/g, '')) || 0;
  const implicitRate = usdtNum > 0 ? cnyNum / usdtNum : 0;

  const costBasis = useMemo(() => (wac && usdtNum > 0 ? usdtNum * wac : null), [wac, usdtNum]);
  const stockAfter = stock !== undefined ? Number(stock) - usdtNum : null;
  const willGoNegative = stockAfter !== null && stockAfter < 0;

  if (!hasPermission('canManageTreasury')) {
    return <Navigate to="/m/more" replace />;
  }

  const valid = buyerId && cnyAccountId && usdtNum > 0 && cnyNum > 0;

  const handleSubmit = async () => {
    if (!valid) return;
    const result = await submit.mutateAsync({
      buyer_id: buyerId,
      cny_account_id: cnyAccountId,
      usdt_amount: usdtNum,
      cny_amount: cnyNum,
      external_ref: externalRef || undefined,
      notes: notes || undefined,
    });
    if (result.success) navigate('/m/more/treasury');
  };

  const handleCreateBuyer = async () => {
    if (!newName.trim()) return;
    const result = await create.mutateAsync({
      type: 'cny_buyer',
      display_name: newName.trim(),
      legal_name: newCompany.trim() || undefined,
      phone: newPhone.trim() || undefined,
      wechat_id: newWechat.trim() || undefined,
    });
    if (result.success && result.id) {
      setBuyerId(result.id);
      setShowNewBuyer(false);
      setNewName('');
      setNewCompany('');
      setNewPhone('');
      setNewWechat('');
    }
  };

  return (
    <div className="flex flex-col min-h-full bg-background">
      <MobileHeader title="Nouvelle vente USDT" showBack backTo="/m/more/treasury" />

      <div className="px-4 py-4 space-y-4">
        {/* Buyer */}
        <div>
          <label className="block text-[13px] font-semibold mb-1.5">Acheteur CNY *</label>
          <div className="flex gap-2">
            <select
              value={buyerId}
              onChange={(e) => setBuyerId(e.target.value)}
              className="flex-1 h-11 px-3 rounded-xl border border-border bg-white text-[15px]"
            >
              <option value="">Sélectionner…</option>
              {(buyers ?? []).map((b) => (
                <option key={b.id} value={b.id}>
                  {b.display_name}
                  {b.wechat_id ? ` · ${b.wechat_id}` : b.phone ? ` · ${b.phone}` : ''}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setShowNewBuyer((v) => !v)}
              className="h-11 w-11 rounded-xl border border-border bg-white flex items-center justify-center active:bg-muted/40"
              aria-label="Nouvel acheteur"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>
          {showNewBuyer && (
            <div className="mt-2 bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-2">
              <TextField label="Nom" value={newName} onChange={(e) => setNewName(e.target.value)} />
              <TextField label="Entreprise (optionnel)" value={newCompany} onChange={(e) => setNewCompany(e.target.value)} />
              <TextField label="Téléphone (optionnel)" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} />
              <TextField label="WeChat ID (optionnel)" value={newWechat} onChange={(e) => setNewWechat(e.target.value)} />
              <Button
                onClick={handleCreateBuyer}
                disabled={create.isPending || !newName.trim()}
                size="sm"
                className="w-full"
              >
                {create.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Créer'}
              </Button>
            </div>
          )}
        </div>

        {/* CNY account */}
        <div>
          <label className="block text-[13px] font-semibold mb-1.5">Compte CNY crédité *</label>
          <select
            value={cnyAccountId}
            onChange={(e) => setCnyAccountId(e.target.value)}
            className="w-full h-11 px-3 rounded-xl border border-border bg-white text-[15px]"
          >
            <option value="">Sélectionner…</option>
            {(cnyAccounts ?? []).map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
              </option>
            ))}
          </select>
        </div>

        {/* Amounts */}
        <div className="grid grid-cols-2 gap-3">
          <TextField
            label="USDT vendu *"
            variant="decimal"
            value={usdtAmount}
            onChange={(e) => setUsdtAmount(e.target.value)}
            placeholder="800"
          />
          <TextField
            label="CNY reçu *"
            variant="decimal"
            value={cnyAmount}
            onChange={(e) => setCnyAmount(e.target.value)}
            placeholder="5600"
          />
        </div>

        {/* Live feedback */}
        <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-3.5 space-y-1.5">
          <div className="flex items-center justify-between text-[13px]">
            <span className="text-muted-foreground">Taux implicite</span>
            <span className="font-bold">
              {implicitRate > 0 ? `${implicitRate.toLocaleString('fr-FR', { maximumFractionDigits: 4 })} CNY/USDT` : '—'}
            </span>
          </div>
          <div className="flex items-center justify-between text-[13px]">
            <span className="text-muted-foreground">WAC à utiliser</span>
            <span className="font-bold">
              {wac ? `${wac.toLocaleString('fr-FR', { maximumFractionDigits: 4 })} XAF/USDT` : '—'}
            </span>
          </div>
          <div className="flex items-center justify-between text-[13px]">
            <span className="text-muted-foreground">Coût sortie XAF</span>
            <span className="font-bold">
              {costBasis !== null ? `${costBasis.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} XAF` : '—'}
            </span>
          </div>
          <div className="flex items-center justify-between text-[13px] pt-1.5 border-t border-amber-200">
            <span className="text-muted-foreground">Stock USDT après</span>
            <span className={`font-bold ${willGoNegative ? 'text-red-600' : 'text-foreground'}`}>
              {stockAfter !== null ? stockAfter.toLocaleString('fr-FR', { maximumFractionDigits: 2 }) : '—'}
            </span>
          </div>
        </div>

        {willGoNegative && (
          <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
            <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
            <span className="text-[12px] text-red-700">
              Cette vente fera passer le stock USDT en négatif. L’opération est tout de même enregistrable
              (à régulariser par un achat manquant).
            </span>
          </div>
        )}

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

        <Button
          onClick={handleSubmit}
          disabled={!valid || submit.isPending}
          className="w-full h-12 text-base font-bold rounded-xl bg-amber-500 hover:bg-amber-600"
        >
          {submit.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Enregistrer la vente'}
        </Button>
      </div>
    </div>
  );
}
