/**
 * Achat et vente USDT s'ouvrent EN FENÊTRE, par-dessus le module — pas dans
 * une page à part.
 *
 * RETOUR UTILISATEUR, mot pour mot : « je ne veux pas que ça ouvre tout un
 * nouvel écran… une longue formule inutile… montre-moi un formulaire qui
 * apparaît avec un fond flouté ». Ce test fixe le contrat :
 *
 *   · à `/treasury/purchase` et `/treasury/sale`, une boîte de dialogue est
 *     ouverte ET l'écran Trésorerie est toujours là derrière ;
 *   · à `/treasury/operations`, aucune boîte de dialogue ;
 *   · fermer la fenêtre ramène à la vue de fond, sans quitter le module ;
 *   · le formulaire est structuré en étapes numérotées, pas en cartes.
 */
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/hooks/useTreasury', () => import('@/__screenshot__/mockTreasury'));
vi.mock('@/desktop/screens/treasury/TreasuryRateChart', () => ({ TreasuryRateChart: () => null }));
// Le sujet est la fenêtre, pas les droits : un administrateur qui a tout.
vi.mock('@/contexts/AdminAuthContext', () => ({
  useAdminAuth: () => ({ hasPermission: () => true, admin: null, loading: false }),
}));

import { DesktopTreasuryScreen } from '@/desktop/screens/treasury/DesktopTreasuryScreen';

function LocationProbe() {
  const { pathname } = useLocation();
  return <div data-testid="pathname">{pathname}</div>;
}

function mountAt(pathname: string) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[pathname]}>
        <DesktopTreasuryScreen />
        <LocationProbe />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('Achat et vente USDT en fenêtre', () => {
  const originalError = console.error;
  beforeAll(() => {
    console.error = () => undefined;
  });
  afterAll(() => {
    console.error = originalError;
  });

  it("à /purchase, la fenêtre « Nouvel achat USDT » est ouverte PAR-DESSUS l'écran Trésorerie", async () => {
    mountAt('/m/more/treasury/purchase');
    const dialog = await screen.findByRole('dialog', { name: /Nouvel achat USDT/i });
    expect(dialog).toBeTruthy();
    // L'écran derrière est toujours monté : le module n'a pas été quitté.
    // (Radix le marque `aria-hidden` tant que la fenêtre est ouverte — c'est
    // précisément « derrière », d'où `hidden: true`.)
    expect(screen.getByRole('heading', { name: 'Trésorerie', hidden: true })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Opérations', hidden: true })).toBeTruthy();
    // Quatre décisions numérotées, pas quatre cartes équivalentes.
    const inside = within(dialog);
    expect(inside.getByText('Fournisseur')).toBeTruthy();
    expect(inside.getByText('Compte XAF débité')).toBeTruthy();
    expect(inside.getByText('Montant')).toBeTruthy();
    expect(inside.getByText('Date et référence')).toBeTruthy();
    expect(inside.getByRole('button', { name: "Enregistrer l'achat" })).toBeTruthy();
  });

  it('à /sale, la fenêtre « Nouvelle vente USDT » est ouverte, avec le stock après vente', async () => {
    mountAt('/m/more/treasury/sale');
    const dialog = await screen.findByRole('dialog', { name: /Nouvelle vente USDT/i });
    const inside = within(dialog);
    expect(inside.getByText('Acheteur')).toBeTruthy();
    expect(inside.getByText('Stock actuel → après')).toBeTruthy();
    expect(inside.getByRole('button', { name: 'Enregistrer la vente' })).toBeTruthy();
  });

  it('à /operations, aucune fenêtre', async () => {
    mountAt('/m/more/treasury/operations');
    await screen.findByRole('heading', { name: 'Trésorerie' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('fermer la fenêtre ramène sur la vue de fond, sans quitter le module', async () => {
    mountAt('/m/more/treasury/purchase');
    await screen.findByRole('dialog', { name: /Nouvel achat USDT/i });
    fireEvent.click(screen.getByRole('button', { name: 'Fermer' }));
    await waitFor(() => expect(screen.getByTestId('pathname').textContent).toBe('/m/more/treasury/operations'));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it("le bouton « Enregistrer » reste désactivé tant que la saisie n'est pas complète", async () => {
    mountAt('/m/more/treasury/purchase');
    const dialog = await screen.findByRole('dialog', { name: /Nouvel achat USDT/i });
    const submit = within(dialog).getByRole('button', { name: "Enregistrer l'achat" });
    expect((submit as HTMLButtonElement).disabled).toBe(true);
  });
});
