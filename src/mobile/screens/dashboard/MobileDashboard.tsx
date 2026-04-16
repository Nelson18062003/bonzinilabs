import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useAdminAuth, ADMIN_ROLE_LABELS } from '@/contexts/AdminAuthContext';
import { useDashboardStats } from '@/hooks/useAdminData';
import { useAdminDeposits, useDepositStats } from '@/hooks/useAdminDeposits';
import { usePaymentStats } from '@/hooks/usePaginatedPayments';
import { useCurrentExchangeRate } from '@/hooks/useExchangeRates';
import { useActiveDailyRate } from '@/hooks/useDailyRates';
import { RateCard } from '@/components/rates/RateCard';
import { useGreeting } from '@/hooks/useGreeting';
import { useCountUp } from '@/hooks/useCountUp';
import { PullToRefresh } from '@/mobile/components/ui/PullToRefresh';
import { SkeletonDashboard } from '@/mobile/components/ui/SkeletonCard';
import {
  formatCurrency,
  formatCurrencyRMB,
  formatXAF,
  formatRelativeDate,
  getDepositStatusLabel,
} from '@/lib/formatters';
import { cn } from '@/lib/utils';
import {
  Plus,
  Send,
  Users,
  BarChart3,
  ArrowDownToLine,
  ArrowUpFromLine,
  ChevronRight,
  Sparkles,
} from 'lucide-react';

