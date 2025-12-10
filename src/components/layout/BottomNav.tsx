import { NavLink } from '@/components/NavLink';
import { Wallet, ArrowDownToLine, Send, Clock, User } from 'lucide-react';

const navItems = [
  { to: '/', icon: Wallet, label: 'Wallet' },
  { to: '/deposits', icon: ArrowDownToLine, label: 'Dépôts' },
  { to: '/payments', icon: Send, label: 'Paiements' },
  { to: '/history', icon: Clock, label: 'Historique' },
  { to: '/profile', icon: User, label: 'Profil' },
];

export const BottomNav = () => {
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-xl border-t border-border safe-area-bottom max-w-md mx-auto">
      <div className="flex items-center justify-around py-2">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className="nav-item nav-item-inactive"
            activeClassName="nav-item-active"
          >
            <item.icon className="w-5 h-5" />
            <span className="text-xs font-medium">{item.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
};
