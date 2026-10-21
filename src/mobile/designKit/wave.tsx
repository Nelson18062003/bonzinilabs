/**
 * Design kit mobile — la couche « Wave » de la refonte v2 (validée le
 * 21/10/2026, maquettes : docs/mobile-refonte/maquettes-v2/).
 *
 * Mêmes jetons que le kit (blanc, filet #D9D9D9, rayon 8, un seul primaire
 * #2C2C2C, la couleur ne porte que le statut et les vrais logos), mais la
 * grammaire de Wave : un écran = une chose ; un gros chiffre, trois ou quatre
 * gros boutons ronds, une liste courte ; un seul bouton noir de 56 px en bas ;
 * ce qui est rare dans le menu « … ».
 *
 * Purement présentationnels, comme components.tsx.
 */
import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, ChevronLeft, ChevronRight, Delete, MoreHorizontal, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BottomSheet, Holder } from './components';
import { FOCUS_RING, SURFACE, TEXT, TONE_PILL, type Tone } from './tokens';
import { LOGO_PATH, PAYMENT_METHOD, type MethodKey } from './methods';
import type { PadKey } from './helpers';

/* ── ScreenTop ────────────────────────────────────────────────────────────
 * L'en-tête d'un écran de détail ou d'un parcours : 56 px, filet bas,
 * retour, titre 18/600, étape « 2/3 » ou actions à droite. */
