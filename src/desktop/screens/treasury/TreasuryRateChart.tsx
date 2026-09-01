/**
 * Trésorerie — graphique financier (lightweight-charts, TradingView).
 *
 * Même moteur que le module Taux, et pour la même raison : les opérations ne
 * sont PAS équidistantes dans le temps. Un axe catégoriel (l'ancien Recharts)
 * dessinait dix achats espacés d'un mois comme dix achats du même jour — il
 * mentait sur le rythme, qui est justement ce qu'on regarde.
 *
 * Générique : une série à la fois, avec son unité et sa précision. Le WAC
 * (XAF/USDT) et le prix de vente (CNY/USDT) n'ont pas la même échelle — les
 * superposer écraserait l'un des deux.
 */
import { useEffect, useRef } from 'react';
import { useTheme } from 'next-themes';
import {
  createChart,
  ColorType,
  CrosshairMode,
  LineSeries,
  type IChartApi,
  type UTCTimestamp,
} from 'lightweight-charts';

export interface ChartPoint {
  at: string;
  value: number;
}

export function TreasuryRateChart({
  points,
  color,
  decimals,
  height = 300,
}: {
  points: ChartPoint[];
  color: string;
  decimals: number;
  height?: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

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
        vertLine: { labelBackgroundColor: color },
        horzLine: { labelBackgroundColor: color },
      },
      localization: {
        locale: 'fr-FR',
        priceFormatter: (v: number) =>
          v.toLocaleString('fr-FR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }),
      },
    });
    chartRef.current = chart;

    const series = chart.addSeries(LineSeries, {
      color,
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: true,
      crosshairMarkerRadius: 4,
    });

    // Temps strictement croissants et uniques — contrat de lightweight-charts.
    // Deux opérations dans la même seconde : la dernière l'emporte.
    const byTime = new Map<number, number>();
    for (const p of points) {
      const t = Math.floor(Date.parse(p.at) / 1000);
      if (Number.isFinite(t) && Number.isFinite(p.value)) byTime.set(t, p.value);
    }
    series.setData(
      [...byTime.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([time, value]) => ({ time: time as UTCTimestamp, value })),
    );
    chart.timeScale().fitContent();

    return () => {
      chart.remove();
      chartRef.current = null;
    };
  }, [points, color, decimals, isDark]);

  return <div ref={containerRef} style={{ height }} />;
}
