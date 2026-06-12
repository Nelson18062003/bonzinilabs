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
        // Tab-bar screens clear the floating nav; drill-in screens still need
        // to clear the iOS home indicator / Android gesture bar (safe-area).
        showTabBar ? "pb-24" : "pb-[env(safe-area-inset-bottom)]"
      )}>
        <AnimatedPage>{children}</AnimatedPage>
      </main>
      {showTabBar && <MobileTabBar />}
    </div>
  );
}
