import { NavLink } from '@/components/NavLink';
import { BonziniLogo } from '@/components/BonziniLogo';
import { ThemeToggleCompact } from '@/components/ui/ThemeToggle';
import { useAuth } from '@/contexts/AuthContext';
import { useUnreadNotificationCount } from '@/hooks/useNotifications';
import { useNavigate } from 'react-router-dom';
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
  { to: '/wallet', icon: Wallet, label: 'Wallet' },
  { to: '/deposits', icon: ArrowDownToLine, label: 'Dépôts' },
  { to: '/payments', icon: Send, label: 'Paiements' },
  { to: '/history', icon: History, label: 'Historique' },
  { to: '/notifications', icon: Bell, label: 'Notifications' },
  { to: '/profile', icon: User, label: 'Profil' },
];

export function ClientSidebar() {
  const { signOut } = useAuth();
  const { data: unreadCount } = useUnreadNotificationCount();
  const navigate = useNavigate();

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
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
            activeClassName="bg-sidebar-accent text-sidebar-accent-foreground"
          >
            <item.icon className="w-5 h-5 flex-shrink-0" />
            <span className="flex-1">{item.label}</span>
            {item.to === '/notifications' && unreadCount && unreadCount > 0 && (
              <span className="min-w-[20px] h-5 px-1.5 flex items-center justify-center bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-3 py-4 border-t border-sidebar-border space-y-2">
        <div className="flex items-center justify-between px-3 py-1">
          <span className="text-xs text-sidebar-foreground/60">Thème</span>
          <ThemeToggleCompact />
        </div>
        <button
          onClick={() => { signOut(); navigate('/auth', { replace: true }); }}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-sidebar-foreground/70 hover:bg-destructive/10 hover:text-destructive transition-colors"
        >
          <LogOut className="w-5 h-5" />
          <span>Déconnexion</span>
        </button>
      </div>
    </aside>
  );
}
