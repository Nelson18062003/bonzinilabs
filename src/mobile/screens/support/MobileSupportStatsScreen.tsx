import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
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
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { useChatAdminStats } from '@/hooks/useAdminChatTools';
import { formatDuration } from '@/lib/voice-recording';
import { getDateFnsLocale } from '@/i18n';
import { cn } from '@/lib/utils';
import type { Locale } from 'date-fns';
import {
  SURFACE,
  TEXT,
  PRIMARY_PILL,
  SOFT_PILL,
  Card,
  StatCard,
  Holder,
  ScreenLoader,
} from '@/mobile/designKit';

type Period = 7 | 14 | 30;

// Brand chart colors (carry meaning on the curves/bars — kept per logo charte).
const VIOLET = 'hsl(258 100% 60%)';
const AMBER = 'hsl(36 100% 55%)';
const ORANGE = 'hsl(16 100% 55%)';

// Softened neutral chart chrome (axes/grid) — matches MultiCurveChart (M5).
const GRID = 'rgba(120,120,140,0.15)';
const AXIS_LINE = 'rgba(120,120,140,0.2)';
const AXIS_TICK = { fontSize: 11, fill: '#9B98AD' } as const;
const TOOLTIP_STYLE = {
  background: 'hsl(var(--background))',
  border: '1px solid hsl(var(--border))',
  borderRadius: 14,
  fontSize: 12,
} as const;

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
      <div className={cn('flex min-h-[100dvh] flex-col items-center justify-center p-6 text-center', SURFACE.canvas)}>
        <Holder icon={MessageSquare} size="lg" />
        <p className={cn('mt-4 text-[14px]', TEXT.muted)}>
          Vous n'avez pas accès au support chat.
        </p>
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

  const periodFilters: { value: Period; label: string }[] = [
    { value: 7, label: t('admin.statsPeriod7d') },
    { value: 14, label: t('admin.statsPeriod14d') },
    { value: 30, label: t('admin.statsPeriod30d') },
  ];

  return (
    <div className={cn('flex min-h-[100dvh] flex-col', SURFACE.canvas)}>
      <MobileHeader
        title={t('admin.statsTitle')}
        showBack
        onBack={() => navigate('/m/support')}
      />

      <div className="px-4 pt-4">
        <div className="scrollbar-hide flex gap-2 overflow-x-auto pb-1">
          {periodFilters.map((filter) => (
            <button
              key={filter.value}
              onClick={() => setPeriod(filter.value)}
              className={cn(
                'whitespace-nowrap rounded-full px-4 py-2 text-[13px] font-semibold transition-colors',
                period === filter.value ? PRIMARY_PILL : SOFT_PILL,
              )}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading || !stats ? (
        <ScreenLoader />
      ) : (
        <div className="space-y-4 p-4">
          {/* KPI cards */}
          <div className="grid grid-cols-2 gap-3">
            <StatCard
              icon={Inbox}
              tone="info"
              label={t('admin.statsOpenConvs')}
              value={String(stats.open_conversations)}
            />
            <StatCard
              icon={MessageSquare}
              tone="neutral"
              label={t('admin.statsTotalMessages')}
              value={String(stats.total_messages)}
            />
            <StatCard
              icon={Users}
              tone="pending"
              label={t('admin.statsUnassigned')}
              value={String(stats.unassigned_open)}
            />
            <StatCard
              icon={Timer}
              tone="info"
              label={t('admin.statsAvgResponse')}
              value={stats.avg_response_seconds_global > 0 ? formatDuration(stats.avg_response_seconds_global) : '—'}
              hint={
                stats.median_response_seconds_global > 0
                  ? `${t('admin.statsMedian')} ${formatDuration(stats.median_response_seconds_global)}`
                  : undefined
              }
            />
          </div>

          {/* Volume quotidien */}
          <ChartCard title={t('admin.chartDailyVolume')} subtitle={t('admin.chartDailyVolumeHint')}>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={dailyChartData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
                <XAxis dataKey="dayLabel" tick={AXIS_TICK} axisLine={{ stroke: AXIS_LINE }} tickLine={false} />
                <YAxis tick={AXIS_TICK} axisLine={{ stroke: AXIS_LINE }} tickLine={false} allowDecimals={false} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="Client" stroke={ORANGE} strokeWidth={2.5} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="Bonzini" stroke={VIOLET} strokeWidth={2.5} dot={{ r: 3 }} />
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
                <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
                <XAxis dataKey="bucket" tick={AXIS_TICK} axisLine={{ stroke: AXIS_LINE }} tickLine={false} />
                <YAxis tick={AXIS_TICK} axisLine={{ stroke: AXIS_LINE }} tickLine={false} allowDecimals={false} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
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
              <p className={cn('py-6 text-center text-[12px]', TEXT.muted)}>
                {t('admin.statsNoData')}
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={Math.max(120, topAdminsChartData.length * 38)}>
                <BarChart
                  data={topAdminsChartData}
                  layout="vertical"
                  margin={{ top: 5, right: 5, left: 0, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke={GRID} horizontal={false} />
                  <XAxis type="number" tick={AXIS_TICK} axisLine={{ stroke: AXIS_LINE }} tickLine={false} allowDecimals={false} />
                  <YAxis
                    dataKey="name"
                    type="category"
                    tick={AXIS_TICK}
                    axisLine={{ stroke: AXIS_LINE }}
                    tickLine={false}
                    width={80}
                  />
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
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
            <Card>
              <h3 className={cn('mb-3 text-[14px] font-bold', TEXT.strong)}>{t('admin.statsPerAdmin')}</h3>
              <div className="space-y-0.5">
                {stats.per_admin.map((a) => {
                  const name = `${a.first_name ?? ''} ${a.last_name ?? ''}`.trim() || 'Admin';
                  return (
                    <div key={a.admin_user_id} className="flex items-center justify-between py-2.5">
                      <div>
                        <p className={cn('text-[14px] font-semibold', TEXT.strong)}>{name}</p>
                        <p className={cn('text-[11px]', TEXT.muted)}>
                          {a.replies_count} {t('admin.statsReplies')}
                        </p>
                      </div>
                      <span className="font-mono text-[12px] font-semibold text-[#6B5BD2] dark:text-[#A99BF0]">
                        ⏱ {formatDuration(a.avg_response_seconds || 0)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          <Card className={cn('text-[12px]', TEXT.muted)}>
            <p>
              <strong className={TEXT.strong}>{t('admin.statsLegendTitle')}</strong> — {t('admin.statsLegend')}
            </p>
          </Card>
        </div>
      )}
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
    <Card>
      <div className="mb-3 flex items-start gap-2">
        {Icon && <Icon className="mt-0.5 h-4 w-4 text-[#6B5BD2] dark:text-[#A99BF0]" />}
        <div>
          <h3 className={cn('text-[14px] font-bold', TEXT.strong)}>{title}</h3>
          {subtitle && <p className={cn('text-[11px]', TEXT.muted)}>{subtitle}</p>}
        </div>
      </div>
      {children}
    </Card>
  );
}
