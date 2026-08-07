/**
 * Poste de pilotage — the console home.
 *
 * Reordered around one question: *what needs me right now?* The old home led
 * with four KPI cards, which are context, not work; the queue was a small strip
 * below the fold. Here the queue comes first and is sized to be read from two
 * metres away, KPIs sit under it as context, and the two live feeds (dépôts /
 * paiements) share the body with a right rail carrying the day's rate and Mola.
 *
 * Same hooks as the mobile dashboard — only the presentation differs, so the
 * two can't drift apart.
 */
import { useMemo, type ElementType } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  BarChart3,
  CheckCircle2,
  ChevronRight,
  Coins,
  LifeBuoy,
  Send,
  TrendingUp,
  UserPlus,
  Wallet,
} from 'lucide-react';
import { MolaMascot } from '@/components/MolaMascot';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { useDashboardStats } from '@/hooks/useAdminData';
import { useAdminDeposits, useDepositStats } from '@/hooks/useAdminDeposits';
import { usePaginatedAdminPayments, usePaymentStats } from '@/hooks/usePaginatedPayments';
import { useActiveDailyRate } from '@/hooks/useDailyRates';
import { useAdminConversations } from '@/hooks/useAdminChat';
import { useGreeting } from '@/hooks/useGreeting';
import { formatCurrency } from '@/components/analytics';
import { formatRelativeDate, formatXAF, formatCurrencyRMB, formatNumber, getDepositStatusLabel } from '@/lib/formatters';
import { PAYMENT_STATUS_LABELS } from '@/types/payment';
import { depositStatusTone, paymentStatusTone, roleMeta } from '@/mobile/designKit';
import { cn } from '@/lib/utils';
import { DS, DT, DFG } from '@/desktop/ui/tokens';
import { Avatar, Badge, Button, EmptyState, Figure, Holder, Metric, Panel, PanelHead, Ref, Spinner } from '@/desktop/ui/primitives';
import { ScreenHead, Workspace } from '@/desktop/ui/layout';

/* ── Queue ───────────────────────────────────────────────────────────── */

function QueueItem({
  icon: Icon,
  count,
  label,
  hint,
  tone,
  to,
}: {
  icon: ElementType;
  count: number;
  label: string;
  hint: string;
  tone: 'pending' | 'info' | 'success';
  to: string;
}) {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      onClick={() => navigate(to)}
      className={cn('group flex flex-1 items-center gap-3.5 px-4 py-3.5 text-left transition-colors', DS.hover)}
    >
      <Holder icon={Icon} tone={tone} size="lg" />
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline gap-2">
          <Figure value={count} size="xl" />
          <span className={cn('truncate text-[14px] font-bold', DFG.strong)}>{label}</span>
        </span>
        <span className={cn('mt-0.5 block truncate text-[12px]', DFG.muted)}>{hint}</span>
      </span>
      <ChevronRight className={cn('h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5', DFG.faint)} />
    </button>
  );
}

/* ── Feeds ───────────────────────────────────────────────────────────── */

function FeedRow({
  name,
  reference,
  amount,
  when,
  status,
  tone,
  onClick,
}: {
  name: string;
  reference: string | null;
  amount: string;
  when: string;
  status: string;
  tone: Parameters<typeof Badge>[0]['tone'];
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn('flex w-full items-center gap-3 border-b px-4 py-2.5 text-left last:border-0 transition-colors', DS.line, DS.hover)}
    >
      <Avatar name={name} size="sm" />
      <span className="min-w-0 flex-1">
        <span className={cn('block truncate text-[12.5px] font-semibold', DFG.strong)}>{name}</span>
        {reference ? <Ref className="mt-0.5">{reference}</Ref> : null}
      </span>
      <span className="shrink-0 text-right">
        <Figure value={amount} size="md" />
        <span className={cn('mt-0.5 block text-[11px]', DFG.faint)}>{when}</span>
      </span>
      <Badge tone={tone}>{status}</Badge>
    </button>
  );
}

/* ── Screen ──────────────────────────────────────────────────────────── */

