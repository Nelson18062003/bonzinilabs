// ============================================================
// Tableau de bord des ventes — les pièces de base du kit : le panneau
// (carte), le segmenté, la pastille de tendance, la mini-courbe, la pastille
// de couleur d'une série, les états (chargement, vide, erreur).
//
// Purement présentationnelles. Posées dans l'administration (« Mes
// équipes ») elles prennent son thème ; dans « /v » (`.sales-ui`) celui de
// l'espace commercial — couleurs : ./salesdash.css.
// ============================================================
import { useEffect, useLayoutEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { AlertCircle, ArrowDownRight, ArrowUpRight, BarChart3, Minus, RotateCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDelta, type SalesDelta, type SalesUnit } from '@/lib/salesSeries';
import './salesdash.css';

/** La carte du kit : blanche, rayon 18, filet léger (dans « /v » : filet et ombre en couches). */
export const PANEL = 'sd rounded-[18px] bg-card text-card-foreground ring-1 ring-black/[0.06] dark:ring-white/10 s-card';

/* ── Le panneau ────────────────────────────────────────────────────────── */

export interface ChartPanelProps {
  title?: ReactNode;
  subtitle?: ReactNode;
  /** À droite du titre (segmenté, bouton) ; passe dessous sur un téléphone. */
  actions?: ReactNode;
  /** Les données se rechargent : on garde l'image précédente, estompée (pas de squelette, pas de saut). */
  fetching?: boolean;
  children: ReactNode;
  className?: string;
  /** Marges intérieures : `md` (défaut) ou `none` (un tableau bord à bord). */
  padding?: 'md' | 'none';
  /** Un pied discret (définitions, source des chiffres). */
  footer?: ReactNode;
  id?: string;
}

export function ChartPanel({ title, subtitle, actions, fetching, children, className, padding = 'md', footer, id }: ChartPanelProps) {
  return (
    <section id={id} className={cn(PANEL, 'min-w-0', className)} aria-busy={fetching || undefined}>
      {(title || actions) && (
        <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3 px-4 pt-4 sm:px-5 sm:pt-5">
          {title && (
            <div className="min-w-0 flex-1">
              <h2 className="text-[16px] font-semibold leading-snug tracking-[-0.01em] text-foreground">{title}</h2>
              {subtitle && <p className="mt-0.5 text-[14px] leading-snug text-muted-foreground">{subtitle}</p>}
            </div>
          )}
          {actions && <div className="flex min-w-0 max-w-full shrink-0 flex-wrap items-center gap-2 max-sm:w-full">{actions}</div>}
        </header>
      )}
      <div className={cn('transition-opacity duration-200', padding === 'md' ? 'px-4 pb-4 pt-4 sm:px-5 sm:pb-5' : 'pt-3', fetching && 'pointer-events-none opacity-55')}>{children}</div>
      {footer && <footer className="border-t border-border/60 px-4 py-3 text-[13px] leading-relaxed text-muted-foreground sm:px-5">{footer}</footer>}
    </section>
  );
}

/* ── Le segmenté ───────────────────────────────────────────────────────── */

export interface SegmentedOption<T extends string> {
  value: T;
  label: ReactNode;
  /** Le nom lu par un lecteur d'écran quand `label` est abrégé. */
  ariaLabel?: string;
}

/** Des options de même largeur ; la pastille glisse sous celle qui est choisie. */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  className,
}: {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (v: T) => void;
  ariaLabel: string;
  className?: string;
}) {
  const i = Math.max(0, options.findIndex((o) => o.value === value));
  const n = options.length;
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn('sd sd-seg relative grid min-w-0', className)}
      style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}
    >
      <span
        aria-hidden
        className="sd-seg-thumb absolute bottom-[3px] left-[3px] top-[3px] [.sales-ui_&]:bottom-1 [.sales-ui_&]:left-1 [.sales-ui_&]:top-1"
        style={{ width: `calc((100% - 6px) / ${n})`, transform: `translateX(${i * 100}%)` }}
      />
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={o.ariaLabel}
            onClick={() => !on && onChange(o.value)}
            className="sd-seg-opt relative z-10 flex h-9 min-w-0 items-center justify-center whitespace-nowrap rounded-lg px-2.5 text-[14px] font-semibold [.sales-ui_&]:h-10 [.sales-ui_&]:rounded-[11px] [.sales-ui_&]:text-[15px]"
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/* ── La tendance ───────────────────────────────────────────────────────── */

