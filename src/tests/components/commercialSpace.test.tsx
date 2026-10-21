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
 *   · le rond du compte mène à « Mon mot de passe », la sortie à « /v/login » ;
 *   · un compte pas encore relié à sa fiche voit un message clair ;
 *   · « Relances » ne montre que les relances échues ; la recherche trouve
 *     aussi par un autre numéro et par l'email ;
 *   · la fiche : appeler et WhatsApp pour CHAQUE numéro (E.164), le statut
 *     d'un toucher, « Perdu » exige un motif, un perdu se rouvre, une fiche
 *     d'avant le 06/10 se dit incomplète (dans la liste aussi, « À
 *     compléter »), toucher une ligne ouvre l'étape, « Compléter » enchaîne
 *     ce qui manque ; le brouillon d'un collègue ne s'affiche pas ;
 *   · les listes affichent les numéros au format international ;
 *   · « À vérifier » (07/10, un numéro déjà celui d'un client Bonzini) :
 *     la fiche l'explique, sans actions de statut, le reste modifiable ;
 *     dans la liste, la pastille, et une puce « À vérifier » qui n'apparaît
 *     que s'il y en a ; « Ouverts » ne les montre pas ; « Tous » les range
 *     après les ouverts.
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
    {
      ...base, id: 'p-verify', first_name: 'Didier', last_name: 'Fotso', city: 'Yaoundé', gender: 'MALE', phone: '+237690000004', phone_e164: '+237690000004',
      status: 'to_verify', next_action_at: past, pain_points: 'Manque de capital : trois mois de stock',
    },
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
    // La vérification des numéros d'une fiche perdue (« Rouvrir » seulement si le serveur l'accepterait).
    numbersCheck: vi.fn((_n: string[], _id: string, _enabled?: boolean) => ({ pending: false, blocking: null as string | null })),
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
  useProspectPhoneCheck: () => ({ data: undefined }),
  useProspectNumbersCheck: (numbers: string[], id: string, enabled?: boolean) => h.numbersCheck(numbers, id, enabled),
  // L'évolution (sales_series) encore en route : l'accueil montre les chiffres du mois de commercial_dashboard.
  useSalesSeries: () => ({ data: undefined, isError: false, isLoading: true, refetch: () => undefined }),
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

/** La dernière feuille ouverte (les feuilles qui se ferment restent un instant dans le DOM). */
const lastSheet = () => screen.getAllByRole('dialog').at(-1)!;
/** Le menu « … » de la fiche. */
const openMore = () => fireEvent.click(screen.getByRole('button', { name: "Plus d'actions" }));

/** `tel:` et `mailto:` passent par `window.location.href` ; jsdom ne navigue pas : on l'observe. */
function watchLocation() {
  const original = window.location;
  const fake = { href: '' } as Location;
  Object.defineProperty(window, 'location', { value: fake, configurable: true, writable: true });
  return {
    get href() { return fake.href; },
    restore: () => Object.defineProperty(window, 'location', { value: original, configurable: true, writable: true }),
  };
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
  h.list = { data: h.prospects, isLoading: false, isError: false, refetch: () => undefined };
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

  it('le rond du compte mène à « Mon mot de passe »', () => {
    mount(<CommercialRouteWrapper><CommercialHome /></CommercialRouteWrapper>, { route: '/v', path: '/v' });
    fireEvent.click(screen.getByRole('button', { name: 'Mon compte' }));
    expect(within(lastSheet()).getByRole('button', { name: /Se déconnecter/ })).toBeTruthy();
    fireEvent.click(within(lastSheet()).getByRole('button', { name: /Mon mot de passe/ }));
    expect(screen.getByTestId('where').textContent).toBe('/v/password');
  });

  it('le commercial entre, dans le langage visuel de « /v » (portée `.sales-ui`)', () => {
    const { container } = mount(<CommercialRouteWrapper><CommercialHome /></CommercialRouteWrapper>, { route: '/v', path: '/v' });
    expect(screen.getByText(/Jean$/)).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Prospect' }) as HTMLButtonElement).disabled).toBe(false);
    expect(container.querySelector('.admin-theme.sales-ui')).not.toBeNull();
  });
});

