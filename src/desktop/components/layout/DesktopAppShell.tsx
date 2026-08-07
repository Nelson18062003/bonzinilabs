/**
 * The desktop console shell: rail + topbar + work area.
 *
 * It owns two pieces of global state — whether the rail is collapsed (⌘B) and
 * whether the command palette is open (⌘K) — because both are app-wide and
 * every screen benefits from them without knowing they exist.
 *
 * Screens choose their own body layout: `Workspace` (a scrolling page) or
 * `Workbench` (a full-height list + inspector). The shell therefore does NOT
 * impose padding or a max width; that decision belongs to the screen. Screens
 * not yet migrated fall back to a padded, centred container (see
 * AdminRouteWrapper) so nothing looks broken mid-migration.
 *
 * Only mounted above the `lg` breakpoint, so it never needs responsive prefixes.
 */
import { ReactNode, useCallback, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { DS, LAYOUT } from '@/desktop/ui/tokens';
import { DesktopSidebar } from './DesktopSidebar';
import { DesktopTopbar } from './DesktopTopbar';
import { CommandPalette } from './CommandPalette';

const RAIL_KEY = 'bonzini-desktop-rail-collapsed';

export function DesktopAppShell({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(RAIL_KEY) === '1';
    } catch {
      return false;
    }
  });
  const [paletteOpen, setPaletteOpen] = useState(false);

  const toggleRail = useCallback(() => {
    setCollapsed((c) => {
      try {
        localStorage.setItem(RAIL_KEY, c ? '0' : '1');
      } catch {
        /* private mode — the preference just doesn't persist */
      }
      return !c;
    });
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      } else if (meta && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        toggleRail();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggleRail]);

  return (
    <div className={cn('min-h-screen', DS.canvas)}>
      <DesktopSidebar collapsed={collapsed} onToggleCollapsed={toggleRail} />
      <div
        style={{ paddingLeft: collapsed ? LAYOUT.railCollapsed : LAYOUT.railExpanded }}
        className="transition-[padding] duration-150"
      >
        <DesktopTopbar onOpenPalette={() => setPaletteOpen(true)} />
        {/* Screens are padded by default. A `Workbench` screen needs the whole
            viewport (its list scrolls internally), so it opts out by tagging
            itself `data-workbench` and the padding collapses. */}
        <main className="px-7 py-6 [&:has([data-workbench])]:p-0">{children}</main>
      </div>
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  );
}
