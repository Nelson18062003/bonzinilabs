// ============================================================
// Mes équipes — petites pièces partagées (liste, création, fiche).
// Les fenêtres sont rendues EN LIGNE (pas de portail) : elles héritent du
// thème `.admin-theme` de la coquille, comme la trésorerie.
// ============================================================
import { useEffect, useState, type ReactNode } from 'react';
import { Check, Copy, Share2, X } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { AppRole } from '@/contexts/AdminAuthContext';
import { roleLabel } from '@/lib/team';
import { TextField } from '@/components/form';

export const CARD = 'rounded-2xl bg-card ring-1 ring-black/[0.06] dark:ring-white/10';
export const BTN_PRIMARY =
  'inline-flex h-10 items-center justify-center gap-1.5 rounded-xl bg-primary px-4 text-[14px] font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50';
export const BTN_SOFT =
  'inline-flex h-10 items-center justify-center gap-1.5 rounded-xl px-3.5 text-[14px] font-semibold ring-1 ring-black/10 hover:bg-accent disabled:opacity-50 dark:ring-white/15';
export const BTN_DANGER =
  'inline-flex h-10 items-center justify-center gap-1.5 rounded-xl bg-red-600 px-4 text-[14px] font-semibold text-white hover:bg-red-700 disabled:opacity-50';

const ROLE_TONE: Partial<Record<AppRole, string>> = {
  super_admin: 'bg-violet-100 text-violet-800 dark:bg-violet-500/15 dark:text-violet-300',
  commercial: 'bg-orange-100 text-orange-800 dark:bg-orange-500/15 dark:text-orange-300',
  receptionist: 'bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-300',
  warehouse_agent: 'bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-300',
  cash_agent: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
  customs_broker: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300',
};

export function RolePill({ role, className }: { role: AppRole; className?: string }) {
  return (
    <span className={cn('inline-flex h-6 items-center rounded-full px-2.5 text-[12px] font-semibold', ROLE_TONE[role] ?? 'bg-muted text-foreground', className)}>
      {roleLabel(role)}
    </span>
  );
}

export function Initials({ name, disabled, className }: { name: string; disabled?: boolean; className?: string }) {
  const letters = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');
  return (
    <span
      className={cn(
        'flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[14px] font-bold',
        disabled ? 'bg-muted text-muted-foreground' : 'bg-primary/10 text-primary',
        className,
      )}
      aria-hidden
    >
      {letters || '?'}
    </span>
  );
}

export function Field({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  autoFocus,
  hint,
  error,
  maxLength,
  inputMode,
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  autoFocus?: boolean;
  hint?: ReactNode;
  error?: string | null;
  maxLength?: number;
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
  autoComplete?: string;
}) {
  return (
    <TextField
      label={label}
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      autoFocus={autoFocus}
      maxLength={maxLength}
      inputMode={inputMode}
      autoComplete={autoComplete}
      error={error ?? undefined}
      hint={hint}
      size="lg"
      controlClassName="rounded-xl bg-card"
    />
  );
}

/** Une fenêtre en ligne : plein écran en bas sur téléphone, centrée sur ordinateur. Échap ferme. */
export function Modal({ title, onClose, children, footer }: { title: string; onClose: () => void; children: ReactNode; footer?: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-6" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-background p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] text-foreground shadow-xl sm:max-w-lg sm:rounded-2xl"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 className="text-[18px] font-bold tracking-tight">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Fermer" className="-mr-1 -mt-1 rounded-full p-2 text-muted-foreground hover:bg-accent">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-4">{children}</div>
        {footer && <div className="mt-5 flex flex-wrap justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
}

/**
 * Le mot de passe provisoire, une seule fois : à copier ou partager tout de
 * suite (il n'est conservé nulle part en clair).
 */
export function PasswordReveal({ email, password, name }: { email: string; password: string; name: string }) {
  const [copied, setCopied] = useState(false);
  const message = `Bonjour ${name.split(' ')[0] || ''}, voici ton accès Bonzini Labs.\nConnexion : https://www.bonzinilabs.com/m/login (ou l'app BONZINI HQ)\nEmail : ${email}\nMot de passe provisoire : ${password}\nChange-le après ta première connexion.`;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Impossible de copier : sélectionnez le texte et copiez-le à la main.');
    }
  };
  const share = async () => {
    try {
      await navigator.share({ text: message });
    } catch {
      /* partage annulé */
    }
  };
  return (
    <div className="space-y-3">
      <div className="rounded-2xl bg-muted/60 p-4">
        <div className="text-[12.5px] font-medium text-muted-foreground">Mot de passe provisoire</div>
        <div className="mt-1 select-all break-all font-mono text-[22px] font-bold tracking-wider">{password}</div>
        <div className="mt-2 text-[13px] text-muted-foreground">
          Email de connexion : <span className="select-all font-medium text-foreground">{email}</span>
        </div>
      </div>
      <p className="text-[13px] leading-relaxed text-muted-foreground">
        Il n’est montré qu’une fois. Transmettez-le en privé ; la personne le change après sa première connexion.
      </p>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={copy} className={BTN_PRIMARY}>
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          {copied ? 'Copié' : 'Copier le message'}
        </button>
        {typeof navigator !== 'undefined' && 'share' in navigator && (
          <button type="button" onClick={share} className={BTN_SOFT}>
            <Share2 className="h-4 w-4" /> Partager
          </button>
        )}
      </div>
    </div>
  );
}

export function Skeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-2 p-5">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="h-14 animate-pulse rounded-xl bg-muted" />
      ))}
    </div>
  );
}
