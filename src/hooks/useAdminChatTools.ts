// ============================================================
// Outils admin pour le support chat :
//   - claim / assign / unassign conversation
//   - close / reopen
//   - search full-text
//   - stats agrégées
// ============================================================
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabaseAdmin } from '@/integrations/supabase/client';
import type { ChatAdminStats, ChatSearchResult } from '@/types/chat';

// ── Claim / Assign ─────────────────────────────────────────

export function useClaimConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (conversationId: string) => {
      const { error } = await supabaseAdmin.rpc(
        'claim_chat_conversation' as never,
        { p_conversation_id: conversationId } as never
      );
      if (error) throw error;
    },
    onSuccess: (_d, conversationId) => {
      qc.invalidateQueries({ queryKey: ['admin-chat-conversations'] });
      qc.invalidateQueries({ queryKey: ['admin-chat-conversation', conversationId] });
    },
  });
}

export function useAssignConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { conversationId: string; adminUserRoleId: string | null }) => {
      const { error } = await supabaseAdmin.rpc(
        'assign_chat_conversation' as never,
        {
          p_conversation_id: params.conversationId,
          p_admin_user_role_id: params.adminUserRoleId,
        } as never
      );
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['admin-chat-conversations'] });
      qc.invalidateQueries({ queryKey: ['admin-chat-conversation', vars.conversationId] });
    },
  });
}

// ── Close / Reopen ─────────────────────────────────────────

export function useCloseConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (conversationId: string) => {
      const { error } = await supabaseAdmin.rpc(
        'close_chat_conversation' as never,
        { p_conversation_id: conversationId } as never
      );
      if (error) throw error;
    },
    onSuccess: (_d, conversationId) => {
      qc.invalidateQueries({ queryKey: ['admin-chat-conversations'] });
      qc.invalidateQueries({ queryKey: ['admin-chat-conversation', conversationId] });
    },
  });
}

export function useReopenConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (conversationId: string) => {
      const { error } = await supabaseAdmin.rpc(
        'reopen_chat_conversation' as never,
        { p_conversation_id: conversationId } as never
      );
      if (error) throw error;
    },
    onSuccess: (_d, conversationId) => {
      qc.invalidateQueries({ queryKey: ['admin-chat-conversations'] });
      qc.invalidateQueries({ queryKey: ['admin-chat-conversation', conversationId] });
    },
  });
}

// ── Recherche full-text ────────────────────────────────────

export function useSearchConversations(query: string) {
  const trimmed = query.trim();
  return useQuery({
    queryKey: ['admin-chat-search', trimmed],
    enabled: trimmed.length >= 2,
    staleTime: 10_000,
    queryFn: async (): Promise<ChatSearchResult[]> => {
      const { data, error } = await supabaseAdmin.rpc(
        'search_chat_conversations' as never,
        { p_query: trimmed } as never
      );
      if (error) throw error;
      return (data ?? []) as unknown as ChatSearchResult[];
    },
  });
}

// ── Statistiques admin ─────────────────────────────────────

export function useChatAdminStats(periodDays = 7) {
  return useQuery({
    queryKey: ['admin-chat-stats', periodDays],
    staleTime: 60_000,
    queryFn: async (): Promise<ChatAdminStats> => {
      const { data, error } = await supabaseAdmin.rpc(
        'get_chat_admin_stats' as never,
        { p_period_days: periodDays } as never
      );
      if (error) throw error;
      return data as unknown as ChatAdminStats;
    },
  });
}

// ── Liste admins éligibles support (pour le dropdown d'assignation) ──

export function useSupportAdmins() {
  return useQuery({
    queryKey: ['support-admins'],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabaseAdmin
        .from('user_roles')
        .select('id, user_id, first_name, last_name, role, is_disabled')
        .in('role', ['super_admin', 'ops', 'support', 'customer_success'])
        .or('is_disabled.is.null,is_disabled.eq.false');
      if (error) throw error;
      return data ?? [];
    },
  });
}
