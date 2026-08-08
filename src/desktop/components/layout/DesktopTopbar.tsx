/**
 * Topbar — 52px of chrome that answers three questions at a glance:
 * *where am I* (breadcrumb), *what is the market doing* (live rate), and
 * *what needs me* (notifications). Everything else moved into ⌘K.
 *
 * The old topbar carried a 288px search field that duplicated the palette;
 * it is now a compact trigger, which gives the breadcrumb room and makes the
 * keyboard shortcut discoverable.
 */
import { useLocation } from 'react-router-dom';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { ChevronRight, Search } from 'lucide-react';
import { useActiveDailyRate } from '@/hooks/useDailyRates';
import { formatNumber } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import { DS, DT, DFG, DFOCUS } from '@/desktop/ui/tokens';
import { activeTrail } from './desktopNav';
import { DesktopNotificationsMenu } from './DesktopNotificationsMenu';

export function DesktopTopbar({ onOpenPalette }: { onOpenPalette: () => void }) {
  const { pathname } = useLocation();
  const { data: rate } = useActiveDailyRate();

  const trail = activeTrail(pathname);
  const today = format(new Date(), 'EEE d MMM', { locale: fr });

  return (
    <header
      className={cn(
        'sticky top-0 z-20 flex h-[52px] items-center gap-3 border-b px-7',
        DS.line,
        'bg-white/85 backdrop-blur-md dark:bg-[#15141C]/85',
      )}
    >
      {/* Breadcrumb */}
      <nav aria-label="Fil d'ariane" className="min-w-0">
        <ol className="flex min-w-0 items-center gap-1.5">
          <li className={cn(DT.label, DFG.muted, 'shrink-0')}>{trail.section}</li>
          <li aria-hidden className="shrink-0">
            <ChevronRight className={cn('h-3 w-3', DFG.muted)} />
          </li>
          <li aria-current="page" className={cn('truncate text-[13.5px] font-bold', DFG.strong)}>
            {trail.page}
          </li>
        </ol>
      </nav>

      <div className="ml-auto flex items-center gap-2">
        {/* Palette trigger */}
        <button
          type="button"
          onClick={onOpenPalette}
          className={cn(
            'flex h-8 w-[300px] items-center gap-2 rounded-lg border px-2.5 text-left transition-colors',
            DS.line,
            DS.well,
            DS.hover,
            DFOCUS,
          )}
        >
          <Search className={cn('h-3.5 w-3.5 shrink-0', DFG.muted)} />
          <span className={cn('flex-1 truncate text-[12.5px]', DFG.muted)}>Rechercher ou demander à Mola…</span>
          <kbd className={cn('shrink-0 rounded border px-1.5 py-px text-[10px] font-bold', DS.line, DS.card, DFG.muted)}>⌘K</kbd>
        </button>

        {/* Live rate — the single number the whole business turns on. */}
        {rate?.rate_alipay ? (
          /* The number the whole business turns on — it has to survive the
             1440px laptop the console is actually used on, not just 2xl. */
          <div className={cn('hidden items-center gap-1.5 rounded-lg border px-2.5 py-1.5 xl:flex', DS.line, DS.card)}>
            <span className="h-1.5 w-1.5 rounded-full bg-[#2E7D52] dark:bg-[#7FCBA0]" />
            {/* `rate_alipay` is CNY delivered per 1 000 000 XAF — the same unit
                the rates screen and the client flyer publish. */}
            <span className={cn('text-[12px] font-bold tabular-nums', DFG.strong)}>
              1 M XAF = {formatNumber(rate.rate_alipay, 2)} ¥
            </span>
            <span className={cn('hidden text-[11px] 2xl:inline', DFG.muted)}>· {today}</span>
          </div>
        ) : null}

        <DesktopNotificationsMenu />
      </div>
    </header>
  );
}
