/**
 * Poste de pilotage — the console home.
 *
 * Reordered around one question: *what needs me right now?* The queue comes
 * first and is sized to be read from two metres away, two KPI tiles sit under
 * it as context, and one merged activity feed shares the body with a right rail
 * carrying the day's rate.
 *
 * WHAT THIS SCREEN DELIBERATELY DOES NOT CARRY
 * The density audit found 25 controls here, and eight of them were routes that
 * already existed one click away in the always-visible sidebar:
 *  · a "Raccourcis" panel of four buttons — all four are rail entries, so every
 *    one of them was a *longer* path to its target than the rail itself;
 *  · a Mola card — the rail links `/m/assistant` and the command palette
 *    advertises it, so the card was the third route to the same screen;
 *  · a "Gérer" button on the rates panel — Marché › Taux de change in the rail.
 * A shortcut that is less accessible than its target is not a shortcut. The
 * rates panel stays as a read-only display; nothing was lost, only duplicated
 * chrome.
 *
 * And the two feed panels ("Derniers dépôts" / "Derniers paiements") cost 14
 * controls for one idea — "what just happened". They are one panel now, sorted
 * by date, each row stating its own kind and routing to its own record.
 *
 * Same hooks as the mobile dashboard — only the presentation differs, so the
 * two can't drift apart.
 */
import { useMemo, type ElementType } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  CheckCircle2,
  ChevronRight,
  LifeBuoy,
  Send,
  TrendingUp,
  Wallet,
} from 'lucide-react';
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
import { depositStatusTone, paymentStatusTone, roleMeta, type Tone } from '@/mobile/designKit';
import { cn } from '@/lib/utils';
import { DS, DT, DFG } from '@/desktop/ui/tokens';
import { Badge, Button, EmptyState, Figure, Holder, Metric, Panel, PanelHead, Ref, Skeleton } from '@/desktop/ui/primitives';
import { MenuButton, type MenuItem } from '@/desktop/ui/Popover';
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
      className={cn('group flex flex-1 items-center gap-4 px-4 py-4 text-left transition-colors', DS.hover)}
    >
      <Holder icon={Icon} tone={tone} size="lg" />
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline gap-2">
          <Figure value={count} size="hero" />
          <span className={cn('truncate', DT.title, DFG.strong)}>{label}</span>
        </span>
        <span className={cn('mt-1 block truncate', DT.label, DFG.muted)}>{hint}</span>
      </span>
      <ChevronRight className={cn('h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5', DFG.faint)} />
    </button>
  );
}

/* ── Activity feed ───────────────────────────────────────────────────── */

/**
 * One line of the merged feed.
 *
 * Because deposits and payments now share a panel, the *kind* has to be
 * legible without reading the amount: it is carried three times over — by the
 * direction icon, by the word under the figure, and by the currency itself
 * (XAF in, ¥ out).
 */
interface FeedEntry {
  id: string;
  kind: 'deposit' | 'payment';
  name: string;
  reference: string | null;
  amount: string;
  at: string;
  status: string;
  tone: Tone;
  to: string;
}

const KIND_LABEL: Record<FeedEntry['kind'], string> = { deposit: 'Dépôt', payment: 'Paiement' };
const KIND_ICON: Record<FeedEntry['kind'], ElementType> = { deposit: ArrowDownToLine, payment: ArrowUpFromLine };
const KIND_TONE: Record<FeedEntry['kind'], Tone> = { deposit: 'success', payment: 'info' };

function FeedRow({ entry, onClick }: { entry: FeedEntry; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn('flex w-full items-center gap-3 border-b px-4 py-2 text-left last:border-0 transition-colors', DS.line, DS.hover)}
    >
      <Holder icon={KIND_ICON[entry.kind]} tone={KIND_TONE[entry.kind]} size="sm" />
      <span className="min-w-0 flex-1">
        <span className={cn('block truncate font-semibold', DT.body, DFG.strong)}>{entry.name}</span>
        {entry.reference ? <Ref className="mt-1">{entry.reference}</Ref> : null}
      </span>
      <span className="shrink-0 text-right">
        <Figure value={entry.amount} size="md" />
        <span className={cn('mt-1 block', DT.label, DFG.muted)}>
          {KIND_LABEL[entry.kind]} · {formatRelativeDate(entry.at)}
        </span>
      </span>
      <Badge tone={entry.tone}>{entry.status}</Badge>
    </button>
  );
}

/* ── Screen ──────────────────────────────────────────────────────────── */

