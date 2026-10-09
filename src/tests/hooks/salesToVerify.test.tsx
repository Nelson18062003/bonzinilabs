/**
 * Les hooks du commercial face au numéro d'un client (07/10), contre un
 * PostgREST simulé :
 *   · `prospect_create` répond `to_verify` : le rappel `onCreated` le reçoit
 *     (l'assistant ouvre la fiche en le disant) et le toast dit ce qui va
 *     se passer — la direction est prévenue et décidera ;
 *   · `prospect_update` de même (un numéro ajouté qui est celui d'un client) ;
 *     sa réponse dit le statut FINAL (relecture) : une fiche qui attend
 *     toujours n'annonce pas une seconde alerte, une fiche libérée le dit ;
 *   · sans `to_verify`, rien ne change (« Prospect ajouté ») ;
 *   · la vérification en direct envoie le numéro et la fiche exclue, et ne
 *     part pas sans numéro complet.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

const h = vi.hoisted(() => ({ rpc: vi.fn(), success: vi.fn() }));

vi.mock('sonner', () => ({ toast: { success: h.success, error: vi.fn() } }));
vi.mock('@/integrations/supabase/client', () => ({ supabaseAdmin: { rpc: h.rpc, from: vi.fn() } }));

import { updateToast, useClientToProspect, useCreateProspect, useProspectPhoneCheck, useUpdateProspect } from '@/hooks/useSales';
import { TO_VERIFY_NOTE } from '@/lib/sales';

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  h.rpc.mockReset();
  h.success.mockReset();
});

const input = { firstName: 'Gaëlle', lastName: 'Nkoulou', phone: '+237699887766', city: 'Douala', gender: 'FEMALE' as const };

describe('Numéro déjà client — création et modification', () => {
  it('création « À vérifier » : `onCreated(id, true)` et un toast qui dit la suite', async () => {
    h.rpc.mockResolvedValue({ data: { success: true, id: 'p-new', to_verify: true }, error: null });
    const onCreated = vi.fn();
    const { result } = renderHook(() => useCreateProspect({ onCreated }), { wrapper });
    await act(async () => {
      await result.current.mutateAsync(input);
    });
    expect(onCreated).toHaveBeenCalledWith('p-new', true);
    expect(h.success).toHaveBeenCalledWith('Prospect enregistré : la direction va vérifier ce numéro', { description: TO_VERIFY_NOTE });
    // Une espace insécable avant « : » (le deux-points ne passe pas seul à la ligne).
    expect(TO_VERIFY_NOTE).toBe('La direction est prévenue\u00a0: elle vous attribuera ce client si c’est bien vous qui l’avez convaincu.');
  });

  it('création ordinaire : `onCreated(id, false)`, « Prospect ajouté »', async () => {
    h.rpc.mockResolvedValue({ data: { success: true, id: 'p-new', to_verify: false }, error: null });
    const onCreated = vi.fn();
    const { result } = renderHook(() => useCreateProspect({ onCreated }), { wrapper });
    await act(async () => {
      await result.current.mutateAsync(input);
    });
    expect(onCreated).toHaveBeenCalledWith('p-new', false);
    expect(h.success).toHaveBeenCalledWith('Prospect ajouté');
  });

  it('modification qui ajoute le numéro d’un client : le toast le dit aussi', async () => {
    h.rpc.mockResolvedValue({ data: { success: true, to_verify: true }, error: null });
    const onUpdated = vi.fn();
    const { result } = renderHook(() => useUpdateProspect({ onUpdated }), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ id: 'p-1', phones: [{ phone_e164: '+237699887766', country_iso: 'CM', label: null }] });
    });
    expect(onUpdated).toHaveBeenCalled();
    expect(h.success).toHaveBeenCalledWith('Prospect enregistré : la direction va vérifier ce numéro', { description: TO_VERIFY_NOTE });
  });

  it('la réponse dit le statut FINAL : une fiche qui attend toujours, une fiche libérée (À contacter ou Perdu)', () => {
    // Une vérification vient d'être ouverte : la direction est prévenue.
    expect(updateToast({ to_verify: true, status: 'to_verify', notified: true, released: false })).toEqual({
      title: 'Prospect enregistré : la direction va vérifier ce numéro',
      description: TO_VERIFY_NOTE,
    });
    // Autre champ modifié sur une fiche « À vérifier » : pas de « la direction va vérifier » une seconde fois.
    expect(updateToast({ to_verify: true, status: 'to_verify', notified: false, released: false })).toEqual({
      title: 'Prospect enregistré',
      description: 'La fiche attend toujours la décision de la direction.',
    });
    // Le numéro du client retiré ou corrigé : la fiche sort de « À vérifier ».
    expect(updateToast({ to_verify: false, status: 'new', notified: false, released: true }).description).toBe(
      'La fiche n’attend plus la direction\u00a0: elle est de nouveau «\u00a0À contacter\u00a0».',
    );
    expect(updateToast({ to_verify: false, status: 'lost', notified: false, released: true }).description).toBe(
      'Un de ses numéros est déjà celui d’un client Bonzini\u00a0: la fiche est classée «\u00a0Perdu\u00a0».',
    );
    expect(updateToast({ to_verify: false, status: 'contacted', notified: false, released: false })).toEqual({ title: 'Prospect enregistré' });
    // Serveur d'avant (to_verify seul, au sens « vient d'être prévenue ») : même toast qu'avant.
    expect(updateToast({ to_verify: true }).title).toBe('Prospect enregistré : la direction va vérifier ce numéro');
  });
});

describe('Repasser en prospect', () => {
  it('le hook ne fait pas de toast : la fenêtre en fait UN, avec le lien vers le commercial', async () => {
    h.rpc.mockResolvedValue({ data: { success: true, prospect_id: 'p-9', reopened: false }, error: null });
    const { result } = renderHook(() => useClientToProspect(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ userId: 'u7', sourceId: 'src-carine' });
    });
    expect(h.rpc).toHaveBeenCalledWith('admin_client_to_prospect', { p_user_id: 'u7', p_source_id: 'src-carine', p_reason: null });
    expect(h.success).not.toHaveBeenCalled();
  });
});

describe('Vérification en direct d’un numéro', () => {
  it('envoie le numéro et la fiche exclue ; rend le statut', async () => {
    h.rpc.mockResolvedValue({ data: { success: true, status: 'client' }, error: null });
    const { result } = renderHook(() => useProspectPhoneCheck('+237699887766', 'p-1'), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(h.rpc).toHaveBeenCalledWith('prospect_phone_check', { p_phone: '+237699887766', p_exclude_prospect_id: 'p-1' });
    expect(result.current.data?.status).toBe('client');
  });

  it('sans numéro complet, rien ne part', () => {
    renderHook(() => useProspectPhoneCheck(null), { wrapper });
    expect(h.rpc).not.toHaveBeenCalled();
  });
});
