import { type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MobileStatCardProps {
  icon: LucideIcon;
  iconColor: string;
  iconBg: string;
  value: string | number;
  label: string;
  onClick?: () => void;
  variant?: 'default' | 'premium';
  badge?: number;
  className?: string;
}

export function MobileStatCard({
  icon: Icon,
  iconColor,
  iconBg,
  value,
  label,
  onClick,
  variant = 'default',
  badge,
  className,
}: MobileStatCardProps) {
  const Component = onClick ? 'button' : 'div';

  if (variant === 'premium') {
    return (
      <Component
        onClick={onClick}
        className={cn(
          'admin-stat-card-premium text-left active:scale-[0.98] transition-transform',
          className
        )}
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-primary-foreground/80">{label}</p>
            <p className="text-3xl font-bold text-primary-foreground mt-1 tracking-tight">{value}</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-white/15 flex items-center justify-center">
            <Icon className="w-6 h-6 text-primary-foreground" />
          </div>
        </div>
      </Component>
    );
  }

  return (
    <Component
      onClick={onClick}
      className={cn(
        'admin-stat-card text-left active:scale-[0.98] transition-transform relative',
        className
      )}
    >
      {badge != null && badge > 0 && (
        <div className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-orange-500 flex items-center justify-center">
          <span className="text-[10px] font-bold text-white">{badge}</span>
        </div>
      )}
      <div className="flex items-center gap-2 mb-3">
        <div className={cn('admin-stat-icon', iconBg)}>
          <Icon className={cn('w-5 h-5', iconColor)} />
        </div>
      </div>
      <p className="admin-stat-value">{value}</p>
      <p className="admin-stat-label">{label}</p>
    </Component>
  );
}
