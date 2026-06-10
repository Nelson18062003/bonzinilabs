// ============================================================
// MODULE TAUX — MultiCurveChart (Recharts)
// Présentation migrée sur le design kit (Ofspace/Mola) : conteneurs
// en cartes douces, stats Min/Moy/Max tonées, toggles en pilules,
// barres d'écart par mode. **Recharts conservé** (AreaChart/Area/
// axes/tooltip) — seuls les conteneurs/couleurs passent aux tokens.
// Logique 100% préservée : chartData/stats/visibleLines/toggleLine,
// `pm.chartColor` des courbes, écart vs Cash.
// ============================================================
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
import { cn } from '@/lib/utils';
import { PAYMENT_METHODS } from '@/types/rates';
import type { DailyRate } from '@/types/rates';
import { SURFACE, TEXT } from '@/mobile/designKit';
import { MethodLogo } from './MethodLogo';

interface MultiCurveChartProps {
  data: DailyRate[];
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) {
  if (!active || !payload) return null;
  return (
    <div className="rounded-xl p-3 shadow-lg" style={{ background: 'rgba(26,26,46,0.95)' }}>
      <div className="mb-1.5 text-[11px] text-white/50">{label}</div>
      {payload.map((p, i) => (
        <div key={i} className="mb-0.5 flex items-center gap-1.5">
          <div className="h-2 w-2 rounded-full" style={{ background: p.color }} />
          <span className="text-xs text-white/70">{p.name}</span>
          <span className="ml-auto pl-3 text-xs font-bold text-white">
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
      {/* Graphique */}
      <div className={cn('rounded-2xl p-4', SURFACE.card, SURFACE.shadow)}>
        <div className="mb-3 px-1">
          <div className={cn('text-[15px] font-bold', TEXT.strong)}>Tendance des taux</div>
          <div className={cn('text-[12px]', TEXT.muted)}>CNY pour 1 000 000 XAF</div>
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
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(120,120,140,0.15)" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10, fill: '#9B98AD' }}
              axisLine={{ stroke: 'rgba(120,120,140,0.2)' }}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 10, fill: '#9B98AD' }}
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

        {/* Toggles de courbes — pilules */}
        <div className="flex flex-wrap justify-center gap-1.5 px-1 pt-2.5">
          {PAYMENT_METHODS.map((pm) => {
            const on = visibleLines[pm.key];
            return (
              <button
                key={pm.key}
                onClick={() => toggleLine(pm.key)}
                className={cn(
                  'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold transition',
                  on ? SURFACE.card : SURFACE.canvas,
                  on ? '' : 'opacity-60',
                )}
                style={on ? { boxShadow: `0 0 0 2px ${pm.chartColor}`, color: pm.chartColor } : undefined}
              >
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: on ? pm.chartColor : '#9B98AD' }} />
                {pm.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Stats : Min / Moy / Max */}
      <div className="flex gap-2">
        {[
          { label: 'Min', value: stats.min, color: '#C0504D' },
          { label: 'Moy', value: stats.avg, color: '#E8932A' },
          { label: 'Max', value: stats.max, color: '#2E7D52' },
        ].map((s) => (
          <div
            key={s.label}
            className={cn('flex-1 rounded-xl p-3 text-center', SURFACE.card, SURFACE.shadow)}
          >
            <div className={cn('mb-1 text-[10px] font-semibold uppercase', TEXT.muted)}>
              {s.label}
            </div>
            <div className="text-[16px] font-extrabold tabular-nums" style={{ color: s.color }}>
              {s.value.toLocaleString('fr-FR')}
            </div>
            <div className={cn('text-[10px]', TEXT.muted)}>CNY (Cash)</div>
          </div>
        ))}
      </div>

      {/* Écart entre modes */}
      {lastPoint && (
        <div className={cn('rounded-2xl p-4', SURFACE.card, SURFACE.shadow)}>
          <div className={cn('mb-1 text-[14px] font-bold', TEXT.strong)}>
            Écart entre modes
          </div>
          <div className={cn('mb-3 text-[12px]', TEXT.muted)}>
            Différence vs Cash (référence)
          </div>
          {PAYMENT_METHODS.map((pm) => {
            const diff = (lastPoint[pm.key as keyof typeof lastPoint] as number) - lastPoint.cash;
            const barW =
              pm.key === 'cash' ? 100 : Math.max(8, (1 - Math.abs(diff) / 200) * 100);
            return (
              <div key={pm.key} className="mb-3">
                <div className="mb-1 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MethodLogo method={pm.key} size={24} />
                    <span className={cn('text-[13px] font-medium', TEXT.muted)}>
                      {pm.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={cn('text-[14px] font-bold tabular-nums', TEXT.strong)}>
                      {(lastPoint[pm.key as keyof typeof lastPoint] as number).toLocaleString('fr-FR')}
                    </span>
                    {pm.key !== 'cash' ? (
                      <span className="rounded-xl bg-[#FBE7E7] px-2 py-0.5 text-[11px] font-semibold tabular-nums text-[#C0504D] dark:bg-[#3A2526] dark:text-[#E79A9A]">
                        {diff}
                      </span>
                    ) : (
                      <span className="rounded-xl bg-[#DEEFE5] px-2 py-0.5 text-[10px] font-semibold text-[#2E7D52] dark:bg-[#1E3A2C] dark:text-[#7FCBA0]">
                        REF
                      </span>
                    )}
                  </div>
                </div>
                <div className={cn('h-1.5 overflow-hidden rounded-full', SURFACE.canvas)}>
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
