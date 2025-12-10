import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface AdminTableProps {
  children: ReactNode;
  className?: string;
  clickable?: boolean;
}

export function AdminTableWrapper({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('admin-table-wrapper overflow-x-auto', className)}>
      {children}
    </div>
  );
}

export function AdminTable({ children, className, clickable = false }: AdminTableProps) {
  return (
    <table className={cn('admin-table', clickable && 'admin-table-clickable', className)}>
      {children}
    </table>
  );
}

export function AdminTableHeader({ children, className }: { children: ReactNode; className?: string }) {
  return <thead className={className}>{children}</thead>;
}

export function AdminTableBody({ children, className }: { children: ReactNode; className?: string }) {
  return <tbody className={className}>{children}</tbody>;
}

export function AdminTableRow({ 
  children, 
  className,
  onClick,
}: { 
  children: ReactNode; 
  className?: string;
  onClick?: () => void;
}) {
  return (
    <tr 
      className={cn(onClick && 'cursor-pointer', className)}
      onClick={onClick}
    >
      {children}
    </tr>
  );
}

export function AdminTableHead({ 
  children, 
  className,
  align = 'left',
}: { 
  children: ReactNode; 
  className?: string;
  align?: 'left' | 'center' | 'right';
}) {
  return (
    <th className={cn(
      align === 'center' && 'text-center',
      align === 'right' && 'text-right',
      className
    )}>
      {children}
    </th>
  );
}

export function AdminTableCell({ 
  children, 
  className,
  align = 'left',
}: { 
  children: ReactNode; 
  className?: string;
  align?: 'left' | 'center' | 'right';
}) {
  return (
    <td className={cn(
      align === 'center' && 'text-center',
      align === 'right' && 'text-right',
      className
    )}>
      {children}
    </td>
  );
}

// Empty state for tables
interface AdminTableEmptyProps {
  message?: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
  colSpan?: number;
}

export function AdminTableEmpty({ 
  message = 'Aucune donnée',
  description,
  icon,
  action,
  colSpan = 1,
}: AdminTableEmptyProps) {
  return (
    <tr>
      <td colSpan={colSpan}>
        <div className="admin-empty-state">
          {icon && <div className="admin-empty-state-icon">{icon}</div>}
          <p className="admin-empty-state-title">{message}</p>
          {description && <p className="admin-empty-state-description">{description}</p>}
          {action && <div className="mt-4">{action}</div>}
        </div>
      </td>
    </tr>
  );
}
