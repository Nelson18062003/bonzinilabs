/**
 * Client → prospect, par le super admin (07/10).
 *
 *   · « Repasser en prospect » n'apparaît sur la fiche client (téléphone et
 *     ordinateur) QUE pour qui a canManageUsers ET canManageSales ;
 *   · la fenêtre lit l'éligibilité au serveur : non éligible → la liste des
 *     blocages en clair, aucun bouton d'envoi ;
 *   · éligible → l'explication sans ambiguïté (compte supprimé, fiche
 *     prospect chez le commercial choisi), le commercial proposé coché
 *     d'office, un motif facultatif, et rien ne part sans la case cochée ;
 *   · ce qui part AUSSI avec le compte sans bloquer (bénéficiaires,
 *     support, KYC, notes) est listé ;
 *   · l'envoi porte le client, le commercial et le motif ; ensuite retour à
 *     la liste des clients, avec un lien vers la page du commercial.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const h = vi.hoisted(() => ({
  perms: new Set<string>(),
  eligibility: null as unknown,
  toProspect: vi.fn(),
  eligibilityCalls: [] as (string | null)[],
  toast: vi.fn(),
}));

vi.mock('sonner', () => ({ toast: Object.assign(h.toast, { success: vi.fn(), error: vi.fn() }) }));
vi.mock('@/contexts/AdminAuthContext', async (orig) => ({
  ...(await orig<typeof import('@/contexts/AdminAuthContext')>()),
  useAdminAuth: () => ({ currentUser: { id: 'u-nelson', role: 'super_admin' }, hasPermission: (p: string) => h.perms.has(p), logAction: vi.fn() }),
}));
// Le réseau : neutre (la fiche lit ses numéros, colis, réglages… — le sujet est l'action).
vi.mock('@/integrations/supabase/client', () => {
  const chain: Record<string, unknown> = {};
  const self = () => chain;
  Object.assign(chain, {
    from: self, select: self, eq: self, in: self, neq: self, gte: self, lte: self, lt: self, gt: self, is: self, not: self, or: self,
    order: self, limit: self, range: self,
    single: async () => ({ data: null, error: null }),
    maybeSingle: async () => ({ data: null, error: null }),
    then: (r: (v: unknown) => unknown) => Promise.resolve({ data: [], error: null, count: 0 }).then(r),
    rpc: async () => ({ data: null, error: null }),
    auth: { getUser: async () => ({ data: { user: null } }), getSession: async () => ({ data: { session: null } }) },
    storage: { from: () => ({ getPublicUrl: () => ({ data: { publicUrl: '' } }) }) },
    channel: () => ({ on: () => ({ subscribe: () => ({}) }), subscribe: () => ({}) }),
    removeChannel: () => undefined,
  });
  return { supabase: chain, supabaseAdmin: chain };
});
const MARIAM = {
  id: 'u7', firstName: 'Mariam', lastName: 'Koné', phone: '+237698307725', email: 'mariamk@outlook.com', companyName: '', customerCode: 'BZ-118204',
  country: 'Cameroun', city: 'Douala', gender: 'FEMALE', dateOfBirth: null, avatarUrl: null, createdAt: '2026-10-02T09:00:00Z', updatedAt: '2026-10-02T09:00:00Z',
  walletId: 'w7', walletBalance: 0, walletOverdraftLimit: 0, walletOverdraftNote: null, totalDeposits: 0, totalPayments: 0, status: 'ACTIVE',
  utmSource: null, utmMedium: null, utmCampaign: null, lastLedgerEntry: null,
};
vi.mock('@/hooks/useClientManagement', async (orig) => ({
  ...(await orig<typeof import('@/hooks/useClientManagement')>()),
  useClient: () => ({ data: MARIAM, isLoading: false, refetch: vi.fn() }),
  useClientLedger: () => ({ data: [] }),
  useClientLedgerCount: () => ({ data: 0 }),
}));
vi.mock('@/hooks/useSales', async (orig) => ({
  ...(await orig<typeof import('@/hooks/useSales')>()),
  useClientProspectEligibility: (userId: string | null, enabled = true) => {
    if (enabled) h.eligibilityCalls.push(userId);
    return { data: enabled ? h.eligibility : undefined, isLoading: false, isError: false, error: null, refetch: vi.fn() };
  },
  useClientToProspect: () => ({ mutate: h.toProspect, isPending: false }),
}));
vi.mock('@/hooks/useClientSources', async (orig) => ({
  ...(await orig<typeof import('@/hooks/useClientSources')>()),
  useClientSources: () => ({
    data: [
      { id: 'src-carine', kind: 'commercial', label: 'Carine Ewane', is_active: true },
      { id: 'src-rodrigue', kind: 'commercial', label: 'Rodrigue Tchami', is_active: true },
      { id: 'src-facebook', kind: 'social', label: 'Facebook', is_active: true },
    ],
    isLoading: false,
  }),
}));

import { MobileClientDetail } from '@/mobile/screens/clients/MobileClientDetail';
import { DesktopClientPanel } from '@/desktop/screens/clients/DesktopClientPanel';

function Where() {
  const loc = useLocation();
  return <div data-testid="where">{loc.pathname}</div>;
}

function mount(ui: 'mobile' | 'desktop') {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/m/clients/u7']}>
        <Routes>
          <Route path="/m/clients/:clientId" element={ui === 'mobile' ? <MobileClientDetail /> : <DesktopClientPanel clientId="u7" />} />
          <Route path="*" element={<Where />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const ELIGIBLE = { eligible: true, blockers: [], suggested_source_id: 'src-rodrigue', reopen_prospect_id: null };
const BLOCKED = { eligible: false, blockers: ['3 dépôts', 'Solde de 25 000 XAF'], suggested_source_id: null, reopen_prospect_id: null };

beforeEach(() => {
  h.perms = new Set(['canManageUsers', 'canManageSales', 'canViewClients', 'canEditClients']);
  h.eligibility = ELIGIBLE;
  h.toProspect.mockReset();
  h.eligibilityCalls = [];
  h.toast.mockReset();
});

const openMobile = () => fireEvent.click(screen.getByRole('button', { name: /^Repasser en prospect/ }));

describe('Repasser en prospect — qui le voit', () => {
  it('téléphone : visible pour le super admin (canManageUsers + canManageSales)', () => {
    mount('mobile');
    expect(screen.getByRole('button', { name: /^Repasser en prospect/ })).toBeInTheDocument();
  });

  it('téléphone : invisible sans canManageSales, et sans canManageUsers', () => {
    h.perms = new Set(['canManageUsers', 'canViewClients', 'canEditClients']);
    const { unmount } = mount('mobile');
    expect(screen.queryByRole('button', { name: /Repasser en prospect/ })).toBeNull();
    unmount();
    h.perms = new Set(['canManageSales', 'canViewClients', 'canEditClients']);
    mount('mobile');
    expect(screen.queryByRole('button', { name: /Repasser en prospect/ })).toBeNull();
    expect(h.eligibilityCalls).toEqual([]);
  });

  it('ordinateur : dans le menu « ⋯ » pour le super admin seulement', () => {
    const { unmount } = mount('desktop');
    fireEvent.click(screen.getByRole('button', { name: 'Plus d\'actions' }));
    expect(screen.getByRole('button', { name: 'Repasser en prospect' })).toBeInTheDocument();
    unmount();
    h.perms = new Set(['canManageUsers', 'canViewClients', 'canEditClients']);
    mount('desktop');
    fireEvent.click(screen.getByRole('button', { name: 'Plus d\'actions' }));
    expect(screen.queryByRole('button', { name: 'Repasser en prospect' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Supprimer le client' })).toBeInTheDocument();
  });
});

describe('Repasser en prospect — la fenêtre', () => {
  it('non éligible : les blocages en clair, aucun bouton d’envoi', () => {
    h.eligibility = BLOCKED;
    mount('mobile');
    openMobile();
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveTextContent('Mariam Koné ne peut pas redevenir prospect');
    const list = within(dialog).getByRole('list', { name: 'Ce qui bloque' });
    expect(within(list).getAllByRole('listitem').map((li) => li.textContent)).toEqual(['3 dépôts', 'Solde de 25 000 XAF']);
    expect(within(dialog).queryByRole('button', { name: 'Repasser en prospect' })).toBeNull();
    // « Fermer » en toutes lettres (en plus du X et du voile de la feuille).
    expect(within(dialog).getAllByRole('button', { name: 'Fermer' }).some((b) => b.textContent === 'Fermer')).toBe(true);
    expect(h.eligibilityCalls).toContain('u7');
  });

  it('éligible : l’explication, le commercial proposé coché, rien sans la case', () => {
    mount('mobile');
    openMobile();
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveTextContent('Son compte sera supprimé : il ne pourra plus se connecter. Ses informations deviennent une fiche prospect confiée au commercial choisi.');
    expect(dialog).toHaveTextContent('Une fiche prospect est créée avec ses coordonnées');
    // Seuls les commerciaux actifs : pas « Facebook ».
    const radios = within(dialog).getAllByRole('radio');
    expect(radios.map((r) => r.textContent)).toEqual(['Carine Ewane', 'Rodrigue Tchamiproposé']);
    expect(within(dialog).getByRole('radio', { name: /Rodrigue Tchami/ })).toHaveAttribute('aria-checked', 'true');
    const submit = within(dialog).getByRole('button', { name: 'Repasser en prospect' });
    expect(submit).toBeDisabled();
    fireEvent.click(submit);
    expect(h.toProspect).not.toHaveBeenCalled();
  });

  it('envoi : le client, le commercial choisi, le motif ; puis la liste des clients et le lien vers le commercial', () => {
    h.toProspect.mockImplementation((_v: unknown, opts: { onSuccess: () => void }) => opts.onSuccess());
    mount('mobile');
    openMobile();
    const dialog = screen.getByRole('dialog');
    fireEvent.click(within(dialog).getByRole('radio', { name: /Carine Ewane/ }));
    fireEvent.change(within(dialog).getByLabelText('Motif (facultatif)'), { target: { value: 'Compte créé trop tôt' } });
    fireEvent.click(within(dialog).getByRole('checkbox'));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Repasser en prospect' }));
    expect(h.toProspect).toHaveBeenCalledWith({ userId: 'u7', sourceId: 'src-carine', reason: 'Compte créé trop tôt' }, expect.anything());
    expect(screen.getByTestId('where')).toHaveTextContent('/m/clients');
    expect(h.toast).toHaveBeenCalledWith('Mariam Koné est maintenant un prospect de Carine Ewane', expect.objectContaining({ action: expect.objectContaining({ label: 'Voir le commercial' }) }));
    // Le lien du toast ouvre la page du commercial.
    const { action } = h.toast.mock.calls[0][1] as { action: { onClick: () => void } };
    act(() => action.onClick());
    expect(screen.getByTestId('where')).toHaveTextContent('/m/equipe/ventes/src-carine');
  });

  it('éligible avec ce qui part AUSSI sans bloquer (bénéficiaires, support…) : la liste le dit ; rien de tel, pas de liste', () => {
    h.eligibility = { ...ELIGIBLE, warnings: ['1 bénéficiaire enregistré (comptes de ses fournisseurs)', 'Sa conversation avec le support (2 messages)'] };
    const { unmount } = mount('mobile');
    openMobile();
    const list = within(screen.getByRole('dialog')).getByRole('list', { name: 'Effacé aussi avec le compte (gardé au journal)' });
    expect(within(list).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      '1 bénéficiaire enregistré (comptes de ses fournisseurs)',
      'Sa conversation avec le support (2 messages)',
    ]);
    // L'envoi reste possible (ce ne sont pas des opérations).
    expect(within(screen.getByRole('dialog')).getByRole('button', { name: 'Repasser en prospect' })).toBeInTheDocument();
    unmount();
    h.eligibility = ELIGIBLE;
    mount('mobile');
    openMobile();
    expect(within(screen.getByRole('dialog')).queryByRole('list', { name: /Effacé aussi/ })).toBeNull();
  });

  it('français : une espace insécable avant chaque « : » (pas de deux-points seul en tête de ligne)', async () => {
    const fr = (await import('@/i18n/locales/fr/common.json')).default as { clientToProspect: Record<string, string>; hooks: { adminNotifications: Record<string, string> } };
    for (const [k, v] of Object.entries(fr.clientToProspect)) expect(v, k).not.toMatch(/ :/);
    expect(fr.hooks.adminNotifications.prospectToVerifyOne).toBe('{{prospect}} · client reconnu\u00a0: {{client}}');
  });

  it('un ancien prospect à rouvrir : la fenêtre le dit', () => {
    h.eligibility = { ...ELIGIBLE, reopen_prospect_id: 'pr-old' };
    mount('mobile');
    openMobile();
    expect(screen.getByRole('dialog')).toHaveTextContent('Son ancienne fiche prospect est rouverte, au statut « Contacté ».');
  });
});
