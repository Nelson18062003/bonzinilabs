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
import { DesktopTreasuryScreen } from '@/desktop/screens/treasury/DesktopTreasuryScreen';
import { TREASURY_ROOT } from '@/desktop/screens/treasury/treasuryNav';
import '../index.css';

const params = new URLSearchParams(window.location.search);
const view = params.get('view') ?? 'operations';
const dark = params.get('theme') === 'dark';

// `purchase` et `sale` sont rendus par l'écran lui-même, en fenêtre
// par-dessus Opérations — exactement comme en production.
function Screen() {
  return <DesktopTreasuryScreen />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider attribute="class" defaultTheme={dark ? 'dark' : 'light'} forcedTheme={dark ? 'dark' : 'light'}>
      {/* La vue se lit dans l'URL : le harnais monte donc le routeur sur la
          route voulue, exactement comme la production. */}
      <MemoryRouter initialEntries={[`${TREASURY_ROOT}/${view}`]}>
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
