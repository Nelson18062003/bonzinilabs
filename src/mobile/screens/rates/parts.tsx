/**
 * Module Taux (refonte v2) — les petites briques propres au module, sur les
 * jetons du kit (filet #D9D9D9, rayon 8, un seul noir, la couleur réservée
 * aux vrais logos et aux drapeaux). Ce qui servirait ailleurs est signalé
 * pour remonter dans `@/mobile/designKit` :
 *   · ModuleTop (en-tête d'accueil de module : retour + grand titre + ronds)
 *   · RadioCard (choix en grande carte avec rond de sélection)
 *   · ChoiceChips (pastilles de valeur sur une grille)
 *   · FieldBox (champ « à toucher » piloté par le gros clavier)
 *   · FlagCircle (drapeau rond)
 *   · Histogram (barres grises, la barre choisie à l'encre)
 */
import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FOCUS_RING, MethodCircle, SURFACE, TEXT, TOGGLE_OFF, TOGGLE_ON } from '@/mobile/designKit';
import type { PaymentMethodKey } from '@/types/rates';

/** Le rond d'une ligne : le logo, et le badge WeChat sur Alipay quand ils sont réunis. */
export function GroupCircle({ methods, size = 44 }: { methods: PaymentMethodKey[]; size?: number }) {
  if (methods.length < 2) return <MethodCircle method={methods[0]} size={size} />;
  const badge = Math.round(size * 0.5);
  return (
    <span className="relative shrink-0" style={{ width: size, height: size }}>
      <MethodCircle method={methods[0]} size={size} />
      <span className="absolute -bottom-1 -right-1 rounded-full border-2 border-white dark:border-[#1E1E1E]">
        <MethodCircle method={methods[1]} size={badge} />
      </span>
    </span>
  );
}

/* ── Drapeau rond ────────────────────────────────────────────────────── */

const ROUND_FLAGS = import.meta.glob('/node_modules/flag-icons/flags/1x1/{cm,ga,td,cf,cg,gq,cn}.svg', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

export function FlagCircle({ iso, size = 44, className }: { iso: string | null | undefined; size?: number; className?: string }) {
  const url = iso ? ROUND_FLAGS[`/node_modules/flag-icons/flags/1x1/${iso.toLowerCase()}.svg`] : undefined;
  if (!url) {
    return (
      <span className={cn('flex shrink-0 items-center justify-center rounded-full bg-[#F5F5F5] font-semibold text-[#1E1E1E] dark:bg-[#383838] dark:text-[#F5F5F5]', className)} style={{ width: size, height: size, fontSize: Math.round(size * 0.32) }}>
        {iso ?? '?'}
      </span>
    );
  }
  return <img src={url} alt="" aria-hidden draggable={false} className={cn('shrink-0 rounded-full object-cover', className)} style={{ width: size, height: size }} />;
}

/* ── En-tête d'accueil de module ─────────────────────────────────────── */

export function ModuleTop({ title, backTo, right }: { title: React.ReactNode; backTo: string; right?: React.ReactNode }) {
  const navigate = useNavigate();
  return (
    <header className={cn('pt-[env(safe-area-inset-top)]', SURFACE.canvas)}>
      <div className="flex h-[62px] items-center gap-1.5 pl-1.5 pr-5 pt-1.5">
        <button type="button" onClick={() => navigate(backTo)} aria-label="Retour" className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-full active:bg-[#F5F5F5] dark:active:bg-[#383838]', FOCUS_RING, TEXT.strong)}>
          <ChevronLeft className="h-7 w-7" strokeWidth={2} />
        </button>
        <h1 className={cn('min-w-0 flex-1 truncate text-[24px] font-semibold tracking-[-0.02em]', TEXT.strong)}>{title}</h1>
        {right != null && <div className="flex shrink-0 items-center gap-2.5">{right}</div>}
      </div>
    </header>
  );
}

/* ── Libellé de groupe (« PRISE D'EFFET ») ───────────────────────────── */

export function GroupLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('px-5 pb-2.5 pt-6 text-[15px] font-semibold uppercase tracking-[0.06em]', TEXT.muted, className)}>{children}</div>;
}

