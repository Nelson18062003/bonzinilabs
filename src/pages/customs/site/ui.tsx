/**
 * Les pièces du site Douane (bonzinilabs.com/douane).
 *
 * Trois règles de mise en page, pour tous les écrans :
 *   1. une seule action principale visible à la fois (bouton encre, plein) ;
 *   2. le chiffre avant le détail — le détail se déplie, il ne s'impose pas ;
 *   3. les couleurs de statut (vert, ambre) ne décorent jamais.
 * Les animations sont courtes (≤ 400 ms), et coupées si l'appareil le demande.
 */
import { useEffect, useId, useRef, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import type { Tone } from '@/mobile/designKit';
import { Link, type LinkProps } from 'react-router-dom';
import { ArrowLeft, ChevronDown as SelectChevron, X as CloseIcon } from 'lucide-react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { AnimatePresence, animate, motion, useInView, useReducedMotion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { EASE, buttonClass, inputClass, type Size, type Variant } from './styles';

// ─── Mise en page ───────────────────────────────────────────────────────────

export function Container({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('mx-auto w-full max-w-[1200px] px-5 sm:px-8', className)}>{children}</div>;
}

/** L'en-tête d'une page outil : d'où l'on vient, le titre, une phrase. */
export function PageIntro({ title, muted, subtitle, back, actions, className }: {
  title: ReactNode; muted?: ReactNode; subtitle?: ReactNode; back?: { to: string; label: string }; actions?: ReactNode; className?: string;
}) {
  return (
    <Container className={cn('pb-6 pt-6 sm:pb-10 sm:pt-10 lg:pt-14', className)}>
      {back && (
        <Link to={back.to} className="-ml-1 inline-flex h-9 items-center gap-1.5 rounded-full px-1 text-[15px] font-bold text-dz-ink3 transition-colors hover:text-dz-ink">
          <ArrowLeft aria-hidden className="h-4 w-4" /> {back.label}
        </Link>
      )}
      <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="[text-wrap:balance] text-[34px] font-black leading-[1.02] tracking-[-0.04em] text-dz-ink sm:text-[48px] lg:text-[56px]">
            {title}{muted && <span className="block text-dz-mute">{muted}</span>}
          </h1>
          {subtitle && <p className="mt-3 max-w-[56ch] text-[17px] font-medium leading-relaxed text-dz-ink3 sm:text-[19px]">{subtitle}</p>}
        </div>
        {actions}
      </div>
    </Container>
  );
}

/** Un petit libellé au-dessus d'un titre. */
export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn('text-[15px] font-bold text-dz-ink3', className)}>{children}</p>;
}

export function Panel({ className, children, as: Tag = 'div', id }: { className?: string; children: ReactNode; as?: 'div' | 'section' | 'article' | 'aside'; id?: string }) {
  return <Tag id={id} className={cn('rounded-[28px] bg-dz-card', className)}>{children}</Tag>;
}

// ─── Boutons ────────────────────────────────────────────────────────────────

export function Button({ variant = 'primary', size = 'md', className, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  return <button type="button" {...props} className={buttonClass(variant, size, className)} />;
}

export function ButtonLink({ variant = 'primary', size = 'md', className, ...props }: LinkProps & { variant?: Variant; size?: Size }) {
  return <Link {...props} className={buttonClass(variant, size, className)} />;
}

// ─── Champs ─────────────────────────────────────────────────────────────────


export function Field({ label, hint, htmlFor, children, className }: { label: ReactNode; hint?: ReactNode; htmlFor?: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn('space-y-2', className)}>
      <label htmlFor={htmlFor} className="block text-[15px] font-bold text-dz-ink">{label}</label>
      {children}
      {hint && <p className="text-[14px] leading-snug text-dz-ink3">{hint}</p>}
    </div>
  );
}

/** Le seul <input> brut du site : `inputClass` impose 17 px, donc pas de zoom automatique d'iOS Safari. */
export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  // eslint-disable-next-line no-restricted-syntax -- ≥ 17 px garanti par inputClass
  return <input {...props} className={cn(inputClass, className)} />;
}

/** Même règle que Input : 17 px, pas de zoom automatique d'iOS Safari. */
export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  // eslint-disable-next-line no-restricted-syntax -- ≥ 17 px garanti par inputClass
  return <textarea {...props} className={cn(inputClass, 'h-auto min-h-[120px] resize-y py-3 leading-relaxed', className)} />;
}

/** Une liste déroulante native (le sélecteur du système sur téléphone), à l'allure du site. */
export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select {...props} className={cn(inputClass, 'appearance-none truncate pr-11', className)}>{children}</select>
      <SelectChevron aria-hidden className="pointer-events-none absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-dz-ink3" />
    </div>
  );
}

