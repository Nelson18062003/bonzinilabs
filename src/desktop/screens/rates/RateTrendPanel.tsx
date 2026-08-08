/**
 * Graphique d'évolution — les quatre courbes de taux sur une période.
 *
 * Rebuilt off `@/mobile/screens/rates/tabs/RateChartTab` +
 * `MultiCurveChart` (both still owned by the phone). The chart chrome follows
 * `DesktopTreasuryDashboard`: axes and grid paint with `currentColor` so they
 * track the console's foreground ramp and the theme, the tooltip is Recharts'
 * own with the console's surface, and every tick is 12px.
 *
 * The curve colours stay `pm.chartColor` from `@/types/rates` — the shared
 * source of truth — so « Alipay » is the same blue on the phone and on the
 * console. They are Recharts props, not classes: nothing here paints UI chrome
 * with a palette colour.
 *
 * Logic preserved: `useDailyRatesForChart(period)` (via `supabaseAdmin`), the
 * three periods, the per-curve toggles with the "never hide the last curve"
 * guard, the Min/Moy/Max statistics computed on the cash series, and the
 * spread of each method against cash on the most recent point.
 *
 * Dropped: the decorative width bars behind the spread rows. They encoded
 * `(1 - |diff| / 200) * 100` — a magic constant with no unit — over a number
 * that is printed right next to them.
 */
import { useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { AlertTriangle, LineChart } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PAYMENT_METHODS } from '@/types/rates';
import { useDailyRatesForChart, type ChartPeriod } from '@/hooks/useDailyRates';
import { MethodLogo } from '@/mobile/screens/rates/components/MethodLogo';
import { DS, DT, DFG } from '@/desktop/ui/tokens';
import { Badge, Chip, EmptyState, Figure, Panel, PanelHead, Segment, Spinner } from '@/desktop/ui/primitives';

const PERIODS: { value: ChartPeriod; label: string }[] = [
  { value: '7d', label: '7J' },
  { value: '30d', label: '30J' },
  { value: '3m', label: '3M' },
];

/* Même habillage que les graphiques trésorerie — une seule table de valeurs. */
const AXIS_TICK = { fontSize: 12, fontWeight: 600, fill: 'currentColor' };
const AXIS_LINE = { stroke: 'currentColor', strokeOpacity: 0.25 };

const TOOLTIP_STYLE = {
  background: 'var(--tip-bg, #FFFFFF)',
  border: '1px solid var(--tip-line, rgba(28,24,54,0.10))',
  borderRadius: 12,
  fontSize: 12,
  fontWeight: 600,
  color: 'var(--tip-fg, #15131F)',
};
const TOOLTIP_LABEL_STYLE = { fontSize: 12, fontWeight: 700, color: 'var(--tip-fg, #15131F)' };

const CHART_VARS =
  '[--tip-bg:#FFFFFF] [--tip-line:#1C183618] [--tip-fg:#15131F] ' +
  'dark:[--tip-bg:#15141C] dark:[--tip-line:#FFFFFF1F] dark:[--tip-fg:#F3F2F8]';

