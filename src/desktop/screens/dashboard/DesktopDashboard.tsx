/**
 * Desktop admin home — the same operational glance as MobileDashboard, laid out
 * for a wide screen: a 4-up KPI strip, a two-column body (priority queue +
 * recent-activity table on the left, rates / Mola / quick actions on the right).
 *
 * Reuses the exact same data hooks and design-kit primitives as the mobile
 * screen — only the presentation differs, so the two never drift apart.
 */
import { type ElementType } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  BarChart3,
  ChevronRight,
  LifeBuoy,
  Send,
  Sparkles,
  TrendingUp,
  UserPlus,
  Wallet,
} from 'lucide-react';
import { MolaMascot } from '@/components/MolaMascot';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { useDashboardStats } from '@/hooks/useAdminData';
import { useAdminDeposits, useDepositStats } from '@/hooks/useAdminDeposits';
import { usePaymentStats } from '@/hooks/usePaginatedPayments';
import { useActiveDailyRate } from '@/hooks/useDailyRates';
import { useGreeting } from '@/hooks/useGreeting';
import { RateCard } from '@/components/rates/RateCard';
import { formatCurrency, formatCurrencyFull } from '@/components/analytics';
import { formatRelativeDate, getDepositStatusLabel } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import {
  TEXT,
  PRIMARY_PILL,
  SOFT_PILL,
  depositStatusTone,
  roleMeta,
  Card,
  Amount,
  Avatar,
  Holder,
  StatusPill,
  ScreenLoader,
  type Tone,
} from '@/mobile/designKit';

function Kpi({
  icon: Icon,
  tone,
  label,
  value,
  hint,
}: {
  icon: ElementType;
  tone: Tone;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <Card className="p-5">
      <Holder icon={Icon} tone={tone} size="lg" />
      <p className={cn('mt-4 text-[12px] font-medium', TEXT.muted)}>{label}</p>
      <Amount value={value} size="lg" className="mt-1.5" />
      <p className={cn('mt-2 text-[11px] leading-snug', TEXT.muted)}>{hint}</p>
    </Card>
  );
}

