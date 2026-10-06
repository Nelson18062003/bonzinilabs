/**
 * L'assistant « prospect » de l'espace commercial (« /v/prospects/new » et
 * « /v/prospects/:id?modifier=… ») :
 *   · une étape à la fois, « Continuer » et le retour sans perte ; la touche
 *     Entrée va au champ suivant (sans rien signaler) et n'avance que depuis
 *     le dernier ; une Entrée dans la recherche du pays (portail) ne fait
 *     pas changer d'étape ;
 *   · les champs obligatoires par étape (prénom, nom, sexe ; numéro ; ville ;
 *     « ses plus gros problèmes ») ; email et date de naissance refusés
 *     quand ils sont mal formés ;
 *   · les numéros au format international (le principal et les autres, avec
 *     leur libellé ; un numéro chinois part en +86) ;
 *   · la charge envoyée à useCreateProspect (tous les nouveaux champs) ;
 *   · un refus du serveur ramène à l'étape (et à la ligne) concernées ;
 *   · le brouillon repris après une fermeture, À SON AUTEUR seulement,
 *     effacé à l'enregistrement ;
 *   · la modification d'une section n'envoie que ce qui a changé, garde ce
 *     qui est tapé, demande avant d'abandonner ; « Compléter » enchaîne les
 *     étapes où il manque quelque chose ; devenu client, les numéros sont
 *     figés (seuls les libellés changent).
 */
import { describe, it, expect, vi, beforeAll, beforeEach, afterAll } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const h = vi.hoisted(() => {
  const past = '2026-09-20T08:00:00Z';
  const base = {
    source_id: 's-jean', company: null, interests: [], notes: null, lost_reason: null, next_action_at: null,
    converted_user_id: null, converted_at: null, status_changed_at: past, created_at: past, updated_at: past,
    birth_date: null, email: null, help_needed: null, phones: [] as unknown[],
  };
  const prospects = [
    {
      ...base, id: 'p-full', first_name: 'Bruno', last_name: 'Ekané', city: 'Douala', gender: 'MALE', status: 'contacted',
      phone: '+237690000002', phone_e164: '+237690000002', email: 'bruno@gmail.com',
      pain_points: 'Manque de capital : trois mois de stock', interests: ['payments'],
      phones: [{ phone_e164: '+8613812345678', country_iso: 'CN', label: 'WeChat', position: 0 }],
    },
    {
      ...base, id: 'p-old', first_name: 'Awa', last_name: null, city: null, gender: null, status: 'new',
      phone: '+237690000001', phone_e164: '+237690000001', pain_points: null,
    },
    {
      ...base, id: 'p-won', first_name: 'Chantal', last_name: 'Ndi', city: 'Douala', gender: 'FEMALE', status: 'won',
      phone: '+237690000003', phone_e164: '+237690000003', pain_points: 'Payer ses fournisseurs en Chine',
      phones: [{ phone_e164: '+237655443322', country_iso: 'CM', label: 'Orange', position: 0 }],
    },
  ];
  return {
    prospects,
    list: { data: prospects, isLoading: false, isError: false, refetch: () => undefined },
    create: vi.fn(),
    update: vi.fn(),
    setStatus: vi.fn(),
    pending: false,
    auth: { currentUser: { id: 'u-jean', role: 'commercial' } as { id: string; role: string } | null },
  };
});

vi.mock('@/contexts/AdminAuthContext', () => ({ useAdminAuth: () => h.auth }));
vi.mock('@/hooks/useSales', () => ({
  useProspects: () => h.list,
  useCreateProspect: () => ({ mutate: h.create, isPending: h.pending }),
  useUpdateProspect: () => ({ mutate: h.update, isPending: h.pending }),
  useSetProspectStatus: () => ({ mutate: h.setStatus, isPending: false }),
}));

import { CommercialProspectForm } from '@/components/sales/CommercialProspectForm';

