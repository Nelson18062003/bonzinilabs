/**
 * Cargo, Réception, Entrepôt — les briques de la refonte v2 propres au module
 * (maquettes : docs/mobile-refonte/maquettes-v2/04-cargo et 10-complements,
 * écrans 30 à 53). Mêmes jetons que le kit (`@/mobile/designKit`) : filet
 * #D9D9D9, rayon 8, encre #2C2C2C, la couleur ne porte que le statut et les
 * vrais logos (ici : les armateurs).
 *
 * À remonter dans le kit si un autre module en a besoin : CapsLabel, ChipRow,
 * InkProgress, OptionCard, UnitField, Stepper, StateCircle, CarrierCircle.
 */
import * as React from 'react';
import { Check, Minus, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Chip, FOCUS_RING, Initials, SURFACE, TEXT } from '@/mobile/designKit';

/* ── CapsLabel ────────────────────────────────────────────────────────────
 * Le titre d'un bloc de formulaire ou d'un groupe (« POIDS », « 3 COLIS ·
 * 62,4 KG ») : 15/700, capitales espacées, gris secondaire. */
export function CapsLabel({ children, className, as: Tag = 'p' }: { children: React.ReactNode; className?: string; as?: 'p' | 'h2' | 'h3' | 'label' }) {
  return <Tag className={cn('block text-[15px] font-bold uppercase tracking-[0.06em] tabular-nums', TEXT.muted, className)}>{children}</Tag>;
}

/* ── ChipRow ──────────────────────────────────────────────────────────────
 * Les puces de filtre qui défilent (« Tous 9 · En mer 6 · Sous 7 j 3 »). */
export interface ChipOption<T extends string> { value: T; label: React.ReactNode; count?: number | null }
export function ChipRow<T extends string>({ options, value, onChange, className }: { options: ReadonlyArray<ChipOption<T>>; value: T; onChange: (v: T) => void; className?: string }) {
  return (
    <div className={cn('scrollbar-hide flex gap-2 overflow-x-auto px-5', className)}>
      {options.map((o) => (
        <Chip key={o.value} label={o.label} count={o.count} active={o.value === value} onClick={() => onChange(o.value)} />
      ))}
    </div>
  );
}

/* ── InkProgress ──────────────────────────────────────────────────────────
 * Une barre d'avancement à l'encre (pointage 61/86, jauge 24,6/32 kg). */
export function InkProgress({ value, max, className, label }: { value: number; max: number; className?: string; label?: string }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return (
    <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={value} className={cn('h-2.5 w-full overflow-hidden rounded-full bg-[#F5F5F5] dark:bg-[#383838]', className)}>
      <div className="h-full rounded-full bg-[#2C2C2C] transition-[width] dark:bg-[#E3E3E3]" style={{ width: `${pct}%` }} />
    </div>
  );
}

/* ── OptionCard ───────────────────────────────────────────────────────────
 * Un grand choix à rond (« Qui apporte le colis ? », « Qui emporte ? ») :
 * carte à filet, bord encre quand il est choisi ; `children` s'ouvre dessous. */
export function OptionCard({ selected, onClick, title, hint, children, className }: {
  selected: boolean;
  onClick: () => void;
  title: React.ReactNode;
  hint?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('rounded-lg border', selected ? 'border-2 border-[#2C2C2C] dark:border-[#E3E3E3]' : SURFACE.divider, className)}>
      <button type="button" role="radio" aria-checked={selected} onClick={onClick} className={cn('flex min-h-[64px] w-full items-center gap-3.5 rounded-lg px-4 py-3 text-left', FOCUS_RING, !selected && 'active:bg-[#F5F5F5] dark:active:bg-[#383838]')}>
        <span className={cn('flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2', selected ? 'border-[#2C2C2C] dark:border-[#E3E3E3]' : 'border-[#949494]')}>
          {selected && <span className="h-3 w-3 rounded-full bg-[#2C2C2C] dark:bg-[#E3E3E3]" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className={cn('block text-[17px] font-semibold leading-snug', TEXT.strong)}>{title}</span>
          {hint != null && <span className={cn('block text-[15px] leading-snug', TEXT.muted)}>{hint}</span>}
        </span>
      </button>
      {selected && children != null && <div className="space-y-2.5 px-4 pb-4">{children}</div>}
    </div>
  );
}

