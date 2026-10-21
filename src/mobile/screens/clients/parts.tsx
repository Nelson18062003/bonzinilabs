/**
 * Briques du module Clients · Équipe & ventes · App commercial (refonte v2).
 *
 * Ce que les maquettes 03 et 10 (écrans 8 à 29) demandent et que le kit
 * (`@/mobile/designKit`) n'a pas encore : l'étiquette de champ en capitales,
 * le grand champ de 56, la ligne à choix unique (rôle, commercial), les
 * tuiles (plafonds, types de source), l'interrupteur « Accès actif », la
 * barre d'étapes, la barre d'objectif, la coche verte, la carte du mot de
 * passe provisoire. Mêmes jetons que le kit : blanc, filet #D9D9D9, rayon 8,
 * encre #2C2C2C, rien sous 14 px.
 *
 * À remonter dans `wave.tsx` quand un autre module en aura besoin.
 */
import * as React from 'react';
import { Check, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { FOCUS_RING, SURFACE, TEXT, TextInput } from '@/mobile/designKit';

/** « NOM », « WHATSAPP » : l'étiquette d'un champ, en capitales espacées (14/700). */
export function FieldLabel({ children, htmlFor, className }: { children: React.ReactNode; htmlFor?: string; className?: string }) {
  return (
    <label htmlFor={htmlFor} className={cn('mb-2 mt-5 block text-[14px] font-bold uppercase tracking-[0.06em] first:mt-0', TEXT.muted, className)}>
      {children}
    </label>
  );
}

/** Le grand champ de la v2 : 56 px, rayon 8, texte 17. */
export const BIG_FIELD = 'h-14 rounded-lg px-4 text-[17px]';

export const BigInput = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function BigInput({ className, ...rest }, ref) {
  return <TextInput ref={ref} className={cn(BIG_FIELD, 'placeholder:text-[#757575] dark:placeholder:text-[#B3B3B3]', className)} {...rest} />;
});

/** Une boîte qui ressemble à un champ mais ouvre un choix (pays, origine) : valeur + chevron. */
export function PickerBox({ children, onClick, ariaLabel, className }: { children: React.ReactNode; onClick: () => void; ariaLabel?: string; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className={cn('flex w-full items-center gap-3 bg-white text-left dark:bg-[#2C2C2C]', BIG_FIELD, SURFACE.field, FOCUS_RING, TEXT.strong, className)}
    >
      <span className="min-w-0 flex-1 truncate">{children}</span>
      <svg viewBox="0 0 24 24" className={cn('h-5 w-5 shrink-0', TEXT.muted)} fill="none" stroke="currentColor" strokeWidth={2} aria-hidden><path d="m9 18 6-6-6-6" /></svg>
    </button>
  );
}

/** Le rond de choix (radio) des listes : 26 px, plein noir quand il est pris. */
export function Radio({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        'flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full border-2',
        on ? 'border-[#2C2C2C] bg-[#2C2C2C] dark:border-[#E3E3E3] dark:bg-[#E3E3E3]' : 'border-[#949494] dark:border-[#6E6E6E]',
      )}
    >
      {on && <span className="h-2.5 w-2.5 rounded-full bg-white dark:bg-[#1E1E1E]" />}
    </span>
  );
}

/** Une grande ligne à choix unique : titre, sous-titre, rond à gauche (ou à droite avec `radioRight`). */
export function ChoiceRow({
  title, subtitle, on, onClick, leading, aside, radioRight = false, disabled,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  on: boolean;
  onClick: () => void;
  leading?: React.ReactNode;
  aside?: React.ReactNode;
  radioRight?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      onClick={onClick}
      disabled={disabled}
      className={cn('flex min-h-[64px] w-full items-center gap-3.5 border-b py-3 text-left last:border-b-0 disabled:opacity-40', SURFACE.divider, FOCUS_RING, 'active:bg-[#F5F5F5] dark:active:bg-[#383838]')}
    >
      {!radioRight && <Radio on={on} />}
      {leading}
      <span className="min-w-0 flex-1">
        <span className={cn('block text-[17px] font-semibold leading-tight', TEXT.strong)}>{title}</span>
        {subtitle != null && <span className={cn('mt-0.5 block text-[15px] leading-snug', TEXT.muted)}>{subtitle}</span>}
      </span>
      {aside}
      {radioRight && <Radio on={on} />}
    </button>
  );
}