function Where() {
  const loc = useLocation();
  return <div data-testid="where">{loc.pathname}</div>;
}

function mount(route = '/v/prospects/new', path = '/v/prospects/new') {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[route]}>
        <Routes>
          <Route path={path} element={<CommercialProspectForm />} />
          <Route path="*" element={<Where />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

/** Le titre de l'étape (espaces insécables lues comme des espaces). */
const heading = () => (screen.getByRole('heading', { level: 1 }).textContent ?? '').replace(/\u00a0/g, ' ');
const cont = () => fireEvent.click(screen.getByRole('button', { name: /^Continuer|^Revenir au récapitulatif/ }));
const type = (label: RegExp | string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
const alerts = () => screen.queryAllByRole('alert').map((a) => a.textContent);

/** Étape 1 remplie : Paul Etoga, homme. */
function fillWho() {
  type(/^Prénom/, 'paul');
  type(/^Nom/, 'etoga');
  fireEvent.click(screen.getByRole('radio', { name: 'Homme' }));
}

beforeAll(() => {
  // Le sélecteur de pays (cmdk dans un popover Radix) mesure sa liste et la fait défiler : jsdom n'a ni l'un ni l'autre.
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  Element.prototype.scrollIntoView ??= () => undefined;
});
afterAll(() => vi.unstubAllGlobals());

const DRAFT_KEY = 'bonzini.v.prospect-draft:u-jean';

beforeEach(() => {
  localStorage.clear();
  h.create.mockReset();
  h.update.mockReset();
  h.setStatus.mockReset();
  h.pending = false;
  h.auth.currentUser = { id: 'u-jean', role: 'commercial' };
});

describe('Assistant — navigation', () => {
  it('une étape à la fois ; « Continuer » avance, le retour revient sans rien perdre', () => {
    mount();
    expect(heading()).toBe('Qui est-ce ?');
    expect(screen.getByRole('progressbar', { name: 'Étape 1 sur 7' })).toBeTruthy();
    fillWho();
    cont();
    expect(heading()).toBe('Comment joindre Paul ?');
    expect(screen.getByRole('progressbar', { name: 'Étape 2 sur 7' })).toBeTruthy();
    // Le changement d'étape est annoncé (titre compris) à un lecteur d'écran.
    expect(screen.getByText(/^Étape 2 sur 7 : Comment joindre Paul\s\?$/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Étape précédente' }));
    expect(heading()).toBe('Qui est-ce ?');
    expect((screen.getByLabelText(/^Prénom/) as HTMLInputElement).value).toBe('Paul');
    expect(screen.getByRole('radio', { name: 'Homme' }).getAttribute('aria-checked')).toBe('true');
  });

  it('la majuscule initiale se pose seule', () => {
    mount();
    type(/^Prénom/, 'jean-paul');
    expect((screen.getByLabelText(/^Prénom/) as HTMLInputElement).value).toBe('Jean-paul');
    fireEvent.blur(screen.getByLabelText(/^Prénom/));
    expect((screen.getByLabelText(/^Prénom/) as HTMLInputElement).value).toBe('Jean-Paul');
  });

  it('Entrée (« Suivant » du clavier) va au champ suivant sans rien mettre en rouge ; depuis le dernier, elle avance', () => {
    mount();
    type(/^Prénom/, 'jean-paul');
    fireEvent.keyDown(screen.getByLabelText(/^Prénom/), { key: 'Enter' });
    expect(document.activeElement).toBe(screen.getByLabelText(/^Nom/));
    expect(alerts()).toEqual([]);
    type(/^Nom/, 'etoga');
    // Le sexe pas encore choisi : Entrée mène à la première carte (le groupe radio).
    fireEvent.keyDown(screen.getByLabelText(/^Nom/), { key: 'Enter' });
    expect(document.activeElement).toBe(screen.getByRole('radio', { name: 'Homme' }));
    expect(heading()).toBe('Qui est-ce ?');
    fireEvent.click(screen.getByRole('radio', { name: 'Homme' }));
    // La date, dernier champ de l'étape : Entrée passe à l'étape suivante.
    fireEvent.keyDown(screen.getByLabelText(/Date de naissance/), { key: 'Enter' });
    expect(heading()).toBe('Comment joindre Jean-Paul ?');
  });

  it('Homme / Femme au clavier : un seul arrêt de tabulation, les flèches choisissent', () => {
    mount();
    const homme = screen.getByRole('radio', { name: 'Homme' });
    const femme = screen.getByRole('radio', { name: 'Femme' });
    expect([homme.tabIndex, femme.tabIndex]).toEqual([0, -1]);
    fireEvent.keyDown(homme, { key: 'ArrowRight' });
    expect(femme.getAttribute('aria-checked')).toBe('true');
    expect(document.activeElement).toBe(femme);
    expect([homme.tabIndex, femme.tabIndex]).toEqual([-1, 0]);
  });

  it('Entrée dans la recherche du pays (rendue hors du formulaire) choisit le pays, sans changer d’étape', () => {
    mount();
    fillWho();
    cont();
    type('Numéro principal', '699123456');
    fireEvent.click(screen.getByRole('button', { name: /Ajouter un numéro/ }));
    const row = screen.getByRole('group', { name: 'Libellé de Numéro 2' }).parentElement as HTMLElement;
    fireEvent.click(within(row).getByRole('button', { name: 'Indicatif' }));
    const search = screen.getByPlaceholderText(/Rechercher un pays/);
    fireEvent.change(search, { target: { value: 'Chine' } });
    fireEvent.keyDown(search, { key: 'Enter' });
    expect(heading()).toBe('Comment joindre Paul ?');
  });

  it('la croix ferme vers la liste', () => {
    mount();
    fireEvent.click(screen.getByRole('button', { name: 'Fermer' }));
    expect(screen.getByTestId('where').textContent).toBe('/v/prospects');
  });
});

describe('Assistant — ce que chaque étape exige', () => {
  it('« Qui est-ce ? » : prénom, nom et sexe ; rien ne passe sans eux (et le lecteur d’écran le sait)', () => {
    mount();
    expect(screen.getByLabelText(/^Prénom/).getAttribute('aria-required')).toBe('true');
    cont();
    expect(alerts()).toEqual(['Le prénom est requis', 'Le nom est requis', 'Choisissez Homme ou Femme']);
    expect(heading()).toBe('Qui est-ce ?');
    // Le message est relié au champ.
    const first = screen.getByLabelText(/^Prénom/);
    expect(document.getElementById(first.getAttribute('aria-describedby') as string)?.textContent).toBe('Le prénom est requis');
  });

  it('la date de naissance : facultative, mais refusée incomplète ou impossible ; l’âge s’affiche', () => {
    mount();
    fillWho();
    type(/Date de naissance/, '12031985');
    expect((screen.getByLabelText(/Date de naissance/) as HTMLInputElement).value).toBe('12/03/1985');
    expect(screen.getByText(/ans$/)).toBeTruthy();
    expect(screen.getByText('Né le 12 mars 1985')).toBeTruthy();
    type(/Date de naissance/, '3102199');
    // Incomplète : rien pendant la frappe…
    expect(alerts()).toEqual([]);
    fireEvent.blur(screen.getByLabelText(/Date de naissance/));
    cont();
    expect(alerts()).toEqual([expect.stringMatching(/Date incomplète/)]);
    // … impossible : dit tout de suite, comme côté client.
    type(/Date de naissance/, '31021990');
    expect(alerts()).toEqual(['Date de naissance invalide']);
    type(/Date de naissance/, '');
    cont();
    expect(heading()).toBe('Comment joindre Paul ?');
  });

  it('« Comment le joindre ? » : le numéro principal ; un email mal formé est refusé', () => {
    mount();
    fillWho();
    cont();
    cont();
    expect(alerts()).toEqual(['Le numéro est requis']);
    type('Numéro principal', '12');
    cont();
    expect(alerts()).toEqual(['Numéro invalide : vérifiez l’indicatif et les chiffres']);
    type('Numéro principal', '699123456');
    expect(screen.getByText('Sera enregistré : +237 6 99 12 34 56')).toBeTruthy();
    type(/^Email/, 'Paul.Etoga@');
    expect((screen.getByLabelText(/^Email/) as HTMLInputElement).value).toBe('paul.etoga@');
    cont();
    expect(alerts()).toEqual(['Adresse email invalide']);
    fireEvent.click(screen.getByRole('button', { name: 'Compléter : paul.etoga@gmail.com' }));
    cont();
    expect(heading()).toBe('Où est installée son activité ?');
  });

  it('la ville est exigée ; une pastille ou une saisie relue dans sa graphie', () => {
    mount();
    fillWho();
    cont();
    type('Numéro principal', '699123456');
    cont();
    cont();
    expect(alerts()).toEqual(['La ville est requise']);
    type(/Ville au Cameroun/, 'yaou');
    fireEvent.click(within(screen.getByRole('listbox', { name: 'Villes' })).getByRole('button', { name: 'Yaoundé' }));
    expect((screen.getByLabelText(/Ville au Cameroun/) as HTMLInputElement).value).toBe('Yaoundé');
    fireEvent.click(screen.getByRole('button', { name: 'Douala' }));
    expect(screen.getByRole('button', { name: 'Douala' }).getAttribute('aria-pressed')).toBe('true');
    cont();
    expect(heading()).toBe('Qu’est-ce qui bloque Paul aujourd’hui ?');
  });

  it('« ses plus gros problèmes » sont exigés ; une idée touchée s’ajoute au texte, retouchée nue s’en va', () => {
    mount();
    fillWho();
    cont();
    type('Numéro principal', '699123456');
    cont();
    fireEvent.click(screen.getByRole('button', { name: 'Douala' }));
    cont();
    cont();
    expect(alerts()).toEqual(['Dites en quelques mots ses plus gros problèmes']);
    const area = () => screen.getByLabelText(/Ses plus gros problèmes/) as HTMLTextAreaElement;
    fireEvent.click(screen.getByRole('button', { name: 'Manque de capital' }));
    expect(area().value).toBe('Manque de capital : ');
    expect(screen.getByRole('button', { name: 'Manque de capital' }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'Manque de capital' }));
    expect(area().value).toBe('');
    fireEvent.click(screen.getByRole('button', { name: 'La douane et sa procédure' }));
    fireEvent.change(area(), { target: { value: `${area().value}ne comprend pas ce qu’on lui facture` } });
    // Complétée, retouchée : rien ne s'efface, le curseur va au bout de sa ligne.
    fireEvent.click(screen.getByRole('button', { name: 'La douane et sa procédure' }));
    expect(area().value).toBe('La douane et sa procédure : ne comprend pas ce qu’on lui facture');
    expect(document.activeElement).toBe(area());
    expect(area().selectionStart).toBe(area().value.length);
    cont();
    expect(heading()).toBe('Que pouvons-nous faire pour Paul ?');
    // Tout y est facultatif.
    cont();
    expect(heading()).toBe('Et maintenant ?');
  });

  it('« WeChat » ou « Chine » sur une ligne encore vide : l’indicatif passe à +86', () => {
    mount();
    fillWho();
    cont();
    type('Numéro principal', '699123456');
    fireEvent.click(screen.getByRole('button', { name: /Ajouter un numéro/ }));
    const row = screen.getByRole('group', { name: 'Libellé de Numéro 2' }).parentElement as HTMLElement;
    fireEvent.click(within(row).getByRole('button', { name: 'WeChat' }));
    fireEvent.change(within(row).getByLabelText('WeChat'), { target: { value: '138 1234 5678' } });
    expect(within(row).getByRole('button', { name: 'Indicatif' }).textContent).toContain('+86');
  });
});

describe('Assistant — enregistrement', () => {
  /** Tout l'assistant rempli, jusqu'au récapitulatif. */
  function fillAll() {
    fillWho();
    type(/Date de naissance/, '12031985');
    cont();
    type('Numéro principal', '699 12 34 56');
    fireEvent.click(screen.getByRole('button', { name: /Ajouter un numéro/ }));
    const row = screen.getByRole('group', { name: 'Libellé de Numéro 2' }).parentElement as HTMLElement;
    fireEvent.click(within(row).getByRole('button', { name: 'Indicatif' }));
    fireEvent.change(screen.getByPlaceholderText(/Rechercher un pays/), { target: { value: 'Chine' } });
    fireEvent.click(screen.getByRole('option', { name: /Chine/ }));
    fireEvent.change(within(row).getByLabelText('Numéro 2'), { target: { value: '138 1234 5678' } });
    fireEvent.click(within(row).getByRole('button', { name: 'WeChat' }));
    type(/^Email/, 'paul.etoga@gmail.com');
    cont();
    fireEvent.click(screen.getByRole('button', { name: 'Douala' }));
    type(/^Entreprise/, 'etoga quincaillerie');
    cont();
    fireEvent.click(screen.getByRole('button', { name: 'Payer ses fournisseurs en Chine' }));
    const area = screen.getByLabelText(/Ses plus gros problèmes/) as HTMLTextAreaElement;
    fireEvent.change(area, { target: { value: `${area.value}deux semaines par règlement\nFixer ses prix de vente : ` } });
    cont();
    type(/Ses attentes/, 'Régler ses fournisseurs de Yiwu');
    fireEvent.click(screen.getByRole('button', { name: 'Fret bateau' }));
    cont();
    fireEvent.click(screen.getByRole('button', { name: 'Demain' }));
    type(/^Notes/, 'Quincaillerie à Akwa');
    cont();
  }

  it('le récapitulatif montre tout ; « Enregistrer » envoie tous les champs, numéros en E.164', () => {
    mount();
    fillAll();
    expect(heading()).toBe('Tout est juste ?');
    expect(screen.getByText('+237 6 99 12 34 56')).toBeTruthy();
    expect(screen.getByText('+86 138 1234 5678')).toBeTruthy();
    expect(screen.getByText('12 mars 1985 (41 ans)', { exact: false })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer le prospect' }));
    expect(h.create).toHaveBeenCalledTimes(1);
    const [input] = h.create.mock.calls[0];
    expect(input).toMatchObject({
      firstName: 'Paul',
      lastName: 'Etoga',
      gender: 'MALE',
      birthDate: '1985-03-12',
      phone: '+237699123456',
      phones: [{ phone_e164: '+8613812345678', country_iso: 'CN', label: 'WeChat' }],
      email: 'paul.etoga@gmail.com',
      company: 'Etoga quincaillerie',
      city: 'Douala',
      interests: ['sea'],
      painPoints: 'Payer ses fournisseurs en Chine : deux semaines par règlement\nFixer ses prix de vente',
      helpNeeded: 'Régler ses fournisseurs de Yiwu',
      notes: 'Quincaillerie à Akwa',
    });
    expect(input.nextActionAt).toMatch(/^\d{4}-\d{2}-\d{2}T09:00:00\+01:00$/);
  });

  it('« Modifier » depuis le récapitulatif rouvre la section, puis y revient', () => {
    mount();
    fillAll();
    fireEvent.click(screen.getByRole('button', { name: 'Modifier l’activité' }));
    expect(heading()).toBe('Où est installée son activité ?');
    fireEvent.click(screen.getByRole('button', { name: 'Yaoundé' }));
    fireEvent.click(screen.getByRole('button', { name: 'Revenir au récapitulatif' }));
    expect(heading()).toBe('Tout est juste ?');
    expect(screen.getByText('Yaoundé')).toBeTruthy();
  });

  it('un refus sur un AUTRE numéro : sous la ligne de ce numéro, pas sous le principal', () => {
    h.create.mockImplementation((_input, opts) => opts?.onError?.(new Error('Le numéro +8613812345678 est déjà suivi par un autre commercial')));
    mount();
    fillAll();
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer le prospect' }));
    expect(heading()).toBe('Comment joindre Paul ?');
    const row = screen.getByRole('group', { name: 'Libellé de WeChat' }).parentElement as HTMLElement;
    expect(within(row).getByRole('alert').textContent).toBe('Le numéro +8613812345678 est déjà suivi par un autre commercial');
    expect(screen.getByLabelText('Numéro principal').getAttribute('aria-invalid')).toBe('false');
  });

  it('un refus sans champ précis : en tête de l’étape', () => {
    h.create.mockImplementation((_input, opts) => opts?.onError?.(new Error('Dix numéros au plus (le principal et neuf autres)')));
    mount();
    fillAll();
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer le prospect' }));
    expect(heading()).toBe('Comment joindre Paul ?');
    expect(alerts()).toEqual(['Dix numéros au plus (le principal et neuf autres)']);
  });

  it('pendant l’envoi, ni la croix ni le retour : l’enregistrement va au bout', () => {
    h.pending = true;
    mount();
    expect((screen.getByRole('button', { name: 'Fermer' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('un refus du serveur (numéro d’un client) ramène à « Comment le joindre ? », le message sous le numéro', () => {
    h.create.mockImplementation((_input, opts) => opts?.onError?.(new Error('Ce numéro est déjà celui d’un client Bonzini')));
    mount();
    fillAll();
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer le prospect' }));
    expect(heading()).toBe('Comment joindre Paul ?');
    expect(alerts()).toContain('Ce numéro est déjà celui d’un client Bonzini');
    // Corrigé, le message s'en va.
    type('Numéro principal', '677123456');
    expect(alerts()).not.toContain('Ce numéro est déjà celui d’un client Bonzini');
  });

  it('enregistré : le brouillon s’efface et la fiche s’ouvre', () => {
    h.create.mockImplementation((_input, opts) => opts?.onSuccess?.({ id: 'p-new' }));
    mount('/v/prospects/new', '/v/prospects/new');
    fillAll();
    expect(localStorage.getItem(DRAFT_KEY)).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer le prospect' }));
    expect(screen.getByTestId('where').textContent).toBe('/v/prospects/p-new');
    expect(localStorage.getItem(DRAFT_KEY)).toBeNull();
  });
});

describe('Assistant — brouillon', () => {
  it('fermé en pleine saisie : repris à l’étape où il en était ; « Recommencer » repart de zéro', () => {
    const first = mount();
    fillWho();
    cont();
    type('Numéro principal', '699123456');
    first.unmount();

    mount();
    expect(screen.getByText('Brouillon repris')).toBeTruthy();
    expect(heading()).toBe('Comment joindre Paul ?');
    expect((screen.getByLabelText('Numéro principal') as HTMLInputElement).value).toBe('6 99 12 34 56');
    fireEvent.click(screen.getByRole('button', { name: 'Étape précédente' }));
    expect((screen.getByLabelText(/^Prénom/) as HTMLInputElement).value).toBe('Paul');
    fireEvent.click(screen.getByRole('button', { name: /^Continuer/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Étape précédente' }));
    // (le bandeau ne revient pas après la première navigation)
    expect(screen.queryByText('Brouillon repris')).toBeNull();
  });

  it('« Recommencer » efface le brouillon', () => {
    const first = mount();
    fillWho();
    first.unmount();
    mount();
    fireEvent.click(screen.getByRole('button', { name: /Recommencer/ }));
    expect((screen.getByLabelText(/^Prénom/) as HTMLInputElement).value).toBe('');
    expect(localStorage.getItem(DRAFT_KEY)).toBeNull();
  });

  it('jamais au-delà de la première étape encore à remplir', () => {
    localStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({ v: 1, owner: 'u-jean', step: 'needs', savedAt: '', draft: { firstName: 'Awa', lastName: 'Bello', gender: 'FEMALE', phone: { country: 'CM', national: '' } } }),
    );
    mount();
    expect(heading()).toBe('Comment joindre Awa ?');
  });

  it('le brouillon d’un collègue, sur le même téléphone, ne se voit ni ne se reprend', () => {
    const first = mount();
    fillWho();
    cont();
    first.unmount();
    // Un autre commercial se connecte sur le même appareil.
    h.auth.currentUser = { id: 'u-awa', role: 'commercial' };
    mount();
    expect(screen.queryByText('Brouillon repris')).toBeNull();
    expect(heading()).toBe('Qui est-ce ?');
    expect((screen.getByLabelText(/^Prénom/) as HTMLInputElement).value).toBe('');
  });
});

describe('Modification d’une section de la fiche', () => {
  it('n’envoie que ce qui a changé, puis revient à la fiche ; rien de changé, « Enregistrer » attend', () => {
    mount('/v/prospects/p-full?modifier=aide', '/v/prospects/:id');
    expect(screen.getByText('Modifier · Comment l’aider')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Enregistrer' }) as HTMLButtonElement).disabled).toBe(true);
    type(/Ses attentes/, 'Un devis de fret bateau');
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
    expect(h.update).toHaveBeenCalledTimes(1);
    expect(h.update.mock.calls[0][0]).toEqual({ id: 'p-full', helpNeeded: 'Un devis de fret bateau' });
  });

  it('rien de changé : la croix ferme sans rien demander ni envoyer', () => {
    mount('/v/prospects/p-full?modifier=identite', '/v/prospects/:id');
    fireEvent.click(screen.getByRole('button', { name: 'Fermer' }));
    expect(screen.queryByText('Abandonner vos modifications ?')).toBeNull();
    expect(h.update).not.toHaveBeenCalled();
  });

  it('des changements : la croix demande avant de les abandonner', () => {
    mount('/v/prospects/p-full?modifier=besoins', '/v/prospects/:id');
    type(/Ses plus gros problèmes/, 'Manque de capital : trois mois de stock, et la banque refuse');
    // La croix de l'assistant (la feuille a aussi les siennes : son fond et sa croix).
    const cross = () => screen.getAllByRole('button', { name: 'Fermer' })[0];
    fireEvent.click(cross());
    expect(screen.getByText('Abandonner vos modifications ?')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Continuer la saisie' }));
    expect((screen.getByLabelText(/Ses plus gros problèmes/) as HTMLTextAreaElement).value).toMatch(/la banque refuse/);
    fireEvent.click(cross());
    fireEvent.click(screen.getByRole('button', { name: 'Abandonner' }));
    expect(localStorage.getItem('bonzini.v.prospect-edit:u-jean:p-full:besoins')).toBeNull();
    expect(h.update).not.toHaveBeenCalled();
  });

  it('quittée sans passer par la croix (retour du téléphone) : ce qui était tapé est repris à la réouverture', () => {
    const first = mount('/v/prospects/p-full?modifier=besoins', '/v/prospects/:id');
    type(/Ses plus gros problèmes/, 'Noté après l’appel : la douane de Douala le bloque');
    first.unmount();
    mount('/v/prospects/p-full?modifier=besoins', '/v/prospects/:id');
    expect(screen.getByText('Modification reprise')).toBeTruthy();
    expect((screen.getByLabelText(/Ses plus gros problèmes/) as HTMLTextAreaElement).value).toBe('Noté après l’appel : la douane de Douala le bloque');
    fireEvent.click(screen.getByRole('button', { name: /Annuler mes changements/ }));
    expect((screen.getByLabelText(/Ses plus gros problèmes/) as HTMLTextAreaElement).value).toBe('Manque de capital : trois mois de stock');
  });

  it('les numéros : un numéro de plus part avec la liste entière ; le principal inchangé ne part pas', () => {
    mount('/v/prospects/p-full?modifier=joindre', '/v/prospects/:id');
    expect((screen.getByLabelText('Numéro principal') as HTMLInputElement).value).toBe('6 90 00 00 02');
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter un autre numéro' }));
    const row = screen.getByRole('group', { name: 'Libellé de Numéro 3' }).parentElement as HTMLElement;
    fireEvent.change(within(row).getByLabelText('Numéro 3'), { target: { value: '655 00 11 22' } });
    fireEvent.click(within(row).getByRole('button', { name: 'WhatsApp' }));
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
    expect(h.update.mock.calls[0][0]).toEqual({
      id: 'p-full',
      phones: [
        { phone_e164: '+8613812345678', country_iso: 'CN', label: 'WeChat' },
        { phone_e164: '+237655001122', country_iso: 'CM', label: 'WhatsApp' },
      ],
    });
  });

  it('devenu client : numéros figés, rien à ajouter ; un libellé changé part seul, sans le principal', () => {
    mount('/v/prospects/p-won?modifier=joindre', '/v/prospects/:id');
    expect((screen.getByLabelText('Numéro principal') as HTMLInputElement).disabled).toBe(true);
    expect(screen.queryByRole('button', { name: /Ajouter/ })).toBeNull();
    const row = screen.getByRole('group', { name: 'Libellé de Orange' }).parentElement as HTMLElement;
    expect((within(row).getByLabelText('Orange') as HTMLInputElement).disabled).toBe(true);
    fireEvent.click(within(row).getByRole('button', { name: 'WhatsApp' }));
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
    expect(h.update.mock.calls[0][0]).toEqual({ id: 'p-won', phones: [{ phone_e164: '+237655443322', country_iso: 'CM', label: 'WhatsApp' }] });
  });

  it('fiche incomplète, « Modifier » une section : elle seule, rien d’autre n’est exigé', () => {
    mount('/v/prospects/p-old?modifier=suite', '/v/prospects/:id');
    expect(screen.queryByRole('progressbar')).toBeNull();
    type(/^Notes/, 'Rappeler jeudi');
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
    expect(h.update.mock.calls[0][0]).toEqual({ id: 'p-old', notes: 'Rappeler jeudi' });
  });

  it('« Compléter » : le nom, le sexe, la ville et ses problèmes, étape par étape, avant d’enregistrer', () => {
    mount('/v/prospects/p-old?completer', '/v/prospects/:id');
    expect(screen.getByText('Compléter la fiche')).toBeTruthy();
    expect(screen.getByText(/Il manque le nom, le sexe, la ville et ses plus gros problèmes/)).toBeTruthy();
    expect(screen.getByRole('progressbar', { name: 'Étape 1 sur 3' })).toBeTruthy();
    expect(heading()).toBe('Qui est-ce ?');
    cont();
    expect(alerts()).toEqual(['Le nom est requis', 'Choisissez Homme ou Femme']);
    type(/^Nom/, 'bello');
    fireEvent.click(screen.getByRole('radio', { name: 'Femme' }));
    cont();
    expect(heading()).toBe('Où est installée son activité ?');
    fireEvent.click(screen.getByRole('button', { name: 'Garoua' }));
    cont();
    expect(heading()).toBe('Qu’est-ce qui bloque Awa aujourd’hui ?');
    type(/Ses plus gros problèmes/, 'Trouver les bons fournisseurs');
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
    });
    expect(h.update.mock.calls[0][0]).toEqual({ id: 'p-old', lastName: 'Bello', gender: 'FEMALE', city: 'Garoua', painPoints: 'Trouver les bons fournisseurs' });
  });
});
