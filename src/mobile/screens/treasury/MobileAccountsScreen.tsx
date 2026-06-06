import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Loader2, Plus, Minus, ChevronDown, ChevronUp } from 'lucide-react';
import { MobileHeader } from '@/mobile/components/layout/MobileHeader';
import { TextField } from '@/components/form';
import { MoneyField } from '@/components/treasury/MoneyField';
import { SOFT_CARD, TONE_DOT, type Tone } from '@/components/treasury/ui';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { useAdjustAccount, useTreasuryAccountBalances, type TreasuryAccountBalance } from '@/hooks/useTreasury';
import { cn } from '@/lib/utils';

const CURRENCY_GROUPS: { currency: 'XAF' | 'USDT' | 'CNY'; label: string; tone: Tone }[] = [
  { currency: 'XAF', label: 'Comptes XAF', tone: 'violet' },
  { currency: 'USDT', label: 'Pool USDT', tone: 'amber' },
  { currency: 'CNY', label: 'Comptes CNY', tone: 'orange' },
];

function formatBalance(n: number, currency: string) {
  const decimals = currency === 'USDT' ? 4 : currency === 'CNY' ? 2 : 0;
  return n.toLocaleString('fr-FR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

const KIND_LABEL: Record<string, string> = {
  bank: 'Banque',
  mobile_money: 'Mobile Money',
  crypto_pool: 'Pool crypto',
  cash: 'Cash',
  alipay: 'Alipay',
  wechat: 'WeChat Pay',
  other: 'Autre',
};

export function MobileAccountsScreen() {
  const { hasPermission } = useAdminAuth();
  const { data, isLoading } = useTreasuryAccountBalances();

  if (!hasPermission('canViewTreasury')) {
    return <Navigate to="/m/more" replace />;
  }

  const canManage = hasPermission('canManageTreasury');

  return (
    <div className="flex flex-col min-h-full bg-background">
      <MobileHeader title="Comptes & soldes" showBack backTo="/m/more/treasury" />

      <div className="px-5 py-5 space-y-6">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          CURRENCY_GROUPS.map((group) => {
            const accounts = (data ?? []).filter((a) => a.currency === group.currency);
            if (accounts.length === 0) return null;
            const total = accounts.reduce((sum, a) => sum + Number(a.balance ?? 0), 0);

            return (
              <section key={group.currency}>
                <div className="mb-2.5 flex items-center justify-between px-1">
                  <div className="flex items-center gap-1.5">
                    <span className={cn('h-2 w-2 rounded-full', TONE_DOT[group.tone])} />
                    <h2 className="text-[12px] font-bold uppercase tracking-wider text-muted-foreground">{group.label}</h2>
                  </div>
                  <span className="text-[13px] font-bold tabular-nums text-foreground">
                    {formatBalance(total, group.currency)} {group.currency}
                  </span>
                </div>
                <div className={cn(SOFT_CARD, 'overflow-hidden')}>
                  {accounts.map((a, idx) => (
                    <AccountRow
                      key={a.id}
                      account={a}
                      currency={group.currency}
                      canManage={canManage}
                      isLast={idx === accounts.length - 1}
                    />
                  ))}
                </div>
              </section>
            );
          })
        )}
      </div>
    </div>
  );
}