/* ── Rond de sélection et carte de choix ─────────────────────────────── */

export function RadioDot({ on }: { on: boolean }) {
  return on ? (
    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#2C2C2C] dark:bg-[#E3E3E3]">
      <span className="h-2.5 w-2.5 rounded-full bg-white dark:bg-[#1E1E1E]" />
    </span>
  ) : (
    <span className="h-7 w-7 shrink-0 rounded-full border-2 border-[#949494] dark:border-[#6E6E6E]" />
  );
}

export function RadioCard({
  selected, onClick, leading, title, subtitle, right, children, className,
}: {
  selected: boolean;
  onClick: () => void;
  leading?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  /** À la place du rond (« › » pour une carte qui ouvre une feuille). */
  right?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('rounded-lg border', selected ? 'border-[#2C2C2C] ring-1 ring-[#2C2C2C] dark:border-[#E3E3E3] dark:ring-[#E3E3E3]' : SURFACE.divider, className)}>
      <button type="button" onClick={onClick} aria-pressed={selected} className={cn('flex min-h-[72px] w-full items-center gap-3.5 rounded-lg px-4 py-3.5 text-left', FOCUS_RING)}>
        {leading}
        <span className="min-w-0 flex-1">
          <span className={cn('block text-[18px] font-semibold leading-tight', TEXT.strong)}>{title}</span>
          {subtitle != null && <span className={cn('mt-1 block text-[16px]', TEXT.muted)}>{subtitle}</span>}
        </span>
        {right ?? <RadioDot on={selected} />}
      </button>
      {children}
    </div>
  );
}

/* ── Pastilles de valeur (0 %, −0,5 %…) ──────────────────────────────── */

