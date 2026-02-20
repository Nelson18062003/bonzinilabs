import { ReactNode } from 'react';
import { BottomNav } from './BottomNav';
import { ClientHeader } from './ClientHeader';
import { ClientSidebar } from './ClientSidebar';
import { AnimatedPage } from '@/components/transitions/AnimatedPage';

interface MobileLayoutProps {
  children: ReactNode;
  showNav?: boolean;
  showHeader?: boolean;
}

export const MobileLayout = ({ children, showNav = true, showHeader = true }: MobileLayoutProps) => {
  return (
    <div className="min-h-[100dvh] bg-background flex">
      {/* Desktop Sidebar */}
      {showNav && <ClientSidebar />}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col w-full lg:pl-64">
        {showHeader && <ClientHeader className="lg:hidden" />}
        <main className={`flex-1 px-4 sm:px-6 lg:px-8 lg:py-6 lg:max-w-5xl lg:mx-auto lg:w-full ${showNav ? 'pb-24 lg:pb-8' : ''}`}>
          <AnimatedPage>{children}</AnimatedPage>
        </main>
        {showNav && <BottomNav className="lg:hidden" />}
      </div>
    </div>
  );
};
