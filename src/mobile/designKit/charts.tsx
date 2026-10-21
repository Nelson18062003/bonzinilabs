/**
 * Design kit mobile — les graphiques de la v2 (Analyses, Trésorerie, Taux).
 *
 * Règles des maquettes validées : un graphe par écran, sous un gros chiffre ;
 * la série principale à l'encre #2C2C2C, la comparaison en gris #B3B3B3,
 * une grille #EEEEEE à peine visible, étiquettes 14 px #5A5A5A ; ni dégradé,
 * ni ombre, ni couleur de marque. Toucher une barre ou un point montre sa
 * valeur dans une bulle ; les autres barres s'effacent.
 *
 * SVG à la main, sans bibliothèque : ces formes sont simples et le rendu
 * doit être identique dans l'app native (WebView) et le navigateur.
 */
import * as React from 'react';
import { cn } from '@/lib/utils';
import { TEXT } from './tokens';

const INK = '#2C2C2C';
const GREY = '#B3B3B3';
const GRID = '#EEEEEE';

export interface BarDatum {
  label: string;
  value: number;
  /** Valeur affichée dans la bulle (déjà formatée). */
  display?: string;
  /** La barre en cours (aujourd'hui, la semaine en cours) : en contour. */
  current?: boolean;
}

/** Barres verticales. Toucher une barre la sélectionne (`onSelect`). */
export function BarChart({
  data, height = 220, xLabels, selected, onSelect, signed, className, ariaLabel,
}: {
  data: BarDatum[];
  height?: number;
  /** Les étiquettes à poser sous l'axe : index → texte (les autres restent muettes). */
  xLabels?: Record<number, string>;
  selected?: number | null;
  onSelect?: (index: number | null) => void;
  /** Valeurs positives ET négatives (flux net) : une ligne de zéro au milieu. */
  signed?: boolean;
  className?: string;
  ariaLabel?: string;
}) {
  const W = 340;
  const H = height;
  const n = Math.max(data.length, 1);
  const max = Math.max(...data.map((d) => Math.abs(d.value)), 1);
  const gap = n > 20 ? 3 : n > 10 ? 6 : 10;
  const bw = (W - gap * (n - 1)) / n;
  const zero = signed ? H / 2 : H;
  const scale = (signed ? H / 2 - 6 : H - 6) / max;
  const sel = selected ?? null;
  return (
    <div className={cn('relative', className)}>
      <svg viewBox={`0 0 ${W} ${H}`} className="block w-full" style={{ height }} role="img" aria-label={ariaLabel}>
        {signed && <line x1={0} x2={W} y1={zero} y2={zero} stroke={GREY} strokeWidth={1} />}
        {data.map((d, i) => {
          const h = Math.max(Math.abs(d.value) * scale, d.value === 0 ? 0 : 3);
          const x = i * (bw + gap);
          const y = d.value >= 0 ? zero - h : zero;
          const dim = sel != null && sel !== i;
          return (
            <g key={i} onClick={() => onSelect?.(sel === i ? null : i)} style={{ cursor: onSelect ? 'pointer' : undefined }}>
              <rect x={x} y={0} width={bw} height={H} fill="transparent" />
              <rect
                x={x + (d.current ? 1 : 0)}
                y={y + (d.current ? 1 : 0)}
                width={Math.max(bw - (d.current ? 2 : 0), 1)}
                height={Math.max(h - (d.current ? 2 : 0), 1)}
                rx={Math.min(4, bw / 2)}
                fill={d.current ? '#FFFFFF' : d.value < 0 ? GREY : INK}
                stroke={d.current ? INK : 'none'}
                strokeWidth={d.current ? 2 : 0}
                opacity={dim ? 0.25 : 1}
              />
            </g>
          );
        })}
      </svg>
      {sel != null && data[sel] && (
        <div
          className="pointer-events-none absolute -top-2 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-lg bg-[#2C2C2C] px-3 py-2 text-[14px] font-semibold text-[#F5F5F5]"
          style={{ left: `${((sel * (bw + gap) + bw / 2) / W) * 100}%` }}
        >
          <div className="font-medium opacity-80">{data[sel].label}</div>
          <div className="text-[16px] tabular-nums">{data[sel].display ?? data[sel].value.toLocaleString('fr-FR')}</div>
        </div>
      )}
      {xLabels && <AxisLabels count={n} labels={xLabels} />}
    </div>
  );
}

