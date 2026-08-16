/**
 * Centred modal — the desktop replacement for `BottomSheet`.
 *
 * The admin has 26 bottom sheets across 10 screens: validate a deposit, reject a
 * payment, delete a proof. A bottom sheet is a thumb-reach idiom — it puts the
 * action where the hand already rests on a phone. On a monitor it animates the
 * confirmation to the furthest point from the cursor, and on a tall screen the
 * buttons can land below the fold.
 *
 * Behaviour is otherwise deliberately identical to the mobile sheet — focus
 * trap, Escape, backdrop dismiss — including the `onClose` ref trick, which is
 * not a style preference: with `onClose` in the effect's deps the effect re-runs
 * on every parent render and its initial-focus call steals focus from whatever
 * field is being typed into.
 */

import { useEffect, useRef } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SURFACE, TEXT } from '@/mobile/designKit';

export type DialogSize = 'sm' | 'md' | 'lg';

const WIDTH: Record<DialogSize, string> = {
  sm: 'max-w-[420px]',
  md: 'max-w-[560px]',
  lg: 'max-w-[760px]',
};

interface Props {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  children: React.ReactNode;
  /** Buttons. Laid out right-aligned, primary last — desktop reading order. */
  actions?: React.ReactNode;
  size?: DialogSize;
  /** Destructive confirmations get a red rule and a warning glyph. */
  danger?: boolean;
}

export function Dialog({
  open,
  onClose,
  title,
  children,
  actions,
  size = 'md',
  danger = false,
}: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;

    const focusables = () =>
      Array.from(
        panelRef.current?.querySelectorAll<HTMLElement>(
          'a[href],button:not([disabled]),textarea,input,select,[tabindex]:not([tabindex="-1"])',
        ) ?? [],
      ).filter((el) => el.offsetParent !== null);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab') return;

      const items = focusables();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement as HTMLElement | null;

      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    // Focus the first control, but never a destructive one by default — an
    // operator who hits Enter out of habit must not confirm a rejection.
    const items = focusables();
    const safe = items.find((el) => el.dataset.dialogAutofocus === 'true') ?? items[0];
    safe?.focus();

    document.addEventListener('keydown', onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-6">
      <div
        className="absolute inset-0 bg-black/35 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        className={cn(
          'relative flex max-h-[calc(100vh-6rem)] w-full flex-col overflow-hidden rounded-[20px]',
          'shadow-[0_24px_60px_-16px_rgba(20,12,45,0.45)]',
          'dark:ring-1 dark:ring-white/[0.08]',
          WIDTH[size],
          SURFACE.card,
        )}
      >
        {danger && <div className="h-1 shrink-0 bg-[#C0504D]" />}

        {title && (
          <div className="flex shrink-0 items-start justify-between gap-4 px-6 pb-1 pt-5">
            <h2 className={cn('flex items-center gap-2 text-[16px] font-bold', TEXT.strong)}>
              {danger && <AlertTriangle className="h-[18px] w-[18px] shrink-0 text-[#C0504D] dark:text-[#E79A9A]" />}
              {title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fermer"
              className={cn(
                '-mr-1.5 -mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition hover:bg-black/[0.05] dark:hover:bg-white/[0.06]',
                TEXT.muted,
              )}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">{children}</div>

        {actions && (
          <div className="flex shrink-0 items-center justify-end gap-2 border-t border-black/[0.06] px-6 py-3.5 dark:border-white/[0.06]">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}