/** Des tuiles à choix unique sur 2 ou 3 colonnes (plafonds, types de source). */
export function Tiles<T extends string | number>({
  options, value, onChange, cols = 2, ariaLabel,
}: {
  options: ReadonlyArray<{ value: T; label: React.ReactNode }>;
  value: T | null;
  onChange: (v: T) => void;
  cols?: 2 | 3;
  ariaLabel?: string;
}) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className={cn('grid gap-2.5', cols === 3 ? 'grid-cols-3' : 'grid-cols-2')}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            lang="fr"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className={cn(
              'flex min-h-[56px] min-w-0 items-center justify-center rounded-lg border px-2 py-2 text-center text-[16px] font-semibold leading-tight tabular-nums [hyphens:auto] [overflow-wrap:anywhere]',
              FOCUS_RING,
              TEXT.strong,
              on ? 'border-2 border-[#2C2C2C] dark:border-[#E3E3E3]' : SURFACE.divider,
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** L'interrupteur iOS de la v2 (« Accès actif »). */
export function Switch({ on, onChange, label, disabled }: { on: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={cn('relative h-[34px] w-[58px] shrink-0 rounded-full transition-colors disabled:opacity-40', FOCUS_RING, on ? 'bg-[#2C2C2C] dark:bg-[#E3E3E3]' : 'bg-[#D9D9D9] dark:bg-[#444444]')}
    >
      <span className={cn('absolute top-[3px] h-7 w-7 rounded-full bg-white transition-all dark:bg-[#1E1E1E]', on ? 'left-[27px]' : 'left-[3px]')} />
    </button>
  );
}

/** Une boîte à filet avec un libellé et un interrupteur. */
export function SwitchBox({ label, on, onChange, disabled }: { label: React.ReactNode; on: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <div className={cn('flex min-h-[64px] items-center justify-between gap-3 rounded-lg border px-4', SURFACE.divider)}>
      <span className={cn('text-[17px] font-semibold', TEXT.strong)}>{label}</span>
      <Switch on={on} onChange={onChange} label={typeof label === 'string' ? label : 'Activer'} disabled={disabled} />
    </div>
  );
}

/** La barre des étapes d'un parcours (7 traits). */
export function StepBar({ total, current, className }: { total: number; current: number; className?: string }) {
  return (
    <div role="progressbar" aria-valuemin={1} aria-valuemax={total} aria-valuenow={current} aria-label={`Étape ${current} sur ${total}`} className={cn('flex gap-1.5', className)}>
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className={cn('h-[5px] flex-1 rounded-full', i < current ? 'bg-[#2C2C2C] dark:bg-[#E3E3E3]' : 'bg-[#D9D9D9] dark:bg-[#444444]')} />
      ))}
    </div>
  );
}

