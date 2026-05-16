// ============================================================
// ADMIN-SIDE CHAT HOOKS — Lot 1 (texte + photos)
// Uses `supabaseAdmin` (admin session, storageKey: bonzini-admin-auth)
// ============================================================
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabaseAdmin } from '@/integrations/supabase/client';
import { validateUploadFile } from '@/lib/utils';
import type {
  ChatConversation,
  ChatConversationWithClient,
  ChatMessage,
} from '@/types/chat';

const CHAT_BUCKET = 'chat-media';
const MAX_CHAT_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_CHAT_MIME = ['image/jpeg', 'image/png', 'image/webp'];

type AnyTable = never;

// ── Liste des conversations (admin) avec infos client ───────

export function useAdminConversations() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['admin-chat-conversations'],
    staleTime: 10_000,
    queryFn: async (): Promise<ChatConversationWithClient[]> => {
      // 1. Récupère les conversations
      const { data: convs, error } = await supabaseAdmin
        .from('chat_conversations' as AnyTable)
        .select('*')
        .eq('status', 'open')
        .order('unread_count_admin', { ascending: false })
        .order('last_message_at', { ascending: false, nullsFirst: false })
        .limit(500);
      if (error) throw error;

      const list = (convs ?? []) as unknown as ChatConversation[];
      if (list.length === 0) return [];

      // 2. Récupère les infos des clients en un seul appel
      const clientIds = Array.from(new Set(list.map((c) => c.client_id)));
      const { data: clients } = await supabaseAdmin
        .from('clients')
        .select('id, first_name, last_name, phone')
        .in('id', clientIds);

      const clientMap = new Map(
        (clients ?? []).map((c) => [
          c.id,
          {
            first_name: c.first_name as string | null,
            last_name: c.last_name as string | null,
            phone: c.phone as string | null,
          },
        ])
      );

      // 3. Récupère le dernier message de chaque conversation (preview)
      const { data: lastMsgs } = await supabaseAdmin
        .from('chat_messages' as AnyTable)
        .select('conversation_id, content, media_type, created_at')
        .in('conversation_id', list.map((c) => c.id))
        .order('created_at', { ascending: false });

      const previewMap = new Map<string, string>();
      for (const m of (lastMsgs ?? []) as unknown as Array<{
        conversation_id: string;
        content: string | null;
        media_type: string | null;
      }>) {
        if (!previewMap.has(m.conversation_id)) {
          const text = m.content
            ? m.content.length > 60
              ? m.content.slice(0, 57) + '...'
              : m.content
            : m.media_type === 'image'
            ? '🖼️ Photo'
            : '';
          previewMap.set(m.conversation_id, text);
        }
      }

      return list.map((c) => {
        const client = clientMap.get(c.client_id);
        return {
          ...c,
          client_first_name: client?.first_name ?? null,
          client_last_name: client?.last_name ?? null,
          client_phone: client?.phone ?? null,
          last_message_preview: previewMap.get(c.id) ?? null,
        };
      });
    },
  });

  // Realtime : invalider la liste à chaque INSERT/UPDATE sur les conversations
  useEffect(() => {
    const channel = supabaseAdmin
      .channel('admin-chat-conv-list')
      .on(
        'postgres_changes' as never,
        { event: '*', schema: 'public', table: 'chat_conversations' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['admin-chat-conversations'] });
        }
      )
      .on(
        'postgres_changes' as never,
        { event: 'INSERT', schema: 'public', table: 'chat_messages' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['admin-chat-conversations'] });
        }
      )
      .subscribe();

    return () => {
      supabaseAdmin.removeChannel(channel);
    };
  }, [queryClient]);

  return query;
}

// ── Une conversation précise (admin) ────────────────────────

export function useAdminConversation(conversationId: string | null | undefined) {
  return useQuery({
    queryKey: ['admin-chat-conversation', conversationId],
    enabled: !!conversationId,
    staleTime: 10_000,
    queryFn: async (): Promise<ChatConversationWithClient | null> => {
      if (!conversationId) return null;

      const { data: conv } = await supabaseAdmin
        .from('chat_conversations' as AnyTable)
        .select('*')
        .eq('id', conversationId)
        .maybeSingle();
      if (!conv) return null;
      const c = conv as unknown as ChatConversation;

      const { data: client } = await supabaseAdmin
        .from('clients')
        .select('first_name, last_name, phone')
        .eq('id', c.client_id)
        .maybeSingle();

      return {
        ...c,
        client_first_name: (client?.first_name as string | null) ?? null,
        client_last_name: (client?.last_name as string | null) ?? null,
        client_phone: (client?.phone as string | null) ?? null,
        last_message_preview: null,
      };
    },
  });
}

