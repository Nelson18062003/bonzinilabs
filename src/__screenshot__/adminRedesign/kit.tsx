/**
 * ADMIN DESKTOP REDESIGN — mockup helpers, V2.
 *
 * V1 invented its own desktop atoms and was rightly rejected: it no longer
 * looked like the product. V2 changes the STRUCTURE only (workbench → split
 * detail → one-page create) and composes it from the app's REAL vocabulary:
 *   · chrome  = the actual DesktopAppShell (real logo, sidebar, topbar)
 *   · atoms   = @/mobile/designKit verbatim (Card, pills, StatusPill,
 *               TextInput, Amount, tones) + PaymentMethodLogo + MIcon
 * Nothing visual is re-invented here — only arranged.
 */
import * as React from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, ChevronsUpDown, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DesktopAppShell } from '@/desktop/components/layout/DesktopAppShell';
import {
  SURFACE,
  TEXT,
  PRIMARY_PILL,
  SOFT_PILL,
  Holder,
  TextInput,
} from '@/mobile/designKit';

export { DesktopAppShell as Shell };

/* ── Familles de méthode dépôt — identiques aux écrans réels ────────────── */

export const FAMILIES_CONF: Record<string, { letter: string; bg: string; dark?: boolean }> = {
  BANK: { letter: 'B', bg: '#1e3a5f' },
  AGENCY_BONZINI: { letter: 'A', bg: '#A947FE' },
  ORANGE_MONEY: { letter: 'O', bg: '#ff6600' },
  MTN_MONEY: { letter: 'M', bg: '#ffcb05', dark: true },
  WAVE: { letter: 'W', bg: '#1dc3e3' },
};

export function MIcon({ family, size = 28 }: { family: string; size?: number }) {
  const f = FAMILIES_CONF[family];
  if (!f) return null;
  return (
    <div
      className="flex shrink-0 items-center justify-center font-black"
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.3),
        background: f.bg,
        fontSize: Math.round(size * 0.38),
        color: f.dark ? '#1a1028' : '#fff',
      }}
    >
      {f.letter}
    </div>
  );
}

/* ── Âge SLA — le SlaDot existant, promu en colonne lisible ─────────────── */

export function Age({ abs, rel, level, relOnly }: { abs: string; rel: string; level?: 'fresh' | 'aging' | 'overdue' | null; relOnly?: boolean }) {
  const color =
    level === 'overdue'
      ? 'text-[#ef4444] font-bold'
      : level === 'aging'
        ? 'text-[#B47A17] font-bold dark:text-[#E7C083]'
        : level === 'fresh'
          ? 'text-[#2E7D52] font-bold dark:text-[#7FCBA0]'
          : cn(TEXT.muted, 'font-medium');
  return (
    <div className="leading-[16px]">
      <div className={cn('text-[12px] tabular-nums', color)}>{rel}</div>
      {!relOnly && <div className={cn('text-[11px] tabular-nums', TEXT.muted)}>{abs}</div>}
    </div>
  );
}

/* ── Puce-filtre à compteur — copie du rendu STATUS_CHIPS des écrans réels ─ */

export function Chip({ label, count, active }: { label: React.ReactNode; count?: number | string; active?: boolean }) {
  return (
    <button
      type="button"
      className={cn(
        'flex h-9 items-center gap-1.5 rounded-full px-3.5 text-[12px] font-semibold transition-colors',
        active ? PRIMARY_PILL : SOFT_PILL,
      )}
    >
      {label}
      {count != null && (
        <span
          className={cn(
            'rounded-full px-1.5 py-px text-[9px] font-extrabold tabular-nums',
            active ? 'bg-white/20 text-white dark:bg-black/15 dark:text-[#1B1A24]' : 'bg-black/[0.06] dark:bg-white/10',
          )}
        >
          {count}
        </span>
      )}
    </button>
  );
}

