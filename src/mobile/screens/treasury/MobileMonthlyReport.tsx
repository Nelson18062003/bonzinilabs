import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { MobileHeader } from '@/mobile/components/layout/MobileHeader';
import { Segmented } from '@/components/treasury/Segmented';
import { SOFT_CARD, TONE_DOT } from '@/components/treasury/ui';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { useUsdtSalesMonthly, type MonthlySalesRow } from '@/hooks/useTreasury';
import { cn } from '@/lib/utils';

type Window = '6' | '12' | '24';

function fmt(n: number | null | undefined, decimals = 2): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  return n.toLocaleString('fr-FR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function monthLabel(ym: string): string {
  const label = new Date(`${ym}-01T00:00:00`).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function MonthCard({ row, isCurrent }: { row: MonthlySalesRow; isCurrent: boolean }) {
  return (
    <div className={cn(SOFT_CARD, 'p-4')}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={cn('h-2 w-2 rounded-full', isCurrent ? TONE_DOT.amber : TONE_DOT.violet)} />
          <span className="text-[13px] font-bold text-foreground">{monthLabel(row.month)}</span>
          {isCurrent && <span className="text-[10px] font-bold uppercase tracking-wider text-bonzini-amber">En cours</span>}
        </div>
        <span className="text-[11px] text-muted-foreground">
          {row.sale_count} vente{row.sale_count > 1 ? 's' : ''}
          {row.settlement_count > 0 ? ` · ${row.settlement_count} règlement${row.settlement_count > 1 ? 's' : ''}` : ''}
        </span>
      </div>

      <div className="mt-2.5 text-2xl font-extrabold leading-tight tracking-tight tabular-nums text-foreground">
        {fmt(row.total_usdt)} <span className="text-sm font-semibold text-muted-foreground">USDT vendus</span>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2.5">
        <div className="rounded-xl bg-muted/60 px-3 py-2">
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">CNY reçus</div>
          <div className="text-[13px] font-bold tabular-nums text-foreground">{fmt(row.total_cny)}</div>
        </div>
        <div className="rounded-xl bg-muted/60 px-3 py-2">
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Taux moyen pondéré</div>
          <div className="text-[13px] font-bold tabular-nums text-foreground">
            {fmt(row.weighted_avg_rate_cny_per_usdt, 4)} <span className="font-normal text-muted-foreground">CNY/USDT</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Bilan mensuel USDT — la réponse directe au besoin de clôture : « combien
 * d'USDT ai-je vendus ce mois-ci, contre combien de CNY, à quel taux
 * moyen ? ». Une carte par mois, ventes manuelles + règlements partenaire
 * confondus (les ventes annulées sont exclues côté RPC).
 */
export function MobileMonthlyReport({ desktop = false }: { desktop?: boolean } = {}) {
  const { hasPermission } = useAdminAuth();
  const [window, setWindow] = useState<Window>('12');
  const { data: months, isLoading } = useUsdtSalesMonthly(Number(window));

  if (!hasPermission('canViewTreasury')) {
    return <Navigate to="/m/more" replace />;
  }

  const currentYm = new Date().toISOString().slice(0, 7);
  const totalUsdt = (months ?? []).reduce((s, m) => s + Number(m.total_usdt), 0);
  const totalCny = (months ?? []).reduce((s, m) => s + Number(m.total_cny), 0);

  return (
    <div className={desktop ? 'mx-auto max-w-2xl' : 'flex flex-col min-h-full bg-background'}>
      {desktop ? (
        <header className="mb-6">
          <h2 className="text-[24px] font-extrabold tracking-tight text-foreground">Bilan mensuel USDT</h2>
          <p className="mt-0.5 text-[14px] text-muted-foreground">USDT vendus, CNY reçus et taux moyen, mois par mois</p>
        </header>
      ) : (
        <MobileHeader title="Bilan mensuel USDT" showBack backTo="/m/more/treasury" />
      )}

      <div className={desktop ? 'space-y-4' : 'px-5 py-5 space-y-4'}>
        <Segmented
          value={window}
          onChange={setWindow}
          options={[
            { value: '6', label: '6 mois' },
            { value: '12', label: '12 mois' },
            { value: '24', label: '24 mois' },
          ]}
        />

        <div className={cn(SOFT_CARD, 'flex items-baseline justify-between gap-2 p-4')}>
          <span className="text-[12px] text-muted-foreground">Total sur la période</span>
          <span className="text-right text-[13px] font-bold tabular-nums text-foreground">
            {fmt(totalUsdt)} <span className="font-normal text-muted-foreground">USDT</span>
            <span className="mx-1 font-normal text-muted-foreground">→</span>
            {fmt(totalCny)} <span className="font-normal text-muted-foreground">CNY</span>
          </span>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (months ?? []).length === 0 ? (
          <div className="py-8 text-center text-[13px] text-muted-foreground">
            Aucune vente USDT sur la période.
          </div>
        ) : (
          <div className="space-y-2.5">
            {(months ?? []).map((m) => (
              <MonthCard key={m.month} row={m} isCurrent={m.month === currentYm} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
