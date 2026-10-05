/**
 * Harnais de capture — Sources des clients (création de client, écran
 * Sources & commerciaux). Écrans RÉELS, hooks remplacés par des fixtures.
 *
 * Lancement : SCREENSHOT_MOCK=1 npx vite, puis /sources-preview.html?path=/m/clients/sources
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import '@/i18n';
import '../index.css';
import '@fontsource/dm-sans/latin-400.css';
import '@fontsource/dm-sans/latin-500.css';
import '@fontsource/dm-sans/latin-600.css';
import '@fontsource/dm-sans/latin-700.css';
import '@fontsource/dm-sans/latin-800.css';
import { ClientSourcesScreen } from '@/components/clients/sources/ClientSourcesScreen';
import { DesktopCreateClient } from '@/desktop/screens/clients/DesktopCreateClient';
import { MobileCreateClient } from '@/mobile/screens/clients/MobileCreateClient';

const params = new URLSearchParams(window.location.search);
const path = params.get('path') ?? '/m/clients/sources';
const mobile = params.get('mobile') === '1';
const qc = new QueryClient();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider attribute="class" defaultTheme="light" forcedTheme="light">
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={[path]}>
          <div className={mobile ? 'min-h-screen bg-background text-foreground' : 'admin-theme min-h-screen bg-background px-8 py-7 text-foreground'}>
            <Routes>
              <Route path="/m/clients/sources" element={<ClientSourcesScreen />} />
              <Route path="/m/clients/sources/:sourceId" element={<ClientSourcesScreen />} />
              <Route path="/m/clients/new" element={mobile ? <MobileCreateClient /> : <DesktopCreateClient />} />
            </Routes>
          </div>
        </MemoryRouter>
      </QueryClientProvider>
    </ThemeProvider>
  </StrictMode>,
);
