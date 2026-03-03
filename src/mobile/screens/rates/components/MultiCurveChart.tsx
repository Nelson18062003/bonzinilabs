import { useMemo, useState } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
} from 'recharts';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { PAYMENT_METHODS } from '@/types/rates';
import type { DailyRate } from '@/types/rates';

interface MultiCurveChartProps {
  data: DailyRate[];
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) {
  if (!active || !payload) return null;
  return (
    <div className="rounded-xl p-3 shadow-lg" style={{ background: 'rgba(26,26,46,0.95)' }}>
      <div className="text-[11px] text-white/50 mb-1.5">{label}</div>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-1.5 mb-0.5">
          <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-xs text-white/70">{p.name}</span>
          <span className="text-xs font-bold text-white ml-auto pl-3">
            {p.value.toLocaleString('fr-FR')}
          </span>
        </div>
      ))}
    </div>
  );
}

export function MultiCurveChart({ data }: MultiCurveChartProps) {
  const [visibleLines, setVisibleLines] = useState<Record<string, boolean>>({
    cash: true,
    alipay: true,
    wechat: true,
    virement: true,
  });

  const chartData = useMemo(() => {
    return data.map((d) => ({
      date: format(parseISO(d.effective_at), 'dd/MM', { locale: fr }),
      cash: d.rate_cash,
      alipay: d.rate_alipay,
      wechat: d.rate_wechat,
      virement: d.rate_virement,
    }));
  }, [data]);

  const stats = useMemo(() => {
    if (chartData.length === 0) return { min: 0, max: 0, avg: 0 };
    const vals = chartData.map((d) => d.cash);
    return {
      min: Math.min(...vals),
      max: Math.max(...vals),
      avg: Math.round(vals.reduce((a, b) => a + b, 0) / vals.length),
    };
  }, [chartData]);

  const toggleLine = (key: string) => {
    const next = { ...visibleLines, [key]: !visibleLines[key] };
    if (Object.values(next).filter(Boolean).length < 1) return;
    setVisibleLines(next);
  };

  // Spread between modes
  const lastPoint = chartData[chartData.length - 1];

  return (
    <div className="space-y-4">
      {/* Chart */}
      <div className="bg-white rounded-2xl p-4 shadow-sm">
        <div className="px-1 mb-3">
          <div className="text-[15px] font-bold text-foreground">Tendance des taux</div>
          <div className="text-xs text-muted-foreground">CNY pour 1 000 000 XAF</div>
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={chartData} margin={{ top: 5, right: 10, left: -15, bottom: 5 }}>
            <defs>
              {PAYMENT_METHODS.map((pm) => (
                <linearGradient key={pm.key} id={`grad_${pm.key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={pm.chartColor} stopOpacity={0.2} />
                  <stop offset="95%" stopColor={pm.chartColor} stopOpacity={0} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10, fill: '#aaa' }}
              axisLine={{ stroke: '#eee' }}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 10, fill: '#aaa' }}
              axisLine={false}
              tickLine={false}
              domain={['dataMin - 50', 'dataMax + 50']}
              tickFormatter={(v: number) => v.toLocaleString('fr-FR')}
            />
            <Tooltip content={<CustomTooltip />} />
            {PAYMENT_METHODS.map(
              (pm) =>
                visibleLines[pm.key] && (
                  <Area
                    key={pm.key}
                    type="monotone"
                    dataKey={pm.key}
                    name={pm.label}
                    stroke={pm.chartColor}
                    strokeWidth={2.5}
                    fill={`url(#grad_${pm.key})`}
                    dot={chartData.length <= 10 ? { r: 3, fill: pm.chartColor, strokeWidth: 0 } : false}
                    activeDot={{ r: 5, strokeWidth: 2, stroke: '#fff' }}
                  />
                ),
            )}
          </AreaChart>
        </ResponsiveContainer>

        {/* Toggle buttons */}
        <div className="flex gap-1.5 pt-2.5 px-1 flex-wrap justify-center">
          {PAYMENT_METHODS.map((pm) => (
            <button
              key={pm.key}
              onClick={() => toggleLine(pm.key)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full cursor-pointer text-[11px] font-semibold"
              style={{
                border: `2px solid ${visibleLines[pm.key] ? pm.chartColor : '#ddd'}`,
                background: visibleLines[pm.key] ? `${pm.chartColor}12` : '#fafafa',
                color: visibleLines[pm.key] ? pm.chartColor : '#aaa',
              }}
            >
              <div
                className="w-2.5 h-2.5 rounded-full"
                style={{ background: visibleLines[pm.key] ? pm.chartColor : '#ccc' }}
              />
              {pm.label}
            </button>
          ))}
        </div>
      </div>

      {/* Stats: Min / Moy / Max */}
      <div className="flex gap-2">
        {[
          { label: 'Min', value: stats.min, color: '#ef4444' },
          { label: 'Moy', value: stats.avg, color: '#f59e0b' },
          { label: 'Max', value: stats.max, color: '#10b981' },
        ].map((s) => (
          <div
            key={s.label}
            className="flex-1 bg-white rounded-xl p-3 text-center shadow-sm"
          >
            <div className="text-[10px] text-muted-foreground font-semibold uppercase mb-1">
              {s.label}
            </div>
            <div className="text-base font-extrabold" style={{ color: s.color }}>
              {s.value.toLocaleString('fr-FR')}
            </div>
            <div className="text-[10px] text-muted-foreground/60">CNY (Cash)</div>
          </div>
        ))}
      </div>

      {/* Spread between modes */}
      {lastPoint && (
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <div className="text-sm font-bold text-foreground mb-1">
            Ecart entre modes
          </div>
          <div className="text-xs text-muted-foreground mb-3">
            Difference vs Cash (reference)
          </div>
          {PAYMENT_METHODS.map((pm) => {
            const diff = lastPoint[pm.key as keyof typeof lastPoint] as number - lastPoint.cash;
            const barW =
              pm.key === 'cash' ? 100 : Math.max(8, (1 - Math.abs(diff) / 200) * 100);
            return (
              <div key={pm.key} className="mb-3">
                <div className="flex justify-between items-center mb-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm">{pm.icon}</span>
                    <span className="text-[13px] font-medium text-muted-foreground">
                      {pm.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-foreground">
                      {(lastPoint[pm.key as keyof typeof lastPoint] as number).toLocaleString('fr-FR')}
                    </span>
                    {pm.key !== 'cash' ? (
                      <span className="text-[11px] font-semibold text-red-500 bg-red-50 px-2 py-0.5 rounded-xl">
                        {diff}
                      </span>
                    ) : (
                      <span className="text-[10px] font-semibold text-green-600 bg-green-100 px-2 py-0.5 rounded-xl">
                        REF
                      </span>
                    )}
                  </div>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${barW}%`, background: pm.chartColor }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
