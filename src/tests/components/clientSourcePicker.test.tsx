/**
 * L'origine d'un client — le sélecteur partagé par la création de client
 * (admin desktop, admin mobile, réception) et la fiche client.
 *
 * Le contrat :
 *   · les sources sont rangées par catégorie, et « Je ne sais pas » est
 *     toujours proposée ;
 *   · choisir une source la renvoie ;
 *   · on peut ajouter une source (un nouveau commercial) sans quitter le
 *     formulaire, et elle est aussitôt choisie.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const createMutate = vi.fn();

vi.mock('@/hooks/useClientSources', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/hooks/useClientSources')>();
  return {
    ...real,
    useClientSources: () => ({
      data: [
        { id: 's-unknown', kind: 'unknown', label: 'Je ne sais pas', phone: null, is_active: true, is_system: true },
        { id: 's-jean', kind: 'commercial', label: 'Jean Mbarga', phone: '+237 677 00 00 00', is_active: true, is_system: false },
        { id: 's-fb', kind: 'social', label: 'Facebook', phone: null, is_active: true, is_system: false },
      ],
      isLoading: false,
      isError: false,
    }),
    useCreateClientSource: () => ({ mutate: createMutate, isPending: false }),
  };
});

import { ClientSourcePicker } from '@/components/clients/ClientSourcePicker';

describe('ClientSourcePicker', () => {
  beforeEach(() => {
    createMutate.mockReset();
  });

  it('range les sources par catégorie et propose toujours « Je ne sais pas »', () => {
    render(<ClientSourcePicker value={null} onChange={() => undefined} />);
    fireEvent.click(screen.getByRole('button', { name: /Choisir l’origine/ }));
    expect(screen.getByText('Commercial')).toBeTruthy();
    expect(screen.getByText('Réseaux sociaux')).toBeTruthy();
    expect(screen.getByRole('option', { name: /Jean Mbarga/ })).toBeTruthy();
    expect(screen.getByRole('option', { name: 'Je ne sais pas' })).toBeTruthy();
  });

  it('choisir une source la renvoie, et le champ affiche « catégorie · nom »', () => {
    const onChange = vi.fn();
    const { rerender } = render(<ClientSourcePicker value={null} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: /Choisir l’origine/ }));
    fireEvent.click(screen.getByRole('option', { name: /Jean Mbarga/ }));
    expect(onChange).toHaveBeenCalledWith('s-jean');
    rerender(<ClientSourcePicker value="s-jean" onChange={onChange} />);
    expect(screen.getByRole('button', { name: 'Commercial · Jean Mbarga' })).toBeTruthy();
  });

  it('ajoute un nouveau commercial depuis le formulaire, puis le choisit', () => {
    const onChange = vi.fn();
    createMutate.mockImplementation((_args: unknown, opts: { onSuccess: (r: unknown) => void }) => opts.onSuccess({ success: true, id: 's-new', existing: false }));
    render(<ClientSourcePicker value={null} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: /Choisir l’origine/ }));
    fireEvent.change(screen.getByLabelText('Rechercher un commercial, un canal…'), { target: { value: 'Paul Etoga' } });
    fireEvent.click(screen.getByRole('button', { name: /Ajouter une source/ }));
    // Le nom tapé dans la recherche est repris.
    expect((screen.getByLabelText('Nom') as HTMLInputElement).value).toBe('Paul Etoga');
    fireEvent.change(screen.getByLabelText(/Téléphone/), { target: { value: '+237 699 11 22 33' } });
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter et choisir' }));
    expect(createMutate).toHaveBeenCalledWith(
      { kind: 'commercial', label: 'Paul Etoga', phone: '+237 699 11 22 33' },
      expect.any(Object),
    );
    expect(onChange).toHaveBeenCalledWith('s-new');
  });
});
