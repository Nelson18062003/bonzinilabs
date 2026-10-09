// ============================================================
// Tableau de bord des ventes — ce que les graphiques recharts du kit
// partagent : l'axe des périodes (graduations éclaircies selon la largeur,
// ancrées sur la période en cours, l'année dessous quand elle change), la
// largeur de l'axe des valeurs, l'enveloppe de l'info-bulle.
// ============================================================
import type { ReactNode } from 'react';
import type { SalesGrain } from '@/hooks/useSales';
import { cn } from '@/lib/utils';
import { formatAxis, periodLabel, type SalesUnit } from '@/lib/salesSeries';

export const AXIS_FONT = 13;
/** La bande de l'axe des périodes : deux lignes (la période, l'année). */
export const AXIS_BAND = 38;

/** La largeur de l'axe des valeurs : juste ce qu'il faut pour « 40 M ». */
export function yAxisWidth(unit: SalesUnit, max: number): number {
  return Math.max(28, Math.ceil(formatAxis(unit, max).length * 7.5 + 10));
}

/**
 * Les graduations à écrire : une sur `step`, en partant de la DERNIÈRE
 * période (celle qu'on regarde), pour que les étiquettes ne se chevauchent
 * jamais (40 px par mois, 50 par semaine). L'année sous la première et à
 * chaque changement.
 */
export function periodTicks(periods: string[], grain: SalesGrain, plotWidth: number): { shown: Set<number>; years: Map<number, string> } {
  const n = periods.length;
  const minLabel = grain === 'month' ? 40 : 50;
  const step = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(plotWidth / minLabel))));
  const shown = new Set<number>();
  for (let i = 0; i < n; i++) if ((n - 1 - i) % step === 0) shown.add(i);
  const years = new Map<number, string>();
  let prev: string | null = null;
  for (let i = 0; i < n; i++) {
    if (!shown.has(i)) continue;
    const y = periods[i]?.slice(0, 4) ?? '';
    if (y !== prev) years.set(i, y);
    prev = y;
  }
  return { shown, years };
}

interface TickProps {
  x?: number | string;
  y?: number | string;
  index?: number;
  payload?: { value?: string };
}

/** Une graduation recharts « oct. » / « 2026 » (ou rien, si elle est éclaircie). */
export function periodTick(periods: string[], grain: SalesGrain, ticks: ReturnType<typeof periodTicks>) {
  return (p: TickProps) => {
    const i = p.index ?? 0;
    if (!ticks.shown.has(i)) return <g />;
    const period = periods[i] ?? p.payload?.value ?? '';
    return (
      <g transform={`translate(${p.x},${p.y})`}>
        <text dy={14} textAnchor="middle" fontSize={AXIS_FONT} fill="var(--sd-ink-2)">
          {period ? periodLabel(period, grain, 'axis') : ''}
        </text>
        {ticks.years.has(i) && (
          <text dy={30} textAnchor="middle" fontSize={12} fill="var(--sd-ink-2)" opacity={0.75}>
            {ticks.years.get(i)}
          </text>
        )}
      </g>
    );
  };
}

/** L'enveloppe d'une info-bulle : la période en tête (« en cours » à droite), puis le contenu. */
export function TooltipShell({ title, current, children, className }: { title: ReactNode; current?: boolean; children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'sd min-w-[200px] max-w-[280px] rounded-xl bg-popover px-3.5 py-3 text-popover-foreground shadow-[0_8px_28px_rgb(0_0_0/0.12)] ring-1 ring-black/[0.08] dark:ring-white/10 s-overlay',
        className,
      )}
    >
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[14px] font-semibold first-letter:uppercase">{title}</p>
        {current && <span className="shrink-0 text-[12px] font-medium text-muted-foreground">en cours</span>}
      </div>
      {children}
    </div>
  );
}

export const prefersReducedMotion = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
