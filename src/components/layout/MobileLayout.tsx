import { ReactNode } from 'react';
import { BottomNav } from './BottomNav';
import { ClientHeader } from './ClientHeader';

interface MobileLayoutProps {
  children: ReactNode;
  showNav?: boolean;
  showHeader?: boolean;
}

export const MobileLayout = ({ children, showNav = true, showHeader = true }: MobileLayoutProps) => {
  return (
    <div className="min-h-screen bg-background flex flex-col w-full lg:max-w-5xl lg:mx-auto">
      {showHeader && <ClientHeader />}
      <main className={`flex-1 px-4 sm:px-6 lg:px-8 ${showNav ? 'pb-20 lg:pb-8' : ''}`}>
        {children}
      </main>
      {showNav && <BottomNav className="lg:hidden" />}
    </div>
  );
};