/**
 * « ↗ +12 % » en vert (bon), « ↘ −8 % » en rouge (mauvais), « — stable »
 * en gris ; rien pour 0 → 0. La couleur dit bon/mauvais selon l'indicateur
 * (une hausse des prospects perdus est rouge) ; la flèche dit le sens.
 */
export function DeltaBadge({
  delta,
  unit,
  compareLabel,
  size = 'sm',
  className,
}: {
  delta: SalesDelta | null | undefined;
  unit: SalesUnit;
  /** « par rapport aux 3 mois précédents » : lu par les lecteurs d'écran et au survol. */
  compareLabel?: string;
  size?: 'sm' | 'md';
  className?: string;
}) {
  if (!delta || delta.kind === 'none') return null;
  const text = formatDelta(delta, unit);
  const Icon = delta.direction === 'flat' ? Minus : delta.direction === 'up' ? ArrowUpRight : ArrowDownRight;
  const tone = delta.tone;
  const title = compareLabel ? `${text} ${compareLabel}` : text;
  return (
    <span
      title={title}
      aria-label={title}
      data-tone={tone}
      className={cn(
        'inline-flex shrink-0 items-center gap-0.5 whitespace-nowrap rounded-full font-semibold tabular-nums',
        size === 'sm' ? 'h-6 px-1.5 text-[13px]' : 'h-7 px-2 text-[14px]',
        tone === 'neutral' && 'bg-muted text-muted-foreground',
        className,
      )}
      style={
        tone === 'good'
          ? { color: 'var(--sd-good)', backgroundColor: 'var(--sd-good-bg)' }
          : tone === 'bad'
            ? { color: 'var(--sd-bad)', backgroundColor: 'var(--sd-bad-bg)' }
            : undefined
      }
    >
      <Icon className={size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4'} strokeWidth={2.4} aria-hidden />
      {text}
    </span>
  );
}

/* ── La mini-courbe ────────────────────────────────────────────────────── */

/**
 * Une courbe de quelques points, en gris qui s'efface ; le dernier point
 * en couleur — creux s'il s'agit de la période en cours (pas finie).
 * Pas d'axe : elle dit la forme, la valeur est à côté.
 */
export function Sparkline({
  values,
  current = false,
  color = 'var(--sd-accent)',
  width = 72,
  height = 28,
  className,
  label,
}: {
  values: number[];
  /** Le dernier point est la période en cours. */
  current?: boolean;
  color?: string;
  width?: number;
  height?: number;
  className?: string;
  /** Texte de remplacement ; sinon décoratif. */
  label?: string;
}) {
  if (values.length < 2) return null;
  const pad = 3;
  const max = Math.max(...values.map((v) => (Number.isFinite(v) ? v : 0)), 0);
  const min = Math.min(...values.map((v) => (Number.isFinite(v) ? v : 0)), 0);
  const span = max - min || 1;
  const x = (i: number) => pad + (i * (width - pad * 2)) / (values.length - 1);
  const y = (v: number) => pad + (height - pad * 2) * (1 - ((Number.isFinite(v) ? v : 0) - min) / span);
  const d = values.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const last = values.length - 1;
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={cn('sd shrink-0 overflow-visible', className)}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <path d={d} fill="none" stroke="var(--sd-spark)" strokeWidth={1.75} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(last)} cy={y(values[last])} r={3.25} fill={current ? 'var(--sd-surface)' : color} stroke={current ? color : 'var(--sd-surface)'} strokeWidth={current ? 1.75 : 1.5} />
    </svg>
  );
}

/* ── La pastille d'une série ───────────────────────────────────────────── */

/** Un carré arrondi (barres) ou un trait (courbes), de la couleur de la série. */
export function SeriesSwatch({ color, shape = 'rect', muted, className }: { color: string; shape?: 'rect' | 'line' | 'dot'; muted?: boolean; className?: string }) {
  const style = { backgroundColor: muted ? 'transparent' : color, boxShadow: muted ? `inset 0 0 0 1.5px ${color}` : undefined };
  if (shape === 'line') return <span aria-hidden className={cn('inline-block h-[3px] w-3.5 shrink-0 rounded-full', className)} style={style} />;
  if (shape === 'dot') return <span aria-hidden className={cn('inline-block h-2.5 w-2.5 shrink-0 rounded-full', className)} style={style} />;
  return <span aria-hidden className={cn('inline-block h-2.5 w-2.5 shrink-0 rounded-[3px]', className)} style={style} />;
}

