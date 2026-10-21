/**
 * La barre du bas de l'app admin mobile — plate, aux valeurs du kit Figma
 * (docs/admin-redesign/mobile/01-figma-kit.md) : blanc, bord haut 1 px
 * #D9D9D9, aucune ombre, aucun flou.
 *
 * Refonte v2 (21/10/2026, maquette 01-navigation/10) : une barre PAR RÔLE.
 *   · équipe : Accueil · Opérations · Clients · Cargo · Plus (Mola est un
 *     rond de l'Accueil et une case de Plus) ;
 *   · trésorier : Accueil · Trésorerie · Plus ;
 *   · commissionnaire agréé : À signer · Simulateur · Plus.
 * Les espaces de terrain (/r, /w, /a, /v) ont leur propre barre.
 *
 * Une entrée répond à plusieurs routes (`match`) ; la plus précise l'emporte
 * (/m/more/treasury allume Trésorerie, pas Plus).
 */
import { useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeftRight, Calculator, FileSignature, Home, MoreHorizontal, Ship, Users, Wallet, type LucideIcon } from 'lucide-react';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { useAdminActionableCounts } from '@/hooks/useAdminNotifications';
import { useCargoShipments } from '@/hooks/useCargo';
import { alertTally } from '@/lib/cargo/palette';
import { cn } from '@/lib/utils';

interface Entry {
  to: string;
  /** Préfixes qui allument l'entrée ; `=/m` : ce chemin exact seulement. */
  match: string[];
  icon: LucideIcon;
  label: string;
  badge?: number;
}

/** L'entrée active : le préfixe le plus long qui correspond au chemin. */
export function activeEntry<T extends { match: string[] }>(entries: T[], pathname: string): T | null {
  const path = pathname.replace(/\/+$/, '') || '/';
  let best: { e: T; len: number } | null = null;
  for (const e of entries) {
    for (const m of e.match) {
      const exact = m.startsWith('=');
      const p = exact ? m.slice(1) : m;
      const hit = exact ? path === p : path === p || path.startsWith(p + '/');
      if (hit && (!best || p.length > best.len)) best = { e, len: p.length };
    }
  }
  return best?.e ?? null;
}

export const MOBILE_TAB_BAR_HEIGHT = 64;

export function MobileTabBar({ className }: { className?: string }) {
  const { t } = useTranslation('common');
  const location = useLocation();
  const { currentUser, hasPermission } = useAdminAuth();
  const { data: counts } = useAdminActionableCounts();
  const ops = (counts?.deposits ?? 0) + (counts?.payments ?? 0);
  const { data: cargo } = useCargoShipments();
  const late = useMemo(() => (cargo ? alertTally(cargo).late : 0), [cargo]);

  const entries = useMemo<Entry[]>(() => {
    const plus: Entry = {
      to: '/m/more',
      match: ['/m/more', '/m/assistant', '/m/support', '/m/dashboard', '/m/douane', '/m/equipe'],
      icon: MoreHorizontal,
      label: t('more', { defaultValue: 'Plus' }),
    };
    if (currentUser?.role === 'treasurer') {
      return [
        { to: '/m', match: ['=/m'], icon: Home, label: t('home', { defaultValue: 'Accueil' }) },
        { to: '/m/more/treasury', match: ['/m/more/treasury'], icon: Wallet, label: t('treasury', { defaultValue: 'Trésorerie' }) },
        plus,
      ];
    }
    if (currentUser?.role === 'customs_broker') {
      return [
        { to: '/m/douane', match: ['=/m/douane', '/m/douane/revue', '/m/douane/audit'], icon: FileSignature, label: 'À signer' },
        { to: '/m/douane/simulateur', match: ['/m/douane/simulateur'], icon: Calculator, label: 'Simulateur' },
        { ...plus, match: ['/m/more', '/m/douane/veille', '/m/douane/routes'] },
      ];
    }
    const list: Entry[] = [{ to: '/m', match: ['=/m'], icon: Home, label: t('home', { defaultValue: 'Accueil' }) }];
    if (hasPermission('canViewDeposits') || hasPermission('canViewPayments')) {
      list.push({ to: '/m/ops', match: ['/m/ops', '/m/deposits', '/m/payments'], icon: ArrowLeftRight, label: t('navOperations', { defaultValue: 'Opérations' }), badge: ops });
    }
    if (hasPermission('canViewClients')) list.push({ to: '/m/clients', match: ['/m/clients'], icon: Users, label: t('clients', { defaultValue: 'Clients' }) });
    if (hasPermission('canViewCargo')) list.push({ to: '/m/cargo', match: ['/m/cargo'], icon: Ship, label: t('cargo', { defaultValue: 'Cargo' }), badge: late });
    list.push(plus);
    return list;
  }, [currentUser?.role, hasPermission, late, ops, t]);

  const current = activeEntry(entries, location.pathname);

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
          const active = current === e;
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
                className="relative flex h-8 w-14 items-center justify-center"
              >
                <e.icon className="h-6 w-6" strokeWidth={active ? 2.25 : 2} />
                {e.badge != null && e.badge > 0 && (
                  <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[#EC221F] px-1 text-[12px] font-semibold leading-none text-white">
                    {e.badge > 99 ? '99+' : e.badge}
                  </span>
                )}
              </span>
              <span className={cn('max-w-full whitespace-nowrap text-[12px] leading-none tracking-[-0.02em] min-[360px]:text-[13px] min-[360px]:tracking-[-0.02em] min-[400px]:text-[14px] min-[400px]:tracking-[-0.01em]', active ? 'font-semibold' : 'font-medium')}>{e.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
