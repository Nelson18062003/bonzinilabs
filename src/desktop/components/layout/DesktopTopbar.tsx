/**
 * Sticky top bar for the desktop admin: current section title + date, a search
 * field, the live exchange-rate chip and a notifications bell. Purely chrome —
 * the title is derived from the route, the rest is shared app state.
 */
import { useLocation } from 'react-router-dom';
import { Search, Bell } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useActiveDailyRate } from '@/hooks/useDailyRates';
import { useAdminActionableCounts } from '@/hooks/useAdminNotifications';
import { SURFACE, TEXT } from '@/mobile/designKit';
import { formatNumber } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import { activeNavTitle } from './desktopNav';

export function DesktopTopbar() {
  const { pathname } = useLocation();
  const { data: rate } = useActiveDailyRate();
  const { data: counts } = useAdminActionableCounts();

  const title = activeNavTitle(pathname);
  const today = format(new Date(), 'EEEE d MMMM yyyy', { locale: fr });
  const subtitle = today.charAt(0).toUpperCase() + today.slice(1);
  const hasAlerts = (counts?.deposits ?? 0) + (counts?.payments ?? 0) > 0;

  return (
    <header
      className={cn(
        'sticky top-0 z-10 flex h-16 items-center gap-4 px-8 backdrop-blur',
        'border-b border-black/[0.05] dark:border-white/[0.06]',
        'bg-[#ECEAF7]/80 dark:bg-[#141320]/80',
      )}
    >
      <div className="min-w-0">
        <h1 className={cn('truncate text-[15px] font-extrabold', TEXT.strong)}>{title}</h1>
        <p className={cn('truncate text-[12px]', TEXT.muted)}>{subtitle}</p>
      </div>

      <div className="ml-auto flex items-center gap-2.5">
        <div className="relative hidden lg:block">
          <Search className={cn('pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2', TEXT.muted)} />
          {/* Desktop-only chrome (≥1024px): the iOS auto-zoom concern behind the
              form-field rule cannot occur here, and the pill styling is intentional. */}
          {/* eslint-disable-next-line no-restricted-syntax */}
          <input
            type="search"
            placeholder="Rechercher un client, une référence…"
            className={cn(
              'h-10 w-72 rounded-full pl-9 pr-4 text-[13px] outline-none placeholder:text-[#9B98AD]',
              SURFACE.card,
              SURFACE.shadow,
              TEXT.strong,
            )}
          />
        </div>

        {rate?.rate_alipay ? (
          <div className={cn('hidden items-center gap-2 rounded-full px-3.5 py-2 xl:flex', SURFACE.card, SURFACE.shadow)}>
            <span className="h-2 w-2 animate-pulse rounded-full bg-[#2E7D52]" />
            <span className={cn('text-[12px] font-bold', TEXT.strong)}>1 ¥ = {formatNumber(rate.rate_alipay)} XAF</span>
          </div>
        ) : null}

        <button
          type="button"
          aria-label="Notifications"
          className={cn('relative flex h-10 w-10 items-center justify-center rounded-full', SURFACE.card, SURFACE.shadow, TEXT.strong)}
        >
          <Bell className="h-[18px] w-[18px]" />
          {hasAlerts && (
            <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-[#FE560D] ring-2 ring-white dark:ring-[#211F2B]" />
          )}
        </button>
      </div>
    </header>
  );
}
