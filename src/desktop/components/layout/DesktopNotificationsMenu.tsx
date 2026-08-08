/**
 * Topbar notifications bell + popover.
 *
 * Same feed as the mobile notifications screen (`useAdminNotifications`):
 * deposits waiting for review, payments ready to execute. Rebuilt on the
 * console tokens so the control matches the other 32px topbar affordances
 * instead of the 40px mobile pill it used to be.
 *
 * Three things it now gets right that it did not before:
 *  · **The count.** It capped at "9+", which is the one number the badge exists
 *    to convey — a morning queue of 40 and a queue of 10 looked identical.
 *  · **Currency.** `AdminNotification` carries its own `currency`; the menu
 *    hardcoded `formatXAF`. Both feeds happen to be XAF today, so this was not
 *    a live mis-statement — but it would silently become one the day a feed
 *    reports in RMB.
 *  · **Focus.** Escape closes the popover *and* returns focus to the bell,
 *    instead of dropping it on `<body>`.
 */
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, ArrowDownToLine, ArrowUpFromLine, AlertCircle, Clock } from 'lucide-react';
import { format, isToday, isYesterday } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useAdminNotifications, type AdminNotificationType } from '@/hooks/useAdminNotifications';
import { formatXAF, formatCurrencyRMB } from '@/lib/formatters';
import type { Tone } from '@/mobile/designKit';
import { cn } from '@/lib/utils';
import { DS, DT, DFG, DFOCUS } from '@/desktop/ui/tokens';
import { EmptyState, Figure, Holder, IconButton, Skeleton } from '@/desktop/ui/primitives';

const TYPE_CONFIG: Record<AdminNotificationType, { icon: React.ElementType; tone: Tone }> = {
  deposit_needs_review: { icon: ArrowDownToLine, tone: 'info' },
  deposit_needs_correction: { icon: AlertCircle, tone: 'pending' },
  payment_ready: { icon: ArrowUpFromLine, tone: 'info' },
  payment_processing: { icon: Clock, tone: 'info' },
};

function relTime(dateStr: string) {
  const date = new Date(dateStr);
  if (isToday(date)) return format(date, "'Aujourd''hui à' HH:mm", { locale: fr });
  if (isYesterday(date)) return format(date, "'Hier à' HH:mm", { locale: fr });
  return format(date, "d MMM 'à' HH:mm", { locale: fr });
}

export function DesktopNotificationsMenu() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const { data: notifications, isLoading } = useAdminNotifications();

  const count = notifications?.length ?? 0;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setOpen(false);
      triggerRef.current?.focus();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const go = (path: string) => {
    setOpen(false);
    navigate(path);
  };

  return (
    <div className="relative">
      <span className="relative inline-flex">
        <IconButton
          ref={triggerRef}
          icon={Bell}
          label={count > 0 ? `Notifications — ${count} en attente` : 'Notifications'}
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-haspopup="dialog"
        />
        {count > 0 && (
          <span
            aria-hidden
            className={cn(
              'pointer-events-none absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center',
              'rounded-full bg-[#FE560D] px-1 text-[10px] font-bold leading-none tabular-nums text-white',
              // Ringed in the topbar's own colour so the badge reads as cut out
              // of the bar rather than floating on it.
              'ring-2 ring-white dark:ring-[#15141C]',
            )}
          >
            {count > 99 ? '99+' : count}
          </span>
        )}
      </span>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden />
          <div
            role="dialog"
            aria-label="Notifications"
            className={cn('absolute right-0 top-full z-50 mt-2 w-[380px] overflow-hidden rounded-xl border', DS.panel, DS.line, DS.float)}
          >
            <header className={cn('flex items-center justify-between gap-2 border-b px-4 py-2.5', DS.line)}>
              <span className={cn(DT.title, DFG.strong)}>
                Notifications{count > 0 ? ` · ${count}` : ''}
              </span>
              <button
                type="button"
                onClick={() => go('/m/more/notifications')}
                className={cn('rounded text-[12px] font-semibold text-[#6B5BD2] hover:underline dark:text-[#A99BF0]', DFOCUS)}
              >
                Voir tout
              </button>
            </header>

            <div className="max-h-[min(70vh,480px)] overflow-y-auto p-1.5">
              {isLoading ? (
                <div className="space-y-1 p-1.5">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="flex items-center gap-3 py-2">
                      <Skeleton className="h-8 w-8 shrink-0 rounded-lg" />
                      <div className="flex-1 space-y-1.5">
                        <Skeleton className="h-2.5 w-2/3" />
                        <Skeleton className="h-2.5 w-1/3" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : count > 0 ? (
                notifications!.map((n) => {
                  const cfg = TYPE_CONFIG[n.type];
                  return (
                    <button
                      key={n.id}
                      type="button"
                      onClick={() => go(n.targetPath)}
                      className={cn('flex w-full items-start gap-3 rounded-lg p-2.5 text-left transition-colors', DS.hover, DFOCUS)}
                    >
                      <Holder icon={cfg.icon} tone={cfg.tone} />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-start justify-between gap-2">
                          <span className={cn('truncate text-[12.5px] font-semibold', DFG.strong)}>{n.title}</span>
                          <Figure
                            value={n.currency === 'RMB' ? formatCurrencyRMB(n.amount) : formatXAF(n.amount)}
                            unit={n.currency === 'RMB' ? undefined : 'XAF'}
                            size="md"
                            className="shrink-0"
                          />
                        </span>
                        <span className={cn('mt-0.5 block truncate text-[11.5px]', DFG.muted)}>{n.subtitle}</span>
                        <span className={cn('mt-0.5 block text-[10.5px]', DFG.faint)}>{relTime(n.createdAt)}</span>
                      </span>
                    </button>
                  );
                })
              ) : (
                <EmptyState icon={Bell} title="Tout est à jour" hint="Aucun élément n'attend une action." className="py-10" />
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