export function DesktopDashboard() {
  const navigate = useNavigate();
  const { currentUser, hasPermission } = useAdminAuth();
  const { greeting } = useGreeting({ firstName: currentUser?.firstName, lastName: currentUser?.lastName });

  const { data: stats, isLoading } = useDashboardStats();
  const { data: depositStats } = useDepositStats();
  const { data: paymentStats } = usePaymentStats();
  const { data: rate } = useActiveDailyRate();
  const { data: deposits } = useAdminDeposits();
  const { data: paymentPages } = usePaginatedAdminPayments();
  const canSupport = hasPermission('canAccessSupportChat');
  const { data: conversations } = useAdminConversations();

  const recentDeposits = (deposits ?? []).slice(0, 6);
  const recentPayments = useMemo(() => (paymentPages?.pages[0]?.data ?? []).slice(0, 6), [paymentPages]);

  const pendingDeposits = depositStats?.to_process ?? stats?.pendingDeposits ?? 0;
  const pendingPayments = (paymentStats?.toProcess ?? 0) + (paymentStats?.inProgress ?? 0);
  const unreadSupport = canSupport ? (conversations ?? []).reduce((n, c) => n + (c.unread_count_admin || 0), 0) : 0;
  const queueTotal = pendingDeposits + pendingPayments + unreadSupport;

  if (isLoading) return <Spinner className="py-32" />;

  const role = currentUser?.role;
  const shortcuts = [
    { icon: UserPlus, label: 'Nouveau client', to: '/m/clients/new', perm: 'canViewClients' as const },
    { icon: BarChart3, label: 'Analytics', to: '/m/dashboard' },
    { icon: Coins, label: 'Trésorerie', to: '/m/more/treasury', perm: 'canViewTreasury' as const },
    { icon: LifeBuoy, label: 'Support', to: '/m/support', perm: 'canAccessSupportChat' as const },
  ].filter((s) => !s.perm || hasPermission(s.perm));

  const rateRows = rate
    ? ([
        ['Cash', rate.rate_cash],
        ['Alipay', rate.rate_alipay],
        ['WeChat', rate.rate_wechat],
        ['Virement', rate.rate_virement],
      ] as const)
    : [];

  return (
    <Workspace
      head={
        <ScreenHead
          title={greeting}
          subtitle={
            <span className="flex items-center gap-2">
              {role ? <Badge tone={roleMeta(role).tone}>{roleMeta(role).label}</Badge> : null}
              <span>Vue opérationnelle de la plateforme</span>
            </span>
          }
          actions={
            <>
              {hasPermission('canViewDeposits') && (
                <Button icon={ArrowDownToLine} onClick={() => navigate('/m/deposits/new')}>
                  Nouveau dépôt
                </Button>
              )}
              {hasPermission('canViewPayments') && (
                <Button variant="primary" icon={Send} onClick={() => navigate('/m/payments/new')}>
                  Nouveau paiement
                </Button>
              )}
            </>
          }
        />
      }
    >
      {/* ── 1. The queue: what needs a decision today ── */}
      <Panel className="mb-4 overflow-hidden">
        <PanelHead
          title="À traiter maintenant"
          hint={queueTotal > 0 ? `${queueTotal} élément${queueTotal > 1 ? 's' : ''} en attente d'une décision` : undefined}
        />
        {queueTotal === 0 ? (
          <EmptyState icon={CheckCircle2} title="File vide" hint="Aucun dépôt, paiement ou message n'attend une action." />
        ) : (
          <div className={cn('flex divide-x', DS.line)}>
            {hasPermission('canViewDeposits') && (
              <QueueItem icon={ArrowDownToLine} count={pendingDeposits} label="dépôts à valider" hint="Preuves reçues, en attente de vérification" tone="pending" to="/m/deposits" />
            )}
            {hasPermission('canViewPayments') && (
              <QueueItem icon={ArrowUpFromLine} count={pendingPayments} label="paiements à exécuter" hint="Prêts ou en cours vers les fournisseurs" tone="info" to="/m/payments" />
            )}
            {canSupport && (
              <QueueItem icon={LifeBuoy} count={unreadSupport} label="messages non lus" hint="Conversations client en attente de réponse" tone="success" to="/m/support" />
            )}
          </div>
        )}
      </Panel>

      {/* ── 2. Context ── */}
      <section className="mb-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Metric icon={Wallet} tone="info" label="Solde plateforme" value={formatCurrency(stats?.totalWalletBalance ?? 0, 'XAF', { compact: true })} hint="Total XAF détenu par les wallets clients" />
        <Metric icon={TrendingUp} tone="info" label="Volume 7 jours" value={formatCurrency(stats?.weekVolume ?? 0, 'XAF', { compact: true })} hint="Flux traité sur la semaine glissante" />
        <Metric icon={ArrowDownToLine} tone="success" label="Dépôts aujourd'hui" value={formatCurrency(depositStats?.today_amount ?? 0, 'XAF', { compact: true })} hint="Entrées de fonds du jour" />
        <Metric icon={ArrowUpFromLine} tone="pending" label="Paiements aujourd'hui" value={formatCurrency(stats?.todayPaymentsAmount ?? 0, 'XAF', { compact: true })} hint="Règlements fournisseurs du jour" />
      </section>

      {/* ── 3. Live feeds + rail ── */}
      <section className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <div className="space-y-4 xl:col-span-8">
          {hasPermission('canViewDeposits') && (
            <Panel className="overflow-hidden">
              <PanelHead
                title="Derniers dépôts"
                actions={<Button size="sm" variant="ghost" onClick={() => navigate('/m/deposits')}>Tout voir</Button>}
              />
              {recentDeposits.length === 0 ? (
                <EmptyState icon={ArrowDownToLine} title="Aucun dépôt" hint="Les dépôts déclarés apparaîtront ici." />
              ) : (
                recentDeposits.map((d) => (
                  <FeedRow
                    key={d.id}
                    name={`${d.profiles?.first_name ?? ''} ${d.profiles?.last_name ?? ''}`.trim() || 'Client'}
                    reference={d.reference}
                    amount={formatXAF(d.amount_xaf)}
                    when={formatRelativeDate(d.created_at)}
                    status={getDepositStatusLabel(d.status)}
                    tone={depositStatusTone(d.status)}
                    onClick={() => navigate(`/m/deposits/${d.id}`)}
                  />
                ))
              )}
            </Panel>
          )}

          {hasPermission('canViewPayments') && (
            <Panel className="overflow-hidden">
              <PanelHead
                title="Derniers paiements"
                actions={<Button size="sm" variant="ghost" onClick={() => navigate('/m/payments')}>Tout voir</Button>}
              />
              {recentPayments.length === 0 ? (
                <EmptyState icon={ArrowUpFromLine} title="Aucun paiement" hint="Les règlements fournisseurs apparaîtront ici." />
              ) : (
                recentPayments.map((p) => (
                  <FeedRow
                    key={p.id}
                    name={`${p.profiles?.first_name ?? ''} ${p.profiles?.last_name ?? ''}`.trim() || 'Client'}
                    reference={p.reference}
                    amount={formatCurrencyRMB(p.amount_rmb)}
                    when={formatRelativeDate(p.created_at)}
                    status={PAYMENT_STATUS_LABELS[p.status] ?? p.status}
                    tone={paymentStatusTone(p.status)}
                    onClick={() => navigate(`/m/payments/${p.id}`)}
                  />
                ))
              )}
            </Panel>
          )}
        </div>

        {/* Right rail */}
        <div className="space-y-4 xl:col-span-4">
          <Panel>
            <PanelHead
              title="Taux du jour"
              hint="Pour 1 000 000 XAF envoyés"
              actions={hasPermission('canManageRates') ? <Button size="sm" variant="ghost" onClick={() => navigate('/m/more/rates')}>Gérer</Button> : undefined}
            />
            <div className="px-4 py-2">
              {rateRows.length === 0 ? (
                <p className={cn(DT.label, DFG.faint, 'py-6 text-center')}>Aucun taux actif publié.</p>
              ) : (
                rateRows.map(([label, value]) => (
                  <div key={label} className={cn('flex items-center justify-between border-b py-2 last:border-0', DS.line)}>
                    <span className={cn(DT.body, DFG.base)}>{label}</span>
                    <Figure value={formatNumber(value ?? 0, 2)} unit="CNY" size="md" />
                  </div>
                ))
              )}
            </div>
          </Panel>

          {/* Mola — the AI-native entry point, deliberately the one dark surface. */}
          <button
            type="button"
            onClick={() => navigate('/m/assistant')}
            className="w-full rounded-xl bg-[#1A1725] p-4 text-left transition-colors hover:bg-[#241F33] dark:bg-[#1B1A24] dark:hover:bg-[#242232]"
          >
            <span className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10">
                <MolaMascot className="h-6 w-6" fallback={<span className="text-[13px]">✦</span>} />
              </span>
              <span className="leading-tight">
                <span className="block text-[13px] font-bold text-white">Mola</span>
                <span className="block text-[11px] text-white/55">Directeur des opérations IA</span>
              </span>
            </span>
            <span className="mt-3 block text-[12.5px] leading-snug text-white/75">
              « Valide le dépôt BZ-DP-2291 », « Quel volume payé vers la Chine cette semaine ? »
            </span>
            <span className="mt-3 inline-flex rounded-md bg-white/10 px-2.5 py-1.5 text-[11.5px] font-semibold text-white/80">
              Ouvrir l'assistant →
            </span>
          </button>

          <Panel>
            <PanelHead title="Raccourcis" />
            <div className="grid grid-cols-2 gap-2 p-3">
              {shortcuts.map(({ icon: Icon, label, to }) => (
                <button
                  key={to}
                  type="button"
                  onClick={() => navigate(to)}
                  className={cn('flex items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition-colors', DS.line, DS.hover)}
                >
                  <Holder icon={Icon} size="sm" />
                  <span className={cn('truncate text-[12px] font-semibold', DFG.base)}>{label}</span>
                </button>
              ))}
            </div>
          </Panel>
        </div>
      </section>
    </Workspace>
  );
}
