// ============================================================
// ClientTabBar — barre de navigation du bas de l'app CLIENT (refonte « Direction A »).
// SOBRE : carte blanche flottante + ombre douce, onglet actif = pastille lilas
// (#8B5CF6, le langage « sélection » de l'app — chips de filtre). Remplace la
// « liquid glass » CÔTÉ CLIENT uniquement. La LiquidTabBar reste utilisée par
// l'admin (MobileTabBar / AgentCashTabBar) — volontairement NON touchée.
// API identique (TabItem[] + badges) → branchement direct dans BottomNav.
// ============================================================
import { Link, useLocation, matchPath } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { SURFACE, TEXT } from '@/mobile/designKit';
import type { LiquidTabBarProps } from './types';

export function ClientTabBar({ items, className }: LiquidTabBarProps) {
  const location = useLocation();

  return (
    <nav
      className={cn('fixed inset-x-3 z-50', className)}
      style={{ bottom: 'max(env(safe-area-inset-bottom, 0px), 0.5rem)' }}
      aria-label="Navigation principale"
    >
      <div className={cn('flex items-center justify-around rounded-[26px] px-1 py-2', SURFACE.card, SURFACE.shadow)}>
        {items.map((item) => {
          const active = matchPath({ path: item.to, end: item.end ?? false }, location.pathname) !== null;
          const badge = item.badgeCount ?? 0;
          return (
            <Link
              key={item.to}
              to={item.to}
              aria-current={active ? 'page' : undefined}
              className="relative flex flex-1 flex-col items-center gap-1 rounded-2xl py-0.5 outline-none transition active:scale-95 focus-visible:ring-2 focus-visible:ring-[#C9C2F0] dark:focus-visible:ring-[#4A4660]"
            >
              {/* Indicateur actif : pastille lilas derrière l'icône (icône blanche). */}
              <span
                className={cn(
                  'flex h-8 items-center justify-center rounded-full transition-all duration-300',
                  active ? 'w-11 bg-[#8B5CF6]' : 'w-8',
                )}
              >
                <item.icon
                  className={cn('h-[18px] w-[18px] transition-colors', active ? 'text-white' : TEXT.muted)}
                  strokeWidth={active ? 2.4 : 2}
                />
              </span>
              <span className={cn('text-[10px] font-bold leading-none transition-colors', active ? TEXT.strong : TEXT.muted)}>
                {item.label}
              </span>
              {badge > 0 && (
                <span className="absolute right-1.5 top-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#C0504D] px-1 text-[9px] font-bold text-white">
                  {badge > 9 ? '9+' : badge}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