/** Des choix exclusifs, côte à côte. */
export function Pills<T extends string>({ options, value, onChange, className, label }: {
  options: ReadonlyArray<{ value: T; label: ReactNode }>;
  value: T;
  onChange: (v: T) => void;
  className?: string;
  label?: string;
}) {
  const id = useId();
  return (
    <div role="radiogroup" aria-label={label} className={cn('flex flex-wrap gap-2', className)}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button key={o.value} type="button" role="radio" aria-checked={on} onClick={() => onChange(o.value)}
            className={cn('relative inline-flex h-11 items-center justify-center gap-2 rounded-full px-4 text-[15px] font-bold transition-colors',
              on ? 'text-dz-on-primary' : 'bg-dz-soft text-dz-ink2 hover:bg-dz-fill hover:text-dz-ink')}>
            {on && <motion.span layoutId={`pill-${id}`} className="absolute inset-0 rounded-full bg-dz-primary" transition={{ type: 'spring', stiffness: 500, damping: 40 }} />}
            <span className="relative inline-flex items-center gap-2">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// ─── Mouvement ──────────────────────────────────────────────────────────────

/** Apparaît en montant légèrement, une fois, quand il entre à l'écran. */
export function Reveal({ children, delay = 0, className, y = 16, as = 'div' }: { children: ReactNode; delay?: number; className?: string; y?: number; as?: 'div' | 'li' }) {
  const ref = useRef<HTMLDivElement & HTMLLIElement>(null);
  const seen = useInView(ref, { once: true, margin: '-40px' });
  const reduce = useReducedMotion();
  const Tag = as === 'li' ? motion.li : motion.div;
  return (
    <Tag ref={ref} className={className}
      initial={reduce ? false : { opacity: 0, y }}
      animate={seen || reduce ? { opacity: 1, y: 0 } : undefined}
      transition={{ duration: 0.5, delay, ease: EASE }}>
      {children}
    </Tag>
  );
}

/** Un montant qui glisse de l'ancienne valeur à la nouvelle. */
export function CountUp({ value, format, className }: { value: number; format: (n: number) => string; className?: string }) {
  const reduce = useReducedMotion();
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    if (reduce) { setShown(value); from.current = value; return; }
    const ctrl = animate(from.current, value, { duration: 0.45, ease: EASE, onUpdate: (v) => setShown(v) });
    from.current = value;
    return () => ctrl.stop();
  }, [value, reduce]);
  return <span className={cn('tabular-nums', className)}>{format(shown)}</span>;
}

/** Ce qu'on lit rarement : replié, il s'ouvre en douceur. */
export function Disclosure({ title, meta, children, defaultOpen = false, className }: {
  title: ReactNode; meta?: ReactNode; children: ReactNode; defaultOpen?: boolean; className?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  return (
    <div className={className}>
      <button type="button" aria-expanded={open} aria-controls={id} onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 py-3 text-left">
        <span className="text-[16px] font-bold text-dz-ink">{title}</span>
        <span className="flex shrink-0 items-center gap-2 whitespace-nowrap text-[15px] text-dz-ink3">
          {meta}
          <ChevronDown aria-hidden className={cn('h-5 w-5 transition-transform duration-300', open && 'rotate-180')} />
        </span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div id={id} key="c" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: EASE }} className="overflow-hidden">
            <div className="pb-3">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Un statut en toutes lettres (jamais la couleur seule). */
export function Badge({ tone = 'neutral', children, className }: { tone?: 'neutral' | 'good' | 'warn' | 'brand' | 'bad'; children: ReactNode; className?: string }) {
  const t = {
    neutral: 'bg-dz-fill text-dz-ink2',
    good: 'bg-dz-good-soft text-dz-good',
    warn: 'bg-dz-warn-soft text-dz-warn',
    brand: 'bg-dz-brand-soft text-dz-brand',
    bad: 'bg-dz-bad/10 text-dz-bad',
  }[tone];
  return <span className={cn('inline-flex h-7 items-center whitespace-nowrap rounded-full px-3 text-[14px] font-bold', t, className)}>{children}</span>;
}

/** Le statut d'un dossier (même vocabulaire que l'app : succès, en attente, à faire…). */
export function StatusBadge({ tone, children }: { tone: Tone; children: ReactNode }) {
  const map = { success: 'good', pending: 'warn', danger: 'bad', info: 'brand', neutral: 'neutral' } as const;
  return <Badge tone={map[tone]}>{children}</Badge>;
}

/**
 * Une question qui demande une décision : feuille venue du bas sur téléphone,
 * fenêtre centrée sur ordinateur. Échap et le fond ferment ; la page derrière
 * ne défile plus.
 */
export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode }) {
  const { t } = useTranslation('customs');
  const id = useId();
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', esc);
    const tm = window.setTimeout(() => box.current?.focus(), 50);
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', esc); window.clearTimeout(tm); };
  }, [open, onClose]);
  if (typeof document === 'undefined') return null;
  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="dz fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-6">
          <motion.div className="absolute inset-0 bg-[#08040e]/50 backdrop-blur-[2px]" onClick={onClose}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} />
          <motion.div ref={box} role="dialog" aria-modal="true" aria-labelledby={id} tabIndex={-1}
            className="relative max-h-[92dvh] w-full max-w-[560px] overflow-y-auto rounded-t-[32px] bg-dz-card p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] text-dz-ink shadow-2xl focus:outline-none sm:rounded-[32px] sm:p-8"
            initial={{ y: 48, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 48, opacity: 0 }} transition={{ duration: 0.3, ease: EASE }}>
            <div className="mb-4 flex items-start justify-between gap-4">
              <h2 id={id} className="text-[22px] font-black leading-snug tracking-[-0.02em]">{title}</h2>
              <button type="button" onClick={onClose} aria-label={t('site.close')} className="-mr-2 -mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-dz-ink3 hover:bg-dz-soft hover:text-dz-ink">
                <CloseIcon aria-hidden className="h-5 w-5" />
              </button>
            </div>
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
