/**
 * Left rail — the primary navigation of the desktop console.
 *
 * Three behaviours the old sidebar didn't have, all aimed at the same problem
 * ("the app has more screens than the rail can show"):
 *
 *  · **Collapsible sections.** Daily-driver sections (Pilotage, Opérations)
 *    are pinned open; Trésorerie / Relation / Système fold away and auto-open
 *    when you are inside them. An ops profile sees 6 links, a treasurer sees 8,
 *    a super admin can reach all 26 without ever visiting a hub page.
 *  · **Icon rail mode.** ⌘B collapses it to 60px so a wide table gets the
 *    pixels back. The choice is remembered.
 *  · **Permission-aware sections.** A section whose permission the role lacks
 *    disappears entirely instead of rendering an empty heading.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { ChevronDown, LogOut, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { useAdminAuth, ADMIN_ROLE_LABELS } from '@/contexts/AdminAuthContext';
import { useAdminActionableCounts } from '@/hooks/useAdminNotifications';
import { useAdminConversations } from '@/hooks/useAdminChat';
import { cn } from '@/lib/utils';
import { MolaMascot } from '@/components/MolaMascot';
import { BonziniLogo } from '@/components/BonziniLogo';
import { DS, DT, DFG, DFOCUS, LAYOUT } from '@/desktop/ui/tokens';
import { Avatar, IconButton } from '@/desktop/ui/primitives';
import { DESKTOP_NAV, activeSectionId, type DesktopNavItem } from './desktopNav';

const OPEN_KEY = 'bonzini-desktop-nav-open';

function readStored<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function DesktopSidebar({
  collapsed,
  onToggleCollapsed,
}: {
  collapsed: boolean;
  onToggleCollapsed: () => void;
}) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { currentUser, hasPermission, logout } = useAdminAuth();
  const { data: counts } = useAdminActionableCounts();
  const canSupport = hasPermission('canAccessSupportChat');
  const { data: conversations } = useAdminConversations();

  const supportUnread = useMemo(
    () => (canSupport ? (conversations ?? []).reduce((n, c) => n + (c.unread_count_admin || 0), 0) : 0),
    [canSupport, conversations],
  );

  const [openSections, setOpenSections] = useState<string[]>(() => readStored(OPEN_KEY, [] as string[]));

  /* The section you are working in is always open — you never have to hunt for
     the page you are already on. */
  const currentSection = activeSectionId(pathname);
  useEffect(() => {
    if (currentSection && !openSections.includes(currentSection)) {
      setOpenSections((prev) => {
        const next = [...prev, currentSection];
        localStorage.setItem(OPEN_KEY, JSON.stringify(next));
        return next;
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSection]);

  const toggleSection = useCallback((id: string) => {
    setOpenSections((prev) => {
      const next = prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id];
      localStorage.setItem(OPEN_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const badgeFor = (item: DesktopNavItem) =>
    item.badge === 'deposits' ? counts?.deposits ?? 0
    : item.badge === 'payments' ? counts?.payments ?? 0
    : item.badge === 'support' ? supportUnread
    : 0;

  const handleLogout = async () => {
    await logout();
    navigate('/m/login', { replace: true });
  };

  const sections = DESKTOP_NAV.map((section) => ({
    ...section,
    items: section.items.filter((it) => !it.perm || hasPermission(it.perm)),
  })).filter((section) => (!section.perm || hasPermission(section.perm)) && section.items.length > 0);

  return (
    <aside
      style={{ width: collapsed ? LAYOUT.railCollapsed : LAYOUT.railExpanded }}
      className={cn('fixed inset-y-0 left-0 z-30 flex flex-col border-r transition-[width] duration-150', DS.panel, DS.line)}
    >
      {/* Brand */}
      <div className={cn('flex h-[52px] shrink-0 items-center gap-2.5 border-b px-3', DS.line)}>
        <BonziniLogo size="sm" showText={false} className="shrink-0" />
        {!collapsed && (
          <div className="min-w-0 flex-1 leading-tight">
            <p className={cn('truncate text-[13px] font-extrabold', DFG.strong)}>Bonzini</p>
            <p className={cn('truncate text-[10.5px]', DFG.faint)}>Console d'opérations</p>
          </div>
        )}
        {!collapsed && (
          <IconButton icon={PanelLeftClose} label="Réduire la barre latérale (⌘B)" onClick={onToggleCollapsed} size="sm" />
        )}
      </div>

      {collapsed && (
        <div className="flex justify-center py-2">
          <IconButton icon={PanelLeftOpen} label="Déplier la barre latérale (⌘B)" onClick={onToggleCollapsed} size="sm" />
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden px-2 py-2">
        {sections.map((section) => {
          const open = section.pinned || openSections.includes(section.id);
          return (
            <div key={section.id} className="mb-1">
              {!collapsed &&
                (section.pinned ? (
                  <p className={cn(DT.micro, DFG.faint, 'px-2 pb-1 pt-3')}>{section.label}</p>
                ) : (
                  <button
                    type="button"
                    onClick={() => toggleSection(section.id)}
                    aria-expanded={open}
                    className={cn(
                      'mt-3 flex w-full items-center gap-1 rounded-md px-2 py-1 transition-colors',
                      DT.micro,
                      DFG.faint,
                      'hover:text-[#3B3750] dark:hover:text-[#C9C6D6]',
                      DFOCUS,
                    )}
                  >
                    <span className="flex-1 text-left">{section.label}</span>
                    <ChevronDown className={cn('h-3 w-3 transition-transform', !open && '-rotate-90')} />
                  </button>
                ))}

              {(open || collapsed) &&
                section.items.map((item) => {
                  const Icon = item.icon;
                  const badge = badgeFor(item);
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.end}
                      title={collapsed ? item.label : undefined}
                      className={({ isActive }) =>
                        cn(
                          'group relative mb-px flex h-8 items-center gap-2.5 rounded-lg text-[13px] font-medium transition-colors',
                          collapsed ? 'justify-center px-0' : 'px-2',
                          isActive
                            ? cn('bg-[#6B5BD2]/[0.10] font-semibold text-[#5B4CC4] dark:bg-[#A99BF0]/[0.14] dark:text-[#BCB1F7]')
                            : cn(DFG.base, DS.hover),
                          DFOCUS,
                        )
                      }
                    >
                      {item.mascot ? (
                        <MolaMascot className="h-4 w-4 shrink-0" fallback={<Icon className="h-4 w-4 shrink-0" />} />
                      ) : (
                        <Icon className="h-4 w-4 shrink-0" />
                      )}
                      {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
                      {badge > 0 && (
                        <span
                          className={cn(
                            'flex items-center justify-center rounded-full bg-[#FE560D] font-bold text-white tabular-nums',
                            collapsed
                              ? 'absolute right-1.5 top-1 h-1.5 w-1.5'
                              : 'h-[17px] min-w-[17px] px-1 text-[10px]',
                          )}
                        >
                          {collapsed ? '' : badge}
                        </span>
                      )}
                    </NavLink>
                  );
                })}
            </div>
          );
        })}
      </nav>

      {/* User */}
      <div className={cn('shrink-0 border-t p-2', DS.line)}>
        <div className={cn('flex items-center gap-2', collapsed && 'flex-col')}>
          <button
            type="button"
            onClick={() => navigate('/m/more/profile')}
            aria-label="Mon profil"
            className={cn('flex min-w-0 flex-1 items-center gap-2 rounded-lg p-1 text-left transition-colors', DS.hover, DFOCUS)}
          >
            <Avatar name={`${currentUser?.firstName ?? ''} ${currentUser?.lastName ?? ''}`} src={currentUser?.avatarUrl} />
            {!collapsed && (
              <span className="min-w-0 flex-1 leading-tight">
                <span className={cn('block truncate text-[12.5px] font-bold', DFG.strong)}>
                  {currentUser?.firstName} {currentUser?.lastName}
                </span>
                <span className={cn('block truncate text-[10.5px]', DFG.faint)}>
                  {currentUser ? ADMIN_ROLE_LABELS[currentUser.role] : ''}
                </span>
              </span>
            )}
          </button>
          <IconButton icon={LogOut} label="Se déconnecter" onClick={handleLogout} size="sm" />
        </div>
      </div>
    </aside>
  );
}
