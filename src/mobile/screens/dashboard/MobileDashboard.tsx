/**
 * Admin home screen — quick glance + urgent actions.
 *
 * Consumes the new analytics primitives (<KpiCard>, <KpiRow>) on top of
 * shadcn <Card>. Matches the visual language of the /m/dashboard page
 * so the two screens feel like one product.
 *
 * Data still comes from the existing `useDashboardStats` RPC +
 * `useDepositStats` / `usePaymentStats` — this screen is operational
 * (not time-series), so the new TZ-safe range layer isn't required.
 */

import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  BarChart3,
  ChevronRight,
  Plus,
  Send,
  Sparkles,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react';
import { useAdminAuth, ADMIN_ROLE_LABELS } from '@/contexts/AdminAuthContext';
import { useDashboardStats } from '@/hooks/useAdminData';
import { useAdminDeposits, useDepositStats } from '@/hooks/useAdminDeposits';
import { usePaymentStats } from '@/hooks/usePaginatedPayments';
import { useCurrentExchangeRate } from '@/hooks/useExchangeRates';
import { useActiveDailyRate } from '@/hooks/useDailyRates';
import { RateCard } from '@/components/rates/RateCard';
import { useGreeting } from '@/hooks/useGreeting';
import { PullToRefresh } from '@/mobile/components/ui/PullToRefresh';
import { SkeletonDashboard } from '@/mobile/components/ui/SkeletonCard';
import { KpiCard, KpiRow, formatCurrency } from '@/components/analytics';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  formatCurrencyRMB,
  formatRelativeDate,
  getDepositStatusLabel,
} from '@/lib/formatters';
import { cn } from '@/lib/utils';

