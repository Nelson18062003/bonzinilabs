import { ReactNode } from 'react';
import { BottomNav } from './BottomNav';

interface MobileLayoutProps {
  children: ReactNode;
  showNav?: boolean;
}

export const MobileLayout = ({ children, showNav = true }: MobileLayoutProps) => {
  return (
    <div className="min-h-screen bg-background flex flex-col max-w-md mx-auto">
      <main className={`flex-1 ${showNav ? 'pb-20' : ''}`}>
        {children}
      </main>
      {showNav && <BottomNav />}
    </div>
  );
};
