/**
 * Harnais de capture — Trésorerie desktop.
 *
 * Monte les écrans RÉELS (ceux qui partent en production) avec les hooks
 * substitués par fixtures, dans la chrome desktop simplifiée. Sert à VOIR le
 * rendu et à itérer dessus : une refonte visuelle qu'on n'a pas regardée
 * n'est pas vérifiée.
 *
 * Lancement : SCREENSHOT_MOCK=1 npx vite --port 8081, puis /treasury-preview.html
 * La vue est choisie par ?view=operations|analysis|accounts|counterparties|purchase|sale
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from 'next-themes';
import { DesktopTreasuryScreen, type TreasuryView } from '@/desktop/screens/treasury/DesktopTreasuryScreen';
import { DesktopNewPurchase } from '@/desktop/screens/treasury/DesktopNewPurchase';
import { DesktopNewSale } from '@/desktop/screens/treasury/DesktopNewSale';
import '../index.css';

const params = new URLSearchParams(window.location.search);
const view = params.get('view') ?? 'operations';
const dark = params.get('theme') === 'dark';

function Screen() {
  if (view === 'purchase') return <DesktopNewPurchase />;
  if (view === 'sale') return <DesktopNewSale />;
  return <DesktopTreasuryScreen initialView={view as TreasuryView} />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider attribute="class" defaultTheme={dark ? 'dark' : 'light'} forcedTheme={dark ? 'dark' : 'light'}>
      <MemoryRouter>
        {/* MÊME racine que `DesktopAppShell` : la classe `admin-theme` porte
            les variables du design system. Le harnais peignait auparavant son
            propre fond (SURFACE.canvas) — il montrait donc un thème que la
            production n'a plus. */}
        <div className="admin-theme min-h-screen bg-background px-8 py-7 text-foreground">
          <Screen />
        </div>
      </MemoryRouter>
    </ThemeProvider>
  </StrictMode>,
);
