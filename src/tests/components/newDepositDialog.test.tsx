/**
 * « Nouveau dépôt » sur ordinateur (12/10/2026) : une fenêtre par-dessus la
 * liste des dépôts, plus un écran à part.
 *
 * Ce qui doit tenir :
 *  · la saisie est une fenêtre ;
 *  · venu de la fiche d'un client (?clientId=), le client est déjà choisi ;
 *  · la méthode, son type et la banque se choisissent d'un clic ;
 *  · ce qui part : le client, le montant, la méthode de la base, la banque ;
 *  · fermer une saisie entamée demande confirmation.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const createDeposit = vi.fn(async (_args: Record<string, unknown>) => ({ id: 'dep-1' }));
vi.mock('@/hooks/useAdminDeposits', () => ({
  useAllClients: () => ({
    data: [
      { user_id: 'u1', first_name: 'Jean-Paul', last_name: 'Mbarga', phone: '+237699000001', customer_code: 'BZ-000101', company_name: null, country: 'Cameroun' },
      { user_id: 'u2', first_name: 'Aïcha', last_name: 'Diallo', phone: '+237699000002', customer_code: 'BZ-000102', company_name: null, country: 'Cameroun' },
    ],
    isLoading: false,
  }),
  useAdminCreateDeposit: () => ({ mutateAsync: createDeposit, isPending: false }),
  useAdminWalletByUserId: () => ({ data: { balance_xaf: 250_000 } }),
}));

import { NewDepositDialog } from '@/desktop/screens/deposits/DesktopNewDeposit';

function open(route = '/m/deposits/new', onClose = vi.fn()) {
  const onCreated = vi.fn();
  render(
    <MemoryRouter initialEntries={[route]}>
      <NewDepositDialog onClose={onClose} onCreated={onCreated} />
    </MemoryRouter>,
  );
  return { onCreated, onClose };
}

const dialog = () => screen.getByRole('dialog', { name: 'Nouveau dépôt' });

beforeEach(() => createDeposit.mockClear());

describe('Une fenêtre dans « Dépôts »', () => {
  it('s’ouvre en fenêtre ; sans rien, « Créer » dit ce qui manque', () => {
    open();
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Créer le dépôt' }));
    expect(within(dialog()).getAllByText('Choisissez le client.').length).toBeGreaterThan(0);
    expect(createDeposit).not.toHaveBeenCalled();
  });

  it('venu de la fiche du client : il est déjà choisi, avec son solde', () => {
    open('/m/deposits/new?clientId=u1');
    const client = within(dialog()).getByRole('button', { name: 'Client' });
    expect(client.textContent).toContain('Jean-Paul Mbarga');
    expect(client.textContent).toContain('250 000 XAF');
  });

  it('fermer une saisie entamée demande confirmation', () => {
    const { onClose } = open();
    fireEvent.change(screen.getByLabelText('Montant du dépôt'), { target: { value: '50000' } });
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByText('Abandonner ce dépôt ?')).toBeTruthy();
  });
});

describe('Un dépôt en quelques clics', () => {
  it('Orange Money · code marchand → la bonne méthode part, le dépôt s’ouvre', async () => {
    const { onCreated } = open('/m/deposits/new?clientId=u1');
    fireEvent.change(screen.getByLabelText('Montant du dépôt'), { target: { value: '150 000' } });
    expect((screen.getByLabelText('Montant du dépôt') as HTMLInputElement).value).toBe('150 000');
    fireEvent.click(screen.getByRole('button', { name: /Orange Money/ }));
    fireEvent.click(screen.getByRole('button', { name: /Code marchand/ }));
    expect(screen.getByText('Coordonnées à donner au client')).toBeTruthy();

    fireEvent.click(within(dialog()).getByRole('button', { name: 'Créer le dépôt' }));
    await waitFor(() => expect(createDeposit).toHaveBeenCalledTimes(1));
    expect(createDeposit.mock.calls[0][0]).toMatchObject({ user_id: 'u1', amount_xaf: 150_000, method: 'om_withdrawal' });
    await waitFor(() => expect(onCreated).toHaveBeenCalledWith('dep-1'));
  });

  it('Banque · virement · Ecobank : la banque part avec son nom', async () => {
    open('/m/deposits/new?clientId=u1');
    fireEvent.click(screen.getByRole('button', { name: '1 000 000' }));
    fireEvent.click(screen.getByRole('button', { name: /Banque/ }));
    fireEvent.click(screen.getByRole('button', { name: /^Virement/ }));
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Créer le dépôt' }));
    expect(within(dialog()).getAllByText('Choisissez la banque.').length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: /Ecobank/ }));
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Créer le dépôt' }));
    await waitFor(() => expect(createDeposit).toHaveBeenCalledTimes(1));
    expect(createDeposit.mock.calls[0][0]).toMatchObject({ amount_xaf: 1_000_000, method: 'bank_transfer', bank_name: 'Ecobank Cameroun' });
  });

  it('chercher un client par son code BZ', () => {
    open();
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Client' }));
    fireEvent.change(screen.getByLabelText('Rechercher un client'), { target: { value: '000102' } });
    const options = screen.getAllByRole('option');
    expect(options).toHaveLength(1);
    expect(options[0].textContent).toContain('Aïcha Diallo');
  });
});
