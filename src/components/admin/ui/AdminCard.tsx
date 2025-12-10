import { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

interface AdminStatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: LucideIcon;
  iconColor?: string;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  className?: string;
  variant?: 'default' | 'primary';
}

export function AdminStatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  iconColor = 'text-primary',
  trend,
  className,
  variant = 'default',
}: AdminStatCardProps) {
  if (variant === 'primary') {
    return (
      <div className={cn('admin-stat-card-premium', className)}>
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-primary-foreground/80">{title}</p>
            <p className="text-3xl font-semibold tracking-tight text-primary-foreground mt-1">
              {value}
            </p>
            {subtitle && (
              <p className="text-sm text-primary-foreground/70 mt-1">{subtitle}</p>
            )}
          </div>
          {Icon && (
            <div className="h-12 w-12 rounded-xl bg-white/10 flex items-center justify-center">
              <Icon className="h-6 w-6 text-primary-foreground" />
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={cn('admin-stat-card', className)}>
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="admin-stat-value mt-1">{value}</p>
          {subtitle && (
            <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
          )}
          {trend && (
            <p className={cn(
              'text-xs font-medium mt-2',
              trend.isPositive ? 'text-emerald-600' : 'text-red-600'
            )}>
              {trend.isPositive ? '+' : ''}{trend.value}%
            </p>
          )}
        </div>
        {Icon && (
          <div className={cn('admin-stat-icon', iconColor.includes('bg-') ? iconColor : `bg-${iconColor.replace('text-', '')}/10`)}>
            <Icon className={cn('h-5 w-5', iconColor)} />
          </div>
        )}
      </div>
    </div>
  );
}

interface AdminCardProps {
  children: ReactNode;
  className?: string;
  clickable?: boolean;
  onClick?: () => void;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

export function AdminCard({ 
  children, 
  className, 
  clickable = false,
  onClick,
  padding = 'md',
}: AdminCardProps) {
  const paddingClasses = {
    none: '',
    sm: 'p-4',
    md: 'p-5',
    lg: 'p-6',
  };

  return (
    <div 
      className={cn(
        'admin-card',
        clickable && 'admin-card-clickable',
        paddingClasses[padding],
        className
      )}
      onClick={onClick}
    >
      {children}
    </div>
  );
}

interface AdminCardHeaderProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  icon?: LucideIcon;
  iconColor?: string;
  className?: string;
}

export function AdminCardHeader({
  title,
  subtitle,
  action,
  icon: Icon,
  iconColor = 'text-primary',
  className,
}: AdminCardHeaderProps) {
  return (
    <div className={cn('flex items-start justify-between gap-4 mb-4', className)}>
      <div className="flex items-center gap-3">
        {Icon && (
          <div className={cn('admin-stat-icon', `bg-${iconColor.replace('text-', '')}/10`)}>
            <Icon className={cn('h-5 w-5', iconColor)} />
          </div>
        )}
        <div>
          <h3 className="font-semibold text-foreground">{title}</h3>
          {subtitle && (
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          )}
        </div>
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  );
}
