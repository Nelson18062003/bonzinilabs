/**
 * Admin home screen — quick glance + urgent actions.
 *
 * Migrated onto the shared design kit (src/mobile/designKit) — the Ofspace/Mola
 * visual language used across the whole mobile app: soft tinted canvas, white
 * cards with a soft shadow, a hero balance card with a big neutral figure,
 * neutral holders, dark pills, restrained colour (colour carries meaning only).
 *
 * Data still comes from the existing `useDashboardStats` RPC +
 * `useDepositStats` / `usePaymentStats` / `useActiveDailyRate` /
 * `useAdminDeposits` — this screen is operational (not time-series), so the
 * new TZ-safe range layer isn't required. The hooks, navigation, RateCard and
 * PullToRefresh are all preserved; only the presentation changed.
 */

import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  BarChart3,
  Plus,
  Send,
  Sparkles,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { useDashboardStats } from '@/hooks/useAdminData';
import { useAdminDeposits, useDepositStats } from '@/hooks/useAdminDeposits';
import { usePaymentStats } from '@/hooks/usePaginatedPayments';
import { useActiveDailyRate } from '@/hooks/useDailyRates';
import { RateCard } from '@/components/rates/RateCard';
import { useGreeting } from '@/hooks/useGreeting';
import { PullToRefresh } from '@/mobile/components/ui/PullToRefresh';
import { SkeletonDashboard } from '@/mobile/components/ui/SkeletonCard';
import { formatCurrency, formatCurrencyFull } from '@/components/analytics';
import {
  formatRelativeDate,
  getDepositStatusLabel,
} from '@/lib/formatters';
import { cn } from '@/lib/utils';
import {
  SURFACE,
  TEXT,
  PRIMARY_PILL,
  SOFT_PILL,
  depositStatusTone,
  roleMeta,
  Card,
  Amount,
  Avatar,
  Holder,
  StatCard,
  StatusPill,
  SectionTitle,
} from '@/mobile/designKit';

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
  const { data: activeDailyRate } = useActiveDailyRate();
  const { data: allDeposits } = useAdminDeposits();

  const recentDeposits = allDeposits?.slice(0, 5) || [];
  const pendingDepositCount = depositStats?.to_process || stats?.pendingDeposits || 0;
  const pendingPaymentCount = (paymentStats?.toProcess || 0) + (paymentStats?.inProgress || 0);
  const balanceXAF = stats?.totalWalletBalance ?? 0;
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
      <div className={cn('flex min-h-full flex-col', SURFACE.canvas)}>
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

  const role = currentUser?.role;

  return (
    <PullToRefresh onRefresh={handleRefresh} className={cn('flex-1 overflow-y-auto', SURFACE.canvas)}>
      <div
        className="space-y-6 px-4 pb-24"
        style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 1.25rem)' }}
      >
        {/* ── 1. GREETING ── */}
        <header className="flex items-start justify-between gap-3 px-1">
          <div className="min-w-0">
            <h1 className={cn('truncate text-[22px] font-extrabold tracking-tight', TEXT.strong)}>{greeting}</h1>
            {role ? (
              <div className="mt-1.5">
                <StatusPill tone={roleMeta(role).tone} label={roleMeta(role).label} />
              </div>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {pendingDepositCount > 0 ? (
              <button
                onClick={() => navigate('/m/deposits')}
                aria-label={`${pendingDepositCount} dépôts en attente`}
                className="relative"
              >
                <Holder icon={ArrowDownToLine} tone="pending" />
                <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#FE560D] px-1 text-[10px] font-bold text-white">
                  {pendingDepositCount}
                </span>
              </button>
            ) : null}
            {pendingPaymentCount > 0 ? (
              <button
                onClick={() => navigate('/m/payments')}
                aria-label={`${pendingPaymentCount} paiements en attente`}
                className="relative"
              >
                <Holder icon={ArrowUpFromLine} tone="info" />
                <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#6B5BD2] px-1 text-[10px] font-bold text-white">
                  {pendingPaymentCount}
                </span>
              </button>
            ) : null}
          </div>
        </header>

        {/* ── 2. HERO — platform balance ── */}
        <Card className="p-5">
          <div className="flex items-center gap-3">
            <Holder icon={Wallet} tone="info" size="lg" />
            <div className="min-w-0 flex-1">
              <p className={cn('text-[12px] font-medium', TEXT.muted)}>
                {t('platformBalance', { defaultValue: 'Solde plateforme' })}
              </p>
              <Amount value={formatCurrency(balanceXAF, 'XAF', { compact: true })} size="xl" className="mt-1.5" />
            </div>
          </div>
          <p className={cn('mt-3 text-[12px] leading-snug', TEXT.muted)}>
            {t('platformBalanceHint', {
              defaultValue: 'Somme totale XAF détenue par tous les wallets clients à l’instant T.',
            })}
          </p>
        </Card>

        {/* ── 3. SECONDARY KPIs ── */}
        <div className="grid grid-cols-3 gap-3">
          <StatCard
            icon={TrendingUp}
            tone="info"
            label={t('volume7days', { defaultValue: 'Volume 7j' })}
            value={formatCurrency(weekVolume, 'XAF', { compact: true })}
          />
          <StatCard
            tone="success"
            label={t('depositsToday', { defaultValue: 'Dépôts auj.' })}
            value={formatCurrency(todayDepositAmount, 'XAF', { compact: true })}
          />
          <StatCard
            tone="pending"
            label={t('paymentsToday', { defaultValue: 'Paiements auj.' })}
            value={formatCurrency(todayPaymentAmount, 'XAF', { compact: true })}
          />
        </div>

        {/* ── 4. PRIORITY ── */}
        {(pendingDepositCount > 0 || pendingPaymentCount > 0) ? (
          <section>
            <SectionTitle>{t('toProcess', { defaultValue: 'À traiter' })}</SectionTitle>
            <div className="space-y-2.5">
              {pendingDepositCount > 0 ? (
                <Card
                  role="button"
                  tabIndex={0}
                  onClick={() => navigate('/m/deposits')}
                  onKeyDown={(e) => e.key === 'Enter' && navigate('/m/deposits')}
                  className="flex cursor-pointer items-center gap-3 transition active:scale-[0.99]"
                >
                  <Holder tone="pending" size="md">
                    <span className="text-[15px] font-bold tabular-nums">{pendingDepositCount}</span>
                  </Holder>
                  <p className={cn('flex-1 text-[14px] font-semibold', TEXT.strong)}>
                    {t('depositsToValidate', {
                      defaultValue: 'dépôt(s) à valider',
                      count: pendingDepositCount,
                    })}
                  </p>
                  <StatusPill tone="pending" label={t('toProcess', { defaultValue: 'À traiter' })} />
                </Card>
              ) : null}
              {pendingPaymentCount > 0 ? (
                <Card
                  role="button"
                  tabIndex={0}
                  onClick={() => navigate('/m/payments')}
                  onKeyDown={(e) => e.key === 'Enter' && navigate('/m/payments')}
                  className="flex cursor-pointer items-center gap-3 transition active:scale-[0.99]"
                >
                  <Holder tone="info" size="md">
                    <span className="text-[15px] font-bold tabular-nums">{pendingPaymentCount}</span>
                  </Holder>
                  <p className={cn('flex-1 text-[14px] font-semibold', TEXT.strong)}>
                    {t('paymentsPending', {
                      defaultValue: 'paiement(s) en attente',
                      count: pendingPaymentCount,
                    })}
                  </p>
                  <StatusPill tone="info" label={t('inProgress', { defaultValue: 'En cours' })} />
                </Card>
              ) : null}
            </div>
          </section>
        ) : null}

        {/* ── 5. QUICK ACTIONS ── */}
        <Card>
          <div className="grid grid-cols-4 gap-1">
            {[
              { icon: Plus, label: t('deposit', { defaultValue: 'Dépôt' }), to: '/m/deposits/new', tone: 'success' as const },
              { icon: Send, label: t('payment', { defaultValue: 'Paiement' }), to: '/m/payments/new', tone: 'info' as const },
              { icon: Users, label: t('clients', { defaultValue: 'Clients' }), to: '/m/clients', tone: 'pending' as const },
              { icon: BarChart3, label: 'Analytics', to: '/m/dashboard', tone: 'neutral' as const },
            ].map(({ icon: Icon, label, to, tone }) => (
              <button
                key={to}
                onClick={() => navigate(to)}
                className="flex flex-col items-center gap-2 py-1.5 transition active:scale-[0.96]"
              >
                <Holder icon={Icon} tone={tone} size="lg" />
                <span className={cn('text-[12px] font-medium', TEXT.muted)}>{label}</span>
              </button>
            ))}
          </div>
        </Card>

        {/* ── 6. RATES ── */}
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

        {/* ── 7. RECENT ACTIVITY ── */}
        {recentDeposits.length > 0 ? (
          <section>
            <SectionTitle action={{ label: t('viewAll', { defaultValue: 'Voir tous' }), onClick: () => navigate('/m/deposits') }}>
              {t('recentActivity', { defaultValue: 'Activité récente' })}
            </SectionTitle>
            <Card className="space-y-1 p-2">
              {recentDeposits.map((deposit) => {
                const name = `${deposit.profiles?.first_name ?? ''} ${deposit.profiles?.last_name ?? ''}`.trim() || 'Client';

                return (
                  <button
                    key={deposit.id}
                    onClick={() => navigate(`/m/deposits/${deposit.id}`)}
                    className="flex w-full items-center gap-3 rounded-2xl p-2 text-left transition active:scale-[0.99]"
                  >
                    <Avatar name={name} />
                    <div className="min-w-0 flex-1">
                      <p className={cn('truncate text-[14px] font-semibold', TEXT.strong)}>{name}</p>
                      <p className={cn('text-[12px]', TEXT.muted)}>
                        {formatRelativeDate(deposit.created_at)}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <Amount value={formatCurrencyFull(deposit.amount_xaf, 'XAF')} size="md" />
                      <StatusPill tone={depositStatusTone(deposit.status)} label={getDepositStatusLabel(deposit.status)} />
                    </div>
                  </button>
                );
              })}
            </Card>
          </section>
        ) : null}

        {/* ── 8. EMPTY STATE ── */}
        {hasNoData ? (
          <Card className="flex flex-col items-center p-6 text-center">
            <Holder icon={Sparkles} tone="info" size="lg" />
            <h3 className={cn('mt-3 text-[17px] font-bold', TEXT.strong)}>
              {t('welcomeToBonzini', { defaultValue: 'Bienvenue sur Bonzini' })}
            </h3>
            <p className={cn('mt-1 text-[13px]', TEXT.muted)}>
              {t('welcomeMessage', {
                defaultValue: 'Commencez par créer vos premiers clients et configurer le taux de change.',
              })}
            </p>
            <div className="mt-4 flex justify-center gap-2">
              <button
                onClick={() => navigate('/m/clients/new')}
                className={cn('rounded-full px-5 py-2.5 text-[13px] font-bold', PRIMARY_PILL)}
              >
                {t('createClient', { defaultValue: 'Créer un client' })}
              </button>
              <button
                onClick={() => navigate('/m/more/rates')}
                className={cn('rounded-full px-5 py-2.5 text-[13px] font-semibold', SOFT_PILL)}
              >
                {t('exchangeRate', { defaultValue: 'Taux de change' })}
              </button>
            </div>
          </Card>
        ) : null}
      </div>
    </PullToRefresh>
  );
}
