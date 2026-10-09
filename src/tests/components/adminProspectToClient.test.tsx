/**
 * Prospect → client par la direction (07/10).
 *
 *   · Sur la page d'un commercial, un prospect EN COURS a « Créer son compte
 *     client » (pour qui peut créer un client : canRegisterClients ou
 *     canEditClients), qui ouvre « Nouveau client » avec son numéro principal
 *     dans l'adresse (le « + » encodé) ; une fiche « À vérifier » renvoie à
 *     l'écran de décision à la place ; rien pour un prospect « Devenu client ».
 *   · Le formulaire lit ce numéro : il arrive pré-saisi (pays compris), et la
 *     reprise de la fiche prospect fait le reste (nom, entreprise, origine).
 *   · Un numéro illisible dans l'adresse est ignoré ; un « + » laissé tel
 *     quel (lu comme une espace) est remis.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, renderHook, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const h = vi.hoisted(() => ({
  perms: new Set<string>(),
  prospects: [] as unknown[],
  lookups: [] as (string | null)[],
}));

vi.mock('@/contexts/AdminAuthContext', async (orig) => ({
  ...(await orig<typeof import('@/contexts/AdminAuthContext')>()),
  useAdminAuth: () => ({ currentUser: { id: 'u-nelson', role: 'super_admin' }, hasPermission: (p: string) => h.perms.has(p) }),
}));
vi.mock('@/hooks/useClientManagement', () => ({
  useCreateClient: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useSetClientIdentity: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock('@/hooks/useClientPhones', () => ({ useSetClientPhones: () => ({ mutateAsync: vi.fn(), isPending: false }) }));
vi.mock('@/hooks/useClientSources', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/hooks/useClientSources')>()),
  useClientSources: () => ({ data: [{ id: 'src-rodrigue', kind: 'commercial', label: 'Rodrigue Tchami', is_active: true }], isLoading: false }),
  useSetClientSource: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useSetReceptionOrigin: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
const ETOGA = {
  found: true, prospect_id: 'pr-etoga', prospect_name: 'Paul Etoga', source_id: 'src-rodrigue', source_label: 'Rodrigue Tchami', source_active: true,
  first_name: 'Paul', last_name: 'Etoga', company: 'Etoga Textiles', city: 'Douala', email: null, gender: 'MALE', birth_date: null,
  phone_e164: '+237699123456', phones: [],
};
vi.mock('@/hooks/useSales', () => ({
  useProspectLookup: (phone: string | null) => {
    h.lookups.push(phone);
    return phone === '+237699123456' ? { data: ETOGA, isSuccess: true, isError: false } : { data: undefined, isSuccess: !!phone, isError: false };
  },
  useProspects: () => ({ data: h.prospects, isLoading: false, isError: false, refetch: vi.fn() }),
  useCommercialDashboard: () => ({ data: undefined, isLoading: false, isError: true, error: null, refetch: vi.fn() }),
  useCommercialClients: () => ({ data: [], isLoading: false, isError: false, refetch: vi.fn() }),
  useSalesOverview: () => ({ data: [], isLoading: false }),
  useReassignProspect: () => ({ mutate: vi.fn(), isPending: false }),
  useSetObjective: () => ({ mutateAsync: vi.fn() }),
}));

import { SalesCommercial } from '@/components/team/SalesCommercial';
import { MobileCreateClient } from '@/mobile/screens/clients/MobileCreateClient';
import { useCreateClientForm } from '@/components/clients/useCreateClientForm';
import { newClientPathForPhone, prefillPhoneFromQuery } from '@/components/clients/prospectPrefill';

const prospect = (id: string, first_name: string, last_name: string, phone_e164: string, status: string) => ({
  id, source_id: 'src-rodrigue', first_name, last_name, company: null, phone: phone_e164, phone_e164, city: 'Douala', gender: 'MALE', birth_date: null,
  email: null, pain_points: null, help_needed: null, phones: [], interests: [], notes: null, status, lost_reason: null, next_action_at: null,
  converted_user_id: null, converted_at: null, status_changed_at: '2026-10-05T10:00:00Z', created_at: '2026-10-05T10:00:00Z', updated_at: '2026-10-05T10:00:00Z',
});

function Where() {
  const loc = useLocation();
  return <div data-testid="where">{`${loc.pathname}${loc.search}`}</div>;
}

function mount(path: string) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/m/equipe/ventes/a-verifier" element={<Where />} />
          <Route path="/m/equipe/ventes/:sourceId" element={<SalesCommercial />} />
          <Route path="/m/clients/new" element={<><MobileCreateClient /><Where /></>} />
          <Route path="*" element={<Where />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  h.perms = new Set(['canManageSales', 'canRegisterClients', 'canEditClients', 'canManageUsers']);
  h.prospects = [
    prospect('pr-etoga', 'Paul', 'Etoga', '+237699123456', 'new'),
    prospect('pr-fotso', 'Nadine', 'Fotso', '+237699887766', 'to_verify'),
    prospect('pr-mbarga', 'Aïcha', 'Mbarga', '+237677123456', 'won'),
  ];
  h.lookups = [];
});

describe('Le numéro dans l’adresse', () => {
  it('le « + » est encodé à l’aller et retrouvé au retour', () => {
    const path = newClientPathForPhone('+237699123456');
    expect(path).toBe('/m/clients/new?phone=%2B237699123456');
    expect(prefillPhoneFromQuery(new URLSearchParams(path.split('?')[1]).get('phone'))).toBe('+237699123456');
  });

  it('un « + » non encodé (lu comme une espace) est remis ; l’illisible est ignoré', () => {
    expect(prefillPhoneFromQuery(new URLSearchParams('phone=+237699123456').get('phone'))).toBe('+237699123456');
    expect(prefillPhoneFromQuery('+86 139 2214 5530')).toBe('+8613922145530');
    expect(prefillPhoneFromQuery('n’importe quoi')).toBeNull();
    expect(prefillPhoneFromQuery('+2376991')).toBeNull();
    expect(prefillPhoneFromQuery(null)).toBeNull();
  });
});

describe('« Créer son compte client » depuis la page du commercial', () => {
  it('un prospect en cours : ouvre « Nouveau client » avec son numéro', () => {
    mount('/m/equipe/ventes/src-rodrigue');
    fireEvent.click(screen.getByRole('button', { name: 'Créer le compte client de Paul Etoga' }));
    expect(screen.getByTestId('where')).toHaveTextContent('/m/clients/new?phone=%2B237699123456');
  });

  it('une fiche « À vérifier » : « Décider » renvoie à l’écran de décision, sans création de compte', () => {
    mount('/m/equipe/ventes/src-rodrigue');
    expect(screen.getByText('1 fiche à vérifier')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /À vérifier/ }));
    const row = screen.getByText('Nadine Fotso').closest('li')!;
    expect(within(row).queryByRole('button', { name: /Créer le compte client/ })).toBeNull();
    fireEvent.click(within(row).getByRole('button', { name: 'Décider' }));
    expect(screen.getByTestId('where')).toHaveTextContent('/m/equipe/ventes/a-verifier?fiche=pr-fotso');
  });

  it('le bandeau « Décider » ouvre l’écran filtré sur ce commercial', () => {
    mount('/m/equipe/ventes/src-rodrigue');
    fireEvent.click(screen.getAllByRole('button', { name: 'Décider' })[0]);
    expect(screen.getByTestId('where')).toHaveTextContent('/m/equipe/ventes/a-verifier?commercial=src-rodrigue');
  });

  it('« Devenu client » : pas de création ; sans droit de créer un client : pas de bouton', () => {
    mount('/m/equipe/ventes/src-rodrigue');
    fireEvent.click(screen.getByRole('button', { name: /Devenu client/ }));
    expect(screen.queryByRole('button', { name: /Créer le compte client/ })).toBeNull();
  });

  it('sans canRegisterClients ni canEditClients : pas de « Créer son compte client »', () => {
    h.perms = new Set(['canManageSales']);
    mount('/m/equipe/ventes/src-rodrigue');
    expect(screen.getByText('Paul Etoga')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Créer le compte client/ })).toBeNull();
  });
});

describe('« Nouveau client » : le numéro arrive pré-saisi', () => {
  it('le hook : numéro et pays posés, la fiche du prospect reprise', () => {
    const { result } = renderHook(() => useCreateClientForm({ initialPhone: '+237699123456' }));
    expect(result.current.phones[0].value).toEqual({ country: 'CM', national: '6 99 12 34 56' });
    expect(result.current.countryIso).toBe('CM');
    expect(h.lookups).toContain('+237699123456');
    expect(result.current.fields.firstName).toBe('Paul');
    expect(result.current.fields.lastName).toBe('Etoga');
    expect(result.current.fields.company).toBe('Etoga Textiles');
    expect(result.current.sourceId).toBe('src-rodrigue');
    expect(result.current.prefill?.prospectId).toBe('pr-etoga');
  });

  it('un numéro illisible : formulaire vide, comme avant', () => {
    const { result } = renderHook(() => useCreateClientForm({ initialPhone: '+2376' }));
    expect(result.current.phones[0].value.national).toBe('');
    expect(result.current.fields.firstName).toBe('');
  });

  it('l’écran mobile lit ?phone= : le champ montre le numéro, le prénom est repris', () => {
    mount('/m/clients/new?phone=%2B237699123456');
    expect(screen.getByDisplayValue('6 99 12 34 56')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Paul')).toBeInTheDocument();
  });
});