export function MobileDashboard() {
  const { t } = useTranslation('common');
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { currentUser } = useAdminAuth();
  const { greeting } = useGreeting({
    firstName: currentUser?.firstName,
    lastName: currentUser?.lastName,
  });

  // Data hooks
  const { data: stats, isLoading: statsLoading } = useDashboardStats();
  const { data: depositStats } = useDepositStats();
  const { data: paymentStats } = usePaymentStats();
  const { data: currentRate } = useCurrentExchangeRate();
  const { data: activeDailyRate } = useActiveDailyRate();
  const { data: allDeposits } = useAdminDeposits();

  // Derived data
  const recentDeposits = allDeposits?.slice(0, 5) || [];
  const pendingDepositCount = depositStats?.to_process || stats?.pendingDeposits || 0;
  const pendingPaymentCount = (paymentStats?.toProcess || 0) + (paymentStats?.inProgress || 0);

  // Count-up animations
  const animatedBalance = useCountUp(stats?.totalWalletBalance || 0, {
    enabled: !statsLoading,
  });
  const animatedTodayPayments = useCountUp(stats?.todayPaymentsAmount || 0, {
    enabled: !statsLoading,
  });

  // Pull-to-refresh
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
        className="px-3 sm:px-4 lg:px-6 pb-24 space-y-4 sm:space-y-5"
        style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 1rem)' }}
      >
        {/* ── 1. SMART HEADER ── */}
        <div
          className="animate-slide-up"
          style={{ animationFillMode: 'both' }}
        >
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-xl font-bold">{greeting}</h1>
              {currentUser?.role && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary mt-1.5">
                  {ADMIN_ROLE_LABELS[currentUser.role]}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-1">
              {pendingDepositCount > 0 && (
                <button
                  onClick={() => navigate('/m/deposits')}
                  className="relative p-2.5 rounded-full bg-orange-500/10 active:scale-[0.95] transition-transform"
                >
                  <ArrowDownToLine className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                  <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] rounded-full bg-orange-500 text-[10px] text-white font-bold flex items-center justify-center px-1">
                    {pendingDepositCount}
                  </span>
                </button>
              )}
              {pendingPaymentCount > 0 && (
                <button
                  onClick={() => navigate('/m/payments')}
                  className="relative p-2.5 rounded-full bg-purple-500/10 active:scale-[0.95] transition-transform"
                >
                  <ArrowUpFromLine className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                  <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] rounded-full bg-purple-500 text-[10px] text-white font-bold flex items-center justify-center px-1">
                    {pendingPaymentCount}
                  </span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ── 2. KPI CARD ── */}
        <div
          className="card-glass p-4 sm:p-5 rounded-2xl border border-primary/20 animate-kpi-entrance"
          style={{ animationDelay: '50ms', animationFillMode: 'both' }}
        >
          <p className="text-sm text-muted-foreground">{t('platformBalance', { defaultValue: 'Solde plateforme' })}</p>
          <p
            className="text-2xl sm:text-3xl font-bold tracking-tight mt-1"
            style={{ fontVariantNumeric: 'tabular-nums' }}
          >
            {formatXAF(animatedBalance)}{' '}
            <span className="text-lg font-medium text-muted-foreground">XAF</span>
          </p>
          {currentRate && (
            <p className="text-sm text-muted-foreground mt-0.5">
              ≈ {formatCurrencyRMB(
                (stats?.totalWalletBalance || 0) * currentRate.rate_xaf_to_rmb
              )}
            </p>
          )}

          {/* Sub-indicators */}
          <div className="flex items-start gap-2 sm:gap-4 mt-3 sm:mt-4 pt-3 border-t border-border/50">
            <div className="flex-1 min-w-0">
              <p className="text-[11px] text-muted-foreground">{t('depositsToday', { defaultValue: "Dépôts aujourd'hui" })}</p>
              <p
                className="text-sm font-semibold text-green-600 dark:text-green-400"
                style={{ fontVariantNumeric: 'tabular-nums' }}
              >
                + {formatXAF(depositStats?.today_amount || 0)} XAF
              </p>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] text-muted-foreground">Paiements aujourd'hui</p>
              <p
                className="text-sm font-semibold text-red-500 dark:text-red-400"
                style={{ fontVariantNumeric: 'tabular-nums' }}
              >
                - {formatXAF(animatedTodayPayments)} XAF
              </p>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] text-muted-foreground">Volume 7j</p>
              <p
                className="text-sm font-semibold"
                style={{ fontVariantNumeric: 'tabular-nums' }}
              >
                {formatCurrency(stats?.weekVolume || 0)}
              </p>
            </div>
          </div>
        </div>

        {/* ── 3. PRIORITY BLOCK ── */}
        {(pendingDepositCount > 0 || pendingPaymentCount > 0) && (
          <div
            className="flex gap-2 sm:gap-3 animate-slide-up"
            style={{ animationDelay: '100ms', animationFillMode: 'both' }}
          >
            {pendingDepositCount > 0 && (
              <button
                onClick={() => navigate('/m/deposits')}
                className="flex-1 flex items-center gap-3 p-4 rounded-xl bg-orange-500/10 border border-orange-500/20 active:scale-[0.97] transition-transform"
              >
                <div className="w-9 h-9 rounded-full bg-orange-500 flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-bold text-white">{pendingDepositCount}</span>
                </div>
                <p className="text-sm font-semibold text-orange-700 dark:text-orange-300 text-left">
                  dépôt{pendingDepositCount > 1 ? 's' : ''} à valider
                </p>
                <ChevronRight className="w-4 h-4 text-orange-600 dark:text-orange-400 ml-auto flex-shrink-0" />
              </button>
            )}
            {pendingPaymentCount > 0 && (
              <button
                onClick={() => navigate('/m/payments')}
                className="flex-1 flex items-center gap-3 p-4 rounded-xl bg-purple-500/10 border border-purple-500/20 active:scale-[0.97] transition-transform"
              >
                <div className="w-9 h-9 rounded-full bg-purple-500 flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-bold text-white">{pendingPaymentCount}</span>
                </div>
                <p className="text-sm font-semibold text-purple-700 dark:text-purple-300 text-left">
                  paiement{pendingPaymentCount > 1 ? 's' : ''} en attente
                </p>
                <ChevronRight className="w-4 h-4 text-purple-600 dark:text-purple-400 ml-auto flex-shrink-0" />
              </button>
            )}
          </div>
        )}

        {/* ── 4. QUICK ACTIONS ── */}
        <div
          className="grid grid-cols-4 gap-2 sm:gap-3 animate-slide-up"
          style={{ animationDelay: '150ms', animationFillMode: 'both' }}
        >
          {[
            { icon: Plus, label: 'Dépôt', to: '/m/deposits/new', bg: 'bg-green-500/10', color: 'text-green-600 dark:text-green-400' },
            { icon: Send, label: 'Paiement', to: '/m/payments/new', bg: 'bg-blue-500/10', color: 'text-blue-600 dark:text-blue-400' },
            { icon: Users, label: 'Clients', to: '/m/clients', bg: 'bg-indigo-500/10', color: 'text-indigo-600 dark:text-indigo-400' },
            { icon: BarChart3, label: 'Historique', to: '/m/more/history', bg: 'bg-amber-500/10', color: 'text-amber-600 dark:text-amber-400' },
          ].map(({ icon: Icon, label, to, bg, color }) => (
            <button
              key={to}
              onClick={() => navigate(to)}
              className="flex flex-col items-center gap-2 py-3 rounded-xl active:scale-[0.95] transition-transform"
            >
              <div className={cn('w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center', bg)}>
                <Icon className={cn('w-4 h-4 sm:w-5 sm:h-5', color)} />
              </div>
              <span className="text-[11px] sm:text-xs font-medium text-muted-foreground">{label}</span>
            </button>
          ))}
        </div>

        {/* ── 5. EXCHANGE RATE CARD ── */}
        <RateCard
          rates={activeDailyRate ? {
            rate_cash: activeDailyRate.rate_cash,
            rate_alipay: activeDailyRate.rate_alipay,
            rate_wechat: activeDailyRate.rate_wechat,
            rate_virement: activeDailyRate.rate_virement,
          } : null}
          effectiveAt={activeDailyRate?.effective_at}
          detailsHref="/m/more/rates"
          className="animate-slide-up"
        />

        {/* ── 6. RECENT ACTIVITY ── */}
        {recentDeposits.length > 0 && (
          <div
            className="space-y-3 animate-slide-up"
            style={{ animationDelay: '250ms', animationFillMode: 'both' }}
          >
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Activité récente</h3>
              <button
                onClick={() => navigate('/m/deposits')}
                className="text-sm text-primary font-medium flex items-center gap-1"
              >
                Voir tous
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2">
              {recentDeposits.map((deposit) => {
                const statusColor =
                  deposit.status === 'validated'
                    ? 'text-green-600 dark:text-green-400 bg-green-500/10'
                    : deposit.status === 'rejected'
                      ? 'text-red-600 dark:text-red-400 bg-red-500/10'
                      : 'text-orange-600 dark:text-orange-400 bg-orange-500/10';

                return (
                  <button
                    key={deposit.id}
                    onClick={() => navigate(`/m/deposits/${deposit.id}`)}
                    className="w-full admin-card p-4 text-left active:scale-[0.98] transition-transform"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-primary/10 flex items-center justify-center text-xs sm:text-sm font-medium text-primary flex-shrink-0">
                          {deposit.profiles?.first_name?.[0] || '?'}
                          {deposit.profiles?.last_name?.[0] || ''}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate">
                            {deposit.profiles?.first_name} {deposit.profiles?.last_name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatRelativeDate(deposit.created_at)}
                          </p>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0 ml-3">
                        <p
                          className="font-semibold text-sm"
                          style={{ fontVariantNumeric: 'tabular-nums' }}
                        >
                          {formatCurrency(deposit.amount_xaf)}
                        </p>
                        <span
                          className={cn(
                            'text-[10px] px-1.5 py-0.5 rounded-full font-medium inline-block mt-0.5',
                            statusColor
                          )}
                        >
                          {getDepositStatusLabel(deposit.status)}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ── 7. EMPTY STATE ── */}
        {hasNoData && (
          <div className="bg-gradient-to-br from-primary/5 to-primary/10 rounded-2xl p-6 border border-primary/10 text-center space-y-3 animate-fade-in">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
              <Sparkles className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">Bienvenue sur Bonzini</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Commencez par créer vos premiers clients et configurer le taux de change.
              </p>
            </div>
            <div className="flex gap-2 justify-center pt-2">
              <button
                onClick={() => navigate('/m/clients/new')}
                className="btn-primary-gradient text-sm py-2 px-4"
              >
                Créer un client
              </button>
              <button
                onClick={() => navigate('/m/more/rates')}
                className="px-4 py-2 rounded-lg border border-border text-sm font-medium active:scale-[0.98] transition-transform"
              >
                Taux de change
              </button>
            </div>
          </div>
        )}
      </div>
    </PullToRefresh>
  );
}
