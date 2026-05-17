// ============================================================
// Quick replies (admin CRUD) — affichées aux clients dans EmptyChatState
// ============================================================
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabaseAdmin } from '@/integrations/supabase/client';
import type { ChatClientQuickReply } from '@/types/chat';

type AnyTable = never;

export function useAdminAllQuickReplies() {
  return useQuery({
    queryKey: ['admin-client-quick-replies'],
    staleTime: 60_000,
    queryFn: async (): Promise<ChatClientQuickReply[]> => {
      const { data, error } = await supabaseAdmin
        .from('chat_client_quick_replies' as AnyTable)
        .select('*')
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as ChatClientQuickReply[];
    },
  });
}

export function useCreateQuickReply() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { label: string; content: string; sort_order?: number; active?: boolean }) => {
      const { data, error } = await supabaseAdmin
        .from('chat_client_quick_replies' as AnyTable)
        .insert({
          label: input.label.trim(),
          content: input.content.trim(),
          sort_order: input.sort_order ?? 0,
          active: input.active ?? true,
        })
        .select('*')
        .single();
      if (error) throw error;
      return data as unknown as ChatClientQuickReply;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-client-quick-replies'] });
      qc.invalidateQueries({ queryKey: ['chat-client-quick-replies'] });
    },
  });
}

export function useUpdateQuickReply() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      label?: string;
      content?: string;
      sort_order?: number;
      active?: boolean;
    }) => {
      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (input.label !== undefined) patch.label = input.label.trim();
      if (input.content !== undefined) patch.content = input.content.trim();
      if (input.sort_order !== undefined) patch.sort_order = input.sort_order;
      if (input.active !== undefined) patch.active = input.active;

      const { data, error } = await supabaseAdmin
        .from('chat_client_quick_replies' as AnyTable)
        .update(patch)
        .eq('id', input.id)
        .select('*')
        .single();
      if (error) throw error;
      return data as unknown as ChatClientQuickReply;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-client-quick-replies'] });
      qc.invalidateQueries({ queryKey: ['chat-client-quick-replies'] });
    },
  });
}

export function useDeleteQuickReply() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabaseAdmin
        .from('chat_client_quick_replies' as AnyTable)
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-client-quick-replies'] });
      qc.invalidateQueries({ queryKey: ['chat-client-quick-replies'] });
    },
  });
}

export function useReorderQuickReplies() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (orderedIds: string[]) => {
      const { error } = await supabaseAdmin.rpc(
        'reorder_quick_replies' as never,
        { p_ids: orderedIds } as never
      );
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-client-quick-replies'] });
      qc.invalidateQueries({ queryKey: ['chat-client-quick-replies'] });
    },
  });
}
