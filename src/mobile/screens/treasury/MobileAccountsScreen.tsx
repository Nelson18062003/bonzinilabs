import { Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { MobileHeader } from '@/mobile/components/layout/MobileHeader';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { useTreasuryAccountBalances } from '@/hooks/useTreasury';
import { cn } from '@/lib/utils';

const CURRENCY_GROUPS: { currency: 'XAF' | 'USDT' | 'CNY'; label: string; tone: string }[] = [
  { currency: 'XAF', label: 'Comptes XAF', tone: 'border-violet-200 bg-violet-50' },
  { currency: 'USDT', label: 'Pool USDT', tone: 'border-amber-200 bg-amber-50' },
  { currency: 'CNY', label: 'Comptes CNY', tone: 'border-orange-200 bg-orange-50' },
];

function formatBalance(n: number, currency: string) {
  const decimals = currency === 'USDT' ? 4 : 2;
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
                <div className={cn('rounded-2xl border divide-y divide-border/60 overflow-hidden', group.tone)}>
                  {accounts.map((a) => {
                    const balance = Number(a.balance ?? 0);
                    const negative = balance < 0;
                    return (
                      <div key={a.id} className="flex items-center justify-between p-3.5 bg-white/60">
                        <div className="min-w-0">
                          <div className="font-semibold text-foreground truncate">{a.label}</div>
                          <div className="text-[11px] text-muted-foreground">
                            {KIND_LABEL[a.kind ?? 'other'] ?? a.kind} ·{' '}
                            {a.last_entry_at
                              ? `dernière écriture ${new Date(a.last_entry_at).toLocaleDateString('fr-FR')}`
                              : 'aucune écriture'}
                          </div>
                        </div>
                        <div className={cn('text-right font-bold tabular-nums', negative ? 'text-red-600' : 'text-foreground')}>
                          {formatBalance(balance, group.currency)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })
        )}
      </div>
    </div>
  );
}
