import { ReactNode } from 'react';
import { MobileTabBar } from './MobileTabBar';
import { cn } from '@/lib/utils';

interface MobileAppShellProps {
  children: ReactNode;
  showTabBar?: boolean;
  className?: string;
}

/**
 * Main wrapper for mobile admin screens.
 * Provides the tab bar navigation and proper spacing.
 */
export function MobileAppShell({
  children,
  showTabBar = true,
  className
}: MobileAppShellProps) {
  return (
    <div className={cn(
      "min-h-screen bg-background flex flex-col w-full",
      "max-w-lg mx-auto", // Max width for larger screens (tablet in portrait)
      className
    )}>
      <main className={cn(
        "flex-1",
        showTabBar && "pb-20" // Space for tab bar
      )}>
        {children}
      </main>
      {showTabBar && <MobileTabBar />}
    </div>
  );
}
