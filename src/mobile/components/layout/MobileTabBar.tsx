import { NavLink } from '@/components/NavLink';
import {
  LayoutDashboard,
  ArrowDownToLine,
  ArrowUpFromLine,
  Users,
  MoreHorizontal
} from 'lucide-react';
import { cn } from '@/lib/utils';

const adminNavItems = [
  { to: '/m', icon: LayoutDashboard, label: 'Accueil' },
  { to: '/m/deposits', icon: ArrowDownToLine, label: 'Dépôts' },
  { to: '/m/payments', icon: ArrowUpFromLine, label: 'Paiements' },
  { to: '/m/clients', icon: Users, label: 'Clients' },
  { to: '/m/more', icon: MoreHorizontal, label: 'Plus' },
];

interface MobileTabBarProps {
  className?: string;
}

export function MobileTabBar({ className }: MobileTabBarProps) {
  return (
    <nav
      className={cn(
        "fixed bottom-0 left-0 right-0 z-50",
        "bg-card/95 backdrop-blur-xl border-t border-border",
        "pb-[max(env(safe-area-inset-bottom),0.5rem)]",
        className
      )}
    >
      <div className="flex items-center justify-around py-2">
        {adminNavItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/m'}
            className={cn(
              "flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-lg",
              "min-w-[64px] min-h-[44px]",
              "text-muted-foreground transition-colors"
            )}
            activeClassName="text-primary bg-primary/10"
          >
            <item.icon className="w-5 h-5" />
            <span className="text-[10px] font-medium leading-none">{item.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