/** La barre d'un objectif (0 → 1). */
export function ProgressBar({ ratio, className }: { ratio: number; className?: string }) {
  const pct = Math.round(Math.max(0, Math.min(1, ratio)) * 100);
  return (
    <div className={cn('h-2.5 w-full overflow-hidden rounded-full bg-[#F0F0F0] dark:bg-[#383838]', className)} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full rounded-full bg-[#2C2C2C] dark:bg-[#E3E3E3]" style={{ width: `${pct}%` }} />
    </div>
  );
}

/** La coche verte en rond et sa ligne (« Numéro libre »). */
export function CheckLine({ children, tone = 'success', className }: { children: React.ReactNode; tone?: 'success' | 'pending' | 'danger'; className?: string }) {
  const dot = tone === 'success' ? 'bg-[#CFF7D3] text-[#02542D]' : tone === 'pending' ? 'bg-[#FFF1C2] text-[#682D03]' : 'bg-[#FDD3D0] text-[#900B09]';
  return (
    <p className={cn('flex items-center gap-2.5 text-[16px] font-semibold', TEXT.strong, className)}>
      <span aria-hidden className={cn('flex h-6 w-6 shrink-0 items-center justify-center rounded-full', dot)}>
        {tone === 'success' ? <Check className="h-4 w-4" strokeWidth={3} /> : <span className="text-[14px] font-bold leading-none">!</span>}
      </span>
      <span className="min-w-0">{children}</span>
    </p>
  );
}

/** Copier un texte, avec le message d'échec du reste de l'app. */
export async function copyText(text: string, done?: string) {
  try {
    await navigator.clipboard.writeText(text);
    if (done) toast.success(done);
    return true;
  } catch {
    toast.error('Impossible de copier : sélectionnez le texte et copiez-le à la main.');
    return false;
  }
}

/** Le mot de passe provisoire, montré une fois, en grand, avec « Copier ». */
export function SecretCard({
  label = 'Mot de passe provisoire', secret, copyLabel = 'Copier', copyValue, rows,
}: {
  label?: React.ReactNode;
  secret: string;
  copyLabel?: string;
  /** Ce qui part au presse-papiers (le message complet, par défaut le secret). */
  copyValue?: string;
  rows?: { label: React.ReactNode; value: React.ReactNode }[];
}) {
  const [copied, setCopied] = React.useState(false);
  const copy = async () => {
    if (await copyText(copyValue ?? secret)) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    }
  };
  return (
    <div className={cn('mt-7 rounded-lg border', SURFACE.divider)}>
      <div className="px-4 py-5 text-center">
        <div className={cn('text-[16px]', TEXT.muted)}>{label}</div>
        <div className={cn('mt-2 select-all break-all text-[30px] font-bold tracking-[0.08em]', TEXT.strong)} style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>
          {secret}
        </div>
        <button
          type="button"
          onClick={() => void copy()}
          className={cn('mt-3 inline-flex h-11 items-center gap-2 rounded-lg border border-[#949494] bg-[#E3E3E3] px-4 text-[16px] font-semibold text-[#303030] active:bg-[#CDCDCD] dark:bg-[#444444] dark:text-[#F5F5F5]', FOCUS_RING)}
        >
          {copied ? <Check className="h-[18px] w-[18px]" /> : <Copy className="h-[18px] w-[18px]" />}
          {copied ? 'Copié' : copyLabel}
        </button>
      </div>
      {rows?.map((r, i) => (
        <div key={i} className={cn('flex items-center justify-between gap-3 border-t px-4 py-3.5 text-[16px]', SURFACE.divider)}>
          <span className={TEXT.muted}>{r.label}</span>
          <span className={cn('min-w-0 truncate text-right font-semibold', TEXT.strong)}>{r.value}</span>
        </div>
      ))}
    </div>
  );
}

/** Une rangée de puces qui défile de côté, sans barre visible. */
export function ChipRow({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('scrollbar-hide flex gap-2 overflow-x-auto px-5 pb-1', className)}>{children}</div>;
}

/** « 48,6 M » : un montant XAF court pour les gros chiffres et les lignes. */
export function shortXaf(n: number): string {
  const v = Math.round(Number(n) || 0);
  const abs = Math.abs(v);
  const sign = v < 0 ? '−' : '';
  if (abs >= 1_000_000) {
    const m = abs / 1_000_000;
    return `${sign}${m.toLocaleString('fr-FR', { maximumFractionDigits: m >= 100 ? 0 : 1 })}\u00A0M`;
  }
  return `${sign}${abs.toLocaleString('fr-FR').replace(/\u202F/g, '\u00A0')}`;
}

/** Le montant entier avec espaces insécables (« 1 213 450 »), signe « − » typographique. */
export function xaf(n: number): string {
  const v = Math.round(Number(n) || 0);
  return `${v < 0 ? '−' : ''}${Math.abs(v).toLocaleString('fr-FR').replace(/\u202F/g, '\u00A0')}`;
}

/** Un montant signé (« +850 000 », « −432 900 »). */
export function signedXaf(n: number): string {
  const v = Math.round(Number(n) || 0);
  return `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toLocaleString('fr-FR').replace(/\u202F/g, '\u00A0')}`;
}
