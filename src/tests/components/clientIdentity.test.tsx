/**
 * Le sexe et la date de naissance d'un client (06/10).
 *
 *   · la saisie « JJ/MM/AAAA » : barres posées au fil de la frappe, lecture
 *     en « AAAA-MM-JJ », ce qui ne va pas (incomplète, impossible, âge) ;
 *   · « Modifier le profil » n'appelle `admin_set_client_identity` QUE si le
 *     sexe ou la date change (le sexe ne revient jamais à « non renseigné ») ;
 *   · la fiche (ordinateur et téléphone) montre « Sexe » et « Date de
 *     naissance », ou « Non renseigné(e) ».
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import {
  birthTextIssue,
  birthTextToIso,
  formatBirthInput,
  identityPatch,
  isoToBirthText,
  validBirthIso,
} from '@/components/clients/clientIdentity';
import { BirthDateField, GenderField } from '@/components/clients/ClientIdentityFields';

const TODAY = new Date(Date.UTC(2026, 9, 6, 12));

describe('Date de naissance — la saisie', () => {
  it('pose les barres au fil de la frappe, sans jamais coincer l’effacement', () => {
    expect(formatBirthInput('1')).toBe('1');
    expect(formatBirthInput('12')).toBe('12');
    expect(formatBirthInput('123')).toBe('12/03');
    expect(formatBirthInput('4')).toBe('04');
    expect(formatBirthInput('1203')).toBe('12/03');
    expect(formatBirthInput('120319')).toBe('12/03/19');
    expect(formatBirthInput('12031985')).toBe('12/03/1985');
    expect(formatBirthInput('12/03/19851')).toBe('12/03/1985');
    expect(formatBirthInput('12.03.1985')).toBe('12/03/1985');
    // Collée au format de la base.
    expect(formatBirthInput('1985-03-12')).toBe('12/03/1985');
  });

  it('lit et écrit le format de la base', () => {
    expect(birthTextToIso('12/03/1985')).toBe('1985-03-12');
    expect(birthTextToIso('12/03/19')).toBeNull();
    expect(isoToBirthText('1985-03-12')).toBe('12/03/1985');
    expect(isoToBirthText(null)).toBe('');
    expect(isoToBirthText('pas une date')).toBe('');
  });

  it('dit ce qui ne va pas : vide = rien (facultative), incomplète, impossible, âge', () => {
    expect(birthTextIssue('', TODAY)).toBeNull();
    expect(birthTextIssue('12/03', TODAY)).toBe('incomplete');
    expect(birthTextIssue('31/02/1990', TODAY)).toBe('invalid');
    expect(birthTextIssue('07/10/2010', TODAY)).toBe('age'); // 15 ans, la veille de ses 16
    expect(birthTextIssue('06/10/2010', TODAY)).toBeNull(); // 16 ans ce jour
    expect(birthTextIssue('12/03/1900', TODAY)).toBe('age');
    expect(validBirthIso('12/03/1985', TODAY)).toBe('1985-03-12');
    expect(validBirthIso('31/02/1990', TODAY)).toBeNull();
  });
});

describe('Modifier le profil — identité envoyée seulement si elle change', () => {
  const saved = { gender: 'MALE', dateOfBirth: '1985-03-12' };

  it('rien de changé : aucun appel', () => {
    expect(identityPatch(saved, { gender: 'MALE', birthText: '12/03/1985' }, TODAY)).toBeNull();
  });

  it('le sexe seul', () => {
    expect(identityPatch(saved, { gender: 'FEMALE', birthText: '12/03/1985' }, TODAY)).toEqual({ gender: 'FEMALE' });
  });

  it('la date seule, ou effacée (null)', () => {
    expect(identityPatch(saved, { gender: 'MALE', birthText: '13/03/1985' }, TODAY)).toEqual({ birthDate: '1985-03-13' });
    expect(identityPatch(saved, { gender: 'MALE', birthText: '' }, TODAY)).toEqual({ birthDate: null });
  });

  it('un client « non renseigné » (OTHER) : sans choix, rien ; le sexe ne revient jamais à vide', () => {
    expect(identityPatch({ gender: 'OTHER', dateOfBirth: null }, { gender: null, birthText: '' }, TODAY)).toBeNull();
    expect(identityPatch({ gender: 'OTHER', dateOfBirth: null }, { gender: 'FEMALE', birthText: '' }, TODAY)).toEqual({ gender: 'FEMALE' });
  });
});

describe('Les champs', () => {
  it('Sexe : un groupe radio Homme / Femme, au clavier aussi', () => {
    const onChange = vi.fn();
    render(<GenderField id="g" label="Sexe" value="MALE" onChange={onChange} />);
    const group = screen.getByRole('radiogroup', { name: 'Sexe' });
    expect(within(group).getByRole('radio', { name: 'Homme' })).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(within(group).getByRole('radio', { name: 'Femme' }));
    expect(onChange).toHaveBeenLastCalledWith('FEMALE');
    fireEvent.keyDown(group, { key: 'ArrowRight' });
    expect(onChange).toHaveBeenLastCalledWith('FEMALE');
  });

  it('Date de naissance : la date en toutes lettres et l’âge, une fois complète', () => {
    const onChange = vi.fn();
    const { rerender } = render(<BirthDateField id="b" label="Date de naissance" value="" onChange={onChange} today={TODAY} />);
    fireEvent.change(screen.getByLabelText('Date de naissance'), { target: { value: '12031985' } });
    expect(onChange).toHaveBeenLastCalledWith('12/03/1985');
    rerender(<BirthDateField id="b" label="Date de naissance" value="12/03/1985" onChange={onChange} today={TODAY} />);
    expect(screen.getByText('12 mars 1985')).toBeInTheDocument();
    expect(screen.getByText('41 ans')).toBeInTheDocument();
  });

  it('Date de naissance : impossible tout de suite, incomplète seulement en quittant le champ', () => {
    const { rerender } = render(<BirthDateField id="b" label="Date de naissance" value="31/02/1990" onChange={() => undefined} today={TODAY} />);
    expect(screen.getByText('Cette date n’existe pas.')).toBeInTheDocument();
    rerender(<BirthDateField id="b" label="Date de naissance" value="12/03" onChange={() => undefined} today={TODAY} />);
    expect(screen.queryByText(/Date incomplète/)).toBeNull();
    fireEvent.blur(screen.getByLabelText('Date de naissance'));
    expect(screen.getByText(/Date incomplète/)).toBeInTheDocument();
  });
});

/* ── La fiche client ─────────────────────────────────────────────────── */

