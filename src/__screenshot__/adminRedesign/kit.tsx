/**
 * ADMIN DESKTOP REDESIGN — mockup kit (Phase 3).
 *
 * Renders the token contract of docs/admin-redesign/02-foundation.md as real
 * components, for the screenshot harness only. Same brand language as the
 * mobile design kit (Ofspace/Mola: lilac canvas, white surfaces, soft shadow,
 * one dark primary, semantic tones) re-derived with desktop grammar:
 * 4px grid · radii 6/10/14 · control heights 28/32/36 · type scale
 * 11/12/13/14/16/20/28 · tabular numerals · hairline table dividers ·
 * centered dialogs (no bottom sheets) · hover states instead of press scale.
 *
 * Purely presentational, zero hooks/network — the implementation kit will live
 * in src/desktop/designKit and reuse these exact class recipes.
 */
import * as React from 'react';
import {
  Bell,
  Search,
  ChevronDown,
  ChevronsUpDown,
  ChevronLeft,
  ChevronRight,
  LayoutDashboard,
  Bot,
  ArrowDownToLine,
  ArrowUpFromLine,
  Users,
  Landmark,
  Percent,
  LifeBuoy,
  Shield,
  ScrollText,
  Settings,
  LayoutGrid,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';

/* ── Tokens ─────────────────────────────────────────────────────────────── */

export const D = {
  canvas: 'bg-[#ECEAF7] dark:bg-[#141320]',
  surface: 'bg-white dark:bg-[#211F2B]',
  surface2: 'bg-[#F6F5FB] dark:bg-[#2A2836]',
  hairline: 'border-[#141029]/[0.07] dark:border-white/[0.07]',
  strong: 'text-[#1B1A24] dark:text-[#F2F1F7]',
  body: 'text-[#4A475C] dark:text-[#C9C6D6]',
  muted: 'text-[#8E8BA0] dark:text-[#9B98AD]',
  accent: 'text-[#6B5BD2] dark:text-[#A99BF0]',
  eCard: 'shadow-[0_1px_2px_rgba(46,32,92,0.05),0_8px_24px_-16px_rgba(46,32,92,0.18)] dark:shadow-none dark:ring-1 dark:ring-white/[0.06]',
  ePop: 'shadow-[0_4px_12px_rgba(46,32,92,0.08),0_24px_48px_-24px_rgba(46,32,92,0.28)] dark:shadow-none dark:ring-1 dark:ring-white/[0.10]',
  mono: 'font-mono tracking-[-0.01em]',
} as const;

export type Tone = 'success' | 'pending' | 'danger' | 'info' | 'neutral';

const TONE: Record<Tone, string> = {
  success: 'bg-[#DEEFE5] text-[#2E7D52] dark:bg-[#1E3A2C] dark:text-[#7FCBA0]',
  pending: 'bg-[#F8EFD8] text-[#9A6B12] dark:bg-[#372D14] dark:text-[#E7C083]',
  danger: 'bg-[#FBE7E7] text-[#C0504D] dark:bg-[#3A2526] dark:text-[#E79A9A]',
  info: 'bg-[#EAE7FA] text-[#5B4CC4] dark:bg-[#272252] dark:text-[#B5AAF0]',
  neutral: 'bg-[#EDEAFA] text-[#2C2740] dark:bg-[#2F2C3D] dark:text-[#E7E5F0]',
};

/* ── Micro components ───────────────────────────────────────────────────── */

export function SectionLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('text-[11px] font-semibold uppercase tracking-[0.06em]', D.muted, className)}>
      {children}
    </div>
  );
}

export function StatusPill({ tone, label }: { tone: Tone; label: React.ReactNode }) {
  return (
    <span className={cn('inline-flex h-[22px] shrink-0 items-center whitespace-nowrap rounded-full px-2.5 text-[11px] font-bold', TONE[tone])}>
      {label}
    </span>
  );
}

/** SLA-tinted age: relative age colored by freshness, absolute date muted. */
export function Age({ abs, rel, level, relOnly }: { abs: string; rel: string; level?: 'fresh' | 'aging' | 'overdue' | null; relOnly?: boolean }) {
  const color =
    level === 'overdue'
      ? 'text-[#C0504D] dark:text-[#E79A9A] font-bold'
      : level === 'aging'
        ? 'text-[#9A6B12] dark:text-[#E7C083] font-semibold'
        : level === 'fresh'
          ? 'text-[#2E7D52] dark:text-[#7FCBA0] font-semibold'
          : cn(D.muted, 'font-medium');
  return (
    <div className="leading-[16px]">
      <div className={cn('text-[12px] tabular-nums', color)}>{rel}</div>
      {!relOnly && <div className={cn('text-[11px] tabular-nums', D.muted)}>{abs}</div>}
    </div>
  );
}