export function DesktopDashboard() {
  const navigate = useNavigate();
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

  const recentDeposits = allDeposits?.slice(0, 6) ?? [];
  const pendingDepositCount = depositStats?.to_process || stats?.pendingDeposits || 0;
  const pendingPaymentCount = (paymentStats?.toProcess || 0) + (paymentStats?.inProgress || 0);
  const balanceXAF = stats?.totalWalletBalance ?? 0;
  const todayDepositAmount = depositStats?.today_amount ?? 0;
  const todayPaymentAmount = stats?.todayPaymentsAmount ?? 0;
  const weekVolume = stats?.weekVolume ?? 0;

  if (statsLoading) return <ScreenLoader />;

  const role = currentUser?.role;
  const quickActions = [
    { icon: UserPlus, label: 'Nouveau client', to: '/m/clients/new', tone: 'success' as const },
    { icon: BarChart3, label: 'Analytics', to: '/m/dashboard', tone: 'info' as const },
    { icon: ArrowDownToLine, label: 'Dépôts', to: '/m/deposits', tone: 'pending' as const },
    { icon: LifeBuoy, label: 'Support', to: '/m/support', tone: 'neutral' as const },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h2 className={cn('text-[26px] font-extrabold tracking-tight', TEXT.strong)}>{greeting}</h2>
          <div className="mt-1.5 flex items-center gap-2">
            {role ? <StatusPill tone={roleMeta(role).tone} label={roleMeta(role).label} /> : null}
            <span className={cn('text-[13px]', TEXT.muted)}>Vue opérationnelle de la plateforme</span>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => navigate('/m/deposits/new')}
            className={cn('inline-flex items-center gap-2 px-4 py-2.5 text-[13px] font-bold', SOFT_PILL)}
          >
            <ArrowDownToLine className="h-4 w-4" /> Nouveau dépôt
          </button>
          <button
            onClick={() => navigate('/m/payments/new')}
            className={cn('inline-flex items-center gap-2 px-4 py-2.5 text-[13px] font-bold', PRIMARY_PILL)}
          >
            <Send className="h-4 w-4" /> Nouveau paiement
          </button>
        </div>
      </header>

      {/* KPI strip */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          icon={Wallet}
          tone="info"
          label="Solde plateforme"
          value={formatCurrency(balanceXAF, 'XAF', { compact: true })}
          hint="Total XAF détenu par tous les wallets clients."
        />
        <Kpi
          icon={TrendingUp}
          tone="info"
          label="Volume 7 jours"
          value={formatCurrency(weekVolume, 'XAF', { compact: true })}
          hint="Flux traité sur les 7 derniers jours."
        />
        <Kpi
          icon={ArrowDownToLine}
          tone="success"
          label="Dépôts aujourd'hui"
          value={formatCurrency(todayDepositAmount, 'XAF', { compact: true })}
          hint="Entrées de fonds du jour."
        />
        <Kpi
          icon={ArrowUpFromLine}
          tone="pending"
          label="Paiements aujourd'hui"
          value={formatCurrency(todayPaymentAmount, 'XAF', { compact: true })}
          hint="Règlements fournisseurs du jour."
        />
      </section>

      {/* Body */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left */}
        <div className="space-y-6 lg:col-span-8">
          {/* Priority queue */}
          {pendingDepositCount > 0 || pendingPaymentCount > 0 ? (
            <div>
              <h3 className={cn('mb-3 text-[15px] font-bold', TEXT.strong)}>À traiter</h3>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {pendingDepositCount > 0 ? (
                  <Card
                    role="button"
                    tabIndex={0}
                    onClick={() => navigate('/m/deposits')}
                    onKeyDown={(e) => e.key === 'Enter' && navigate('/m/deposits')}
                    className="flex cursor-pointer items-center gap-3 p-4 transition hover:-translate-y-0.5"
                  >
                    <Holder tone="pending" size="lg">
                      <span className="text-[17px] font-extrabold tabular-nums">{pendingDepositCount}</span>
                    </Holder>
                    <div className="min-w-0 flex-1">
                      <p className={cn('text-[14px] font-bold', TEXT.strong)}>Dépôts à valider</p>
                      <p className={cn('text-[12px]', TEXT.muted)}>En attente de validation</p>
                    </div>
                    <ChevronRight className={cn('h-5 w-5', TEXT.muted)} />
                  </Card>
                ) : null}
                {pendingPaymentCount > 0 ? (
                  <Card
                    role="button"
                    tabIndex={0}
                    onClick={() => navigate('/m/payments')}
                    onKeyDown={(e) => e.key === 'Enter' && navigate('/m/payments')}
                    className="flex cursor-pointer items-center gap-3 p-4 transition hover:-translate-y-0.5"
                  >
                    <Holder tone="info" size="lg">
                      <span className="text-[17px] font-extrabold tabular-nums">{pendingPaymentCount}</span>
                    </Holder>
                    <div className="min-w-0 flex-1">
                      <p className={cn('text-[14px] font-bold', TEXT.strong)}>Paiements en cours</p>
                      <p className={cn('text-[12px]', TEXT.muted)}>À exécuter vers les fournisseurs</p>
                    </div>
                    <ChevronRight className={cn('h-5 w-5', TEXT.muted)} />
                  </Card>
                ) : null}
              </div>
            </div>
          ) : null}

          {/* Recent activity */}
          {recentDeposits.length > 0 ? (
            <Card className="overflow-hidden p-0">
              <div className="flex items-center justify-between px-5 pt-4">
                <h3 className={cn('text-[15px] font-bold', TEXT.strong)}>Activité récente</h3>
                <button
                  onClick={() => navigate('/m/deposits')}
                  className="inline-flex items-center gap-1 text-[13px] font-semibold text-[#6B5BD2] dark:text-[#A99BF0]"
                >
                  Tout voir <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
              <table className="mt-3 w-full text-left">
                <thead>
                  <tr className={cn('text-[11px] font-bold uppercase tracking-wider', TEXT.muted)}>
                    <th className="px-5 py-2.5 font-bold">Client</th>
                    <th className="px-2 py-2.5 text-right font-bold">Montant</th>
                    <th className="px-2 py-2.5 font-bold">Quand</th>
                    <th className="px-5 py-2.5 text-right font-bold">Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {recentDeposits.map((deposit) => {
                    const name =
                      `${deposit.profiles?.first_name ?? ''} ${deposit.profiles?.last_name ?? ''}`.trim() || 'Client';
                    return (
                      <tr
                        key={deposit.id}
                        onClick={() => navigate(`/m/deposits/${deposit.id}`)}
                        className="cursor-pointer border-t border-black/[0.05] transition hover:bg-[#EDEAFA]/40 dark:border-white/[0.05] dark:hover:bg-white/[0.04]"
                      >
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2.5">
                            <Avatar name={name} size="sm" />
                            <span className={cn('text-[13px] font-semibold', TEXT.strong)}>{name}</span>
                          </div>
                        </td>
                        <td className="px-2 py-3 text-right">
                          <Amount value={formatCurrencyFull(deposit.amount_xaf, 'XAF')} size="md" />
                        </td>
                        <td className={cn('px-2 py-3 text-[12px]', TEXT.muted)}>{formatRelativeDate(deposit.created_at)}</td>
                        <td className="px-5 py-3 text-right">
                          <StatusPill tone={depositStatusTone(deposit.status)} label={getDepositStatusLabel(deposit.status)} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Card>
          ) : null}
        </div>

        {/* Right rail */}
        <div className="space-y-6 lg:col-span-4">
          <RateCard
            rates={
              activeDailyRate
                ? {
                    rate_cash: activeDailyRate.rate_cash,
                    rate_alipay: activeDailyRate.rate_alipay,
                    rate_wechat: activeDailyRate.rate_wechat,
                    rate_virement: activeDailyRate.rate_virement,
                  }
                : null
            }
            effectiveAt={activeDailyRate?.effective_at}
            detailsHref="/m/more/rates"
          />

          {/* Mola */}
          <button
            onClick={() => navigate('/m/assistant')}
            className={cn(
              'w-full rounded-[22px] p-5 text-left transition hover:brightness-110',
              'bg-[#1C1B22] text-white dark:bg-[#211F2B] dark:ring-1 dark:ring-white/[0.06]',
            )}
          >
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15">
                <MolaMascot className="h-7 w-7" fallback={<Sparkles className="h-[18px] w-[18px]" />} />
              </span>
              <div className="leading-tight">
                <p className="text-[14px] font-bold">Mola</p>
                <p className="text-[11px] text-white/60">Directeur des opérations IA</p>
              </div>
            </div>
            <p className="mt-3 text-[13px] leading-snug text-white/80">
              Demandez une action en langage naturel : « Valide le dépôt BZ-DP-2291 », « Volume payé vers la Chine cette
              semaine ? »
            </p>
            <span className="mt-3 inline-flex rounded-full bg-white/10 px-3.5 py-2 text-[12px] font-semibold text-white/70">
              Ouvrir l'assistant →
            </span>
          </button>

          {/* Quick actions */}
          <Card className="p-5">
            <h3 className={cn('mb-3 text-[15px] font-bold', TEXT.strong)}>Actions rapides</h3>
            <div className="grid grid-cols-2 gap-2.5">
              {quickActions.map(({ icon: Icon, label, to, tone }) => (
                <button
                  key={to}
                  onClick={() => navigate(to)}
                  className={cn(
                    'flex flex-col items-start gap-2 rounded-2xl p-3.5 text-left transition',
                    'bg-[#EDEAFA]/50 hover:bg-[#EDEAFA] dark:bg-white/[0.04] dark:hover:bg-white/[0.08]',
                  )}
                >
                  <Holder icon={Icon} tone={tone} size="md" />
                  <span className={cn('text-[13px] font-semibold', TEXT.strong)}>{label}</span>
                </button>
              ))}
            </div>
          </Card>
        </div>
      </section>
    </div>
  );
}
