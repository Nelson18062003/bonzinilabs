import { useState, useMemo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { cn } from '@/lib/utils';
import { formatNumber } from '@/lib/formatters';
import { useClientRatesChart, type ChartPeriod } from '@/hooks/useDailyRates';
import type { DailyRate } from '@/types/rates';

const PERIODS: { key: ChartPeriod; label: string }[] = [
  { key: '7d', label: '7J' },
  { key: '30d', label: '30J' },
  { key: '3m', label: '3M' },
  { key: '1y', label: '1A' },
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ChartTooltipContent({ active, payload, label }: any) {
  if (!active || !payload?.[0]) return null;
  return (
    <div className="bg-[rgba(26,26,46,0.95)] rounded-xl px-3.5 py-2.5 shadow-lg">
      <p className="text-[11px] text-white/50 mb-1">{label}</p>
      <p className="text-base font-extrabold text-violet-400">
        {formatNumber(payload[0].value)} &yen;
      </p>
      <p className="text-[10px] text-white/40">pour 1 000 000 XAF</p>
    </div>
  );
}

export function RateTrendChart() {
  const [period, setPeriod] = useState<ChartPeriod>('30d');
  const { data: chartRates } = useClientRatesChart(period);

  const chartData = useMemo(() => {
    if (!chartRates || chartRates.length === 0) return [];
    return chartRates.map(r => ({
      date: new Date(r.effective_at).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }),
      rate: r.rate_cash,
    }));
  }, [chartRates]);

  const stats = useMemo(() => {
    if (chartData.length === 0) return null;
    const vals = chartData.map(d => d.rate);
    return {
      min: Math.min(...vals),
      max: Math.max(...vals),
      avg: Math.round(vals.reduce((a, b) => a + b, 0) / vals.length),
    };
  }, [chartData]);

  return (
    <div className="bg-white rounded-2xl pt-4 px-2 pb-3 shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
      <div className="px-2 mb-2.5">
        <p className="text-base font-bold text-gray-900">Tendance du taux</p>
      </div>

      {/* Period selector */}
      <div className="bg-gray-100 rounded-xl p-0.5 flex mx-2 mb-3.5">
        {PERIODS.map(p => (
          <button
            key={p.key}
            onClick={() => setPeriod(p.key)}
            className={cn(
              'flex-1 py-2 rounded-lg text-[13px] font-medium transition-all',
              period === p.key
                ? 'bg-white shadow-sm text-gray-900'
                : 'text-gray-400'
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Chart */}
      {chartData.length > 0 ? (
        <ResponsiveContainer width="100%" height={180}>
          <AreaChart data={chartData} margin={{ top: 5, right: 10, left: -15, bottom: 5 }}>
            <defs>
              <linearGradient id="clientRateGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#7c3aed" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f5" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10, fill: '#ccc' }}
              axisLine={{ stroke: '#f0f0f0' }}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 10, fill: '#ccc' }}
              axisLine={false}
              tickLine={false}
              domain={['dataMin - 50', 'dataMax + 50']}
              tickFormatter={v => formatNumber(v)}
            />
            <Tooltip content={<ChartTooltipContent />} />
            <Area
              type="monotone"
              dataKey="rate"
              stroke="#7c3aed"
              strokeWidth={2.5}
              fill="url(#clientRateGrad)"
              dot={{ r: 3, fill: '#7c3aed', strokeWidth: 0 }}
              activeDot={{ r: 6, strokeWidth: 2, stroke: '#fff', fill: '#7c3aed' }}
            />
          </AreaChart>
        </ResponsiveContainer>
      ) : (
        <div className="h-[180px] flex items-center justify-center text-sm text-gray-400">
          Aucune donn&eacute;e pour cette p&eacute;riode
        </div>
      )}

      {/* Stats */}
      {stats && (
        <div className="flex justify-around px-2 pt-2.5 mt-1">
          {[
            { label: 'Min', value: stats.min, color: 'text-red-500' },
            { label: 'Moy', value: stats.avg, color: 'text-gray-900' },
            { label: 'Max', value: stats.max, color: 'text-green-600' },
          ].map(s => (
            <div key={s.label} className="text-center">
              <span className="text-xs text-gray-400">{s.label}: </span>
              <span className={cn('text-sm font-extrabold', s.color)}>
                {formatNumber(s.value)} &yen;
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
