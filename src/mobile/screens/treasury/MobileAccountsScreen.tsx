import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Loader2, Plus, Minus, ChevronDown, ChevronUp } from 'lucide-react';
import { MobileHeader } from '@/mobile/components/layout/MobileHeader';
import { Button } from '@/components/ui/button';
import { AmountField, TextField } from '@/components/form';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { useAdjustAccount, useTreasuryAccountBalances, type TreasuryAccountBalance } from '@/hooks/useTreasury';
import { cn } from '@/lib/utils';

const CURRENCY_GROUPS: { currency: 'XAF' | 'USDT' | 'CNY'; label: string; tone: string }[] = [
  { currency: 'XAF', label: 'Comptes XAF', tone: 'border-violet-200 dark:border-violet-500/30 bg-violet-50 dark:bg-violet-500/10' },
  { currency: 'USDT', label: 'Pool USDT', tone: 'border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10' },
  { currency: 'CNY', label: 'Comptes CNY', tone: 'border-orange-200 dark:border-orange-500/30 bg-orange-50 dark:bg-orange-500/10' },
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

      <div className="px-4 py-4 space-y-5">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          CURRENCY_GROUPS.map((group) => {
            const accounts = (data ?? []).filter((a) => a.currency === group.currency);
            if (accounts.length === 0) return null;
            const total = accounts.reduce((sum, a) => sum + Number(a.balance ?? 0), 0);

            return (
              <section key={group.currency}>
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-[13px] font-bold uppercase tracking-wide text-muted-foreground">
                    {group.label}
                  </h2>
                  <span className="text-[13px] font-bold text-foreground">
                    {formatBalance(total, group.currency)} {group.currency}
                  </span>
                </div>
                <div className={cn('rounded-2xl border overflow-hidden', group.tone)}>
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
    <div className={cn('bg-card/60', !isLast && 'border-b border-border/60')}>
      <button
        type="button"
        onClick={() => canManage && setOpen((v) => !v)}
        className={cn(
          'w-full flex items-center justify-between p-3.5 text-left active:bg-muted/30',
          canManage && 'cursor-pointer',
        )}
      >
        <div className="min-w-0">
          <div className="font-semibold text-foreground truncate">{account.label}</div>
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
          {canManage && (open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />)}
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
    <div className="px-3.5 pb-3.5 pt-1 space-y-3 bg-muted/10 border-t border-border">
      {/* Direction toggle */}
      <div className="grid grid-cols-2 gap-1.5">
        <button
          type="button"
          onClick={() => setDirection('credit')}
          className={cn(
            'h-10 rounded-xl text-[13px] font-semibold border-2 transition-colors flex items-center justify-center gap-1.5',
            direction === 'credit'
              ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
              : 'border-border bg-card text-muted-foreground',
          )}
        >
          <Plus className="w-4 h-4" />
          Approvisionner
        </button>
        <button
          type="button"
          onClick={() => setDirection('debit')}
          className={cn(
            'h-10 rounded-xl text-[13px] font-semibold border-2 transition-colors flex items-center justify-center gap-1.5',
            direction === 'debit'
              ? 'border-red-500 bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-300'
              : 'border-border bg-card text-muted-foreground',
          )}
        >
          <Minus className="w-4 h-4" />
          Débiter
        </button>
      </div>

      <AmountField
        label={`Montant ${direction === 'credit' ? 'à créditer' : 'à débiter'}`}
        currency={currency}
        value={amount}
        onValueChange={setAmount}
        allowDecimal
        decimals={decimals}
        max={null}
      />

      <TextField
        label="Motif * (10 caractères min)"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder={direction === 'credit' ? 'ex: virement client reçu UBA' : 'ex: paiement loyer bureau'}
      />

      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={onClose} className="flex-1">
          Annuler
        </Button>
        <Button
          size="sm"
          onClick={handleSubmit}
          disabled={!valid || adjust.isPending}
          className={cn(
            'flex-1',
            direction === 'credit' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700',
          )}
        >
          {adjust.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : direction === 'credit' ? (
            'Approvisionner'
          ) : (
            'Débiter'
          )}
        </Button>
      </div>
    </div>
  );
}
