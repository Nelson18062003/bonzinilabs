import { useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Loader2, Plus, AlertTriangle } from 'lucide-react';
import { MobileHeader } from '@/mobile/components/layout/MobileHeader';
import { Button } from '@/components/ui/button';
import { AmountField, TextField } from '@/components/form';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import {
  useCounterparties,
  useCreateCounterparty,
  useRecordUsdtSale,
  useTreasuryAccounts,
  useUsdtStock,
  useUsdtWac,
} from '@/hooks/useTreasury';
import { cn } from '@/lib/utils';

type InputMode = 'usdt_cny' | 'usdt_rate' | 'cny_rate';

const MODES: { value: InputMode; label: string; hint: string }[] = [
  { value: 'usdt_cny', label: 'USDT + CNY', hint: 'Taux calculé' },
  { value: 'usdt_rate', label: 'USDT + taux', hint: 'CNY calculé' },
  { value: 'cny_rate', label: 'CNY + taux', hint: 'USDT calculé' },
];

function fmt(n: number | null, decimals = 2): string {
  if (n === null || !Number.isFinite(n)) return '—';
  return n.toLocaleString('fr-FR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

export function MobileNewSale() {
  const navigate = useNavigate();
  const { hasPermission } = useAdminAuth();
  const { data: buyers } = useCounterparties('cny_buyer');
  const { data: cnyAccounts } = useTreasuryAccounts('CNY');
  const { data: wac } = useUsdtWac();
  const { data: stock } = useUsdtStock();
  const create = useCreateCounterparty();
  const submit = useRecordUsdtSale();

  const [mode, setMode] = useState<InputMode>('usdt_cny');
  const [buyerId, setBuyerId] = useState('');
  const [cnyAccountId, setCnyAccountId] = useState('');
  const [usdtAmount, setUsdtAmount] = useState<number | null>(null);
  const [cnyAmount, setCnyAmount] = useState<number | null>(null);
  const [rate, setRate] = useState<number | null>(null);
  const [externalRef, setExternalRef] = useState('');
  const [notes, setNotes] = useState('');

  const [showNewBuyer, setShowNewBuyer] = useState(false);
  const [newName, setNewName] = useState('');
  const [newCompany, setNewCompany] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newWechat, setNewWechat] = useState('');

  const resolved = useMemo(() => {
    if (mode === 'usdt_cny') {
      const r = usdtAmount && cnyAmount && usdtAmount > 0 ? cnyAmount / usdtAmount : null;
      return { usdt: usdtAmount, cny: cnyAmount, rate: r };
    }
    if (mode === 'usdt_rate') {
      const c = usdtAmount && rate && rate > 0 ? usdtAmount * rate : null;
      return { usdt: usdtAmount, cny: c, rate };
    }
    const u = cnyAmount && rate && rate > 0 ? cnyAmount / rate : null;
    return { usdt: u, cny: cnyAmount, rate };
  }, [mode, usdtAmount, cnyAmount, rate]);

  if (!hasPermission('canManageTreasury')) {
    return <Navigate to="/m/more" replace />;
  }

  const costBasis = wac && resolved.usdt ? resolved.usdt * wac : null;
  const stockAfter = stock !== undefined && resolved.usdt !== null ? Number(stock) - resolved.usdt : null;
  const willGoNegative = stockAfter !== null && stockAfter < 0;

  const valid =
    !!buyerId &&
    !!cnyAccountId &&
    resolved.usdt !== null && resolved.usdt > 0 &&
    resolved.cny !== null && resolved.cny > 0;

  const handleSubmit = async () => {
    if (!valid || resolved.usdt === null || resolved.cny === null) return;
    const result = await submit.mutateAsync({
      buyer_id: buyerId,
      cny_account_id: cnyAccountId,
      usdt_amount: resolved.usdt,
      cny_amount: resolved.cny,
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
              <Button onClick={handleCreateBuyer} disabled={create.isPending || !newName.trim()} size="sm" className="w-full">
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

        {/* Mode toggle */}
        <div>
          <label className="block text-[13px] font-semibold mb-1.5">Mode de saisie</label>
          <div className="grid grid-cols-3 gap-1.5">
            {MODES.map((m) => (
              <button
                key={m.value}
                onClick={() => setMode(m.value)}
                className={cn(
                  'h-12 rounded-xl text-[11px] font-semibold border-2 transition-colors flex flex-col items-center justify-center px-1',
                  mode === m.value
                    ? 'border-amber-500 bg-amber-50 text-amber-700'
                    : 'border-border bg-white text-muted-foreground',
                )}
              >
                <span>{m.label}</span>
                <span className="text-[10px] opacity-70 font-normal">{m.hint}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Inputs */}
        <div className="space-y-3">
          {(mode === 'usdt_cny' || mode === 'usdt_rate') && (
            <AmountField
              label="USDT vendu *"
              currency="USDT"
              value={usdtAmount}
              onValueChange={setUsdtAmount}
              allowDecimal
              decimals={4}
              max={null}
            />
          )}
          {(mode === 'usdt_cny' || mode === 'cny_rate') && (
            <AmountField
              label="CNY reçu *"
              currency="CNY"
              value={cnyAmount}
              onValueChange={setCnyAmount}
              allowDecimal
              decimals={2}
              max={null}
            />
          )}
          {(mode === 'usdt_rate' || mode === 'cny_rate') && (
            <AmountField
              label="Taux *"
              currency="CNY/USDT"
              value={rate}
              onValueChange={setRate}
              allowDecimal
              decimals={4}
              max={null}
            />
          )}

          {mode === 'usdt_rate' && (
            <ComputedRow label="CNY reçu (calculé)" value={resolved.cny} unit="CNY" decimals={2} />
          )}
          {mode === 'cny_rate' && (
            <ComputedRow label="USDT vendu (calculé)" value={resolved.usdt} unit="USDT" decimals={4} />
          )}
          {mode === 'usdt_cny' && (
            <ComputedRow label="Taux implicite" value={resolved.rate} unit="CNY/USDT" decimals={4} />
          )}
        </div>

        {/* WAC & stock summary */}
        <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-3.5 space-y-1.5">
          <div className="flex items-center justify-between text-[13px]">
            <span className="text-muted-foreground">WAC à utiliser</span>
            <span className="font-bold">{wac ? `${fmt(wac, 4)} XAF/USDT` : '—'}</span>
          </div>
          <div className="flex items-center justify-between text-[13px]">
            <span className="text-muted-foreground">Coût sortie XAF</span>
            <span className="font-bold">{costBasis !== null ? `${fmt(costBasis, 0)} XAF` : '—'}</span>
          </div>
          <div className="flex items-center justify-between text-[13px] pt-1.5 border-t border-amber-200">
            <span className="text-muted-foreground">Stock USDT après</span>
            <span className={`font-bold ${willGoNegative ? 'text-red-600' : 'text-foreground'}`}>
              {stockAfter !== null ? fmt(stockAfter, 4) : '—'}
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
        <TextField label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />

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

function ComputedRow({
  label,
  value,
  unit,
  decimals,
}: {
  label: string;
  value: number | null;
  unit: string;
  decimals: number;
}) {
  return (
    <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-3.5 py-3 flex items-center justify-between">
      <span className="text-[12px] font-semibold text-emerald-700 uppercase tracking-wide">{label}</span>
      <span className="font-bold tabular-nums text-emerald-900">
        {fmt(value, decimals)} <span className="text-[11px] text-emerald-700 font-normal">{unit}</span>
      </span>
    </div>
  );
}
