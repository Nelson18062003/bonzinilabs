import { NavLink } from '@/components/NavLink';
import { Wallet, ArrowDownToLine, Send, History, User } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { to: '/', icon: Wallet, label: 'Wallet' },
  { to: '/deposits', icon: ArrowDownToLine, label: 'Dépôts' },
  { to: '/payments', icon: Send, label: 'Paiements' },
  { to: '/history', icon: History, label: 'Historique' },
  { to: '/profile', icon: User, label: 'Profil' },
];

interface BottomNavProps {
  className?: string;
}

export const BottomNav = ({ className }: BottomNavProps) => {
  return (
    <nav className={cn(
      "fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-xl border-t border-border",
      "pb-[max(env(safe-area-inset-bottom),0.5rem)]",
      className
    )}>
      <div className="flex items-center justify-around py-2 max-w-5xl mx-auto">
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
