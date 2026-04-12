import { useState, useMemo, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { PullToRefresh } from '@/mobile/components/ui/PullToRefresh';
import { useDepositStats } from '@/hooks/useAdminDeposits';
import { useActiveDailyRate } from '@/hooks/useDailyRates';
import {
  useFinancialFlowData,
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
  useTotalClientsStats,
  useRegistrationSourceStats,
  useDepositVolumeReport,
  usePaymentVolumeReport,
  useUtmSourceStats,
  type PeriodGranularity,
} from '@/hooks/useDashboardAnalytics';
import { formatXAF, formatCompact, formatNumber } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import {
  BarChart3, Activity, ArrowDownToLine, ArrowUpFromLine,
  TrendingUp, TrendingDown, Users, Wallet, Star,
  Shield, AlertTriangle, ChevronRight,
  RefreshCw, Clock,
} from 'lucide-react';

// ════════════════════════════════════════════════════════════
// CONSTANTS — Payment & Deposit method visuals
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
// RECHARTS — Custom tooltip
// ════════════════════════════════════════════════════════════

function XAFTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-background/95 backdrop-blur-sm border border-border rounded-xl px-3 py-2 shadow-lg text-xs">
      <p className="font-semibold text-foreground mb-1">{label}</p>
      {payload.map((entry, i) => (
        <p key={i} className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: entry.color }} />
          <span className="text-muted-foreground">{entry.name}:</span>
          <span className="font-bold" style={{ fontVariantNumeric: 'tabular-nums' }}>{formatXAF(entry.value)} XAF</span>
        </p>
      ))}
    </div>
  );
}

function RateTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-background/95 backdrop-blur-sm border border-border rounded-xl px-3 py-2 shadow-lg text-xs">
      <p className="font-semibold text-foreground mb-1">{label}</p>
      {payload.map((entry, i) => (
        <p key={i} className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: entry.color }} />
          <span className="text-muted-foreground">{entry.name}:</span>
          <span className="font-bold">¥{formatNumber(entry.value)}</span>
        </p>
      ))}
    </div>
  );
}

function PctTooltip({ active, payload }: { active?: boolean; payload?: Array<{ name: string; value: number; color?: string; payload?: { color?: string } }> }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-background/95 backdrop-blur-sm border border-border rounded-xl px-3 py-2 shadow-lg text-xs">
      {payload.map((entry, i) => (
        <p key={i} className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: entry.payload?.color || entry.color }} />
          <span className="text-muted-foreground">{entry.name}:</span>
          <span className="font-bold">{entry.value}%</span>
        </p>
      ))}
    </div>
  );
}

