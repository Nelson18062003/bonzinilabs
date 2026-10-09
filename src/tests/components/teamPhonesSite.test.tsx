/**
 * Mes équipes — numéros et site d'un collaborateur, à l'écran (06/10).
 *
 *   · « Nouvel accès » envoie les numéros (format international, pays,
 *     libellé) et le site ; le site proposé dépend du rôle et se change ;
 *     sans numéro, rien ne bloque ; un numéro commencé doit être complet ;
 *   · l'écran de fin dit clairement quand numéros ou site n'ont pas suivi ;
 *   · la fiche et la liste tiennent avec une réponse ancienne (ni `phones`
 *     ni `site`) et montrent tous les numéros, avec appel et WhatsApp ;
 *   · « Modifier » n'envoie plus de numéro à team_update_member ;
 *   · l'éditeur de numéros parle d'un collaborateur, sans toucher au client.
 */
import { useEffect } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, renderHook, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { TeamMember } from '@/hooks/useTeam';

const h = vi.hoisted(() => {
  const SITES = [
    { id: 's-gz', code: 'gz_office', label: 'Guangzhou · bureau', country_iso: 'CN', is_active: true, members: 1 },
    { id: 's-gzw', code: 'gz_warehouse', label: 'Guangzhou · entrepôt', country_iso: 'CN', is_active: true, members: 0 },
    { id: 's-dla', code: 'douala', label: 'Douala', country_iso: 'CM', is_active: true, members: 1 },
    { id: 's-yde', code: 'yaounde', label: 'Yaoundé', country_iso: 'CM', is_active: true, members: 0 },
  ];
  return {
    SITES,
    members: [] as unknown[],
    create: vi.fn(),
    update: vi.fn(),
    profile: vi.fn(),
    createSite: vi.fn(),
  };
});

vi.mock('@/contexts/AdminAuthContext', async (orig) => ({
  ...(await orig<typeof import('@/contexts/AdminAuthContext')>()),
  useAdminAuth: () => ({
    currentUser: { id: 'u-nelson', role: 'super_admin' },
    hasPermission: () => true,
  }),
}));
vi.mock('@/hooks/useTeam', () => ({
  useTeamMembers: () => ({ data: h.members, isLoading: false, isError: false, refetch: () => undefined }),
  useTeamSites: () => ({ data: h.SITES, isLoading: false, isError: false, refetch: () => undefined }),
  useCreateTeamSite: () => ({ mutate: h.createSite, isPending: false }),
  useCreateTeamMember: () => ({ mutate: h.create, isPending: false }),
  useSetMemberProfile: () => ({ mutateAsync: h.profile, isPending: false }),
  useUpdateTeamMember: () => ({ mutate: h.update, mutateAsync: h.update, isPending: false }),
  useLinkCommercial: () => ({ mutate: vi.fn(), isPending: false }),
}));
vi.mock('@/hooks/useClientSources', () => ({ useClientSources: () => ({ data: [], isLoading: false }) }));
vi.mock('@/hooks/useAdminManagement', () => ({
  useResetAdminPassword: () => ({ mutate: vi.fn(), isPending: false }),
  useToggleAdminStatus: () => ({ mutate: vi.fn(), isPending: false }),
}));
vi.mock('@/hooks/useSales', () => ({ useCommercialDashboard: () => ({ data: null, isLoading: false, isError: false }) }));

import { TeamNewMember } from '@/components/team/TeamNewMember';
import { TeamMemberScreen } from '@/components/team/TeamMemberScreen';
import { TeamScreen } from '@/components/team/TeamScreen';
import { ClientPhonesEditor } from '@/components/clients/ClientPhonesEditor';
import { useClientPhonesEditor } from '@/components/clients/useClientPhonesEditor';

