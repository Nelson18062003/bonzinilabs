import { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { ChevronRight } from 'lucide-react';

// ============================================================
// RESPONSIVE GRID
// ============================================================
interface AdminResponsiveGridProps {
  children: ReactNode;
  className?: string;
  /** Default: 1 column on mobile, 2 on sm, 3 on lg, 4 on xl */
  cols?: 1 | 2 | 3 | 4 | 6;
}

export function AdminResponsiveGrid({ 
  children, 
  className,
  cols = 4 
}: AdminResponsiveGridProps) {
  const colsClasses = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
    6: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6',
  };

  return (
    <div className={cn('grid gap-4', colsClasses[cols], className)}>
      {children}
    </div>
  );
}

// ============================================================
// RESPONSIVE TABLE WRAPPER (Horizontal scroll on mobile)
// ============================================================
interface AdminResponsiveTableProps {
  children: ReactNode;
  className?: string;
}

export function AdminResponsiveTable({ children, className }: AdminResponsiveTableProps) {
  return (
    <div className={cn('overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0', className)}>
      <div className="min-w-[600px] sm:min-w-0">
        {children}
      </div>
    </div>
  );
}

// ============================================================
// MOBILE CARD (Used for list items on mobile instead of table rows)
// ============================================================
interface AdminMobileCardProps {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  showChevron?: boolean;
}

export function AdminMobileCard({ 
  children, 
  className,
  onClick,
  showChevron = true 
}: AdminMobileCardProps) {
  return (
    <Card 
      className={cn(
        'cursor-pointer hover:shadow-md transition-all active:scale-[0.99]',
        className
      )}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            {children}
          </div>
          {showChevron && onClick && (
            <ChevronRight className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-1" />
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================
// RESPONSIVE HEADER (Actions stack on mobile)
// ============================================================
interface AdminResponsiveHeaderProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  className?: string;
}

export function AdminResponsiveHeader({ 
  title, 
  subtitle, 
  actions,
  className 
}: AdminResponsiveHeaderProps) {
  return (
    <div className={cn(
      'flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between',
      className
    )}>
      <div className="min-w-0">
        <h1 className="text-xl sm:text-2xl font-bold text-foreground truncate">{title}</h1>
        {subtitle && (
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        )}
      </div>
      {actions && (
        <div className="flex flex-wrap gap-2 shrink-0">
          {actions}
        </div>
      )}
    </div>
  );
}

// ============================================================
// RESPONSIVE FILTERS BAR
// ============================================================
interface AdminResponsiveFiltersProps {
  children: ReactNode;
  className?: string;
}

export function AdminResponsiveFilters({ children, className }: AdminResponsiveFiltersProps) {
  return (
    <Card className={className}>
      <CardContent className="p-3 sm:p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
          {children}
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================
// RESPONSIVE STAT CARD GRID
// ============================================================
interface AdminStatGridProps {
  children: ReactNode;
  className?: string;
}

export function AdminStatGrid({ children, className }: AdminStatGridProps) {
  return (
    <div className={cn(
      'grid gap-3 sm:gap-4',
      'grid-cols-2 sm:grid-cols-2 lg:grid-cols-4',
      className
    )}>
      {children}
    </div>
  );
}

// ============================================================
// RESPONSIVE TWO COLUMN LAYOUT
// ============================================================
interface AdminTwoColumnLayoutProps {
  children: ReactNode;
  className?: string;
}

export function AdminTwoColumnLayout({ children, className }: AdminTwoColumnLayoutProps) {
  return (
    <div className={cn(
      'grid gap-4 sm:gap-6',
      'grid-cols-1 lg:grid-cols-2',
      className
    )}>
      {children}
    </div>
  );
}

// ============================================================
// RESPONSIVE BUTTON GROUP (Full width on mobile)
// ============================================================
interface AdminButtonGroupProps {
  children: ReactNode;
  className?: string;
}

export function AdminButtonGroup({ children, className }: AdminButtonGroupProps) {
  return (
    <div className={cn(
      'flex flex-col gap-2 sm:flex-row sm:gap-2',
      '[&>button]:w-full sm:[&>button]:w-auto',
      className
    )}>
      {children}
    </div>
  );
}

// ============================================================
// HIDE ON MOBILE / SHOW ON MOBILE
// ============================================================
interface ResponsiveVisibilityProps {
  children: ReactNode;
  className?: string;
}

export function HideOnMobile({ children, className }: ResponsiveVisibilityProps) {
  return (
    <div className={cn('hidden sm:block', className)}>
      {children}
    </div>
  );
}

export function ShowOnMobile({ children, className }: ResponsiveVisibilityProps) {
  return (
    <div className={cn('block sm:hidden', className)}>
      {children}
    </div>
  );
}

// ============================================================
// RESPONSIVE SCROLL CONTAINER (For horizontal scrolling chips/filters)
// ============================================================
interface AdminScrollContainerProps {
  children: ReactNode;
  className?: string;
}

export function AdminScrollContainer({ children, className }: AdminScrollContainerProps) {
  return (
    <div className={cn(
      'flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 sm:flex-wrap',
      'scrollbar-hide',
      className
    )}>
      {children}
    </div>
  );
}
