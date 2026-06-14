import { useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Plus, AlertTriangle, ChevronDown } from 'lucide-react';
import { MobileHeader } from '@/mobile/components/layout/MobileHeader';
import { OccurredAtField, PhoneInputWithCountry, TextField } from '@/components/form';
import { MoneyField } from '@/components/treasury/MoneyField';
import { Segmented } from '@/components/treasury/Segmented';
import { SelectField } from '@/components/treasury/SelectField';
import { FieldLabel, INSET, PrimaryPill, SOFT_CARD, SoftIconButton } from '@/components/treasury/ui';
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

// Sentinel for "no Bonzini CNY account credited" (Radix Select forbids empty values).
const NO_ACCOUNT = '__none__';

function fmt(n: number | null, decimals = 2): string {
  if (n === null || !Number.isFinite(n)) return '—';
  return n.toLocaleString('fr-FR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

// Discreet computed/derived value — same calm style as the purchase form.
function Computed({ label, value, unit, decimals }: { label: string; value: number | null; unit: string; decimals: number }) {
  return (
    <div className="flex items-center justify-between rounded-xl bg-muted/60 px-3.5 py-2.5 text-[12px]">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold tabular-nums text-foreground">
        {fmt(value, decimals)} <span className="font-normal text-muted-foreground">{unit}</span>
      </span>
    </div>
  );
}

export function MobileNewSale({ desktop = false }: { desktop?: boolean } = {}) {
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
  // Empty string = no Bonzini CNY account credited (the most common case).
  const [cnyAccountId, setCnyAccountId] = useState<string>('');
  const [occurredAt, setOccurredAt] = useState<string>(() => new Date().toISOString());
  const [usdtAmount, setUsdtAmount] = useState<number | null>(null);
  const [cnyAmount, setCnyAmount] = useState<number | null>(null);
  const [rate, setRate] = useState<number | null>(null);
  const [externalRef, setExternalRef] = useState('');
  const [notes, setNotes] = useState('');

  const [showNewBuyer, setShowNewBuyer] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [newName, setNewName] = useState('');
  const [newCompany, setNewCompany] = useState('');
  const [newPhone, setNewPhone] = useState<string | null>(null);
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
    resolved.usdt !== null && resolved.usdt > 0 &&
    resolved.cny !== null && resolved.cny > 0;

  const handleSubmit = async () => {
    if (!valid || resolved.usdt === null || resolved.cny === null) return;
    const result = await submit.mutateAsync({
      buyer_id: buyerId,
      cny_account_id: cnyAccountId || null,
      usdt_amount: resolved.usdt,
      cny_amount: resolved.cny,
      occurred_at: occurredAt,
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
      phone: newPhone ?? undefined,
      wechat_id: newWechat.trim() || undefined,
    });
    if (result.success && result.id) {
      setBuyerId(result.id);
      setShowNewBuyer(false);
      setNewName('');
      setNewCompany('');
      setNewPhone(null);
      setNewWechat('');
    }
  };

  const buyerOptions = (buyers ?? []).map((b) => ({
    value: b.id,
    label: `${b.display_name}${b.wechat_id ? ` · ${b.wechat_id}` : b.phone ? ` · ${b.phone}` : ''}`,
  }));
  const accountOptions = [
    { value: NO_ACCOUNT, label: 'Aucun compte Bonzini concerné' },
    ...(cnyAccounts ?? []).map((a) => ({ value: a.id, label: a.label })),
  ];

  return (
    <div className={desktop ? 'mx-auto max-w-2xl' : 'flex flex-col min-h-full bg-background'}>
      {desktop ? (
        <header className="mb-6">
          <h2 className="text-[24px] font-extrabold tracking-tight text-foreground">Nouvelle vente USDT</h2>
          <p className="mt-0.5 text-[14px] text-muted-foreground">Sortie de stock USDT contre CNY</p>
        </header>
      ) : (
        <MobileHeader title="Nouvelle vente USDT" showBack backTo="/m/more/treasury" />
      )}

      <div className={desktop ? 'space-y-6' : 'px-5 py-5 space-y-6'}>
        {/* Acheteur */}
        <div>
          <FieldLabel>Acheteur CNY</FieldLabel>
          <div className="flex items-center gap-2">
            <SelectField className="flex-1" value={buyerId} onChange={setBuyerId} options={buyerOptions} />
            <SoftIconButton icon={Plus} label="Nouvel acheteur" onClick={() => setShowNewBuyer((v) => !v)} />
          </div>
          {showNewBuyer && (
            <div className={cn(INSET, 'mt-2.5 space-y-2.5 p-3.5')}>
              <TextField label="Nom" value={newName} onChange={(e) => setNewName(e.target.value)} />
              <TextField label="Entreprise (optionnel)" value={newCompany} onChange={(e) => setNewCompany(e.target.value)} />
              <PhoneInputWithCountry label="Téléphone (optionnel)" value={newPhone} onValueChange={setNewPhone} defaultDialCode="+86" />
              <TextField label="WeChat ID (optionnel)" value={newWechat} onChange={(e) => setNewWechat(e.target.value)} />
              <PrimaryPill onClick={handleCreateBuyer} disabled={!newName.trim()} loading={create.isPending}>
                Créer l’acheteur
              </PrimaryPill>
            </div>
          )}
        </div>

        {/* Compte CNY crédité (optionnel) */}
        <div>
          <FieldLabel>Compte CNY crédité <span className="font-normal text-muted-foreground">(optionnel)</span></FieldLabel>
          <SelectField
            value={cnyAccountId || NO_ACCOUNT}
            onChange={(v) => setCnyAccountId(v === NO_ACCOUNT ? '' : v)}
            options={accountOptions}
          />
          <p className="mt-1.5 px-1 text-[11px] leading-tight text-muted-foreground">
            Sélectionne le compte uniquement si le CNY a atterri sur un de nos comptes (cash Guangzhou,
            Alipay/WeChat de papa…). Sinon laisse « Aucun ».
          </p>
        </div>

        {/* Montant */}
        <div className="space-y-3">
          <FieldLabel className="mb-0">Montant</FieldLabel>
          <Segmented value={mode} onChange={setMode} options={MODES} />

          {(mode === 'usdt_cny' || mode === 'usdt_rate') && (
            <MoneyField label="USDT vendu" currency="USDT" value={usdtAmount} onValueChange={setUsdtAmount} allowDecimal decimals={4} max={null} />
          )}
          {(mode === 'usdt_cny' || mode === 'cny_rate') && (
            <MoneyField label="CNY reçu" currency="CNY" value={cnyAmount} onValueChange={setCnyAmount} allowDecimal decimals={2} max={null} />
          )}
          {(mode === 'usdt_rate' || mode === 'cny_rate') && (
            <MoneyField label="Taux" currency="CNY/USDT" value={rate} onValueChange={setRate} allowDecimal decimals={4} max={null} />
          )}

          {mode === 'usdt_cny' && <Computed label="Taux implicite" value={resolved.rate} unit="CNY/USDT" decimals={4} />}
          {mode === 'usdt_rate' && <Computed label="CNY reçu (calculé)" value={resolved.cny} unit="CNY" decimals={2} />}
          {mode === 'cny_rate' && <Computed label="USDT vendu (calculé)" value={resolved.usdt} unit="USDT" decimals={4} />}
        </div>

        {/* WAC / coût / stock */}
        <div className={cn(SOFT_CARD, 'space-y-2 p-4')}>
          <div className="flex items-center justify-between text-[13px]">
            <span className="text-muted-foreground">WAC à utiliser</span>
            <span className="font-bold tabular-nums text-foreground">{wac ? `${fmt(wac, 4)} XAF/USDT` : '—'}</span>
          </div>
          <div className="flex items-center justify-between text-[13px]">
            <span className="text-muted-foreground">Coût sortie XAF</span>
            <span className="font-bold tabular-nums text-foreground">{costBasis !== null ? `${fmt(costBasis, 0)} XAF` : '—'}</span>
          </div>
          <div className="flex items-center justify-between border-t border-border pt-2 text-[13px]">
            <span className="text-muted-foreground">Stock USDT après</span>
            <span className={cn('font-bold tabular-nums', willGoNegative ? 'text-red-600 dark:text-red-400' : 'text-foreground')}>
              {stockAfter !== null ? fmt(stockAfter, 4) : '—'}
            </span>
          </div>
        </div>

        {willGoNegative && (
          <div className="flex items-start gap-2 rounded-2xl bg-red-500/10 px-3.5 py-2.5">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
            <span className="text-[12px] text-red-700 dark:text-red-300">
              Cette vente fera passer le stock USDT en négatif. L’opération reste enregistrable
              (à régulariser par un achat manquant).
            </span>
          </div>
        )}

        {/* Détails optionnels */}
        <div>
          <button
            type="button"
            onClick={() => setShowDetails((v) => !v)}
            className={cn(INSET, 'flex w-full items-center gap-2 px-4 py-3.5 text-[13px] font-semibold')}
          >
            <span>Détails</span>
            <span className="font-normal text-muted-foreground">date · référence · note</span>
            <ChevronDown className={cn('ml-auto h-4 w-4 text-muted-foreground transition-transform', showDetails && 'rotate-180')} />
          </button>
          {showDetails && (
            <div className="mt-2.5 space-y-3">
              <OccurredAtField value={occurredAt} onChange={setOccurredAt} />
              <TextField label="Référence externe (Binance, hash…)" value={externalRef} onChange={(e) => setExternalRef(e.target.value)} />
              <TextField label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          )}
        </div>

        <PrimaryPill onClick={handleSubmit} disabled={!valid} loading={submit.isPending}>
          Enregistrer la vente
        </PrimaryPill>
      </div>
    </div>
  );
}