// Axis tick formatter for XAF amounts
const fmtAxisXAF = (v: number) => formatCompact(v);

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
      <div className="absolute -top-2 -right-2 w-10 h-10 rounded-full opacity-20" style={{ background: color }} />
      <div className="w-7 h-7 rounded-lg flex items-center justify-center mb-2" style={{ background: `${color}18` }}>
        <Icon className="w-3.5 h-3.5" style={{ color }} />
      </div>
      <p className="text-[10px] font-medium text-muted-foreground mb-1">{label}</p>
      <p className="text-lg font-extrabold leading-tight" style={{ fontVariantNumeric: 'tabular-nums' }}>{value}</p>
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
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${value}%`, background: color }} />
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// SECTION 1 — Vue d'ensemble
// ════════════════════════════════════════════════════════════

function OverviewSection() {
  const { data: netFlow } = useNetFlowStats(7);
  const { data: clientStats } = useTotalClientsStats();
  const { data: depositStats } = useDepositStats();
  const { data: rate } = useActiveDailyRate();

  return (
    <section className="space-y-2.5">
      <SectionHeader icon={BarChart3} title="Vue d'ensemble" subtitle="KPIs principaux — Temps réel" />
      <div className="flex gap-2.5">
        <StatCard icon={ArrowDownToLine} label="Dépôts 7j" value={formatCompact(netFlow?.totalIn || 0)} sub="XAF" color="hsl(142,76%,36%)" />
        <StatCard icon={ArrowUpFromLine} label="Paiements 7j" value={formatCompact(netFlow?.totalOut || 0)} sub="XAF" color="hsl(0,84%,60%)" />
      </div>
      <div className="flex gap-2.5">
        <StatCard
          icon={netFlow && netFlow.netFlow >= 0 ? TrendingUp : TrendingDown}
          label="Flux net"
          value={`${netFlow && netFlow.netFlow >= 0 ? '+' : ''}${formatCompact(netFlow?.netFlow || 0)}`}
          sub="XAF"
          color={netFlow && netFlow.netFlow >= 0 ? 'hsl(142,76%,36%)' : 'hsl(0,84%,60%)'}
        />
        <StatCard icon={Users} label="Clients total" value={String(clientStats?.total || 0)} sub={`${clientStats?.active || 0} actifs`} color="#3b82f6" />
      </div>
      <div className="admin-card rounded-2xl p-3.5 flex items-center">
        <div className="flex-1 text-center">
          <p className="text-base font-extrabold" style={{ color: 'hsl(258,100%,60%)' }}>{clientStats?.active || 0}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">Clients actifs</p>
        </div>
        <div className="w-px h-7 bg-border" />
        <div className="flex-1 text-center">
          <p className="text-base font-extrabold" style={{ color: 'hsl(142,76%,36%)' }}>
            {depositStats ? `${Math.round((depositStats.validated / Math.max(depositStats.total, 1)) * 100)}%` : '—'}
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5">Taux validation</p>
        </div>
        <div className="w-px h-7 bg-border" />
        <div className="flex-1 text-center">
          <p className="text-base font-extrabold" style={{ color: 'hsl(36,100%,55%)' }}>¥{formatNumber(rate?.rate_alipay || 0)}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">Taux du jour</p>
        </div>
      </div>
    </section>
  );
}

// ════════════════════════════════════════════════════════════
// SECTION 2 — Flux financiers (Recharts BarChart)
// ════════════════════════════════════════════════════════════

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
            <button key={p} onClick={() => setPeriod(p)} className={cn(
              'px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all',
              period === p ? 'bg-background text-primary shadow-sm' : 'text-muted-foreground',
            )}>{p}j</button>
          ))}
        </div>
      </div>

      <div className="admin-card rounded-2xl p-3 pb-1">
        {flowData && flowData.length > 0 ? (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={flowData} barGap={2} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={fmtAxisXAF} width={50} />
              <Tooltip content={<XAFTooltip />} />
              <Bar dataKey="deposits" name="Dépôts" fill="hsl(142,76%,36%)" radius={[4, 4, 0, 0]} maxBarSize={24} />
              <Bar dataKey="payments" name="Paiements" fill="hsl(16,100%,55%)" radius={[4, 4, 0, 0]} maxBarSize={24} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-[200px] text-xs text-muted-foreground">Chargement...</div>
        )}
        <div className="flex justify-center gap-5 py-2 text-[10px]">
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: 'hsl(142,76%,36%)' }} /> Dépôts</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: 'hsl(16,100%,55%)' }} /> Paiements</span>
        </div>
      </div>

      {netFlow && (
        <div className="admin-card rounded-2xl p-3.5">
          <p className="text-[11px] font-semibold text-muted-foreground mb-1">Flux net ({period === 7 ? 'semaine' : 'mois'})</p>
          <div className="flex items-baseline gap-1.5">
            <span className={cn('text-xl font-extrabold', netFlow.netFlow >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400')} style={{ fontVariantNumeric: 'tabular-nums' }}>
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

// ════════════════════════════════════════════════════════════
// SECTION 3 — Analyse dépôts (Recharts PieChart)
// ════════════════════════════════════════════════════════════

function DepositAnalysisSection() {
  const { data: methodData } = useDepositMethodBreakdown();
  const { data: statusData } = useDepositStatusBreakdown();
  const { data: processingTime } = useAvgProcessingTime();

  const pieData = useMemo(() =>
    (methodData || []).map(m => ({
      name: m.label,
      value: m.percentage,
      count: m.count,
      color: DEPOSIT_METHOD_COLORS[m.method] || '#94a3b8',
    })),
    [methodData],
  );

  return (
    <section className="space-y-2.5">
      <SectionHeader icon={ArrowDownToLine} title="Analyse dépôts" subtitle="Répartition et performance" />

      <div className="flex gap-2.5">
        <div className="admin-card rounded-2xl p-3.5 flex-1">
          <p className="text-[11px] font-semibold text-muted-foreground mb-2">Par méthode (3 mois)</p>
          {pieData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={150}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%" cy="50%"
                    innerRadius={30} outerRadius={55}
                    paddingAngle={3}
                    dataKey="value"
                    nameKey="name"
                  >
                    {pieData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} stroke="none" />
                    ))}
                  </Pie>
                  <Tooltip content={<PctTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-col gap-1 mt-1">
                {pieData.slice(0, 5).map((m, i) => (
                  <div key={i} className="flex items-center gap-1.5 text-[10px]">
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: m.color }} />
                    <span className="text-muted-foreground flex-1 truncate">{m.name}</span>
                    <span className="font-bold">{m.value}%</span>
                    <span className="text-muted-foreground">({m.count})</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-[150px] text-xs text-muted-foreground">Aucune donnée</div>
          )}
        </div>

        <div className="flex-1 flex flex-col gap-2.5">
          <div className="admin-card rounded-2xl p-3.5">
            <p className="text-[11px] font-semibold text-muted-foreground mb-2">Statuts (3 mois)</p>
            <ProgressBar label="Validés" value={statusData?.validationRate || 0} color="hsl(142,76%,36%)" />
            <ProgressBar label="En attente" value={statusData ? Math.max(0, 100 - statusData.validationRate - statusData.rejectionRate) : 0} color="hsl(36,100%,55%)" />
            <ProgressBar label="Rejetés" value={statusData?.rejectionRate || 0} color="hsl(0,84%,60%)" />
            <div className="flex justify-between text-[10px] text-muted-foreground mt-1 pt-1 border-t border-border/50">
              <span>{statusData?.validated || 0} validés</span>
              <span>{statusData?.rejected || 0} rejetés</span>
              <span>{statusData?.pending || 0} en cours</span>
            </div>
          </div>
          <div className="rounded-2xl p-3.5 text-white bg-gradient-to-br from-primary to-primary/70">
            <div className="flex items-center gap-1.5 mb-1">
              <Clock className="w-3 h-3 opacity-80" />
              <p className="text-[10px] opacity-80">Temps moyen validation</p>
            </div>
            <p className="text-2xl font-extrabold leading-tight">
              {processingTime?.avgMinutes || '—'}<span className="text-sm font-medium opacity-80">min</span>
            </p>
            <p className="text-[10px] opacity-60 mt-1">sur {processingTime?.count || 0} dépôts (30j)</p>
          </div>
        </div>
      </div>
    </section>
  );
}

// ════════════════════════════════════════════════════════════
// SECTION 4 — Analyse paiements
// ════════════════════════════════════════════════════════════

function PaymentAnalysisSection() {
  const { data: methodData } = usePaymentMethodBreakdown();
  const { data: volumeStats } = usePaymentVolumeStats();

  return (
    <section className="space-y-2.5">
      <SectionHeader icon={ArrowUpFromLine} title="Analyse paiements" subtitle="Canaux et volumes vers la Chine" />

      <div className="admin-card rounded-2xl p-3.5">
        <p className="text-[11px] font-semibold text-muted-foreground mb-3">Répartition par canal (3 mois)</p>
        <div className="grid grid-cols-4 gap-1.5">
          {(['alipay', 'wechat', 'bank_transfer', 'cash'] as const).map(method => {
            const config = PAYMENT_METHOD_CONFIG[method];
            const stat = methodData?.find(m => m.method === method);
            return (
              <div key={method} className="rounded-xl p-2.5 text-center border" style={{ background: `${config.color}08`, borderColor: `${config.color}20` }}>
                <div className="w-8 h-8 rounded-lg mx-auto mb-1.5 flex items-center justify-center" style={{ background: `${config.color}18` }}>
                  <span className="font-bold" style={{ color: config.color, fontSize: 14 }}>{config.icon}</span>
                </div>
                <p className="text-base font-extrabold" style={{ color: config.color }}>{stat?.percentage || 0}%</p>
                <p className="text-[9px] text-muted-foreground mt-0.5">{config.label}</p>
                <p className="text-[9px] font-semibold mt-0.5">{stat?.count || 0} op.</p>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex gap-2.5">
        <div className="admin-card rounded-2xl p-3.5 flex-1">
          <p className="text-[10px] text-muted-foreground">Volume CNY (30j)</p>
          <p className="text-xl font-extrabold mt-1" style={{ fontVariantNumeric: 'tabular-nums' }}>¥{formatCompact(volumeStats?.totalRMB30d || 0)}</p>
          {volumeStats?.trendRMB !== undefined && (
            <div className={cn('flex items-center gap-1 mt-1 text-[10px] font-semibold', volumeStats.trendRMB >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500')}>
              {volumeStats.trendRMB >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {volumeStats.trendRMB >= 0 ? '+' : ''}{volumeStats.trendRMB}% vs mois préc.
            </div>
          )}
        </div>
        <div className="admin-card rounded-2xl p-3.5 flex-1">
          <p className="text-[10px] text-muted-foreground">Montant moyen</p>
          <p className="text-xl font-extrabold mt-1" style={{ fontVariantNumeric: 'tabular-nums' }}>{formatCompact(volumeStats?.avgPaymentXAF || 0)}</p>
          <p className="text-[10px] text-muted-foreground mt-1">XAF / paiement</p>
        </div>
        <div className="admin-card rounded-2xl p-3.5 flex-1">
          <p className="text-[10px] text-muted-foreground">Total (30j)</p>
          <p className="text-xl font-extrabold mt-1" style={{ fontVariantNumeric: 'tabular-nums' }}>{volumeStats?.totalCount30d || 0}</p>
          <p className="text-[10px] text-muted-foreground mt-1">paiements</p>
        </div>
      </div>
    </section>
  );
}

// ════════════════════════════════════════════════════════════
// SECTION 5 — Évolution des taux (Recharts LineChart)
// ════════════════════════════════════════════════════════════

function RateHistorySection() {
  const { data: rateData } = useRateHistoryData(14);

  const rateRange = useMemo(() => {
    if (!rateData || rateData.length === 0) return null;
    const allRates = rateData.flatMap(r => [r.alipay, r.wechat, r.virement, r.cash].filter(Boolean));
    if (allRates.length === 0) return null;
    const max = Math.max(...allRates);
    const min = Math.min(...allRates);
    return {
      max, min,
      spread: min > 0 ? ((max - min) / min * 100).toFixed(2) : '0',
    };
  }, [rateData]);

  return (
    <section className="space-y-2.5">
      <SectionHeader icon={TrendingUp} title="Évolution des taux" subtitle="Historique 14 jours par méthode" />

      <div className="admin-card rounded-2xl p-3 pb-1">
        {rateData && rateData.length >= 2 ? (
          <>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={rateData} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                <YAxis
                  domain={['dataMin - 20', 'dataMax + 20']}
                  tick={{ fontSize: 10 }}
                  axisLine={false} tickLine={false}
                  tickFormatter={(v: number) => `¥${formatNumber(v)}`}
                  width={55}
                />
                <Tooltip content={<RateTooltip />} />
                <Line type="monotone" dataKey="alipay" name="Alipay" stroke="#1677ff" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="wechat" name="WeChat" stroke="#07c160" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="virement" name="Virement" stroke="#8b5cf6" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="cash" name="Cash" stroke="#dc2626" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
            <div className="flex justify-center gap-3 py-2 text-[10px] flex-wrap">
              {[
                { label: 'Alipay', color: '#1677ff' },
                { label: 'WeChat', color: '#07c160' },
                { label: 'Virement', color: '#8b5cf6' },
                { label: 'Cash', color: '#dc2626' },
              ].map(l => (
                <span key={l.label} className="flex items-center gap-1">
                  <span className="w-2.5 h-0.5 rounded-full" style={{ background: l.color }} />
                  {l.label}
                </span>
              ))}
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-[200px] text-xs text-muted-foreground">Pas assez de données</div>
        )}
      </div>

      {rateRange && (
        <div className="admin-card rounded-2xl p-3.5 flex gap-3">
          <div className="flex-1 text-center">
            <p className="text-[9px] text-muted-foreground">+ haut (14j)</p>
            <p className="text-sm font-extrabold text-green-600 dark:text-green-400 mt-1">¥{formatNumber(rateRange.max)}</p>
          </div>
          <div className="w-px bg-border" />
          <div className="flex-1 text-center">
            <p className="text-[9px] text-muted-foreground">+ bas (14j)</p>
            <p className="text-sm font-extrabold text-red-500 dark:text-red-400 mt-1">¥{formatNumber(rateRange.min)}</p>
          </div>
          <div className="w-px bg-border" />
          <div className="flex-1 text-center">
            <p className="text-[9px] text-muted-foreground">Variation</p>
            <p className="text-sm font-extrabold" style={{ color: 'hsl(36,100%,55%)' }}>{rateRange.spread}%</p>
          </div>
        </div>
      )}
    </section>
  );
}

// ════════════════════════════════════════════════════════════
// SECTION 6 — Insights clients (Recharts AreaChart)
// ════════════════════════════════════════════════════════════

function ClientInsightsSection() {
  const { data: growthData } = useClientGrowthData(6);
  const { data: topClients } = useTopClients(5);

  return (
    <section className="space-y-2.5">
      <SectionHeader icon={Users} title="Insights clients" subtitle="Croissance et activité" />

      <div className="admin-card rounded-2xl p-3 pb-1">
        <p className="text-[11px] font-semibold text-muted-foreground mb-2 px-0.5">Croissance clients (6 mois)</p>
        {growthData && growthData.length >= 2 ? (
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={growthData} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="gradViolet" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(258,100%,60%)" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="hsl(258,100%,60%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={30} />
              <Tooltip
                contentStyle={{ borderRadius: 10, border: '1px solid hsl(var(--border))', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', fontSize: 12 }}
                formatter={(value: number, name: string) => [value, name === 'total' ? 'Total clients' : 'Nouveaux']}
              />
              <Area type="monotone" dataKey="total" name="Total clients" stroke="hsl(258,100%,60%)" fill="url(#gradViolet)" strokeWidth={2} />
              <Bar dataKey="newClients" name="Nouveaux" fill="hsl(36,100%,55%)" radius={[3, 3, 0, 0]} maxBarSize={16} />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-[180px] text-xs text-muted-foreground">Chargement...</div>
        )}
      </div>

      <div className="admin-card rounded-2xl p-3.5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[11px] font-semibold text-muted-foreground">Top clients (volume 30j)</p>
          <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
        </div>
        {(!topClients || topClients.length === 0) ? (
          <p className="text-xs text-muted-foreground text-center py-6">Aucune donnée</p>
        ) : (
          topClients.map((c, i) => (
            <div key={c.userId} className={cn('flex items-center gap-2.5 py-2.5', i < topClients.length - 1 && 'border-b border-border/50')}>
              <div className={cn(
                'w-6 h-6 rounded-full text-[10px] font-bold flex items-center justify-center',
                i === 0 ? 'bg-amber-500/15 text-amber-600' : i === 1 ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground',
              )}>{i + 1}</div>
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-semibold truncate">{c.firstName} {c.lastName}</p>
                <p className="text-[10px] text-muted-foreground">{c.paymentCount} paiement{c.paymentCount > 1 ? 's' : ''}</p>
              </div>
              <p className="text-[12px] font-bold" style={{ fontVariantNumeric: 'tabular-nums' }}>{formatCompact(c.totalVolume)} XAF</p>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

// ════════════════════════════════════════════════════════════
// SECTION 7 — Performance opérations
// ════════════════════════════════════════════════════════════

function OperationsSection() {
  const { data: adminData } = useAdminProductivity();

  return (
    <section className="space-y-2.5">
      <SectionHeader icon={Shield} title="Performance opérations" subtitle="Productivité admin (7j)" />
      <div className="admin-card rounded-2xl p-3.5">
        {(!adminData || adminData.length === 0) ? (
          <p className="text-xs text-muted-foreground text-center py-6">Aucune donnée cette semaine</p>
        ) : (
          adminData.map((a, i) => (
            <div key={a.adminId} className={cn('flex items-center gap-2.5 py-2.5', i < adminData.length - 1 && 'border-b border-border/50')}>
              <div className={cn(
                'w-8 h-8 rounded-[10px] flex items-center justify-center text-xs font-bold',
                i === 0 ? 'bg-gradient-to-br from-primary to-primary/70 text-white' : 'bg-muted text-muted-foreground',
              )}>{a.firstName.charAt(0)}{a.lastName.charAt(0)}</div>
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-semibold truncate">{a.firstName} {a.lastName}</p>
                <p className="text-[10px] text-muted-foreground">{a.total} actions totales</p>
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
          ))
        )}
      </div>
    </section>
  );
}

// ════════════════════════════════════════════════════════════
// SECTION 8 — Alertes
// ════════════════════════════════════════════════════════════

function AlertsSection() {
  const { data: alerts } = useDashboardAlerts();
  if (!alerts || alerts.length === 0) return null;

  const alertStyles: Record<string, { bg: string; icon: React.ElementType; color: string }> = {
    warning: { bg: 'bg-amber-500/10 border-amber-500/20', icon: Clock, color: 'text-amber-600 dark:text-amber-400' },
    danger:  { bg: 'bg-red-500/10 border-red-500/20', icon: AlertTriangle, color: 'text-red-500 dark:text-red-400' },
    info:    { bg: 'bg-primary/10 border-primary/20', icon: Users, color: 'text-primary' },
  };

  return (
    <section className="space-y-2.5">
      <SectionHeader icon={AlertTriangle} title="Alertes" subtitle="Points d'attention" />
      <div className="space-y-2">
        {alerts.map((alert, i) => {
          const style = alertStyles[alert.type] || alertStyles.info;
          const Icon = style.icon;
          return (
            <div key={i} className={cn('flex items-center gap-2.5 px-3.5 py-3 rounded-xl border', style.bg)}>
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
// SHARED — Volume Tooltip + Period Selector
// ════════════════════════════════════════════════════════════

function VolumeTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; payload?: { count?: number; avgAmount?: number } }>; label?: string }) {
  if (!active || !payload?.length) return null;
  const d = payload[0];
  return (
    <div className="bg-background/95 backdrop-blur-sm border border-border rounded-xl px-3 py-2 shadow-lg text-xs">
      <p className="font-semibold text-foreground mb-1">{label}</p>
      <p className="flex items-center gap-1.5">
        <span className="text-muted-foreground">Volume:</span>
        <span className="font-bold" style={{ fontVariantNumeric: 'tabular-nums' }}>{formatXAF(d.value)} XAF</span>
      </p>
      {d.payload?.count !== undefined && (
        <p className="flex items-center gap-1.5 mt-0.5">
          <span className="text-muted-foreground">Opérations:</span>
          <span className="font-bold">{d.payload.count}</span>
        </p>
      )}
      {d.payload?.avgAmount !== undefined && d.payload.avgAmount > 0 && (
        <p className="flex items-center gap-1.5 mt-0.5">
          <span className="text-muted-foreground">Moy.:</span>
          <span className="font-bold" style={{ fontVariantNumeric: 'tabular-nums' }}>{formatCompact(d.payload.avgAmount)} XAF</span>
        </p>
      )}
    </div>
  );
}

function PeriodSelector({ value, onChange }: { value: PeriodGranularity; onChange: (v: PeriodGranularity) => void }) {
  const options: { key: PeriodGranularity; label: string }[] = [
    { key: 'day', label: 'Jour' },
    { key: 'week', label: 'Semaine' },
    { key: 'month', label: 'Mois' },
  ];
  return (
    <div className="flex bg-muted rounded-lg p-0.5 gap-0.5">
      {options.map(o => (
        <button key={o.key} onClick={() => onChange(o.key)} className={cn(
          'px-2 py-1 rounded-md text-[11px] font-semibold transition-all',
          value === o.key ? 'bg-background text-primary shadow-sm' : 'text-muted-foreground',
        )}>{o.label}</button>
      ))}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// SECTION 2b — Rapport volume dépôts
// ════════════════════════════════════════════════════════════

function DepositVolumeReportSection() {
  const [granularity, setGranularity] = useState<PeriodGranularity>('day');
  const { data: report } = useDepositVolumeReport(granularity);

  const dateRange = useMemo(() => {
    if (!report?.points || report.points.length === 0) return '';
    return `${report.points[0].label} → ${report.points[report.points.length - 1].label}`;
  }, [report]);

  return (
    <section className="space-y-2.5">
      <div className="flex items-start justify-between">
        <SectionHeader icon={ArrowDownToLine} title="Rapport dépôts" subtitle="Volume par période" />
        <PeriodSelector value={granularity} onChange={setGranularity} />
      </div>

      {dateRange && (
        <div className="text-[10px] font-medium text-green-600 dark:text-green-400 bg-green-500/10 rounded-lg px-3 py-1.5">
          {dateRange}
        </div>
      )}

      <div className="flex gap-2">
        <div className="admin-card rounded-2xl p-3 flex-1 text-center">
          <p className="text-[9px] text-muted-foreground">Volume total</p>
          <p className="text-base font-extrabold mt-1" style={{ fontVariantNumeric: 'tabular-nums' }}>{formatCompact(report?.totalVolume || 0)}</p>
          <p className="text-[9px] text-muted-foreground">XAF</p>
        </div>
        <div className="admin-card rounded-2xl p-3 flex-1 text-center">
          <p className="text-[9px] text-muted-foreground">Opérations</p>
          <p className="text-base font-extrabold mt-1">{report?.totalCount || 0}</p>
          <p className="text-[9px] text-muted-foreground">dépôts</p>
        </div>
        <div className="admin-card rounded-2xl p-3 flex-1 text-center">
          <p className="text-[9px] text-muted-foreground">Montant moy.</p>
          <p className="text-base font-extrabold mt-1" style={{ fontVariantNumeric: 'tabular-nums' }}>{formatCompact(report?.avgAmount || 0)}</p>
          <p className="text-[9px] text-muted-foreground">XAF</p>
        </div>
      </div>

      <div className="admin-card rounded-2xl p-3 pb-1">
        {report && report.points.length > 0 ? (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={report.points} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="gradGreen" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(142,76%,36%)" stopOpacity={0.9} />
                  <stop offset="100%" stopColor="hsl(142,76%,36%)" stopOpacity={0.4} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={fmtAxisXAF} width={50} />
              <Tooltip content={<VolumeTooltip />} />
              <Bar dataKey="volume" name="Dépôts" fill="url(#gradGreen)" radius={[4, 4, 0, 0]} maxBarSize={28} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-[200px] text-xs text-muted-foreground">Chargement...</div>
        )}
      </div>

      {report && (
        <div className="admin-card rounded-2xl p-3.5 flex items-center">
          <div className="flex-1">
            <p className="text-[9px] text-muted-foreground">Pic le plus haut</p>
            <p className="text-sm font-extrabold text-green-600 dark:text-green-400 mt-0.5" style={{ fontVariantNumeric: 'tabular-nums' }}>{formatCompact(report.peakVolume)} XAF</p>
            <p className="text-[9px] text-muted-foreground mt-0.5">{report.peakLabel}</p>
          </div>
          <div className="w-px h-8 bg-border mx-3" />
          <div className="flex-1 text-right">
            <p className="text-[9px] text-muted-foreground">Tendance</p>
            <div className={cn('flex items-center justify-end gap-1 mt-0.5 text-sm font-extrabold', report.trend >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500')}>
              {report.trend >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
              {report.trend >= 0 ? '+' : ''}{report.trend}%
            </div>
            <p className="text-[9px] text-muted-foreground mt-0.5">vs période préc.</p>
          </div>
        </div>
      )}
    </section>
  );
}

// ════════════════════════════════════════════════════════════
// SECTION 4b — Rapport volume paiements
// ════════════════════════════════════════════════════════════

function PaymentVolumeReportSection() {
  const [granularity, setGranularity] = useState<PeriodGranularity>('day');
  const { data: report } = usePaymentVolumeReport(granularity);

  const dateRange = useMemo(() => {
    if (!report?.points || report.points.length === 0) return '';
    return `${report.points[0].label} → ${report.points[report.points.length - 1].label}`;
  }, [report]);

  return (
    <section className="space-y-2.5">
      <div className="flex items-start justify-between">
        <SectionHeader icon={ArrowUpFromLine} title="Rapport paiements" subtitle="Volume par période" />
        <PeriodSelector value={granularity} onChange={setGranularity} />
      </div>

      {dateRange && (
        <div className="text-[10px] font-medium text-orange-600 dark:text-orange-400 bg-orange-500/10 rounded-lg px-3 py-1.5">
          {dateRange}
        </div>
      )}

      <div className="flex gap-2">
        <div className="admin-card rounded-2xl p-3 flex-1 text-center">
          <p className="text-[9px] text-muted-foreground">Volume total</p>
          <p className="text-base font-extrabold mt-1" style={{ fontVariantNumeric: 'tabular-nums' }}>{formatCompact(report?.totalVolume || 0)}</p>
          <p className="text-[9px] text-muted-foreground">XAF</p>
        </div>
        <div className="admin-card rounded-2xl p-3 flex-1 text-center">
          <p className="text-[9px] text-muted-foreground">Paiements</p>
          <p className="text-base font-extrabold mt-1">{report?.totalCount || 0}</p>
          <p className="text-[9px] text-muted-foreground">envoyés</p>
        </div>
        <div className="admin-card rounded-2xl p-3 flex-1 text-center">
          <p className="text-[9px] text-muted-foreground">Montant moy.</p>
          <p className="text-base font-extrabold mt-1" style={{ fontVariantNumeric: 'tabular-nums' }}>{formatCompact(report?.avgAmount || 0)}</p>
          <p className="text-[9px] text-muted-foreground">XAF</p>
        </div>
      </div>

      <div className="admin-card rounded-2xl p-3 pb-1">
        {report && report.points.length > 0 ? (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={report.points} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="gradOrange" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(16,100%,55%)" stopOpacity={0.9} />
                  <stop offset="100%" stopColor="hsl(16,100%,55%)" stopOpacity={0.4} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={fmtAxisXAF} width={50} />
              <Tooltip content={<VolumeTooltip />} />
              <Bar dataKey="volume" name="Paiements" fill="url(#gradOrange)" radius={[4, 4, 0, 0]} maxBarSize={28} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-[200px] text-xs text-muted-foreground">Chargement...</div>
        )}
      </div>

      {report && (
        <div className="admin-card rounded-2xl p-3.5 flex items-center">
          <div className="flex-1">
            <p className="text-[9px] text-muted-foreground">Pic le plus haut</p>
            <p className="text-sm font-extrabold" style={{ color: 'hsl(16,100%,55%)', fontVariantNumeric: 'tabular-nums' }}>{formatCompact(report.peakVolume)} XAF</p>
            <p className="text-[9px] text-muted-foreground mt-0.5">{report.peakLabel}</p>
          </div>
          <div className="w-px h-8 bg-border mx-3" />
          <div className="flex-1 text-right">
            <p className="text-[9px] text-muted-foreground">Tendance</p>
            <div className={cn('flex items-center justify-end gap-1 mt-0.5 text-sm font-extrabold', report.trend >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500')}>
              {report.trend >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
              {report.trend >= 0 ? '+' : ''}{report.trend}%
            </div>
            <p className="text-[9px] text-muted-foreground mt-0.5">vs période préc.</p>
          </div>
        </div>
      )}
    </section>
  );
}

// ════════════════════════════════════════════════════════════
// SECTION 6b — Statistiques utilisateurs
// ════════════════════════════════════════════════════════════

function UserStatsSection() {
  const { data: clientStats } = useTotalClientsStats();
  const { data: regStats } = useRegistrationSourceStats(6);
  const { data: utmStats } = useUtmSourceStats();

  return (
    <section className="space-y-2.5">
      <SectionHeader icon={Users} title="Statistiques utilisateurs" subtitle="Inscriptions et provenance" />

      <div className="admin-card rounded-2xl p-3.5">
        <div className="flex gap-3">
          <div className="flex-1 text-center">
            <p className="text-2xl font-extrabold" style={{ color: 'hsl(258,100%,60%)' }}>{clientStats?.total || 0}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Total clients</p>
          </div>
          <div className="w-px bg-border" />
          <div className="flex-1 text-center">
            <p className="text-2xl font-extrabold text-green-600 dark:text-green-400">{clientStats?.active || 0}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Actifs</p>
          </div>
          <div className="w-px bg-border" />
          <div className="flex-1 text-center">
            <p className="text-2xl font-extrabold text-muted-foreground">{clientStats?.inactive || 0}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Inactifs</p>
          </div>
          <div className="w-px bg-border" />
          <div className="flex-1 text-center">
            <p className="text-2xl font-extrabold" style={{ color: 'hsl(36,100%,55%)' }}>{clientStats?.kycVerified || 0}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">KYC vérifié</p>
          </div>
        </div>
      </div>

      <div className="admin-card rounded-2xl p-3 pb-1">
        <p className="text-[11px] font-semibold text-muted-foreground mb-2 px-0.5">Source d'inscription (6 mois)</p>
        {regStats && regStats.monthly.length > 0 ? (
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={regStats.monthly} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={30} allowDecimals={false} />
              <Tooltip
                contentStyle={{ borderRadius: 10, border: '1px solid hsl(var(--border))', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', fontSize: 12 }}
                formatter={(value: number, name: string) => [value, name === 'adminCreated' ? 'Créés par admin' : 'Auto-inscrits']}
              />
              <Bar dataKey="adminCreated" name="adminCreated" fill="#8b5cf6" stackId="reg" radius={[0, 0, 0, 0]} maxBarSize={20} />
              <Bar dataKey="selfRegistered" name="selfRegistered" fill="#f59e0b" stackId="reg" radius={[4, 4, 0, 0]} maxBarSize={20} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-[180px] text-xs text-muted-foreground">Chargement...</div>
        )}
        <div className="flex justify-center gap-5 py-2 text-[10px]">
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: '#8b5cf6' }} /> Créés par admin</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: '#f59e0b' }} /> Auto-inscrits</span>
        </div>
      </div>

      <div className="flex gap-2.5">
        <div className="admin-card rounded-2xl p-3.5 flex-1">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: '#8b5cf618' }}>
              <Shield className="w-3.5 h-3.5" style={{ color: '#8b5cf6' }} />
            </div>
            <p className="text-[10px] text-muted-foreground">Créés par admin</p>
          </div>
          <p className="text-xl font-extrabold" style={{ color: '#8b5cf6' }}>{regStats?.adminCreatedPct || 0}%</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">{regStats?.adminCreated || 0} clients</p>
        </div>
        <div className="admin-card rounded-2xl p-3.5 flex-1">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: '#f59e0b18' }}>
              <Users className="w-3.5 h-3.5" style={{ color: '#f59e0b' }} />
            </div>
            <p className="text-[10px] text-muted-foreground">Auto-inscrits</p>
          </div>
          <p className="text-xl font-extrabold" style={{ color: '#f59e0b' }}>{regStats?.selfRegisteredPct || 0}%</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">{regStats?.selfRegistered || 0} clients</p>
        </div>
      </div>

      {utmStats && utmStats.rows.length > 0 && (
        <div className="admin-card rounded-2xl p-3.5">
          <p className="text-[11px] font-semibold text-muted-foreground mb-3 px-0.5">Source UTM des inscriptions</p>
          {utmStats.rows.map(({ source, count, pct }) => (
            <div key={source} className="flex items-center gap-2 mb-2">
              <span className="text-[11px] w-24 truncate font-medium capitalize">{source}</span>
              <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${pct}%`, background: 'hsl(258,100%,60%)' }}
                />
              </div>
              <span className="text-[11px] text-muted-foreground w-16 text-right">
                {count} ({pct}%)
              </span>
            </div>
          ))}
          <p className="text-[10px] text-muted-foreground mt-1 text-right">
            {utmStats.total} inscription{utmStats.total > 1 ? 's' : ''} tracée{utmStats.total > 1 ? 's' : ''}
          </p>
        </div>
      )}
    </section>
  );
}

