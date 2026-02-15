import { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface AnimatedPageProps {
  children: ReactNode;
  className?: string;
}

/**
 * Wraps page content with a subtle entry animation.
 * Uses the route pathname as key to re-trigger animation on navigation.
 */
export function AnimatedPage({ children, className }: AnimatedPageProps) {
  const location = useLocation();

  return (
    <div
      key={location.pathname}
      className={cn('animate-fade-in', className)}
    >
      {children}
    </div>
  );
}
