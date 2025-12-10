import { ReactNode } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface AdminFiltersProps {
  children: ReactNode;
  className?: string;
}

export function AdminFilters({ children, className }: AdminFiltersProps) {
  return (
    <div className={cn('admin-filters', className)}>
      {children}
    </div>
  );
}

interface AdminSearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function AdminSearchInput({ 
  value, 
  onChange, 
  placeholder = 'Rechercher...',
  className,
}: AdminSearchInputProps) {
  return (
    <div className={cn('relative flex-1', className)}>
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="admin-search-input"
      />
    </div>
  );
}
