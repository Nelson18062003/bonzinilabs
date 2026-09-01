/**
 * Un écran de route doit être montable SEUL.
 *
 * Régression réelle, arrivée en production : `DesktopAnalyticsDashboard`
 * appelait `useDateRange()` sans fournir `DateRangeProvider`. La page entière
 * tombait sur « useDateRange must be used within a DateRangeProvider ».
 *
 * Le pire n'était pas l'oubli, c'est que le HARNAIS DE CAPTURE ajoutait le
 * fournisseur de son côté : la capture s'affichait parfaitement pendant que la
 * production plantait. Un harnais qui fournit ce que l'application ne fournit
 * pas ne teste plus l'application.
 *
 * Ce test monte chaque écran de route EXACTEMENT comme `App.tsx` le fait :
 * routeur + client de requêtes, et rien d'autre. Tout contexte métier
 * supplémentaire doit venir de l'écran lui-même.
 */
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DesktopAnalyticsDashboard } from '@/desktop/screens/analytics';

// Les hooks tapent Supabase : on neutralise le réseau, le sujet du test est le
// montage, pas les données.
vi.mock('@/integrations/supabase/client', () => {
  const chain: Record<string, unknown> = {};
  const self = () => chain;
  Object.assign(chain, {
    from: self, select: self, eq: self, in: self, gte: self, lte: self, lt: self,
    order: self, limit: self, single: async () => ({ data: null, error: null }),
    then: (r: (v: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(r),
    rpc: async () => ({ data: null, error: null }),
    auth: { getUser: async () => ({ data: { user: null } }) },
  });
  return { supabase: chain, supabaseAdmin: chain };
});

function mountLikeApp(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('Les écrans de route sont autonomes', () => {
  // React journalise l'erreur avant que le test ne la voie : on tait le bruit
  // sans masquer l'échec, qui vient de `render` qui lève.
  const originalError = console.error;
  beforeAll(() => {
    console.error = () => undefined;
  });
  afterAll(() => {
    console.error = originalError;
  });

  it('DesktopAnalyticsDashboard fournit lui-même sa plage de dates', () => {
    // Sans `DateRangeProvider` fourni par l'appelant : c'est le cas réel de
    // `App.tsx`, et c'est ce qui plantait.
    expect(() => mountLikeApp(<DesktopAnalyticsDashboard />)).not.toThrow();
  });
});