export function ScreenTop({
  title, onBack, backTo, back = true, step, right, className,
}: {
  title: React.ReactNode;
  onBack?: () => void;
  backTo?: string;
  back?: boolean;
  /** « 2/3 » : l'étape d'un parcours. */
  step?: React.ReactNode;
  right?: React.ReactNode;
  className?: string;
}) {
  const navigate = useNavigate();
  const goBack = () => (onBack ? onBack() : backTo ? navigate(backTo) : navigate(-1));
  return (
    <header className={cn('sticky top-0 z-40 border-b pt-[env(safe-area-inset-top)]', SURFACE.canvas, SURFACE.divider, className)}>
      <div className={cn('flex h-14 items-center gap-1.5 pr-4', back ? 'pl-1.5' : 'pl-5')}>
        {back && (
          <button type="button" onClick={goBack} aria-label="Retour" className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-full active:bg-[#F5F5F5] dark:active:bg-[#383838]', FOCUS_RING, TEXT.strong)}>
            <ChevronLeft className="h-7 w-7" strokeWidth={2} />
          </button>
        )}
        <h1 className={cn('min-w-0 flex-1 truncate text-[18px] font-semibold', TEXT.strong)}>{title}</h1>
        {step != null && <span className={cn('shrink-0 text-[16px] font-semibold tabular-nums', TEXT.muted)}>{step}</span>}
        {right}
      </div>
    </header>
  );
}

/* ── TabTop ───────────────────────────────────────────────────────────────
 * L'en-tête d'un onglet (Accueil, Opérations, Plus…) : grand titre 24/600 à
 * gauche, ronds de 44 à droite. Pas de filet : le contenu respire dessous. */
export function TabTop({ title, right, className }: { title: React.ReactNode; right?: React.ReactNode; className?: string }) {
  return (
    <header className={cn('pt-[env(safe-area-inset-top)]', SURFACE.canvas, className)}>
      <div className="flex h-[62px] items-center justify-between gap-3 px-5 pt-1.5">
        <h1 className={cn('min-w-0 truncate text-[24px] font-semibold tracking-[-0.02em]', TEXT.strong)}>{title}</h1>
        {right != null && <div className="flex shrink-0 items-center gap-2.5">{right}</div>}
      </div>
    </header>
  );
}

/** Le rond de 44 à filet des en-têtes (notifications, recherche, « … »). Un point rouge si `dot`. */
export function RoundButton({
  icon: Icon, onClick, ariaLabel, dot, children, className,
}: {
  icon?: React.ElementType;
  onClick?: () => void;
  ariaLabel: string;
  dot?: boolean;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className={cn('relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border bg-white active:bg-[#F5F5F5] dark:bg-[#2C2C2C] dark:active:bg-[#383838]', SURFACE.divider, FOCUS_RING, TEXT.strong, className)}
    >
      {Icon ? <Icon className="h-[22px] w-[22px]" strokeWidth={2} /> : children}
      {dot && <span className="absolute right-[9px] top-2 h-[9px] w-[9px] rounded-full bg-[#EC221F]" />}
    </button>
  );
}

/** Le « … » d'un en-tête : ouvre le menu des actions rares. */
export function MoreButton({ onClick, ariaLabel = 'Plus d\'actions', bordered = false }: { onClick: () => void; ariaLabel?: string; bordered?: boolean }) {
  if (bordered) return <RoundButton icon={MoreHorizontal} onClick={onClick} ariaLabel={ariaLabel} />;
  return (
    <button type="button" onClick={onClick} aria-label={ariaLabel} className={cn('-mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full active:bg-[#F5F5F5] dark:active:bg-[#383838]', FOCUS_RING, TEXT.strong)}>
      <MoreHorizontal className="h-6 w-6" strokeWidth={2.25} />
    </button>
  );
}

/* ── HeroFigure ───────────────────────────────────────────────────────────
 * Le chiffre du jour, façon Wave : une carte à filet, une étiquette, un
 * chiffre de 40, une ligne de compléments. Toucher la carte ouvre le détail. */
export function HeroFigure({
  label, value, unit, sub, onClick, tag, className,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  /** Unité en plus petit après le chiffre (« XAF »). */
  unit?: React.ReactNode;
  /** Compléments sous le chiffre : chaque élément est séparé d'un blanc. */
  sub?: React.ReactNode[];
  onClick?: () => void;
  tag?: { tone: Tone; label: React.ReactNode };
  className?: string;
}) {
  const Wrapper = onClick ? 'button' : 'div';
  return (
    <Wrapper
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={cn('block w-full rounded-lg border px-[18px] pb-4 pt-[18px] text-left', SURFACE.card, SURFACE.divider, onClick && cn('active:bg-[#F5F5F5] dark:active:bg-[#383838]', FOCUS_RING), className)}
    >
      <div className="flex items-start justify-between gap-3">
        <div className={cn('text-[16px] font-medium', TEXT.muted)}>{label}</div>
        {tag && <Tag tone={tag.tone}>{tag.label}</Tag>}
      </div>
      <div className={cn('mt-1.5 break-words text-[40px] font-bold leading-[1.1] tracking-[-0.02em] tabular-nums', TEXT.strong)}>
        {value}
        {unit != null && <span className={cn('ml-1.5 text-[20px] font-semibold', TEXT.muted)}>{unit}</span>}
      </div>
      {sub && sub.length > 0 && (
        <div className={cn('mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[16px] font-medium', TEXT.body)}>
          {sub.map((s, i) => <span key={i}>{s}</span>)}
        </div>
      )}
    </Wrapper>
  );
}

/* ── BigFigure ────────────────────────────────────────────────────────────
 * Le chiffre sans carte, en tête d'un écran d'analyse ou d'une fiche. */
export function BigFigure({
  label, value, unit, delta, note, size = 'lg', className, center,
}: {
  label?: React.ReactNode;
  value: React.ReactNode;
  unit?: React.ReactNode;
  /** Variation : `+12 %` en vert, `−4 %` en rouge, ou un tag libre. */
  delta?: { tone: Tone; label: React.ReactNode };
  note?: React.ReactNode;
  size?: 'md' | 'lg' | 'xl';
  className?: string;
  center?: boolean;
}) {
  const num = size === 'xl' ? 'text-[56px] leading-none tracking-[-0.03em]' : size === 'md' ? 'text-[36px] leading-[1.1] tracking-[-0.02em]' : 'text-[48px] leading-none tracking-[-0.03em]';
  return (
    <div className={cn(center && 'text-center', className)}>
      {label != null && <div className={cn('text-[16px] font-medium', TEXT.muted)}>{label}</div>}
      <div className={cn('break-words font-bold tabular-nums', num, TEXT.strong, label != null && 'mt-2')}>
        {value}
        {unit != null && <span className={cn('ml-2 text-[22px] font-semibold tracking-normal', TEXT.muted)}>{unit}</span>}
      </div>
      {(delta || note) && (
        <div className={cn('mt-3 flex flex-wrap items-center gap-2.5 text-[16px]', TEXT.body, center && 'justify-center')}>
          {delta && <Tag tone={delta.tone}>{delta.label}</Tag>}
          {note}
        </div>
      )}
    </div>
  );
}

/* ── ActionCircles ────────────────────────────────────────────────────────
 * Les gros boutons ronds de Wave : 64 px, étiquette 15/600 dessous. Le
 * premier est noir (l'action principale du module), les autres gris. */
export interface CircleAction {
  label: React.ReactNode;
  icon?: React.ElementType;
  /** Un visuel à la place de l'icône (mascotte, logo). */
  visual?: React.ReactNode;
  onClick: () => void;
  primary?: boolean;
  badge?: number;
  disabled?: boolean;
}

export function ActionCircles({ actions, className }: { actions: CircleAction[]; className?: string }) {
  const cols = Math.min(Math.max(actions.length, 3), 4);
  return (
    <div className={cn('grid px-3.5 pb-1.5 pt-[22px]', className)} style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
      {actions.map((a, i) => {
        const primary = a.primary ?? i === 0;
        const Icon = a.icon;
        return (
          <button
            key={i}
            type="button"
            onClick={a.onClick}
            disabled={a.disabled}
            className={cn('flex min-w-0 flex-col items-center gap-[9px] rounded-lg py-1 text-center disabled:opacity-40', FOCUS_RING)}
          >
            <span
              className={cn(
                'relative flex h-16 w-16 items-center justify-center rounded-full transition-colors',
                primary ? 'bg-[#2C2C2C] text-[#F5F5F5] active:bg-[#1E1E1E] dark:bg-[#E3E3E3] dark:text-[#1E1E1E]' : 'bg-[#F5F5F5] text-[#1E1E1E] active:bg-[#E6E6E6] dark:bg-[#383838] dark:text-[#F5F5F5]',
              )}
            >
              {a.visual ?? (Icon && <Icon className="h-7 w-7" strokeWidth={2} />)}
              {a.badge != null && a.badge > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-[22px] min-w-[22px] items-center justify-center rounded-full border-2 border-white bg-[#EC221F] px-1 text-[12px] font-bold leading-none text-white dark:border-[#1E1E1E]">
                  {a.badge > 99 ? '99+' : a.badge}
                </span>
              )}
            </span>
            <span className={cn('max-w-full text-[15px] font-semibold leading-[1.2]', TEXT.strong)}>{a.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ── SectionHead ──────────────────────────────────────────────────────────
 * Le titre d'une liste courte : 20/600, lien souligné à droite. */
export function SectionHead({
  title, link, className,
}: {
  title: React.ReactNode;
  link?: { label: React.ReactNode; onClick: () => void };
  className?: string;
}) {
  return (
    <div className={cn('flex items-baseline justify-between gap-3 px-5 pb-1.5 pt-[22px]', className)}>
      <h2 className={cn('text-[20px] font-semibold', TEXT.strong)}>{title}</h2>
      {link && (
        <button type="button" onClick={link.onClick} className={cn('shrink-0 rounded text-[16px] font-semibold underline underline-offset-[3px]', FOCUS_RING, TEXT.strong)}>
          {link.label}
        </button>
      )}
    </div>
  );
}

/** L'étiquette d'un groupe de jours (« Aujourd'hui », « Hier », « 14 oct. »). */
export function DayLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('px-5 pt-[18px] text-[15px] font-semibold', TEXT.muted, className)}>{children}</div>;
}

/* ── Tag ──────────────────────────────────────────────────────────────────
 * Le statut d'une ligne : 14/600, rayon 6. Plus petit que StatusPill (qui
 * reste pour les fiches). */
export function Tag({ tone, children, className }: { tone: Tone; children: React.ReactNode; className?: string }) {
  return (
    <span className={cn('inline-block whitespace-nowrap rounded-md px-2 py-[5px] text-[14px] font-semibold leading-none', TONE_PILL[tone], className)}>
      {children}
    </span>
  );
}

/* ── ItemRow ──────────────────────────────────────────────────────────────
 * La ligne de liste de la v2 : rond de 44 (logo ou initiales), nom 17/600,
 * sous-titre 15, montant 17/700 à droite avec son tag dessous. */
export function ItemRow({
  leading, title, subtitle, amount, tag, right, onClick, chevron, className,
}: {
  leading?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  amount?: React.ReactNode;
  tag?: { tone: Tone; label: React.ReactNode };
  /** Contenu libre à droite, à la place du montant. */
  right?: React.ReactNode;
  onClick?: () => void;
  chevron?: boolean;
  className?: string;
}) {
  const Wrapper = onClick ? 'button' : 'div';
  return (
    <Wrapper
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-3.5 border-b py-3.5 text-left last:border-b-0',
        SURFACE.divider,
        onClick && cn('active:bg-[#F5F5F5] dark:active:bg-[#383838]', FOCUS_RING),
        className,
      )}
    >
      {leading}
      <span className="min-w-0 flex-1">
        <span className={cn('block truncate text-[17px] font-semibold leading-[1.25]', TEXT.strong)}>{title}</span>
        {subtitle != null && <span className={cn('mt-0.5 block truncate text-[15px] leading-[1.3]', TEXT.muted)}>{subtitle}</span>}
      </span>
      {(amount != null || tag) && (
        <span className="shrink-0 text-right">
          {amount != null && <span className={cn('block text-[17px] font-bold tabular-nums', TEXT.strong)}>{amount}</span>}
          {tag && <Tag tone={tag.tone} className={amount != null ? 'mt-[5px]' : undefined}>{tag.label}</Tag>}
        </span>
      )}
      {right}
      {chevron && <ChevronRight className={cn('h-5 w-5 shrink-0', TEXT.muted)} />}
    </Wrapper>
  );
}

/** Un groupe de lignes, avec la marge latérale de la v2. */
export function ItemList({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('px-5', className)}>{children}</div>;
}

/** Les initiales en rond de 44 (fond #F5F5F5). */
export function Initials({ name, size = 44, className }: { name: string; size?: number; className?: string }) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const ini = parts.length === 0 ? '?' : parts.length === 1 ? parts[0].slice(0, 2).toUpperCase() : (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return (
    <span
      className={cn('flex shrink-0 items-center justify-center rounded-full bg-[#F5F5F5] font-semibold text-[#1E1E1E] dark:bg-[#383838] dark:text-[#F5F5F5]', className)}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.36) }}
    >
      {ini}
    </span>
  );
}

/* ── MethodCircle ─────────────────────────────────────────────────────────
 * Le vrai logo d'une méthode de PAIEMENT, en rond à sa couleur de marque. */
const BANK_GLYPH = 'M12 2.5 2.5 7.2V9h19V7.2zM4.5 10.5v7h2v-7zm4.75 0v7h2v-7zm4.5 0v7h2v-7zm4.75 0v7h2v-7zM2.5 19v2.5h19V19z';

export function MethodCircle({ method, size = 44, className }: { method: MethodKey | string; size?: number; className?: string }) {
  const key = (method === 'bank_transfer' || method === 'bank' ? 'virement' : method === 'cash_pickup' ? 'cash' : method) as MethodKey;
  const meta = PAYMENT_METHOD[key] ?? { label: String(method), color: '#5A5A5A' };
  const glyph = key === 'alipay' ? LOGO_PATH.alipay : key === 'wechat' ? LOGO_PATH.wechat : key === 'virement' ? BANK_GLYPH : null;
  return (
    <span
      role="img"
      aria-label={meta.label}
      className={cn('flex shrink-0 items-center justify-center rounded-full text-white', className)}
      style={{ width: size, height: size, background: meta.color }}
    >
      {glyph ? (
        <svg viewBox="0 0 24 24" style={{ width: size * 0.55, height: size * 0.55 }} aria-hidden><path d={glyph} fill="currentColor" /></svg>
      ) : (
        <span className="font-bold leading-none" style={{ fontSize: Math.round(size * 0.48) }}>¥</span>
      )}
    </span>
  );
}

/* ── SearchBox ────────────────────────────────────────────────────────────
 * Recherche : 52 px, bord de champ, loupe. En bouton (`onClick`) quand elle
 * ouvre l'écran de recherche plutôt que de filtrer sur place. */
export function SearchBox({
  value, onChange, placeholder = 'Rechercher', onClick, autoFocus, className,
}: {
  value?: string;
  onChange?: (v: string) => void;
  placeholder?: string;
  onClick?: () => void;
  autoFocus?: boolean;
  className?: string;
}) {
  const shell = cn('flex h-[52px] w-full items-center gap-2.5 rounded-lg border px-3.5', SURFACE.field, SURFACE.card);
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={cn(shell, 'text-left', FOCUS_RING, className)}>
        <Search className={cn('h-5 w-5 shrink-0', TEXT.faint)} />
        <span className={cn('truncate text-[17px]', TEXT.faint)}>{placeholder}</span>
      </button>
    );
  }
  return (
    <label className={cn(shell, 'focus-within:border-[#2C2C2C] dark:focus-within:border-[#E3E3E3]', className)}>
      <Search className={cn('h-5 w-5 shrink-0', TEXT.faint)} />
      {/* eslint-disable-next-line no-restricted-syntax -- c'est LA primitive du kit mobile (17 px, pas de zoom iOS) */}
      <input
        type="search"
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className={cn('h-full min-w-0 flex-1 bg-transparent text-[17px] outline-none placeholder:text-[#757575]', TEXT.strong)}
      />
    </label>
  );
}

