import { useState, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { PullToRefresh } from '@/mobile/components/ui/PullToRefresh';
import { useDashboardStats } from '@/hooks/useAdminData';
import { useDepositStats } from '@/hooks/useAdminDeposits';
import { usePaymentStats } from '@/hooks/usePaginatedPayments';
import { useActiveDailyRate } from '@/hooks/useDailyRates';
import {
  useFinancialFlowData,
  useMonthlyVolumeTrend,
  useDepositMethodBreakdown,
  usePaymentMethodBreakdown,
  usePaymentVolumeStats,
  useTopClients,
  useClientGrowthData,
  useDepositStatusBreakdown,
  useAvgProcessingTime,
  useAdminProductivity,
  useRateHistoryData,
  useDashboardAlerts,
  useNetFlowStats,
} from '@/hooks/useDashboardAnalytics';
import { formatXAF, formatCompact, formatNumber, formatRMB } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import {
  BarChart3, Activity, ArrowDownToLine, ArrowUpFromLine,
  TrendingUp, TrendingDown, Users, Wallet, Star,
  Clock, Shield, AlertTriangle, ChevronRight,
  RefreshCw,
} from 'lucide-react';

// ════════════════════════════════════════════════════════════
// PAYMENT METHOD ICONS — Exact match with RateCard.tsx
// ════════════════════════════════════════════════════════════

const PAYMENT_METHOD_CONFIG: Record<string, { icon: string; color: string; label: string }> = {
  alipay:        { icon: '支', color: '#1677ff', label: 'Alipay' },
  wechat:        { icon: '微', color: '#07c160', label: 'WeChat' },
  bank_transfer: { icon: '🏦', color: '#8b5cf6', label: 'Virement' },
  cash:          { icon: '¥',  color: '#dc2626', label: 'Cash' },
};

const DEPOSIT_METHOD_COLORS: Record<string, string> = {
  bank_transfer: '#8b5cf6',
  bank_cash:     '#8b5cf6',
  agency_cash:   '#f59e0b',
  om_transfer:   '#f97316',
  om_withdrawal: '#f97316',
  mtn_transfer:  '#eab308',
  mtn_withdrawal:'#eab308',
  wave:          '#3b82f6',
};

// ════════════════════════════════════════════════════════════
// SHARED UI ATOMS
// ════════════════════════════════════════════════════════════

function SectionHeader({ icon: Icon, title, subtitle }: {
  icon: React.ElementType;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="flex items-center gap-2.5 mb-3">
      <div className="w-8 h-8 rounded-[10px] bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center">
        <Icon className="w-4 h-4 text-white" />
      </div>
      <div>
        <h2 className="text-[15px] font-bold">{title}</h2>
        {subtitle && <p className="text-[11px] text-muted-foreground">{subtitle}</p>}
      </div>
    </div>
  );
}

function StatCard({ label, value, sub, trend, trendLabel, icon: Icon, color }: {
  label: string;
  value: string;
  sub?: string;
  trend?: number;
  trendLabel?: string;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <div className="admin-card p-3.5 rounded-2xl flex-1 min-w-0 relative overflow-hidden">
      <div
        className="absolute -top-2 -right-2 w-10 h-10 rounded-full opacity-20"
        style={{ background: color }}
      />
      <div
        className="w-7 h-7 rounded-lg flex items-center justify-center mb-2"
        style={{ background: `${color}18` }}
      >
        <Icon className="w-3.5 h-3.5" style={{ color }} />
      </div>
      <p className="text-[10px] font-medium text-muted-foreground mb-1">{label}</p>
      <p className="text-lg font-extrabold leading-tight" style={{ fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </p>
      {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
      {trend !== undefined && (
        <div className={cn(
          'flex items-center gap-1 mt-1.5 text-[10px] font-semibold',
          trend >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400',
        )}>
          {trend >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
          {trend >= 0 ? '+' : ''}{trend}% {trendLabel || 'vs sem. dern.'}
        </div>
      )}
    </div>
  );
}

function ProgressBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="mb-2.5">
      <div className="flex justify-between text-[11px] mb-1">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-bold">{value}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-muted">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${value}%`, background: color }}
        />
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// MINI BAR CHART (pure CSS — no recharts dependency)
// ════════════════════════════════════════════════════════════

function MiniBarChart({ data, barKey1, barKey2, label1, label2, color1, color2, labelKey }: {
  data: Record<string, unknown>[];
  barKey1: string;
  barKey2: string;
  label1: string;
  label2: string;
  color1: string;
  color2: string;
  labelKey: string;
}) {
  const max = useMemo(() => {
    let m = 0;
    for (const d of data) {
      m = Math.max(m, (d[barKey1] as number) || 0, (d[barKey2] as number) || 0);
    }
    return m || 1;
  }, [data, barKey1, barKey2]);

  return (
    <div>
      <div className="flex items-end gap-1" style={{ height: 120 }}>
        {data.map((d, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
            <div className="w-full flex gap-px" style={{ height: 100, alignItems: 'flex-end' }}>
              <div
                className="flex-1 rounded-t-sm transition-all duration-500"
                style={{
                  height: `${((d[barKey1] as number) / max) * 100}%`,
                  background: color1,
                  minHeight: (d[barKey1] as number) > 0 ? 3 : 0,
                }}
              />
              <div
                className="flex-1 rounded-t-sm transition-all duration-500"
                style={{
                  height: `${((d[barKey2] as number) / max) * 100}%`,
                  background: color2,
                  minHeight: (d[barKey2] as number) > 0 ? 3 : 0,
                }}
              />
            </div>
            <span className="text-[9px] text-muted-foreground">{d[labelKey] as string}</span>
          </div>
        ))}
      </div>
      <div className="flex justify-center gap-4 mt-2 text-[10px]">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full" style={{ background: color1 }} />
          {label1}
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full" style={{ background: color2 }} />
          {label2}
        </span>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// MINI LINE CHART (pure CSS)
// ════════════════════════════════════════════════════════════

function MiniLineChart({ data, lines, labelKey }: {
  data: Record<string, unknown>[];
  lines: { key: string; label: string; color: string }[];
  labelKey: string;
}) {
  if (data.length < 2) return <p className="text-xs text-muted-foreground text-center py-8">Pas assez de données</p>;

  const allValues = data.flatMap(d => lines.map(l => (d[l.key] as number) || 0));
  const min = Math.min(...allValues);
  const max = Math.max(...allValues);
  const range = max - min || 1;
  const height = 120;
  const width = 280;
  const stepX = width / (data.length - 1);

  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ height: 120 }}>
        {lines.map(line => {
          const points = data.map((d, i) => {
            const val = (d[line.key] as number) || 0;
            const x = i * stepX;
            const y = height - ((val - min) / range) * (height - 16) - 8;
            return `${x},${y}`;
          }).join(' ');

          return (
            <polyline
              key={line.key}
              points={points}
              fill="none"
              stroke={line.color}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          );
        })}
      </svg>
      <div className="flex justify-between px-1 text-[9px] text-muted-foreground -mt-1">
        {data.map((d, i) => (
          <span key={i}>{d[labelKey] as string}</span>
        ))}
      </div>
      <div className="flex justify-center gap-3 mt-2 text-[10px]">
        {lines.map(l => (
          <span key={l.key} className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full" style={{ background: l.color }} />
            {l.label}
          </span>
        ))}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// DONUT CHART (pure SVG)
// ════════════════════════════════════════════════════════════

function DonutChart({ items }: { items: { label: string; value: number; color: string }[] }) {
  const total = items.reduce((s, i) => s + i.value, 0);
  if (total === 0) return null;

  const cx = 50, cy = 50, r = 35, innerR = 22;
  let startAngle = -90;

  const segments = items.map(item => {
    const angle = (item.value / total) * 360;
    const endAngle = startAngle + angle;
    const largeArc = angle > 180 ? 1 : 0;

    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const x1 = cx + r * Math.cos(toRad(startAngle));
    const y1 = cy + r * Math.sin(toRad(startAngle));
    const x2 = cx + r * Math.cos(toRad(endAngle));
    const y2 = cy + r * Math.sin(toRad(endAngle));
    const x3 = cx + innerR * Math.cos(toRad(endAngle));
    const y3 = cy + innerR * Math.sin(toRad(endAngle));
    const x4 = cx + innerR * Math.cos(toRad(startAngle));
    const y4 = cy + innerR * Math.sin(toRad(startAngle));

    const d = [
      `M ${x1} ${y1}`,
      `A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`,
      `L ${x3} ${y3}`,
      `A ${innerR} ${innerR} 0 ${largeArc} 0 ${x4} ${y4}`,
      'Z',
    ].join(' ');

    const segment = { d, color: item.color };
    startAngle = endAngle;
    return segment;
  });

  return (
    <svg viewBox="0 0 100 100" className="w-full" style={{ maxWidth: 140, margin: '0 auto' }}>
      {segments.map((seg, i) => (
        <path key={i} d={seg.d} fill={seg.color} />
      ))}
    </svg>
  );
}

// ════════════════════════════════════════════════════════════
// SECTION COMPONENTS
// ════════════════════════════════════════════════════════════

function OverviewSection() {
  const { data: stats } = useDashboardStats();
  const { data: depositStats } = useDepositStats();
  const { data: paymentStats } = usePaymentStats();
  const { data: rate } = useActiveDailyRate();

  const pendingTotal = (depositStats?.to_process || 0) + (paymentStats?.toProcess || 0) + (paymentStats?.inProgress || 0);

  return (
    <section className="space-y-2.5">
      <SectionHeader icon={BarChart3} title="Vue d'ensemble" subtitle="KPIs principaux — Temps réel" />
      <div className="flex gap-2.5">
        <StatCard
          icon={Wallet} label="Solde plateforme"
          value={formatCompact(stats?.totalWalletBalance || 0)} sub="XAF"
          color="hsl(258,100%,60%)"
        />
        <StatCard
          icon={Activity} label="Volume 7j"
          value={formatCompact(stats?.weekVolume || 0)} sub="XAF"
          color="hsl(36,100%,55%)"
        />
      </div>
      <div className="flex gap-2.5">
        <StatCard
          icon={ArrowDownToLine} label="Dépôts aujourd'hui"
          value={formatCompact(depositStats?.today_amount || 0)}
          sub={`${depositStats?.today_validated || 0} opérations`}
          color="hsl(142,76%,36%)"
        />
        <StatCard
          icon={ArrowUpFromLine} label="Paiements aujourd'hui"
          value={formatCompact(stats?.todayPaymentsAmount || 0)}
          sub={`${paymentStats?.today_completed || 0} opérations`}
          color="hsl(16,100%,55%)"
        />
      </div>
      {/* Mini KPI row */}
      <div className="admin-card rounded-2xl p-3.5 flex items-center">
        <div className="flex-1 text-center">
          <p className="text-base font-extrabold" style={{ color: 'hsl(258,100%,60%)' }}>
            {stats?.activeClients || 0}
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5">Clients actifs</p>
        </div>
        <div className="w-px h-7 bg-border" />
        <div className="flex-1 text-center">
          <p className="text-base font-extrabold" style={{ color: 'hsl(142,76%,36%)' }}>
            {depositStats ? `${Math.round(((depositStats.validated) / Math.max(depositStats.total, 1)) * 100)}%` : '—'}
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5">Taux validation</p>
        </div>
        <div className="w-px h-7 bg-border" />
        <div className="flex-1 text-center">
          <p className="text-base font-extrabold" style={{ color: 'hsl(16,100%,55%)' }}>
            {pendingTotal}
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5">En attente</p>
        </div>
        <div className="w-px h-7 bg-border" />
        <div className="flex-1 text-center">
          <p className="text-base font-extrabold" style={{ color: 'hsl(36,100%,55%)' }}>
            ¥{formatNumber(rate?.rate_alipay || 0)}
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5">Taux du jour</p>
        </div>
      </div>
    </section>
  );
}

function FinancialFlowSection() {
  const [period, setPeriod] = useState<7 | 30>(7);
  const { data: flowData } = useFinancialFlowData(period);
  const { data: netFlow } = useNetFlowStats(period);

  return (
    <section className="space-y-2.5">
      <div className="flex items-start justify-between">
        <SectionHeader icon={Activity} title="Flux financiers" subtitle="Dépôts vs Paiements" />
        <div className="flex bg-muted rounded-lg p-0.5 gap-0.5">
          {([7, 30] as const).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={cn(
                'px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all',
                period === p ? 'bg-background text-primary shadow-sm' : 'text-muted-foreground',
              )}
            >
              {p}j
            </button>
          ))}
        </div>
      </div>

      <div className="admin-card rounded-2xl p-3.5">
        {flowData && flowData.length > 0 ? (
          <MiniBarChart
            data={flowData}
            barKey1="deposits" barKey2="payments"
            label1="Dépôts" label2="Paiements"
            color1="hsl(142,76%,36%)" color2="hsl(16,100%,55%)"
            labelKey="day"
          />
        ) : (
          <p className="text-xs text-muted-foreground text-center py-8">Chargement...</p>
        )}
      </div>

      {netFlow && (
        <div className="admin-card rounded-2xl p-3.5">
          <p className="text-[11px] font-semibold text-muted-foreground mb-1">
            Flux net ({period === 7 ? 'semaine' : 'mois'})
          </p>
          <div className="flex items-baseline gap-1.5">
            <span className={cn(
              'text-xl font-extrabold',
              netFlow.netFlow >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400',
            )} style={{ fontVariantNumeric: 'tabular-nums' }}>
              {netFlow.netFlow >= 0 ? '+' : ''}{formatXAF(netFlow.netFlow)}
            </span>
            <span className="text-xs text-muted-foreground">XAF</span>
          </div>
          <p className="text-[10px] text-muted-foreground mt-1">
            Entrant: {formatCompact(netFlow.totalIn)} XAF · Sortant: {formatCompact(netFlow.totalOut)} XAF
          </p>
        </div>
      )}
    </section>
  );
}

function DepositAnalysisSection() {
  const { data: methodData } = useDepositMethodBreakdown();
  const { data: statusData } = useDepositStatusBreakdown();
  const { data: processingTime } = useAvgProcessingTime();

  const donutItems = useMemo(() =>
    (methodData || []).map(m => ({
      label: m.label,
      value: m.count,
      color: DEPOSIT_METHOD_COLORS[m.method] || '#94a3b8',
    })),
    [methodData],
  );

  return (
    <section className="space-y-2.5">
      <SectionHeader icon={ArrowDownToLine} title="Analyse dépôts" subtitle="Répartition et performance" />

      <div className="flex gap-2.5">
        {/* Method donut */}
        <div className="admin-card rounded-2xl p-3.5 flex-1">
          <p className="text-[11px] font-semibold text-muted-foreground mb-3">Par méthode</p>
          <DonutChart items={donutItems} />
          <div className="flex flex-col gap-1 mt-3">
            {(methodData || []).slice(0, 5).map((m, i) => (
              <div key={i} className="flex items-center gap-1.5 text-[10px]">
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: DEPOSIT_METHOD_COLORS[m.method] || '#94a3b8' }} />
                <span className="text-muted-foreground flex-1 truncate">{m.label}</span>
                <span className="font-bold">{m.percentage}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* Status + processing time */}
        <div className="flex-1 flex flex-col gap-2.5">
          <div className="admin-card rounded-2xl p-3.5">
            <p className="text-[11px] font-semibold text-muted-foreground mb-2">Statuts (3 mois)</p>
            <ProgressBar label="Validés" value={statusData?.validationRate || 0} color="hsl(142,76%,36%)" />
            <ProgressBar
              label="En attente"
              value={statusData ? 100 - statusData.validationRate - statusData.rejectionRate : 0}
              color="hsl(36,100%,55%)"
            />
            <ProgressBar label="Rejetés" value={statusData?.rejectionRate || 0} color="hsl(0,84%,60%)" />
          </div>
          <div className="rounded-2xl p-3.5 text-white bg-gradient-to-br from-primary to-primary/70">
            <p className="text-[10px] opacity-80 mb-1">Temps moyen de validation</p>
            <p className="text-2xl font-extrabold leading-tight">
              {processingTime?.avgMinutes || '—'}
              <span className="text-sm font-medium opacity-80">min</span>
            </p>
            <p className="text-[10px] opacity-60 mt-1">
              sur {processingTime?.count || 0} dépôts (30j)
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function PaymentAnalysisSection() {
  const { data: methodData } = usePaymentMethodBreakdown();
  const { data: volumeStats } = usePaymentVolumeStats();

  return (
    <section className="space-y-2.5">
      <SectionHeader icon={ArrowUpFromLine} title="Analyse paiements" subtitle="Méthodes et volumes vers la Chine" />

      {/* Payment method cards */}
      <div className="admin-card rounded-2xl p-3.5">
        <p className="text-[11px] font-semibold text-muted-foreground mb-3">Répartition par canal</p>
        <div className="grid grid-cols-4 gap-1.5">
          {(['alipay', 'wechat', 'bank_transfer', 'cash'] as const).map(method => {
            const config = PAYMENT_METHOD_CONFIG[method];
            const stat = methodData?.find(m => m.method === method);
            return (
              <div
                key={method}
                className="rounded-xl p-2.5 text-center border"
                style={{
                  background: `${config.color}08`,
                  borderColor: `${config.color}20`,
                }}
              >
                <div
                  className="w-8 h-8 rounded-lg mx-auto mb-1.5 flex items-center justify-center"
                  style={{ background: `${config.color}18` }}
                >
                  <span className="font-bold" style={{ color: config.color, fontSize: 14 }}>
                    {config.icon}
                  </span>
                </div>
                <p className="text-base font-extrabold" style={{ color: config.color }}>
                  {stat?.percentage || 0}%
                </p>
                <p className="text-[9px] text-muted-foreground mt-0.5">{config.label}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Volume stats */}
      <div className="flex gap-2.5">
        <div className="admin-card rounded-2xl p-3.5 flex-1">
          <p className="text-[10px] text-muted-foreground">Volume CNY (30j)</p>
          <p className="text-xl font-extrabold mt-1" style={{ fontVariantNumeric: 'tabular-nums' }}>
            ¥{formatCompact(volumeStats?.totalRMB30d || 0)}
          </p>
          {volumeStats?.trendRMB !== undefined && (
            <div className={cn(
              'flex items-center gap-1 mt-1 text-[10px] font-semibold',
              volumeStats.trendRMB >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500',
            )}>
              {volumeStats.trendRMB >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {volumeStats.trendRMB >= 0 ? '+' : ''}{volumeStats.trendRMB}%
            </div>
          )}
        </div>
        <div className="admin-card rounded-2xl p-3.5 flex-1">
          <p className="text-[10px] text-muted-foreground">Montant moyen</p>
          <p className="text-xl font-extrabold mt-1" style={{ fontVariantNumeric: 'tabular-nums' }}>
            {formatCompact(volumeStats?.avgPaymentXAF || 0)}
          </p>
          <p className="text-[10px] text-muted-foreground mt-1">XAF par paiement</p>
        </div>
      </div>
    </section>
  );
}

function RateHistorySection() {
  const { data: rateData } = useRateHistoryData(14);

  const rateRange = useMemo(() => {
    if (!rateData || rateData.length === 0) return null;
    const allRates = rateData.flatMap(r => [r.alipay, r.wechat, r.virement, r.cash].filter(Boolean));
    return {
      max: Math.max(...allRates),
      min: Math.min(...allRates),
      spread: allRates.length > 0 ? ((Math.max(...allRates) - Math.min(...allRates)) / Math.min(...allRates) * 100).toFixed(2) : '0',
    };
  }, [rateData]);

  return (
    <section className="space-y-2.5">
      <SectionHeader icon={TrendingUp} title="Évolution des taux" subtitle="Historique par méthode" />

      <div className="admin-card rounded-2xl p-3.5">
        {rateData && rateData.length >= 2 ? (
          <MiniLineChart
            data={rateData}
            lines={[
              { key: 'alipay', label: 'Alipay', color: '#1677ff' },
              { key: 'wechat', label: 'WeChat', color: '#07c160' },
              { key: 'virement', label: 'Virement', color: '#8b5cf6' },
              { key: 'cash', label: 'Cash', color: '#dc2626' },
            ]}
            labelKey="label"
          />
        ) : (
          <p className="text-xs text-muted-foreground text-center py-8">Pas assez de données</p>
        )}
      </div>

      {rateRange && (
        <div className="admin-card rounded-2xl p-3.5 flex gap-3">
          <div className="flex-1 text-center">
            <p className="text-[9px] text-muted-foreground">+ haut</p>
            <p className="text-sm font-extrabold text-green-600 dark:text-green-400 mt-1">
              ¥{formatNumber(rateRange.max)}
            </p>
          </div>
          <div className="w-px bg-border" />
          <div className="flex-1 text-center">
            <p className="text-[9px] text-muted-foreground">+ bas</p>
            <p className="text-sm font-extrabold text-red-500 dark:text-red-400 mt-1">
              ¥{formatNumber(rateRange.min)}
            </p>
          </div>
          <div className="w-px bg-border" />
          <div className="flex-1 text-center">
            <p className="text-[9px] text-muted-foreground">Variation</p>
            <p className="text-sm font-extrabold" style={{ color: 'hsl(36,100%,55%)' }}>
              {rateRange.spread}%
            </p>
          </div>
        </div>
      )}
    </section>
  );
}

function ClientInsightsSection() {
  const { data: growthData } = useClientGrowthData(6);
  const { data: topClients } = useTopClients(5);

  return (
    <section className="space-y-2.5">
      <SectionHeader icon={Users} title="Insights clients" subtitle="Croissance et activité" />

      {/* Growth chart */}
      <div className="admin-card rounded-2xl p-3.5">
        <p className="text-[11px] font-semibold text-muted-foreground mb-3">Croissance clients (6 mois)</p>
        {growthData && growthData.length >= 2 ? (
          <MiniLineChart
            data={growthData}
            lines={[{ key: 'total', label: 'Total clients', color: 'hsl(258,100%,60%)' }]}
            labelKey="month"
          />
        ) : (
          <p className="text-xs text-muted-foreground text-center py-8">Chargement...</p>
        )}
      </div>

      {/* Top clients */}
      <div className="admin-card rounded-2xl p-3.5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[11px] font-semibold text-muted-foreground">Top clients (volume 30j)</p>
          <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
        </div>
        {(!topClients || topClients.length === 0) ? (
          <p className="text-xs text-muted-foreground text-center py-6">Aucune donnée</p>
        ) : (
          <div className="space-y-0">
            {topClients.map((c, i) => (
              <div key={c.userId} className={cn(
                'flex items-center gap-2.5 py-2.5',
                i < topClients.length - 1 && 'border-b border-border/50',
              )}>
                <div className={cn(
                  'w-6 h-6 rounded-full text-[10px] font-bold flex items-center justify-center',
                  i === 0 ? 'bg-amber-500/15 text-amber-600' :
                  i === 1 ? 'bg-primary/10 text-primary' :
                  'bg-muted text-muted-foreground',
                )}>
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-semibold truncate">{c.firstName} {c.lastName}</p>
                  <p className="text-[10px] text-muted-foreground">{c.paymentCount} paiement{c.paymentCount > 1 ? 's' : ''}</p>
                </div>
                <p className="text-[12px] font-bold" style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {formatCompact(c.totalVolume)}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function OperationsSection() {
  const { data: adminData } = useAdminProductivity();

  return (
    <section className="space-y-2.5">
      <SectionHeader icon={Shield} title="Performance opérations" subtitle="Productivité admin (7j)" />

      <div className="admin-card rounded-2xl p-3.5">
        {(!adminData || adminData.length === 0) ? (
          <p className="text-xs text-muted-foreground text-center py-6">Aucune donnée cette semaine</p>
        ) : (
          <div className="space-y-0">
            {adminData.map((a, i) => (
              <div key={a.adminId} className={cn(
                'flex items-center gap-2.5 py-2.5',
                i < adminData.length - 1 && 'border-b border-border/50',
              )}>
                <div className={cn(
                  'w-8 h-8 rounded-[10px] flex items-center justify-center text-xs font-bold',
                  i === 0
                    ? 'bg-gradient-to-br from-primary to-primary/70 text-white'
                    : 'bg-muted text-muted-foreground',
                )}>
                  {a.firstName.charAt(0)}{a.lastName.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-semibold truncate">{a.firstName} {a.lastName}</p>
                  <p className="text-[10px] text-muted-foreground">{a.total} actions</p>
                </div>
                <div className="flex gap-3 text-center">
                  <div>
                    <p className="text-sm font-extrabold text-green-600 dark:text-green-400">{a.depositValidations}</p>
                    <p className="text-[8px] text-muted-foreground">Valid.</p>
                  </div>
                  <div>
                    <p className="text-sm font-extrabold" style={{ color: 'hsl(16,100%,55%)' }}>{a.paymentProcessed}</p>
                    <p className="text-[8px] text-muted-foreground">Paiem.</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function AlertsSection() {
  const { data: alerts } = useDashboardAlerts();

  if (!alerts || alerts.length === 0) return null;

  const alertStyles = {
    warning: { bg: 'bg-amber-500/10 border-amber-500/20', icon: Clock, color: 'text-amber-600 dark:text-amber-400' },
    danger:  { bg: 'bg-red-500/10 border-red-500/20', icon: AlertTriangle, color: 'text-red-500 dark:text-red-400' },
    info:    { bg: 'bg-primary/10 border-primary/20', icon: Users, color: 'text-primary' },
  };

  return (
    <section className="space-y-2.5">
      <SectionHeader icon={AlertTriangle} title="Alertes" subtitle="Points d'attention" />
      <div className="space-y-2">
        {alerts.map((alert, i) => {
          const style = alertStyles[alert.type];
          const Icon = style.icon;
          return (
            <div
              key={i}
              className={cn('flex items-center gap-2.5 px-3.5 py-3 rounded-xl border', style.bg)}
            >
              <Icon className={cn('w-4 h-4 flex-shrink-0', style.color)} />
              <span className="text-[11px] font-medium flex-1">{alert.message}</span>
              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ════════════════════════════════════════════════════════════

type FilterTab = 'all' | 'finance' | 'clients' | 'ops';

export function MobileAnalyticsDashboard() {
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const queryClient = useQueryClient();

  const handleRefresh = async () => {
    // Invalidate all analytics queries
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] }),
      queryClient.invalidateQueries({ queryKey: ['deposit-stats'] }),
      queryClient.invalidateQueries({ queryKey: ['payment-stats'] }),
      queryClient.invalidateQueries({ predicate: (q) => (q.queryKey[0] as string)?.startsWith?.('analytics') }),
    ]);
  };

  const tabs: { key: FilterTab; label: string }[] = [
    { key: 'all', label: 'Tout' },
    { key: 'finance', label: 'Finance' },
    { key: 'clients', label: 'Clients' },
    { key: 'ops', label: 'Ops' },
  ];

  return (
    <PullToRefresh onRefresh={handleRefresh} className="flex-1 overflow-y-auto">
      <div
        className="px-3 sm:px-4 lg:px-6 pb-24"
        style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 1rem)' }}
      >
        {/* ── Header ── */}
        <div className="flex items-start justify-between mb-3 animate-slide-up" style={{ animationFillMode: 'both' }}>
          <div>
            <h1 className="text-xl font-bold">Dashboard</h1>
            <p className="text-[11px] text-muted-foreground">Rapports et indicateurs clés</p>
          </div>
          <button
            onClick={() => handleRefresh()}
            className="w-8 h-8 rounded-lg border border-border bg-background flex items-center justify-center active:scale-95 transition-transform"
          >
            <RefreshCw className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
        </div>

        {/* ── Filter tabs ── */}
        <div className="flex bg-muted rounded-xl p-0.5 gap-0.5 mb-4 animate-slide-up" style={{ animationDelay: '50ms', animationFillMode: 'both' }}>
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={cn(
                'flex-1 py-2 rounded-[10px] text-[12px] font-semibold transition-all',
                activeTab === t.key
                  ? 'bg-background text-primary shadow-sm'
                  : 'text-muted-foreground',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Sections ── */}
        <div className="space-y-5">
          {(activeTab === 'all' || activeTab === 'finance') && (
            <>
              <div className="animate-slide-up" style={{ animationDelay: '100ms', animationFillMode: 'both' }}>
                <OverviewSection />
              </div>
              <div className="animate-slide-up" style={{ animationDelay: '150ms', animationFillMode: 'both' }}>
                <FinancialFlowSection />
              </div>
              <div className="animate-slide-up" style={{ animationDelay: '200ms', animationFillMode: 'both' }}>
                <DepositAnalysisSection />
              </div>
              <div className="animate-slide-up" style={{ animationDelay: '250ms', animationFillMode: 'both' }}>
                <PaymentAnalysisSection />
              </div>
              <div className="animate-slide-up" style={{ animationDelay: '300ms', animationFillMode: 'both' }}>
                <RateHistorySection />
              </div>
            </>
          )}
          {(activeTab === 'all' || activeTab === 'clients') && (
            <div className="animate-slide-up" style={{ animationDelay: activeTab === 'all' ? '350ms' : '100ms', animationFillMode: 'both' }}>
              <ClientInsightsSection />
            </div>
          )}
          {(activeTab === 'all' || activeTab === 'ops') && (
            <>
              <div className="animate-slide-up" style={{ animationDelay: activeTab === 'all' ? '400ms' : '100ms', animationFillMode: 'both' }}>
                <OperationsSection />
              </div>
              <div className="animate-slide-up" style={{ animationDelay: activeTab === 'all' ? '450ms' : '150ms', animationFillMode: 'both' }}>
                <AlertsSection />
              </div>
            </>
          )}
        </div>
      </div>
    </PullToRefresh>
  );
}
