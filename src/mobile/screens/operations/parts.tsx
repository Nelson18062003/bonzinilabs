/**
 * Opérations v2 — les briques propres au module (dépôts, paiements, agent
 * cash, justificatifs, journal), sur les mêmes jetons que le kit Wave
 * (`@/mobile/designKit/wave.tsx`) : blanc, filet #D9D9D9, rayon 8, un seul
 * noir. Elles n'existent pas (encore) dans le kit ; à y remonter si un autre
 * module en a besoin : FieldLabel, Toggle, ToggleRow, CheckRow, MethodTile,
 * ChoiceChips, PhotoDrop, ProofStage, Steps, Viewer, RoundLogo.
 */
import * as React from 'react';
import { Camera, Check, ChevronLeft, ChevronRight, FileText, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BottomSheet, FOCUS_RING, SURFACE, TEXT } from '@/mobile/designKit';
import { DepositFamilyLogo, DepositMethodLogo } from '@/mobile/components/deposits/DepositLogos';
import type { DepositMethodFamily } from '@/types/deposit';
import orangeMoneyLogo from '@/assets/deposit-logos/orange-money.png';

/* ── FieldLabel ───────────────────────────────────────────────────────────
 * L'étiquette d'une section de saisie (« MONTANT REÇU », « PAR »). */
export function FieldLabel({ children, className, right }: { children: React.ReactNode; className?: string; right?: React.ReactNode }) {
  return (
    <div className={cn('flex items-baseline justify-between gap-3 pb-2 pt-5', className)}>
      <span className={cn('text-[14px] font-semibold uppercase tracking-[0.06em]', TEXT.muted)}>{children}</span>
      {right}
    </div>
  );
}

/* ── Toggle ───────────────────────────────────────────────────────────────
 * L'interrupteur noir de la v2 (« Prévenir Fatou », « Vu en banque »). */
export function Toggle({ on, onChange, label, disabled }: { on: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={cn(
        'relative h-8 w-[54px] shrink-0 rounded-full transition-colors disabled:opacity-40',
        FOCUS_RING,
        on ? 'bg-[#2C2C2C] dark:bg-[#E3E3E3]' : 'bg-[#D9D9D9] dark:bg-[#444444]',
      )}
    >
      <span className={cn('absolute top-[3px] h-[26px] w-[26px] rounded-full bg-white transition-all dark:bg-[#1E1E1E]', on ? 'left-[25px]' : 'left-[3px]')} />
    </button>
  );
}

/** Une ligne « libellé … interrupteur ». */
export function ToggleRow({ label, on, onChange, disabled, className }: { label: React.ReactNode; on: boolean; onChange: (v: boolean) => void; disabled?: boolean; className?: string }) {
  return (
    <div className={cn('flex min-h-[52px] items-center justify-between gap-3', className)}>
      <span className={cn('text-[17px] font-semibold', TEXT.strong)}>{label}</span>
      <Toggle on={on} onChange={onChange} label={typeof label === 'string' ? label : 'Activer'} disabled={disabled} />
    </div>
  );
}

/* ── CheckRow ─────────────────────────────────────────────────────────────
 * La case à cocher de la v2 (« Espèces remises ») : carré noir coché. */
export function CheckRow({ checked, onChange, label, className, boxed }: { checked: boolean; onChange: (v: boolean) => void; label: React.ReactNode; className?: string; boxed?: boolean }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        'flex min-h-[52px] w-full items-center gap-3.5 text-left',
        boxed && cn('border-b px-4 last:border-b-0', SURFACE.divider),
        FOCUS_RING,
        className,
      )}
    >
      <span
        className={cn(
          'flex h-7 w-7 shrink-0 items-center justify-center rounded-md border-2',
          checked ? 'border-[#2C2C2C] bg-[#2C2C2C] text-white dark:border-[#E3E3E3] dark:bg-[#E3E3E3] dark:text-[#1E1E1E]' : 'border-[#949494] dark:border-[#6E6E6E]',
        )}
      >
        {checked && <Check className="h-[18px] w-[18px]" strokeWidth={3} />}
      </span>
      <span className={cn('text-[17px] font-medium', TEXT.strong)}>{label}</span>
    </button>
  );
}

/* ── MethodTile ───────────────────────────────────────────────────────────
 * La grande tuile d'un moyen (logo + nom), filet noir de 2 px choisie. */
