/**
 * Desktop admin — Treasury accounts & balances.
 * Reuses the mobile AccountRow (balance + inline credit/debit adjust form, with
 * its money-safety logic) so nothing financial is reimplemented; only the
 * grouping layout is desktop-specific (one column per currency).
 */
import { Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { SOFT_CARD, TONE_DOT, type Tone } from '@/components/treasury/ui';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { useTreasuryAccountBalances } from '@/hooks/useTreasury';
import { AccountRow } from '@/mobile/screens/treasury/MobileAccountsScreen';
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

export function DesktopAccountsScreen() {
  const { hasPermission } = useAdminAuth();
  const { data, isLoading } = useTreasuryAccountBalances();

  if (!hasPermission('canViewTreasury')) {
    return <Navigate to="/m" replace />;
  }
  const canManage = hasPermission('canManageTreasury');

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-[26px] font-extrabold tracking-tight text-foreground">Comptes &amp; soldes</h2>
        <p className="mt-1 text-[14px] text-muted-foreground">Soldes par compte et ajustements</p>
      </header>

      {isLoading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-3">
          {CURRENCY_GROUPS.map((group) => {
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
                    <AccountRow key={a.id} account={a} currency={group.currency} canManage={canManage} isLast={idx === accounts.length - 1} />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