/** Small square method brand mark (16–20px). */
export function MethodMark({ label, bg, dark, size = 18 }: { label: string; bg: string; dark?: boolean; size?: number }) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-[5px] font-black"
      style={{ width: size, height: size, background: bg, color: dark ? '#1a1028' : '#fff', fontSize: Math.round(size * 0.55) }}
    >
      {label}
    </span>
  );
}

/* ── Buttons ────────────────────────────────────────────────────────────── */

export function Btn({
  children,
  variant = 'secondary',
  size = 'md',
  className,
  color,
}: {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  /** Override background for module-accent primaries. */
  color?: string;
}) {
  const h = size === 'sm' ? 'h-7 px-2.5 text-[12px]' : size === 'lg' ? 'h-9 px-4 text-[14px]' : 'h-8 px-3 text-[13px]';
  const v =
    variant === 'primary'
      ? 'bg-[#1C1B22] text-white dark:bg-[#F2F1F7] dark:text-[#1B1A24] font-bold'
      : variant === 'danger'
        ? 'bg-[#FBE7E7] text-[#C0504D] dark:bg-[#3A2526] dark:text-[#E79A9A] font-bold'
        : variant === 'success'
          ? 'bg-[#10B981] text-white font-bold'
          : variant === 'ghost'
            ? cn('bg-transparent font-semibold', D.body, 'hover:bg-black/[0.04] dark:hover:bg-white/[0.06]')
            : cn(D.surface2, D.strong, 'font-semibold ring-1 ring-inset ring-[#141029]/[0.06] dark:ring-white/[0.07]');
  return (
    <button type="button" className={cn('inline-flex shrink-0 items-center justify-center gap-1.5 rounded-[8px] transition-colors', h, v, className)} style={color ? { background: color, color: '#fff' } : undefined}>
      {children}
    </button>
  );
}

export function IconBtn({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <button type="button" className={cn('inline-flex h-8 w-8 items-center justify-center rounded-[8px] transition-colors hover:bg-black/[0.05] dark:hover:bg-white/[0.07]', D.muted, className)}>
      {children}
    </button>
  );
}

/* ── Filter bar controls (32px) ─────────────────────────────────────────── */

export function SearchField({ placeholder, wide }: { placeholder: string; wide?: boolean }) {
  return (
    <div className={cn('relative', wide ? 'w-[300px]' : 'w-[240px]')}>
      <Search className={cn('pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2', D.muted)} />
      <div className={cn('flex h-8 items-center rounded-[8px] pl-8 pr-2 text-[13px]', D.surface, 'ring-1 ring-inset ring-[#141029]/[0.08] dark:ring-white/[0.08]', D.muted)}>
        {placeholder}
      </div>
    </div>
  );
}

export function Select({ label, value }: { label: string; value: string }) {
  return (
    <button type="button" className={cn('inline-flex h-8 items-center gap-1.5 rounded-[8px] px-2.5 text-[13px] font-semibold', D.surface2, 'ring-1 ring-inset ring-[#141029]/[0.06] dark:ring-white/[0.07]')}>
      <span className={cn('font-medium', D.muted)}>{label}</span>
      <span className={D.strong}>{value}</span>
      <ChevronDown className={cn('h-3.5 w-3.5', D.muted)} />
    </button>
  );
}

