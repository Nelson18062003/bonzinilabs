import { useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { MobileHeader } from '@/mobile/components/layout/MobileHeader';
import { Button } from '@/components/ui/button';
import { AmountField, OccurredAtField, PhoneInputWithCountry, TextField } from '@/components/form';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import {
  useCounterparties,
  useCreateCounterparty,
  useRecordUsdtPurchase,
  useTreasuryAccounts,
  useUsdtWac,
  type AccountSplit,
} from '@/hooks/useTreasury';
import { cn } from '@/lib/utils';

type InputMode = 'xaf_usdt' | 'xaf_rate' | 'usdt_rate';
type AccountMode = 'single' | 'multi';

interface SplitRow {
  key: string;
  accountId: string;
  amount: number | null;
}

const MODES: { value: InputMode; label: string; hint: string }[] = [
  { value: 'xaf_usdt', label: 'XAF + USDT', hint: 'Taux calculé' },
  { value: 'xaf_rate', label: 'XAF + taux', hint: 'USDT calculé' },
  { value: 'usdt_rate', label: 'USDT + taux', hint: 'XAF calculé' },
];

function fmt(n: number | null, decimals = 2): string {
  if (n === null || !Number.isFinite(n)) return '—';
  return n.toLocaleString('fr-FR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

let splitKeyCounter = 0;
const newSplit = (): SplitRow => ({ key: `s${splitKeyCounter++}`, accountId: '', amount: null });

export function MobileNewPurchase() {
  const navigate = useNavigate();
  const { hasPermission } = useAdminAuth();
  const { data: suppliers } = useCounterparties('usdt_supplier');
  const { data: xafAccounts } = useTreasuryAccounts('XAF');
  const { data: wac } = useUsdtWac();
  const create = useCreateCounterparty();
  const submit = useRecordUsdtPurchase();

  const [mode, setMode] = useState<InputMode>('xaf_usdt');
  const [supplierId, setSupplierId] = useState('');
  const [accountMode, setAccountMode] = useState<AccountMode>('single');
  const [singleAccountId, setSingleAccountId] = useState('');
  const [splits, setSplits] = useState<SplitRow[]>([newSplit()]);
  const [occurredAt, setOccurredAt] = useState<string>(() => new Date().toISOString());
  const [xafAmount, setXafAmount] = useState<number | null>(null);
  const [usdtAmount, setUsdtAmount] = useState<number | null>(null);
  const [rate, setRate] = useState<number | null>(null);
  const [externalRef, setExternalRef] = useState('');
  const [notes, setNotes] = useState('');

  const [showNewSupplier, setShowNewSupplier] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState<string | null>(null);

  // Resolve XAF / USDT / rate from the 2 typed inputs (same logic single & multi).
  const resolved = useMemo(() => {
    if (mode === 'xaf_usdt') {
      const r = xafAmount && usdtAmount && usdtAmount > 0 ? xafAmount / usdtAmount : null;
      return { xaf: xafAmount, usdt: usdtAmount, rate: r };
    }
    if (mode === 'xaf_rate') {
      const u = xafAmount && rate && rate > 0 ? xafAmount / rate : null;
      return { xaf: xafAmount, usdt: u, rate };
    }
    const x = usdtAmount && rate && rate > 0 ? usdtAmount * rate : null;
    return { xaf: x, usdt: usdtAmount, rate };
  }, [mode, xafAmount, usdtAmount, rate]);

  const allocated = useMemo(
    () => splits.reduce((s, r) => s + (r.amount ?? 0), 0),
    [splits],
  );
  const remaining = (resolved.xaf ?? 0) - allocated;
  const allocationOk = resolved.xaf !== null && Math.abs(remaining) < 1; // 1 XAF tolerance

  if (!hasPermission('canManageTreasury')) {
    return <Navigate to="/m/more" replace />;
  }

  const valid =
    !!supplierId &&
    resolved.xaf !== null && resolved.xaf > 0 &&
    resolved.usdt !== null && resolved.usdt > 0 &&
    (accountMode === 'single'
      ? !!singleAccountId
      : allocationOk && splits.every((r) => r.accountId && (r.amount ?? 0) > 0));

  const handleSubmit = async () => {
    if (!valid || resolved.xaf === null || resolved.usdt === null) return;
    const accountSplits: AccountSplit[] =
      accountMode === 'single'
        ? [{ account_id: singleAccountId, xaf_amount: resolved.xaf }]
        : splits.map((r) => ({ account_id: r.accountId, xaf_amount: r.amount ?? 0 }));

    const result = await submit.mutateAsync({
      supplier_id: supplierId,
      usdt_amount: resolved.usdt,
      account_splits: accountSplits,
      occurred_at: occurredAt,
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
      phone: newPhone ?? undefined,
    });
    if (result.success && result.id) {
      setSupplierId(result.id);
      setShowNewSupplier(false);
      setNewName('');
      setNewPhone(null);
    }
  };

  const updateSplit = (key: string, patch: Partial<SplitRow>) =>
    setSplits((rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));

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
                  {s.short_id} · {s.display_name}
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
              <TextField label="Nom fournisseur" value={newName} onChange={(e) => setNewName(e.target.value)} />
              <PhoneInputWithCountry
                label="Téléphone (optionnel)"
                value={newPhone}
                onValueChange={setNewPhone}
                defaultDialCode="+237"
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

        {/* Date / heure */}
        <OccurredAtField value={occurredAt} onChange={setOccurredAt} />

        {/* Mode de saisie (montants) */}
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
                    ? 'border-violet-600 bg-violet-50 text-violet-700'
                    : 'border-border bg-white text-muted-foreground',
                )}
              >
                <span>{m.label}</span>
                <span className="text-[10px] opacity-70 font-normal">{m.hint}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Amount inputs */}
        <div className="space-y-3">
          {(mode === 'xaf_usdt' || mode === 'xaf_rate') && (
            <AmountField label="XAF payé *" currency="XAF" value={xafAmount} onValueChange={setXafAmount} allowDecimal decimals={0} max={null} />
          )}
          {(mode === 'xaf_usdt' || mode === 'usdt_rate') && (
            <AmountField label="USDT reçu *" currency="USDT" value={usdtAmount} onValueChange={setUsdtAmount} allowDecimal decimals={4} max={null} />
          )}
          {(mode === 'xaf_rate' || mode === 'usdt_rate') && (
            <AmountField label="Taux *" currency="XAF/USDT" value={rate} onValueChange={setRate} allowDecimal decimals={4} max={null} />
          )}

          {mode === 'xaf_rate' && <ComputedRow label="USDT reçu (calculé)" value={resolved.usdt} unit="USDT" decimals={4} />}
          {mode === 'usdt_rate' && <ComputedRow label="XAF payé (calculé)" value={resolved.xaf} unit="XAF" decimals={0} />}
          {mode === 'xaf_usdt' && <ComputedRow label="Taux implicite" value={resolved.rate} unit="XAF/USDT" decimals={4} />}
        </div>

        {/* Account mode toggle */}
        <div>
          <label className="block text-[13px] font-semibold mb-1.5">Compte(s) XAF débité(s) *</label>
          <div className="grid grid-cols-2 gap-1.5 mb-2">
            <button
              onClick={() => setAccountMode('single')}
              className={cn(
                'h-10 rounded-xl text-[13px] font-semibold border-2 transition-colors',
                accountMode === 'single'
                  ? 'border-violet-600 bg-violet-50 text-violet-700'
                  : 'border-border bg-white text-muted-foreground',
              )}
            >
              Compte unique
            </button>
            <button
              onClick={() => setAccountMode('multi')}
              className={cn(
                'h-10 rounded-xl text-[13px] font-semibold border-2 transition-colors',
                accountMode === 'multi'
                  ? 'border-violet-600 bg-violet-50 text-violet-700'
                  : 'border-border bg-white text-muted-foreground',
              )}
            >
              Multi-comptes
            </button>
          </div>

          {accountMode === 'single' ? (
            <select
              value={singleAccountId}
              onChange={(e) => setSingleAccountId(e.target.value)}
              className="w-full h-11 px-3 rounded-xl border border-border bg-white text-[15px]"
            >
              <option value="">Sélectionner…</option>
              {(xafAccounts ?? []).map((a) => (
                <option key={a.id} value={a.id}>{a.label}</option>
              ))}
            </select>
          ) : (
            <div className="space-y-2">
              {splits.map((row) => (
                <div key={row.key} className="flex gap-2 items-start">
                  <select
                    value={row.accountId}
                    onChange={(e) => updateSplit(row.key, { accountId: e.target.value })}
                    className="flex-1 h-11 px-2 rounded-xl border border-border bg-white text-[14px]"
                  >
                    <option value="">Compte…</option>
                    {(xafAccounts ?? []).map((a) => (
                      <option key={a.id} value={a.id}>{a.label}</option>
                    ))}
                  </select>
                  <div className="w-[120px]">
                    <AmountField
                      currency="XAF"
                      value={row.amount}
                      onValueChange={(v) => updateSplit(row.key, { amount: v })}
                      allowDecimal
                      decimals={0}
                      max={null}
                    />
                  </div>
                  {splits.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setSplits((rows) => rows.filter((r) => r.key !== row.key))}
                      className="h-11 w-9 flex items-center justify-center text-red-600 flex-shrink-0"
                      aria-label="Retirer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={() => setSplits((rows) => [...rows, newSplit()])}
                className="w-full h-10 rounded-xl border-2 border-dashed border-border text-[13px] font-semibold text-muted-foreground flex items-center justify-center gap-1.5 active:bg-muted/40"
              >
                <Plus className="w-4 h-4" />
                Ajouter un compte
              </button>

              {/* Allocation status */}
              <div
                className={cn(
                  'rounded-xl px-3 py-2.5 text-[12px] font-semibold flex items-center justify-between',
                  resolved.xaf === null
                    ? 'bg-muted text-muted-foreground'
                    : allocationOk
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-red-50 text-red-700 border border-red-200',
                )}
              >
                <span>Réparti : {fmt(allocated, 0)} / {fmt(resolved.xaf, 0)} XAF</span>
                <span>{resolved.xaf === null ? '—' : allocationOk ? '✓ OK' : `reste ${fmt(remaining, 0)}`}</span>
              </div>
            </div>
          )}
        </div>

        {/* WAC reminder */}
        <div className="bg-gradient-to-br from-amber-50 to-violet-50 border border-amber-200 rounded-2xl p-3 flex items-center justify-between text-[13px]">
          <span className="text-muted-foreground">WAC USDT courant</span>
          <span className="font-bold">{wac ? `${fmt(wac, 4)} XAF/USDT` : '—'}</span>
        </div>

        <TextField label="Référence externe (Binance, hash…)" value={externalRef} onChange={(e) => setExternalRef(e.target.value)} />
        <TextField label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />

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