function AxisLabels({ count, labels }: { count: number; labels: Record<number, string> }) {
  return (
    <div className="relative mt-2 h-5">
      {Object.entries(labels).map(([k, v]) => {
        const i = Number(k);
        const pct = count <= 1 ? 50 : (i / (count - 1)) * 100;
        const align = pct < 8 ? 'translate-x-0' : pct > 92 ? '-translate-x-full' : '-translate-x-1/2';
        return (
          <span key={k} className={cn('absolute top-0 whitespace-nowrap text-[14px]', align, TEXT.muted)} style={{ left: `${pct}%` }}>
            {v}
          </span>
        );
      })}
    </div>
  );
}

export interface LineSeries {
  values: number[];
  /** `ink` (la série principale) ou `grey` (la comparaison). */
  tone?: 'ink' | 'grey';
  /** Marches (un taux qui change à heure fixe). */
  step?: boolean;
  label?: string;
}

/** Courbes. La première série est la principale ; un point final marque la dernière valeur. */
export function LineChart({
  series, height = 200, xLabels, yTicks, formatY, selected, onSelect, minLabel, className, ariaLabel,
}: {
  series: LineSeries[];
  height?: number;
  xLabels?: Record<number, string>;
  /** Valeurs des repères horizontaux (grille + étiquette à droite). */
  yTicks?: number[];
  formatY?: (v: number) => string;
  selected?: number | null;
  onSelect?: (index: number | null) => void;
  /** Marque le point le plus bas de la série principale avec cette étiquette. */
  minLabel?: string;
  className?: string;
  ariaLabel?: string;
}) {
  const W = 300;
  const H = height;
  const all = series.flatMap((s) => s.values).concat(yTicks ?? []);
  const lo = Math.min(...all);
  const hi = Math.max(...all);
  const span = hi - lo || 1;
  const n = Math.max(...series.map((s) => s.values.length), 2);
  const px = (i: number) => (i / (n - 1)) * W;
  const py = (v: number) => H - 8 - ((v - lo) / span) * (H - 16);
  const path = (s: LineSeries) =>
    s.values
      .map((v, i) => {
        if (i === 0) return `M${px(0)},${py(v)}`;
        return s.step ? `H${px(i)}V${py(v)}` : `L${px(i)},${py(v)}`;
      })
      .join('');
  const main = series[0]?.values ?? [];
  const minIdx = main.length ? main.indexOf(Math.min(...main)) : -1;
  const sel = selected ?? null;
  const fmt = formatY ?? ((v: number) => v.toLocaleString('fr-FR'));
  return (
    <div className={cn('relative', className)}>
      <div className="flex gap-2">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          className="block min-w-0 flex-1 overflow-visible"
          style={{ height }}
          role="img"
          aria-label={ariaLabel}
          onClick={(e) => {
            if (!onSelect) return;
            const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
            const i = Math.round(((e.clientX - r.left) / r.width) * (n - 1));
            onSelect(sel === i ? null : Math.max(0, Math.min(n - 1, i)));
          }}
        >
          {(yTicks ?? []).map((t) => (
            <line key={t} x1={0} x2={W} y1={py(t)} y2={py(t)} stroke={GRID} strokeWidth={1.5} strokeDasharray="3 4" vectorEffect="non-scaling-stroke" />
          ))}
          {[...series].reverse().map((s, k) => (
            <path key={k} d={path(s)} fill="none" stroke={s.tone === 'grey' ? GREY : INK} strokeWidth={s.tone === 'grey' ? 2.5 : 3} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          ))}
          {sel != null && <line x1={px(sel)} x2={px(sel)} y1={0} y2={H} stroke={GREY} strokeWidth={1} vectorEffect="non-scaling-stroke" />}
        </svg>
        {yTicks && yTicks.length > 0 && (
          <div className="relative w-14 shrink-0" style={{ height }}>
            {yTicks.map((t) => (
              <span key={t} className={cn('absolute right-0 -translate-y-1/2 whitespace-nowrap text-[14px] tabular-nums', TEXT.muted)} style={{ top: py(t) }}>
                {fmt(t)}
              </span>
            ))}
          </div>
        )}
      </div>
      {/* Points posés en HTML : ronds même quand le SVG s'étire. */}
      <div className="pointer-events-none absolute inset-y-0 left-0" style={{ right: yTicks?.length ? 64 : 0, height }}>
        {series.map((s, k) => {
          const last = s.values.length - 1;
          if (last < 0) return null;
          return (
            <span key={k} className="absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ left: `${(last / (n - 1)) * 100}%`, top: py(s.values[last]), background: s.tone === 'grey' ? GREY : INK }} />
          );
        })}
        {minLabel && minIdx >= 0 && (
          <>
            <span className="absolute h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[#2C2C2C] bg-white" style={{ left: `${(minIdx / (n - 1)) * 100}%`, top: py(main[minIdx]) }} />
            <span className={cn('absolute -translate-x-1/2 whitespace-nowrap text-[15px] font-semibold tabular-nums', TEXT.strong)} style={{ left: `${(minIdx / (n - 1)) * 100}%`, top: py(main[minIdx]) + 12 }}>
              {minLabel}
            </span>
          </>
        )}
        {sel != null && (
          <div
            className="absolute -top-2 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-lg bg-[#2C2C2C] px-3 py-2 text-[14px] font-semibold text-[#F5F5F5]"
            style={{ left: `${(sel / (n - 1)) * 100}%` }}
          >
            {series.map((s, k) => (
              <div key={k} className="tabular-nums">
                {s.label ? `${s.label} ` : ''}{s.values[sel] != null ? fmt(s.values[sel]) : '—'}
              </div>
            ))}
          </div>
        )}
      </div>
      {xLabels && <div style={{ marginRight: yTicks?.length ? 64 : 0 }}><AxisLabels count={n} labels={xLabels} /></div>}
    </div>
  );
}

