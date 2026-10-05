/**
 * Harnais de capture — Trésorerie desktop.
 *
 * Monte les écrans RÉELS (ceux qui partent en production) avec les hooks
 * substitués par fixtures, dans la chrome desktop simplifiée. Sert à VOIR le
 * rendu et à itérer dessus : une refonte visuelle qu'on n'a pas regardée
 * n'est pas vérifiée.
 *
 * Lancement : SCREENSHOT_MOCK=1 npx vite --port 8081, puis /treasury-preview.html
 * La vue est le chemin sous la trésorerie : ?view=operations/purchase/p2,
 * ?view=accounts/a2, ?view=purchase… (vide = vue d'ensemble) ; ?type= est
 * transmis tel quel (filtre des opérations, des contreparties).
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from 'next-themes';
import { DesktopTreasuryScreen } from '@/desktop/screens/treasury/DesktopTreasuryScreen';
import { TREASURY_ROOT } from '@/desktop/screens/treasury/treasuryNav';
import '../index.css';
// DM Sans servie localement : le harnais tourne sans accès à Google Fonts, et
// une capture en police de repli ne montre pas l'écran réel.
import '@fontsource/dm-sans/latin-400.css';
import '@fontsource/dm-sans/latin-500.css';
import '@fontsource/dm-sans/latin-600.css';
import '@fontsource/dm-sans/latin-700.css';
import '@fontsource/dm-sans/latin-800.css';

const params = new URLSearchParams(window.location.search);
const view = params.get('view') ?? '';
const type = params.get('type');
const initialPath = `${TREASURY_ROOT}${view ? `/${view}` : ''}${type ? `?type=${type}` : ''}`;
const dark = params.get('theme') === 'dark';

// `purchase` et `sale` sont rendus par l'écran lui-même, en panneau
// par-dessus la rubrique — exactement comme en production.
function Screen() {
  return <DesktopTreasuryScreen />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider attribute="class" defaultTheme={dark ? 'dark' : 'light'} forcedTheme={dark ? 'dark' : 'light'}>
      {/* La vue se lit dans l'URL : le harnais monte donc le routeur sur la
          route voulue, exactement comme la production. */}
      <MemoryRouter initialEntries={[initialPath]}>
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
