// ============================================================
// Canned responses (templates) — admin uniquement
// ============================================================
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabaseAdmin } from '@/integrations/supabase/client';
import type { ChatCannedResponse } from '@/types/chat';

type AnyTable = never;

export function useCannedResponses() {
  return useQuery({
    queryKey: ['chat-canned-responses'],
    staleTime: 60_000,
    queryFn: async (): Promise<ChatCannedResponse[]> => {
      const { data, error } = await supabaseAdmin
        .from('chat_canned_responses' as AnyTable)
        .select('*')
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as ChatCannedResponse[];
    },
  });
}

export function useCreateCannedResponse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { label: string; content: string; sort_order?: number }) => {
      const { data, error } = await supabaseAdmin
        .from('chat_canned_responses' as AnyTable)
        .insert({
          label: input.label.trim(),
          content: input.content.trim(),
          sort_order: input.sort_order ?? 0,
        })
        .select('*')
        .single();
      if (error) throw error;
      return data as unknown as ChatCannedResponse;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['chat-canned-responses'] }),
  });
}

export function useUpdateCannedResponse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      label?: string;
      content?: string;
      sort_order?: number;
    }) => {
      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (input.label !== undefined) patch.label = input.label.trim();
      if (input.content !== undefined) patch.content = input.content.trim();
      if (input.sort_order !== undefined) patch.sort_order = input.sort_order;

      const { data, error } = await supabaseAdmin
        .from('chat_canned_responses' as AnyTable)
        .update(patch)
        .eq('id', input.id)
        .select('*')
        .single();
      if (error) throw error;
      return data as unknown as ChatCannedResponse;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['chat-canned-responses'] }),
  });
}

export function useDeleteCannedResponse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabaseAdmin
        .from('chat_canned_responses' as AnyTable)
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['chat-canned-responses'] }),
  });
}

export function useReorderCannedResponses() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (orderedIds: string[]) => {
      const { error } = await supabaseAdmin.rpc(
        'reorder_canned_responses' as never,
        { p_ids: orderedIds } as never
      );
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['chat-canned-responses'] }),
  });
}