describe('Espace commercial — accueil', () => {
  it('montre les paiements du mois, les objectifs, les relances et les chiffres', () => {
    mount(<CommercialHome />);
    // Les paiements de ses clients (commercial_dashboard, sales_series encore en route).
    expect(screen.getByText('4,5 M')).toBeTruthy();
    // Pas d'objectif de paiements : la phrase calme sous le chiffre.
    expect(screen.getByText('Pas d’objectif ce mois')).toBeTruthy();
    // Ses autres objectifs : réalisé / cible et le pourcentage.
    const objective = screen.getByText('Nouveaux clients').parentElement as HTMLElement;
    expect(objective.textContent?.replace(/\s+/g, ' ')).toMatch(/2 \/ 4 50 %/);
    // Le rond « Relances » porte le nombre de relances échues ; la liste les montre.
    expect(within(screen.getByRole('button', { name: /Relances/ })).getByText('1')).toBeTruthy();
    expect(screen.getByText('Awa')).toBeTruthy();
    // Une fiche « À vérifier » ne se relance pas : elle a sa propre ligne.
    expect(screen.getByRole('button', { name: /À vérifier/ })).toBeTruthy();
    expect(screen.queryByText('Didier Fotso')).toBeNull();
  });

  it('un objectif de paiements : la barre et le pourcentage', () => {
    h.dashboard = { ...h.dashboard, data: { ...h.card, objectives: [{ metric: 'payments_xaf', target: 9_000_000, actual: 4_500_000 }] } };
    mount(<CommercialHome />);
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('50');
    expect(screen.getByText(/de 9 M$/)).toBeTruthy();
  });

  it('aucun objectif : un état vide calme', () => {
    h.dashboard = { ...h.dashboard, data: { ...h.card, objectives: [] } };
    mount(<CommercialHome />);
    expect(screen.getByText('Pas d’objectif ce mois')).toBeTruthy();
    expect(screen.queryByText('Mes objectifs')).toBeNull();
  });

  it('compte pas encore relié à sa fiche : le message du serveur, sans bouton d’action', () => {
    h.dashboard = { data: undefined, isLoading: false, isError: true, error: new Error(h.UNLINKED), refetch: () => undefined };
    mount(<CommercialHome />);
    expect(screen.getByText('Votre espace n’est pas encore prêt')).toBeTruthy();
    expect(screen.getByText(h.UNLINKED)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Prospect' })).toBeNull();
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
    expect(screen.getByRole('button', { name: /^Relances/ }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByText('Awa')).toBeTruthy();
    expect(screen.queryByText('Bruno Ekané')).toBeNull();
    expect(screen.queryByText('Chantal')).toBeNull();
    // Une fiche « À vérifier » ne se relance pas (son statut attend la direction).
    expect(screen.queryByText('Didier Fotso')).toBeNull();
  });

  it('« À vérifier » : pas dans « Ouverts » ; sa puce (comptée) les montre, avec leur pastille', () => {
    mount(<CommercialProspects />, { route: '/v/prospects', path: '/v/prospects' });
    expect(screen.queryByText('Didier Fotso')).toBeNull();
    expect(screen.getByRole('button', { name: /^Ouverts/ }).getAttribute('aria-pressed')).toBe('true');
    const chip = screen.getByRole('button', { name: /^À vérifier/ });
    expect(chip.textContent).toBe('À vérifier1');
    fireEvent.click(chip);
    expect(screen.getByRole('button', { name: /^À vérifier/ }).getAttribute('aria-pressed')).toBe('true');
    const row = screen.getByText('Didier Fotso').closest('button') as HTMLElement;
    expect(within(row).getByText('À vérifier')).toBeTruthy();
    expect(screen.queryByText('Awa')).toBeNull();
    // Une fiche en attente ne porte ni « À compléter » ni sa relance.
    expect(within(row).queryByText(/Relance/)).toBeNull();
  });

  it('pas de fiche « À vérifier » : pas de puce', () => {
    h.list = { ...h.list, data: h.prospects.filter((p) => p.status !== 'to_verify') };
    mount(<CommercialProspects />, { route: '/v/prospects', path: '/v/prospects' });
    expect(screen.queryByRole('button', { name: /^À vérifier/ })).toBeNull();
    expect(screen.getByRole('button', { name: /^Relances/ })).toBeTruthy();
  });

  it('« Tous » : les ouverts, puis les « À vérifier », puis les clos', () => {
    mount(<CommercialProspects />, { route: '/v/prospects?filtre=tous', path: '/v/prospects' });
    const all = ['Awa', 'Bruno Ekané', 'Chantal', 'Didier Fotso'];
    const names = screen.getAllByRole('button').map((row) => all.find((n) => within(row).queryByText(n))).filter(Boolean);
    expect(names).toEqual(['Awa', 'Bruno Ekané', 'Didier Fotso', 'Chantal']);
  });
});

describe('Espace commercial — la fiche', () => {
  it('« Perdu » exige un motif d’au moins 3 caractères (un motif fréquent d’un toucher)', () => {
    mount(<CommercialProspectForm />, { route: '/v/prospects/p-due', path: '/v/prospects/:id' });
    openMore();
    fireEvent.click(within(lastSheet()).getByRole('button', { name: /Marquer perdu/ }));
    const sheet = lastSheet();
    const confirm = within(sheet).getByRole('button', { name: 'Marquer perdu' }) as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);
    fireEvent.change(within(sheet).getByLabelText('Précisez'), { target: { value: 'ok' } });
    expect(confirm.disabled).toBe(true);
    fireEvent.change(within(sheet).getByLabelText('Précisez'), { target: { value: 'Trop cher' } });
    expect(confirm.disabled).toBe(false);
    fireEvent.click(confirm);
    expect(h.setStatus).toHaveBeenLastCalledWith({ id: 'p-due', status: 'lost', reason: 'Trop cher' }, expect.any(Object));
    // Un motif fréquent d'un toucher suffit ; la précision s'y ajoute.
    fireEvent.change(within(sheet).getByLabelText('Précisez'), { target: { value: '' } });
    fireEvent.click(within(sheet).getByRole('button', { name: 'A déjà un prestataire' }));
    expect(confirm.disabled).toBe(false);
    fireEvent.click(confirm);
    expect(h.setStatus).toHaveBeenLastCalledWith({ id: 'p-due', status: 'lost', reason: 'A déjà un prestataire' }, expect.any(Object));
    fireEvent.change(within(sheet).getByLabelText('Précisez'), { target: { value: 'Un cousin à Canton' } });
    fireEvent.click(confirm);
    expect(h.setStatus).toHaveBeenLastCalledWith({ id: 'p-due', status: 'lost', reason: 'A déjà un prestataire · Un cousin à Canton' }, expect.any(Object));
  });

  it('un perdu se rouvre (statut « À contacter »)', () => {
    mount(<CommercialProspectForm />, { route: '/v/prospects/p-lost', path: '/v/prospects/:id' });
    // Ses numéros sont vérifiés comme pour une réouverture (la fiche elle-même exclue).
    expect(h.numbersCheck).toHaveBeenCalledWith([expect.any(String)], 'p-lost', true);
    // Pas de statut à changer ni de « Marquer perdu » : « Rouvrir » est dans « … ».
    expect(screen.queryByRole('radiogroup', { name: 'Statut du prospect' })).toBeNull();
    openMore();
    expect(within(lastSheet()).queryByRole('button', { name: /Marquer perdu/ })).toBeNull();
    fireEvent.click(within(lastSheet()).getByRole('button', { name: /Rouvrir/ }));
    expect(h.setStatus).toHaveBeenCalledWith({ id: 'p-lost', status: 'new', reason: undefined }, expect.any(Object));
  });

  it('un perdu dont un numéro est celui d’un client (refusé par la direction) : « Rouvrir » est éteint, une phrase dit pourquoi — sans nom', () => {
    h.numbersCheck.mockReturnValue({ pending: false, blocking: 'client' });
    try {
      mount(<CommercialProspectForm />, { route: '/v/prospects/p-lost', path: '/v/prospects/:id' });
      openMore();
      const reopen = within(lastSheet()).getByRole('button', { name: /Rouvrir/ }) as HTMLButtonElement;
      expect(reopen.disabled).toBe(true);
      expect(within(reopen).getByText('Un numéro est celui d’un client Bonzini')).toBeTruthy();
      fireEvent.click(reopen);
      expect(h.setStatus).not.toHaveBeenCalled();
    } finally {
      h.numbersCheck.mockReturnValue({ pending: false, blocking: null });
    }
  });

  it('un perdu, la vérification en cours : « Rouvrir » attend la réponse', () => {
    h.numbersCheck.mockReturnValue({ pending: true, blocking: null });
    try {
      mount(<CommercialProspectForm />, { route: '/v/prospects/p-lost', path: '/v/prospects/:id' });
      openMore();
      expect((within(lastSheet()).getByRole('button', { name: /Rouvrir/ }) as HTMLButtonElement).disabled).toBe(true);
    } finally {
      h.numbersCheck.mockReturnValue({ pending: false, blocking: null });
    }
  });

  it('une fiche ouverte ne lance pas la vérification de réouverture', () => {
    mount(<CommercialProspectForm />, { route: '/v/prospects/p-later', path: '/v/prospects/:id' });
    expect(h.numbersCheck).toHaveBeenLastCalledWith(['+237690000002', '+8613812345678'], 'p-later', false);
  });

  it('le statut se change d’un toucher sur le segmenté', () => {
    mount(<CommercialProspectForm />, { route: '/v/prospects/p-later', path: '/v/prospects/:id' });
    const group = screen.getByRole('radiogroup', { name: 'Statut du prospect' });
    expect(within(group).getByRole('radio', { name: 'À contacter' }).getAttribute('aria-checked')).toBe('true');
    fireEvent.click(within(group).getByRole('radio', { name: 'Contacté' }));
    expect(h.setStatus).toHaveBeenCalledWith({ id: 'p-later', status: 'contacted', reason: undefined }, expect.any(Object));
  });

  it('appeler et WhatsApp pour CHAQUE numéro, en E.164 ; écrire à l’email', () => {
    const loc = watchLocation();
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    try {
      mount(<CommercialProspectForm />, { route: '/v/prospects/p-later', path: '/v/prospects/:id' });
      // Les ronds : le numéro principal.
      fireEvent.click(screen.getByRole('button', { name: 'Appeler' }));
      expect(loc.href).toBe('tel:+237690000002');
      fireEvent.click(screen.getByRole('button', { name: 'WhatsApp' }));
      expect(open).toHaveBeenLastCalledWith('https://wa.me/237690000002', '_blank', 'noopener');
      // Chaque numéro, avec son libellé : toucher la ligne propose Appeler ou WhatsApp.
      expect(screen.getByText('WeChat')).toBeTruthy();
      fireEvent.click(screen.getByRole('button', { name: /^WeChat\s*\+86 138 1234 5678/ }));
      fireEvent.click(within(lastSheet()).getByRole('button', { name: 'Appeler' }));
      expect(loc.href).toBe('tel:+8613812345678');
      fireEvent.click(screen.getByRole('button', { name: /^WeChat/ }));
      fireEvent.click(within(lastSheet()).getByRole('button', { name: 'WhatsApp' }));
      expect(open).toHaveBeenLastCalledWith('https://wa.me/8613812345678', '_blank', 'noopener');
      // L'email : écrire.
      fireEvent.click(screen.getByRole('button', { name: /^Email\s*bruno\.ekane@gmail\.com/ }));
      fireEvent.click(within(lastSheet()).getByRole('button', { name: 'Écrire' }));
      expect(loc.href).toBe('mailto:bruno.ekane@gmail.com');
    } finally {
      open.mockRestore();
      loc.restore();
    }
  });

  it('ses besoins sont mis en valeur ; une fiche complète n’a pas de bandeau', () => {
    mount(<CommercialProspectForm />, { route: '/v/prospects/p-later', path: '/v/prospects/:id' });
    expect(screen.getByText('Payer ses fournisseurs en Chine : trop lent')).toBeTruthy();
    expect(screen.getByText('Régler en 48 h')).toBeTruthy();
    expect(screen.queryByText('À compléter')).toBeNull();
    expect(screen.queryByText(/^Il manque/)).toBeNull();
  });

  it('une fiche d’avant le 06/10 (sans nom, sexe, ville ni « ses plus gros problèmes ») le dit ; « Compléter » enchaîne ce qui manque', () => {
    mount(<CommercialProspectForm />, { route: '/v/prospects/p-due', path: '/v/prospects/:id' });
    expect(screen.getByText('À compléter')).toBeTruthy();
    // La fiche dit ce qui manque, au-dessus du rond « Compléter ».
    expect(screen.getByText('Il manque le nom, le sexe, la ville et ses plus gros problèmes.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Compléter' }));
    expect(screen.getByText('Compléter la fiche')).toBeTruthy();
    expect(screen.getByRole('progressbar', { name: 'Étape 1 sur 3' })).toBeTruthy();
  });

  it('dans la liste, une fiche incomplète porte « À compléter » ; une fiche complète, non', () => {
    // (Une relance échue passe avant : une seule pastille par ligne.)
    const later = new Date(Date.now() + 3 * 86_400_000).toISOString();
    h.list = { ...h.list, data: h.prospects.map((p) => (p.id === 'p-due' ? { ...p, next_action_at: later } : p)) };
    mount(<CommercialProspects />, { route: '/v/prospects', path: '/v/prospects' });
    const row = (name: string) => screen.getByText(name).closest('button') as HTMLElement;
    expect(within(row('Awa')).getByText('À compléter')).toBeTruthy();
    expect(within(row('Bruno Ekané')).queryByText('À compléter')).toBeNull();
  });

  it('le brouillon d’un collègue, laissé sur le même téléphone, n’apparaît pas dans la liste', () => {
    const draft = { v: 1, step: 'reach', savedAt: '', draft: { firstName: 'Gaëlle', lastName: 'Nkoulou', gender: 'FEMALE', phone: { country: 'CM', national: '' } } };
    localStorage.setItem('bonzini.v.prospect-draft:u-autre', JSON.stringify({ ...draft, owner: 'u-autre' }));
    mount(<CommercialProspects />, { route: '/v/prospects', path: '/v/prospects' });
    expect(screen.queryByText(/Brouillon/)).toBeNull();
    // Le sien, oui.
    localStorage.setItem('bonzini.v.prospect-draft:u1', JSON.stringify({ ...draft, owner: 'u1' }));
    mount(<CommercialProspects />, { route: '/v/prospects', path: '/v/prospects' });
    expect(screen.getByText('Brouillon · Gaëlle Nkoulou')).toBeTruthy();
  });

  it('« À vérifier » : le bandeau l’explique ; pas d’actions de statut ; le reste de la fiche se modifie', () => {
    mount(<CommercialProspectForm />, { route: '/v/prospects/p-verify', path: '/v/prospects/:id' });
    expect(screen.getAllByText('À vérifier').length).toBeGreaterThan(0);
    const notice = screen.getByText('En attente de la direction').closest('[role="status"]') as HTMLElement;
    expect(notice.textContent?.replace(/\u00a0/g, ' ')).toMatch(/Un de ses numéros est déjà celui d’un client Bonzini\. La direction est prévenue : elle vous attribuera ce client si c’est bien vous qui l’avez convaincu\./);
    // Le commercial ne sait pas de quel client il s'agit : aucun nom de client, aucune action de statut.
    expect(screen.queryByRole('radiogroup', { name: 'Statut du prospect' })).toBeNull();
    openMore();
    expect(within(lastSheet()).queryByRole('button', { name: /Marquer perdu/ })).toBeNull();
    expect(within(lastSheet()).queryByRole('button', { name: /Rouvrir/ })).toBeNull();
    expect(within(lastSheet()).getByRole('button', { name: /Modifier/ })).toBeTruthy();
    // Appeler, WhatsApp et les lignes à modifier restent.
    expect(screen.getByRole('button', { name: 'Appeler' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'WhatsApp' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /^Problème/ }));
    expect(screen.getByText(/Modifier · Ses problèmes/)).toBeTruthy();
  });

  it('juste enregistrée, pas encore dans la liste relue : on attend la relecture, pas de « Prospect introuvable »', () => {
    h.list = { ...h.list, isFetching: true } as typeof h.list;
    mount(<CommercialProspectForm />, { route: '/v/prospects/p-tout-neuf', path: '/v/prospects/:id' });
    expect(screen.getByLabelText('Chargement')).toBeTruthy();
    expect(screen.queryByText('Prospect introuvable')).toBeNull();
    // Relue sans elle : introuvable, cette fois.
    h.list = { ...h.list, isFetching: false } as typeof h.list;
    mount(<CommercialProspectForm />, { route: '/v/prospects/p-tout-neuf', path: '/v/prospects/:id' });
    expect(screen.getByText('Prospect introuvable')).toBeTruthy();
  });

  it('toucher une ligne de la fiche ouvre l’étape de l’assistant, pré-remplie', () => {
    mount(<CommercialProspectForm />, { route: '/v/prospects/p-later', path: '/v/prospects/:id' });
    fireEvent.click(screen.getByRole('button', { name: /^Problème/ }));
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
    fireEvent.change(screen.getByPlaceholderText('Nom, entreprise ou téléphone'), { target: { value: '138 1234' } });
    expect(screen.getByText('Bruno Ekané')).toBeTruthy();
    expect(screen.queryByText('Awa')).toBeNull();
    fireEvent.change(screen.getByPlaceholderText('Nom, entreprise ou téléphone'), { target: { value: 'ekane@gmail' } });
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
    expect(screen.getByRole('link', { name: 'Appeler Esther Ngono' }).getAttribute('href')).toBe('tel:+237699278144');
    expect(screen.getByRole('link', { name: 'Écrire à Esther Ngono sur WhatsApp' }).getAttribute('href')).toBe('https://wa.me/237699278144');
    // Toucher la ligne : ses chiffres du mois et son numéro, au format international.
    fireEvent.click(screen.getByText('Esther Ngono'));
    expect(within(lastSheet()).getByText('+237 6 99 27 81 44')).toBeTruthy();
  });
});
