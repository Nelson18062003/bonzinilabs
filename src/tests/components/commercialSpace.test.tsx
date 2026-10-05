/**
 * L'espace du commercial (« /v »).
 *
 *   · chaque écran de route se monte avec un routeur et un client de
 *     requêtes, rien d'autre (la session du personnel est fournie par
 *     App.tsx pour toute l'application — ici, son hook est simulé) ;
 *   · la coquille renvoie un non-commercial vers SON espace, et une
 *     personne non connectée vers la connexion unique ;
 *   · un compte pas encore relié à sa fiche voit un message clair ;
 *   · « À relancer » ne montre que les relances échues ;
 *   · le formulaire envoie un numéro international et une relance à 9 h
 *     (Douala) ; « Perdu » exige un motif ;
 *   · le téléphone se saisit avec son pays (drapeau, indicatif) : un numéro
 *     chinois part en +86, une fiche se rouvre sur son pays ;
 *   · les listes affichent les numéros au format international, et les
 *     liens d'appel / WhatsApp partent en E.164.
 */
import { describe, it, expect, vi, beforeAll, beforeEach, afterAll } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const h = vi.hoisted(() => {
  const UNLINKED = "Votre compte n'est pas encore relié à votre fiche commercial. Demandez-le au responsable.";
  const metrics = {
    clients: 12, new_clients: 2, active_clients: 5, payments_xaf: 4_500_000, payments_count: 3, deposits_xaf: 0, deposits_count: 0,
    air_parcels: 4, air_kg: 52.5, sea_parcels: 2, sea_cbm: 1.25, prospects_open: 3, prospects_new: 1, prospects_won: 1, prospects_due: 1,
  };
  const card = {
    month: '2026-10-01',
    source: { id: 's-jean', label: 'Jean Mbarga', phone: null, is_active: true },
    staff: { user_id: 'u1', name: 'Jean Mbarga', is_disabled: false },
    metrics,
    objectives: [{ metric: 'new_clients', target: 4, actual: 2 }],
  };
  const past = new Date(Date.now() - 2 * 86_400_000).toISOString();
  const future = new Date(Date.now() + 5 * 86_400_000).toISOString();
  const base = {
    source_id: 's-jean', last_name: null, company: null, city: null, interests: [], notes: null, lost_reason: null,
    converted_user_id: null, converted_at: null, status_changed_at: past, created_at: past, updated_at: past,
  };
  const prospects = [
    { ...base, id: 'p-due', first_name: 'Awa', phone: '+237690000001', phone_e164: '+237690000001', status: 'contacted', next_action_at: past },
    { ...base, id: 'p-later', first_name: 'Bruno', phone: '+237690000002', phone_e164: '+237690000002', status: 'new', next_action_at: future },
    { ...base, id: 'p-lost', first_name: 'Chantal', phone: '+237690000003', phone_e164: '+237690000003', status: 'lost', next_action_at: past, lost_reason: 'Prix' },
  ];
  return {
    UNLINKED,
    card,
    prospects,
    auth: {
      currentUser: { id: 'u1', email: 'jean@bonzini.com', firstName: 'Jean', lastName: 'Mbarga', role: 'commercial' } as { role: string } & Record<string, unknown>,
      isAuthenticated: true,
      isLoading: false,
      hasPermission: ((p: string) => p === 'canProspect') as (p: string) => boolean,
      logout: async () => undefined,
    },
    dashboard: { data: card, isLoading: false, isError: false, error: null as Error | null, refetch: () => undefined } as Record<string, unknown>,
    list: { data: prospects, isLoading: false, isError: false, refetch: () => undefined },
    clients: { data: [] as Record<string, unknown>[], isLoading: false, isError: false, error: null, refetch: () => undefined },
    create: vi.fn(),
    update: vi.fn(),
    setStatus: vi.fn(),
  };
});

vi.mock('@/contexts/AdminAuthContext', () => ({ useAdminAuth: () => h.auth }));
vi.mock('@/hooks/useSales', () => ({
  useCommercialDashboard: () => h.dashboard,
  useCommercialClients: () => h.clients,
  useProspects: () => h.list,
  useCreateProspect: () => ({ mutate: h.create, isPending: false }),
  useUpdateProspect: () => ({ mutate: h.update, isPending: false }),
  useSetProspectStatus: () => ({ mutate: h.setStatus, isPending: false }),
}));

