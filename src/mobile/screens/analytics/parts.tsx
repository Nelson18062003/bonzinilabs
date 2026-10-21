/**
 * Analyses mobile v2 — les briques propres au module (maquettes
 * docs/mobile-refonte/maquettes-v2/09-analyses). Mêmes jetons que le kit :
 * encre #2C2C2C, gris #B3B3B3, grille #EEEEEE, filet #D9D9D9, rayon 8,
 * étiquettes ≥ 14 px. À remonter dans le kit si un autre module en a besoin :
 * `RefBars` (repère chiffré + tag posé sur une barre), `BarRow`, `Tile` et
 * ses mini-graphes, `StackBar`, `Switch`, `PillRow`, `PeriodBar`.
 */
import * as React from 'react';
import { AlertTriangle, ArrowLeftRight, CalendarDays, ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BarChart, Chip, FOCUS_RING, SURFACE, TEXT, Tag, type BarDatum, type Tone } from '@/mobile/designKit';

const INK = '#2C2C2C';
const GRID = '#EEEEEE';

/* ── PeriodBar ────────────────────────────────────────────────────────────
 * « 30 derniers jours ⌄ » (ouvre la feuille Période) + « Comparer » (noir
 * quand la comparaison est active). */
export function PeriodBar({
  label, onPeriod, compare, onCompare, className,
}: {
  label: React.ReactNode;
  onPeriod: () => void;
  /** Absent : pas de bouton Comparer (instantanés, classements). */
  compare?: boolean;
  onCompare?: () => void;
  className?: string;
}) {
  return (
    <div className={cn('flex gap-2.5 px-5 pt-4', className)}>
      <button
        type="button"
        onClick={onPeriod}
        className={cn('inline-flex h-11 min-w-0 items-center gap-1.5 rounded-lg border bg-white px-3 text-[16px] font-semibold dark:bg-[#2C2C2C]', SURFACE.divider, FOCUS_RING, TEXT.strong)}
      >
        <CalendarDays className="h-[18px] w-[18px] shrink-0" strokeWidth={2} />
        <span className="min-w-0 truncate">{label}</span>
        <ChevronDown className="h-[18px] w-[18px] shrink-0" strokeWidth={2.25} />
      </button>
      {onCompare && (
        <button
          type="button"
          onClick={onCompare}
          aria-pressed={compare}
          className={cn(
            'inline-flex h-11 shrink-0 items-center gap-1.5 rounded-lg px-3 text-[16px] font-semibold',
            FOCUS_RING,
            compare ? 'bg-[#2C2C2C] text-[#F5F5F5] dark:bg-[#E3E3E3] dark:text-[#1E1E1E]' : cn('border bg-white dark:bg-[#2C2C2C]', SURFACE.divider, TEXT.strong),
          )}
        >
          <ArrowLeftRight className="h-[18px] w-[18px]" strokeWidth={2} />
          Comparer
        </button>
      )}
    </div>
  );
}

/* ── KVRows ───────────────────────────────────────────────────────────────
 * La boîte étiquette / valeur du kit (KVBox), dont les lignes cliquables
 * gardent la valeur calée à droite, contre le chevron. */
export function KVRows({ rows, className }: { rows: { label: React.ReactNode; value: React.ReactNode; onClick?: () => void; tone?: 'danger' }[]; className?: string }) {
  return (
    <div className={cn('rounded-lg border', SURFACE.divider, className)}>
      {rows.map((r, i) => {
        const Wrapper = r.onClick ? 'button' : 'div';
        return (
          <Wrapper
            key={i}
            type={r.onClick ? 'button' : undefined}
            onClick={r.onClick}
            className={cn('flex w-full items-center gap-3 border-b px-4 py-3.5 text-left text-[16px] last:border-b-0', SURFACE.divider, r.onClick && cn('active:bg-[#F5F5F5] dark:active:bg-[#383838]', FOCUS_RING))}
          >
            <span className={cn('min-w-0 flex-1', TEXT.muted)}>{r.label}</span>
            <span className={cn('shrink-0 text-right font-semibold tabular-nums', r.tone === 'danger' ? 'text-[#C00F0C] dark:text-[#FCB3AD]' : TEXT.strong)}>{r.value}</span>
            {r.onClick && <ChevronRight className={cn('-mr-1 h-5 w-5 shrink-0', TEXT.muted)} />}
          </Wrapper>
        );
      })}
    </div>
  );
}

/** Les pastilles de choix d'une série (Paiements / Dépôts / Clients). */
export function PillRow<T extends string>({
  options, value, onChange, className,
}: {
  options: ReadonlyArray<{ value: T; label: React.ReactNode }>;
  value: T;
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-wrap gap-2.5 px-5 pt-4', className)} role="radiogroup">
      {options.map((o) => (
        <Chip key={o.value} label={o.label} active={o.value === value} onClick={() => onChange(o.value)} />
      ))}
    </div>
  );
}

