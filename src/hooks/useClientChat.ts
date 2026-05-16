// ============================================================
// CLIENT-SIDE CHAT HOOKS — Lot 1 (texte + photos)
// Uses `supabase` (client session, storageKey: bonzini-client-auth)
// ============================================================
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { validateUploadFile } from '@/lib/utils';
import type { ChatConversation, ChatMessage } from '@/types/chat';

const CHAT_BUCKET = 'chat-media';
const MAX_CHAT_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_CHAT_MIME = ['image/jpeg', 'image/png', 'image/webp'];

// Helpers pour caster les tables non encore présentes dans les types générés.
// Sera retiré une fois `npx supabase gen types` rerun.
type AnyTable = never;

async function getCurrentClientId(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from('clients')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle();
  return data?.id ?? null;
}

// ── Récupère ou crée la conversation du client courant ──────

export function useMyChatConversation() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['my-chat-conversation'],
    staleTime: 30_000,
    queryFn: async (): Promise<ChatConversation | null> => {
      const clientId = await getCurrentClientId();
      if (!clientId) return null;

      // 1. Tente de récupérer la conversation existante
      const { data: existing } = await supabase
        .from('chat_conversations' as AnyTable)
        .select('*')
        .eq('client_id', clientId)
        .maybeSingle();

      if (existing) return existing as unknown as ChatConversation;

      // 2. Sinon en crée une
      const { data: created, error } = await supabase
        .from('chat_conversations' as AnyTable)
        .insert({ client_id: clientId })
        .select('*')
        .single();

      if (error) throw error;
      return created as unknown as ChatConversation;
    },
  });

  // Subscribe Realtime sur les updates de la conversation (compteurs non-lus)
  useEffect(() => {
    const convId = query.data?.id;
    if (!convId) return;

    const channel = supabase
      .channel(`client-chat-conv-${convId}`)
      .on(
        'postgres_changes' as never,
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'chat_conversations',
          filter: `id=eq.${convId}`,
        },
        (payload: { new: ChatConversation }) => {
          queryClient.setQueryData(['my-chat-conversation'], payload.new);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [query.data?.id, queryClient]);

  return query;
}

// ── Messages d'une conversation + Realtime ──────────────────

export function useChatMessages(conversationId: string | null | undefined) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['chat-messages', conversationId],
    enabled: !!conversationId,
    staleTime: 5_000,
    queryFn: async (): Promise<ChatMessage[]> => {
      if (!conversationId) return [];
      const { data, error } = await supabase
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

    const channel = supabase
      .channel(`client-chat-msgs-${conversationId}`)
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
            ['chat-messages', conversationId],
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
      supabase.removeChannel(channel);
    };
  }, [conversationId, queryClient]);

  return query;
}

// ── Envoi de message texte ──────────────────────────────────

export function useSendClientMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: { conversationId: string; content: string }) => {
      const clientId = await getCurrentClientId();
      if (!clientId) throw new Error('Not authenticated');
      const trimmed = params.content.trim();
      if (!trimmed) throw new Error('Empty message');
      if (trimmed.length > 2000) throw new Error('Message too long');

      const { data, error } = await supabase
        .from('chat_messages' as AnyTable)
        .insert({
          conversation_id: params.conversationId,
          sender_type: 'client',
          sender_id: clientId,
          content: trimmed,
        })
        .select('*')
        .single();

      if (error) throw error;
      return data as unknown as ChatMessage;
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ['chat-messages', vars.conversationId] });
    },
  });
}

// ── Envoi d'image ───────────────────────────────────────────

export function useSendClientImage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: { conversationId: string; file: File }) => {
      const clientId = await getCurrentClientId();
      if (!clientId) throw new Error('Not authenticated');

      // Validation type + taille (max 5 MB pour le chat, plus restrictif que validateUploadFile)
      if (!ALLOWED_CHAT_MIME.includes(params.file.type)) {
        throw new Error('Format non supporté');
      }
      if (params.file.size > MAX_CHAT_IMAGE_BYTES) {
        throw new Error('Image trop volumineuse (max 5 Mo)');
      }
      // Garde-fou supplémentaire via le validateur global
      validateUploadFile(params.file);

      const ext = params.file.name.split('.').pop()?.toLowerCase() ?? 'jpg';
      const path = `${params.conversationId}/${crypto.randomUUID()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from(CHAT_BUCKET)
        .upload(path, params.file, {
          cacheControl: '3600',
          upsert: false,
          contentType: params.file.type,
        });
      if (uploadError) throw uploadError;

      const { data, error } = await supabase
        .from('chat_messages' as AnyTable)
        .insert({
          conversation_id: params.conversationId,
          sender_type: 'client',
          sender_id: clientId,
          media_url: path,
          media_type: 'image',
        })
        .select('*')
        .single();

      if (error) throw error;
      return data as unknown as ChatMessage;
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ['chat-messages', vars.conversationId] });
    },
  });
}

// ── Marquer la conversation comme lue ───────────────────────

export function useMarkConversationReadClient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (conversationId: string) => {
      const { error } = await supabase.rpc(
        'mark_conversation_read_client' as never,
        { p_conversation_id: conversationId } as never
      );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-chat-conversation'] });
    },
  });
}

// ── Temps de réponse moyen aujourd'hui ──────────────────────

export function useAvgResponseTime() {
  return useQuery({
    queryKey: ['chat-avg-response-time'],
    staleTime: 5 * 60_000, // 5 min
    queryFn: async (): Promise<number> => {
      const { data, error } = await supabase.rpc(
        'chat_avg_response_seconds_today' as never
      );
      if (error) throw error;
      return (data as unknown as number) ?? 300;
    },
  });
}

// ── URL signée pour afficher une image du chat ──────────────

export async function getChatMediaSignedUrl(path: string): Promise<string | null> {
  const { data } = await supabase.storage
    .from(CHAT_BUCKET)
    .createSignedUrl(path, 60 * 60); // 1h
  return data?.signedUrl ?? null;
}