import { CommercialRouteWrapper } from '@/components/sales/CommercialRouteWrapper';
import { CommercialHome } from '@/components/sales/CommercialHome';
import { CommercialProspects } from '@/components/sales/CommercialProspects';
import { CommercialProspectForm } from '@/components/sales/CommercialProspectForm';
import { CommercialClients } from '@/components/sales/CommercialClients';

function Where() {
  const loc = useLocation();
  return <div data-testid="where">{loc.pathname}</div>;
}

function mount(ui: React.ReactElement, { route = '/', path = '*' }: { route?: string; path?: string } = {}) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[route]}>
        <Routes>
          <Route path={path} element={ui} />
          <Route path="*" element={<Where />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  h.auth.isAuthenticated = true;
  h.auth.currentUser = { id: 'u1', email: 'jean@bonzini.com', firstName: 'Jean', lastName: 'Mbarga', role: 'commercial' };
  h.auth.hasPermission = (p: string) => p === 'canProspect';
  h.dashboard = { data: h.card, isLoading: false, isError: false, error: null, refetch: () => undefined };
  h.create.mockReset();
  h.update.mockReset();
  h.setStatus.mockReset();
  h.clients = { ...h.clients, data: [] };
});

describe('Espace commercial — montage', () => {
  it.each([
    ['CommercialHome', <CommercialHome />],
    ['CommercialProspects', <CommercialProspects />],
    ['CommercialProspectForm', <CommercialProspectForm />],
    ['CommercialClients', <CommercialClients />],
  ])('%s se monte avec un routeur et un client de requêtes', (_name, ui) => {
    expect(() => mount(ui)).not.toThrow();
  });
});

describe('Espace commercial — accès', () => {
  it('un réceptionnaire connecté est renvoyé vers « /r »', () => {
    h.auth.currentUser = { role: 'receptionist' };
    h.auth.hasPermission = () => false;
    mount(<CommercialRouteWrapper><CommercialHome /></CommercialRouteWrapper>, { route: '/v', path: '/v' });
    expect(screen.getByTestId('where').textContent).toBe('/r');
  });

  it('sans session : vers la connexion unique « /m/login »', () => {
    h.auth.isAuthenticated = false;
    mount(<CommercialRouteWrapper><CommercialHome /></CommercialRouteWrapper>, { route: '/v', path: '/v' });
    expect(screen.getByTestId('where').textContent).toBe('/m/login');
  });

  it('le commercial entre', () => {
    mount(<CommercialRouteWrapper><CommercialHome /></CommercialRouteWrapper>, { route: '/v', path: '/v' });
    expect(screen.getByText(/Jean$/)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Nouveau prospect/ })).toBeTruthy();
  });
});

describe('Espace commercial — accueil', () => {
  it('montre la fiche, les objectifs et les chiffres du mois', () => {
    mount(<CommercialHome />);
    expect(screen.getByText(/Fiche « Jean Mbarga »/)).toBeTruthy();
    expect(screen.getByRole('progressbar', { name: 'Nouveaux clients' }).getAttribute('aria-valuenow')).toBe('50');
    expect(screen.getByText(/4\s500\s000 XAF/)).toBeTruthy();
    expect(screen.getByText(/1 prospect à relancer/)).toBeTruthy();
  });

  it('aucun objectif : un état vide calme', () => {
    h.dashboard = { ...h.dashboard, data: { ...h.card, objectives: [] } };
    mount(<CommercialHome />);
    expect(screen.getByText('Pas encore d’objectif ce mois-ci')).toBeTruthy();
  });

  it('compte pas encore relié à sa fiche : le message du serveur, sans bouton d’action', () => {
    h.dashboard = { data: undefined, isLoading: false, isError: true, error: new Error(h.UNLINKED), refetch: () => undefined };
    mount(<CommercialHome />);
    expect(screen.getByText('Votre espace n’est pas encore prêt')).toBeTruthy();
    expect(screen.getByText(h.UNLINKED)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Nouveau prospect/ })).toBeNull();
  });
});

