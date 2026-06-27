/**
 * Desktop topbar notifications bell + dropdown.
 *
 * Wires the previously-inert topbar bell to the same actionable feed as the
 * mobile notifications screen (useAdminNotifications): a count badge, and a
 * popover listing each item (deposit to review, payment ready, …). Clicking an
 * item navigates to its target and closes the menu; "Voir tout" opens the full
 * screen.
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, ArrowDownToLine, ArrowUpFromLine, AlertCircle, Clock, Loader2 } from 'lucide-react';
import { format, isToday, isYesterday } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useAdminNotifications, type AdminNotificationType } from '@/hooks/useAdminNotifications';
import { formatXAF } from '@/lib/formatters';
import { SURFACE, TEXT, type Tone, Holder } from '@/mobile/designKit';
import { cn } from '@/lib/utils';

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
  return format(date, "dd MMM 'à' HH:mm", { locale: fr });
}

export function DesktopNotificationsMenu() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const { data: notifications, isLoading } = useAdminNotifications();

  const count = notifications?.length ?? 0;
  const hasAlerts = count > 0;

  // Close on Escape, mirroring the global-search dropdown.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Notifications"
        aria-expanded={open}
        className={cn('relative flex h-10 w-10 items-center justify-center rounded-full', SURFACE.card, SURFACE.shadow, TEXT.strong)}
      >
        <Bell className="h-[18px] w-[18px]" />
        {hasAlerts && (
          <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#FE560D] px-1 text-[10px] font-bold tabular-nums text-white ring-2 ring-[#ECEAF7] dark:ring-[#141320]">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden />
          <div
            className={cn(
              'absolute right-0 top-full z-50 mt-2 w-[384px] overflow-hidden rounded-[20px]',
              SURFACE.card,
              'shadow-[0_18px_50px_-12px_rgba(46,32,92,0.35)] ring-1 ring-black/[0.06] dark:ring-white/[0.08]',
            )}
          >
            <header className="flex items-center justify-between gap-2 border-b border-black/[0.05] px-4 py-3 dark:border-white/[0.06]">
              <span className={cn('text-[14px] font-extrabold', TEXT.strong)}>
                Notifications{hasAlerts ? ` · ${count}` : ''}
              </span>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  navigate('/m/more/notifications');
                }}
                className="text-[12px] font-semibold text-[#6B5BD2] hover:underline dark:text-[#A99BF0]"
              >
                Voir tout
              </button>
            </header>

            <div className="max-h-[min(70vh,520px)] overflow-y-auto p-2">
              {isLoading ? (
                <div className="flex justify-center py-10">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : count > 0 ? (
                <div className="space-y-1">
                  {notifications!.map((n) => {
                    const cfg = TYPE_CONFIG[n.type];
                    return (
                      <button
                        key={n.id}
                        type="button"
                        onClick={() => {
                          setOpen(false);
                          navigate(n.targetPath);
                        }}
                        className="flex w-full items-start gap-3 rounded-2xl p-3 text-left transition hover:bg-black/[0.03] dark:hover:bg-white/[0.04]"
                      >
                        <Holder icon={cfg.icon} tone={cfg.tone} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <p className={cn('truncate text-[13px] font-semibold', TEXT.strong)}>{n.title}</p>
                            <p className={cn('shrink-0 text-[13px] font-bold tabular-nums', TEXT.strong)}>{formatXAF(n.amount)}</p>
                          </div>
                          <p className={cn('mt-0.5 truncate text-[12px]', TEXT.muted)}>{n.subtitle}</p>
                          <p className={cn('mt-0.5 text-[10px]', TEXT.muted)}>{relTime(n.createdAt)}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
                  <Holder icon={Bell} size="lg" />
                  <p className={cn('mt-3 text-[14px] font-bold', TEXT.strong)}>Tout est à jour</p>
                  <p className={cn('mt-1 text-[12px]', TEXT.muted)}>Aucun élément en attente d'action</p>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
