import { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { DesktopSidebar } from './DesktopSidebar';
import { DesktopTopbar } from './DesktopTopbar';
import { useSidebarCollapsed } from './sidebarState';

/**
 * Main wrapper for the dedicated desktop admin: a fixed left sidebar (which
 * collapses to an icon rail, see sidebarState.ts), a sticky top bar and a
 * centred content frame that uses the full width of the screen (capped at
 * 1400px so lines never get unreadable on ultra-wide monitors).
 *
 * Only mounted above the `lg` breakpoint (see useIsDesktop / AdminRouteWrapper),
 * so it never needs responsive prefixes itself.
 */
export function DesktopAppShell({ children }: { children: ReactNode }) {
  // Le menu se réduit en rail d'icônes (bouton en tête du menu, ou Ctrl/⌘ + B)
  // pour rendre la largeur aux tableaux ; le contenu suit.
  const [collapsed, toggleSidebar] = useSidebarCollapsed();
  return (
    // `admin-theme` : variables shadcn alignées sur la bibliothèque de
    // référence (voir src/index.css). Portée à l'admin desktop — l'app client
    // et la landing page gardent leur charte.
    <div className={cn('admin-theme min-h-screen bg-background text-foreground')}>
      <DesktopSidebar collapsed={collapsed} onToggle={toggleSidebar} />
      <div className={cn('transition-[padding] duration-200 ease-out motion-reduce:transition-none', collapsed ? 'pl-[72px]' : 'pl-64')}>
        <DesktopTopbar />
        <main className="mx-auto max-w-[1400px] px-8 py-7">{children}</main>
      </div>
    </div>
  );
}
