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
  from,
  to,
}: {
  points: ChartPoint[];
  color: string;
  decimals: number;
  height?: number;
  /**
   * Fenêtre visible. Sans elle, `fitContent` cadre sur l'étendue des POINTS :
   * une année choisie avec des opérations concentrées sur deux semaines
   * s'affichait comme deux semaines, et le vide — qui est une information —
   * disparaissait.
   */
  from?: Date;
  to?: Date;
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

    // lightweight-charts ne connaît pas les fuseaux : il affiche les
    // UTCTimestamp en UTC. L'axe et le curseur montraient donc 13:00 pour une
    // opération de 14:00 à Douala, et la journée basculait à 23:00. On décale
    // tous les temps de +1 h (Douala est à UTC+1 toute l'année) pour que le
    // rendu UTC soit l'heure murale — l'astuce documentée par la bibliothèque.
    const TZ_SHIFT = 3600;
    const asChartTime = (ms: number) => Math.floor(ms / 1000) + TZ_SHIFT;

    // Temps strictement croissants et uniques — contrat de lightweight-charts.
    // Le sélecteur de date remet les secondes à zéro : deux opérations saisies
    // dans la même minute tombent sur le même temps, et la seconde EFFAÇAIT la
    // première. On décale les doublons d'une seconde chacun — le point reste
    // visible, sa position est indiscernable à l'échelle d'une journée.
    const sorted = points
      .map((p) => ({ t: Date.parse(p.at), v: p.value }))
      .filter((p) => Number.isFinite(p.t) && Number.isFinite(p.v))
      .sort((a, b) => a.t - b.t);
    const data: { time: UTCTimestamp; value: number }[] = [];
    let last = -Infinity;
    for (const p of sorted) {
      let t = asChartTime(p.t);
      if (t <= last) t = last + 1;
      last = t;
      data.push({ time: t as UTCTimestamp, value: p.v });
    }
    series.setData(data);
    if (from && to && to > from) {
      chart.timeScale().setVisibleRange({
        from: asChartTime(from.getTime()) as UTCTimestamp,
        to: asChartTime(to.getTime()) as UTCTimestamp,
      });
    } else {
      chart.timeScale().fitContent();
    }

    return () => {
      chart.remove();
      chartRef.current = null;
    };
  }, [points, color, decimals, isDark, from, to]);

  return <div ref={containerRef} style={{ height }} />;
}
