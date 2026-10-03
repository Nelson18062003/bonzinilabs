import { ReactNode } from 'react';
import { AgentCashTabBar } from './AgentCashTabBar';
import { AnimatedPage } from '@/components/transitions/AnimatedPage';
import { cn } from '@/lib/utils';
import { isNativeApp } from '@/lib/nativeApp';

/** Dans l'app BONZINI HQ, la barre d'onglets est native : celle du site se retire. */
const inApp = isNativeApp();

interface AgentCashShellProps {
  children: ReactNode;
  showTabBar?: boolean;
  className?: string;
}

export function AgentCashShell({
  children,
  showTabBar = true,
  className,
}: AgentCashShellProps) {
  return (
    <div className={cn(
      "min-h-screen bg-background flex flex-col w-full",
      "max-w-lg md:max-w-2xl mx-auto",
      className,
    )}>
      <main className={cn("flex-1", showTabBar && "pb-24")}>
        <AnimatedPage>{children}</AnimatedPage>
      </main>
      {showTabBar && !inApp && <AgentCashTabBar />}
    </div>
  );
}