/* ── RefBars ──────────────────────────────────────────────────────────────
 * Le `BarChart` du kit, plus le seul repère chiffré de la maquette (filet
 * #EEEEEE en haut à gauche, jamais sous une barre) et, au besoin, un tag de
 * variation posé sur une barre. La géométrie reprend celle du kit. */
export function RefBars({
  data, height = 220, xLabels, selected, onSelect, signed, refValue, refText, tagAt, className, ariaLabel, bubbleRoom,
}: {
  data: BarDatum[];
  height?: number;
  xLabels?: Record<number, string>;
  selected?: number | null;
  onSelect?: (i: number | null) => void;
  signed?: boolean;
  /** Valeur du repère (une valeur ronde sous le maximum). */
  refValue?: number | null;
  refText?: string;
  /** Un tag posé au-dessus d'une barre (« +9 % »). */
  tagAt?: { index: number; tone: Tone; label: React.ReactNode } | null;
  className?: string;
  ariaLabel?: string;
  /** Garde de la place au-dessus pour la bulle. */
  bubbleRoom?: boolean;
}) {
  const W = 340;
  const n = Math.max(data.length, 1);
  const values = data.map((d) => (Number.isFinite(d.value) ? d.value : 0));
  const max = Math.max(...values.map((v) => Math.abs(v)), 1);
  const gap = n > 60 ? 1 : n > 20 ? 3 : n > 10 ? 6 : 10;
  const bw = Math.max((W - gap * (n - 1)) / n, 1);
  const H = height;
  const zero = signed ? H / 2 : H;
  const scale = (signed ? H / 2 - 6 : H - 6) / max;
  const refY = refValue != null && refValue > 0 && refValue <= max ? zero - refValue * scale : null;
  const tagLeft = tagAt ? ((tagAt.index * (bw + gap) + bw / 2) / W) * 100 : 0;
  const tagTop = tagAt ? zero - Math.max(Math.abs(values[tagAt.index] ?? 0) * scale, 3) : 0;
  return (
    <div className={cn('relative px-5', bubbleRoom ? 'pt-[92px]' : refY != null || tagAt ? 'pt-9' : 'pt-4', className)}>
      <div className="relative">
        {refY != null && (
          <div className="pointer-events-none absolute inset-x-0" style={{ top: refY }}>
            <div className="h-px w-full" style={{ background: GRID }} />
            {refText && <span className={cn('absolute bottom-1 left-0 whitespace-nowrap text-[14px] tabular-nums', TEXT.muted)}>{refText}</span>}
          </div>
        )}
        {tagAt && (
          <div className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full pb-1.5" style={{ left: `${tagLeft}%`, top: tagTop }}>
            <Tag tone={tagAt.tone}>{tagAt.label}</Tag>
          </div>
        )}
        <BarChart data={data} height={H} xLabels={xLabels} selected={selected} onSelect={onSelect} signed={signed} ariaLabel={ariaLabel} />
        {!signed && <div className="pointer-events-none absolute inset-x-0 h-px" style={{ top: H - 0.5, background: '#D9D9D9' }} />}
      </div>
    </div>
  );
}

/** La légende « □ Semaine en cours ». */
export function CurrentLegend({ children }: { children: React.ReactNode }) {
  return (
    <div className={cn('flex items-center gap-2 px-5 pt-3 text-[16px]', TEXT.body)}>
      <span className="inline-block h-3.5 w-3.5 rounded-[3px] border-[1.5px] border-[#2C2C2C] bg-white dark:border-[#E3E3E3] dark:bg-transparent" />
      {children}
    </div>
  );
}

/* ── BarRow ───────────────────────────────────────────────────────────────
 * Une ligne à barre horizontale : rang, rond, nom, sous-titre, chiffre et
 * mention à droite, barre encre proportionnelle dessous. */
