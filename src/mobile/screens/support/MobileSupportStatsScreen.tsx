import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Loader2,
  MessageSquare,
  Users,
  Timer,
  Inbox,
  TrendingUp,
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  Cell,
} from 'recharts';
import { format, parseISO } from 'date-fns';
import { MobileHeader } from '@/mobile/components/layout/MobileHeader';
import { MobileFilterChips } from '@/mobile/components/ui/MobileFilterChips';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { useChatAdminStats } from '@/hooks/useAdminChatTools';
import { formatDuration } from '@/lib/voice-recording';
import { getDateFnsLocale } from '@/i18n';
import { cn } from '@/lib/utils';
import type { Locale } from 'date-fns';

type Period = 7 | 14 | 30;

// Couleurs de la charte Bonzini
const VIOLET = 'hsl(258 100% 60%)';
const AMBER = 'hsl(36 100% 55%)';
const ORANGE = 'hsl(16 100% 55%)';

export function MobileSupportStatsScreen() {
  const { t } = useTranslation('support');
  const navigate = useNavigate();
  const { hasPermission } = useAdminAuth();
  const canAccess = hasPermission('canAccessSupportChat');
  const [period, setPeriod] = useState<Period>(7);
  const { data: stats, isLoading } = useChatAdminStats(period);
  const [locale, setLocale] = useState<Locale | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    getDateFnsLocale().then((l) => !cancelled && setLocale(l));
    return () => {
      cancelled = true;
    };
  }, []);

  if (!canAccess) {
    return (
      <div className="p-6 text-center text-sm text-muted-foreground">
        Vous n'avez pas accès au support chat.
      </div>
    );
  }

  // Format les données pour recharts
  const dailyChartData =
    stats?.daily_volume.map((d) => ({
      day: d.day,
      dayLabel: format(parseISO(d.day), 'EEE d', locale ? { locale } : undefined),
      Client: d.client_count,
      Bonzini: d.admin_count,
    })) ?? [];

  const bucketsChartData = stats
    ? [
        { bucket: t('admin.bucketUnder1Min'), count: stats.response_buckets.under_1min, color: VIOLET },
        { bucket: t('admin.bucket1to5'), count: stats.response_buckets.one_to_five, color: VIOLET },
        { bucket: t('admin.bucket5to15'), count: stats.response_buckets.five_to_fifteen, color: AMBER },
        { bucket: t('admin.bucketOver15'), count: stats.response_buckets.over_fifteen, color: ORANGE },
      ]
    : [];

  const topAdminsChartData =
    stats?.per_admin.slice(0, 5).map((a) => ({
      name: `${a.first_name ?? ''} ${a.last_name ?? ''}`.trim() || 'Admin',
      replies: a.replies_count,
      avgSeconds: a.avg_response_seconds,
    })) ?? [];

  return (
    <div className="flex flex-col min-h-[100dvh] bg-background">
      <MobileHeader
        title={t('admin.statsTitle')}
        showBack
        onBack={() => navigate('/m/support')}
      />

      <div className="px-4 py-3 border-b border-border">
        <MobileFilterChips<Period>
          filters={[
            { value: 7, label: t('admin.statsPeriod7d') },
            { value: 14, label: t('admin.statsPeriod14d') },
            { value: 30, label: t('admin.statsPeriod30d') },
          ]}
          activeKey={period}
          onChange={setPeriod}
        />
      </div>

      {isLoading || !stats ? (
        <div className="flex flex-1 items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-4 p-4">
          {/* KPI cards */}
          <div className="grid grid-cols-2 gap-3">
            <StatCard
              icon={Inbox}
              label={t('admin.statsOpenConvs')}
              value={String(stats.open_conversations)}
              tone="violet"
            />
            <StatCard
              icon={MessageSquare}
              label={t('admin.statsTotalMessages')}
              value={String(stats.total_messages)}
              tone="amber"
            />
            <StatCard
              icon={Users}
              label={t('admin.statsUnassigned')}
              value={String(stats.unassigned_open)}
              tone="orange"
            />
            <StatCard
              icon={Timer}
              label={t('admin.statsAvgResponse')}
              value={stats.avg_response_seconds_global > 0 ? formatDuration(stats.avg_response_seconds_global) : '—'}
              hint={
                stats.median_response_seconds_global > 0
                  ? `${t('admin.statsMedian')} ${formatDuration(stats.median_response_seconds_global)}`
                  : undefined
              }
              tone="violet"
            />
          </div>

          {/* Volume quotidien */}
          <ChartCard title={t('admin.chartDailyVolume')} subtitle={t('admin.chartDailyVolumeHint')}>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={dailyChartData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="dayLabel" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    background: 'hsl(var(--background))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="Client" stroke={ORANGE} strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="Bonzini" stroke={VIOLET} strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Distribution temps de réponse */}
          <ChartCard
            title={t('admin.chartResponseDistribution')}
            subtitle={t('admin.chartResponseDistributionHint')}
          >
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={bucketsChartData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="bucket" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    background: 'hsl(var(--background))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                  {bucketsChartData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Top admins par volume */}
          <ChartCard
            title={t('admin.chartTopAdmins')}
            subtitle={t('admin.chartTopAdminsHint')}
            icon={TrendingUp}
          >
            {topAdminsChartData.length === 0 ? (
              <p className="py-6 text-center text-xs text-muted-foreground">
                {t('admin.statsNoData')}
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={Math.max(120, topAdminsChartData.length * 38)}>
                <BarChart
                  data={topAdminsChartData}
                  layout="vertical"
                  margin={{ top: 5, right: 5, left: 0, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                  <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={11} allowDecimals={false} />
                  <YAxis
                    dataKey="name"
                    type="category"
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={11}
                    width={80}
                  />
                  <Tooltip
                    contentStyle={{
                      background: 'hsl(var(--background))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                    formatter={(value: number, name: string) => {
                      if (name === 'avgSeconds') return [formatDuration(value), t('admin.statsAvgResponse')];
                      return [value, t('admin.statsReplies')];
                    }}
                  />
                  <Bar dataKey="replies" fill={VIOLET} radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>

          {/* Détail per-admin (cards) */}
          {stats.per_admin.length > 0 && (
            <div className="rounded-2xl border border-border bg-card p-4">
              <h3 className="mb-3 text-sm font-semibold">{t('admin.statsPerAdmin')}</h3>
              <ul className="divide-y divide-border">
                {stats.per_admin.map((a) => {
                  const name = `${a.first_name ?? ''} ${a.last_name ?? ''}`.trim() || 'Admin';
                  return (
                    <li key={a.admin_user_id} className="flex items-center justify-between py-2.5">
                      <div>
                        <p className="text-sm font-medium">{name}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {a.replies_count} {t('admin.statsReplies')}
                        </p>
                      </div>
                      <span className="text-xs font-mono text-bonzini-violet">
                        ⏱ {formatDuration(a.avg_response_seconds || 0)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          <div className="rounded-2xl border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
            <p>
              <strong>{t('admin.statsLegendTitle')}</strong> — {t('admin.statsLegend')}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

interface StatCardProps {
  icon: React.ElementType;
  label: string;
  value: string;
  hint?: string;
  tone: 'violet' | 'amber' | 'orange';
}
function StatCard({ icon: Icon, label, value, hint, tone }: StatCardProps) {
  const colors = {
    violet: 'bg-bonzini-violet/10 text-bonzini-violet',
    amber: 'bg-bonzini-amber/10 text-bonzini-amber',
    orange: 'bg-bonzini-orange/10 text-bonzini-orange',
  };
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className={cn('mb-2 inline-flex h-8 w-8 items-center justify-center rounded-full', colors[tone])}>
        <Icon className="h-4 w-4" />
      </div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-2xl font-semibold">{value}</p>
      {hint && <p className="mt-0.5 text-[10px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

interface ChartCardProps {
  title: string;
  subtitle?: string;
  icon?: React.ElementType;
  children: React.ReactNode;
}
function ChartCard({ title, subtitle, icon: Icon, children }: ChartCardProps) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="mb-3 flex items-start gap-2">
        {Icon && <Icon className="h-4 w-4 text-bonzini-violet mt-0.5" />}
        <div>
          <h3 className="text-sm font-semibold">{title}</h3>
          {subtitle && <p className="text-[11px] text-muted-foreground">{subtitle}</p>}
        </div>
      </div>
      {children}
    </div>
  );
}
