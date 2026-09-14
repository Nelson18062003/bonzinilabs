/**
 * La barre du bas de l'app admin mobile — plate, aux valeurs du kit Figma
 * (docs/admin-redesign/mobile/01-figma-kit.md) : blanc, bord haut 1 px
 * #D9D9D9, aucune ombre, aucun flou.
 *
 * Cinq entrées, décision fondateur du 13/09/2026 : Mola · Cargo · Opérations
 * (Dépôts + Paiements réunis) · Clients · Plus. L'Accueil a disparu : il ne
 * faisait que répéter les compteurs que portent déjà les badges.
 *
 * Une entrée peut répondre à plusieurs routes (`match`) : Opérations est
 * active sur /m/ops, /m/deposits et /m/payments.
 */
import { useMemo } from 'react';
import { Link, matchPath, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Bot, Ship, ArrowLeftRight, Users, MoreHorizontal, type LucideIcon } from 'lucide-react';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { useAdminActionableCounts } from '@/hooks/useAdminNotifications';
import { useCargoShipments } from '@/hooks/useCargo';
import { alertTally } from '@/lib/cargo/palette';
import { cn } from '@/lib/utils';

interface Entry {
  to: string;
  match: string[];
  icon: LucideIcon;
  iconSrc?: string;
  label: string;
  badge?: number;
}

export const MOBILE_TAB_BAR_HEIGHT = 64;

export function MobileTabBar({ className }: { className?: string }) {
  const { t } = useTranslation('common');
  const location = useLocation();
  const { hasPermission } = useAdminAuth();
  const { data: counts } = useAdminActionableCounts();
  const ops = (counts?.deposits ?? 0) + (counts?.payments ?? 0);
  const { data: cargo } = useCargoShipments();
  const late = useMemo(() => (cargo ? alertTally(cargo).late : 0), [cargo]);

  const entries: Entry[] = [
    { to: '/m/assistant', match: ['/m/assistant'], icon: Bot, iconSrc: '/assets/mola-mascot-160.webp', label: t('assistant', { defaultValue: 'Mola' }) },
    ...(hasPermission('canViewCargo')
      ? [{ to: '/m/cargo', match: ['/m/cargo/*'], icon: Ship, label: t('cargo', { defaultValue: 'Cargo' }), badge: late } satisfies Entry]
      : []),
    { to: '/m/ops', match: ['/m/ops', '/m/deposits/*', '/m/payments/*'], icon: ArrowLeftRight, label: t('navOperations', { defaultValue: 'Opérations' }), badge: ops },
    { to: '/m/clients', match: ['/m/clients/*'], icon: Users, label: t('clients', { defaultValue: 'Clients' }) },
    { to: '/m/more', match: ['/m/more/*'], icon: MoreHorizontal, label: t('more', { defaultValue: 'Plus' }) },
  ];

  const isActive = (e: Entry) => e.match.some((m) => matchPath({ path: m, end: !m.endsWith('*') }, location.pathname) !== null);

  return (
    <nav
      aria-label="Navigation principale"
      className={cn(
        'mobile-tab-bar fixed inset-x-0 bottom-0 z-50 border-t border-[#D9D9D9] bg-white pb-[env(safe-area-inset-bottom)] dark:border-[#444444] dark:bg-[#1E1E1E]',
        className,
      )}
    >
      <div className="mx-auto flex max-w-lg items-stretch md:max-w-2xl" style={{ height: MOBILE_TAB_BAR_HEIGHT }}>
        {entries.map((e) => {
          const active = isActive(e);
          return (
            <Link
              key={e.to}
              to={e.to}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex min-w-0 flex-1 flex-col items-center justify-center gap-1 outline-none',
                active ? 'text-[#1E1E1E] dark:text-[#F5F5F5]' : 'text-[#5A5A5A] dark:text-[#CDCDCD]',
              )}
            >
              <span
                className={cn(
                  'relative flex h-8 w-14 items-center justify-center rounded-lg transition-colors',
                  active && 'bg-[#F5F5F5] dark:bg-[#383838]',
                )}
              >
                {e.iconSrc ? (
                  <img
                    src={e.iconSrc}
                    alt=""
                    aria-hidden="true"
                    className={cn('h-7 w-7 object-contain', !active && 'opacity-70 grayscale')}
                    onError={(ev) => { (ev.currentTarget as HTMLImageElement).style.display = 'none'; }}
                  />
                ) : (
                  <e.icon className="h-6 w-6" strokeWidth={active ? 2.25 : 2} />
                )}
                {e.badge != null && e.badge > 0 && (
                  <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[#EC221F] px-1 text-[12px] font-semibold leading-none text-white">
                    {e.badge > 99 ? '99+' : e.badge}
                  </span>
                )}
              </span>
              <span className={cn('max-w-full whitespace-nowrap text-[12px] leading-none tracking-[-0.02em] min-[360px]:text-[14px] min-[360px]:tracking-[-0.01em]', active ? 'font-semibold' : 'font-medium')}>{e.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