export function BarRow({
  rank, leading, title, subtitle, value, valueSub, share, tag, onClick, strong, className,
}: {
  rank?: number;
  leading?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  value: React.ReactNode;
  valueSub?: React.ReactNode;
  /** 0 → 1 : la longueur de la barre. */
  share: number;
  tag?: { tone: Tone; label: React.ReactNode };
  onClick?: () => void;
  /** Titre en gras (la tranche médiane). */
  strong?: boolean;
  className?: string;
}) {
  const Wrapper = onClick ? 'button' : 'div';
  const w = Math.max(0, Math.min(1, Number.isFinite(share) ? share : 0));
  const indent = leading != null;
  return (
    <Wrapper
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={cn('block w-full border-b py-3.5 text-left last:border-b-0', SURFACE.divider, onClick && cn('active:bg-[#F5F5F5] dark:active:bg-[#383838]', FOCUS_RING), className)}
    >
      <span className="flex items-center gap-3">
        {rank != null && <span className={cn('w-6 shrink-0 text-center text-[15px] font-semibold tabular-nums', TEXT.muted)}>{rank}</span>}
        {leading}
        <span className="min-w-0 flex-1">
          <span className={cn('block truncate text-[17px] leading-[1.25]', strong || subtitle != null || leading != null ? 'font-semibold' : 'font-medium', TEXT.strong)}>{title}</span>
          {subtitle != null && <span className={cn('mt-0.5 block truncate text-[15px]', TEXT.muted)}>{subtitle}</span>}
        </span>
        {tag && <Tag tone={tag.tone}>{tag.label}</Tag>}
        <span className="shrink-0 text-right">
          <span className={cn('block text-[17px] font-bold tabular-nums', TEXT.strong)}>{value}</span>
          {valueSub != null && <span className={cn('block text-[15px] tabular-nums', TEXT.muted)}>{valueSub}</span>}
        </span>
        {onClick && <ChevronRight className={cn('-mr-1 h-5 w-5 shrink-0', TEXT.muted)} />}
      </span>
      <span className={cn('mt-2.5 block h-2 overflow-hidden rounded-full bg-[#EEEEEE] dark:bg-[#383838]', indent && (rank != null ? 'ml-[100px]' : 'ml-[56px]'), !indent && rank != null && 'ml-9')}>
        <span className="block h-full rounded-full bg-[#2C2C2C] dark:bg-[#E3E3E3]" style={{ width: `${w * 100}%` }} />
      </span>
    </Wrapper>
  );
}

/* ── StackBar ─────────────────────────────────────────────────────────────
 * Une barre découpée (concentration, équipe / app, parts) : encre puis gris. */
const STACK = ['#2C2C2C', '#5A5A5A', '#9E9E9E', '#C4C4C4', '#D9D9D9', '#E6E6E6', '#EEEEEE'];

export function StackBar({ shares, height = 10, className, tones }: { shares: number[]; height?: number; className?: string; tones?: string[] }) {
  const total = shares.reduce((s, v) => s + Math.max(v, 0), 0);
  return (
    <div className={cn('flex w-full gap-[3px] overflow-hidden rounded-full', className)} style={{ height }}>
      {total <= 0 ? (
        <span className="block h-full w-full rounded-full bg-[#EEEEEE] dark:bg-[#383838]" />
      ) : (
        shares.map((v, i) => (v > 0 ? (
          <span key={i} className="block h-full rounded-full first:rounded-l-full" style={{ flexGrow: v / total, flexBasis: 0, background: (tones ?? STACK)[Math.min(i, (tones ?? STACK).length - 1)] }} />
        ) : null))
      )}
    </div>
  );
}

/* ── Tile ─────────────────────────────────────────────────────────────────
 * Une tuile « tous les graphiques » : nom, chiffre, mini-graphe. */
export function Tile({ name, value, children, onClick }: { name: React.ReactNode; value: React.ReactNode; children?: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn('flex h-[104px] min-w-0 flex-col justify-between rounded-lg border px-3.5 pb-3 pt-2.5 text-left active:bg-[#F5F5F5] dark:active:bg-[#383838]', SURFACE.divider, FOCUS_RING)}
    >
      <span className="block min-w-0">
        <span className={cn('block truncate text-[15px] font-medium', TEXT.muted)}>{name}</span>
        <span className={cn('block truncate text-[18px] font-bold tabular-nums tracking-[-0.01em]', TEXT.strong)}>{value}</span>
      </span>
      <span className="block h-8 w-full">{children}</span>
    </button>
  );
}

/** Mini-barres d'une tuile ; `currentLast` : la dernière en contour. */
export function MiniBars({ values, currentLast, signed }: { values: number[]; currentLast?: boolean; signed?: boolean }) {
  const W = 120;
  const H = 32;
  const n = Math.max(values.length, 1);
  const max = Math.max(...values.map((v) => Math.abs(v)), 1);
  const gap = n > 20 ? 1 : n > 10 ? 2 : 5;
  const bw = Math.max((W - gap * (n - 1)) / n, 1);
  const zero = signed ? H / 2 : H;
  const scale = (signed ? H / 2 : H) / max;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="block h-full w-full" aria-hidden>
      {signed && <line x1={0} x2={W} y1={zero} y2={zero} stroke="#B3B3B3" strokeWidth={0.75} />}
      {values.map((raw, i) => {
        const v = signed ? raw : Math.max(raw, 0);
        const h = Math.max(Math.abs(v) * scale, v === 0 ? 0.75 : 1.5);
        const cur = currentLast && i === n - 1;
        return (
          <rect
            key={i}
            x={i * (bw + gap) + (cur ? 0.5 : 0)}
            y={(v >= 0 ? zero - h : zero) + (cur ? 0.5 : 0)}
            width={Math.max(bw - (cur ? 1 : 0), 0.5)}
            height={Math.max(h - (cur ? 1 : 0), 0.5)}
            rx={Math.min(1.5, bw / 3)}
            fill={cur ? '#FFFFFF' : INK}
            stroke={cur ? INK : 'none'}
            strokeWidth={cur ? 1 : 0}
            vectorEffect="non-scaling-stroke"
          />
        );
      })}
    </svg>
  );
}

