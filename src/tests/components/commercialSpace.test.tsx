/**
 * L'espace du commercial (« /v »).
 *
 *   · chaque écran de route se monte avec un routeur et un client de
 *     requêtes, rien d'autre (la session du personnel est fournie par
 *     App.tsx pour toute l'application — ici, son hook est simulé) ;
 *   · la coquille renvoie un non-commercial vers SON espace, et une
 *     personne non connectée vers SA connexion, « /v/login » (email + mot
 *     de passe : son adresse est souvent inventée, aucun code ne lui arrive) ;
 *     elle pose la portée `.sales-ui` (le langage visuel de « /v ») ;
 *   · son menu mène à « Changer mon mot de passe », la sortie à « /v/login » ;
 *   · un compte pas encore relié à sa fiche voit un message clair ;
 *   · « À relancer » ne montre que les relances échues ; la recherche trouve
 *     aussi par un autre numéro et par l'email ;
 *   · la fiche : appeler et WhatsApp pour CHAQUE numéro (E.164), le statut
 *     d'un toucher, « Perdu » exige un motif, un perdu se rouvre, une fiche
 *     d'avant le 06/10 se dit incomplète (dans la liste aussi, « À
 *     compléter »), « Modifier » ouvre l'étape, « Compléter » enchaîne ce qui
 *     manque ; le brouillon d'un collègue ne s'affiche pas ;
 *   · les listes affichent les numéros au format international.
 * L'assistant « Nouveau prospect » a son propre fichier
 * (salesProspectWizard.test.tsx).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
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
    gender: null, birth_date: null, email: null, pain_points: null, help_needed: null, phones: [] as unknown[],
  };
  const prospects = [
    { ...base, id: 'p-due', first_name: 'Awa', phone: '+237690000001', phone_e164: '+237690000001', status: 'contacted', next_action_at: past },
    {
      ...base, id: 'p-later', first_name: 'Bruno', last_name: 'Ekané', city: 'Douala', gender: 'MALE', email: 'bruno.ekane@gmail.com',
      phone: '+237690000002', phone_e164: '+237690000002', status: 'new', next_action_at: future,
      pain_points: 'Payer ses fournisseurs en Chine : trop lent', help_needed: 'Régler en 48 h',
      phones: [{ phone_e164: '+8613812345678', country_iso: 'CN', label: 'WeChat', position: 0 }],
    },
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
  localStorage.clear();
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

  it('sans session : vers SA connexion « /v/login » (email + mot de passe), pas vers le code email de « /m/login »', () => {
    h.auth.isAuthenticated = false;
    mount(<CommercialRouteWrapper><CommercialHome /></CommercialRouteWrapper>, { route: '/v', path: '/v' });
    expect(screen.getByTestId('where').textContent).toBe('/v/login');
  });

  it('« /v/login » s’affiche sans session (pas de boucle de redirection)', () => {
    h.auth.isAuthenticated = false;
    mount(<CommercialRouteWrapper requireAuth={false}><p>écran de connexion</p></CommercialRouteWrapper>, { route: '/v/login', path: '/v/login' });
    expect(screen.getByText('écran de connexion')).toBeTruthy();
    expect(screen.queryByTestId('where')).toBeNull();
  });

  it('le menu du compte mène à « Changer mon mot de passe »', () => {
    mount(<CommercialRouteWrapper><CommercialHome /></CommercialRouteWrapper>, { route: '/v', path: '/v' });
    fireEvent.click(screen.getByRole('button', { name: 'Mon compte' }));
    fireEvent.click(screen.getByRole('menuitem', { name: /Changer mon mot de passe/ }));
    expect(screen.getByTestId('where').textContent).toBe('/v/password');
  });

  it('le commercial entre, dans le langage visuel de « /v » (portée `.sales-ui`)', () => {
    const { container } = mount(<CommercialRouteWrapper><CommercialHome /></CommercialRouteWrapper>, { route: '/v', path: '/v' });
    expect(screen.getByText(/Jean$/)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Nouveau prospect/ })).toBeTruthy();
    expect(container.querySelector('.admin-theme.sales-ui')).not.toBeNull();
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
    expect(screen.getByText('Bruno Ekané')).toBeTruthy();
    expect(screen.queryByText('Chantal')).toBeNull();
  });

  it('« ?filtre=relancer » : seulement les relances échues', () => {
    mount(<CommercialProspects />, { route: '/v/prospects?filtre=relancer', path: '/v/prospects' });
    expect(screen.getByRole('button', { name: /À relancer/ }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByText('Awa')).toBeTruthy();
    expect(screen.queryByText('Bruno Ekané')).toBeNull();
    expect(screen.queryByText('Chantal')).toBeNull();
  });
});

describe('Espace commercial — la fiche', () => {
  it('« Perdu » exige un motif d’au moins 3 caractères (un motif fréquent d’un toucher)', () => {
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
    fireEvent.click(within(sheet).getByRole('button', { name: 'A déjà un transitaire' }));
    expect((within(sheet).getByLabelText('Pourquoi ?') as HTMLTextAreaElement).value).toBe('A déjà un transitaire');
  });

  it('un perdu se rouvre (statut « À contacter »)', () => {
    mount(<CommercialProspectForm />, { route: '/v/prospects/p-lost', path: '/v/prospects/:id' });
    fireEvent.click(screen.getByRole('button', { name: /Rouvrir/ }));
    expect(h.setStatus).toHaveBeenCalledWith({ id: 'p-lost', status: 'new', reason: undefined }, expect.any(Object));
  });

  it('le statut se change d’un toucher sur le segmenté', () => {
    mount(<CommercialProspectForm />, { route: '/v/prospects/p-later', path: '/v/prospects/:id' });
    const group = screen.getByRole('radiogroup', { name: 'Statut du prospect' });
    expect(within(group).getByRole('radio', { name: 'À contacter' }).getAttribute('aria-checked')).toBe('true');
    fireEvent.click(within(group).getByRole('radio', { name: 'Contacté' }));
    expect(h.setStatus).toHaveBeenCalledWith({ id: 'p-later', status: 'contacted', reason: undefined }, expect.any(Object));
  });

  it('appeler et WhatsApp pour CHAQUE numéro, en E.164 ; l’email en lien', () => {
    mount(<CommercialProspectForm />, { route: '/v/prospects/p-later', path: '/v/prospects/:id' });
    expect(screen.getByRole('link', { name: 'Appeler le +237 6 90 00 00 02' }).getAttribute('href')).toBe('tel:+237690000002');
    expect(screen.getByRole('link', { name: 'WhatsApp : +237 6 90 00 00 02' }).getAttribute('href')).toBe('https://wa.me/237690000002');
    expect(screen.getByRole('link', { name: 'Appeler le +86 138 1234 5678' }).getAttribute('href')).toBe('tel:+8613812345678');
    expect(screen.getByRole('link', { name: 'WhatsApp : +86 138 1234 5678' }).getAttribute('href')).toBe('https://wa.me/8613812345678');
    expect(screen.getByText('WeChat')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Écrire à bruno.ekane@gmail.com' }).getAttribute('href')).toBe('mailto:bruno.ekane@gmail.com');
  });

  it('ses besoins sont mis en valeur ; une fiche complète n’a pas de bandeau', () => {
    mount(<CommercialProspectForm />, { route: '/v/prospects/p-later', path: '/v/prospects/:id' });
    expect(screen.getByText('Payer ses fournisseurs en Chine : trop lent')).toBeTruthy();
    expect(screen.getByText('Régler en 48 h')).toBeTruthy();
    expect(screen.queryByText('Fiche incomplète')).toBeNull();
  });

  it('une fiche d’avant le 06/10 (sans nom, sexe, ville ni « ses plus gros problèmes ») le dit ; « Compléter » enchaîne ce qui manque', () => {
    mount(<CommercialProspectForm />, { route: '/v/prospects/p-due', path: '/v/prospects/:id' });
    expect(screen.getByText('Fiche incomplète')).toBeTruthy();
    // Le bandeau dit ce qui manque — sans renvoyer « à la prochaine modification » à côté d'un bouton « Compléter ».
    expect(screen.getByText('Il manque le nom, le sexe, la ville et ses plus gros problèmes.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Compléter' }));
    expect(screen.getByText('Compléter la fiche')).toBeTruthy();
    expect(screen.getByRole('progressbar', { name: 'Étape 1 sur 3' })).toBeTruthy();
  });

  it('dans la liste, une fiche incomplète porte « À compléter » ; une fiche complète, non', () => {
    mount(<CommercialProspects />, { route: '/v/prospects', path: '/v/prospects' });
    const row = (name: string) => screen.getByText(name).closest('button') as HTMLElement;
    expect(within(row('Awa')).getByText('À compléter')).toBeTruthy();
    expect(within(row('Bruno Ekané')).queryByText('À compléter')).toBeNull();
  });

  it('le brouillon d’un collègue, laissé sur le même téléphone, n’apparaît pas dans la liste', () => {
    const draft = { v: 1, step: 'reach', savedAt: '', draft: { firstName: 'Gaëlle', lastName: 'Nkoulou', gender: 'FEMALE', phone: { country: 'CM', national: '' } } };
    localStorage.setItem('bonzini.v.prospect-draft:u-autre', JSON.stringify({ ...draft, owner: 'u-autre' }));
    mount(<CommercialProspects />, { route: '/v/prospects', path: '/v/prospects' });
    expect(screen.queryByText(/Saisie en cours/)).toBeNull();
    // Le sien, oui.
    localStorage.setItem('bonzini.v.prospect-draft:u1', JSON.stringify({ ...draft, owner: 'u1' }));
    mount(<CommercialProspects />, { route: '/v/prospects', path: '/v/prospects' });
    expect(screen.getByText('Saisie en cours : Gaëlle Nkoulou')).toBeTruthy();
  });

  it('« Modifier » sur une section ouvre l’étape de l’assistant, pré-remplie', () => {
    mount(<CommercialProspectForm />, { route: '/v/prospects/p-later', path: '/v/prospects/:id' });
    fireEvent.click(screen.getByRole('button', { name: 'Modifier ses problèmes' }));
    expect(screen.getByText(/Modifier · Ses problèmes/)).toBeTruthy();
    expect((screen.getByLabelText(/Ses plus gros problèmes/) as HTMLTextAreaElement).value).toBe('Payer ses fournisseurs en Chine : trop lent');
  });
});

describe('Espace commercial — numéros dans les listes', () => {
  it('les prospects : format international lisible', () => {
    mount(<CommercialProspects />, { route: '/v/prospects', path: '/v/prospects' });
    expect(screen.getByText('+237 6 90 00 00 01')).toBeTruthy();
    expect(screen.queryByText('+237690000001')).toBeNull();
  });

  it('la recherche trouve aussi par un autre numéro et par l’email', () => {
    mount(<CommercialProspects />, { route: '/v/prospects', path: '/v/prospects' });
    fireEvent.change(screen.getByLabelText('Rechercher un prospect'), { target: { value: '138 1234' } });
    expect(screen.getByText('Bruno Ekané')).toBeTruthy();
    expect(screen.queryByText('Awa')).toBeNull();
    fireEvent.change(screen.getByLabelText('Rechercher un prospect'), { target: { value: 'ekane@gmail' } });
    expect(screen.getByText('Bruno Ekané')).toBeTruthy();
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
