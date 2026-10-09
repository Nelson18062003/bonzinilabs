/**
 * « Nouveau client » : l'origine se pré-remplit quand le numéro est celui
 * d'un prospect d'un commercial.
 *
 * Le contrat (useCreateClientForm, partagé par la création desktop, mobile
 * et réception) :
 *   · numéro d'un prospect ouvert, fiche active, aucun choix manuel → la
 *     source est pré-choisie (après 400 ms sans frappe) ;
 *   · l'opérateur avait déjà choisi une autre source → elle ne bouge pas,
 *     le prospect est seulement signalé (note ambrée) ;
 *   · le numéro change pour un numéro sans prospect → la source posée
 *     d'office se retire.
 *
 * Et depuis le 06/10, la fiche du prospect remplit les champs ENCORE VIDES
 * (nom, entreprise, ville, sexe, date de naissance, autres numéros), une
 * seule fois par prospect, sans jamais écraser ce qui est tapé ; son EMAIL
 * n'est que proposé (il deviendrait l'adresse de connexion, déjà
 * confirmée) ; si le numéro change ensuite, la note devient un
 * avertissement ; le sexe est obligatoire au bureau, facultatif à la
 * réception ; la date de naissance, facultative, se pose après la création.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, render, renderHook, screen } from '@testing-library/react';

const createClient = vi.fn(async (_data: Record<string, unknown>) => ({ success: true, clientId: 'u-new', tempPassword: 'pw123456', authEmail: 'x@y' }));
const setIdentity = vi.fn(async (_v: { userId: string; gender?: string; birthDate?: string | null }) => ({ success: true }));
const setSource = vi.fn(async () => ({ success: true }));
const setReceptionOrigin = vi.fn(async () => ({ success: true, kept: false, source_id: 's-gz', label: 'Bureau de Guangzhou (avion)', kind: 'parcel' }));
vi.mock('@/hooks/useClientManagement', () => ({
  useCreateClient: () => ({ mutateAsync: createClient, isPending: false }),
  useSetClientIdentity: () => ({ mutateAsync: setIdentity, isPending: false }),
}));
vi.mock('@/hooks/useClientPhones', () => ({
  useSetClientPhones: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock('@/hooks/useClientSources', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/hooks/useClientSources')>()),
  useSetClientSource: () => ({ mutateAsync: setSource, isPending: false }),
  useSetReceptionOrigin: () => ({ mutateAsync: setReceptionOrigin, isPending: false }),
}));

// Paul Etoga : une réponse SANS détails (base pas encore migrée).
// Aline Ngo : la fiche complète, trouvée par son principal OU par son autre numéro.
const ALINE = {
  found: true, prospect_id: 'p2', prospect_name: 'Aline Ngo', source_id: 's-jean', source_label: 'Jean Mbarga', source_active: true,
  first_name: 'Aline', last_name: 'Ngo', company: 'Ngo Cosmétiques', city: 'Douala', email: 'Aline@Ngo-Cosmetiques.cm',
  gender: 'FEMALE', birth_date: '1988-04-21', phone_e164: '+237677112233',
  phones: [{ phone_e164: '+237655443322', country_iso: 'CM', label: 'Orange' }],
};
vi.mock('@/hooks/useSales', () => ({
  useProspectLookup: (phone: string | null) =>
    !phone
      ? { data: undefined, isSuccess: false, isError: false }
      : phone === '+237699123456'
        ? { data: { found: true, prospect_id: 'p1', prospect_name: 'Paul Etoga', source_id: 's-jean', source_label: 'Jean Mbarga', source_active: true }, isSuccess: true, isError: false }
        : phone === '+237677112233' || phone === '+237655443322'
          ? { data: ALINE, isSuccess: true, isError: false }
          : { data: { found: false }, isSuccess: true, isError: false },
}));

import { useCreateClientForm } from '@/components/clients/useCreateClientForm';
import { ProspectEmailSuggestion, ProspectPrefillNote, ProspectSourceNote } from '@/components/clients/ProspectSourceNote';
import type { PrefillKey } from '@/components/clients/prospectPrefill';
import { toE164 } from '@/components/form/PhoneNumberInput';
import { AdminAuthContext } from '@/contexts/AdminAuthContext';

function typePhone(result: { current: ReturnType<typeof useCreateClientForm> }, national: string) {
  act(() => result.current.setPhone(result.current.phones[0].key, { value: { country: 'CM', national } }));
  act(() => {
    vi.advanceTimersByTime(400);
  });
}

describe('Nouveau client — origine pré-remplie par un prospect', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('le numéro d’un prospect pré-choisit la fiche de son commercial', () => {
    const { result } = renderHook(() => useCreateClientForm());
    expect(result.current.sourceId).toBeNull();
    typePhone(result, '699 12 34 56');
    expect(result.current.prospect).toEqual({ sourceId: 's-jean', sourceLabel: 'Jean Mbarga', prospectName: 'Paul Etoga' });
    expect(result.current.sourceId).toBe('s-jean');
    expect(result.current.errors.source).toBeUndefined();
  });

  it('attend la fin de la frappe (400 ms) avant de chercher', () => {
    const { result } = renderHook(() => useCreateClientForm());
    act(() => result.current.setPhone(result.current.phones[0].key, { value: { country: 'CM', national: '699 12 34 56' } }));
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(result.current.sourceId).toBeNull();
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(result.current.sourceId).toBe('s-jean');
  });

  it('un choix manuel n’est jamais écrasé : le prospect est seulement signalé', () => {
    const { result } = renderHook(() => useCreateClientForm());
    act(() => result.current.setSourceId('s-fb'));
    typePhone(result, '699 12 34 56');
    expect(result.current.sourceId).toBe('s-fb');
    expect(result.current.prospect?.sourceLabel).toBe('Jean Mbarga');
  });

  it('le numéro change pour un autre : la source posée d’office se retire', () => {
    const { result } = renderHook(() => useCreateClientForm());
    typePhone(result, '699 12 34 56');
    expect(result.current.sourceId).toBe('s-jean');
    typePhone(result, '677 00 00 00');
    expect(result.current.prospect).toBeNull();
    expect(result.current.sourceId).toBeNull();
  });

  it('un numéro incomplet ne déclenche rien', () => {
    const { result } = renderHook(() => useCreateClientForm());
    typePhone(result, '699 12');
    expect(result.current.prospect).toBeNull();
    expect(result.current.sourceId).toBeNull();
  });
});

describe('ProspectSourceNote', () => {
  const prospect = { sourceId: 's-jean', sourceLabel: 'Jean Mbarga', prospectName: 'Paul Etoga' };

  it('origine = la fiche du commercial : le client lui sera attribué', () => {
    render(<ProspectSourceNote prospect={prospect} sourceId="s-jean" />);
    expect(screen.getByRole('status').textContent).toBe('Ce numéro est un prospect de Jean Mbarga : le client lui sera attribué.');
  });

  it('une autre origine choisie, sans droit de modifier les clients : prévenu que le commercial garde le client', () => {
    // Le serveur attribue le compte au commercial du prospect dès sa création ;
    // set_client_source refuse ensuite de le changer sans canEditClients.
    render(<ProspectSourceNote prospect={prospect} sourceId="s-fb" />);
    expect(screen.getByRole('status').textContent).toBe(
      'Ce numéro est un prospect de Jean Mbarga : le client lui sera attribué quand même. Seul un responsable peut changer son origine ensuite.',
    );
  });

  it('une autre origine choisie par un rôle qui modifie les clients : son choix remplace le commercial', () => {
    const auth = { hasPermission: (k: string) => k === 'canEditClients' } as unknown as React.ContextType<typeof AdminAuthContext>;
    render(
      <AdminAuthContext.Provider value={auth}>
        <ProspectSourceNote prospect={prospect} sourceId="s-fb" />
      </AdminAuthContext.Provider>,
    );
    expect(screen.getByRole('status').textContent).toBe('Ce numéro est un prospect de Jean Mbarga : votre choix remplacera son commercial.');
  });

  it('pas de prospect : rien', () => {
    const { container } = render(<ProspectSourceNote prospect={null} sourceId="s-fb" />);
    expect(container.textContent).toBe('');
  });
});

describe('Nouveau client — origine facultative, posée d’office à la réception (06/10)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    createClient.mockClear();
    setSource.mockClear();
    setReceptionOrigin.mockClear();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  function fill(result: { current: ReturnType<typeof useCreateClientForm> }) {
    act(() => result.current.setField('firstName', 'Awa'));
    act(() => result.current.setField('lastName', 'Ndiaye'));
    // Au bureau, le sexe est obligatoire ; à la réception, il ne gêne pas.
    act(() => result.current.setGender('FEMALE'));
    typePhone(result, '677 00 00 00');
  }

  it('sans origine choisie, le client se crée quand même (elle reste « Non renseignée »)', async () => {
    const { result } = renderHook(() => useCreateClientForm());
    fill(result);
    expect(result.current.errors).toEqual({});
    expect(result.current.canSubmit).toBe(true);
    await act(async () => { await result.current.submit(); });
    expect(createClient).toHaveBeenCalledTimes(1);
    expect(setSource).not.toHaveBeenCalled();
    expect(setReceptionOrigin).not.toHaveBeenCalled();
    expect(result.current.created?.sourceFailed).toBe(false);
  });

  it('origine choisie au bureau : elle est posée après la création', async () => {
    const { result } = renderHook(() => useCreateClientForm());
    fill(result);
    act(() => result.current.setSourceId('s-fb'));
    await act(async () => { await result.current.submit(); });
    expect(setSource).toHaveBeenCalledWith({ userId: 'u-new', sourceId: 's-fb', silent: true });
  });

  it('réception (bureau de Guangzhou) : l’origine ne se choisit pas, elle suit le lieu', async () => {
    const { result } = renderHook(() => useCreateClientForm({ reception: { location: 'office' } }));
    expect(result.current.originMode).toBe('reception');
    fill(result);
    await act(async () => { await result.current.submit(); });
    expect(setReceptionOrigin).toHaveBeenCalledWith({ userId: 'u-new', location: 'office' });
    expect(setSource).not.toHaveBeenCalled();
    expect(result.current.created?.originLabel).toBe('Colis reçu · Bureau de Guangzhou (avion)');
  });

  it('réception sans lieu choisi : aucune origine posée, rien ne casse', async () => {
    const { result } = renderHook(() => useCreateClientForm({ reception: { location: null } }));
    fill(result);
    await act(async () => { await result.current.submit(); });
    expect(setReceptionOrigin).not.toHaveBeenCalled();
    expect(result.current.created?.originLabel).toBeNull();
  });
});

const e164s = (form: ReturnType<typeof useCreateClientForm>) => form.phones.map((r) => toE164(r.value));

describe('Nouveau client — la fiche du prospect reprise d’office (06/10)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('remplit tous les champs vides : nom, entreprise, ville, sexe, naissance, autres numéros', () => {
    const { result } = renderHook(() => useCreateClientForm());
    typePhone(result, '677 11 22 33');
    expect(result.current.fields).toMatchObject({
      firstName: 'Aline', lastName: 'Ngo', company: 'Ngo Cosmétiques', city: 'Douala', birthDate: '21/04/1988',
    });
    expect(result.current.gender).toBe('FEMALE');
    expect(e164s(result.current)).toEqual(['+237677112233', '+237655443322']);
    expect(result.current.phones[1].label).toBe('Orange');
    expect(result.current.prefill).toEqual({
      prospectId: 'p2', sourceLabel: 'Jean Mbarga', prospectName: 'Aline Ngo',
      filled: ['firstName', 'lastName', 'company', 'city', 'gender', 'birthDate', 'phones'],
      suggestedEmail: 'aline@ngo-cosmetiques.cm',
    });
    expect(result.current.prefillStale).toBe(false);
    // L'origine se pré-choisit toujours, comme avant.
    expect(result.current.sourceId).toBe('s-jean');
  });

  it('l’email n’est jamais repris d’office (adresse de connexion) : seulement proposé, pris d’un geste', () => {
    const { result } = renderHook(() => useCreateClientForm());
    typePhone(result, '677 11 22 33');
    expect(result.current.fields.email).toBe('');
    expect(result.current.emailSuggestion).toBe('aline@ngo-cosmetiques.cm');
    act(() => result.current.acceptEmailSuggestion());
    expect(result.current.fields.email).toBe('aline@ngo-cosmetiques.cm');
    expect(result.current.emailSuggestion).toBeNull();
  });

  it('un email déjà tapé : rien n’est proposé', () => {
    const { result } = renderHook(() => useCreateClientForm());
    act(() => result.current.setField('email', 'aline@gmail.com'));
    typePhone(result, '677 11 22 33');
    expect(result.current.fields.email).toBe('aline@gmail.com');
    expect(result.current.emailSuggestion).toBeNull();
  });

  it('le numéro change ensuite pour celui d’un autre : les valeurs restent, la note devient un avertissement, l’email n’est plus proposé', () => {
    const { result } = renderHook(() => useCreateClientForm());
    typePhone(result, '677 11 22 33');
    typePhone(result, '677 00 00 00');
    expect(result.current.prefillStale).toBe(true);
    expect(result.current.fields.lastName).toBe('Ngo');
    expect(result.current.emailSuggestion).toBeNull();
    // Un numéro commencé (en cours de correction) ne change rien.
    act(() => result.current.setPhone(result.current.phones[0].key, { value: { country: 'CM', national: '677 11' } }));
    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(result.current.prefillStale).toBe(false);
    // De retour sur son numéro : la note redevient normale.
    typePhone(result, '677 11 22 33');
    expect(result.current.prefillStale).toBe(false);
  });

  it('n’écrase jamais une valeur tapée ni un choix fait', () => {
    const { result } = renderHook(() => useCreateClientForm());
    act(() => result.current.setField('firstName', 'Alice'));
    act(() => result.current.setField('city', 'Yaoundé'));
    act(() => result.current.setField('birthDate', '01/01/1990'));
    act(() => result.current.setGender('MALE'));
    typePhone(result, '677 11 22 33');
    expect(result.current.fields).toMatchObject({ firstName: 'Alice', city: 'Yaoundé', birthDate: '01/01/1990', lastName: 'Ngo', company: 'Ngo Cosmétiques' });
    expect(result.current.gender).toBe('MALE');
    expect(result.current.prefill?.filled).toEqual(['lastName', 'company', 'phones']);
  });

  it('une seule reprise par prospect : un champ vidé ensuite reste vide', () => {
    const { result } = renderHook(() => useCreateClientForm());
    typePhone(result, '677 11 22 33');
    expect(result.current.fields.company).toBe('Ngo Cosmétiques');
    act(() => result.current.setField('company', ''));
    // Un autre numéro, puis le sien à nouveau : rien n'est re-rempli.
    typePhone(result, '677 00 00 00');
    typePhone(result, '677 11 22 33');
    expect(result.current.fields.company).toBe('');
    expect(e164s(result.current).filter((e) => e === '+237655443322')).toHaveLength(1);
  });

  it('le numéro tapé est l’un de ses AUTRES numéros : son principal devient un numéro de plus, sans doublon', () => {
    const { result } = renderHook(() => useCreateClientForm());
    typePhone(result, '655 44 33 22');
    expect(e164s(result.current)).toEqual(['+237655443322', '+237677112233']);
    expect(result.current.prefill?.filled).toContain('phones');
  });

  it('les numéros vont d’abord dans une ligne laissée vide, et jamais en double', () => {
    const { result } = renderHook(() => useCreateClientForm());
    act(() => result.current.addPhone());
    act(() => result.current.addPhone());
    // La 2e ligne porte déjà son numéro Orange ; la 3e est vide.
    act(() => result.current.setPhone(result.current.phones[1].key, { value: { country: 'CM', national: '655 44 33 22' } }));
    typePhone(result, '677 11 22 33');
    expect(e164s(result.current)).toEqual(['+237677112233', '+237655443322', null]);
    // Rien à ajouter : la note ne parle pas des numéros.
    expect(result.current.prefill?.filled).not.toContain('phones');
  });

  it('base pas encore migrée (recherche sans détails) : rien n’est repris, rien ne casse', () => {
    const { result } = renderHook(() => useCreateClientForm());
    typePhone(result, '699 12 34 56');
    expect(result.current.prospect?.sourceLabel).toBe('Jean Mbarga');
    expect(result.current.prefill).toBeNull();
    expect(result.current.fields).toMatchObject({ firstName: '', lastName: '', company: '', city: '', email: '', birthDate: '' });
    expect(result.current.gender).toBeNull();
    expect(result.current.phones).toHaveLength(1);
  });
});

describe('ProspectPrefillNote', () => {
  const prefill = { prospectId: 'p2', sourceLabel: 'Jean Mbarga', prospectName: 'Aline Ngo', filled: ['lastName', 'company', 'city', 'gender'] as PrefillKey[], suggestedEmail: null };

  it('dit d’où viennent les valeurs — le prospect, puis son commercial — et seulement ce qui a été repris', () => {
    render(<ProspectPrefillNote prefill={prefill} />);
    expect(screen.getByRole('note').textContent).toBe('Repris de la fiche de Aline Ngo (prospect de Jean Mbarga) : nom, entreprise, ville et sexe.');
  });

  it('sans nom de prospect : « sa fiche prospect »', () => {
    render(<ProspectPrefillNote prefill={{ ...prefill, prospectName: '', sourceLabel: '' }} />);
    expect(screen.getByRole('note').textContent).toBe('Repris de sa fiche prospect : nom, entreprise, ville et sexe.');
  });

  it('le numéro a changé : un avertissement, à vérifier', () => {
    render(<ProspectPrefillNote prefill={prefill} stale />);
    expect(screen.getByRole('note').textContent).toBe('Le numéro principal n’est plus celui de Aline Ngo : vérifiez ce qui a été repris de sa fiche (nom, entreprise, ville et sexe).');
  });

  it('rien de repris : pas de note', () => {
    const { container } = render(<ProspectPrefillNote prefill={null} />);
    expect(container.textContent).toBe('');
  });
});

describe('ProspectEmailSuggestion', () => {
  it('propose l’adresse, prévient qu’elle sert à la connexion, et ne la pose qu’au toucher', () => {
    const onUse = vi.fn();
    render(<ProspectEmailSuggestion email="aline@ngo-cosmetiques.cm" onUse={onUse} />);
    expect(screen.getByRole('note').textContent).toContain('aline@ngo-cosmetiques.cm');
    expect(screen.getByRole('note').textContent).toContain('adresse de connexion');
    expect(onUse).not.toHaveBeenCalled();
    act(() => screen.getByRole('button', { name: 'Confirmé : l’utiliser' }).click());
    expect(onUse).toHaveBeenCalledTimes(1);
  });

  it('rien à proposer : rien', () => {
    const { container } = render(<ProspectEmailSuggestion email={null} onUse={() => undefined} />);
    expect(container.textContent).toBe('');
  });
});

describe('Nouveau client — sexe et date de naissance (06/10)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    createClient.mockClear();
    setIdentity.mockReset();
    setIdentity.mockImplementation(async () => ({ success: true }));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  function fillName(result: { current: ReturnType<typeof useCreateClientForm> }) {
    act(() => result.current.setField('firstName', 'Awa'));
    act(() => result.current.setField('lastName', 'Ndiaye'));
    typePhone(result, '677 00 00 00');
  }

  it('au bureau, le sexe est obligatoire et part avec la création', async () => {
    const { result } = renderHook(() => useCreateClientForm());
    fillName(result);
    expect(result.current.genderRequired).toBe(true);
    expect(result.current.errors.gender).toBe(true);
    expect(result.current.canSubmit).toBe(false);
    act(() => result.current.setGender('MALE'));
    expect(result.current.canSubmit).toBe(true);
    await act(async () => { await result.current.submit(); });
    expect(createClient).toHaveBeenCalledWith(expect.objectContaining({ gender: 'MALE' }));
  });

  it('à la réception, le sexe est facultatif : sans choix, « non renseigné » (OTHER)', async () => {
    const { result } = renderHook(() => useCreateClientForm({ reception: { location: 'office' } }));
    fillName(result);
    expect(result.current.genderRequired).toBe(false);
    expect(result.current.errors.gender).toBeUndefined();
    expect(result.current.canSubmit).toBe(true);
    await act(async () => { await result.current.submit(); });
    expect(createClient).toHaveBeenCalledWith(expect.objectContaining({ gender: 'OTHER' }));
  });

  it.each([
    ['31/02/1990', 'un jour qui n’existe pas'],
    ['12/03/2020', 'moins de 16 ans'],
    ['12/03/1900', 'plus de 110 ans'],
    ['12/03', 'incomplète'],
  ])('une date de naissance refusée bloque l’envoi : %s (%s)', (text) => {
    const { result } = renderHook(() => useCreateClientForm());
    fillName(result);
    act(() => result.current.setGender('FEMALE'));
    act(() => result.current.setField('birthDate', text));
    expect(result.current.errors.birthDate).toBe(true);
    expect(result.current.canSubmit).toBe(false);
    act(() => result.current.setField('birthDate', ''));
    expect(result.current.errors.birthDate).toBeUndefined();
    expect(result.current.canSubmit).toBe(true);
  });

  it('sans date : la fiche identité n’est pas appelée', async () => {
    const { result } = renderHook(() => useCreateClientForm());
    fillName(result);
    act(() => result.current.setGender('FEMALE'));
    await act(async () => { await result.current.submit(); });
    expect(setIdentity).not.toHaveBeenCalled();
    expect(result.current.created?.identityFailed).toBe(false);
  });

  it('avec une date : elle se pose APRÈS la création, au format de la base', async () => {
    const { result } = renderHook(() => useCreateClientForm());
    fillName(result);
    act(() => result.current.setGender('FEMALE'));
    act(() => result.current.setField('birthDate', '12/03/1985'));
    await act(async () => { await result.current.submit(); });
    expect(setIdentity).toHaveBeenCalledWith({ userId: 'u-new', birthDate: '1985-03-12' });
    expect(createClient.mock.invocationCallOrder[0]).toBeLessThan(setIdentity.mock.invocationCallOrder[0]);
  });

  it('la date refusée par le serveur ne défait pas le client : identityFailed', async () => {
    setIdentity.mockImplementation(async () => { throw new Error('Accès non autorisé'); });
    const { result } = renderHook(() => useCreateClientForm({ reception: { location: 'warehouse' } }));
    fillName(result);
    act(() => result.current.setField('birthDate', '12/03/1985'));
    await act(async () => { await result.current.submit(); });
    expect(result.current.created).toMatchObject({ clientId: 'u-new', identityFailed: true, sourceFailed: false });
  });
});
