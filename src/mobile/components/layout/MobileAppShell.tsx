import { ReactNode } from 'react';
import { MobileTabBar } from './MobileTabBar';
import { AnimatedPage } from '@/components/transitions/AnimatedPage';
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
      "max-w-lg md:max-w-2xl mx-auto", // Wider on tablets
      className
    )}>
      <main className={cn(
        "flex-1",
        showTabBar && "pb-24" // Space for floating tab bar
      )}>
        <AnimatedPage>{children}</AnimatedPage>
      </main>
      {showTabBar && <MobileTabBar />}
    </div>
  );
}
