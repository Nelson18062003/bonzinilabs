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
import { useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { DS, LAYOUT } from '@/desktop/ui/tokens';
import { DesktopSidebar } from './DesktopSidebar';
import { DesktopTopbar } from './DesktopTopbar';
import { CommandPalette } from './CommandPalette';
import { activeTrail } from './desktopNav';

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
  const { pathname } = useLocation();

  /* Operators run six console tabs at once — deposits, payments, treasury,
     support. Without this they are six identical "Bonzini" tabs. */
  useEffect(() => {
    const trail = activeTrail(pathname);
    document.title = `${trail.page} · ${trail.section} — Bonzini`;
  }, [pathname]);

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
      if (e.isComposing) return;
      const meta = e.metaKey || e.ctrlKey;
      if (!meta) return;
      // `e.code` rather than `e.key`: under Cmd, `key` is layout-dependent on
      // AZERTY and Dvorak.
      if (e.code === 'KeyK') {
        e.preventDefault();
        setPaletteOpen((o) => !o);
        return;
      }
      if (e.code === 'KeyB') {
        // Ctrl+B is a text-navigation binding in form fields, and jolting the
        // rail behind an open modal is never what the operator meant.
        const el = e.target as HTMLElement | null;
        if (paletteOpen || el?.closest('input, textarea, [contenteditable="true"]')) return;
        e.preventDefault();
        toggleRail();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggleRail, paletteOpen]);

  return (
    <div className={cn('min-h-screen', DS.canvas)}>
      {/* While the palette is open the console behind it is not reachable —
          say so, or a screen reader walks straight into it in browse mode. */}
      <div {...(paletteOpen ? { inert: '' } : {})}>
      <DesktopSidebar collapsed={collapsed} onToggleCollapsed={toggleRail} />
      <div
        style={{ paddingLeft: collapsed ? LAYOUT.railCollapsed : LAYOUT.railExpanded }}
        className="transition-[padding] duration-150 motion-reduce:transition-none"
      >
        <DesktopTopbar onOpenPalette={() => setPaletteOpen(true)} />
        {/* Screens are padded by default. A `Workbench` screen needs the whole
            viewport (its list scrolls internally), so it opts out by tagging
            itself `data-workbench` and the padding collapses. */}
        <main className="px-7 py-6 [&:has([data-workbench])]:p-0">{children}</main>
      </div>
      </div>
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  );
}