/** Mini-courbe d'une tuile. */
export function MiniLine({ values }: { values: number[] }) {
  const W = 120;
  const H = 32;
  const v = values.filter(Number.isFinite);
  if (v.length < 2) return <MiniBars values={values} />;
  const lo = Math.min(...v);
  const hi = Math.max(...v);
  const span = hi === lo ? 1 : hi - lo;
  const d = v.map((x, i) => `${i === 0 ? 'M' : 'L'}${(i / (v.length - 1)) * W},${H - 3 - ((x - lo) / span) * (H - 6)}`).join('');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="block h-full w-full" aria-hidden>
      <path d={d} fill="none" stroke={INK} strokeWidth={2.25} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/** Le titre de rangée des tuiles (« ARGENT »). */
export function GroupLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('px-5 pb-2.5 pt-7 text-[15px] font-semibold uppercase tracking-[0.05em]', TEXT.muted, className)}>{children}</div>;
}

/* ── Switch ───────────────────────────────────────────────────────────────
 * L'interrupteur 51 × 31 des feuilles (Comparer). */
export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn('relative h-[31px] w-[51px] shrink-0 rounded-full transition-colors', FOCUS_RING, checked ? 'bg-[#2C2C2C] dark:bg-[#E3E3E3]' : 'bg-[#D9D9D9] dark:bg-[#444444]')}
    >
      <span className={cn('absolute top-[2px] h-[27px] w-[27px] rounded-full bg-white transition-all dark:bg-[#1E1E1E]', checked ? 'left-[22px]' : 'left-[2px]')} />
    </button>
  );
}

/** L'alerte cliquable de l'écran Activité (« 3 dépôts en revue depuis 48 h »). */
export function AlertRow({ children, onClick, tone = 'pending' }: { children: React.ReactNode; onClick?: () => void; tone?: Tone }) {
  const Wrapper = onClick ? 'button' : 'div';
  return (
    <Wrapper
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={cn('mx-5 mt-3 flex w-[calc(100%-40px)] items-center gap-3 rounded-lg border px-4 py-3.5 text-left text-[16px] font-semibold active:bg-[#F5F5F5] dark:active:bg-[#383838]', SURFACE.divider, FOCUS_RING, TEXT.strong)}
    >
      <AlertTriangle className={cn('h-6 w-6 shrink-0', tone === 'danger' ? 'text-[#900B09] dark:text-[#FCB3AD]' : 'text-[#682D03] dark:text-[#FFF1C2]')} strokeWidth={2} />
      <span className="min-w-0 flex-1">{children}</span>
      {onClick && <ChevronRight className={cn('h-5 w-5 shrink-0', TEXT.muted)} />}
    </Wrapper>
  );
}

/** Un lien plein-largeur à rond (« Par commercial · Équipe › Ventes »). */
export function LinkRow({ icon: Icon, title, subtitle, onClick, className }: { icon: React.ElementType; title: React.ReactNode; subtitle?: React.ReactNode; onClick: () => void; className?: string }) {
  return (
    <button type="button" onClick={onClick} className={cn('flex w-full items-center gap-3.5 border-t px-5 py-4 text-left active:bg-[#F5F5F5] dark:active:bg-[#383838]', SURFACE.divider, FOCUS_RING, className)}>
      <span className={cn('flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#F5F5F5] dark:bg-[#383838]', TEXT.strong)}>
        <Icon className="h-[22px] w-[22px]" strokeWidth={2} />
      </span>
      <span className="min-w-0 flex-1">
        <span className={cn('block truncate text-[17px] font-semibold', TEXT.strong)}>{title}</span>
        {subtitle != null && <span className={cn('block truncate text-[15px]', TEXT.muted)}>{subtitle}</span>}
      </span>
      <ChevronRight className={cn('h-5 w-5 shrink-0', TEXT.muted)} />
    </button>
  );
}

/** Le chiffre de tête, avec un petit chargement. */
export function Loading({ className }: { className?: string }) {
  return <div className={cn('mx-5 mt-4 h-40 animate-pulse rounded-lg bg-[#F5F5F5] dark:bg-[#2C2C2C]', className)} />;
}