describe('Espace commercial — prospects', () => {
  it('par défaut : les ouverts, sans les perdus', () => {
    mount(<CommercialProspects />, { route: '/v/prospects', path: '/v/prospects' });
    expect(screen.getByText('Awa')).toBeTruthy();
    expect(screen.getByText('Bruno')).toBeTruthy();
    expect(screen.queryByText('Chantal')).toBeNull();
  });

  it('« ?filtre=relancer » : seulement les relances échues', () => {
    mount(<CommercialProspects />, { route: '/v/prospects?filtre=relancer', path: '/v/prospects' });
    expect(screen.getByRole('tab', { name: /À relancer/ }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByText('Awa')).toBeTruthy();
    expect(screen.queryByText('Bruno')).toBeNull();
    expect(screen.queryByText('Chantal')).toBeNull();
  });
});

describe('Espace commercial — formulaire', () => {
  it('envoie le numéro au format international et une relance à 9 h (Douala)', () => {
    mount(<CommercialProspectForm />, { route: '/v/prospects/new', path: '/v/prospects/new' });
    fireEvent.change(screen.getByLabelText(/Prénom/), { target: { value: 'Paul' } });
    fireEvent.change(screen.getByLabelText(/Téléphone/), { target: { value: '699 12 34 56' } });
    fireEvent.click(screen.getByRole('button', { name: 'Fret bateau' }));
    fireEvent.click(screen.getByRole('button', { name: 'Demain' }));
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter le prospect' }));
    expect(h.create).toHaveBeenCalledTimes(1);
    const [input] = h.create.mock.calls[0];
    expect(input).toMatchObject({ firstName: 'Paul', phone: '+237699123456', interests: ['sea'] });
    expect(input.nextActionAt).toMatch(/^\d{4}-\d{2}-\d{2}T09:00:00\+01:00$/);
  });

  it('numéro invalide : un message, rien n’est envoyé, la saisie reste', () => {
    mount(<CommercialProspectForm />, { route: '/v/prospects/new', path: '/v/prospects/new' });
    fireEvent.change(screen.getByLabelText(/Prénom/), { target: { value: 'Paul' } });
    fireEvent.change(screen.getByLabelText(/Téléphone/), { target: { value: '12' } });
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter le prospect' }));
    expect(h.create).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toMatch(/indicatif/);
    expect((screen.getByLabelText(/Prénom/) as HTMLInputElement).value).toBe('Paul');
  });

  it('« Perdu » exige un motif d’au moins 3 caractères', () => {
    mount(<CommercialProspectForm />, { route: '/v/prospects/p-due', path: '/v/prospects/:id' });
    fireEvent.click(screen.getByRole('button', { name: /Marquer perdu/ }));
    const sheet = screen.getByRole('dialog');
    const confirm = within(sheet).getByRole('button', { name: 'Marquer perdu' }) as HTMLButtonElement;
    fireEvent.change(within(sheet).getByLabelText('Pourquoi ?'), { target: { value: 'ok' } });
    expect(confirm.disabled).toBe(true);
    fireEvent.change(within(sheet).getByLabelText('Pourquoi ?'), { target: { value: 'Trop cher' } });
    expect(confirm.disabled).toBe(false);
    fireEvent.click(confirm);
    expect(h.setStatus).toHaveBeenCalledWith({ id: 'p-due', status: 'lost', reason: 'Trop cher' }, expect.any(Object));
  });

  it('un perdu se rouvre (statut « À contacter »)', () => {
    mount(<CommercialProspectForm />, { route: '/v/prospects/p-lost', path: '/v/prospects/:id' });
    fireEvent.click(screen.getByRole('button', { name: /Rouvrir/ }));
    expect(h.setStatus).toHaveBeenCalledWith({ id: 'p-lost', status: 'new', reason: undefined }, expect.any(Object));
  });
});

describe('Espace commercial — téléphone avec son pays', () => {
  // Le sélecteur de pays (cmdk dans un popover Radix) mesure sa liste et la fait défiler : jsdom n'a ni l'un ni l'autre.
  beforeAll(() => {
    vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
    Element.prototype.scrollIntoView ??= () => undefined;
  });
  afterAll(() => {
    vi.unstubAllGlobals();
  });

  const newForm = () => {
    mount(<CommercialProspectForm />, { route: '/v/prospects/new', path: '/v/prospects/new' });
    fireEvent.change(screen.getByLabelText(/Prénom/), { target: { value: 'Wei' } });
  };
  const pickCountry = (name: RegExp) => {
    fireEvent.click(screen.getByRole('button', { name: 'Indicatif' }));
    fireEvent.change(screen.getByPlaceholderText(/Rechercher un pays/), { target: { value: 'Chine' } });
    fireEvent.click(screen.getByRole('option', { name }));
  };

  it('le Cameroun par défaut, et la note « Sera enregistré » donne le numéro international', () => {
    newForm();
    expect(screen.getByRole('button', { name: 'Indicatif' }).textContent).toContain('+237');
    expect(screen.getByText('Pour un autre pays, touchez le drapeau.')).toBeTruthy();
    fireEvent.change(screen.getByLabelText(/Téléphone/), { target: { value: '677842190' } });
    expect((screen.getByLabelText(/Téléphone/) as HTMLInputElement).value).toBe('6 77 84 21 90');
    expect(screen.getByText('Sera enregistré : +237 6 77 84 21 90')).toBeTruthy();
  });

  it('un numéro chinois saisi avec le pays Chine part en +86', () => {
    newForm();
    pickCountry(/Chine/);
    expect(screen.getByRole('button', { name: 'Indicatif' }).textContent).toContain('+86');
    fireEvent.change(screen.getByLabelText(/Téléphone/), { target: { value: '138 1234 5678' } });
    expect(screen.getByText('Sera enregistré : +86 138 1234 5678')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter le prospect' }));
    expect(h.create).toHaveBeenCalledTimes(1);
    expect(h.create.mock.calls[0][0]).toMatchObject({ firstName: 'Wei', phone: '+8613812345678' });
  });

  it('le même numéro chinois sous l’indicatif du Cameroun est refusé', () => {
    newForm();
    fireEvent.change(screen.getByLabelText(/Téléphone/), { target: { value: '138 1234 5678' } });
    expect(screen.queryByText(/Sera enregistré/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter le prospect' }));
    expect(h.create).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toBe('Numéro invalide : vérifiez l’indicatif et les chiffres');
  });

  it('une fiche se rouvre sur son pays ; numéro inchangé : ni note, ni numéro envoyé', () => {
    mount(<CommercialProspectForm />, { route: '/v/prospects/p-later', path: '/v/prospects/:id' });
    expect(screen.getByRole('button', { name: 'Indicatif' }).textContent).toContain('+237');
    expect((screen.getByLabelText(/Téléphone/) as HTMLInputElement).value).toBe('6 90 00 00 02');
    expect(screen.queryByText(/Sera enregistré/)).toBeNull();
    fireEvent.change(screen.getByLabelText(/Prénom/), { target: { value: 'Bruno-Pierre' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
    expect(h.update).toHaveBeenCalledTimes(1);
    expect(h.update.mock.calls[0][0]).toMatchObject({ id: 'p-later', firstName: 'Bruno-Pierre' });
    expect(h.update.mock.calls[0][0]).not.toHaveProperty('phone');
  });

  it('une fiche dont le numéro change : la note, puis le nouveau numéro en E.164', () => {
    mount(<CommercialProspectForm />, { route: '/v/prospects/p-later', path: '/v/prospects/:id' });
    fireEvent.change(screen.getByLabelText(/Téléphone/), { target: { value: '6 99 12 34 56' } });
    expect(screen.getByText('Sera enregistré : +237 6 99 12 34 56')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
    expect(h.update.mock.calls[0][0]).toMatchObject({ id: 'p-later', phone: '+237699123456' });
  });
});

describe('Espace commercial — numéros dans les listes', () => {
  it('les prospects : format international lisible', () => {
    mount(<CommercialProspects />, { route: '/v/prospects', path: '/v/prospects' });
    expect(screen.getByText('+237 6 90 00 00 01')).toBeTruthy();
    expect(screen.queryByText('+237690000001')).toBeNull();
  });

  it('la fiche : numéro lisible, appel et WhatsApp en E.164', () => {
    mount(<CommercialProspectForm />, { route: '/v/prospects/p-due', path: '/v/prospects/:id' });
    expect(screen.getByText('+237 6 90 00 00 01')).toBeTruthy();
    expect(screen.getByRole('link', { name: /Appeler/ }).getAttribute('href')).toBe('tel:+237690000001');
    expect(screen.getByRole('link', { name: /WhatsApp/ }).getAttribute('href')).toBe('https://wa.me/237690000001');
  });

  it('les clients : un ancien numéro local s’affiche en +237, appel et WhatsApp en E.164', () => {
    h.clients = {
      ...h.clients,
      data: [{
        user_id: 'cl-1', name: 'Esther Ngono', company: 'Ets Ngono', customer_code: 'BZ-418532', phone: '699 27 81 44',
        created_at: '2026-07-19T14:15:00Z', source_set_at: null,
        payments_xaf: 0, payments_count: 0, air_parcels: 0, air_kg: 0, sea_parcels: 0, sea_cbm: 0,
      }],
    };
    mount(<CommercialClients />);
    expect(screen.getByText('+237 6 99 27 81 44')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Appeler Esther Ngono' }).getAttribute('href')).toBe('tel:+237699278144');
    expect(screen.getByRole('link', { name: /WhatsApp/ }).getAttribute('href')).toBe('https://wa.me/237699278144');
  });
});