function mount(path: string) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/m/equipe" element={<TeamScreen />} />
          <Route path="/m/equipe/nouveau" element={<TeamNewMember />} />
          <Route path="/m/equipe/:userId" element={<TeamMemberScreen />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const base = {
  email: null, first_name: null, last_name: null, phone: null, avatar_url: null, is_disabled: false,
  created_at: '2026-04-14T02:00:00Z', last_sign_in_at: null, source: null,
};
const KEVIN = {
  ...base, user_id: 'u-kevin', role: 'receptionist', email: 'kevin.nkolo@bonzinilabs.com', first_name: 'Kevin', last_name: 'Nkolo',
  phone: '+8613826047731',
  phones: [
    { phone_e164: '+8613826047731', country_iso: 'CN', label: null },
    { phone_e164: '+237671513376', country_iso: 'CM', label: 'MTN' },
  ],
  site: { id: 's-gz', code: 'gz_office', label: 'Guangzhou · bureau', country_iso: 'CN' },
} as TeamMember;
// Une réponse d'avant le 06/10 : ni `phones` ni `site`.
const PAUL = { ...base, user_id: 'u-paul', role: 'customer_success', email: 'paul.nana@bonzinilabs.com', first_name: 'Paul', last_name: 'Nana', phone: '+237 670 64 13 92' } as unknown as TeamMember;

function fillIdentity() {
  fireEvent.change(screen.getByLabelText('Prénom'), { target: { value: 'Joël' } });
  fireEvent.change(screen.getByLabelText('Nom'), { target: { value: 'Essomba' } });
  fireEvent.change(screen.getByLabelText('Email (sert à se connecter)'), { target: { value: 'joel.essomba@bonzinilabs.com' } });
}
const phoneInput = (container: HTMLElement, i: number) => container.querySelector(`#team-phone-${i}`) as HTMLInputElement;
const siteChip = (label: string) => within(screen.getByRole('group', { name: 'Site' })).getByRole('button', { name: new RegExp(`^${label}`) });

beforeEach(() => {
  h.members = [KEVIN, PAUL];
  h.create.mockReset();
  h.update.mockReset().mockResolvedValue({ role: 'receptionist' });
  h.profile.mockReset().mockResolvedValue({ phone: null });
  h.createSite.mockReset();
});

describe('Nouvel accès — numéros et site', () => {
  it('réceptionnaire : Guangzhou · bureau proposé ; envoie ses deux numéros (Cameroun, Chine « WeChat ») et le site', async () => {
    // Le sélecteur de pays (Radix + cmdk) mesure et fait défiler : jsdom n'a ni l'un ni l'autre.
    vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
    Element.prototype.scrollIntoView ??= () => undefined;
    const { container } = mount('/m/equipe/nouveau?role=receptionist');
    expect(siteChip('Guangzhou · bureau')).toHaveAttribute('aria-pressed', 'true');
    // Pour un collaborateur : « Principal », et pas « connexion et SMS ».
    expect(screen.getByText('Principal')).toBeInTheDocument();
    expect(screen.getByText('Le numéro où l’on joint ce collaborateur.')).toBeInTheDocument();
    expect(screen.queryByText(/connexion et SMS/)).toBeNull();

    fillIdentity();
    fireEvent.change(phoneInput(container, 0), { target: { value: '677214598' } });
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter un numéro' }));
    // Le second numéro est chinois : on change son indicatif, puis on le saisit.
    fireEvent.click(screen.getAllByRole('button', { name: 'Indicatif' })[1]);
    fireEvent.change(await screen.findByPlaceholderText('Rechercher un pays, un code ou un indicatif…'), { target: { value: 'chine' } });
    fireEvent.click(await screen.findByRole('option', { name: /Chine/ }));
    fireEvent.change(phoneInput(container, 1), { target: { value: '139 2214 5530' } });
    fireEvent.click(screen.getByRole('button', { name: 'Autre…' }));
    fireEvent.change(screen.getByPlaceholderText('Votre libellé : WeChat, Maison…'), { target: { value: 'WeChat' } });
    fireEvent.click(screen.getByRole('button', { name: 'Créer l’accès' }));

    expect(h.create).toHaveBeenCalledTimes(1);
    expect(h.create.mock.calls[0][0]).toMatchObject({
      firstName: 'Joël',
      role: 'receptionist',
      phones: [
        { phone_e164: '+237677214598', country_iso: 'CM', label: null },
        { phone_e164: '+8613922145530', country_iso: 'CN', label: 'WeChat' },
      ],
      siteId: 's-gz',
    });
  });

  it('un numéro commencé mais incomplet bloque la création, et le dit', () => {
    const { container } = mount('/m/equipe/nouveau?role=receptionist');
    fillIdentity();
    fireEvent.change(phoneInput(container, 0), { target: { value: '6 77 21' } });
    fireEvent.click(screen.getByRole('button', { name: 'Créer l’accès' }));
    expect(h.create).not.toHaveBeenCalled();
    expect(screen.getByText('Un numéro est incomplet : complétez-le ou effacez-le.')).toBeInTheDocument();
  });

  it('envoie `phones` au format international et `siteId`, le site choisi remplaçant celui proposé', () => {
    const { container } = mount('/m/equipe/nouveau?role=receptionist');
    fillIdentity();
    fireEvent.change(phoneInput(container, 0), { target: { value: '6 77 21 45 98' } });
    fireEvent.click(siteChip('Douala'));
    fireEvent.click(screen.getByRole('button', { name: 'Créer l’accès' }));
    expect(h.create).toHaveBeenCalledTimes(1);
    expect(h.create.mock.calls[0][0]).toMatchObject({
      email: 'joel.essomba@bonzinilabs.com',
      role: 'receptionist',
      phones: [{ phone_e164: '+237677214598', country_iso: 'CM', label: null }],
      siteId: 's-dla',
    });
  });

  it('agent d’entrepôt : Douala proposé ; toucher la puce choisie retire le site', () => {
    mount('/m/equipe/nouveau?role=warehouse_agent');
    expect(siteChip('Douala')).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(siteChip('Douala'));
    fillIdentity();
    fireEvent.click(screen.getByRole('button', { name: 'Créer l’accès' }));
    expect(h.create.mock.calls[0][0]).toMatchObject({ phones: [], siteId: null });
  });

  it('les autres rôles : aucun site proposé, et aucun numéro n’est exigé', () => {
    mount('/m/equipe/nouveau?role=ops');
    for (const chip of within(screen.getByRole('group', { name: 'Site' })).getAllByRole('button', { pressed: false })) {
      expect(chip).toHaveAttribute('aria-pressed', 'false');
    }
    expect(within(screen.getByRole('group', { name: 'Site' })).queryAllByRole('button', { pressed: true })).toHaveLength(0);
    fillIdentity();
    fireEvent.click(screen.getByRole('button', { name: 'Créer l’accès' }));
    expect(h.create.mock.calls[0][0]).toMatchObject({ role: 'ops', phones: [], siteId: null });
  });

  it('numéros et site perdus : l’accès est créé, l’écran de fin dit quoi refaire', () => {
    h.create.mockImplementation((_m, opts) => opts.onSuccess({ userId: 'u-joel', email: 'joel.essomba@bonzinilabs.com', tempPassword: 'x1y2z3', sourceId: null, profileFailed: true }));
    const { container } = mount('/m/equipe/nouveau?role=receptionist');
    fillIdentity();
    fireEvent.change(phoneInput(container, 0), { target: { value: '677214598' } });
    fireEvent.click(screen.getByRole('button', { name: 'Créer l’accès' }));
    expect(screen.getByText('Accès créé pour Joël Essomba')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('L’accès est créé, mais ses numéros et son site n’ont pas pu être enregistrés.');
  });
});

describe('La fiche d’un membre', () => {
  it('montre le site et tous les numéros, avec appel et WhatsApp', () => {
    mount('/m/equipe/u-kevin');
    expect(screen.getByText('Guangzhou · bureau')).toBeInTheDocument();
    expect(screen.getByText('+86 138 2604 7731')).toBeInTheDocument();
    expect(screen.getByText('+237 6 71 51 33 76')).toBeInTheDocument();
    expect(screen.getByText('MTN')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Appeler Kevin Nkolo au +237 6 71 51 33 76' })).toHaveAttribute('href', 'tel:+237671513376');
    expect(screen.getByRole('link', { name: 'Écrire à Kevin Nkolo sur WhatsApp au +86 138 2604 7731' })).toHaveAttribute('href', 'https://wa.me/8613826047731');
  });

  it('une réponse ancienne (ni `phones` ni `site`) s’affiche quand même', () => {
    mount('/m/equipe/u-paul');
    expect(screen.getByText('Paul Nana')).toBeInTheDocument();
    expect(screen.getByText('+237 6 70 64 13 92')).toBeInTheDocument();
    expect(screen.getByText('Non renseigné')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /WhatsApp/ })).toHaveAttribute('href', 'https://wa.me/237670641392');
  });

  it('« Modifier » : le nom part sans numéro ; numéros et site par team_set_member_profile', async () => {
    const { container } = mount('/m/equipe/u-kevin');
    fireEvent.click(screen.getByRole('button', { name: 'Modifier' }));
    const dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Prénom'), { target: { value: 'Kévin' } });
    fireEvent.change(container.querySelector('#team-edit-phone-1') as HTMLInputElement, { target: { value: '699 00 00 00' } });
    fireEvent.click(within(within(dialog).getByRole('group', { name: 'Site' })).getByRole('button', { name: /^Douala/ }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Enregistrer' }));
    await vi.waitFor(() => expect(h.update).toHaveBeenCalled());
    expect(h.profile).toHaveBeenCalledWith({
      userId: 'u-kevin',
      phones: [
        { phone_e164: '+8613826047731', country_iso: 'CN', label: null },
        { phone_e164: '+237699000000', country_iso: 'CM', label: 'MTN' },
      ],
      siteId: 's-dla',
    });
    expect(h.update).toHaveBeenCalledWith({ userId: 'u-kevin', firstName: 'Kévin', lastName: 'Nkolo' });
    expect(h.update.mock.calls[0][0]).not.toHaveProperty('phone');
  });

  it('« Modifier » sans rien toucher aux numéros ni au site : rien n’est envoyé à team_set_member_profile', async () => {
    mount('/m/equipe/u-kevin');
    fireEvent.click(screen.getByRole('button', { name: 'Modifier' }));
    const dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Nom'), { target: { value: 'Nkolo Mballa' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Enregistrer' }));
    await vi.waitFor(() => expect(h.update).toHaveBeenCalled());
    expect(h.profile).not.toHaveBeenCalled();
  });
});