/** Puce façon menu déroulant (Méthode / Période) — même langage. */
export function DropChip({ label, value }: { label: string; value: string }) {
  return (
    <button type="button" className={cn('flex h-9 items-center gap-1.5 rounded-full px-3.5 text-[12px] font-semibold', SOFT_PILL)}>
      <span className="opacity-70">{label}</span>
      <span className="font-bold">{value}</span>
      <ChevronDown className="h-3.5 w-3.5 opacity-70" />
    </button>
  );
}

/* ── Recherche — le TextInput du kit, tel quel ──────────────────────────── */

export function SearchField({ placeholder, className }: { placeholder: string; className?: string }) {
  return (
    <div className={cn('relative', className)}>
      <Search className={cn('pointer-events-none absolute left-3.5 top-1/2 z-10 h-4 w-4 -translate-y-1/2', TEXT.muted)} />
      <TextInput placeholder={placeholder} readOnly className="h-9 rounded-full pl-9 text-[13px]" />
    </div>
  );
}

/** En-tête de carte — l'anatomie unique de toutes les cartes de contenu :
 *  titre 13px gras à gauche, méta 12px sourde à droite, liseré dessous. */
export function CardHeader({ title, meta }: { title: React.ReactNode; meta?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-black/[0.06] px-5 py-2.5 dark:border-white/[0.06]">
      <span className={cn('text-[13px] font-bold', TEXT.strong)}>{title}</span>
      {meta && <span className={cn('text-[12px] tabular-nums', TEXT.muted)}>{meta}</span>}
    </div>
  );
}

/** Étiquette de section — LE style unique des sections de panneau/formulaire. */
export function SecLabel({ children, right, className }: { children: React.ReactNode; right?: React.ReactNode; className?: string }) {
  return (
    <div className={cn('flex items-center justify-between gap-3', className)}>
      <span className={cn('text-[11px] font-bold uppercase tracking-wider', TEXT.muted)}>{children}</span>
      {right}
    </div>
  );
}

/* ── Table — typo/espacements des tables desktop réelles + tri visible ──── */

export function Th({
  children,
  align = 'left',
  sortable,
  sorted,
  className,
  first,
  last,
}: {
  children?: React.ReactNode;
  align?: 'left' | 'right';
  sortable?: boolean;
  sorted?: 'asc' | 'desc';
  className?: string;
  first?: boolean;
  last?: boolean;
}) {
  return (
    <th scope="col" className={cn('whitespace-nowrap py-3', first ? 'pl-5 pr-2' : last ? 'pl-2 pr-5' : 'px-2', align === 'right' ? 'text-right' : 'text-left', className)}>
      <span className={cn('inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider', sorted ? TEXT.strong : TEXT.muted)}>
        {children}
        {sorted ? (
          <ChevronDown className={cn('h-3 w-3', sorted === 'asc' && 'rotate-180')} />
        ) : (
          sortable && <ChevronsUpDown className="h-3 w-3 opacity-50" />
        )}
      </span>
    </th>
  );
}

export function Td({ children, align = 'left', className, first, last }: { children?: React.ReactNode; align?: 'left' | 'right'; className?: string; first?: boolean; last?: boolean }) {
  return (
    <td className={cn('whitespace-nowrap border-t border-black/[0.05] py-3 dark:border-white/[0.05]', first ? 'pl-5 pr-2' : last ? 'pl-2 pr-5' : 'px-2', align === 'right' && 'text-right', className)}>
      {children}
    </td>
  );
}