export function MobileDashboard() {
  const { t } = useTranslation('common');
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { currentUser } = useAdminAuth();
  const { greeting } = useGreeting({
    firstName: currentUser?.firstName,
    lastName: currentUser?.lastName,
  });

  const { data: stats, isLoading: statsLoading } = useDashboardStats();
  const { data: depositStats } = useDepositStats();
  const { data: paymentStats } = usePaymentStats();
  const { data: currentRate } = useCurrentExchangeRate();
  const { data: activeDailyRate } = useActiveDailyRate();
  const { data: allDeposits } = useAdminDeposits();

  const recentDeposits = allDeposits?.slice(0, 5) || [];
  const pendingDepositCount = depositStats?.to_process || stats?.pendingDeposits || 0;
  const pendingPaymentCount = (paymentStats?.toProcess || 0) + (paymentStats?.inProgress || 0);
  const balanceXAF = stats?.totalWalletBalance ?? 0;
  const balanceRMB = currentRate ? balanceXAF * currentRate.rate_xaf_to_rmb : null;
  const todayDepositAmount = depositStats?.today_amount ?? 0;
  const todayPaymentAmount = stats?.todayPaymentsAmount ?? 0;
  const weekVolume = stats?.weekVolume ?? 0;

  const handleRefresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] }),
      queryClient.invalidateQueries({ queryKey: ['deposit-stats'] }),
      queryClient.invalidateQueries({ queryKey: ['payment-stats'] }),
      queryClient.invalidateQueries({ queryKey: ['exchange-rate'] }),
      queryClient.invalidateQueries({ queryKey: ['admin-deposits'] }),
    ]);
  };

  if (statsLoading) {
    return (
      <div className="flex flex-col min-h-full">
        <SkeletonDashboard />
      </div>
    );
  }

  const hasNoData =
    stats &&
    !stats.activeClients &&
    !stats.pendingDeposits &&
    !pendingPaymentCount &&
    recentDeposits.length === 0;

  return (
    <PullToRefresh onRefresh={handleRefresh} className="flex-1 overflow-y-auto">
      <div
        className="px-4 pb-24 space-y-5"
        style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 1rem)' }}
      >
        {/* ── 1. GREETING ── */}
        <header className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold">{greeting}</h1>
            {currentUser?.role ? (
              <span className="mt-1.5 inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                {ADMIN_ROLE_LABELS[currentUser.role]}
              </span>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            {pendingDepositCount > 0 ? (
              <button
                onClick={() => navigate('/m/deposits')}
                aria-label={`${pendingDepositCount} dépôts en attente`}
                className="relative rounded-full bg-orange-500/10 p-2.5 active:scale-[0.95] transition-transform"
              >
                <ArrowDownToLine className="h-5 w-5 text-orange-600" />
                <span className="absolute -top-0.5 -right-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-orange-500 px-1 text-[10px] font-bold text-white">
                  {pendingDepositCount}
                </span>
              </button>
            ) : null}
            {pendingPaymentCount > 0 ? (
              <button
                onClick={() => navigate('/m/payments')}
                aria-label={`${pendingPaymentCount} paiements en attente`}
                className="relative rounded-full bg-purple-500/10 p-2.5 active:scale-[0.95] transition-transform"
              >
                <ArrowUpFromLine className="h-5 w-5 text-purple-600" />
                <span className="absolute -top-0.5 -right-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-purple-500 px-1 text-[10px] font-bold text-white">
                  {pendingPaymentCount}
                </span>
              </button>
            ) : null}
          </div>
        </header>

        {/* ── 2. KPI HERO — same primitives as /m/dashboard ── */}
        <KpiRow columns={2}>
          <KpiCard
            accent="violet"
            icon={<Wallet className="h-4 w-4" />}
            label="Solde plateforme"
            value={formatCurrency(balanceXAF, 'XAF', { compact: true })}
            secondary={balanceRMB != null ? `≈ ${formatCurrencyRMB(balanceRMB)}` : undefined}
            description="Somme totale XAF actuellement détenue par tous les wallets clients — ton engagement financier à l'instant T."
          />
          <KpiCard
            accent="amber"
            icon={<TrendingUp className="h-4 w-4" />}
            label="Volume 7 jours"
            value={formatCurrency(weekVolume, 'XAF', { compact: true })}
            description="Volume cumulé des paiements exécutés sur les 7 derniers jours."
          />
          <KpiCard
            accent="emerald"
            label="Dépôts aujourd'hui"
            value={formatCurrency(todayDepositAmount, 'XAF', { compact: true })}
            description="Dépôts validés depuis minuit (heure Douala)."
          />
          <KpiCard
            accent="orange"
            label="Paiements aujourd'hui"
            value={formatCurrency(todayPaymentAmount, 'XAF', { compact: true })}
            description="Paiements exécutés depuis minuit (heure Douala)."
          />
        </KpiRow>

        {/* ── 3. PRIORITY ACTIONS ── */}
        {(pendingDepositCount > 0 || pendingPaymentCount > 0) ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {pendingDepositCount > 0 ? (
              <Card
                role="button"
                tabIndex={0}
                onClick={() => navigate('/m/deposits')}
                onKeyDown={(e) => e.key === 'Enter' && navigate('/m/deposits')}
                className="cursor-pointer border-orange-500/20 bg-orange-500/10 p-4 transition-transform active:scale-[0.98]"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-orange-500 text-sm font-bold text-white">
                    {pendingDepositCount}
                  </div>
                  <p className="flex-1 text-left text-sm font-semibold text-orange-700">
                    {t('depositsToValidate', {
                      defaultValue: 'dépôt(s) à valider',
                      count: pendingDepositCount,
                    })}
                  </p>
                  <ChevronRight className="h-4 w-4 flex-shrink-0 text-orange-600" />
                </div>
              </Card>
            ) : null}
            {pendingPaymentCount > 0 ? (
              <Card
                role="button"
                tabIndex={0}
                onClick={() => navigate('/m/payments')}
                onKeyDown={(e) => e.key === 'Enter' && navigate('/m/payments')}
                className="cursor-pointer border-purple-500/20 bg-purple-500/10 p-4 transition-transform active:scale-[0.98]"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-purple-500 text-sm font-bold text-white">
                    {pendingPaymentCount}
                  </div>
                  <p className="flex-1 text-left text-sm font-semibold text-purple-700">
                    {t('paymentsPending', {
                      defaultValue: 'paiement(s) en attente',
                      count: pendingPaymentCount,
                    })}
                  </p>
                  <ChevronRight className="h-4 w-4 flex-shrink-0 text-purple-600" />
                </div>
              </Card>
            ) : null}
          </div>
        ) : null}

        {/* ── 4. QUICK ACTIONS ── */}
        <div className="grid grid-cols-4 gap-2">
          {[
            { icon: Plus, label: t('deposit', { defaultValue: 'Dépôt' }), to: '/m/deposits/new', bg: 'bg-emerald-500/10', color: 'text-emerald-600' },
            { icon: Send, label: t('payment', { defaultValue: 'Paiement' }), to: '/m/payments/new', bg: 'bg-blue-500/10', color: 'text-blue-600' },
            { icon: Users, label: t('clients', { defaultValue: 'Clients' }), to: '/m/clients', bg: 'bg-indigo-500/10', color: 'text-indigo-600' },
            { icon: BarChart3, label: 'Analytics', to: '/m/dashboard', bg: 'bg-amber-500/10', color: 'text-amber-600' },
          ].map(({ icon: Icon, label, to, bg, color }) => (
            <button
              key={to}
              onClick={() => navigate(to)}
              className="flex flex-col items-center gap-2 py-3 transition-transform active:scale-[0.95]"
            >
              <div className={cn('flex h-12 w-12 items-center justify-center rounded-full', bg)}>
                <Icon className={cn('h-5 w-5', color)} />
              </div>
              <span className="text-xs font-medium text-muted-foreground">{label}</span>
            </button>
          ))}
        </div>

        {/* ── 5. RATES ── */}
        <RateCard
          rates={activeDailyRate ? {
            rate_cash: activeDailyRate.rate_cash,
            rate_alipay: activeDailyRate.rate_alipay,
            rate_wechat: activeDailyRate.rate_wechat,
            rate_virement: activeDailyRate.rate_virement,
          } : null}
          effectiveAt={activeDailyRate?.effective_at}
          detailsHref="/m/more/rates"
        />

        {/* ── 6. RECENT ACTIVITY ── */}
        {recentDeposits.length > 0 ? (
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <h3 className="text-sm font-semibold">
                {t('recentActivity', { defaultValue: 'Activité récente' })}
              </h3>
              <button
                onClick={() => navigate('/m/deposits')}
                className="flex items-center gap-1 text-xs font-medium text-primary"
              >
                {t('viewAll', { defaultValue: 'Voir tous' })}
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>

            <ul className="divide-y divide-border">
              {recentDeposits.map((deposit) => {
                const statusColor =
                  deposit.status === 'validated'
                    ? 'text-emerald-600 bg-emerald-500/10'
                    : deposit.status === 'rejected'
                      ? 'text-red-600 bg-red-500/10'
                      : 'text-orange-600 bg-orange-500/10';
                const name = `${deposit.profiles?.first_name ?? ''} ${deposit.profiles?.last_name ?? ''}`.trim() || 'Client';
                const initials = `${deposit.profiles?.first_name?.[0] ?? '?'}${deposit.profiles?.last_name?.[0] ?? ''}`;

                return (
                  <li key={deposit.id}>
                    <button
                      onClick={() => navigate(`/m/deposits/${deposit.id}`)}
                      className="flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-muted/50"
                    >
                      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                        {initials}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{name}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatRelativeDate(deposit.created_at)}
                        </p>
                      </div>
                      <div className="flex-shrink-0 text-right">
                        <p className="text-sm font-semibold tabular-nums">
                          {formatCurrency(deposit.amount_xaf, 'XAF', { compact: true })}
                        </p>
                        <span
                          className={cn(
                            'mt-0.5 inline-block rounded-full px-1.5 py-0.5 text-[10px] font-medium',
                            statusColor,
                          )}
                        >
                          {getDepositStatusLabel(deposit.status)}
                        </span>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </Card>
        ) : null}

        {/* ── 7. EMPTY STATE ── */}
        {hasNoData ? (
          <Card className="bg-gradient-to-br from-primary/5 to-primary/10 p-6 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <Sparkles className="h-6 w-6 text-primary" />
            </div>
            <h3 className="mt-3 text-lg font-semibold">
              {t('welcomeToBonzini', { defaultValue: 'Bienvenue sur Bonzini' })}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {t('welcomeMessage', {
                defaultValue: 'Commencez par créer vos premiers clients et configurer le taux de change.',
              })}
            </p>
            <div className="mt-4 flex justify-center gap-2">
              <Button onClick={() => navigate('/m/clients/new')} size="sm">
                {t('createClient', { defaultValue: 'Créer un client' })}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/m/more/rates')}
              >
                {t('exchangeRate', { defaultValue: 'Taux de change' })}
              </Button>
            </div>
          </Card>
        ) : null}
      </div>
    </PullToRefresh>
  );
}