export function RateTrendPanel() {
  const [period, setPeriod] = useState<ChartPeriod>('30d');
  const [visibleLines, setVisibleLines] = useState<Record<string, boolean>>({
    cash: true,
    alipay: true,
    wechat: true,
    virement: true,
  });
  const { data, isLoading, isError } = useDailyRatesForChart(period);

  const chartData = useMemo(
    () =>
      (data ?? []).map((d) => ({
        date: format(parseISO(d.effective_at), 'dd/MM', { locale: fr }),
        cash: d.rate_cash,
        alipay: d.rate_alipay,
        wechat: d.rate_wechat,
        virement: d.rate_virement,
      })),
    [data],
  );

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

  const lastPoint = chartData[chartData.length - 1];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <span className={cn(DT.micro, DFG.faint)}>Période</span>
        <Segment value={period} onChange={setPeriod} options={PERIODS} />
      </div>

      {isLoading ? (
        <Spinner />
      ) : isError ? (
        <EmptyState
          icon={AlertTriangle}
          title="Erreur de chargement"
          hint="Impossible de charger les données du graphique. Vérifiez que la migration SQL a été exécutée."
        />
      ) : chartData.length === 0 ? (
        <EmptyState icon={LineChart} title="Aucune donnée pour cette période" />
      ) : (
        <>
          <Panel className={cn('overflow-hidden', CHART_VARS)}>
            <PanelHead title="Tendance des taux" hint="CNY pour 1 000 000 XAF" />
            <div className={cn('p-4', DFG.faint)}>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                  <defs>
                    {PAYMENT_METHODS.map((pm) => (
                      <linearGradient key={pm.key} id={`rate_grad_${pm.key}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={pm.chartColor} stopOpacity={0.28} />
                        <stop offset="100%" stopColor={pm.chartColor} stopOpacity={0.02} />
                      </linearGradient>
                    ))}
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.14} />
                  <XAxis dataKey="date" tick={AXIS_TICK} tickLine={false} {...AXIS_LINE} />
                  <YAxis
                    tick={AXIS_TICK}
                    tickLine={false}
                    width={64}
                    domain={['dataMin - 50', 'dataMax + 50']}
                    tickFormatter={(v: number) => v.toLocaleString('fr-FR')}
                    {...AXIS_LINE}
                  />
                  <Tooltip
                    formatter={(value, name) => [`${Number(value).toLocaleString('fr-FR')} CNY`, name]}
                    labelStyle={TOOLTIP_LABEL_STYLE}
                    contentStyle={TOOLTIP_STYLE}
                  />
                  {PAYMENT_METHODS.map((pm) =>
                    visibleLines[pm.key] ? (
                      <Area
                        key={pm.key}
                        type="monotone"
                        dataKey={pm.key}
                        name={pm.label}
                        stroke={pm.chartColor}
                        strokeWidth={2}
                        fill={`url(#rate_grad_${pm.key})`}
                        dot={chartData.length <= 10 ? { r: 3, fill: pm.chartColor, strokeWidth: 0 } : false}
                        activeDot={{ r: 5 }}
                      />
                    ) : null,
                  )}
                </AreaChart>
              </ResponsiveContainer>

              <div className="mt-4 flex flex-wrap gap-2">
                {PAYMENT_METHODS.map((pm) => (
                  <Chip
                    key={pm.key}
                    active={visibleLines[pm.key]}
                    onClick={() => toggleLine(pm.key)}
                    aria-label={`Courbe ${pm.label}`}
                  >
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ background: pm.chartColor }}
                      aria-hidden
                    />
                    {pm.label}
                  </Chip>
                ))}
              </div>
            </div>
          </Panel>

          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Min', value: stats.min },
              { label: 'Moy', value: stats.avg },
              { label: 'Max', value: stats.max },
            ].map((s) => (
              <div key={s.label} className={cn('rounded-lg p-3', DS.well)}>
                <p className={cn(DT.micro, DFG.faint)}>{s.label}</p>
                <p className="mt-2">
                  <Figure value={s.value.toLocaleString('fr-FR')} />
                </p>
              </div>
            ))}
          </div>

          {lastPoint ? (
            <Panel className="overflow-hidden">
              <PanelHead title="Écart entre modes" hint="Différence vs Cash (référence)" />
              {PAYMENT_METHODS.map((pm, i) => {
                const value = lastPoint[pm.key as keyof typeof lastPoint] as number;
                const diff = value - lastPoint.cash;
                return (
                  <div
                    key={pm.key}
                    className={cn(
                      'flex items-center gap-3 px-4 py-2',
                      i < PAYMENT_METHODS.length - 1 && 'border-b',
                      DS.line,
                    )}
                  >
                    <MethodLogo method={pm.key} size={24} />
                    <span className={cn('min-w-0 flex-1 truncate', DT.body, DFG.base)}>{pm.label}</span>
                    <Figure value={value.toLocaleString('fr-FR')} />
                    {pm.key === 'cash' ? (
                      <Badge tone="success">REF</Badge>
                    ) : (
                      <span className="w-16 shrink-0 text-right">
                        <Figure
                          size="sm"
                          value={`${diff >= 0 ? '+' : ''}${diff.toLocaleString('fr-FR', { maximumFractionDigits: 2 })}`}
                          tone={diff >= 0 ? 'positive' : 'negative'}
                        />
                      </span>
                    )}
                  </div>
                );
              })}
            </Panel>
          ) : null}
        </>
      )}
    </div>
  );
}