export function ChoiceChips<T extends string | number>({
  options, value, onChange, className, cols,
}: {
  options: ReadonlyArray<{ value: T; label: React.ReactNode }>;
  value: T | null;
  onChange: (v: T) => void;
  className?: string;
  cols?: number;
}) {
  return (
    <div className={cn('grid gap-2', className)} style={{ gridTemplateColumns: `repeat(${cols ?? options.length}, minmax(0, 1fr))` }}>
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          onClick={() => onChange(o.value)}
          aria-pressed={o.value === value}
          className={cn('flex h-12 items-center justify-center whitespace-nowrap px-1 text-[16px] font-semibold tabular-nums', FOCUS_RING, o.value === value ? TOGGLE_ON : TOGGLE_OFF)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Une rangée de pastilles qui défile (méthodes, pays, périodes). */
export function ChipRow({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('flex gap-2 overflow-x-auto px-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden', className)}>{children}</div>;
}

/* ── Champ piloté par le clavier ─────────────────────────────────────── */

export function FieldBox({
  value, placeholder, active, onClick, ariaLabel, className,
}: {
  value: string;
  placeholder?: string;
  active: boolean;
  onClick: () => void;
  ariaLabel: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      aria-pressed={active}
      className={cn(
        'flex h-14 w-[136px] shrink-0 items-center justify-end rounded-lg border px-4 text-[22px] font-bold tabular-nums',
        FOCUS_RING,
        active ? 'border-[#2C2C2C] ring-1 ring-[#2C2C2C] dark:border-[#E3E3E3] dark:ring-[#E3E3E3]' : 'border-[#949494] dark:border-[#6E6E6E]',
        value ? TEXT.strong : TEXT.faint,
        className,
      )}
    >
      <span className="truncate">{value || placeholder || ''}</span>
      {active && <span aria-hidden className="ml-0.5 h-7 w-[2px] animate-pulse bg-[#1E1E1E] dark:bg-[#F5F5F5]" />}
    </button>
  );
}

/* ── Petite carte chiffre (2 par ligne) ──────────────────────────────── */

export function StatBox({ label, value, sub, className }: { label: React.ReactNode; value: React.ReactNode; sub?: React.ReactNode; className?: string }) {
  return (
    <div className={cn('min-w-0 rounded-lg border px-4 py-3.5', SURFACE.divider, className)}>
      <div className={cn('text-[16px] leading-tight', TEXT.muted)}>{label}</div>
      <div className={cn('mt-1 truncate text-[26px] font-bold leading-tight tabular-nums', TEXT.strong)}>{value}</div>
      {sub != null && <div className={cn('mt-0.5 truncate text-[15px]', TEXT.muted)}>{sub}</div>}
    </div>
  );
}

/* ── Histogramme ─────────────────────────────────────────────────────── */

export interface HistoBar {
  key: number;
  value: number;
  /** Nombre affiché au-dessus de la barre choisie. */
  display: string;
}

/** Barres grises, la barre choisie à l'encre avec son nombre au-dessus. */
export function Histogram({
  bars, selected, onSelect, xLabels, height = 220, ariaLabel,
}: {
  bars: HistoBar[];
  selected: number | null;
  onSelect: (key: number) => void;
  xLabels: { at: number; label: string }[];
  height?: number;
  ariaLabel?: string;
}) {
  const max = Math.max(1, ...bars.map((b) => b.value));
  const n = Math.max(bars.length, 1);
  const gap = n > 60 ? 1 : n > 24 ? 2 : 5;
  return (
    <div role="img" aria-label={ariaLabel}>
      <div className="flex items-end" style={{ height, gap }}>
        {bars.map((b) => {
          const on = b.key === selected;
          const h = b.value > 0 ? Math.max(4, (b.value / max) * (height - 30)) : 0;
          return (
            <button
              key={b.key}
              type="button"
              onClick={() => onSelect(b.key)}
              aria-label={b.display}
              className="relative flex h-full min-w-0 flex-1 flex-col items-center justify-end outline-none"
            >
              {on && <span className={cn('mb-1.5 whitespace-nowrap text-[15px] font-bold tabular-nums', TEXT.strong)}>{b.display}</span>}
              <span
                className={cn('block w-full', n > 60 ? 'rounded-[1px]' : 'rounded-t-[4px]', on ? 'bg-[#2C2C2C] dark:bg-[#E3E3E3]' : 'bg-[#B3B3B3] dark:bg-[#5A5A5A]')}
                style={{ height: h }}
              />
            </button>
          );
        })}
      </div>
      <div className={cn('mt-2 border-t pt-2', SURFACE.divider)}>
        <div className="relative h-5">
          {xLabels.map((x) => {
            const pct = n <= 1 ? 50 : ((x.at + 0.5) / n) * 100;
            const align = pct < 8 ? 'translate-x-0' : pct > 92 ? '-translate-x-full' : '-translate-x-1/2';
            return (
              <span key={x.at} className={cn('absolute top-0 whitespace-nowrap text-[15px] tabular-nums', align, TEXT.muted)} style={{ left: `${pct}%` }}>
                {x.label}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/** Une fine cale pour qu'un dock à deux rangées ne cache rien. */
export function DockSpacer({ rows = 2 }: { rows?: number }) {
  return <div aria-hidden style={{ height: (rows - 1) * 66 }} />;
}

/** Le rond Binance (logo dessiné à ses couleurs, comme dans les maquettes). */
export function BinanceCircle() {
  return (
    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#1E2026]" aria-hidden>
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="#F0B90B">
        <path d="M12 3.5 14.6 6.1 12 8.7 9.4 6.1zM6.1 9.4 8.7 12 6.1 14.6 3.5 12zM17.9 9.4 20.5 12 17.9 14.6 15.3 12zM12 15.3 14.6 17.9 12 20.5 9.4 17.9zM12 10.2 13.8 12 12 13.8 10.2 12z" />
      </svg>
    </span>
  );
}
