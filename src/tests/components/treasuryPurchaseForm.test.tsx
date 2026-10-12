/**
 * Le nouvel achat d'USDT, sur ordinateur (12/10/2026).
 *
 * Retour de la direction : « une fenêtre au milieu, pas un panneau qui
 * sort », et « quand je mets plusieurs comptes, que ça totalise tout seul
 * et calcule les USDT reçus ». Ce qui doit tenir :
 *  · la saisie s'ouvre dans une fenêtre CENTRÉE ;
 *  · plusieurs comptes chiffrés → le total est leur somme, verrouillé ; le
 *    taux donne les USDT ;
 *  · un total connu et un seul compte sans montant → ce compte prend le reste ;
 *  · le dernier taux se reprend d'un clic ; un taux aberrant est signalé ;
 *  · ce qui part au serveur : les USDT et la répartition par compte.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';

const mutate = vi.fn();
const h = vi.hoisted(() => ({ last: null as null | { rate: number; at: string } }));
vi.mock('@/hooks/useTreasury', () => ({
  useCounterparties: () => ({ data: [{ id: 'sup1', display_name: 'Eric', short_id: 'F-01', phone: null, wechat_id: null }], isLoading: false, isError: false }),
  useTreasuryAccountBalances: () => ({
    data: [
      { id: 'acc1', label: 'Afriland', currency: 'XAF', balance: 20_000_000, is_active: true },
      { id: 'acc2', label: 'Orange Money', currency: 'XAF', balance: 3_000_000, is_active: true },
    ],
  }),
  useRecordUsdtPurchase: () => ({ mutate, isPending: false }),
  useUsdtWac: () => ({ data: 652 }),
  useLastPurchaseRate: () => ({ data: h.last }),
  useCreateCounterparty: () => ({ mutate: vi.fn(), isPending: false }),
}));
vi.mock('@/desktop/screens/treasury/OperationReceipt', () => ({
  OperationReceipt: () => null,
  ReceiptActions: () => null,
}));

import { PurchaseForm } from '@/desktop/screens/treasury/PurchaseForm';

const type = (el: HTMLElement, v: string) => fireEvent.change(el, { target: { value: v } });
const num = (el: HTMLElement) => (el as HTMLInputElement).value.replace(/\s/g, '');

function pick(trigger: HTMLElement, option: string) {
  fireEvent.click(trigger);
  fireEvent.click(screen.getByRole('option', { name: new RegExp(option) }));
}

beforeEach(() => {
  mutate.mockClear();
  h.last = null;
});

describe('Une fenêtre au centre', () => {
  it('le titre, la fenêtre modale, et pas de panneau collé au bord', () => {
    render(<PurchaseForm open onClose={() => undefined} />);
    const dialog = screen.getByRole('dialog', { name: 'Nouvel achat d’USDT' });
    expect(dialog.className).toContain('items-center');
    expect(dialog.className).toContain('justify-center');
    expect(dialog.querySelector('.right-0')).toBeNull();
  });

  it('fermer une saisie entamée demande confirmation', () => {
    const onClose = vi.fn();
    render(<PurchaseForm open onClose={onClose} />);
    type(screen.getByLabelText(/^Taux/), '655');
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Nouvel achat d’USDT' })).getAllByRole('button', { name: 'Fermer' })[1]);
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByText('Abandonner la saisie ?')).toBeTruthy();
  });
});

describe('Plusieurs comptes : le total se fait tout seul', () => {
  it('deux comptes chiffrés + le taux → total = somme, USDT calculés, envoi exact', () => {
    render(<PurchaseForm open onClose={() => undefined} />);
    pick(screen.getByRole('button', { name: 'Fournisseur' }), 'Eric');
    fireEvent.click(screen.getByRole('button', { name: /Plusieurs comptes/ }));
    pick(screen.getByRole('button', { name: 'Compte 1' }), 'Afriland');
    pick(screen.getByRole('button', { name: 'Compte 2' }), 'Orange Money');
    type(screen.getByLabelText('Montant payé par le compte 1'), '6000000');
    type(screen.getByLabelText('Montant payé par le compte 2'), '2000000');

    expect(num(screen.getByLabelText('Montant payé, somme des comptes'))).toBe('8000000');
    type(screen.getByLabelText(/^Taux/), '655');
    expect(num(screen.getByLabelText(/^USDT reçus/))).toBe('12213,74');
    expect(screen.getByText('Le compte est bon')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /Enregistrer l’achat/ }));
    expect(mutate).toHaveBeenCalledTimes(1);
    expect(mutate.mock.calls[0][0]).toMatchObject({
      supplier_id: 'sup1',
      usdt_amount: 12_213.74,
      account_splits: [
        { account_id: 'acc1', xaf_amount: 6_000_000 },
        { account_id: 'acc2', xaf_amount: 2_000_000 },
      ],
    });
  });

  it('USDT reçus sans taux → le taux se calcule sur la somme', () => {
    render(<PurchaseForm open onClose={() => undefined} />);
    fireEvent.click(screen.getByRole('button', { name: /Plusieurs comptes/ }));
    type(screen.getByLabelText('Montant payé par le compte 1'), '6000000');
    type(screen.getByLabelText('Montant payé par le compte 2'), '4000000');
    type(screen.getByLabelText(/^USDT reçus/), '15000');
    expect(num(screen.getByLabelText(/^Taux/))).toBe('666,67');
  });

  it('total connu + un compte chiffré → l’autre prend le reste', () => {
    render(<PurchaseForm open onClose={() => undefined} />);
    type(screen.getByLabelText(/^Montant payé \(total\)/), '10000000');
    fireEvent.click(screen.getByRole('button', { name: /Plusieurs comptes/ }));
    expect(screen.getByText(/Reste à répartir : 10 000 000 XAF/)).toBeTruthy();
    type(screen.getByLabelText('Montant payé par le compte 1'), '7500000');
    expect(num(screen.getByLabelText('Montant payé par le compte 2'))).toBe('2500000');
    expect(screen.getByText('le reste')).toBeTruthy();
  });

  it('un compte qui passerait sous zéro est signalé', () => {
    render(<PurchaseForm open onClose={() => undefined} />);
    fireEvent.click(screen.getByRole('button', { name: /Plusieurs comptes/ }));
    pick(screen.getByRole('button', { name: 'Compte 2' }), 'Orange Money');
    type(screen.getByLabelText('Montant payé par le compte 2'), '4000000');
    expect(screen.getByText(/Orange Money passera à -1\s000\s000 XAF/)).toBeTruthy();
  });
});

describe('Le taux', () => {
  it('le dernier taux se reprend d’un clic', () => {
    h.last = { rate: 655.4, at: '2026-10-10T10:00:00Z' };
    render(<PurchaseForm open onClose={() => undefined} />);
    type(screen.getByLabelText(/^Montant payé \(total\)/), '6554000');
    fireEvent.click(screen.getByRole('button', { name: 'Reprendre ce taux' }));
    expect(num(screen.getByLabelText(/^Taux/))).toBe('655,4');
    expect(num(screen.getByLabelText(/^USDT reçus/))).toBe('10000');
  });

  it('taux déjà calculé (total + USDT tapés) : pas de « Reprendre », qui recalculerait le total en silence', () => {
    h.last = { rate: 655.4, at: '2026-10-10T09:30:00Z' };
    render(<PurchaseForm open onClose={() => undefined} />);
    type(screen.getByLabelText(/^Montant payé \(total\)/), '6554000');
    type(screen.getByLabelText(/^USDT reçus/), '10000');
    expect(screen.queryByRole('button', { name: 'Reprendre ce taux' })).toBeNull();
  });

  it('un taux à 10 fois le dernier achat est signalé', () => {
    h.last = { rate: 655, at: '2026-10-10T10:00:00Z' };
    render(<PurchaseForm open onClose={() => undefined} />);
    type(screen.getByLabelText(/^Taux/), '6550');
    expect(screen.getByText(/Taux inhabituel : 900 % au-dessus du dernier achat/)).toBeTruthy();
  });
});