/** Queue strip — actionable buckets as segmented tabs with counts. */
export function QueueTabs({
  tabs,
}: {
  tabs: { label: string; count?: number | string; active?: boolean; tone?: Tone }[];
}) {
  return (
    <div className={cn('inline-flex h-9 items-center gap-0.5 rounded-[10px] p-1', D.surface, D.eCard)}>
      {tabs.map((t) => (
        <button
          key={t.label}
          type="button"
          className={cn(
            'inline-flex h-7 items-center gap-1.5 rounded-[7px] px-3 text-[13px] transition-colors',
            t.active ? 'bg-[#1C1B22] font-bold text-white dark:bg-[#F2F1F7] dark:text-[#1B1A24]' : cn('font-semibold', D.body, 'hover:bg-black/[0.04] dark:hover:bg-white/[0.06]'),
          )}
        >
          {t.label}
          {t.count != null && (
            <span
              className={cn(
                'rounded-full px-1.5 py-px text-[10.5px] font-extrabold tabular-nums',
                t.active ? 'bg-white/20 dark:bg-black/15' : t.tone ? TONE[t.tone] : cn(D.surface2, D.muted),
              )}
            >
              {t.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

/* ── Table primitives ───────────────────────────────────────────────────── */

export function Th({
  children,
  align = 'left',
  sortable,
  sorted,
  className,
}: {
  children?: React.ReactNode;
  align?: 'left' | 'right';
  sortable?: boolean;
  sorted?: 'asc' | 'desc';
  className?: string;
}) {
  return (
    <th scope="col" className={cn('h-9 whitespace-nowrap px-3 first:pl-4 last:pr-4', align === 'right' ? 'text-right' : 'text-left', className)}>
      <span className={cn('inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.06em]', sorted ? D.strong : D.muted)}>
        {align === 'right' && sortable && !sorted && <ChevronsUpDown className="h-3 w-3 opacity-60" />}
        {children}
        {sorted ? (
          <ChevronDown className={cn('h-3 w-3', sorted === 'asc' && 'rotate-180')} />
        ) : (
          sortable && align === 'left' && <ChevronsUpDown className="h-3 w-3 opacity-60" />
        )}
      </span>
    </th>
  );
}

export function Td({ children, align = 'left', className }: { children?: React.ReactNode; align?: 'left' | 'right'; className?: string }) {
  return (
    <td className={cn('h-10 whitespace-nowrap px-3 text-[13px] first:pl-4 last:pr-4', align === 'right' && 'text-right', className)}>
      {children}
    </td>
  );
}

export function PaginationBar({ range, total, page, pages }: { range: string; total: string; page: number; pages: number }) {
  return (
    <div className={cn('flex h-11 items-center justify-between border-t px-4', D.hairline)}>
      <span className={cn('text-[12px] tabular-nums', D.muted)}>
        {range} sur <span className={cn('font-semibold', D.body)}>{total}</span>
      </span>
      <div className="flex items-center gap-1">
        <IconBtn className="h-7 w-7"><ChevronLeft className="h-4 w-4" /></IconBtn>
        {Array.from({ length: Math.min(pages, 4) }, (_, i) => i + 1).map((n) => (
          <button
            key={n}
            type="button"
            className={cn(
              'h-7 min-w-7 rounded-[7px] px-1.5 text-[12px] font-bold tabular-nums',
              n === page ? 'bg-[#1C1B22] text-white dark:bg-[#F2F1F7] dark:text-[#1B1A24]' : cn(D.muted, 'hover:bg-black/[0.04] dark:hover:bg-white/[0.06]'),
            )}
          >
            {n}
          </button>
        ))}
        <span className={cn('px-1 text-[12px]', D.muted)}>…</span>
        <button type="button" className={cn('h-7 min-w-7 rounded-[7px] px-1.5 text-[12px] font-bold tabular-nums', D.muted)}>{pages}</button>
        <IconBtn className="h-7 w-7"><ChevronRight className="h-4 w-4" /></IconBtn>
      </div>
    </div>
  );
}

/* ── Key/value facts grid ───────────────────────────────────────────────── */

export function KV({ k, v, mono, className }: { k: string; v: React.ReactNode; mono?: boolean; className?: string }) {
  return (
    <div className={cn('min-w-0', className)}>
      <div className={cn('text-[11px] font-semibold uppercase tracking-[0.05em]', D.muted)}>{k}</div>
      <div className={cn('mt-0.5 truncate text-[13px] font-semibold tabular-nums', D.strong, mono && cn(D.mono, 'text-[12.5px]'))}>{v}</div>
    </div>
  );
}

/* ── Dialog scaffold (centered — replaces mobile bottom-sheets) ─────────── */

export function Dialog({ title, children, footer, width = 440 }: { title: React.ReactNode; children: React.ReactNode; footer: React.ReactNode; width?: number }) {
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-[#141029]/30 backdrop-blur-[2px] dark:bg-black/50">
      <div className={cn('overflow-hidden rounded-[14px]', D.surface, D.ePop)} style={{ width }}>
        <div className={cn('flex items-center justify-between border-b px-5 py-3.5', D.hairline)}>
          <h2 className={cn('text-[16px] font-bold', D.strong)}>{title}</h2>
          <IconBtn><X className="h-4 w-4" /></IconBtn>
        </div>
        <div className="px-5 py-4">{children}</div>
        <div className={cn('flex items-center justify-end gap-2 border-t px-5 py-3', D.hairline, D.surface2)}>{footer}</div>
      </div>
    </div>
  );
}

/* ── App shell (sidebar + topbar), density-corrected ────────────────────── */

const NAV: { group: string; items: { label: string; icon: React.ElementType; badge?: number; active?: boolean }[] }[] = [
  {
    group: 'Principal',
    items: [
      { label: 'Tableau de bord', icon: LayoutDashboard },
      { label: 'Mola', icon: Bot },
      { label: 'Dépôts', icon: ArrowDownToLine, badge: 7 },
      { label: 'Paiements', icon: ArrowUpFromLine, badge: 5 },
      { label: 'Clients', icon: Users },
    ],
  },
  {
    group: 'Opérations',
    items: [
      { label: 'Trésorerie', icon: Landmark },
      { label: 'Taux de change', icon: Percent },
      { label: 'Support', icon: LifeBuoy },
    ],
  },
  {
    group: 'Système',
    items: [
      { label: 'Administrateurs', icon: Shield },
      { label: 'Journaux', icon: ScrollText },
      { label: 'Paramètres', icon: Settings },
      { label: 'Tous les outils', icon: LayoutGrid },
    ],
  },
];

export function Shell({ active, title, children }: { active: 'Dépôts' | 'Paiements'; title: string; children: React.ReactNode }) {
  return (
    <div className={cn('flex h-screen w-full overflow-hidden font-sans', D.canvas)}>
      {/* Sidebar */}
      <aside className={cn('flex w-[232px] shrink-0 flex-col border-r', D.surface, D.hairline)}>
        <div className="flex items-center gap-2.5 px-4 pb-3 pt-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-[9px] bg-gradient-to-br from-[#7C3AED] via-[#B45FF0] to-[#FF7A3D] text-[15px] font-black text-white">B</div>
          <div className="leading-tight">
            <p className={cn('text-[13.5px] font-extrabold', D.strong)}>Bonzini</p>
            <p className={cn('text-[11px] font-medium', D.muted)}>Console admin</p>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto px-2.5 pb-3">
          {NAV.map((g) => (
            <div key={g.group}>
              <SectionLabel className="px-2.5 pb-1 pt-4 opacity-80">{g.group}</SectionLabel>
              {g.items.map((it) => {
                const isActive = it.label === active;
                const Icon = it.icon;
                return (
                  <div
                    key={it.label}
                    className={cn(
                      'mb-px flex h-8 items-center gap-2.5 rounded-[8px] px-2.5 text-[13px]',
                      isActive
                        ? 'bg-[#1C1B22] font-bold text-white dark:bg-[#F2F1F7] dark:text-[#1B1A24]'
                        : cn('font-medium', D.body, 'hover:bg-[#EDEAFA]/70 dark:hover:bg-white/[0.06]'),
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="flex-1 truncate">{it.label}</span>
                    {it.badge != null && (
                      <span className={cn('flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[10.5px] font-extrabold tabular-nums', isActive ? 'bg-white/20 dark:bg-black/15' : 'bg-[#FE560D] text-white')}>
                        {it.badge}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </nav>
        <div className={cn('flex items-center gap-2.5 border-t px-4 py-3', D.hairline)}>
          <div className={cn('flex h-8 w-8 items-center justify-center rounded-full text-[11.5px] font-bold', TONE.neutral)}>NE</div>
          <div className="min-w-0 flex-1 leading-tight">
            <p className={cn('truncate text-[12.5px] font-bold', D.strong)}>Nelson E.</p>
            <p className={cn('truncate text-[11px]', D.muted)}>Super admin</p>
          </div>
        </div>
      </aside>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className={cn('flex h-[52px] shrink-0 items-center gap-3 border-b px-6', D.hairline)}>
          <span className={cn('text-[13px] font-semibold', D.body)}>{title}</span>
          <span className={cn('text-[12px]', D.muted)}>· Mercredi 19 août 2026</span>
          <div className="ml-auto flex items-center gap-2.5">
            <div className={cn('flex h-8 w-[260px] items-center gap-2 rounded-[8px] px-2.5', D.surface, 'ring-1 ring-inset ring-[#141029]/[0.08] dark:ring-white/[0.08]')}>
              <Search className={cn('h-3.5 w-3.5', D.muted)} />
              <span className={cn('flex-1 text-[12.5px]', D.muted)}>Rechercher…</span>
              <kbd className={cn('rounded-[5px] px-1.5 py-0.5 text-[10.5px] font-semibold', D.surface2, D.muted)}>⌘K</kbd>
            </div>
            <div className={cn('flex h-8 items-center gap-1.5 rounded-[8px] px-2.5 text-[12px] font-bold tabular-nums', D.surface, 'ring-1 ring-inset ring-[#141029]/[0.08] dark:ring-white/[0.08]', D.strong)}>
              <span className="h-1.5 w-1.5 rounded-full bg-[#10B981]" />
              1M XAF = ¥11 530
            </div>
            <IconBtn>
              <span className="relative">
                <Bell className="h-4 w-4" />
                <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-[#FE560D]" />
              </span>
            </IconBtn>
          </div>
        </header>
        <main className="relative min-h-0 flex-1 overflow-hidden">{children}</main>
      </div>
    </div>
  );
}

/* ── Fake proof visuals (self-contained, no assets) ─────────────────────── */

/** A believable mobile-money SMS receipt, drawn with divs. */
export function FakeProofSms({ amount, reference, className }: { amount: string; reference: string; className?: string }) {
  return (
    <div className={cn('overflow-hidden rounded-[10px] bg-[#F4F4F2] text-[#26251F] ring-1 ring-black/[0.08] dark:ring-white/[0.10]', className)}>
      <div className="flex items-center gap-2 bg-[#FF6600] px-3 py-1.5 text-white">
        <span className="text-[11px] font-black tracking-wide">Orange Money</span>
        <span className="ml-auto text-[10px] font-semibold opacity-80">14:26</span>
      </div>
      <div className="space-y-1 px-3 py-2.5 text-[11px] leading-[15px]">
        <p className="font-semibold">Transfert reussi.</p>
        <p>
          Vous avez envoye <b className="tabular-nums">{amount} FCFA</b> au 655 88 12 40 (BONZINI LABS SARL).
        </p>
        <p className="tabular-nums">Frais: 0 FCFA. Nouveau solde: 213 450 FCFA.</p>
        <p className="tabular-nums text-[#6b6a63]">ID Trans: MP260819.1426.C77812 — Ref {reference}</p>
      </div>
    </div>
  );
}

/** Tiny deterministic fake QR (SVG grid). */
export function FakeQR({ size = 120, color = '#1677FF' }: { size?: number; color?: string }) {
  const cells: React.ReactNode[] = [];
  let seed = 7;
  for (let y = 0; y < 15; y++) {
    for (let x = 0; x < 15; x++) {
      seed = (seed * 31 + x * 7 + y * 13) % 97;
      const corner = (x < 4 && y < 4) || (x > 10 && y < 4) || (x < 4 && y > 10);
      if (corner ? !((x === 1 || x === 2) && (y === 1 || y === 2)) === false || (x % 3 === 0 && y % 3 === 0) : seed % 2 === 0) {
        cells.push(<rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} />);
      }
    }
  }
  return (
    <svg width={size} height={size} viewBox="0 0 15 15" className="rounded-[8px] bg-white p-[6%] ring-1 ring-black/[0.08]" style={{ fill: '#111' }}>
      {cells}
      <rect x={0} y={0} width={4} height={1} /><rect x={0} y={3} width={4} height={1} /><rect x={0} y={0} width={1} height={4} /><rect x={3} y={0} width={1} height={4} />
      <rect x={11} y={0} width={4} height={1} /><rect x={11} y={3} width={4} height={1} /><rect x={11} y={0} width={1} height={4} /><rect x={14} y={0} width={1} height={4} />
      <rect x={0} y={11} width={4} height={1} /><rect x={0} y={14} width={4} height={1} /><rect x={0} y={11} width={1} height={4} /><rect x={3} y={11} width={1} height={4} />
      <rect x={6.5} y={6.5} width={2} height={2} style={{ fill: color }} />
    </svg>
  );
}
