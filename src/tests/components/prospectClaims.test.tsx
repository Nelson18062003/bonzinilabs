/**
 * L'écran « À vérifier » de la direction (07/10) : un commercial a saisi le
 * numéro d'un client Bonzini.
 *
 *   · côte à côte : ce que le commercial a saisi (nom, entreprise, numéros,
 *     ses problèmes) et le client reconnu (nom, code, numéro qui correspond,
 *     origine actuelle, opérations) ;
 *   · « Attribuer » : avertissement clair quand le client a déjà une origine
 *     (elle sera remplacée), rien de tel sinon ; l'envoi nomme le client ;
 *   · « Refuser » : le commercial lit un motif FIXE, « Déjà client de
 *     Bonzini » ; la note facultative de la direction reste interne, et la
 *     fenêtre le dit ;
 *   · un client déjà refusé à ce commercial le dit (date) ;
 *   · fiche d'un commercial archivé : pas d'« Attribuer », « Confier à un
 *     commercial actif » d'abord ;
 *   · plusieurs clients reconnus : rien n'est choisi d'office, « Attribuer »
 *     attend le choix, et l'envoi porte le client choisi ;
 *   · ?commercial= ne montre que les fiches d'un commercial ; état vide ;
 *   · sans canManageSales : renvoyé à l'accueil, aucune lecture.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { ProspectClaim } from '@/hooks/useSales';

const h = vi.hoisted(() => ({
  rows: [] as unknown[],
  perms: new Set<string>(['canManageSales']),
  resolve: vi.fn(),
  reassign: vi.fn(),
  claimsCalls: 0,
}));

vi.mock('@/contexts/AdminAuthContext', async (orig) => ({
  ...(await orig<typeof import('@/contexts/AdminAuthContext')>()),
  useAdminAuth: () => ({ currentUser: { id: 'u-nelson', role: 'super_admin' }, hasPermission: (p: string) => h.perms.has(p) }),
}));
vi.mock('@/hooks/useSales', () => ({
  useProspectClaims: (enabled = true) => {
    if (enabled) h.claimsCalls += 1;
    return { data: enabled ? h.rows : undefined, isLoading: false, isError: false, error: null, refetch: vi.fn() };
  },
  useResolveProspectClaim: () => ({ mutate: h.resolve, isPending: false }),
  useReassignProspect: () => ({ mutate: h.reassign, isPending: false }),
  useSalesOverview: () => ({
    data: [
      { source: { id: 'src-rodrigue', label: 'Rodrigue Tchami', is_active: true }, staff: { name: 'Rodrigue Tchami' }, metrics: { prospects_open: 4 } },
      { source: { id: 'src-yannick', label: 'Yannick Ebanda', is_active: false }, staff: { name: 'Yannick Ebanda' }, metrics: { prospects_open: 1 } },
    ],
    isLoading: false,
  }),
}));

import { ProspectClaims } from '@/components/team/ProspectClaims';

const prospect = (id: string, source_id: string, first_name: string, last_name: string, phone_e164: string, o: Record<string, unknown> = {}) => ({
  id, source_id, first_name, last_name, company: null, phone: phone_e164, phone_e164, city: 'Douala', gender: 'MALE', birth_date: null, email: null,
  pain_points: null, help_needed: null, phones: [], interests: [], notes: null, status: 'to_verify', lost_reason: null, next_action_at: null,
  converted_user_id: null, converted_at: null, status_changed_at: '2026-10-05T10:00:00Z', created_at: '2026-10-05T10:00:00Z', updated_at: '2026-10-05T10:00:00Z',
  ...o,
});
const client = (user_id: string, name: string, customer_code: string, phone_e164: string, origin: { id: string; label: string; kind: string } | null, deposits = 0, payments = 0) => ({
  user_id, name, company: null, customer_code, phone_e164, email: null, city: 'Douala', created_at: '2026-01-12T10:00:00Z',
  source_id: origin?.id ?? null, source_label: origin?.label ?? null, source_kind: origin?.kind ?? null,
  deposits_count: deposits, payments_count: payments, last_activity_at: deposits || payments ? '2026-09-28T15:05:00Z' : null,
});

const FOTSO = prospect('pr-fotso', 'src-rodrigue', 'Nadine', 'Fotso', '+237699887766', {
  company: 'Fotso Cosmétiques',
  pain_points: 'Ses paiements en Chine mettent une semaine.',
});
const KAMDEM = prospect('pr-kamdem', 'src-rodrigue', 'Serge', 'Kamdem', '+237677304118', {
  phones: [{ phone_e164: '+237691552007', country_iso: 'CM', label: 'Bureau', position: 1 }],
});
const TOURE = prospect('pr-toure', 'src-carine', 'Ibrahim', 'Touré', '+237699317240', {
  phones: [{ phone_e164: '+8613922145530', country_iso: 'CN', label: 'WeChat', position: 1 }],
});
const claim = (claim_id: string, p: ReturnType<typeof prospect>, source_label: string, matched_phone: string, c: ReturnType<typeof client>) => ({
  claim_id, prospect: p, source_id: p.source_id, source_label, matched_phone, created_at: '2026-10-05T13:52:00Z', client: c,
});
const ROWS = [
  claim('k1', FOTSO, 'Rodrigue Tchami', '+237699887766', client('u3', 'Nadia Fotso', 'BZ-207781', '+237699887766', { id: 'src-carine', label: 'Carine Ewane', kind: 'commercial' }, 1, 2)),
  claim('k2', KAMDEM, 'Rodrigue Tchami', '+237677304118', client('u-kamdem', 'Serge Kamdem', 'BZ-355120', '+237677304118', null)),
  claim('k3', KAMDEM, 'Rodrigue Tchami', '+237691552007', client('u-kamdem2', 'Arlette Kamdem', 'BZ-390044', '+237691552007', { id: 'src-bao', label: 'Bouche-à-oreille', kind: 'referral' }, 2, 3)),
  claim('k4', TOURE, 'Carine Ewane', '+8613922145530', client('u-toure', 'Ibrahim Touré', 'BZ-174320', '+237696550812', { id: 'src-facebook', label: 'Facebook', kind: 'social' }, 4, 6)),
] as unknown as ProspectClaim[];

function mount(path = '/m/equipe/ventes/a-verifier') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/m/equipe/ventes/a-verifier" element={<ProspectClaims />} />
        <Route path="/m" element={<div>accueil</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

const card = (name: RegExp) => screen.getByRole('article', { name });

beforeEach(() => {
  h.rows = ROWS;
  h.perms = new Set(['canManageSales']);
  h.resolve.mockReset();
  h.reassign.mockReset();
  h.claimsCalls = 0;
});

describe('À vérifier — affichage', () => {
  it('une fiche par prospect, côte à côte la saisie et le client reconnu', () => {
    mount();
    expect(screen.getAllByRole('article')).toHaveLength(3);
    const fotso = card(/Nadine Fotso, saisie par Rodrigue Tchami/);
    const saisi = within(fotso).getByRole('region', { name: 'Ce que le commercial a saisi' });
    expect(within(saisi).getByText('Nadine Fotso')).toBeInTheDocument();
    expect(within(saisi).getByText('Fotso Cosmétiques · Douala')).toBeInTheDocument();
    expect(within(saisi).getByText('Ses paiements en Chine mettent une semaine.')).toBeInTheDocument();
    const reconnu = within(fotso).getByRole('region', { name: 'Le client reconnu' });
    expect(within(reconnu).getByText('Nadia Fotso')).toBeInTheDocument();
    expect(within(reconnu).getByText('BZ-207781')).toBeInTheDocument();
    expect(within(reconnu).getByText('Numéro qui correspond')).toBeInTheDocument();
    expect(within(reconnu).getByText('Commercial · Carine Ewane')).toBeInTheDocument();
    expect(within(reconnu).getByText('1 dépôt · 2 paiements')).toBeInTheDocument();
  });

  it('reconnu par un AUTRE numéro : son numéro principal est aussi montré', () => {
    mount();
    const toure = card(/Ibrahim Touré, saisie par Carine Ewane/);
    expect(within(toure).getByText('Son numéro principal')).toBeInTheDocument();
    expect(within(toure).getByRole('button', { name: 'Attribuer à Carine Ewane' })).toBeEnabled();
  });
});

describe('À vérifier — attribuer', () => {
  it('le client a déjà une origine : l’avertissement dit qu’elle sera remplacée ; l’envoi nomme le client', () => {
    mount();
    fireEvent.click(within(card(/Nadine Fotso/)).getByRole('button', { name: 'Attribuer à Rodrigue Tchami' }));
    const dialog = screen.getByRole('dialog', { name: 'Attribuer Nadia Fotso à Rodrigue Tchami' });
    const warning = within(dialog).getByRole('alert');
    expect(warning).toHaveTextContent('Ce client a déjà une origine : Commercial · Carine Ewane. Elle sera remplacée par Commercial · Rodrigue Tchami');
    expect(warning).toHaveTextContent('il ne comptera plus dans les chiffres de son commercial actuel');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Attribuer' }));
    expect(h.resolve).toHaveBeenCalledWith({ prospectId: 'pr-fotso', decision: 'attribute', clientUserId: 'u3' }, expect.anything());
  });

  it('plusieurs clients : rien n’est choisi d’office, puis le client choisi part', () => {
    mount();
    const kamdem = card(/Serge Kamdem, saisie par Rodrigue Tchami/);
    expect(within(kamdem).getByText('Plusieurs clients ont ces numéros : choisissez lequel attribuer.')).toBeInTheDocument();
    const attribute = within(kamdem).getByRole('button', { name: 'Attribuer à Rodrigue Tchami' });
    expect(attribute).toBeDisabled();
    const radios = within(kamdem).getAllByRole('radio');
    expect(radios).toHaveLength(2);
    expect(radios.every((r) => r.getAttribute('aria-checked') === 'false')).toBe(true);

    fireEvent.click(within(kamdem).getByRole('radio', { name: 'Arlette Kamdem (BZ-390044)' }));
    expect(attribute).toBeEnabled();
    fireEvent.click(attribute);
    const dialog = screen.getByRole('dialog', { name: 'Attribuer Arlette Kamdem à Rodrigue Tchami' });
    expect(within(dialog).getByRole('alert')).toHaveTextContent('Bouche-à-oreille');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Attribuer' }));
    expect(h.resolve).toHaveBeenCalledWith({ prospectId: 'pr-kamdem', decision: 'attribute', clientUserId: 'u-kamdem2' }, expect.anything());
  });

  it('un client sans origine : pas d’avertissement, son origine devient le commercial', () => {
    mount();
    const kamdem = card(/Serge Kamdem/);
    fireEvent.click(within(kamdem).getByRole('radio', { name: 'Serge Kamdem (BZ-355120)' }));
    fireEvent.click(within(kamdem).getByRole('button', { name: 'Attribuer à Rodrigue Tchami' }));
    const dialog = screen.getByRole('dialog', { name: 'Attribuer Serge Kamdem à Rodrigue Tchami' });
    expect(within(dialog).queryByRole('alert')).toBeNull();
    expect(dialog).toHaveTextContent('Ce client n’a pas encore d’origine');
  });
});

describe('À vérifier — refuser', () => {
  it('note interne facultative, puis l’envoi', () => {
    mount();
    fireEvent.click(within(card(/Ibrahim Touré/)).getByRole('button', { name: 'Refuser' }));
    const dialog = screen.getByRole('dialog', { name: 'Refuser la fiche de Ibrahim Touré' });
    fireEvent.change(within(dialog).getByLabelText('Note interne (facultative)'), { target: { value: 'Client de Facebook depuis janvier' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Refuser la fiche' }));
    expect(h.resolve).toHaveBeenCalledWith({ prospectId: 'pr-toure', decision: 'reject', note: 'Client de Facebook depuis janvier' }, expect.anything());
  });

  it('le commercial ne lit que le motif fixe : la fenêtre le dit, et que la note reste interne ; le nom du commercial garde son espace', () => {
    mount();
    fireEvent.click(within(card(/Ibrahim Touré/)).getByRole('button', { name: 'Refuser' }));
    const dialog = screen.getByRole('dialog', { name: 'Refuser la fiche de Ibrahim Touré' });
    // « Carine Ewane passe », jamais « Carine Ewanepasse ».
    expect(dialog).toHaveTextContent('La fiche de Carine Ewane passe « Perdu » avec le motif « Déjà client de Bonzini »');
    expect(dialog).toHaveTextContent('c’est tout ce qu’il lira, sans savoir de quel client il s’agit');
    expect(dialog).toHaveTextContent('Pour la direction seulement (gardée au journal) : le commercial ne la voit pas.');
    expect(within(dialog).queryByText(/Motif \(facultatif\)/)).toBeNull();
  });

  it('sans note : elle part vide (le serveur pose toujours le motif fixe)', () => {
    mount();
    fireEvent.click(within(card(/Nadine Fotso/)).getByRole('button', { name: 'Refuser' }));
    fireEvent.click(screen.getByRole('button', { name: 'Refuser la fiche' }));
    expect(h.resolve).toHaveBeenCalledWith({ prospectId: 'pr-fotso', decision: 'reject', note: '' }, expect.anything());
  });
});

describe('À vérifier — déjà refusé, commercial archivé', () => {
  it('un client déjà refusé à ce commercial le dit, avec la date ; pas une première saisie', () => {
    h.rows = ROWS.map((r) => (r.claim_id === 'k4' ? { ...r, previously_rejected_at: '2026-10-03T09:00:00Z' } : { ...r, previously_rejected_at: null }));
    mount();
    expect(within(card(/Ibrahim Touré/)).getByText('Déjà refusé à Carine Ewane le 3 oct. 2026')).toBeInTheDocument();
    expect(within(card(/Nadine Fotso/)).queryByText(/Déjà refusé/)).toBeNull();
  });

  it('fiche d’un commercial archivé : pas d’« Attribuer » ; « Confier à un commercial actif » ouvre le choix (actifs seulement)', () => {
    h.rows = ROWS.map((r) => (r.claim_id === 'k4' ? { ...r, source_active: false } : { ...r, source_active: true }));
    mount();
    const toure = card(/Ibrahim Touré/);
    expect(within(toure).queryByRole('button', { name: /Attribuer/ })).toBeNull();
    expect(within(toure).getByText(/est archivée/)).toBeInTheDocument();
    fireEvent.click(within(toure).getByRole('button', { name: 'Confier à un commercial actif' }));
    const dialog = screen.getByRole('dialog', { name: 'Confier Ibrahim à un autre commercial' });
    expect(within(dialog).queryByText('Yannick Ebanda')).toBeNull();
    fireEvent.click(within(dialog).getByRole('button', { name: /Rodrigue Tchami/ }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Confier' }));
    expect(h.reassign).toHaveBeenCalledWith({ id: 'pr-toure', sourceId: 'src-rodrigue' }, expect.anything());
    // Les autres fiches gardent « Attribuer ».
    expect(within(card(/Nadine Fotso/)).getByRole('button', { name: 'Attribuer à Rodrigue Tchami' })).toBeInTheDocument();
  });
});

describe('À vérifier — filtres, vide, droits', () => {
  it('?commercial= : seulement les fiches de ce commercial', () => {
    mount('/m/equipe/ventes/a-verifier?commercial=src-carine');
    expect(screen.getAllByRole('article')).toHaveLength(1);
    expect(card(/Ibrahim Touré/)).toBeInTheDocument();
  });

  it('rien en attente : l’état vide le dit', () => {
    h.rows = [];
    mount();
    expect(screen.getByText('Rien à vérifier')).toBeInTheDocument();
    expect(screen.queryByRole('article')).toBeNull();
  });

  it('sans canManageSales : renvoyé à l’accueil, sans lire les fiches', () => {
    h.perms = new Set(['canManageUsers', 'canViewClients']);
    mount();
    expect(screen.getByText('accueil')).toBeInTheDocument();
    expect(h.claimsCalls).toBe(0);
  });
});
