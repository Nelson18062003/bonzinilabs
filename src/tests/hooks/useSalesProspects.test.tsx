/**
 * Les hooks des prospects (src/hooks/useSales.ts), contre un PostgREST simulé :
 *   · la liste lit les autres numéros (`prospect_phones`) ; tant que la
 *     migration du 06/10 n'est pas passée (relation inconnue, PGRST200), elle
 *     se relit sans eux au lieu de tomber en erreur ;
 *   · la création efface le brouillon par le rappel de la MUTATION
 *     (`onCreated`), qui s'exécute même si l'écran a été quitté pendant
 *     l'envoi ; `quietErrors` : pas de toast, l'écran dit le refus sous le champ.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

const h = vi.hoisted(() => ({
  selects: [] as string[],
  relationMissing: false,
  rpc: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: h.toastError } }));
vi.mock('@/integrations/supabase/client', () => {
  const query = (columns: string) => {
    h.selects.push(columns);
    const result =
      h.relationMissing && columns.includes('prospect_phones')
        ? { data: null, error: { code: 'PGRST200', message: "Could not find a relationship between 'prospects' and 'prospect_phones'" } }
        : { data: [{ id: 'p1', first_name: 'Awa', phones: columns.includes('prospect_phones') ? [{ phone_e164: '+8613812345678', position: 1 }, { phone_e164: '+237655443322', position: 0 }] : undefined }], error: null };
    const chain = {
      order: () => chain,
      eq: () => chain,
      then: (ok: (v: unknown) => unknown, ko?: (e: unknown) => unknown) => Promise.resolve(result).then(ok, ko),
    };
    return chain;
  };
  return { supabaseAdmin: { from: () => ({ select: query }), rpc: h.rpc } };
});

import { useCreateProspect, useProspects } from '@/hooks/useSales';

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  h.selects = [];
  h.relationMissing = false;
  h.rpc.mockReset();
  h.toastError.mockReset();
});

describe('useProspects', () => {
  it('lit les autres numéros, dans leur ordre de saisie', async () => {
    const { result } = renderHook(() => useProspects(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(h.selects).toEqual(['*, phones:prospect_phones(phone_e164, country_iso, label, position)']);
    expect(result.current.data?.[0].phones?.map((p) => p.phone_e164)).toEqual(['+237655443322', '+8613812345678']);
  });

  it('base pas encore migrée (PGRST200) : la liste se relit sans eux, pas d’erreur', async () => {
    h.relationMissing = true;
    const { result } = renderHook(() => useProspects(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(h.selects).toEqual(['*, phones:prospect_phones(phone_e164, country_iso, label, position)', '*']);
    expect(result.current.data?.[0]).toMatchObject({ id: 'p1', first_name: 'Awa', phones: [] });
  });
});

describe('useCreateProspect', () => {
  const input = { firstName: 'Paul', lastName: 'Etoga', phone: '+237699123456', city: 'Douala', gender: 'MALE' as const };

  it('`onCreated` : le rappel de la mutation, avec l’identifiant créé', async () => {
    h.rpc.mockResolvedValue({ data: { success: true, id: 'p-new' }, error: null });
    const onCreated = vi.fn();
    const { result } = renderHook(() => useCreateProspect({ onCreated }), { wrapper });
    await act(async () => {
      await result.current.mutateAsync(input);
    });
    expect(onCreated).toHaveBeenCalledWith('p-new');
  });

  it('`quietErrors` : le refus ne part pas en toast (l’écran le dit sous le champ)', async () => {
    h.rpc.mockResolvedValue({ data: { success: false, error: 'Ce numéro est déjà celui d’un client Bonzini' }, error: null });
    const { result } = renderHook(() => useCreateProspect({ quietErrors: true }), { wrapper });
    await act(async () => {
      await result.current.mutateAsync(input).catch(() => undefined);
    });
    expect(h.toastError).not.toHaveBeenCalled();
    // Sans l'option, le toast reste (autres écrans).
    const loud = renderHook(() => useCreateProspect(), { wrapper });
    await act(async () => {
      await loud.result.current.mutateAsync(input).catch(() => undefined);
    });
    expect(h.toastError).toHaveBeenCalledWith('Ce numéro est déjà celui d’un client Bonzini');
  });
});
