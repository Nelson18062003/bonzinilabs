/**
 * Briques de la refonte v2 propres au module « Messages · Douane · Mola ·
 * Outils · Réglages » (maquettes 06, 01/02-09, 10/54-72). Mêmes jetons que le
 * kit (`@/mobile/designKit`) ; à remonter dans wave.tsx si un autre module en
 * a besoin : Switch, CapsLabel, SettingRow, ChoiceTiles, FieldBlock,
 * StackedBars, CheckLine, RedNotice, ChatComposerShell.
 */
import * as React from 'react';
import { AlertTriangle, Check, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FOCUS_RING, SURFACE, TEXT, Tag, type Tone } from '@/mobile/designKit';

/** L'interrupteur des réglages : 52 × 32, encre quand il est mis. */
export function Switch({
  checked, onChange, label, disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-11 w-[60px] shrink-0 items-center rounded-full disabled:opacity-40',
        FOCUS_RING,
      )}
    >
      <span
        className={cn(
          'absolute inset-x-0 top-1/2 h-8 -translate-y-1/2 rounded-full border-2 transition-colors',
          checked ? 'border-[#2C2C2C] bg-[#2C2C2C] dark:border-[#E3E3E3] dark:bg-[#E3E3E3]' : 'border-[#D9D9D9] bg-[#D9D9D9] dark:border-[#444444] dark:bg-[#444444]',
        )}
      />
      <span
        className={cn(
          'absolute top-1/2 h-7 w-7 -translate-y-1/2 rounded-full bg-white transition-[left] dark:bg-[#1E1E1E]',
          checked ? 'left-[30px]' : 'left-[2px]',
        )}
      />
    </button>
  );
}

/** L'étiquette en capitales d'un bloc de réglages ou d'un champ (« LANGUE »). */
export function CapsLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('text-[15px] font-semibold uppercase tracking-[0.06em]', TEXT.muted, className)}>
      {children}
    </div>
  );
}

/** Un champ de formulaire v2 : l'étiquette en capitales, le champ dessous, l'erreur en rouge. */
export function FieldBlock({
  label, htmlFor, error, children, className,
}: {
  label: React.ReactNode;
  htmlFor?: string;
  error?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('space-y-2', className)}>
      <label htmlFor={htmlFor} className="block"><CapsLabel>{label}</CapsLabel></label>
      {children}
      {error ? <p className="text-[15px] font-medium text-[#900B09] dark:text-[#FCB3AD]">{error}</p> : null}
    </div>
  );
}

/** La classe des grands champs de la v2 (56 px, 17 px). */
export const BIG_FIELD = 'h-14 px-4 !text-[17px]';

/**
 * Une ligne de réglage : icône, libellé, valeur ou tag, chevron. Une ligne
 * entière est la cible (56 px).
 */
export function SettingRow({
  icon: Icon, label, value, tag, right, onClick, chevron, className, strong,
}: {
  icon?: React.ElementType;
  label: React.ReactNode;
  value?: React.ReactNode;
  tag?: { tone: Tone; label: React.ReactNode };
  right?: React.ReactNode;
  onClick?: () => void;
  chevron?: boolean;
  className?: string;
  /** Libellé en gras (lignes de navigation des Réglages). */
  strong?: boolean;
}) {
  const Wrapper = onClick ? 'button' : 'div';
  return (
    <Wrapper
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={cn(
        'flex min-h-[64px] w-full items-center gap-4 border-b py-3 text-left last:border-b-0',
        SURFACE.divider,
        onClick && cn('active:bg-[#F5F5F5] dark:active:bg-[#383838]', FOCUS_RING),
        className,
      )}
    >
      {Icon && <Icon className={cn('h-6 w-6 shrink-0', TEXT.strong)} strokeWidth={1.9} />}
      <span className={cn('min-w-0 flex-1 truncate text-[17px]', strong ? 'font-semibold' : 'font-normal', TEXT.strong)}>{label}</span>
      {value != null && <span className={cn('shrink-0 text-[16px]', TEXT.muted)}>{value}</span>}
      {tag && <Tag tone={tag.tone}>{tag.label}</Tag>}
      {right}
      {(chevron ?? !!onClick) && <ChevronRight className={cn('h-5 w-5 shrink-0', TEXT.muted)} />}
    </Wrapper>
  );
}

/** Le choix en grandes tuiles (langue, gravité) : la tuile choisie a un bord épais. */
export function ChoiceTiles<T extends string>({
  options, value, onChange, ariaLabel, className, tall,
}: {
  options: ReadonlyArray<{ value: T; label: React.ReactNode; sub?: React.ReactNode }>;
  value: T;
  onChange: (v: T) => void;
  ariaLabel?: string;
  className?: string;
  /** Deux lignes (« FR » / « Français ») : tuiles hautes. */
  tall?: boolean;
}) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className={cn('grid gap-3', className)} style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className={cn(
              'flex flex-col items-center justify-center rounded-lg px-2 text-center',
              tall ? 'min-h-[104px] gap-1 py-3' : 'min-h-[56px] py-2',
              on ? 'border-2 border-[#2C2C2C] dark:border-[#E3E3E3]' : cn('border', SURFACE.divider),
              'active:bg-[#F5F5F5] dark:active:bg-[#383838]',
              FOCUS_RING,
            )}
          >
            <span className={cn(tall ? 'text-[28px] font-bold leading-none' : 'text-[17px] font-semibold', TEXT.strong)}>{o.label}</span>
            {o.sub != null && <span className={cn('text-[16px] font-semibold', TEXT.strong)}>{o.sub}</span>}
          </button>
        );
      })}
    </div>
  );
}

