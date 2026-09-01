/**
 * Taux — VRAI graphique financier (lightweight-charts, la bibliothèque de
 * TradingView) : crosshair, échelle de temps réelle (les publications ne
 * sont pas équidistantes — un axe catégoriel mentait sur le rythme),
 * étiquette de dernière valeur par courbe, axe des prix formaté fr-FR.
 * Remplace l'AreaChart Recharts jugé « pas un graphique financier ».
 */
import { useEffect, useRef, useState } from 'react';
import { useTheme } from 'next-themes';
import {
  createChart,
  ColorType,
  CrosshairMode,
  LineSeries,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from 'lightweight-charts';
import { cn } from '@/lib/utils';
import { PAYMENT_METHODS } from '@/types/rates';
import type { DailyRate, PaymentMethodKey } from '@/types/rates';
import { SURFACE } from '@/desktop/designKit';

interface Props {
  /** Publications par date d'effet CROISSANTE (contrat du hook chart). */
  data: DailyRate[];
  height?: number;
}

function seriesData(data: DailyRate[], key: PaymentMethodKey) {
  // Temps strictement croissants et uniques (contrat lightweight-charts) —
  // deux publications dans la même seconde : la dernière gagne.
  const byTime = new Map<number, number>();
  for (const d of data) {
    const t = Math.floor(Date.parse(d.effective_at) / 1000);
    byTime.set(t, d[`rate_${key}` as keyof DailyRate] as number);
  }
  return [...byTime.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([time, value]) => ({ time: time as UTCTimestamp, value }));
}

export function DesktopRateChart({ data, height = 320 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<Partial<Record<PaymentMethodKey, ISeriesApi<'Line'>>>>({});
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const [visible, setVisible] = useState<Record<PaymentMethodKey, boolean>>({
    cash: true, alipay: true, wechat: true, virement: true,
  });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const chart = createChart(el, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: isDark ? '#9B98AD' : '#6E6A80',
        fontFamily: '"DM Sans", system-ui, sans-serif',
        fontSize: 11,
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(26,23,38,0.05)' },
        horzLines: { color: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(26,23,38,0.07)' },
      },
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false, timeVisible: true, secondsVisible: false },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { labelBackgroundColor: '#8B5CF6' },
        horzLine: { labelBackgroundColor: '#8B5CF6' },
      },
      localization: {
        locale: 'fr-FR',
        priceFormatter: (v: number) => Math.round(v).toLocaleString('fr-FR'),
      },
    });
    chartRef.current = chart;

    PAYMENT_METHODS.forEach((pm) => {
      const s = chart.addSeries(LineSeries, {
        color: pm.chartColor,
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: true,
        crosshairMarkerRadius: 4,
      });
      s.setData(seriesData(data, pm.key));
      seriesRef.current[pm.key] = s;
    });
    chart.timeScale().fitContent();

    return () => {
      chart.remove();
      chartRef.current = null;
      seriesRef.current = {};
    };
  }, [data, isDark]);

  // Visibilité des courbes — sans recréer le graphique.
  useEffect(() => {
    PAYMENT_METHODS.forEach((pm) => {
      seriesRef.current[pm.key]?.applyOptions({ visible: visible[pm.key] });
    });
  }, [visible, data, isDark]);

  const toggle = (key: PaymentMethodKey) => {
    setVisible((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      // Toujours au moins une courbe visible.
      return Object.values(next).some(Boolean) ? next : prev;
    });
  };

  return (
    <div>
      <div ref={containerRef} style={{ height }} />
      <div className="flex flex-wrap justify-center gap-1.5 pt-2.5">
        {PAYMENT_METHODS.map((pm) => {
          const on = visible[pm.key];
          return (
            <button
              key={pm.key}
              type="button"
              onClick={() => toggle(pm.key)}
              aria-pressed={on}
              className={cn(
                'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[11px] font-semibold transition',
                on ? SURFACE.card : SURFACE.canvas,
                !on && 'opacity-60',
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
  );
}
