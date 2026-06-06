import { useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { MobileHeader } from '@/mobile/components/layout/MobileHeader';
import { Button } from '@/components/ui/button';
import { AmountField, OccurredAtField, PhoneInputWithCountry, TextField } from '@/components/form';
import { Segmented } from '@/components/treasury/Segmented';
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

type SingleMode = 'xaf_usdt' | 'xaf_rate' | 'usdt_rate';
type MultiInput = 'usdt' | 'rate';
type AccountMode = 'single' | 'multi';

interface SplitRow {
  key: string;
  accountId: string;
  amount: number | null;
}

const SINGLE_MODES: { value: SingleMode; label: string; hint: string }[] = [
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

  const [supplierId, setSupplierId] = useState('');
  const [occurredAt, setOccurredAt] = useState<string>(() => new Date().toISOString());
  const [accountMode, setAccountMode] = useState<AccountMode>('single');
  const [singleAccountId, setSingleAccountId] = useState('');
  const [splits, setSplits] = useState<SplitRow[]>([newSplit(), newSplit()]);

  // Single-account deal inputs
  const [singleMode, setSingleMode] = useState<SingleMode>('xaf_usdt');
  const [xafAmount, setXafAmount] = useState<number | null>(null);
  const [usdtAmount, setUsdtAmount] = useState<number | null>(null);
  const [rate, setRate] = useState<number | null>(null);

  // Multi-account deal input (XAF total comes from the splits)
  const [multiInput, setMultiInput] = useState<MultiInput>('usdt');

  const [externalRef, setExternalRef] = useState('');
  const [notes, setNotes] = useState('');

  const [showNewSupplier, setShowNewSupplier] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState<string | null>(null);

  const multiTotalXaf = useMemo(
    () => splits.reduce((s, r) => s + (r.amount ?? 0), 0),
    [splits],
  );

  // Resolve XAF / USDT / rate depending on the active mode.
  const resolved = useMemo(() => {
    if (accountMode === 'multi') {
      const xaf = multiTotalXaf > 0 ? multiTotalXaf : null;
      if (multiInput === 'usdt') {
        const r = xaf && usdtAmount && usdtAmount > 0 ? xaf / usdtAmount : null;
        return { xaf, usdt: usdtAmount, rate: r };
      }
      const u = xaf && rate && rate > 0 ? xaf / rate : null;
      return { xaf, usdt: u, rate };
    }
    // single
    if (singleMode === 'xaf_usdt') {
      const r = xafAmount && usdtAmount && usdtAmount > 0 ? xafAmount / usdtAmount : null;
      return { xaf: xafAmount, usdt: usdtAmount, rate: r };
    }
    if (singleMode === 'xaf_rate') {
      const u = xafAmount && rate && rate > 0 ? xafAmount / rate : null;
      return { xaf: xafAmount, usdt: u, rate };
    }
    const x = usdtAmount && rate && rate > 0 ? usdtAmount * rate : null;
    return { xaf: x, usdt: usdtAmount, rate };
  }, [accountMode, multiTotalXaf, multiInput, singleMode, xafAmount, usdtAmount, rate]);

  if (!hasPermission('canManageTreasury')) {
    return <Navigate to="/m/more" replace />;
  }

  const splitsValid = splits.every((r) => r.accountId && (r.amount ?? 0) > 0);
  const valid =
    !!supplierId &&
    resolved.xaf !== null && resolved.xaf > 0 &&
    resolved.usdt !== null && resolved.usdt > 0 &&
    (accountMode === 'single' ? !!singleAccountId : splitsValid);

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
        {/* 1. Supplier */}
        <div>
          <label className="block text-[13px] font-semibold mb-1.5">Fournisseur USDT *</label>
          <div className="flex gap-2">
            <select
              value={supplierId}
              onChange={(e) => setSupplierId(e.target.value)}
              className="flex-1 h-11 px-3 rounded-xl border border-border bg-card text-[15px]"
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
              className="h-11 w-11 rounded-xl border border-border bg-card flex items-center justify-center active:bg-muted/40"
              aria-label="Nouveau fournisseur"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>
          {showNewSupplier && (
            <div className="mt-2 bg-violet-50 dark:bg-violet-500/10 border border-violet-200 dark:border-violet-500/30 rounded-xl p-3 space-y-2">
              <TextField label="Nom fournisseur" value={newName} onChange={(e) => setNewName(e.target.value)} />
              <PhoneInputWithCountry label="Téléphone (optionnel)" value={newPhone} onValueChange={setNewPhone} defaultDialCode="+237" />
              <Button onClick={handleCreateSupplier} disabled={create.isPending || !newName.trim()} size="sm" className="w-full">
                {create.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Créer'}
              </Button>
            </div>
          )}
        </div>

        {/* 2. Date / heure */}
        <OccurredAtField value={occurredAt} onChange={setOccurredAt} />

        {/* 3. Comptes XAF débités (AVANT la saisie du deal) */}
        <div>
          <label className="block text-[13px] font-semibold mb-1.5">Compte(s) XAF débité(s) *</label>
          <Segmented
            className="mb-2"
            value={accountMode}
            onChange={setAccountMode}
            options={[
              { value: 'single', label: 'Compte unique' },
              { value: 'multi', label: 'Multi-comptes' },
            ]}
          />

          {accountMode === 'single' ? (
            <select
              value={singleAccountId}
              onChange={(e) => setSingleAccountId(e.target.value)}
              className="w-full h-11 px-3 rounded-xl border border-border bg-card text-[15px]"
            >
              <option value="">Sélectionner…</option>
              {(xafAccounts ?? []).map((a) => (
                <option key={a.id} value={a.id}>{a.label}</option>
              ))}
            </select>
          ) : (
            <div className="space-y-2.5">
              {splits.map((row, idx) => (
                <div key={row.key} className="bg-card border border-border rounded-xl p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                      Compte {idx + 1}
                    </span>
                    {splits.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setSplits((rows) => rows.filter((r) => r.key !== row.key))}
                        className="text-red-600 dark:text-red-400"
                        aria-label="Retirer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  <select
                    value={row.accountId}
                    onChange={(e) => updateSplit(row.key, { accountId: e.target.value })}
                    className="w-full h-11 px-3 rounded-xl border border-border bg-card text-[15px]"
                  >
                    <option value="">Choisir le compte…</option>
                    {(xafAccounts ?? []).map((a) => (
                      <option key={a.id} value={a.id}>{a.label}</option>
                    ))}
                  </select>
                  <AmountField
                    label="Montant débité"
                    currency="XAF"
                    value={row.amount}
                    onValueChange={(v) => updateSplit(row.key, { amount: v })}
                    allowDecimal
                    decimals={0}
                    max={null}
                  />
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

              {/* Total XAF (computed from splits) */}
              <div className="bg-violet-50 dark:bg-violet-500/10 border border-violet-200 dark:border-violet-500/30 rounded-xl px-3.5 py-3 flex items-center justify-between">
                <span className="text-[12px] font-semibold text-violet-700 dark:text-violet-300 uppercase tracking-wide">Total XAF payé</span>
                <span className="text-[18px] font-extrabold tabular-nums text-violet-900 dark:text-violet-200">
                  {fmt(multiTotalXaf, 0)} <span className="text-[11px] font-normal text-violet-700 dark:text-violet-300">XAF</span>
                </span>
              </div>
            </div>
          )}
        </div>

        {/* 4. Saisie du deal */}
        <div>
          <label className="block text-[13px] font-semibold mb-1.5">Saisie du deal</label>

          {accountMode === 'single' ? (
            <>
              <Segmented
                className="mb-3"
                value={singleMode}
                onChange={setSingleMode}
                options={SINGLE_MODES}
              />
              <div className="space-y-3">
                {(singleMode === 'xaf_usdt' || singleMode === 'xaf_rate') && (
                  <AmountField label="XAF payé *" currency="XAF" value={xafAmount} onValueChange={setXafAmount} allowDecimal decimals={0} max={null} />
                )}
                {(singleMode === 'xaf_usdt' || singleMode === 'usdt_rate') && (
                  <AmountField label="USDT reçu *" currency="USDT" value={usdtAmount} onValueChange={setUsdtAmount} allowDecimal decimals={4} max={null} />
                )}
                {(singleMode === 'xaf_rate' || singleMode === 'usdt_rate') && (
                  <AmountField label="Taux *" currency="XAF/USDT" value={rate} onValueChange={setRate} allowDecimal decimals={4} max={null} />
                )}
                {singleMode === 'xaf_rate' && <ComputedRow label="USDT reçu (calculé)" value={resolved.usdt} unit="USDT" decimals={4} />}
                {singleMode === 'usdt_rate' && <ComputedRow label="XAF payé (calculé)" value={resolved.xaf} unit="XAF" decimals={0} />}
                {singleMode === 'xaf_usdt' && <ComputedRow label="Taux implicite" value={resolved.rate} unit="XAF/USDT" decimals={4} />}
              </div>
            </>
          ) : (
            <>
              <p className="text-[12px] text-muted-foreground mb-2">
                Le XAF total ({fmt(multiTotalXaf, 0)}) vient de tes comptes. Saisis juste l’USDT reçu OU le taux.
              </p>
              <Segmented
                className="mb-3"
                value={multiInput}
                onChange={setMultiInput}
                options={[
                  { value: 'usdt', label: 'Je saisis l’USDT reçu' },
                  { value: 'rate', label: 'Je saisis le taux' },
                ]}
              />
              <div className="space-y-3">
                {multiInput === 'usdt' ? (
                  <AmountField label="USDT reçu *" currency="USDT" value={usdtAmount} onValueChange={setUsdtAmount} allowDecimal decimals={4} max={null} />
                ) : (
                  <AmountField label="Taux *" currency="XAF/USDT" value={rate} onValueChange={setRate} allowDecimal decimals={4} max={null} />
                )}
                {multiInput === 'usdt' && <ComputedRow label="Taux implicite" value={resolved.rate} unit="XAF/USDT" decimals={4} />}
                {multiInput === 'rate' && <ComputedRow label="USDT reçu (calculé)" value={resolved.usdt} unit="USDT" decimals={4} />}
              </div>
            </>
          )}
        </div>

        {/* WAC reminder */}
        <div className="bg-gradient-to-br from-amber-50 dark:from-amber-500/10 to-violet-50 dark:to-violet-500/10 border border-amber-200 dark:border-amber-500/30 rounded-2xl p-3 flex items-center justify-between text-[13px]">
          <span className="text-muted-foreground">WAC USDT courant</span>
          <span className="font-bold">{wac ? `${fmt(wac, 4)} XAF/USDT` : '—'}</span>
        </div>

        <TextField label="Référence externe (Binance, hash…)" value={externalRef} onChange={(e) => setExternalRef(e.target.value)} />
        <TextField label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />

        <Button
          onClick={handleSubmit}
          disabled={!valid || submit.isPending}
          className={cn(
            'h-12 w-full rounded-xl text-base font-bold',
            valid ? 'bg-bonzini-violet text-white hover:opacity-90' : 'bg-muted text-muted-foreground',
          )}
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
    <div className="bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 rounded-xl px-3.5 py-3 flex items-center justify-between">
      <span className="text-[12px] font-semibold text-emerald-700 dark:text-emerald-300 uppercase tracking-wide">{label}</span>
      <span className="font-bold tabular-nums text-emerald-900 dark:text-emerald-200">
        {fmt(value, decimals)} <span className="text-[11px] text-emerald-700 dark:text-emerald-300 font-normal">{unit}</span>
      </span>
    </div>
  );
}
