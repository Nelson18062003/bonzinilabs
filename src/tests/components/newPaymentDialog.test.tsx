/**
 * « Nouveau paiement » sur ordinateur (12/10/2026) : une fenêtre par-dessus
 * la liste, et des coordonnées de bénéficiaire saisies AVEC leur format.
 *
 * Ce qui doit tenir :
 *  · la saisie est une fenêtre (dialog), pas une page ;
 *  · Alipay : le compte est un téléphone à indicatif (+86 …) ou un email —
 *    et l'email est proposé ; coller une adresse dans le champ bascule seul
 *    sur « Email » ;
 *  · un ID WeChat hors des règles de WeChat est refusé, et le dit ;
 *  · ce qui part : l'identifiant mis en forme, son type, l'email en
 *    minuscules, le montant et le taux du jour.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

const createPayment = vi.fn(async (_args: Record<string, unknown>) => ({ payment_id: 'pay-1' }));
const createBeneficiary = vi.fn(async (_args: Record<string, unknown>) => ({ id: 'ben-1' }));

vi.mock('@/integrations/supabase/client', () => ({
  supabaseAdmin: {
    from: () => ({ select: async () => ({ data: [{ user_id: 'u1', balance_xaf: 5_000_000, overdraft_limit_xaf: 0 }], error: null }) }),
  },
}));
vi.mock('@/hooks/useAdminDeposits', () => ({
  useAllClients: () => ({
    data: [{ user_id: 'u1', first_name: 'Clarisse', last_name: 'Ngo Bell', phone: '+237699000000', customer_code: 'BZ-000123', company_name: null, country: 'Cameroun' }],
    isLoading: false,
  }),
}));
vi.mock('@/hooks/useDailyRates', () => ({
  useActiveDailyRate: () => ({ data: { rate_alipay: 11_530, rate_wechat: 11_530, rate_virement: 11_500, rate_cash: 11_400 } }),
  useRateAdjustments: () => ({ data: [] }),
}));
vi.mock('@/hooks/useAdminPayments', () => ({
  useAdminCreatePayment: () => ({ mutateAsync: createPayment, isPending: false }),
}));
vi.mock('@/hooks/useBeneficiaries', () => ({
  useAdminClientBeneficiaries: () => ({ data: [] }),
  useAdminClientBeneficiaryNames: () => ({ data: [] }),
  useAdminCreateBeneficiary: () => ({ mutateAsync: createBeneficiary, isPending: false }),
}));

import { NewPaymentDialog } from '@/desktop/screens/payments/DesktopNewPayment';

function open(onCreated = vi.fn()) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <NewPaymentDialog onClose={() => undefined} onCreated={onCreated} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return onCreated;
}

const type = (el: HTMLElement, v: string) => fireEvent.change(el, { target: { value: v } });

async function fillClientAndAmount(method: RegExp) {
  fireEvent.click(screen.getByRole('button', { name: 'Client' }));
  // Le solde arrive après coup : sans lui, « solde insuffisant » bloquerait (à raison).
  await screen.findByRole('option', { name: /5 000 000 XAF/ });
  fireEvent.click(screen.getByRole('option', { name: /Clarisse Ngo Bell/ }));
  fireEvent.click(screen.getByRole('button', { name: method }));
  type(screen.getByLabelText('Le client paie (XAF)'), '1000000');
  fireEvent.click(screen.getByRole('tab', { name: 'Nouveau' }));
}

beforeEach(() => {
  createPayment.mockClear();
  createBeneficiary.mockClear();
});

describe('Une fenêtre, pas une page', () => {
  it('« Nouveau paiement » s’ouvre en fenêtre', () => {
    open();
    expect(screen.getByRole('dialog', { name: 'Nouveau paiement' })).toBeTruthy();
  });

  it('confirmer sans rien : on dit ce qui manque, rien ne part', () => {
    open();
    fireEvent.click(screen.getByRole('button', { name: 'Confirmer le paiement' }));
    expect(within(screen.getByRole('dialog', { name: 'Nouveau paiement' })).getAllByText('Choisissez le client.').length).toBeGreaterThan(0);
    expect(createPayment).not.toHaveBeenCalled();
  });
});

describe('Alipay : téléphone à indicatif, ou email', () => {
  it('un mobile chinois → « +86 138 0219 4471 », type phone, et l’email de contact en minuscules', async () => {
    const onCreated = open();
    await fillClientAndAmount(/Alipay/);
    expect(screen.getByDisplayValue('11 530')).toBeTruthy();

    type(screen.getByLabelText('Compte Alipay (téléphone)'), '13802194471');
    expect(screen.getByText('Le partenaire lira : +86 138 0219 4471')).toBeTruthy();
    type(screen.getByLabelText(/^Email/), 'Zhang.Wei@163.COM');

    fireEvent.click(screen.getByRole('button', { name: 'Confirmer le paiement' }));
    await waitFor(() => expect(createPayment).toHaveBeenCalledTimes(1));
    expect(createPayment.mock.calls[0][0]).toMatchObject({
      user_id: 'u1',
      method: 'alipay',
      amount_xaf: 1_000_000,
      amount_rmb: 11_530,
      beneficiary_identifier: '+86 138 0219 4471',
      beneficiary_identifier_type: 'phone',
      beneficiary_email: 'zhang.wei@163.com',
    });
    expect(createBeneficiary.mock.calls[0][0]).toMatchObject({ identifier: '+86 138 0219 4471', identifier_type: 'phone', email: 'zhang.wei@163.com' });
    await waitFor(() => expect(onCreated).toHaveBeenCalledWith('pay-1'));
  });

  it('coller une adresse dans le compte bascule sur « Email »', async () => {
    open();
    await fillClientAndAmount(/Alipay/);
    const input = screen.getByLabelText('Compte Alipay (téléphone)');
    fireEvent.paste(input, { clipboardData: { getData: () => 'Li.Na@QQ.com' } });
    expect((screen.getByLabelText('Compte Alipay (Email)') as HTMLInputElement).value).toBe('li.na@qq.com');
    expect(screen.getByRole('radio', { name: 'Email' }).getAttribute('aria-checked')).toBe('true');
  });

  it('un mobile trop court est refusé, avec la raison', async () => {
    open();
    await fillClientAndAmount(/Alipay/);
    type(screen.getByLabelText('Compte Alipay (téléphone)'), '1380219');
    expect(screen.getByText(/Un mobile chinois compte 11 chiffres/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Confirmer le paiement' }));
    expect(createPayment).not.toHaveBeenCalled();
  });
});

describe('WeChat : les règles de l’ID', () => {
  it('un ID qui commence par un chiffre est refusé', async () => {
    open();
    await fillClientAndAmount(/WeChat/);
    type(screen.getByLabelText('Compte WeChat (ID WeChat)'), '8zhangwei');
    expect(screen.getByText('Un ID WeChat commence par une lettre.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Confirmer le paiement' }));
    expect(createPayment).not.toHaveBeenCalled();
  });

  it('un ID valide part avec le type « id »', async () => {
    open();
    await fillClientAndAmount(/WeChat/);
    type(screen.getByLabelText('Compte WeChat (ID WeChat)'), 'linmei_gz88');
    fireEvent.click(screen.getByRole('button', { name: 'Confirmer le paiement' }));
    await waitFor(() => expect(createPayment).toHaveBeenCalledTimes(1));
    expect(createPayment.mock.calls[0][0]).toMatchObject({ method: 'wechat', beneficiary_identifier: 'linmei_gz88', beneficiary_identifier_type: 'id' });
  });
});