describe('La liste', () => {
  it('montre le site et le numéro principal lisible ; tient avec une réponse ancienne', () => {
    mount('/m/equipe');
    const kevin = screen.getByRole('button', { name: /Kevin Nkolo/ });
    expect(kevin).toHaveTextContent('Guangzhou · bureau');
    expect(kevin).toHaveTextContent('+86 138 2604 7731 et 1 autre');
    // Paul : une réponse d'avant le 06/10, un seul numéro en texte libre, relu et formaté.
    expect(screen.getByRole('button', { name: /Paul Nana/ })).toHaveTextContent('+237 6 70 64 13 92');
  });

  it('filtre par site, et cherche par site ou par numéro', () => {
    mount('/m/equipe');
    const sites = screen.getByRole('group', { name: 'Filtrer par site' });
    fireEvent.click(within(sites).getByRole('button', { name: /^Guangzhou · bureau/ }));
    expect(screen.getByRole('button', { name: /Kevin Nkolo/ })).toBeInTheDocument();
    fireEvent.click(within(sites).getByRole('button', { name: /^Sans site/ }));
    expect(screen.queryByRole('button', { name: /Kevin Nkolo/ })).toBeNull();
    fireEvent.click(within(sites).getByRole('button', { name: /^Tous les sites/ }));

    const search = screen.getByRole('searchbox', { name: 'Chercher un membre' });
    fireEvent.change(search, { target: { value: '671 51 33' } });
    expect(screen.getByRole('button', { name: /Kevin Nkolo/ })).toBeInTheDocument();
    fireEvent.change(search, { target: { value: 'douala' } });
    expect(screen.queryByRole('button', { name: /Kevin Nkolo/ })).toBeNull();
  });
});

