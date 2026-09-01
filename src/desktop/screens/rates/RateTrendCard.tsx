/**
 * Taux — carte D « Tendance » (docs/admin-redesign/06).
 *
 * Graphique financier réel (DesktopRateChart / lightweight-charts) avec
 * périodes en chips — dont 1 AN. Sous le graphique : min/moy/max (cash) et
 * l'écart entre modes vs Cash, portés de l'ancien MultiCurveChart pour ne
 * perdre aucune information.
 */
import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { useDailyRatesForChart, type ChartPeriod } from '@/hooks/useDailyRates';
import { PAYMENT_METHODS } from '@/types/rates';
import { SURFACE, TEXT, Card, CardHeader, Chip, ScreenLoader, ScreenError } from '@/desktop/designKit';
import { MethodLogo } from '@/mobile/screens/rates/components/MethodLogo';
import { DesktopRateChart } from './DesktopRateChart';

const PERIODS: { key: ChartPeriod; label: string }[] = [
  { key: '7d', label: '7J' },
  { key: '30d', label: '30J' },
  { key: '3m', label: '3M' },
  { key: '1y', label: '1A' },
];

export function RateTrendCard() {
  const [period, setPeriod] = useState<ChartPeriod>('30d');
  const { data: chartData, isLoading, isError } = useDailyRatesForChart(period);

  const stats = useMemo(() => {
    if (!chartData || chartData.length === 0) return null;
    const vals = chartData.map((d) => d.rate_cash);
    return {
      min: Math.min(...vals),
      max: Math.max(...vals),
      avg: Math.round(vals.reduce((a, b) => a + b, 0) / vals.length),
    };
  }, [chartData]);

  const last = chartData && chartData.length > 0 ? chartData[chartData.length - 1] : null;

  return (
    <Card className="p-0">
      <CardHeader
        title="Tendance des taux"
        meta={
          <span className="inline-flex items-center gap-1.5">
            {PERIODS.map((p) => (
              <Chip key={p.key} label={p.label} active={period === p.key} onClick={() => setPeriod(p.key)} />
            ))}
          </span>
        }
      />
      <div className="p-4">
        {isLoading ? (
          <ScreenLoader />
        ) : isError ? (
          <ScreenError title="Erreur de chargement" description="Impossible de charger les données du graphique." />
        ) : chartData && chartData.length > 0 ? (
          <div className="space-y-4">
            <DesktopRateChart data={chartData} />

            {/* Min / Moy / Max — cash, la référence */}
            {stats && (
              <div className="flex gap-2">
                {(
                  [
                    { label: 'Min', value: stats.min, color: '#C0504D' },
                    { label: 'Moy', value: stats.avg, color: '#E8932A' },
                    { label: 'Max', value: stats.max, color: '#2E7D52' },
                  ] as const
                ).map((s) => (
                  <div key={s.label} className={cn('flex-1 rounded-xl p-3 text-center', SURFACE.canvas)}>
                    <div className={cn('mb-0.5 text-[10px] font-semibold uppercase', TEXT.muted)}>{s.label}</div>
                    <div className="text-[16px] font-extrabold tabular-nums" style={{ color: s.color }}>
                      {s.value.toLocaleString('fr-FR')}
                    </div>
                    <div className={cn('text-[10px]', TEXT.muted)}>CNY (Cash)</div>
                  </div>
                ))}
              </div>
            )}

            {/* Écart entre modes — dernière publication de la période */}
            {last && (
              <div className={cn('rounded-2xl p-4', SURFACE.canvas)}>
                <div className={cn('mb-2.5 text-[12px] font-bold', TEXT.strong)}>
                  Écart entre modes <span className={cn('font-medium', TEXT.muted)}>· vs Cash (référence)</span>
                </div>
                <div className="space-y-2">
                  {PAYMENT_METHODS.map((pm) => {
                    const value = last[`rate_${pm.key}` as keyof typeof last] as number;
                    const diff = value - last.rate_cash;
                    return (
                      <div key={pm.key} className="flex items-center gap-2.5">
                        <MethodLogo method={pm.key} size={22} />
                        <span className={cn('w-[76px] text-[12px] font-medium', TEXT.muted)}>{pm.label}</span>
                        <div className={cn('h-1.5 flex-1 overflow-hidden rounded-full', SURFACE.card)}>
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: pm.key === 'cash' ? '100%' : `${Math.max(8, (1 - Math.abs(diff) / 200) * 100)}%`,
                              background: pm.chartColor,
                            }}
                          />
                        </div>
                        <span className={cn('w-[64px] text-right text-[12.5px] font-bold tabular-nums', TEXT.strong)}>
                          {value.toLocaleString('fr-FR')}
                        </span>
                        {pm.key === 'cash' ? (
                          <span className="w-[52px] rounded-xl bg-emerald-50 px-1.5 py-0.5 text-center text-[10px] font-semibold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400">
                            REF
                          </span>
                        ) : (
                          <span className="w-[52px] rounded-xl bg-destructive/10 px-1.5 py-0.5 text-center text-[10.5px] font-semibold tabular-nums text-destructive dark:bg-destructive/10 dark:text-destructive">
                            {diff > 0 ? '+' : ''}
                            {diff}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className={cn('py-14 text-center text-[13px]', TEXT.muted)}>Aucune donnée pour cette période</div>
        )}
      </div>
    </Card>
  );
}
