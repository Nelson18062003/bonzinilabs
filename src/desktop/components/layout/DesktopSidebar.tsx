/**
 * Left sidebar — primary navigation for the dedicated desktop admin.
 *
 * Speaks the same Ofspace/Mola language as the rest of the app (design kit
 * tokens): white surface, soft shadow, dark "pill" for the active item,
 * neutral holders, restrained colour. Permission-gated via the nav model.
 */
import { NavLink, useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { useAdminAuth, ADMIN_ROLE_LABELS } from '@/contexts/AdminAuthContext';
import { useAdminActionableCounts } from '@/hooks/useAdminNotifications';
import { SURFACE, TEXT } from '@/mobile/designKit';
import { cn } from '@/lib/utils';
import { DESKTOP_NAV, type DesktopNavItem } from './desktopNav';

function initials(first?: string, last?: string) {
  return `${first?.[0] ?? ''}${last?.[0] ?? ''}`.toUpperCase() || 'A';
}

export function DesktopSidebar() {
  const navigate = useNavigate();
  const { currentUser, hasPermission, logout } = useAdminAuth();
  const { data: counts } = useAdminActionableCounts();

  const badgeFor = (item: DesktopNavItem) =>
    item.badge === 'deposits' ? counts?.deposits ?? 0 : item.badge === 'payments' ? counts?.payments ?? 0 : 0;

  const handleLogout = async () => {
    await logout();
    navigate('/m/login', { replace: true });
  };

  return (
    <aside
      className={cn(
        'fixed inset-y-0 left-0 z-20 flex w-64 flex-col',
        SURFACE.card,
        'shadow-[1px_0_0_rgba(46,32,92,0.06)] dark:shadow-none dark:ring-1 dark:ring-white/[0.06]',
      )}
    >
      {/* Brand */}
      <div className="flex items-center gap-2.5 px-5 pb-2 pt-6">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[hsl(258_100%_60%)] to-[hsl(16_100%_55%)] text-[17px] font-black text-white">
          B
        </div>
        <div className="leading-tight">
          <p className={cn('text-[15px] font-black', TEXT.strong)}>Bonzini</p>
          <p className={cn('text-[11px] font-medium', TEXT.muted)}>Console admin</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 pb-4">
        {DESKTOP_NAV.map((group) => {
          const items = group.items.filter((it) => !it.perm || hasPermission(it.perm));
          if (items.length === 0) return null;
          return (
            <div key={group.label} className="mb-1">
              <p className={cn('px-3 pb-1.5 pt-5 text-[11px] font-bold uppercase tracking-wider', TEXT.muted, 'opacity-80')}>
                {group.label}
              </p>
              {items.map((item) => {
                const Icon = item.icon;
                const badge = badgeFor(item);
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) =>
                      cn(
                        'mb-0.5 flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] font-medium transition',
                        isActive
                          ? cn(
                              'bg-[#1C1B22] text-white dark:bg-[#F2F1F7] dark:text-[#1B1A24]',
                              'shadow-[0_8px_30px_-12px_rgba(46,32,92,0.25)]',
                            )
                          : cn(TEXT.strong, 'hover:bg-[#EDEAFA]/70 dark:hover:bg-white/[0.06]'),
                      )
                    }
                  >
                    <Icon className="h-[18px] w-[18px]" />
                    <span className="flex-1 truncate">{item.label}</span>
                    {badge > 0 && (
                      <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[#FE560D] px-1.5 text-[11px] font-bold text-white">
                        {badge}
                      </span>
                    )}
                  </NavLink>
                );
              })}
            </div>
          );
        })}
      </nav>

      {/* User card */}
      <div className="border-t border-black/[0.06] p-3 dark:border-white/[0.06]">
        <div className="flex items-center gap-3 rounded-xl px-2 py-2">
          <div className={cn('flex h-9 w-9 items-center justify-center rounded-full text-[13px] font-bold', SURFACE.holder)}>
            {initials(currentUser?.firstName, currentUser?.lastName)}
          </div>
          <div className="min-w-0 flex-1 leading-tight">
            <p className={cn('truncate text-[13px] font-bold', TEXT.strong)}>
              {currentUser?.firstName} {currentUser?.lastName}
            </p>
            <p className={cn('truncate text-[11px]', TEXT.muted)}>
              {currentUser ? ADMIN_ROLE_LABELS[currentUser.role] : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            aria-label="Se déconnecter"
            className={cn('flex h-8 w-8 items-center justify-center rounded-lg transition hover:bg-[#EDEAFA]/70 dark:hover:bg-white/[0.06]', TEXT.muted)}
          >
            <LogOut className="h-[18px] w-[18px]" />
          </button>
        </div>
      </div>
    </aside>
  );
}
