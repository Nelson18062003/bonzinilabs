import { useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Loader2, Plus, Trash2, ChevronDown } from 'lucide-react';
import { MobileHeader } from '@/mobile/components/layout/MobileHeader';
import { Button } from '@/components/ui/button';
import { AmountField, OccurredAtField, PhoneInputWithCountry, TextField } from '@/components/form';
import { Segmented } from '@/components/treasury/Segmented';
import { SelectField } from '@/components/treasury/SelectField';
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

// Discreet text link used to reveal advanced options on demand.
function LinkButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-2 inline-flex items-center gap-1 text-[12px] font-semibold text-bonzini-violet active:opacity-70"
    >
      {children}
    </button>
  );
}

// Discreet computed/derived value (no loud filled box — keeps the form calm).
function Computed({ label, value, unit, decimals }: { label: string; value: number | null; unit: string; decimals: number }) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-muted/60 px-3 py-2 text-[12px]">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold tabular-nums text-foreground">
        {fmt(value, decimals)} <span className="font-normal text-muted-foreground">{unit}</span>
      </span>
    </div>
  );
}

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

  // Progressive-disclosure UI state (default: simplest path visible only).
  const [showEntryModes, setShowEntryModes] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [showNewSupplier, setShowNewSupplier] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState<string | null>(null);

  const multiTotalXaf = useMemo(() => splits.reduce((s, r) => s + (r.amount ?? 0), 0), [splits]);

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

      <div className="px-4 py-4 space-y-5">
        {/* Fournisseur */}
        <div>
          <label className="mb-1.5 block text-[13px] font-semibold">Fournisseur</label>
          <div className="flex gap-2">
            <SelectField
              className="flex-1"
              value={supplierId}
              onChange={setSupplierId}
              options={(suppliers ?? []).map((s) => ({ value: s.id, label: `${s.short_id} · ${s.display_name}` }))}
            />
            <button
              type="button"
              onClick={() => setShowNewSupplier((v) => !v)}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border bg-card active:bg-muted/40"
              aria-label="Nouveau fournisseur"
            >
              <Plus className="h-5 w-5" />
            </button>
          </div>
          {showNewSupplier && (
            <div className="mt-2 space-y-2 rounded-xl border border-border bg-muted/40 p-3">
              <TextField label="Nom fournisseur" value={newName} onChange={(e) => setNewName(e.target.value)} />
              <PhoneInputWithCountry label="Téléphone (optionnel)" value={newPhone} onValueChange={setNewPhone} defaultDialCode="+237" />
              <Button onClick={handleCreateSupplier} disabled={create.isPending || !newName.trim()} size="sm" className="w-full">
                {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Créer'}
              </Button>
            </div>
          )}
        </div>

        {/* Compte XAF débité */}
        <div>
          <label className="mb-1.5 block text-[13px] font-semibold">Compte XAF débité</label>
          {accountMode === 'single' ? (
            <>
              <SelectField
                value={singleAccountId}
                onChange={setSingleAccountId}
                options={(xafAccounts ?? []).map((a) => ({ value: a.id, label: a.label }))}
              />
              <LinkButton onClick={() => setAccountMode('multi')}>
                <Plus className="h-3.5 w-3.5" /> Répartir sur plusieurs comptes
              </LinkButton>
            </>
          ) : (
            <div className="space-y-2.5">
              {splits.map((row, idx) => (
                <div key={row.key} className="space-y-2 rounded-xl border border-border bg-card p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Compte {idx + 1}</span>
                    {splits.length > 1 && (
                      <button type="button" onClick={() => setSplits((rows) => rows.filter((r) => r.key !== row.key))} className="text-red-600 dark:text-red-400" aria-label="Retirer">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                  <SelectField
                    placeholder="Choisir le compte…"
                    value={row.accountId}
                    onChange={(v) => updateSplit(row.key, { accountId: v })}
                    options={(xafAccounts ?? []).map((a) => ({ value: a.id, label: a.label }))}
                  />
                  <AmountField label="Montant débité" currency="XAF" value={row.amount} onValueChange={(v) => updateSplit(row.key, { amount: v })} allowDecimal decimals={0} max={null} />
                </div>
              ))}
              <button
                type="button"
                onClick={() => setSplits((rows) => [...rows, newSplit()])}
                className="flex h-10 w-full items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-border text-[13px] font-semibold text-muted-foreground active:bg-muted/40"
              >
                <Plus className="h-4 w-4" /> Ajouter un compte
              </button>
              <div className="flex items-center justify-between rounded-lg bg-muted/60 px-3 py-2 text-[12px]">
                <span className="text-muted-foreground">Total XAF payé</span>
                <span className="font-bold tabular-nums text-foreground">{fmt(multiTotalXaf, 0)} <span className="font-normal text-muted-foreground">XAF</span></span>
              </div>
              <LinkButton onClick={() => setAccountMode('single')}>← Revenir à un seul compte</LinkButton>
            </div>
          )}
        </div>

        {/* Montant */}
        <div className="space-y-3">
          <label className="block text-[13px] font-semibold">Montant</label>

          {accountMode === 'single' ? (
            <>
              {showEntryModes && <Segmented value={singleMode} onChange={setSingleMode} options={SINGLE_MODES} />}

              {(singleMode === 'xaf_usdt' || singleMode === 'xaf_rate') && (
                <AmountField label="XAF payé" currency="XAF" value={xafAmount} onValueChange={setXafAmount} allowDecimal decimals={0} max={null} />
              )}
              {(singleMode === 'xaf_usdt' || singleMode === 'usdt_rate') && (
                <AmountField label="USDT reçu" currency="USDT" value={usdtAmount} onValueChange={setUsdtAmount} allowDecimal decimals={4} max={null} />
              )}
              {(singleMode === 'xaf_rate' || singleMode === 'usdt_rate') && (
                <AmountField label="Taux" currency="XAF/USDT" value={rate} onValueChange={setRate} allowDecimal decimals={4} max={null} />
              )}

              {singleMode === 'xaf_usdt' && <Computed label="Taux implicite" value={resolved.rate} unit="XAF/USDT" decimals={4} />}
              {singleMode === 'xaf_rate' && <Computed label="USDT reçu (calculé)" value={resolved.usdt} unit="USDT" decimals={4} />}
              {singleMode === 'usdt_rate' && <Computed label="XAF payé (calculé)" value={resolved.xaf} unit="XAF" decimals={0} />}

              {!showEntryModes && (
                <LinkButton onClick={() => setShowEntryModes(true)}>Saisir autrement (par taux)…</LinkButton>
              )}
            </>
          ) : (
            <>
              <p className="text-[12px] text-muted-foreground">
                Le XAF total ({fmt(multiTotalXaf, 0)}) vient de tes comptes. Saisis l’USDT reçu OU le taux.
              </p>
              <Segmented
                value={multiInput}
                onChange={setMultiInput}
                options={[
                  { value: 'usdt', label: 'USDT reçu' },
                  { value: 'rate', label: 'Taux' },
                ]}
              />
              {multiInput === 'usdt' ? (
                <AmountField label="USDT reçu" currency="USDT" value={usdtAmount} onValueChange={setUsdtAmount} allowDecimal decimals={4} max={null} />
              ) : (
                <AmountField label="Taux" currency="XAF/USDT" value={rate} onValueChange={setRate} allowDecimal decimals={4} max={null} />
              )}
              {multiInput === 'usdt' && <Computed label="Taux implicite" value={resolved.rate} unit="XAF/USDT" decimals={4} />}
              {multiInput === 'rate' && <Computed label="USDT reçu (calculé)" value={resolved.usdt} unit="USDT" decimals={4} />}
            </>
          )}

          <div className="px-1 text-[11px] text-muted-foreground">
            WAC USDT courant : <span className="font-semibold text-foreground">{wac ? `${fmt(wac, 4)} XAF/USDT` : '—'}</span>
          </div>
        </div>

        {/* Détails optionnels */}
        <div>
          <button
            type="button"
            onClick={() => setShowDetails((v) => !v)}
            className="flex w-full items-center justify-between rounded-xl border border-border bg-card px-3.5 py-3 text-[13px] font-semibold"
          >
            Détails <span className="font-normal text-muted-foreground">date · référence · note</span>
            <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', showDetails && 'rotate-180')} />
          </button>
          {showDetails && (
            <div className="mt-2 space-y-3">
              <OccurredAtField value={occurredAt} onChange={setOccurredAt} />
              <TextField label="Référence externe (Binance, hash…)" value={externalRef} onChange={(e) => setExternalRef(e.target.value)} />
              <TextField label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          )}
        </div>

        <Button
          onClick={handleSubmit}
          disabled={!valid || submit.isPending}
          className={cn(
            'h-12 w-full rounded-xl text-base font-bold',
            valid ? 'bg-bonzini-violet text-white hover:opacity-90' : 'bg-muted text-muted-foreground',
          )}
        >
          {submit.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Enregistrer l’achat'}
        </Button>
      </div>
    </div>
  );
}
