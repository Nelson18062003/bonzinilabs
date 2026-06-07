import { Navigate, useNavigate } from 'react-router-dom';
import {
  Wallet,
  AlertTriangle,
  Boxes,
  ClipboardCheck,
  Ship,
  Receipt,
  ListChecks,
} from 'lucide-react';
import { MobileHeader } from '@/mobile/components/layout/MobileHeader';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { useProcurementDashboard } from '@/hooks/useProcurement';
import type { ByCurrency, ProcCurrency } from '@/integrations/supabase/procurement';
import {
  ActionTile,
  IconChip,
  SectionTitle,
  SOFT_CARD,
  TONE_DOT,
  TONE_TEXT,
  type Tone,
} from '@/components/treasury/ui';
import { cn } from '@/lib/utils';

const CURRENCY_TONE: Record<ProcCurrency, Exclude<Tone, 'neutral' | 'danger'>> = {
  CNY: 'orange',
  XAF: 'violet',
};

function compact(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} M`;
  return n.toLocaleString('fr-FR', { maximumFractionDigits: 0 });
}

function OutstandingCard({ currency, amount }: { currency: ProcCurrency; amount: number }) {
  const tone = CURRENCY_TONE[currency];
  return (
    <div className={cn(SOFT_CARD, 'p-3.5')}>
      <div className="mb-2.5 flex items-center gap-1.5">
        <span className={cn('h-2 w-2 shrink-0 rounded-full', TONE_DOT[tone])} />
        <span className={cn('text-[10px] font-bold uppercase tracking-wider', TONE_TEXT[tone])}>{currency}</span>
      </div>
      <div className="text-[18px] font-extrabold leading-none tracking-tight tabular-nums text-foreground">{compact(amount)}</div>
      <div className="mt-1.5 text-[10px] text-muted-foreground">reste à payer</div>
    </div>
  );
}

export function MobileProcurementHome() {
  const navigate = useNavigate();
  const { hasPermission } = useAdminAuth();
  const { data, isLoading } = useProcurementDashboard();

  if (!hasPermission('canViewProcurement')) {
    return <Navigate to="/m/more" replace />;
  }

  const outstanding: ByCurrency = data?.outstanding_by_currency ?? {};
  const outstandingEntries = (Object.entries(outstanding) as [ProcCurrency, number][])
    .filter(([, v]) => Math.abs(v) > 0.000001);
  const alertNoQc = data?.alerts?.balance_without_qc_pass ?? [];
  const alertOverdue = data?.alerts?.production_overdue ?? [];
  const recent = data?.recent_payments ?? [];
  const alertCount = alertNoQc.length + alertOverdue.length;

  return (
    <div className="flex flex-col min-h-full bg-background">
      <MobileHeader title="Centrale d'achat" showBack backTo="/m/more" />

      <div className="px-5 py-6 space-y-7">
        {/* KPIs */}
        <section>
          <SectionTitle>Vue d'ensemble</SectionTitle>
          <div className="grid grid-cols-3 gap-2.5">
            <div className={cn(SOFT_CARD, 'p-3.5')}>
              <div className="mb-2.5 flex items-center gap-1.5">
                <Boxes className="h-3.5 w-3.5 text-bonzini-amber" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-bonzini-amber">Missions</span>
              </div>
              <div className="text-[18px] font-extrabold leading-none tabular-nums text-foreground">
                {isLoading ? '—' : data?.active_mission_count ?? 0}
              </div>
              <div className="mt-1.5 text-[10px] text-muted-foreground">actives</div>
            </div>
            {outstandingEntries.length > 0
              ? outstandingEntries.slice(0, 2).map(([cur, amt]) => <OutstandingCard key={cur} currency={cur} amount={amt} />)
              : <div className={cn(SOFT_CARD, 'col-span-2 flex items-center justify-center p-3.5 text-[12px] text-muted-foreground')}>
                  {isLoading ? 'Chargement…' : 'Aucun reste à payer'}
                </div>}
          </div>
        </section>

        {/* Alertes */}
        {alertCount > 0 && (
          <section>
            <SectionTitle>Alertes ({alertCount})</SectionTitle>
            <div className="space-y-2.5">
              {alertNoQc.map((a) => (
                <button
                  key={`qc-${a.purchase_order_id}`}
                  onClick={() => navigate('/m/more/procurement/outstanding')}
                  className={cn(SOFT_CARD, 'flex w-full items-center gap-3 p-3.5 text-left active:scale-[0.99]')}
                >
                  <IconChip icon={ClipboardCheck} tone="danger" size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-semibold text-foreground">{a.reference} · {a.supplier_name}</div>
                    <div className="text-[11px] text-red-600 dark:text-red-400">Solde payé sans QC « pass »</div>
                  </div>
                </button>
              ))}
              {alertOverdue.map((a) => (
                <button
                  key={`prod-${a.purchase_order_id}`}
                  onClick={() => navigate('/m/more/procurement/outstanding')}
                  className={cn(SOFT_CARD, 'flex w-full items-center gap-3 p-3.5 text-left active:scale-[0.99]')}
                >
                  <IconChip icon={Ship} tone="amber" size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-semibold text-foreground">{a.reference} · {a.supplier_name}</div>
                    <div className="text-[11px] text-bonzini-amber">Production en retard (prévue {a.expected_ready_date ?? '—'})</div>
                  </div>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Navigation */}
        <section>
          <SectionTitle>Suivi</SectionTitle>
          <div className="space-y-2.5">
            <ActionTile
              icon={Wallet}
              label="Reste à payer"
              description="Soldes ouverts par commande"
              onClick={() => navigate('/m/more/procurement/outstanding')}
              tone="orange"
            />
          </div>
        </section>

        {/* Paiements récents */}
        {recent.length > 0 && (
          <section>
            <SectionTitle>Paiements récents</SectionTitle>
            <div className={cn(SOFT_CARD, 'divide-y divide-border')}>
              {recent.map((p) => (
                <div key={p.id} className="flex items-center gap-3 p-3.5">
                  <IconChip icon={Receipt} tone="neutral" size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-semibold text-foreground">{p.supplier_name}</div>
                    <div className="truncate text-[11px] text-muted-foreground">{p.po_reference} · {p.leg}</div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-[13px] font-bold tabular-nums text-foreground">
                      {p.amount.toLocaleString('fr-FR')} {p.currency}
                    </div>
                    <div className="text-[10px] text-muted-foreground">{new Date(p.occurred_at).toLocaleDateString('fr-FR')}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* État vide global */}
        {!isLoading && data && outstandingEntries.length === 0 && recent.length === 0 && alertCount === 0 && (
          <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
            <IconChip icon={ListChecks} tone="violet" size="lg" />
            <div className="text-[14px] font-semibold text-foreground">Rien à afficher pour l'instant</div>
            <div className="max-w-[260px] text-[12px] text-muted-foreground">
              Les missions, commandes et paiements apparaîtront ici dès la première saisie.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
