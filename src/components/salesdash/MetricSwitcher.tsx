// ============================================================
// Tableau de bord des ventes — les onglets qui choisissent l'indicateur du
// graphique principal : Paiements · Dépôts · Nouveaux clients · Prospects ·
// Fret avion · Vols… Soulignés, sobres ; sur un téléphone ils défilent en
// largeur (fondus aux bords) et l'onglet choisi se place en vue.
// Avec `totals`, chaque onglet porte aussi sa valeur sur la plage.
// ============================================================
import { useEffect, useRef, type KeyboardEvent } from 'react';
import type { SalesTotals } from '@/hooks/useSales';
import { cn } from '@/lib/utils';
import { HEADLINE_METRICS, SALES_METRICS, formatMetric, type SalesMetricKey } from '@/lib/salesSeries';

export interface MetricSwitcherProps {
  value: SalesMetricKey;
  onChange: (metric: SalesMetricKey) => void;
  /** Les indicateurs proposés, dans l'ordre (défaut : HEADLINE_METRICS). */
  metrics?: SalesMetricKey[];
  /** Les totaux de la plage : la valeur s'écrit sous chaque onglet. */
  totals?: SalesTotals | null;
  /** Libellés propres (« Mes paiements »), par indicateur. */
  labels?: Partial<Record<SalesMetricKey, string>>;
  /** L'identifiant du graphique piloté (aria-controls). */
  controls?: string;
  className?: string;
}

export function MetricSwitcher({ value, onChange, metrics = HEADLINE_METRICS, totals, labels, controls, className }: MetricSwitcherProps) {
  const listRef = useRef<HTMLDivElement>(null);

  // L'onglet choisi reste visible quand la rangée défile (téléphone).
  // En largeur seulement : scrollIntoView ferait aussi défiler la page.
  useEffect(() => {
    const list = listRef.current;
    const el = list?.querySelector<HTMLElement>('[aria-selected="true"]');
    if (!list || !el || typeof list.scrollTo !== 'function') return;
    const left = el.offsetLeft;
    const right = left + el.offsetWidth;
    if (left < list.scrollLeft) list.scrollTo({ left: Math.max(0, left - 16), behavior: 'smooth' });
    else if (right > list.scrollLeft + list.clientWidth) list.scrollTo({ left: right - list.clientWidth + 20, behavior: 'smooth' });
  }, [value]);

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = metrics.indexOf(value);
    const next = e.key === 'ArrowRight' ? i + 1 : e.key === 'ArrowLeft' ? i - 1 : e.key === 'Home' ? 0 : e.key === 'End' ? metrics.length - 1 : null;
    if (next == null) return;
    e.preventDefault();
    const m = metrics[(next + metrics.length) % metrics.length];
    onChange(m);
    listRef.current?.querySelector<HTMLElement>(`[data-metric="${m}"]`)?.focus();
  };

  return (
    <div className={cn('sd relative min-w-0 border-b border-border/70', className)}>
      <div ref={listRef} role="tablist" aria-label="Indicateur affiché" onKeyDown={onKey} className="sd-tabs sd-fade-x relative -mb-px flex min-w-0 gap-1 overflow-x-auto px-1 sm:[mask-image:none] sm:[-webkit-mask-image:none]">
        {metrics.map((m) => {
          const on = m === value;
          const def = SALES_METRICS[m];
          return (
            <button
              key={m}
              type="button"
              role="tab"
              data-metric={m}
              aria-selected={on}
              aria-controls={controls}
              tabIndex={on ? 0 : -1}
              onClick={() => !on && onChange(m)}
              title={def.definition}
              className={cn('sd-tab relative flex shrink-0 flex-col items-start justify-center whitespace-nowrap rounded-t-lg px-2.5 text-left', totals ? 'h-[58px]' : 'h-11')}
            >
              <span className="text-[14px] font-semibold">{labels?.[m] ?? def.label}</span>
              {totals && <span className="mt-0.5 text-[13px] font-medium tabular-nums text-muted-foreground">{formatMetric(m, totals[m], 'compact')}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
