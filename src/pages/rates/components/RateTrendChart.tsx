import { useState, useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { cn } from '@/lib/utils';
import { formatNumber } from '@/lib/formatters';
import { useClientRatesChart, type ChartPeriod } from '@/hooks/useDailyRates';
import { SURFACE, TEXT } from '@/mobile/designKit';

const LILAC = '#8B5CF6', GREEN = '#2E7D52', RED = '#C0504D';

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
    <div className="rounded-xl bg-[#1C1B22] px-3.5 py-2.5 shadow-lg">
      <p className="mb-1 text-[11px] text-white/50">{label}</p>
      <p className="text-base font-extrabold text-[#B5AAF0]">{formatNumber(payload[0].value)} ¥</p>
      <p className="text-[10px] text-white/40">pour 1 000 000 XAF</p>
    </div>
  );
}

export function RateTrendChart() {
  const [period, setPeriod] = useState<ChartPeriod>('30d');
  const { data: chartRates } = useClientRatesChart(period);

  const chartData = useMemo(() => {
    if (!chartRates || chartRates.length === 0) return [];
    return chartRates.map((r) => ({
      date: new Date(r.effective_at).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }),
      rate: r.rate_cash,
    }));
  }, [chartRates]);

  const stats = useMemo(() => {
    if (chartData.length === 0) return null;
    const vals = chartData.map((d) => d.rate);
    return {
      min: Math.min(...vals),
      max: Math.max(...vals),
      avg: Math.round(vals.reduce((a, b) => a + b, 0) / vals.length),
    };
  }, [chartData]);

  return (
    <section>
      <div className="mb-2 flex items-center justify-between px-1">
        <h2 className={cn('text-[12px] font-bold uppercase tracking-wider', TEXT.muted)}>Tendance</h2>
        <div className="flex gap-1.5">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={cn('rounded-full px-2.5 py-1 text-[11px] font-bold transition-colors', period === p.key ? 'bg-[#8B5CF6] text-white' : SURFACE.holder)}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className={cn('rounded-[22px] p-4', SURFACE.card, SURFACE.shadow)}>
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={chartData} margin={{ top: 5, right: 10, left: -15, bottom: 5 }}>
              <defs>
                <linearGradient id="clientRateGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={LILAC} stopOpacity={0.22} />
                  <stop offset="95%" stopColor={LILAC} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#9B98AD' }} axisLine={{ stroke: 'rgba(0,0,0,0.06)' }} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#9B98AD' }} axisLine={false} tickLine={false} domain={['dataMin - 50', 'dataMax + 50']} tickFormatter={(v) => formatNumber(v)} />
              <Tooltip content={<ChartTooltipContent />} />
              <Area type="monotone" dataKey="rate" stroke={LILAC} strokeWidth={2.5} fill="url(#clientRateGrad)" dot={{ r: 3, fill: LILAC, strokeWidth: 0 }} activeDot={{ r: 6, strokeWidth: 2, stroke: '#fff', fill: LILAC }} />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className={cn('flex h-[180px] items-center justify-center text-[14px]', TEXT.muted)}>Aucune donnée pour cette période</div>
        )}

        {stats && (
          <div className="mt-1 flex justify-around pt-2.5">
            {[
              { label: 'Min', value: stats.min, color: RED },
              { label: 'Moy', value: stats.avg, color: undefined },
              { label: 'Max', value: stats.max, color: GREEN },
            ].map((s) => (
              <div key={s.label} className="text-center">
                <span className={cn('text-[12px]', TEXT.muted)}>{s.label} : </span>
                <span className={cn('text-[13px] font-black tabular-nums', !s.color && TEXT.strong)} style={s.color ? { color: s.color } : undefined}>
                  {formatNumber(s.value)} ¥
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
