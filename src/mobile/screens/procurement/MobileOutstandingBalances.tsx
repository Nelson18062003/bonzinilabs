import { Navigate } from 'react-router-dom';
import { Wallet } from 'lucide-react';
import { MobileHeader } from '@/mobile/components/layout/MobileHeader';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { useOutstandingBalances } from '@/hooks/useProcurement';
import type { ByCurrency, ProcCurrency } from '@/integrations/supabase/procurement';
import { IconChip, SectionTitle, SOFT_CARD } from '@/components/treasury/ui';
import { cn } from '@/lib/utils';

export function MobileOutstandingBalances() {
  const { hasPermission } = useAdminAuth();
  const { data, isLoading } = useOutstandingBalances();

  if (!hasPermission('canViewProcurement')) {
    return <Navigate to="/m/more" replace />;
  }

  const rows = data?.rows ?? [];
  const totals: ByCurrency = data?.outstanding_by_currency ?? {};
  const totalsEntries = (Object.entries(totals) as [ProcCurrency, number][]).filter(([, v]) => Math.abs(v) > 0.000001);

  return (
    <div className="flex flex-col min-h-full bg-background">
      <MobileHeader title="Reste à payer" showBack backTo="/m/more/procurement" />

      <div className="px-5 py-6 space-y-6">
        {totalsEntries.length > 0 && (
          <section>
            <SectionTitle>Total dû</SectionTitle>
            <div className="flex flex-wrap gap-2.5">
              {totalsEntries.map(([cur, amt]) => (
                <div key={cur} className={cn(SOFT_CARD, 'flex-1 min-w-[120px] p-3.5')}>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{cur}</div>
                  <div className="mt-1 text-[18px] font-extrabold tabular-nums text-foreground">{amt.toLocaleString('fr-FR')}</div>
                </div>
              ))}
            </div>
          </section>
        )}

        <section>
          <SectionTitle>Commandes ouvertes</SectionTitle>
          {isLoading ? (
            <div className="py-10 text-center text-[13px] text-muted-foreground">Chargement…</div>
          ) : rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
              <IconChip icon={Wallet} tone="orange" size="lg" />
              <div className="text-[14px] font-semibold text-foreground">Aucun reste à payer</div>
              <div className="max-w-[260px] text-[12px] text-muted-foreground">Toutes les commandes sont soldées (ou aucune n'a encore été saisie).</div>
            </div>
          ) : (
            <div className={cn(SOFT_CARD, 'divide-y divide-border')}>
              {rows.map((r) => (
                <div key={r.purchase_order_id} className="p-3.5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-[14px] font-semibold text-foreground">{r.supplier_name}</div>
                      <div className="truncate text-[11px] text-muted-foreground">{r.reference} · {r.mission_label}</div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-[15px] font-extrabold tabular-nums text-bonzini-orange">
                        {r.outstanding_amount.toLocaleString('fr-FR')} {r.currency}
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        {r.paid_amount.toLocaleString('fr-FR')} / {r.total_amount.toLocaleString('fr-FR')}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