describe('ClientPhonesEditor — les textes selon le variant', () => {
  it('client : inchangé (« Principal · connexion et SMS »)', () => {
    function ClientEditor() {
      const editor = useClientPhonesEditor();
      const { reset } = editor;
      useEffect(() => reset([], '+237683728216'), [reset]);
      return <ClientPhonesEditor editor={editor} />;
    }
    render(<ClientEditor />);
    expect(screen.getByText('Principal · connexion et SMS')).toBeInTheDocument();
    expect(screen.getByText('Numéros de téléphone')).toBeInTheDocument();
    expect(screen.getByText('Il sert à la connexion et reçoit le mot de passe et les SMS.')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Numéro principal (WhatsApp)' })).toHaveValue('6 83 72 82 16');
  });

  it('collaborateur : « Principal », facultatif, et l’aide qui parle de le joindre', () => {
    const { result } = renderHook(() => useClientPhonesEditor({ primaryOptional: true }));
    render(<ClientPhonesEditor editor={result.current} variant="staff" />);
    expect(screen.getByText('Principal')).toBeInTheDocument();
    expect(screen.getByText('Numéros de téléphone (facultatif)')).toBeInTheDocument();
    expect(screen.getByText('Le numéro où l’on joint ce collaborateur.')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Numéro principal' })).toBeInTheDocument();
  });
});
