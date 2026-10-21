/**
 * La barre du bas des espaces de terrain (réception /r, entrepôt /w) — la
 * même barre plate que celle de l'équipe (MobileTabBar, refonte v2) : blanc,
 * filet haut, icône et libellé, l'onglet actif en encre, une pastille rouge.
 * Elle remplace la LiquidTabBar (pilule flottante) sur ces deux espaces.
 * À remonter dans le kit si d'autres espaces (agent cash, commercial) la prennent.
 */
import { Link, useLocation } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { activeEntry, MOBILE_TAB_BAR_HEIGHT } from '@/mobile/components/layout/MobileTabBar';

export interface RoleTab {
  to: string;
  icon: LucideIcon;
  label: string;
  badgeCount?: number;
  /** Ce chemin exact seulement (l'accueil d'un espace). */
  end?: boolean;
  /** D'autres préfixes qui allument l'onglet. */
  also?: string[];
}

export function RoleTabBar({ items, ariaLabel = 'Navigation' }: { items: RoleTab[]; ariaLabel?: string }) {
  const { pathname } = useLocation();
  const entries = items.map((i) => ({ ...i, match: [i.end ? `=${i.to}` : i.to, ...(i.also ?? [])] }));
  const current = activeEntry(entries, pathname);
  return (
    <nav aria-label={ariaLabel} className="fixed inset-x-0 bottom-0 z-50 border-t border-[#D9D9D9] bg-white pb-[env(safe-area-inset-bottom)] dark:border-[#444444] dark:bg-[#1E1E1E]">
      <div className="mx-auto flex max-w-lg items-stretch md:max-w-2xl" style={{ height: MOBILE_TAB_BAR_HEIGHT }}>
        {entries.map((e) => {
          const active = current === e;
          const Icon = e.icon;
          return (
            <Link
              key={e.to}
              to={e.to}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#2C2C2C] dark:focus-visible:ring-[#E3E3E3]',
                active ? 'text-[#1E1E1E] dark:text-[#F5F5F5]' : 'text-[#5A5A5A] dark:text-[#CDCDCD]',
              )}
            >
              <span className="relative flex h-8 w-14 items-center justify-center">
                <Icon className="h-6 w-6" strokeWidth={active ? 2.25 : 2} />
                {e.badgeCount != null && e.badgeCount > 0 && (
                  <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[#EC221F] px-1 text-[12px] font-semibold leading-none text-white">
                    {e.badgeCount > 99 ? '99+' : e.badgeCount}
                  </span>
                )}
              </span>
              <span className={cn('max-w-full truncate whitespace-nowrap text-[14px] leading-none tracking-[-0.01em]', active ? 'font-semibold' : 'font-medium')}>{e.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
