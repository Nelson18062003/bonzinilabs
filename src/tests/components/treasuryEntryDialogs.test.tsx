/**
 * Trésorerie desktop (refonte d'octobre 2026) — le contrat de l'écran :
 *
 *   · achat et vente s'ouvrent en PANNEAU par-dessus la rubrique courante,
 *     jamais dans une page à part ; la rubrique reste montée derrière ;
 *   · le formulaire est en étapes numérotées, et « Vérifier et enregistrer »
 *     n'enregistre rien tant que la saisie est incomplète ;
 *   · l'URL est l'état : un lien vers une opération ouvre SA fiche, un lien
 *     vers un compte ouvre SA page.
 */
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/hooks/useTreasury', () => import('@/__screenshot__/mockTreasury'));
vi.mock('@/desktop/screens/treasury/TreasuryRateChart', () => ({ TreasuryRateChart: () => null }));
// Le sujet est l'écran, pas les droits : un super admin qui a tout.
vi.mock('@/contexts/AdminAuthContext', () => ({
  useAdminAuth: () => ({ hasPermission: () => true, currentUser: { role: 'super_admin' }, admin: null, loading: false }),
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

describe('Trésorerie desktop', () => {
  const originalError = console.error;
  beforeAll(() => {
    console.error = () => undefined;
  });
  afterAll(() => {
    console.error = originalError;
  });

  it("à /purchase, le panneau « Nouvel achat d’USDT » s'ouvre PAR-DESSUS la trésorerie, en quatre étapes", async () => {
    mountAt('/m/more/treasury/purchase');
    const dialog = await screen.findByRole('dialog', { name: /Nouvel achat d’USDT/i });
    expect(screen.getByRole('heading', { level: 1, name: 'Trésorerie' })).toBeTruthy();
    expect(screen.getByRole('navigation', { name: /Rubriques/i })).toBeTruthy();
    const inside = within(dialog);
    for (const step of ['Fournisseur', 'Montant', 'Payé depuis', 'Date et référence']) {
      expect(inside.getByRole('heading', { name: step })).toBeTruthy();
    }
    expect(inside.getByRole('button', { name: 'Vérifier et enregistrer' })).toBeTruthy();
  });

  it('à /sale, le panneau de vente montre le stock USDT pendant la saisie', async () => {
    mountAt('/m/more/treasury/sale');
    const dialog = await screen.findByRole('dialog', { name: /Nouvelle vente d’USDT/i });
    const inside = within(dialog);
    expect(inside.getByRole('heading', { name: 'Acheteur' })).toBeTruthy();
    expect(inside.getByText('Stock USDT')).toBeTruthy();
  });

  it('à /operations, aucune fenêtre', async () => {
    mountAt('/m/more/treasury/operations');
    await screen.findByRole('heading', { level: 1, name: 'Opérations' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('fermer un panneau vide ramène à la rubrique de fond, sans quitter le module', async () => {
    mountAt('/m/more/treasury/purchase');
    const dialog = await screen.findByRole('dialog', { name: /Nouvel achat d’USDT/i });
    fireEvent.click(within(dialog).getAllByRole('button', { name: 'Fermer' })[0]);
    await waitFor(() => expect(screen.getByTestId('pathname').textContent).toBe('/m/more/treasury'));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it("une saisie incomplète n'ouvre pas la confirmation et dit ce qui manque", async () => {
    mountAt('/m/more/treasury/purchase');
    const dialog = await screen.findByRole('dialog', { name: /Nouvel achat d’USDT/i });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Vérifier et enregistrer' }));
    expect(await within(dialog).findByText(/Il manque des informations/)).toBeTruthy();
    expect(within(dialog).getByText('Choisissez le fournisseur.')).toBeTruthy();
    expect(screen.queryByRole('dialog', { name: /Enregistrer cet achat/ })).toBeNull();
  });

  it("un lien vers un achat réparti ouvre SA fiche, avec les deux comptes payeurs", async () => {
    mountAt('/m/more/treasury/operations/purchase/p2');
    const panel = await screen.findByRole('button', { name: 'Fermer la fiche' });
    const aside = panel.closest('aside')!;
    expect(within(aside).getAllByText('UBA Cameroun').length).toBeGreaterThan(0);
    expect(within(aside).getAllByText('Orange Money Douala').length).toBeGreaterThan(0);
    expect(within(aside).getByRole('button', { name: /Annuler cette opération/ })).toBeTruthy();
  });

  it('un lien vers un compte ouvre SA page, avec ses mouvements', async () => {
    mountAt('/m/more/treasury/accounts/a2');
    expect(await screen.findByRole('heading', { name: 'UBA Cameroun' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Mouvements' })).toBeTruthy();
    expect(screen.getAllByText('Achat USDT · paiement').length).toBeGreaterThan(0);
  });
});