const updateClient = vi.fn(async (_v: Record<string, unknown>) => undefined);
const setIdentity = vi.fn(async (_v: { userId: string; gender?: string; birthDate?: string | null }) => ({ success: true }));
let client: Record<string, unknown> = {};

vi.mock('@/integrations/supabase/client', () => {
  const chain: Record<string, unknown> = {};
  const self = () => chain;
  Object.assign(chain, {
    from: self, select: self, eq: self, neq: self, in: self, is: self, gte: self, lte: self, lt: self, or: self,
    order: self, limit: self, range: self,
    single: async () => ({ data: null, error: null }),
    maybeSingle: async () => ({ data: null, error: null }),
    then: (r: (v: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(r),
    rpc: async () => ({ data: null, error: null }),
    auth: { getUser: async () => ({ data: { user: null } }) },
    storage: { from: () => ({ createSignedUrl: async () => ({ data: null, error: null }) }) },
  });
  return { supabase: chain, supabaseAdmin: chain };
});

vi.mock('@/hooks/useClientManagement', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/hooks/useClientManagement')>()),
  useClient: () => ({ data: client, isLoading: false, refetch: vi.fn() }),
  useClientLedger: () => ({ data: [] }),
  useClientLedgerCount: () => ({ data: 0 }),
  useUpdateClient: () => ({ mutateAsync: updateClient, isPending: false }),
  useSetClientIdentity: () => ({ mutateAsync: setIdentity, isPending: false }),
  useResetClientPassword: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useCreateAdjustment: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock('@/hooks/useClientPhones', () => ({
  useClientPhones: () => ({ data: [] }),
  useSetClientPhones: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock('@/hooks/useClientSources', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/hooks/useClientSources')>()),
  useClientOrigin: () => ({ data: null, isLoading: false }),
  useSetClientSource: () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock('@/hooks/useReception', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/hooks/useReception')>()),
  useClientDeposits: () => ({ data: [] }),
}));
vi.mock('@/hooks/useCargo', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/hooks/useCargo')>()),
  useCargoShipments: () => ({ data: [] }),
  useCargoFleetDocuments: () => ({ data: {} }),
}));
// Le QR de l'identifiant client dessine dans un canvas, que jsdom n'a pas.
vi.mock('qrcode.react', async () => {
  const { forwardRef } = await import('react');
  const Blank = forwardRef(() => null);
  return { QRCodeSVG: Blank, QRCodeCanvas: Blank };
});
vi.mock('@/hooks/useShippingSettings', () => ({ useAdminShippingSettings: () => ({ data: undefined }) }));
vi.mock('@/hooks/useAdminDeleteClient', () => ({ useAdminDeleteClient: () => ({ mutate: vi.fn(), isPending: false }) }));

import { DesktopClientPanel } from '@/desktop/screens/clients/DesktopClientPanel';
import { MobileClientDetail } from '@/mobile/screens/clients/MobileClientDetail';
import { AdminAuthContext } from '@/contexts/AdminAuthContext';

function baseClient(o: Record<string, unknown> = {}) {
  return {
    id: 'u1', firstName: 'Aline', lastName: 'Ngo', phone: '+237677112233', email: 'aline@ngo.cm', companyName: 'Ngo Cosmétiques',
    customerCode: 'BZ-100200', country: 'Cameroun', city: 'Douala', avatarUrl: null, createdAt: '2026-09-01T08:00:00Z', updatedAt: '2026-09-01T08:00:00Z',
    walletId: 'w1', walletBalance: 0, walletOverdraftLimit: 0, walletOverdraftNote: null, totalDeposits: 0, totalPayments: 0,
    status: 'ACTIVE', utmSource: null, utmMedium: null, utmCampaign: null, lastLedgerEntry: null,
    gender: 'FEMALE', dateOfBirth: '1988-04-21',
    ...o,
  };
}

function mount(ui: ReactNode, path = '/', route = '/') {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const auth = { hasPermission: () => true, currentUser: null, profile: null } as unknown as React.ContextType<typeof AdminAuthContext>;
  return render(
    <QueryClientProvider client={qc}>
      <AdminAuthContext.Provider value={auth}>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path={route} element={ui} />
          </Routes>
        </MemoryRouter>
      </AdminAuthContext.Provider>
    </QueryClientProvider>,
  );
}

describe('La fiche client montre le sexe et la date de naissance', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(TODAY);
    updateClient.mockClear();
    setIdentity.mockClear();
  });

  it('ordinateur : « Sexe » et « Date de naissance » dans les coordonnées', () => {
    client = baseClient();
    mount(<DesktopClientPanel clientId="u1" />);
    expect(screen.getByText('Sexe').nextElementSibling?.textContent).toBe('Femme');
    expect(screen.getByText('Date de naissance').nextElementSibling?.textContent).toBe('21 avril 1988 (38 ans)');
    vi.useRealTimers();
  });

  it('ordinateur : non renseignés (OTHER, pas de date)', () => {
    client = baseClient({ gender: 'OTHER', dateOfBirth: null });
    mount(<DesktopClientPanel clientId="u1" />);
    expect(screen.getByText('Sexe').nextElementSibling?.textContent).toBe('Non renseigné');
    expect(screen.getByText('Date de naissance').nextElementSibling?.textContent).toBe('Non renseignée');
    vi.useRealTimers();
  });

  it('téléphone : deux phrases, comme les lignes voisines', () => {
    client = baseClient();
    mount(<MobileClientDetail />, '/m/clients/u1', '/m/clients/:clientId');
    expect(screen.getByText(/^Sexe :/).textContent).toBe('Sexe : Femme.');
    expect(screen.getByText(/^Date de naissance :/).textContent).toBe('Date de naissance : 21 avril 1988 (38 ans).');
    vi.useRealTimers();
  });
});