/** La légende d'un graphe à deux séries : trait encre, trait gris. */
export function ChartLegend({ items, className }: { items: { label: React.ReactNode; tone?: 'ink' | 'grey' }[]; className?: string }) {
  return (
    <div className={cn('mt-3 flex flex-wrap gap-x-6 gap-y-1 text-[16px]', TEXT.body, className)}>
      {items.map((it, i) => (
        <span key={i} className="inline-flex items-center gap-2">
          <span className="h-[3px] w-6 rounded-full" style={{ background: it.tone === 'grey' ? GREY : INK }} />
          {it.label}
        </span>
      ))}
    </div>
  );
}

/** Une ligne de part : rond / nom / montant / %, barre dessous (« Par méthode »). */
export function ShareRow({
  leading, title, subtitle, value, share, className, onClick,
}: {
  leading?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  value: React.ReactNode;
  /** 0 → 1 */
  share: number;
  className?: string;
  onClick?: () => void;
}) {
  const Wrapper = onClick ? 'button' : 'div';
  const pct = Math.max(0, Math.min(1, share));
  return (
    <Wrapper type={onClick ? 'button' : undefined} onClick={onClick} className={cn('flex w-full gap-3.5 border-b border-[#D9D9D9] py-4 text-left last:border-b-0 dark:border-[#444444]', className)}>
      {leading}
      <span className="min-w-0 flex-1">
        <span className="flex items-start justify-between gap-3">
          <span className="min-w-0">
            <span className={cn('block truncate text-[17px] font-semibold', TEXT.strong)}>{title}</span>
            {subtitle != null && <span className={cn('block text-[15px]', TEXT.muted)}>{subtitle}</span>}
          </span>
          <span className="shrink-0 text-right">
            <span className={cn('block text-[17px] font-bold tabular-nums', TEXT.strong)}>{value}</span>
            <span className={cn('block text-[15px] tabular-nums', TEXT.muted)}>{(pct * 100).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} %</span>
          </span>
        </span>
        <span className="mt-2.5 block h-2 overflow-hidden rounded-full bg-[#EEEEEE] dark:bg-[#383838]">
          <span className="block h-full rounded-full bg-[#2C2C2C] dark:bg-[#E3E3E3]" style={{ width: `${pct * 100}%` }} />
        </span>
      </span>
    </Wrapper>
  );
}

/** Le cadre d'un graphe : carte à filet, titre à gauche, mention à droite. */
export function ChartCard({ title, aside, children, className }: { title?: React.ReactNode; aside?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('rounded-lg border border-[#D9D9D9] p-4 pt-5 dark:border-[#444444]', className)}>
      {(title != null || aside != null) && (
        <div className="mb-5 flex items-baseline justify-between gap-3">
          {title != null && <h3 className={cn('text-[18px] font-semibold', TEXT.strong)}>{title}</h3>}
          {aside != null && <span className={cn('text-[16px] tabular-nums', TEXT.muted)}>{aside}</span>}
        </div>
      )}
      {children}
    </div>
  );
}