export function MethodTile({ logo, label, selected, onClick, disabled }: { logo: React.ReactNode; label: React.ReactNode; selected?: boolean; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={selected}
      className={cn(
        'flex min-h-[92px] min-w-0 flex-col items-center justify-center gap-2 rounded-lg px-1 py-3 text-center disabled:opacity-40',
        FOCUS_RING,
        selected ? 'border-2 border-[#2C2C2C] dark:border-[#E3E3E3]' : cn('border', SURFACE.divider),
      )}
    >
      {logo}
      <span className={cn('max-w-full truncate text-[15px] font-semibold', TEXT.strong)}>{label}</span>
    </button>
  );
}

/** La grille des tuiles : 4 colonnes (3 si moins). */
export function TileGrid({ children, cols = 4 }: { children: React.ReactNode; cols?: number }) {
  return <div className="grid gap-2.5" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>{children}</div>;
}

/* ── ChoiceChips ──────────────────────────────────────────────────────────
 * Des puces à choix unique, qui passent à la ligne (motifs, périodes). */
export function ChoiceChips<T extends string>({ options, value, onChange, className }: {
  options: ReadonlyArray<{ value: T; label: React.ReactNode }>;
  value: T | null;
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(o.value)}
            className={cn(
              'inline-flex min-h-[44px] items-center rounded-lg px-3.5 text-[16px] font-semibold',
              FOCUS_RING,
              on ? 'bg-[#2C2C2C] text-[#F5F5F5] dark:bg-[#E3E3E3] dark:text-[#1E1E1E]' : 'bg-[#F5F5F5] text-[#1E1E1E] active:bg-[#E6E6E6] dark:bg-[#383838] dark:text-[#F5F5F5]',
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/* ── RoundLogo ────────────────────────────────────────────────────────────
 * Un logo carré posé dans un rond de 44 à filet (moyens de dépôt). */
export function RoundLogo({ children, size = 44 }: { children: React.ReactNode; size?: number }) {
  return (
    <span className={cn('flex shrink-0 items-center justify-center overflow-hidden rounded-full border bg-white', SURFACE.divider)} style={{ width: size, height: size }}>
      {children}
    </span>
  );
}

/** Le rond d'un moyen de DÉPÔT : Orange en logo sur blanc (comme la
 *  maquette), les autres avec leur tuile de marque arrondie. */
export function DepositRound({ method, bankName, family, size = 44 }: { method?: string; bankName?: string | null; family?: DepositMethodFamily; size?: number }) {
  const isOrange = family ? family === 'ORANGE_MONEY' : method === 'om_transfer' || method === 'om_withdrawal';
  if (isOrange) {
    return (
      <RoundLogo size={size}>
        <img src={orangeMoneyLogo} alt="Orange Money" style={{ width: size * 0.72 }} className="object-contain" />
      </RoundLogo>
    );
  }
  if (family) return <DepositFamilyLogo family={family} size={size} radius={size / 2} />;
  return <DepositMethodLogo method={method ?? ''} bankName={bankName} size={size} radius={size / 2} />;
}

/* ── PhotoDrop ────────────────────────────────────────────────────────────
 * La zone en pointillés « Photo du reçu » : un appui ouvre l'appareil ou les
 * fichiers. Montre la photo choisie, avec « Changer ». */
export function PhotoDrop({ label, accept, onFiles, multiple, preview, fileName, onClear, className }: {
  label: React.ReactNode;
  accept: string;
  onFiles: (files: File[]) => void;
  multiple?: boolean;
  preview?: string | null;
  fileName?: string | null;
  onClear?: () => void;
  className?: string;
}) {
  const ref = React.useRef<HTMLInputElement>(null);
  const pick = () => ref.current?.click();
  const input = (
    <input
      ref={ref}
      type="file"
      accept={accept}
      multiple={multiple}
      className="hidden"
      onChange={(e) => {
        const files = Array.from(e.target.files ?? []);
        if (ref.current) ref.current.value = '';
        if (files.length) onFiles(files);
      }}
    />
  );
  if (preview || fileName) {
    return (
      <div className={cn('flex items-center gap-3.5 rounded-lg border p-3', SURFACE.divider, className)}>
        {input}
        <span className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-md bg-[#F5F5F5] dark:bg-[#383838]">
          {preview ? <img src={preview} alt="" className="h-full w-full object-cover" /> : <FileText className={cn('h-7 w-7', TEXT.muted)} />}
        </span>
        <span className="min-w-0 flex-1">
          <span className={cn('block truncate text-[17px] font-semibold', TEXT.strong)}>{label}</span>
          {fileName && <span className={cn('block truncate text-[15px]', TEXT.muted)}>{fileName}</span>}
        </span>
        <button type="button" onClick={pick} className={cn('shrink-0 rounded px-1 text-[16px] font-semibold underline underline-offset-[3px]', FOCUS_RING, TEXT.strong)}>
          Changer
        </button>
        {onClear && (
          <button type="button" onClick={onClear} aria-label="Retirer" className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-full', FOCUS_RING, TEXT.muted)}>
            <X className="h-5 w-5" />
          </button>
        )}
      </div>
    );
  }
  return (
    <>
      {input}
      <button
        type="button"
        onClick={pick}
        className={cn('flex min-h-[128px] w-full flex-col items-center justify-center gap-2.5 rounded-lg border border-dashed border-[#949494] text-center active:bg-[#F5F5F5] dark:border-[#6E6E6E] dark:active:bg-[#383838]', FOCUS_RING, className)}
      >
        <Camera className={cn('h-7 w-7', TEXT.strong)} strokeWidth={1.8} />
        <span className={cn('text-[17px] font-semibold', TEXT.strong)}>{label}</span>
      </button>
    </>
  );
}

/* ── ProofStage ───────────────────────────────────────────────────────────
 * La preuve d'une fiche : la photo en grand sur fond gris, « 1/2 » en coin,
 * flèches si plusieurs ; un appui l'agrandit. */
export interface StageItem {
  id: string;
  url: string | null | undefined;
  isImage: boolean;
  name?: string | null;
}

export function ProofStage({ items, index, onIndex, onOpen, empty }: {
  items: StageItem[];
  index: number;
  onIndex: (i: number) => void;
  onOpen: (i: number) => void;
  empty?: React.ReactNode;
}) {
  if (items.length === 0) return <>{empty}</>;
  const i = Math.min(index, items.length - 1);
  const it = items[i];
  return (
    <div className={cn('relative overflow-hidden rounded-lg border bg-[#F5F5F5] dark:bg-[#383838]', SURFACE.divider)}>
      <button type="button" onClick={() => onOpen(i)} aria-label="Agrandir la preuve" className={cn('block h-[188px] w-full', FOCUS_RING)}>
        {it.isImage && it.url ? (
          <img src={it.url} alt={it.name ?? 'Preuve'} className="h-full w-full object-contain p-2" />
        ) : (
          <span className="flex h-full w-full flex-col items-center justify-center gap-2">
            <FileText className={cn('h-10 w-10', TEXT.muted)} />
            <span className={cn('max-w-[80%] truncate text-[16px] font-semibold', TEXT.muted)}>{it.name || 'Document PDF'}</span>
          </span>
        )}
      </button>
      {items.length > 1 && (
        <>
          <span className={cn('absolute right-3 top-3 rounded-md border bg-white px-2 py-1 text-[14px] font-semibold tabular-nums dark:bg-[#2C2C2C]', SURFACE.divider, TEXT.strong)}>
            {i + 1}/{items.length}
          </span>
          <button type="button" aria-label="Preuve précédente" disabled={i === 0} onClick={() => onIndex(i - 1)} className={cn('absolute left-1 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full disabled:opacity-0', FOCUS_RING, TEXT.strong)}>
            <ChevronLeft className="h-6 w-6" />
          </button>
          <button type="button" aria-label="Preuve suivante" disabled={i === items.length - 1} onClick={() => onIndex(i + 1)} className={cn('absolute right-1 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full disabled:opacity-0', FOCUS_RING, TEXT.strong)}>
            <ChevronRight className="h-6 w-6" />
          </button>
        </>
      )}
    </div>
  );
}

/* ── Viewer ───────────────────────────────────────────────────────────────
 * La visionneuse plein écran (fond noir) et ses gestes en bas. */
export function Viewer({ item, onClose, actions }: {
  item: StageItem | null;
  onClose: () => void;
  actions?: { label: React.ReactNode; onClick: () => void; danger?: boolean; hidden?: boolean }[];
}) {
  React.useEffect(() => {
    if (!item) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [item, onClose]);
  if (!item) return null;
  const shown = (actions ?? []).filter((a) => !a.hidden);
  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-black" role="dialog" aria-modal="true">
      <div className="flex h-14 shrink-0 items-center justify-end px-3 pt-[env(safe-area-inset-top)]">
        <button type="button" onClick={onClose} aria-label="Fermer" className={cn('flex h-11 w-11 items-center justify-center rounded-full border border-white/40 text-white', FOCUS_RING)}>
          <X className="h-6 w-6" />
        </button>
      </div>
      <div className="flex min-h-0 flex-1 items-center justify-center p-4">
        {item.isImage && item.url ? (
          <img src={item.url} alt={item.name ?? 'Aperçu'} className="max-h-full max-w-full object-contain" />
        ) : (
          <div className="flex flex-col items-center gap-3 text-white">
            <FileText className="h-14 w-14" />
            <span className="text-[17px] font-semibold">{item.name || 'Document'}</span>
          </div>
        )}
      </div>
      {shown.length > 0 && (
        <div className="flex shrink-0 gap-2.5 px-5 pb-[calc(env(safe-area-inset-bottom,0px)+16px)] pt-3">
          {shown.map((a, i) => (
            <button
              key={i}
              type="button"
              onClick={a.onClick}
              className={cn('flex h-14 min-w-0 flex-1 items-center justify-center rounded-lg border px-2 text-[17px] font-semibold', FOCUS_RING, a.danger ? 'border-[#EC221F] text-[#FDD3D0]' : 'border-white/50 text-white')}
            >
              <span className="truncate">{a.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Steps ────────────────────────────────────────────────────────────────
 * Le suivi vertical (Historique) : rond noir coché = fait, rond jaune = en
 * cours, rond vide = à venir ; un filet relie les ronds. */
export interface StepItem {
  key: string;
  title: React.ReactNode;
  sub?: React.ReactNode;
  state: 'done' | 'current' | 'todo' | 'bad';
  extra?: React.ReactNode;
}

export function Steps({ items }: { items: StepItem[] }) {
  return (
    <ol>
      {items.map((s, i) => (
        <li key={s.key} className="flex gap-3.5">
          <div className="flex flex-col items-center">
            <span
              className={cn(
                'flex h-7 w-7 shrink-0 items-center justify-center rounded-full',
                s.state === 'done' && 'bg-[#2C2C2C] text-white dark:bg-[#E3E3E3] dark:text-[#1E1E1E]',
                s.state === 'current' && 'border-2 border-[#682D03] bg-[#FFF1C2]',
                s.state === 'bad' && 'bg-[#EC221F] text-white',
                s.state === 'todo' && cn('border-2', SURFACE.divider),
              )}
            >
              {s.state === 'done' && <Check className="h-4 w-4" strokeWidth={3} />}
              {s.state === 'bad' && <X className="h-4 w-4" strokeWidth={3} />}
            </span>
            {i < items.length - 1 && <span className={cn('my-1 w-0.5 flex-1', s.state === 'done' ? 'bg-[#2C2C2C] dark:bg-[#E3E3E3]' : 'bg-[#D9D9D9] dark:bg-[#444444]')} style={{ minHeight: 22 }} />}
          </div>
          <div className="min-w-0 flex-1 pb-4">
            <p className={cn('text-[17px] font-semibold leading-tight', s.state === 'todo' ? TEXT.muted : TEXT.strong)}>{s.title}</p>
            {s.sub != null && <p className={cn('mt-0.5 text-[15px]', TEXT.muted)}>{s.sub}</p>}
            {s.extra}
          </div>
        </li>
      ))}
    </ol>
  );
}

/** Une pièce (vignette 1:1.1) avec sa légende, pour les grilles de pièces. */
export function PieceTile({ url, isImage, label, onClick, add }: { url?: string | null; isImage?: boolean; label: React.ReactNode; onClick: () => void; add?: boolean }) {
  return (
    <button type="button" onClick={onClick} className={cn('flex min-w-0 flex-col items-center gap-1.5 rounded-lg', FOCUS_RING)}>
      <span
        className={cn(
          'flex aspect-[1/1.1] w-full items-center justify-center overflow-hidden rounded-lg',
          add ? 'border border-dashed border-[#949494] dark:border-[#6E6E6E]' : cn('border bg-[#F5F5F5] dark:bg-[#383838]', SURFACE.divider),
        )}
      >
        {add ? (
          <span className={cn('text-[30px] font-light leading-none', TEXT.strong)}>+</span>
        ) : isImage && url ? (
          <img src={url} alt="" className="h-full w-full object-cover" />
        ) : (
          <FileText className={cn('h-8 w-8', TEXT.muted)} />
        )}
      </span>
      <span className={cn('max-w-full truncate text-[15px] font-medium', TEXT.body)}>{label}</span>
    </button>
  );
}

/* ── MenuSheet ────────────────────────────────────────────────────────────
 * Le « … » d'une fiche : comme ActionSheet du kit, avec en plus des lignes
 * à interrupteur (« Vu en banque ») et les gestes rouges à part, sous un
 * bandeau gris. */
export interface MenuItem {
  label: React.ReactNode;
  icon?: React.ElementType;
  onClick: () => void;
  hint?: React.ReactNode;
  danger?: boolean;
  hidden?: boolean;
  disabled?: boolean;
  /** Une ligne à interrupteur : l'état courant (la feuille reste ouverte). */
  toggle?: boolean;
}

export function MenuSheet({ open, onClose, items, title }: { open: boolean; onClose: () => void; items: MenuItem[]; title?: React.ReactNode }) {
  const shown = items.filter((i) => !i.hidden);
  const normal = shown.filter((i) => !i.danger);
  const danger = shown.filter((i) => i.danger);
  const row = (a: MenuItem, k: number) => {
    const Icon = a.icon;
    return (
      <button
        key={k}
        type="button"
        disabled={a.disabled}
        role={a.toggle != null ? 'switch' : undefined}
        aria-checked={a.toggle != null ? a.toggle : undefined}
        onClick={() => { if (a.toggle == null) onClose(); a.onClick(); }}
        className={cn('flex min-h-[58px] w-full items-center gap-3.5 border-b py-2.5 text-left last:border-b-0 disabled:opacity-40 active:bg-[#F5F5F5] dark:active:bg-[#383838]', SURFACE.divider, FOCUS_RING)}
      >
        {Icon && <Icon className={cn('h-[22px] w-[22px] shrink-0', a.danger ? 'text-[#C00F0C] dark:text-[#FCB3AD]' : TEXT.strong)} strokeWidth={2} />}
        <span className="min-w-0 flex-1">
          <span className={cn('block text-[17px] font-medium', a.danger ? 'text-[#C00F0C] dark:text-[#FCB3AD]' : TEXT.strong)}>{a.label}</span>
        </span>
        {a.hint != null && <span className={cn('shrink-0 text-[16px]', TEXT.muted)}>{a.hint}</span>}
        {a.toggle != null && (
          <span aria-hidden className={cn('relative h-8 w-[54px] shrink-0 rounded-full transition-colors', a.toggle ? 'bg-[#2C2C2C] dark:bg-[#E3E3E3]' : 'bg-[#D9D9D9] dark:bg-[#444444]')}>
            <span className={cn('absolute top-[3px] h-[26px] w-[26px] rounded-full bg-white transition-all dark:bg-[#1E1E1E]', a.toggle ? 'left-[25px]' : 'left-[3px]')} />
          </span>
        )}
      </button>
    );
  };
  return (
    <BottomSheet open={open} onClose={onClose}>
      {title != null && <h3 className={cn('mb-2 text-[22px] font-semibold leading-tight', TEXT.strong)}>{title}</h3>}
      <div>{normal.map(row)}</div>
      {danger.length > 0 && (
        <>
          <div className="-mx-6 my-1 h-2 bg-[#F5F5F5] dark:bg-[#383838]" />
          <div>{danger.map(row)}</div>
        </>
      )}
    </BottomSheet>
  );
}

/** Un lien souligné, en ligne (« Ajouter une note interne »). */
export function TextLink({ children, onClick, className }: { children: React.ReactNode; onClick: () => void; className?: string }) {
  return (
    <button type="button" onClick={onClick} className={cn('rounded text-[16px] font-semibold underline underline-offset-[3px]', FOCUS_RING, TEXT.strong, className)}>
      {children}
    </button>
  );
}