/* ── BoxSegmented ─────────────────────────────────────────────────────────
 * Le segment à filet de la v2 (Paiements / Dépôts, Activité / Trésorerie) :
 * une boîte, la part choisie en noir. Pour 2 à 4 parts. */
export function BoxSegmented<T extends string>({
  options, value, onChange, className,
}: {
  options: ReadonlyArray<{ value: T; label: React.ReactNode; count?: number | null }>;
  value: T;
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    <div role="tablist" className={cn('grid overflow-hidden rounded-lg border', SURFACE.divider, className)} style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {options.map((o, i) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onChange(o.value)}
            className={cn(
              'flex min-h-[46px] flex-col items-center justify-center px-1 py-1.5 text-[16px] font-semibold leading-tight',
              i > 0 && cn('border-l', SURFACE.divider),
              FOCUS_RING,
              on ? 'bg-[#2C2C2C] text-[#F5F5F5] dark:bg-[#E3E3E3] dark:text-[#1E1E1E]' : TEXT.strong,
            )}
          >
            <span className="truncate">{o.label}</span>
            {o.count != null && <span className={cn('text-[15px] font-medium tabular-nums', on ? 'opacity-90' : TEXT.muted)}>{o.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

/* ── Dock ─────────────────────────────────────────────────────────────────
 * Le bas d'un écran d'action : filet haut, un bouton noir de 56 px (plus un
 * secondaire au besoin). Fixe, au-dessus de la zone de sécurité ; pose sa
 * cale dans le flux pour que rien ne reste caché dessous. */
export const DOCK_HEIGHT = 92;

export function Dock({ children, className, aboveTabBar }: { children: React.ReactNode; className?: string; aboveTabBar?: boolean }) {
  return (
    <>
      <div aria-hidden style={{ height: DOCK_HEIGHT }} />
      <div
        data-dock
        className={cn('fixed inset-x-0 z-40 border-t', aboveTabBar ? 'bottom-[calc(64px+env(safe-area-inset-bottom,0px))]' : 'bottom-0', SURFACE.canvas, SURFACE.divider, className)}
      >
        <div className={cn('mx-auto flex max-w-lg flex-col gap-2.5 px-5 pt-3 md:max-w-2xl', aboveTabBar ? 'pb-3' : 'pb-[calc(env(safe-area-inset-bottom,0px)+12px)]')}>
          {children}
        </div>
      </div>
    </>
  );
}

/** Le grand bouton de la v2 : 56 px, rayon 8, 18/600. */
export function BigButton({
  children, onClick, variant = 'primary', disabled, loading, type = 'button', className,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'soft' | 'danger';
  disabled?: boolean;
  loading?: boolean;
  type?: 'button' | 'submit';
  className?: string;
}) {
  const dead = disabled || loading;
  const look = dead
    ? 'bg-[#D9D9D9] text-[#B3B3B3] dark:bg-[#444444] dark:text-[#767676]'
    : variant === 'soft'
      ? cn('border bg-white text-[#1E1E1E] active:bg-[#F5F5F5] dark:bg-[#2C2C2C] dark:text-[#F5F5F5]', SURFACE.divider)
      : variant === 'danger'
        ? 'bg-[#EC221F] text-white active:bg-[#C00F0C]'
        : 'bg-[#2C2C2C] text-[#F5F5F5] active:bg-[#1E1E1E] dark:bg-[#E3E3E3] dark:text-[#1E1E1E]';
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={dead}
      className={cn('flex h-14 w-full items-center justify-center gap-2 rounded-lg px-4 text-[18px] font-semibold transition-colors', FOCUS_RING, look, className)}
    >
      {loading ? <span className="h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" /> : children}
    </button>
  );
}

/* ── KVBox ────────────────────────────────────────────────────────────────
 * La boîte « étiquette / valeur » des fiches et des confirmations. */
export interface KV {
  label: React.ReactNode;
  value: React.ReactNode;
  /** Avant → après : la valeur devient « avant → après ». */
  before?: React.ReactNode;
  onClick?: () => void;
  tone?: Tone;
}

export function KVBox({ rows, className }: { rows: KV[]; className?: string }) {
  return (
    <div className={cn('rounded-lg border', SURFACE.divider, className)}>
      {rows.map((r, i) => {
        const Wrapper = r.onClick ? 'button' : 'div';
        return (
          <Wrapper
            key={i}
            type={r.onClick ? 'button' : undefined}
            onClick={r.onClick}
            className={cn('flex w-full items-center justify-between gap-3 border-b px-4 py-3.5 text-left text-[16px] last:border-b-0', SURFACE.divider, r.onClick && 'active:bg-[#F5F5F5] dark:active:bg-[#383838]')}
          >
            <span className={cn('min-w-0', TEXT.muted)}>{r.label}</span>
            <span className={cn('min-w-0 text-right font-semibold tabular-nums', r.tone === 'danger' ? 'text-[#C00F0C] dark:text-[#FCB3AD]' : r.tone === 'success' ? 'text-[#009951] dark:text-[#14AE5C]' : TEXT.strong)}>
              {r.before != null && <span className={cn('mr-1.5 font-medium', TEXT.muted)}>{r.before} →</span>}
              {r.value}
            </span>
            {r.onClick && <ChevronRight className={cn('-mr-1 h-5 w-5 shrink-0', TEXT.muted)} />}
          </Wrapper>
        );
      })}
    </div>
  );
}

/* ── ConfirmSheet ─────────────────────────────────────────────────────────
 * La confirmation d'argent ou d'action sensible : une feuille, une question,
 * deux ou trois lignes avant / après, un bouton noir (ou rouge). */
export function ConfirmSheet({
  open, onClose, title, subtitle, rows, children, confirmLabel, onConfirm, loading, danger, cancelLabel = 'Annuler', disabled,
}: {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  rows?: KV[];
  children?: React.ReactNode;
  confirmLabel: React.ReactNode;
  onConfirm: () => void;
  loading?: boolean;
  danger?: boolean;
  cancelLabel?: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <BottomSheet open={open} onClose={loading ? () => undefined : onClose}>
      <h3 className={cn('text-[22px] font-semibold leading-tight', TEXT.strong)}>{title}</h3>
      {subtitle != null && <p className={cn('mt-1 text-[16px]', TEXT.muted)}>{subtitle}</p>}
      {rows && rows.length > 0 && <KVBox rows={rows} className="mt-4" />}
      {children != null && <div className="mt-4">{children}</div>}
      <div className="mt-5 flex flex-col gap-2.5">
        <BigButton variant={danger ? 'danger' : 'primary'} onClick={onConfirm} loading={loading} disabled={disabled}>{confirmLabel}</BigButton>
        <BigButton variant="soft" onClick={onClose} disabled={loading}>{cancelLabel}</BigButton>
      </div>
    </BottomSheet>
  );
}

/* ── ActionSheet ──────────────────────────────────────────────────────────
 * Le menu « … » ouvert : la liste des actions rares, chacune une grande
 * ligne. Les actions destructrices en rouge, en dernier. */
export interface SheetAction {
  label: React.ReactNode;
  hint?: React.ReactNode;
  icon?: React.ElementType;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
  hidden?: boolean;
}

export function ActionSheet({
  open, onClose, title, actions,
}: {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  actions: SheetAction[];
}) {
  const shown = actions.filter((a) => !a.hidden);
  return (
    <BottomSheet open={open} onClose={onClose}>
      {title != null && <h3 className={cn('mb-2 text-[22px] font-semibold leading-tight', TEXT.strong)}>{title}</h3>}
      <div>
        {shown.map((a, i) => {
          const Icon = a.icon;
          return (
            <button
              key={i}
              type="button"
              disabled={a.disabled}
              onClick={() => { onClose(); a.onClick(); }}
              className={cn('flex min-h-[56px] w-full items-center gap-3.5 border-b py-2.5 text-left last:border-b-0 disabled:opacity-40', SURFACE.divider, FOCUS_RING, 'active:bg-[#F5F5F5] dark:active:bg-[#383838]')}
            >
              {Icon && <Icon className={cn('h-[22px] w-[22px] shrink-0', a.danger ? 'text-[#C00F0C]' : TEXT.strong)} strokeWidth={2} />}
              <span className="min-w-0 flex-1">
                <span className={cn('block text-[17px] font-semibold', a.danger ? 'text-[#C00F0C] dark:text-[#FCB3AD]' : TEXT.strong)}>{a.label}</span>
                {a.hint != null && <span className={cn('mt-0.5 block text-[15px]', TEXT.muted)}>{a.hint}</span>}
              </span>
            </button>
          );
        })}
      </div>
    </BottomSheet>
  );
}

/* ── SuccessView ──────────────────────────────────────────────────────────
 * Après une action : rond vert et coche, une phrase, les lignes utiles, puis
 * « Suivant » quand une file existe. */
export function SuccessView({
  title, subtitle, rows, primary, secondary, children,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  rows?: KV[];
  primary?: { label: React.ReactNode; onClick: () => void };
  secondary?: { label: React.ReactNode; onClick: () => void };
  children?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-[calc(100dvh-140px)] flex-col px-5 pb-6 pt-14">
      <div className="text-center">
        <div className="mx-auto flex h-[72px] w-[72px] items-center justify-center rounded-full bg-[#CFF7D3] text-[#02542D]">
          <Check className="h-9 w-9" strokeWidth={2.5} />
        </div>
        <h2 className={cn('mt-5 text-[26px] font-semibold leading-tight', TEXT.strong)}>{title}</h2>
        {subtitle != null && <p className={cn('mt-2 text-[16px]', TEXT.muted)}>{subtitle}</p>}
      </div>
      {rows && rows.length > 0 && <KVBox rows={rows} className="mt-7" />}
      {children}
      <div className="mt-auto flex flex-col gap-2.5 pt-8">
        {primary && <BigButton onClick={primary.onClick}>{primary.label}</BigButton>}
        {secondary && <BigButton variant="soft" onClick={secondary.onClick}>{secondary.label}</BigButton>}
      </div>
    </div>
  );
}

/* ── Keypad & AmountDisplay ───────────────────────────────────────────────
 * La saisie d'un montant, façon Wave : le chiffre en 56 au centre, le gros
 * clavier en bas. `applyKey` tient la règle (entier, ou décimales bornées). */
export function Keypad({ onKey, decimals = 0, className }: { onKey: (k: PadKey) => void; decimals?: number; className?: string }) {
  const keys: PadKey[] = ['1', '2', '3', '4', '5', '6', '7', '8', '9', ',', '0', 'back'];
  return (
    <div className={cn('grid grid-cols-3 gap-y-1.5 px-6', className)}>
      {keys.map((k) => {
        const off = k === ',' && decimals === 0;
        return (
          <button
            key={k}
            type="button"
            disabled={off}
            onClick={() => onKey(k)}
            aria-label={k === 'back' ? 'Effacer' : k === ',' ? 'Virgule' : k}
            className={cn('flex h-[58px] items-center justify-center rounded-lg text-[28px] font-medium active:bg-[#F5F5F5] disabled:opacity-0 dark:active:bg-[#383838]', FOCUS_RING, TEXT.strong)}
          >
            {k === 'back' ? <Delete className="h-7 w-7" strokeWidth={2} /> : k}
          </button>
        );
      })}
    </div>
  );
}

export function AmountDisplay({
  value, prefix, suffix, units, unit, onUnit, conversion, note, className,
}: {
  /** Le texte déjà formaté (formatPad). */
  value: string;
  /** « ¥ » devant le chiffre. */
  prefix?: string;
  /** « XAF » après le chiffre. */
  suffix?: string;
  /** Le choix d'unité sous le chiffre (« ¥ RMB » / « XAF »). */
  units?: ReadonlyArray<{ value: string; label: React.ReactNode }>;
  unit?: string;
  onUnit?: (u: string) => void;
  /** « = 691 364 XAF » */
  conversion?: React.ReactNode;
  /** « Taux du jour · … » */
  note?: React.ReactNode;
  className?: string;
}) {
  const len = value.length + (prefix?.length ?? 0) + (suffix ? suffix.length / 2 : 0);
  const size = len > 11 ? 'text-[38px]' : len > 8 ? 'text-[46px]' : 'text-[56px]';
  return (
    <div className={cn('px-5 pt-[34px] text-center', className)}>
      <div className={cn('font-bold leading-none tracking-[-0.03em] tabular-nums', size, TEXT.strong)}>
        {prefix && <span className="mr-2">{prefix}</span>}
        {value}
        {suffix && <span className={cn('ml-2 text-[24px] font-semibold tracking-normal', TEXT.muted)}>{suffix}</span>}
      </div>
      {units && units.length > 1 && (
        <div className={cn('mt-[18px] inline-flex overflow-hidden rounded-lg border', SURFACE.divider)}>
          {units.map((u) => (
            <button
              key={u.value}
              type="button"
              onClick={() => onUnit?.(u.value)}
              className={cn('px-[18px] py-2 text-[16px] font-semibold', FOCUS_RING, u.value === unit ? 'bg-[#2C2C2C] text-[#F5F5F5] dark:bg-[#E3E3E3] dark:text-[#1E1E1E]' : TEXT.strong)}
            >
              {u.label}
            </button>
          ))}
        </div>
      )}
      {conversion != null && <div className={cn('mt-4 text-[17px] font-medium', TEXT.body)}>{conversion}</div>}
      {note != null && <div className={cn('mt-1.5 text-[15px]', TEXT.muted)}>{note}</div>}
    </div>
  );
}

/* ── WhoCard ──────────────────────────────────────────────────────────────
 * Le rappel « pour qui » en tête d'une saisie : rond, nom, une ligne. */
export function WhoCard({
  leading, name, line, onClick, className,
}: {
  leading: React.ReactNode;
  name: React.ReactNode;
  line?: React.ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  const Wrapper = onClick ? 'button' : 'div';
  return (
    <Wrapper
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={cn('flex w-full items-center gap-3 rounded-lg border px-3.5 py-3 text-left', SURFACE.divider, onClick && 'active:bg-[#F5F5F5] dark:active:bg-[#383838]', className)}
    >
      {leading}
      <span className="min-w-0 flex-1">
        <span className={cn('block truncate text-[17px] font-semibold', TEXT.strong)}>{name}</span>
        {line != null && <span className={cn('block truncate text-[15px]', TEXT.muted)}>{line}</span>}
      </span>
      {onClick && <ChevronRight className={cn('h-5 w-5 shrink-0', TEXT.muted)} />}
    </Wrapper>
  );
}

/* ── ModuleGrid ───────────────────────────────────────────────────────────
 * La grille de « Plus » : des ronds de 64 sur 3 colonnes, sans description. */
export interface ModuleTile {
  key: string;
  label: React.ReactNode;
  icon?: React.ElementType;
  visual?: React.ReactNode;
  onClick: () => void;
  badge?: number;
}

export function ModuleGrid({ tiles, className }: { tiles: ModuleTile[]; className?: string }) {
  return (
    <div className={cn('grid grid-cols-3 gap-x-2 gap-y-6 px-4', className)}>
      {tiles.map((t) => {
        const Icon = t.icon;
        return (
          <button key={t.key} type="button" onClick={t.onClick} className={cn('flex min-w-0 flex-col items-center gap-2.5 rounded-lg py-1 text-center', FOCUS_RING)}>
            <span className="relative">
              <span className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-[#F5F5F5] text-[#1E1E1E] active:bg-[#E6E6E6] dark:bg-[#383838] dark:text-[#F5F5F5]">
                {t.visual ?? (Icon && <Icon className="h-7 w-7" strokeWidth={2} />)}
              </span>
              {t.badge != null && t.badge > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-[22px] min-w-[22px] items-center justify-center rounded-full border-2 border-white bg-[#EC221F] px-1 text-[12px] font-bold leading-none text-white dark:border-[#1E1E1E]">
                  {t.badge > 99 ? '99+' : t.badge}
                </span>
              )}
            </span>
            <span className={cn('max-w-full text-[15px] font-semibold leading-[1.2]', TEXT.strong)}>{t.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/** Un rond neutre (icône) au format des lignes : 44 px. */
export function IconCircle({ icon, tone = 'neutral', size = 'md' }: { icon: React.ElementType; tone?: Tone; size?: 'sm' | 'md' | 'lg' }) {
  return <Holder icon={icon} tone={tone} size={size} className="border-0" />;
}

/** Un message vide, sobre : une phrase, éventuellement une action. */
export function EmptyLine({ children, action }: { children: React.ReactNode; action?: { label: React.ReactNode; onClick: () => void } }) {
  return (
    <div className="px-5 py-10 text-center">
      <p className={cn('text-[16px]', TEXT.muted)}>{children}</p>
      {action && (
        <button type="button" onClick={action.onClick} className={cn('mt-3 rounded text-[16px] font-semibold underline underline-offset-[3px]', FOCUS_RING, TEXT.strong)}>
          {action.label}
        </button>
      )}
    </div>
  );
}