/* ── Les états ─────────────────────────────────────────────────────────── */

/** Un aplat qui respire (le reflet de « /v » là-bas). */
export function Skeleton({ className, style }: { className?: string; style?: CSSProperties }) {
  return <div aria-hidden className={cn('sd sd-skel animate-pulse rounded-lg s-skeleton', className)} style={style} />;
}

/** Le squelette d'un graphique : des barres grises de hauteurs variées, à la taille du vrai. */
export function ChartSkeleton({ height = 260, bars = 12, className }: { height?: number; bars?: number; className?: string }) {
  const hs = [42, 58, 35, 66, 51, 74, 47, 62, 80, 55, 70, 38];
  return (
    <div role="status" aria-label="Chargement du graphique" className={cn('flex flex-col', className)} style={{ height }}>
      <div className="flex flex-1 items-end gap-[6%] border-b border-border/60 px-2 pb-0">
        {Array.from({ length: bars }, (_, i) => (
          <Skeleton key={i} className="flex-1 rounded-b-none rounded-t-[4px]" style={{ height: `${hs[i % hs.length]}%`, animationDelay: `${(i % 6) * 80}ms` }} />
        ))}
      </div>
      <div className="flex h-8 items-center justify-between px-2">
        <Skeleton className="h-3 w-10" />
        <Skeleton className="h-3 w-10" />
        <Skeleton className="h-3 w-10" />
      </div>
    </div>
  );
}

/** « Pas encore d'activité sur cette période » — au centre, sans dramatiser. */
export function EmptyState({
  title = 'Pas encore d’activité sur cette période',
  children,
  height,
  className,
}: {
  title?: ReactNode;
  children?: ReactNode;
  height?: number;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-2 px-4 py-8 text-center', className)} style={height ? { minHeight: height } : undefined}>
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <BarChart3 className="h-5 w-5" strokeWidth={1.75} aria-hidden />
      </span>
      <p className="text-[15px] font-semibold text-foreground">{title}</p>
      {children && <div className="max-w-[34ch] text-[14px] leading-snug text-muted-foreground">{children}</div>}
    </div>
  );
}

/** « Les chiffres n'ont pas pu être chargés. » et Réessayer. */
export function ErrorState({
  message = 'Les chiffres n’ont pas pu être chargés.',
  detail,
  onRetry,
  height,
  className,
}: {
  message?: ReactNode;
  /** Le message du serveur, en petit. */
  detail?: string | null;
  onRetry?: () => void;
  height?: number;
  className?: string;
}) {
  return (
    <div role="alert" className={cn('flex flex-col items-center justify-center gap-2 px-4 py-8 text-center', className)} style={height ? { minHeight: height } : undefined}>
      <span className="flex h-10 w-10 items-center justify-center rounded-full" style={{ color: 'var(--sd-bad)', backgroundColor: 'var(--sd-bad-bg)' }}>
        <AlertCircle className="h-5 w-5" aria-hidden />
      </span>
      <p className="text-[15px] font-semibold text-foreground">{message}</p>
      {detail && <p className="max-w-[40ch] break-words text-[13px] text-muted-foreground">{detail}</p>}
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="sd-press mt-1 inline-flex h-10 items-center gap-2 rounded-xl px-4 text-[14px] font-semibold text-foreground ring-1 ring-border s-btn s-btn-quiet"
        >
          <RotateCw className="h-4 w-4" aria-hidden /> Réessayer
        </button>
      )}
    </div>
  );
}

/* ── La largeur d'un élément ───────────────────────────────────────────── */

const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

/**
 * La largeur d'un élément, suivie au redimensionnement (0 tant qu'elle est
 * inconnue ; ensuite, jamais 0). Une référence-fonction : l'élément peut apparaître plus tard
 * (après un chargement, en quittant la vue tableau) et être mesuré quand même.
 */
export function useElementWidth<T extends HTMLElement>(): [(el: T | null) => void, number] {
  const [el, setEl] = useState<T | null>(null);
  const [width, setWidth] = useState(0);
  useIsoLayoutEffect(() => {
    if (!el) return;
    const w0 = el.getBoundingClientRect().width;
    if (w0 > 0) setWidth(w0);
    if (typeof ResizeObserver === 'undefined') return;
    // Une largeur nulle (parent masqué, capture d'écran qui redimensionne) est ignorée : on garde la
    // dernière connue, sinon le graphique se démonterait puis repousserait depuis zéro.
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w != null && w > 0) setWidth(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [el]);
  return [setEl, width];
}