// ════════════════════════════════════════════════════════════
// MAIN — MobileAnalyticsDashboard
// ════════════════════════════════════════════════════════════

type FilterTab = 'all' | 'finance' | 'clients' | 'ops';

export function MobileAnalyticsDashboard() {
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const queryClient = useQueryClient();

  const handleRefresh = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] }),
      queryClient.invalidateQueries({ queryKey: ['deposit-stats'] }),
      queryClient.invalidateQueries({ queryKey: ['payment-stats'] }),
      queryClient.invalidateQueries({ predicate: (q) => (q.queryKey[0] as string)?.startsWith?.('analytics') }),
    ]);
  }, [queryClient]);

  const tabs: { key: FilterTab; label: string }[] = [
    { key: 'all', label: 'Tout' },
    { key: 'finance', label: 'Finance' },
    { key: 'clients', label: 'Clients' },
    { key: 'ops', label: 'Ops' },
  ];

  return (
    <PullToRefresh onRefresh={handleRefresh} className="flex-1 overflow-y-auto">
      <div className="px-3 sm:px-4 lg:px-6 pb-24" style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 1rem)' }}>
        {/* Header */}
        <div className="flex items-start justify-between mb-3 animate-slide-up" style={{ animationFillMode: 'both' }}>
          <div>
            <h1 className="text-xl font-bold">Dashboard</h1>
            <p className="text-[11px] text-muted-foreground">Rapports et indicateurs clés</p>
          </div>
          <button onClick={handleRefresh} className="w-8 h-8 rounded-lg border border-border bg-background flex items-center justify-center active:scale-95 transition-transform">
            <RefreshCw className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
        </div>

        {/* Filter tabs */}
        <div className="flex bg-muted rounded-xl p-0.5 gap-0.5 mb-4 animate-slide-up" style={{ animationDelay: '50ms', animationFillMode: 'both' }}>
          {tabs.map(t => (
            <button key={t.key} onClick={() => setActiveTab(t.key)} className={cn(
              'flex-1 py-2 rounded-[10px] text-[12px] font-semibold transition-all',
              activeTab === t.key ? 'bg-background text-primary shadow-sm' : 'text-muted-foreground',
            )}>{t.label}</button>
          ))}
        </div>

        {/* Sections */}
        <div className="space-y-5">
          {(activeTab === 'all' || activeTab === 'finance') && (
            <>
              <div className="animate-slide-up" style={{ animationDelay: '100ms', animationFillMode: 'both' }}><OverviewSection /></div>
              <div className="animate-slide-up" style={{ animationDelay: '150ms', animationFillMode: 'both' }}><FinancialFlowSection /></div>
              <div className="animate-slide-up" style={{ animationDelay: '180ms', animationFillMode: 'both' }}><DepositVolumeReportSection /></div>
              <div className="animate-slide-up" style={{ animationDelay: '200ms', animationFillMode: 'both' }}><DepositAnalysisSection /></div>
              <div className="animate-slide-up" style={{ animationDelay: '250ms', animationFillMode: 'both' }}><PaymentAnalysisSection /></div>
              <div className="animate-slide-up" style={{ animationDelay: '280ms', animationFillMode: 'both' }}><PaymentVolumeReportSection /></div>
              <div className="animate-slide-up" style={{ animationDelay: '300ms', animationFillMode: 'both' }}><RateHistorySection /></div>
            </>
          )}
          {(activeTab === 'all' || activeTab === 'clients') && (
            <>
              <div className="animate-slide-up" style={{ animationDelay: activeTab === 'all' ? '350ms' : '100ms', animationFillMode: 'both' }}><ClientInsightsSection /></div>
              <div className="animate-slide-up" style={{ animationDelay: activeTab === 'all' ? '380ms' : '130ms', animationFillMode: 'both' }}><UserStatsSection /></div>
            </>
          )}
          {(activeTab === 'all' || activeTab === 'ops') && (
            <>
              <div className="animate-slide-up" style={{ animationDelay: activeTab === 'all' ? '400ms' : '100ms', animationFillMode: 'both' }}><OperationsSection /></div>
              <div className="animate-slide-up" style={{ animationDelay: activeTab === 'all' ? '450ms' : '150ms', animationFillMode: 'both' }}><AlertsSection /></div>
            </>
          )}
        </div>
      </div>
    </PullToRefresh>
  );
}