function AccountRow({
  account,
  currency,
  canManage,
  isLast,
}: {
  account: TreasuryAccountBalance;
  currency: 'XAF' | 'USDT' | 'CNY';
  canManage: boolean;
  isLast: boolean;
}) {
  const [open, setOpen] = useState(false);
  const balance = Number(account.balance ?? 0);
  const negative = balance < 0;

  return (
    <div className={cn(!isLast && 'border-b border-border/60')}>
      <button
        type="button"
        onClick={() => canManage && setOpen((v) => !v)}
        className={cn('flex w-full items-center justify-between p-4 text-left active:bg-muted/30', canManage && 'cursor-pointer')}
      >
        <div className="min-w-0">
          <div className="truncate font-semibold text-foreground">{account.label}</div>
          <div className="text-[11px] text-muted-foreground">
            {KIND_LABEL[account.kind ?? 'other'] ?? account.kind} ·{' '}
            {account.last_entry_at
              ? `dernière écriture ${new Date(account.last_entry_at).toLocaleDateString('fr-FR')}`
              : 'aucune écriture'}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className={cn('text-right font-bold tabular-nums', negative ? 'text-red-600 dark:text-red-400' : 'text-foreground')}>
            {formatBalance(balance, currency)}
          </div>
          {canManage && (open ? <ChevronUp className="h-4 w-4 text-muted-foreground/60" /> : <ChevronDown className="h-4 w-4 text-muted-foreground/60" />)}
        </div>
      </button>

      {open && canManage && account.id && (
        <AdjustForm accountId={account.id} currency={currency} onClose={() => setOpen(false)} />
      )}
    </div>
  );
}

function AdjustForm({
  accountId,
  currency,
  onClose,
}: {
  accountId: string;
  currency: 'XAF' | 'USDT' | 'CNY';
  onClose: () => void;
}) {
  const [direction, setDirection] = useState<'credit' | 'debit'>('credit');
  const [amount, setAmount] = useState<number | null>(null);
  const [reason, setReason] = useState('');
  const adjust = useAdjustAccount();

  const decimals = currency === 'USDT' ? 4 : currency === 'CNY' ? 2 : 0;
  const reasonValid = reason.trim().length >= 10;
  const amountValid = amount !== null && amount > 0;
  const valid = amountValid && reasonValid;

  const handleSubmit = async () => {
    if (!valid || amount === null) return;
    const delta = direction === 'credit' ? amount : -amount;
    const result = await adjust.mutateAsync({
      account_id: accountId,
      delta_amount: delta,
      reason: reason.trim(),
    });
    if (result.success) {
      setAmount(null);
      setReason('');
      onClose();
    }
  };

  return (
    <div className="space-y-3 border-t border-border bg-muted/30 px-4 pb-4 pt-3.5">
      {/* Direction toggle (semantic colours kept for money safety) */}
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setDirection('credit')}
          className={cn(
            'flex h-11 items-center justify-center gap-1.5 rounded-2xl text-[13px] font-semibold transition-colors',
            direction === 'credit' ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' : 'bg-muted text-muted-foreground',
          )}
        >
          <Plus className="h-4 w-4" /> Approvisionner
        </button>
        <button
          type="button"
          onClick={() => setDirection('debit')}
          className={cn(
            'flex h-11 items-center justify-center gap-1.5 rounded-2xl text-[13px] font-semibold transition-colors',
            direction === 'debit' ? 'bg-red-500/15 text-red-700 dark:text-red-300' : 'bg-muted text-muted-foreground',
          )}
        >
          <Minus className="h-4 w-4" /> Débiter
        </button>
      </div>

      <MoneyField
        label={`Montant ${direction === 'credit' ? 'à créditer' : 'à débiter'}`}
        currency={currency}
        value={amount}
        onValueChange={setAmount}
        allowDecimal
        decimals={decimals}
        max={null}
      />

      <TextField
        label="Motif (10 caractères min)"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder={direction === 'credit' ? 'ex: virement client reçu UBA' : 'ex: paiement loyer bureau'}
      />

      <div className="flex gap-2.5">
        <button
          onClick={onClose}
          className="h-12 flex-1 rounded-2xl bg-muted text-[14px] font-bold text-foreground transition active:scale-[0.99]"
        >
          Annuler
        </button>
        <button
          onClick={handleSubmit}
          disabled={!valid || adjust.isPending}
          className={cn(
            'flex h-12 flex-1 items-center justify-center rounded-2xl text-[14px] font-bold transition active:scale-[0.99]',
            !valid || adjust.isPending
              ? 'bg-muted text-muted-foreground'
              : direction === 'credit'
                ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                : 'bg-red-600 text-white hover:bg-red-700',
          )}
        >
          {adjust.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : direction === 'credit' ? 'Approvisionner' : 'Débiter'}
        </button>
      </div>
    </div>
  );
}
