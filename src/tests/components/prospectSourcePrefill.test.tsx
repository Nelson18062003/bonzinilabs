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
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, render, renderHook, screen } from '@testing-library/react';

vi.mock('@/hooks/useClientManagement', () => ({
  useCreateClient: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock('@/hooks/useClientPhones', () => ({
  useSetClientPhones: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock('@/hooks/useClientSources', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/hooks/useClientSources')>()),
  useSetClientSource: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock('@/hooks/useSales', () => ({
  useProspectLookup: (phone: string | null) =>
    !phone
      ? { data: undefined, isSuccess: false, isError: false }
      : phone === '+237699123456'
        ? { data: { found: true, prospect_id: 'p1', prospect_name: 'Paul Etoga', source_id: 's-jean', source_label: 'Jean Mbarga', source_active: true }, isSuccess: true, isError: false }
        : { data: { found: false }, isSuccess: true, isError: false },
}));

import { useCreateClientForm } from '@/components/clients/useCreateClientForm';
import { ProspectSourceNote } from '@/components/clients/ProspectSourceNote';
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