describe('Modifier le profil (ordinateur) — l’identité seulement si elle change', () => {
  beforeEach(() => {
    updateClient.mockClear();
    setIdentity.mockClear();
  });

  async function openAndSave(change?: () => void) {
    mount(<DesktopClientPanel clientId="u1" />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Modifier' })[0]);
    const dialog = await screen.findByRole('dialog');
    change?.();
    await act(async () => {
      fireEvent.click(within(dialog).getByRole('button', { name: 'Enregistrer' }));
    });
    return dialog;
  }

  it('rien changé côté identité : le profil s’enregistre, l’identité n’est pas appelée', async () => {
    client = baseClient();
    await openAndSave();
    expect(updateClient).toHaveBeenCalledTimes(1);
    expect(updateClient.mock.calls[0][0]).toMatchObject({ userId: 'u1', silent: false });
    expect(setIdentity).not.toHaveBeenCalled();
  });

  it('le sexe change : l’identité est appelée avec le sexe seul, après le profil', async () => {
    client = baseClient();
    await openAndSave(() => fireEvent.click(screen.getByRole('radio', { name: 'Homme' })));
    expect(updateClient.mock.calls[0][0]).toMatchObject({ silent: true });
    expect(setIdentity).toHaveBeenCalledWith({ userId: 'u1', gender: 'MALE' });
    expect(updateClient.mock.invocationCallOrder[0]).toBeLessThan(setIdentity.mock.invocationCallOrder[0]);
  });

  it('la date est effacée : envoyée à null', async () => {
    client = baseClient();
    await openAndSave(() => fireEvent.change(screen.getByLabelText('Date de naissance'), { target: { value: '' } }));
    expect(setIdentity).toHaveBeenCalledWith({ userId: 'u1', birthDate: null });
  });

  it('une date invalide bloque tout, avant la moindre écriture', async () => {
    client = baseClient();
    await openAndSave(() => fireEvent.change(screen.getByLabelText('Date de naissance'), { target: { value: '31021990' } }));
    expect(updateClient).not.toHaveBeenCalled();
    expect(setIdentity).not.toHaveBeenCalled();
  });

  it('une date DÉJÀ en base hors de 16 à 110 ans (inscription en libre-service) ne bloque pas le reste du profil', async () => {
    const year = new Date().getUTCFullYear() - 15;
    client = baseClient({ dateOfBirth: `${year}-12-31` });
    await openAndSave();
    expect(updateClient).toHaveBeenCalledTimes(1);
    // Inchangée : rien n'est envoyé pour elle.
    expect(setIdentity).not.toHaveBeenCalled();
  });
});