/** Une coche verte et sa phrase (« 10 caractères ou plus »). Grise tant que ce n'est pas vrai. */
export function CheckLine({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className={cn('flex h-6 w-6 shrink-0 items-center justify-center rounded-full', ok ? 'bg-[#CFF7D3] text-[#02542D]' : 'bg-[#F5F5F5] text-[#B3B3B3] dark:bg-[#383838]')}>
        <Check className="h-4 w-4" strokeWidth={3} />
      </span>
      <span className={cn('text-[16px] font-semibold', ok ? TEXT.strong : TEXT.muted)}>{children}</span>
    </div>
  );
}

/** La ligne rouge d'un engagement (« Engage votre agrément CAD »). */
export function RedNotice({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('flex items-center gap-3 rounded-lg bg-[#FDD3D0] px-4 py-3.5 !text-[17px] font-semibold text-[#900B09] dark:bg-[#900B09] dark:text-[#FDD3D0]', className)}>
      <AlertTriangle className="h-5 w-5 shrink-0" strokeWidth={2.25} />
      <span className="min-w-0">{children}</span>
    </div>
  );
}

/** Le rond noir des non-lus (« 2 »). */
export function UnreadBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="flex h-7 min-w-[28px] items-center justify-center rounded-full bg-[#2C2C2C] px-1.5 text-[14px] font-bold tabular-nums text-[#F5F5F5] dark:bg-[#E3E3E3] dark:text-[#1E1E1E]">
      {count > 99 ? '99+' : count}
    </span>
  );
}

export interface StackedDatum { label: string; a: number; b: number }

/**
 * Barres empilées (volume des messages : client à l'encre, Bonzini en gris).
 * Même grammaire que BarChart du kit : SVG, ni ombre ni dégradé.
 */
export function StackedBars({ data, height = 200, className, ariaLabel }: { data: StackedDatum[]; height?: number; className?: string; ariaLabel?: string }) {
  const W = 340;
  const H = height;
  const n = Math.max(data.length, 1);
  const max = Math.max(...data.map((d) => d.a + d.b), 1);
  const gap = n > 20 ? 3 : n > 10 ? 6 : 10;
  const bw = Math.max((W - gap * (n - 1)) / n, 1);
  const scale = (H - 4) / max;
  const step = n > 14 ? Math.ceil(n / 7) : 1;
  return (
    <div className={className}>
      <svg viewBox={`0 0 ${W} ${H}`} className="block w-full" style={{ height }} role="img" aria-label={ariaLabel}>
        {data.map((d, i) => {
          const ha = d.a * scale;
          const hb = d.b * scale;
          const x = i * (bw + gap);
          const r = Math.min(4, bw / 2);
          return (
            <g key={i}>
              {hb > 0 && <rect x={x} y={H - ha - hb - (ha > 0 ? 2 : 0)} width={bw} height={hb} rx={r} fill="#B3B3B3" />}
              {ha > 0 && <rect x={x} y={H - ha} width={bw} height={ha} rx={r} fill="#2C2C2C" />}
            </g>
          );
        })}
        <line x1={0} x2={W} y1={H - 0.5} y2={H - 0.5} stroke="#D9D9D9" strokeWidth={1} />
      </svg>
      <div className="mt-2 grid" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))`, columnGap: `${(gap / W) * 100}%` }}>
        {data.map((d, i) => (
          <span key={i} className={cn('truncate text-center text-[14px]', TEXT.muted)}>{i % step === 0 ? d.label : ''}</span>
        ))}
      </div>
    </div>
  );
}

/** La légende de StackedBars : carré encre, carré gris. */
export function SquareLegend({ items }: { items: { label: React.ReactNode; tone: 'ink' | 'grey' }[] }) {
  return (
    <div className={cn('mt-3 flex flex-wrap gap-x-6 gap-y-1 text-[16px]', TEXT.body)}>
      {items.map((it, i) => (
        <span key={i} className="inline-flex items-center gap-2">
          <span className={cn('h-3.5 w-3.5 rounded-[3px]', it.tone === 'ink' ? 'bg-[#2C2C2C] dark:bg-[#E3E3E3]' : 'bg-[#B3B3B3]')} />
          {it.label}
        </span>
      ))}
    </div>
  );
}

/** Le contenu d'une page v2 sous son en-tête : marges latérales 20, respiration en haut. */
export function Page({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('px-5 pt-5', className)}>{children}</div>;
}
