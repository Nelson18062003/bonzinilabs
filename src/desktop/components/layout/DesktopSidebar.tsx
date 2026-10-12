/**
 * Left sidebar — primary navigation for the dedicated desktop admin.
 *
 * Speaks the same Ofspace/Mola language as the rest of the app (design kit
 * tokens): white surface, soft shadow, dark "pill" for the active item,
 * neutral holders, restrained colour. Permission-gated via the nav model.
 *
 * Deux largeurs (choix de l'opérateur, voir sidebarState.ts) :
 *   · dépliée (256 px) : icône + libellé, titres de groupe ;
 *   · réduite (72 px)  : icônes seules — le libellé passe en infobulle, le
 *     compteur en pastille sur l'icône, les titres de groupe en filet.
 * Le bouton qui bascule vit en tête du menu, aux deux largeurs.
 */
import type { ReactNode } from 'react';
import { NavLink, useMatch, useNavigate, useResolvedPath } from 'react-router-dom';
import { LogOut, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { useAdminAuth, ADMIN_ROLE_LABELS } from '@/contexts/AdminAuthContext';
import { useAdminActionableCounts } from '@/hooks/useAdminNotifications';
import { SURFACE, TEXT, Avatar } from '@/desktop/designKit';
import { cn } from '@/lib/utils';
import { MolaMascot } from '@/components/MolaMascot';
import { BonziniLogo } from '@/components/BonziniLogo';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { DESKTOP_NAV, type DesktopNavItem } from './desktopNav';
import { sidebarShortcutLabel } from './sidebarState';

/** L'infobulle à droite du rail — seulement quand le libellé est caché. */
function RailTip({ show, label, children }: { show: boolean; label: ReactNode; children: ReactNode }) {
  if (!show) return <>{children}</>;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="right" sideOffset={10} className="text-[13px] font-semibold">
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

/**
 * Une entrée du menu. L'état « actif » est calculé ICI, en chaîne : sous
 * l'infobulle (TooltipTrigger asChild), Radix fusionne `className` en
 * texte — la forme fonction de NavLink y perdait son surlignage.
 */
function SidebarLink({ item, collapsed, badge }: { item: DesktopNavItem; collapsed: boolean; badge: number }) {
  const { pathname } = useResolvedPath(item.to);
  const isActive = !!useMatch({ path: pathname, end: !!item.end });
  const Icon = item.icon;
  return (
    <RailTip show={collapsed} label={badge > 0 ? `${item.label} · ${badge} à traiter` : item.label}>
      <NavLink
        to={item.to}
        end={item.end}
        className={cn(
          'relative mb-0.5 flex items-center rounded-xl text-[14px] font-medium outline-none transition focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
          collapsed ? 'mx-auto h-11 w-11 justify-center' : 'gap-3 px-3 py-2.5',
          isActive ? 'bg-primary text-primary-foreground' : cn(TEXT.strong, 'hover:bg-accent'),
        )}
      >
        {item.mascot ? (
          <MolaMascot className="h-[18px] w-[18px]" fallback={<Icon className="h-[18px] w-[18px]" />} />
        ) : (
          <Icon className="h-[18px] w-[18px]" />
        )}
        <span className={collapsed ? 'sr-only' : 'flex-1 truncate'}>{item.label}</span>
        {badge > 0 &&
          (collapsed ? (
            <span
              aria-hidden
              className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold leading-none text-white ring-2 ring-card"
            >
              {badge > 99 ? '99+' : badge}
            </span>
          ) : (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-md bg-destructive px-1.5 text-[11px] font-bold text-white">
              {badge}
            </span>
          ))}
      </NavLink>
    </RailTip>
  );
}

export function DesktopSidebar({ collapsed = false, onToggle }: { collapsed?: boolean; onToggle?: () => void }) {
  const navigate = useNavigate();
  const { currentUser, hasPermission, logout } = useAdminAuth();
  const { data: counts } = useAdminActionableCounts();

  const badgeFor = (item: DesktopNavItem) =>
    item.badge === 'deposits' ? counts?.deposits ?? 0 : item.badge === 'payments' ? counts?.payments ?? 0 : 0;

  const handleLogout = async () => {
    await logout();
    navigate('/m/login', { replace: true });
  };

  const fullName = `${currentUser?.firstName ?? ''} ${currentUser?.lastName ?? ''}`.trim();
  const toggleLabel = collapsed ? 'Déplier le menu' : 'Réduire le menu';
  const groups = DESKTOP_NAV.map((group) => ({
    ...group,
    items: group.items.filter((it) => !it.perm || hasPermission(it.perm)),
  })).filter((group) => group.items.length > 0);

  const toggleButton = onToggle && (
    <RailTip
      show
      label={
        <span className="flex items-center gap-2">
          {toggleLabel}
          <kbd className="rounded border border-black/10 px-1 font-sans text-[11px] font-medium opacity-70 dark:border-white/15">
            {sidebarShortcutLabel()}
          </kbd>
        </span>
      }
    >
      <button
        type="button"
        onClick={onToggle}
        aria-label={toggleLabel}
        aria-expanded={!collapsed}
        aria-controls="desktop-sidebar-nav"
        className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg outline-none transition hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring',
          TEXT.muted,
        )}
      >
        {collapsed ? <PanelLeftOpen className="h-[18px] w-[18px]" /> : <PanelLeftClose className="h-[18px] w-[18px]" />}
      </button>
    </RailTip>
  );

  return (
    <TooltipProvider delayDuration={150}>
      <aside
        aria-label="Menu principal"
        className={cn(
          'fixed inset-y-0 left-0 z-20 flex flex-col overflow-hidden transition-[width] duration-200 ease-out motion-reduce:transition-none',
          collapsed ? 'w-[72px]' : 'w-64',
          SURFACE.card,
          'border-r border-black/[0.06] dark:border-white/[0.06]',
        )}
      >
        {/* Brand + bascule */}
        {collapsed ? (
          <div className="flex flex-col items-center gap-2 px-3 pb-1 pt-6">
            <BonziniLogo size="sm" showText={false} className="shrink-0" />
            {toggleButton}
          </div>
        ) : (
          <div className="flex items-center gap-2.5 pb-2 pl-5 pr-3 pt-6">
            <BonziniLogo size="sm" showText={false} className="shrink-0" />
            <div className="min-w-0 flex-1 leading-tight">
              <p className={cn('text-[15px] font-black', TEXT.strong)}>Bonzini</p>
              <p className={cn('text-[11px] font-medium', TEXT.muted)}>Console admin</p>
            </div>
            {toggleButton}
          </div>
        )}

        {/* Nav */}
        <nav id="desktop-sidebar-nav" className="flex-1 overflow-y-auto overflow-x-hidden px-3 pb-4">
          {groups.map((group, gi) => (
            <div key={group.label} className="mb-1">
              {!collapsed ? (
                <p className={cn('px-3 pb-1.5 pt-5 text-[11px] font-bold uppercase tracking-wider', TEXT.muted, 'opacity-80')}>
                  {group.label}
                </p>
              ) : gi > 0 ? (
                <div aria-hidden className="mx-2 my-3 h-px bg-black/[0.08] dark:bg-white/[0.08]" />
              ) : (
                <div aria-hidden className="h-3" />
              )}
              {group.items.map((item) => (
                <SidebarLink key={item.to} item={item} collapsed={collapsed} badge={badgeFor(item)} />
              ))}
            </div>
          ))}
        </nav>

        {/* User card */}
        <div className="border-t border-black/[0.06] p-3 dark:border-white/[0.06]">
          {collapsed ? (
            <div className="flex flex-col items-center gap-1">
              <RailTip show label={fullName ? `${fullName} · Mon profil` : 'Mon profil'}>
                <button
                  type="button"
                  onClick={() => navigate('/m/more/profile')}
                  className="rounded-lg p-1 outline-none transition hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label="Mon profil"
                >
                  <Avatar name={fullName} size="sm" className="shrink-0" />
                </button>
              </RailTip>
              <RailTip show label="Se déconnecter">
                <button
                  type="button"
                  onClick={handleLogout}
                  aria-label="Se déconnecter"
                  className={cn('flex h-8 w-8 items-center justify-center rounded-lg outline-none transition hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring', TEXT.muted)}
                >
                  <LogOut className="h-[18px] w-[18px]" />
                </button>
              </RailTip>
            </div>
          ) : (
            <div className="flex items-center gap-3 rounded-xl px-2 py-2">
              <button
                type="button"
                onClick={() => navigate('/m/more/profile')}
                className="flex min-w-0 flex-1 items-center gap-3 rounded-lg px-1 py-1 text-left transition hover:bg-accent"
                aria-label="Mon profil"
              >
                <Avatar name={fullName} size="sm" className="shrink-0" />
                <div className="min-w-0 flex-1 leading-tight">
                  <p className={cn('truncate text-[13px] font-bold', TEXT.strong)}>
                    {currentUser?.firstName} {currentUser?.lastName}
                  </p>
                  <p className={cn('truncate text-[11px]', TEXT.muted)}>
                    {currentUser ? ADMIN_ROLE_LABELS[currentUser.role] : ''}
                  </p>
                </div>
              </button>
              <button
                type="button"
                onClick={handleLogout}
                aria-label="Se déconnecter"
                className={cn('flex h-8 w-8 items-center justify-center rounded-lg transition hover:bg-accent', TEXT.muted)}
              >
                <LogOut className="h-[18px] w-[18px]" />
              </button>
            </div>
          )}
        </div>
      </aside>
    </TooltipProvider>
  );
}