// ── Messages d'une conversation (admin) + Realtime ──────────

export function useAdminChatMessages(conversationId: string | null | undefined) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['admin-chat-messages', conversationId],
    enabled: !!conversationId,
    staleTime: 5_000,
    queryFn: async (): Promise<ChatMessage[]> => {
      if (!conversationId) return [];
      const { data, error } = await supabaseAdmin
        .from('chat_messages' as AnyTable)
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as unknown as ChatMessage[];
    },
  });

  useEffect(() => {
    if (!conversationId) return;

    const channel = supabaseAdmin
      .channel(`admin-chat-msgs-${conversationId}`)
      .on(
        'postgres_changes' as never,
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload: { new: ChatMessage }) => {
          queryClient.setQueryData<ChatMessage[]>(
            ['admin-chat-messages', conversationId],
            (prev) => {
              if (!prev) return [payload.new];
              if (prev.some((m) => m.id === payload.new.id)) return prev;
              return [...prev, payload.new];
            }
          );
        }
      )
      .subscribe();

    return () => {
      supabaseAdmin.removeChannel(channel);
    };
  }, [conversationId, queryClient]);

  return query;
}

// ── Envoi message admin (texte) ─────────────────────────────

export function useSendAdminMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: { conversationId: string; content: string }) => {
      const { data: { user } } = await supabaseAdmin.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      const trimmed = params.content.trim();
      if (!trimmed) throw new Error('Empty message');
      if (trimmed.length > 2000) throw new Error('Message too long');

      const { data, error } = await supabaseAdmin
        .from('chat_messages' as AnyTable)
        .insert({
          conversation_id: params.conversationId,
          sender_type: 'admin',
          sender_id: user.id,
          content: trimmed,
        })
        .select('*')
        .single();

      if (error) throw error;
      return data as unknown as ChatMessage;
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({
        queryKey: ['admin-chat-messages', vars.conversationId],
      });
      queryClient.invalidateQueries({ queryKey: ['admin-chat-conversations'] });
    },
  });
}

// ── Envoi image admin ───────────────────────────────────────

export function useSendAdminImage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: { conversationId: string; file: File }) => {
      const { data: { user } } = await supabaseAdmin.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      if (!ALLOWED_CHAT_MIME.includes(params.file.type)) {
        throw new Error('Format non supporté');
      }
      if (params.file.size > MAX_CHAT_IMAGE_BYTES) {
        throw new Error('Image trop volumineuse (max 5 Mo)');
      }
      validateUploadFile(params.file);

      const ext = params.file.name.split('.').pop()?.toLowerCase() ?? 'jpg';
      const path = `${params.conversationId}/${crypto.randomUUID()}.${ext}`;

      const { error: uploadError } = await supabaseAdmin.storage
        .from(CHAT_BUCKET)
        .upload(path, params.file, {
          cacheControl: '3600',
          upsert: false,
          contentType: params.file.type,
        });
      if (uploadError) throw uploadError;

      const { data, error } = await supabaseAdmin
        .from('chat_messages' as AnyTable)
        .insert({
          conversation_id: params.conversationId,
          sender_type: 'admin',
          sender_id: user.id,
          media_url: path,
          media_type: 'image',
        })
        .select('*')
        .single();

      if (error) throw error;
      return data as unknown as ChatMessage;
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({
        queryKey: ['admin-chat-messages', vars.conversationId],
      });
      queryClient.invalidateQueries({ queryKey: ['admin-chat-conversations'] });
    },
  });
}

// ── Marquage lu côté admin ──────────────────────────────────

export function useMarkConversationReadAdmin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (conversationId: string) => {
      const { error } = await supabaseAdmin.rpc(
        'mark_conversation_read_admin' as never,
        { p_conversation_id: conversationId } as never
      );
      if (error) throw error;
    },
    onSuccess: (_data, conversationId) => {
      queryClient.invalidateQueries({
        queryKey: ['admin-chat-conversation', conversationId],
      });
      queryClient.invalidateQueries({ queryKey: ['admin-chat-conversations'] });
    },
  });
}

// ── URL signée pour afficher une image (admin) ──────────────

export async function getAdminChatMediaSignedUrl(path: string): Promise<string | null> {
  const { data } = await supabaseAdmin.storage
    .from(CHAT_BUCKET)
    .createSignedUrl(path, 60 * 60);
  return data?.signedUrl ?? null;
}
