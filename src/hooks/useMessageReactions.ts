// ============================================================
// Réactions emoji sur les messages (client + admin)
// ============================================================
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { ChatMessageReaction, ChatReactionEmoji } from '@/types/chat';

type AnyTable = never;

/**
 * Récupère TOUTES les réactions pour les messages d'une conversation.
 * Subscribe Realtime à INSERT/DELETE pour mises à jour live.
 *
 * @param sb supabase ou supabaseAdmin
 * @param messageIds liste d'IDs de messages dont on veut les réactions
 */
export function useReactionsForMessages(
  sb: SupabaseClient,
  conversationId: string | null | undefined,
  messageIds: string[]
) {
  const qc = useQueryClient();
  const queryKey = useMemo(() => ['chat-reactions', conversationId], [conversationId]);

  const query = useQuery({
    queryKey,
    enabled: !!conversationId && messageIds.length > 0,
    staleTime: 10_000,
    queryFn: async (): Promise<ChatMessageReaction[]> => {
      if (messageIds.length === 0) return [];
      const { data, error } = await sb
        .from('chat_message_reactions' as AnyTable)
        .select('*')
        .in('message_id', messageIds);
      if (error) throw error;
      return (data ?? []) as unknown as ChatMessageReaction[];
    },
  });

  useEffect(() => {
    if (!conversationId) return;
    const channel = sb
      .channel(`chat-reactions-${conversationId}`)
      .on(
        'postgres_changes' as never,
        { event: 'INSERT', schema: 'public', table: 'chat_message_reactions' },
        (payload: { new: ChatMessageReaction }) => {
          if (!messageIds.includes(payload.new.message_id)) return;
          qc.setQueryData<ChatMessageReaction[]>(queryKey, (prev) => {
            if (!prev) return [payload.new];
            if (prev.some((r) => r.id === payload.new.id)) return prev;
            return [...prev, payload.new];
          });
        }
      )
      .on(
        'postgres_changes' as never,
        { event: 'DELETE', schema: 'public', table: 'chat_message_reactions' },
        (payload: { old: ChatMessageReaction }) => {
          qc.setQueryData<ChatMessageReaction[]>(queryKey, (prev) => {
            if (!prev) return prev;
            return prev.filter((r) => r.id !== payload.old.id);
          });
        }
      )
      .subscribe();
    return () => {
      sb.removeChannel(channel);
    };
  }, [sb, conversationId, qc, queryKey, messageIds]);

  return query;
}

/**
 * Toggle une réaction : si elle existe (même user_id + emoji), supprime ; sinon ajoute.
 */
export function useToggleReaction(sb: SupabaseClient) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      messageId: string;
      userId: string;
      senderType: 'client' | 'admin';
      emoji: ChatReactionEmoji;
      conversationId: string;
    }) => {
      // Cherche si la réaction existe déjà
      const { data: existing } = await sb
        .from('chat_message_reactions' as AnyTable)
        .select('id')
        .eq('message_id', params.messageId)
        .eq('user_id', params.userId)
        .eq('emoji', params.emoji)
        .maybeSingle();

      if (existing) {
        const { error } = await sb
          .from('chat_message_reactions' as AnyTable)
          .delete()
          .eq('id', (existing as { id: string }).id);
        if (error) throw error;
        return { removed: true };
      }

      const { error } = await sb.from('chat_message_reactions' as AnyTable).insert({
        message_id: params.messageId,
        user_id: params.userId,
        sender_type: params.senderType,
        emoji: params.emoji,
      });
      if (error) throw error;
      return { removed: false };
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['chat-reactions', vars.conversationId] });
    },
  });
}