export function DesktopDashboard() {
  const navigate = useNavigate();
  const { currentUser, hasPermission } = useAdminAuth();
  const { greeting } = useGreeting({ firstName: currentUser?.firstName, lastName: currentUser?.lastName });

  const { data: stats, isLoading: statsLoading } = useDashboardStats();
  const { data: depositStats } = useDepositStats();
  const { data: paymentStats } = usePaymentStats();
  const { data: rate } = useActiveDailyRate();
  const { data: deposits } = useAdminDeposits();
  const { data: paymentPages } = usePaginatedAdminPayments();
  const canSupport = hasPermission('canAccessSupportChat');
  const { data: conversations } = useAdminConversations();

  const canDeposits = hasPermission('canViewDeposits');
  const canPayments = hasPermission('canViewPayments');
  const canClients = hasPermission('canViewClients');

  /* One feed, both kinds, newest first. Each side is gated by the same
     permission as its list screen, so a role that cannot open `/m/payments`
     never sees a payment row it could not click through to. */
  const feed = useMemo<FeedEntry[]>(() => {
    const entries: FeedEntry[] = [];
    if (canDeposits) {
      for (const d of deposits ?? []) {
        entries.push({
          id: `deposit:${d.id}`,
          kind: 'deposit',
          name: `${d.profiles?.first_name ?? ''} ${d.profiles?.last_name ?? ''}`.trim() || 'Client',
          reference: d.reference,
          amount: formatXAF(d.amount_xaf),
          at: d.created_at,
          status: getDepositStatusLabel(d.status),
          tone: depositStatusTone(d.status),
          to: `/m/deposits/${d.id}`,
        });
      }
    }
    if (canPayments) {
      for (const p of paymentPages?.pages[0]?.data ?? []) {
        entries.push({
          id: `payment:${p.id}`,
          kind: 'payment',
          name: `${p.profiles?.first_name ?? ''} ${p.profiles?.last_name ?? ''}`.trim() || 'Client',
          reference: p.reference,
          amount: formatCurrencyRMB(p.amount_rmb),
          at: p.created_at,
          status: PAYMENT_STATUS_LABELS[p.status] ?? p.status,
          tone: paymentStatusTone(p.status),
          to: `/m/payments/${p.id}`,
        });
      }
    }
    return entries.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()).slice(0, 6);
  }, [deposits, paymentPages, canDeposits, canPayments]);

  /* Every term is gated the same way as the tile that displays it, so the
     header total and the tiles can never contradict each other. */
  const pendingDeposits = canDeposits ? depositStats?.to_process ?? stats?.pendingDeposits ?? 0 : 0;
  const pendingPayments = canPayments ? (paymentStats?.toProcess ?? 0) + (paymentStats?.inProgress ?? 0) : 0;
  const unreadSupport = canSupport ? (conversations ?? []).reduce((n, c) => n + (c.unread_count_admin || 0), 0) : 0;
  const queueTotal = pendingDeposits + pendingPayments + unreadSupport;
  /* Don't claim an empty queue before its counters have landed. */
  const queueReady = (!canDeposits || !!depositStats) && (!canPayments || !!paymentStats);

  const role = currentUser?.role;

  const rateRows = rate
    ? ([
        ['Cash', rate.rate_cash],
        ['Alipay', rate.rate_alipay],
        ['WeChat', rate.rate_wechat],
        ['Virement', rate.rate_virement],
      ] as const)
    : [];

  /* "Tout voir" has to be honest about a mixed list: with both permissions it
     opens onto the two queues rather than silently picking one of them. */
  const feedTargets: MenuItem[] = [];
  if (canDeposits) feedTargets.push({ label: 'Tous les dépôts', icon: ArrowDownToLine, onSelect: () => navigate('/m/deposits') });
  if (canPayments) feedTargets.push({ label: 'Tous les paiements', icon: ArrowUpFromLine, onSelect: () => navigate('/m/payments') });

  const showFeed = canDeposits || canPayments;

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
              {hasPermission('canProcessDeposits') && (
                <Button icon={ArrowDownToLine} onClick={() => navigate('/m/deposits/new')}>
                  Nouveau dépôt
                </Button>
              )}
              {hasPermission('canProcessPayments') && (
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
          hint={queueReady && queueTotal > 0 ? `${queueTotal} élément${queueTotal > 1 ? 's' : ''} en attente d'une décision` : undefined}
        />
        {!queueReady ? (
          <div className={cn('flex divide-x', DS.line)}>
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex flex-1 items-center gap-4 px-4 py-4">
                <Skeleton className="h-10 w-10 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : queueTotal === 0 ? (
          <EmptyState icon={CheckCircle2} title="File vide" hint="Aucun dépôt, paiement ou message n'attend une action." />
        ) : (
          <div className={cn('flex divide-x', DS.line)}>
            {canDeposits && (
              <QueueItem
                icon={ArrowDownToLine}
                count={pendingDeposits}
                label={`dépôt${pendingDeposits > 1 ? 's' : ''} à valider`}
                hint="Preuves reçues, en attente de vérification"
                tone="pending"
                to="/m/deposits"
              />
            )}
            {canPayments && (
              <QueueItem
                icon={ArrowUpFromLine}
                count={pendingPayments}
                label={`paiement${pendingPayments > 1 ? 's' : ''} à exécuter`}
                hint="Prêts à régler ou déjà en cours d'exécution"
                tone="info"
                to="/m/payments"
              />
            )}
            {canSupport && (
              <QueueItem
                icon={LifeBuoy}
                count={unreadSupport}
                label={`message${unreadSupport > 1 ? 's' : ''} non lu${unreadSupport > 1 ? 's' : ''}`}
                hint="Conversations client en attente de réponse"
                tone="success"
                to="/m/support"
              />
            )}
          </div>
        )}
      </Panel>

      {/* ── 2. Context — two tiles, and each one opens the screen that
             decomposes its own number. "Dépôts aujourd'hui" and "Paiements
             aujourd'hui" are gone: both aggregates are already the subtitle of
             their own list screen, one click away in the rail. ── */}
      {statsLoading ? (
        <section className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2" aria-hidden>
          {[0, 1].map((i) => (
            <Panel key={i} className="p-3">
              <div className="flex items-center gap-2">
                <Skeleton className="h-6 w-6 rounded-lg" />
                <Skeleton className="h-4 w-32" />
              </div>
              <Skeleton className="mt-2 h-7 w-40" />
              <Skeleton className="mt-1 h-4 w-48" />
            </Panel>
          ))}
        </section>
      ) : (
        <section className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Metric
            icon={Wallet}
            tone="info"
            label="Solde plateforme"
            value={formatCurrency(stats?.totalWalletBalance ?? 0, 'XAF', { compact: true })}
            hint={canClients ? 'Wallets clients — voir le détail par compte' : 'Total XAF détenu par les wallets clients'}
            onClick={canClients ? () => navigate('/m/clients') : undefined}
          />
          <Metric
            icon={TrendingUp}
            tone="info"
            label="Volume 7 jours"
            value={formatCurrency(stats?.weekVolume ?? 0, 'XAF', { compact: true })}
            hint="Semaine glissante — voir les rapports de volume"
            onClick={() => navigate('/m/dashboard')}
          />
        </section>
      )}

      {/* ── 3. Activity + rail ── */}
      <section className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        {showFeed && (
          <div className="xl:col-span-8">
            <Panel className="overflow-hidden">
              <PanelHead
                title="Activité récente"
                hint="Dépôts et paiements, du plus récent au plus ancien"
                /* No "Tout voir" onto an empty list. */
                actions={
                  feed.length === 0 ? undefined : feedTargets.length === 1 ? (
                    <Button variant="ghost" onClick={feedTargets[0].onSelect}>
                      Tout voir
                    </Button>
                  ) : (
                    <MenuButton label="Tout voir" items={feedTargets} />
                  )
                }
              />
              {feed.length === 0 ? (
                <EmptyState
                  icon={ArrowDownToLine}
                  title="Aucune opération récente"
                  hint="Les dépôts déclarés et les règlements fournisseurs apparaîtront ici."
                />
              ) : (
                feed.map((entry) => <FeedRow key={entry.id} entry={entry} onClick={() => navigate(entry.to)} />)
              )}
            </Panel>
          </div>
        )}

        {/* Right rail — read-only. Publishing a rate lives in Marché › Taux de
            change, which the rail already carries. */}
        <div className={showFeed ? 'xl:col-span-4' : 'xl:col-span-12'}>
          <Panel>
            <PanelHead title="Taux du jour" hint="Pour 1 000 000 XAF réglés" />
            <div className="px-4 py-2">
              {rateRows.length === 0 ? (
                <p className={cn(DT.label, DFG.faint, 'py-6 text-center')}>Aucun taux actif publié.</p>
              ) : (
                rateRows.map(([label, value]) => (
                  <div key={label} className={cn('flex items-center justify-between border-b py-2 last:border-0', DS.line)}>
                    <span className={cn(DT.body, DFG.base)}>{label}</span>
                    <Figure value={formatNumber(value ?? 0, 2)} unit="¥" size="md" />
                  </div>
                ))
              )}
            </div>
          </Panel>
        </div>
      </section>
    </Workspace>
  );
}
