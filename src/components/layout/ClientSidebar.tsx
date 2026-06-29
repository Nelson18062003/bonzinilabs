import { NavLink } from '@/components/NavLink';
import { BonziniLogo } from '@/components/BonziniLogo';
import { ThemeToggleCompact } from '@/components/ui/ThemeToggle';
import { useAuth } from '@/contexts/AuthContext';
import { useUnreadNotificationCount } from '@/hooks/useNotifications';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Wallet,
  ArrowDownToLine,
  Send,
  History,
  User,
  Bell,
  LogOut,
} from 'lucide-react';

const navItems = [
  { to: '/wallet', icon: Wallet, label: 'nav.wallet' },
  { to: '/deposits', icon: ArrowDownToLine, label: 'nav.deposits' },
  { to: '/payments', icon: Send, label: 'nav.payments' },
  { to: '/history', icon: History, label: 'nav.history' },
  { to: '/notifications', icon: Bell, label: 'nav.notifications' },
  { to: '/profile', icon: User, label: 'nav.profile' },
];

export function ClientSidebar() {
  const { signOut } = useAuth();
  const { data: unreadCount } = useUnreadNotificationCount();
  const navigate = useNavigate();
  const { t } = useTranslation('client');

  return (
    <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 bg-sidebar border-r border-sidebar-border">
      {/* Logo */}
      <div className="flex items-center h-16 px-6 border-b border-sidebar-border">
        <BonziniLogo size="sm" showText textPosition="right" />
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/wallet'}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            activeClassName="bg-[#EDEAFA] text-[#5B4CC4] dark:bg-[#272252] dark:text-[#B5AAF0]"
          >
            <item.icon className="w-5 h-5 flex-shrink-0" />
            <span className="flex-1">{t(item.label)}</span>
            {item.to === '/notifications' && unreadCount && unreadCount > 0 && (
              <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[#C0504D] px-1.5 text-[10px] font-bold text-white">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-3 py-4 border-t border-sidebar-border space-y-2">
        <div className="flex items-center justify-between px-3 py-1">
          <span className="text-xs text-sidebar-foreground/60">{t('nav.theme')}</span>
          <ThemeToggleCompact />
        </div>
        <button
          onClick={() => { signOut(); navigate('/auth', { replace: true }); }}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-sidebar-foreground/70 transition-colors hover:bg-[#FBE7E7] hover:text-[#C0504D] dark:hover:bg-[#3A2526] dark:hover:text-[#E79A9A]"
        >
          <LogOut className="w-5 h-5" />
          <span>{t('profile.logout')}</span>
        </button>
      </div>
    </aside>
  );
}