/* ── RadioRow ─────────────────────────────────────────────────────────────
 * Un choix dans une liste, sans carte (« Déjà vus pour ce client ») : rond
 * à gauche, nom, une ligne ; filet entre les lignes. */
export function RadioRow({ selected, onClick, title, hint }: { selected: boolean; onClick: () => void; title: React.ReactNode; hint?: React.ReactNode }) {
  return (
    <button type="button" role="radio" aria-checked={selected} onClick={onClick} className={cn('flex min-h-[64px] w-full items-center gap-3.5 border-b py-3 text-left last:border-b-0 active:bg-[#F5F5F5] dark:active:bg-[#383838]', SURFACE.divider, FOCUS_RING)}>
      <span className={cn('flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2', selected ? 'border-[#2C2C2C] bg-[#2C2C2C] dark:border-[#E3E3E3] dark:bg-[#E3E3E3]' : 'border-[#949494]')}>
        {selected && <span className="h-2.5 w-2.5 rounded-full bg-white dark:bg-[#1E1E1E]" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className={cn('block break-words text-[17px] font-semibold leading-snug', TEXT.strong)}>{title}</span>
        {hint != null && <span className={cn('block text-[15px] leading-snug', TEXT.muted)}>{hint}</span>}
      </span>
    </button>
  );
}

/* ── UnitField ────────────────────────────────────────────────────────────
 * Un nombre en grand avec son unité (« 23,2 kg », « 70 cm »). */
export const UnitField = React.forwardRef<HTMLInputElement, Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> & { unit: React.ReactNode; big?: boolean; invalid?: boolean }>(
  function UnitField({ unit, big = false, invalid, className, ...rest }, ref) {
    return (
      <label className={cn('flex w-full items-baseline gap-2 rounded-lg border bg-white px-4 dark:bg-[#2C2C2C]', big ? 'h-[72px]' : 'h-16', invalid ? 'border-[#EC221F]' : 'border-[#949494] focus-within:border-2 focus-within:border-[#2C2C2C] dark:border-[#6E6E6E] dark:focus-within:border-[#E3E3E3]', className)}>
        {/* eslint-disable-next-line no-restricted-syntax -- champ chiffré du module (taille de chiffre, pas de zoom iOS) */}
        <input
          ref={ref}
          inputMode="decimal"
          className={cn('h-full min-w-0 flex-1 bg-transparent font-bold tabular-nums outline-none placeholder:font-semibold placeholder:text-[#B3B3B3]', big ? 'text-[34px]' : 'text-[26px]', TEXT.strong)}
          {...rest}
        />
        <span className={cn('shrink-0 font-semibold', big ? 'text-[20px]' : 'text-[17px]', TEXT.muted)}>{unit}</span>
      </label>
    );
  },
);

/* ── Stepper ──────────────────────────────────────────────────────────────
 * « Étiquettes à imprimer  (−) 1 (+) ». */
export function Stepper({ value, onChange, min = 1, max = 99, label }: { value: number; onChange: (n: number) => void; min?: number; max?: number; label?: string }) {
  const btn = cn('flex h-12 w-12 items-center justify-center rounded-full border disabled:opacity-40', SURFACE.divider, FOCUS_RING, TEXT.strong, 'active:bg-[#F5F5F5] dark:active:bg-[#383838]');
  return (
    <div className="flex items-center gap-3" role="group" aria-label={label}>
      <button type="button" className={btn} disabled={value <= min} onClick={() => onChange(Math.max(min, value - 1))} aria-label="Moins"><Minus className="h-5 w-5" /></button>
      <span className={cn('min-w-[2ch] text-center text-[22px] font-bold tabular-nums', TEXT.strong)}>{value}</span>
      <button type="button" className={btn} disabled={value >= max} onClick={() => onChange(Math.min(max, value + 1))} aria-label="Plus"><Plus className="h-5 w-5" /></button>
    </div>
  );
}

/* ── StateCircle ──────────────────────────────────────────────────────────
 * Le rond de tête d'une ligne qui se coche : fait (vert), à faire (anneau),
 * problème (rouge « ! »), en cours (encre, icône). */
export function StateCircle({ state, icon: Icon, size = 44 }: { state: 'done' | 'todo' | 'alert' | 'here' | 'warn'; icon?: React.ElementType; size?: number }) {
  const s = { width: size, height: size };
  if (state === 'done') return <span style={s} className="flex shrink-0 items-center justify-center rounded-full bg-[#CFF7D3] text-[#02542D]"><Check className="h-5 w-5" strokeWidth={2.75} /></span>;
  if (state === 'warn') return <span style={s} className="flex shrink-0 items-center justify-center rounded-full bg-[#CFF7D3] text-[#682D03]"><Check className="h-5 w-5" strokeWidth={2.75} /></span>;
  if (state === 'alert') return <span style={s} className="flex shrink-0 items-center justify-center rounded-full bg-[#FDD3D0] text-[20px] font-bold text-[#900B09]">!</span>;
  if (state === 'here') return <span style={s} className="flex shrink-0 items-center justify-center rounded-full bg-[#2C2C2C] text-[#F5F5F5] dark:bg-[#E3E3E3] dark:text-[#1E1E1E]">{Icon && <Icon className="h-5 w-5" />}</span>;
  return <span style={s} className="block shrink-0 rounded-full border-2 border-[#949494]" />;
}

/* ── CarrierCircle ────────────────────────────────────────────────────────
 * Le vrai logo de l'armateur, en rond de 44 (comme MethodCircle pour les
 * moyens de paiement). Maersk : l'étoile blanche sur bleu ciel. */
const MAERSK_STAR = (() => {
  const pts: string[] = [];
  for (let i = 0; i < 14; i++) {
    const r = i % 2 === 0 ? 10 : 4.1;
    const a = (Math.PI / 7) * i - Math.PI / 2;
    pts.push(`${(12 + r * Math.cos(a)).toFixed(2)},${(12 + r * Math.sin(a)).toFixed(2)}`);
  }
  return pts.join(' ');
})();

/** Un mot-logo dessiné (pas du texte : il ne se lit pas, il se reconnaît). */
function WordMark({ lines, size, label }: { lines: { text: string; color: string }[]; size: number; label: string }) {
  // Dessiné en grand puis réduit par la viewBox (80 unités pour 80 % du rond).
  const fs = (t: string) => (t.length > 3 ? 21 : lines.length > 1 ? 26 : 30);
  const h = lines.length === 1 ? 32 : 58;
  return (
    <svg role="img" aria-label={label} viewBox={`0 0 80 ${h}`} style={{ width: size * 0.8, height: size * 0.8 * (h / 80) }}>
      {lines.map((l, i) => (
        <text key={i} x="40" y={lines.length === 1 ? 25 : 24 + i * 29} textAnchor="middle" fontFamily="DM Sans, sans-serif" fontWeight="700" fontSize={fs(l.text)} fill={l.color}>{l.text}</text>
      ))}
    </svg>
  );
}

export function CarrierCircle({ carrier, size = 44, className }: { carrier: string | null | undefined; size?: number; className?: string }) {
  const box = { width: size, height: size };
  const ring = cn('flex shrink-0 items-center justify-center rounded-full border bg-white dark:bg-white', SURFACE.divider, className);
  switch (carrier) {
    case 'MAERSK':
      return (
        <span role="img" aria-label="Maersk" style={{ ...box, background: '#42B0D5' }} className={cn('flex shrink-0 items-center justify-center rounded-full', className)}>
          <svg viewBox="0 0 24 24" style={{ width: size * 0.58, height: size * 0.58 }} aria-hidden><polygon points={MAERSK_STAR} fill="#FFFFFF" /></svg>
        </span>
      );
    case 'MSC':
      return <span style={box} className={ring}><WordMark size={size} label="MSC" lines={[{ text: 'MSC', color: '#A2894E' }]} /></span>;
    case 'CMA_CGM':
      return <span style={box} className={ring}><WordMark size={size} label="CMA CGM" lines={[{ text: 'CMA', color: '#04246A' }, { text: 'CGM', color: '#E2001A' }]} /></span>;
    case 'COSCO':
      return <span style={box} className={ring}><WordMark size={size} label="COSCO" lines={[{ text: 'COSCO', color: '#003A8C' }]} /></span>;
    default:
      return <Initials name={carrier ?? '?'} size={size} className={className} />;
  }
}

/* ── TopIcon ──────────────────────────────────────────────────────────────
 * Une icône nue dans l'en-tête d'un écran (loupe, scan, « + »), au format
 * de MoreButton. */
export function TopIcon({ icon: Icon, onClick, ariaLabel, disabled }: { icon: React.ElementType; onClick: () => void; ariaLabel: string; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} aria-label={ariaLabel} disabled={disabled} className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-full disabled:opacity-40 active:bg-[#F5F5F5] dark:active:bg-[#383838]', FOCUS_RING, TEXT.strong)}>
      <Icon className="h-6 w-6" strokeWidth={2} />
    </button>
  );
}

/* ── RowButton ────────────────────────────────────────────────────────────
 * Le petit bouton blanc à filet au bout d'une ligne (« Attribuer »,
 * « Retirer »). `link` : souligné, sans cadre. */
export function RowButton({ children, onClick, disabled, link }: { children: React.ReactNode; onClick: () => void; disabled?: boolean; link?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className={cn('flex h-11 shrink-0 items-center justify-center rounded-lg text-[16px] font-semibold disabled:opacity-40', FOCUS_RING, TEXT.strong, link ? 'px-1 underline underline-offset-[3px]' : cn('border px-4 active:bg-[#F5F5F5] dark:active:bg-[#383838]', SURFACE.divider))}
    >
      {children}
    </button>
  );
}

/* ── FitSegmented ─────────────────────────────────────────────────────────
 * Le segment à filet de BoxSegmented, mais chaque part prend la largeur de
 * son mot (« Documents » ne se coupe pas à côté de « Colis »). */
export function FitSegmented<T extends string>({ options, value, onChange, ariaLabel, className }: { options: ReadonlyArray<{ value: T; label: React.ReactNode }>; value: T; onChange: (v: T) => void; ariaLabel?: string; className?: string }) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className={cn('flex overflow-hidden rounded-lg border', SURFACE.divider, className)}>
      {options.map((o, i) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className={cn('flex min-h-[46px] flex-auto items-center justify-center whitespace-nowrap px-2.5 text-[16px] font-semibold', i > 0 && cn('border-l', SURFACE.divider), FOCUS_RING, on ? 'bg-[#2C2C2C] text-[#F5F5F5] dark:bg-[#E3E3E3] dark:text-[#1E1E1E]' : TEXT.strong)}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/* ── FieldFrame ───────────────────────────────────────────────────────────
 * Le cadre où l'on signe au doigt, avec « Effacer » en haut à droite. */
export function FieldFrame({ children, action, className }: { children: React.ReactNode; action?: { label: React.ReactNode; onClick: () => void }; className?: string }) {
  return (
    <div className={cn('relative rounded-lg border border-[#949494] dark:border-[#6E6E6E]', className)}>
      {action && (
        <button type="button" onClick={action.onClick} className={cn('absolute right-3 top-2 z-10 rounded px-1 text-[16px] font-semibold underline underline-offset-[3px]', FOCUS_RING, TEXT.strong)}>
          {action.label}
        </button>
      )}
      {children}
    </div>
  );
}
