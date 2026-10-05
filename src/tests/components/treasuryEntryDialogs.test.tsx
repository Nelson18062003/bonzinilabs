/**
 * Trésorerie desktop (refonte d'octobre 2026) — le contrat de l'écran :
 *
 *   · achat et vente s'ouvrent en PANNEAU par-dessus la rubrique courante,
 *     jamais dans une page à part ; la rubrique reste montée derrière ;
 *   · le formulaire tient sur un écran ; deux montants tapés, le troisième
 *     calculé ; rien n'est enregistré tant que la saisie est incomplète ;
 *   · une fois enregistré, le reçu s'affiche, prêt à copier en image ;
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

  it("à /purchase, le panneau « Nouvel achat d’USDT » s'ouvre PAR-DESSUS la trésorerie, sur un seul écran", async () => {
    mountAt('/m/more/treasury/purchase');
    const dialog = await screen.findByRole('dialog', { name: /Nouvel achat d’USDT/i });
    expect(screen.getByRole('heading', { level: 1, name: 'Trésorerie' })).toBeTruthy();
    const inside = within(dialog);
    for (const label of ['Fournisseur', 'USDT reçus', 'Taux', 'Montant payé', 'Payé depuis']) {
      expect(inside.getByText(label)).toBeTruthy();
    }
    expect(inside.getByRole('button', { name: 'Enregistrer l’achat' })).toBeTruthy();
  });

  it('à /sale, le panneau de vente montre le stock disponible', async () => {
    mountAt('/m/more/treasury/sale');
    const dialog = await screen.findByRole('dialog', { name: /Nouvelle vente d’USDT/i });
    expect(within(dialog).getByText('Acheteur')).toBeTruthy();
    expect(within(dialog).getByText(/Stock disponible/)).toBeTruthy();
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

  it("une saisie incomplète n'enregistre rien et dit ce qui manque", async () => {
    mountAt('/m/more/treasury/purchase');
    const dialog = await screen.findByRole('dialog', { name: /Nouvel achat d’USDT/i });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Enregistrer l’achat' }));
    expect((await within(dialog).findAllByText('Choisissez le fournisseur.')).length).toBeGreaterThan(0);
    expect(within(dialog).queryByRole('button', { name: /Copier l’image/ })).toBeNull();
  });

  it('deux montants tapés, le troisième se calcule (USDT × taux = XAF)', async () => {
    mountAt('/m/more/treasury/purchase');
    await screen.findByRole('dialog', { name: /Nouvel achat d’USDT/i });
    fireEvent.change(screen.getByLabelText('USDT reçus'), { target: { value: '12000' } });
    fireEvent.change(screen.getByLabelText('Taux'), { target: { value: '605,5' } });
    await waitFor(() => expect((screen.getByLabelText(/Montant payé/) as HTMLInputElement).value.replace(/\s/g, '')).toBe('7266000'));
  });

  it("après l'enregistrement, le reçu s'affiche, prêt à copier", async () => {
    mountAt('/m/more/treasury/purchase');
    const dialog = await screen.findByRole('dialog', { name: /Nouvel achat d’USDT/i });
    fireEvent.click(within(dialog).getByLabelText('Fournisseur'));
    fireEvent.click(await within(dialog).findByRole('option', { name: /Ibrahim/ }));
    fireEvent.change(screen.getByLabelText('USDT reçus'), { target: { value: '12000' } });
    fireEvent.change(screen.getByLabelText('Taux'), { target: { value: '605,5' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Compte 1' }));
    fireEvent.click(await within(dialog).findByRole('option', { name: /UBA/ }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Enregistrer l’achat' }));
    const receipt = await screen.findByRole('dialog', { name: /Reçu de l’achat/ });
    expect(within(receipt).getByRole('button', { name: /Copier l’image/ })).toBeTruthy();
    expect(within(receipt).getByText('ACH-3F2C9B12')).toBeTruthy();
    expect(within(receipt).getByText('Ibrahim Trading')).toBeTruthy();
  });

  it("un lien vers un achat réparti ouvre SON reçu, avec les deux comptes payeurs", async () => {
    mountAt('/m/more/treasury/operations/purchase/p2');
    const sheet = await screen.findByRole('dialog', { name: 'Achat d’USDT' });
    expect(within(sheet).getByText('UBA Cameroun')).toBeTruthy();
    expect(within(sheet).getByText('Orange Money Douala')).toBeTruthy();
    expect(within(sheet).getByRole('button', { name: /Copier l’image/ })).toBeTruthy();
  });

  it('un lien vers un compte ouvre SA page, avec ses mouvements', async () => {
    mountAt('/m/more/treasury/accounts/a2');
    expect(await screen.findByRole('heading', { name: 'UBA Cameroun' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Mouvements' })).toBeTruthy();
    expect(screen.getAllByText('Achat USDT · paiement').length).toBeGreaterThan(0);
  });
});