/** Pagination — mini-pilules du kit à la place du scroll infini. */
export function PaginationBar({ range, total, page, pages }: { range: string; total: string; page: number; pages: number }) {
  return (
    <div className="flex items-center justify-between border-t border-black/[0.05] px-5 py-2.5 dark:border-white/[0.05]">
      <span className={cn('text-[12px] tabular-nums', TEXT.muted)}>
        {range} sur <span className={cn('font-bold', TEXT.strong)}>{total}</span>
      </span>
      <div className="flex items-center gap-1.5">
        <button type="button" className={cn('flex h-7 w-7 items-center justify-center rounded-full', SOFT_PILL)} aria-label="Page précédente">
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>
        {Array.from({ length: Math.min(pages, 3) }, (_, i) => i + 1).map((n) => (
          <button key={n} type="button" className={cn('h-7 min-w-7 rounded-full px-2 text-[12px] font-bold tabular-nums', n === page ? PRIMARY_PILL : SOFT_PILL)}>
            {n}
          </button>
        ))}
        {pages > 3 && (
          <>
            <span className={cn('px-0.5 text-[12px]', TEXT.muted)}>…</span>
            <button type="button" className={cn('h-7 rounded-full px-2 text-[12px] font-bold tabular-nums', SOFT_PILL)}>{pages}</button>
          </>
        )}
        <button type="button" className={cn('flex h-7 w-7 items-center justify-center rounded-full', SOFT_PILL)} aria-label="Page suivante">
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

/* ── Référence — le « holder chip » mono des tables réelles, sans retour ── */

export function RefChip({ children }: { children: React.ReactNode }) {
  return (
    <span className={cn('whitespace-nowrap rounded-lg px-2 py-1 font-mono text-[12px] font-bold', SURFACE.holder)}>
      {children}
    </span>
  );
}

/* ── Dialogue centré — l'anatomie du BottomSheet du kit, ancrée au centre ─ */

export function Dialog({ title, children, footer, width = 520 }: { title: React.ReactNode; children: React.ReactNode; footer: React.ReactNode; width?: number }) {
  return (
    <div className="absolute inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div
        className={cn('overflow-hidden rounded-[28px] p-5', SURFACE.card, 'ring-1 ring-black/[0.08] dark:ring-white/[0.08]')}
        style={{ width }}
        role="dialog"
        aria-modal="true"
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className={cn('text-[17px] font-bold', TEXT.strong)}>{title}</h2>
          <Holder icon={X} size="sm" onClick={() => {}} ariaLabel="Fermer" />
        </div>
        {children}
        <div className="mt-4 flex gap-2">{footer}</div>
      </div>
    </div>
  );
}

/* ── Faux visuels de contenu (preuve SMS, QR) — données, pas design ─────── */

export function FakeProofSms({ amount, reference, className }: { amount: string; reference: string; className?: string }) {
  return (
    <div className={cn('overflow-hidden rounded-2xl bg-[#F4F4F2] text-[#26251F] ring-1 ring-black/[0.08] dark:ring-white/[0.10]', className)}>
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

export function FakeQR({ size = 120, color = '#1677FF' }: { size?: number; color?: string }) {
  const cells: React.ReactNode[] = [];
  let seed = 7;
  for (let y = 0; y < 15; y++) {
    for (let x = 0; x < 15; x++) {
      seed = (seed * 31 + x * 7 + y * 13) % 97;
      const corner = (x < 4 && y < 4) || (x > 10 && y < 4) || (x < 4 && y > 10);
      if (!corner && seed % 2 === 0) cells.push(<rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} />);
    }
  }
  return (
    <svg width={size} height={size} viewBox="0 0 15 15" className="rounded-2xl bg-white p-[6%] ring-1 ring-black/[0.08]" style={{ fill: '#111' }}>
      {cells}
      <rect x={0} y={0} width={4} height={1} /><rect x={0} y={3} width={4} height={1} /><rect x={0} y={0} width={1} height={4} /><rect x={3} y={0} width={1} height={4} />
      <rect x={11} y={0} width={4} height={1} /><rect x={11} y={3} width={4} height={1} /><rect x={11} y={0} width={1} height={4} /><rect x={14} y={0} width={1} height={4} />
      <rect x={0} y={11} width={4} height={1} /><rect x={0} y={14} width={4} height={1} /><rect x={0} y={11} width={1} height={4} /><rect x={3} y={11} width={1} height={4} />
      <rect x={6.5} y={6.5} width={2} height={2} style={{ fill: color }} />
    </svg>
  );
}
