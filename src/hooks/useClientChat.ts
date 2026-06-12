// ============================================================
// CLIENT-SIDE CHAT HOOKS
// Uses `supabase` (client session, storageKey: bonzini-client-auth)
// ============================================================
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { validateUploadFile } from '@/lib/utils';
import { generateVideoPoster, readVideoMetadata } from '@/lib/video-utils';
import type { ChatConversation, ChatMessage, ChatMediaType } from '@/types/chat';

const CHAT_BUCKET = 'chat-media';
const MAX_CHAT_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_CHAT_VIDEO_BYTES = 25 * 1024 * 1024;
const MAX_VIDEO_DURATION_SECONDS = 30;
const MAX_CHAT_FILE_BYTES = 10 * 1024 * 1024;
const ALLOWED_CHAT_IMAGE_MIME = ['image/jpeg', 'image/png', 'image/webp'];
const ALLOWED_CHAT_VIDEO_MIME = ['video/mp4', 'video/quicktime'];
const ALLOWED_CHAT_FILE_MIME = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/msword',
  'application/vnd.ms-excel',
];

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

// ── Liste de TOUTES les conversations du client (multi-thread) ──

export function useMyChatConversations() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['my-chat-conversations'],
    staleTime: 15_000,
    queryFn: async (): Promise<ChatConversation[]> => {
      const clientId = await getCurrentClientId();
      if (!clientId) return [];

      const { data, error } = await supabase
        .from('chat_conversations' as AnyTable)
        .select('*')
        .eq('client_id', clientId)
        .order('last_message_at', { ascending: false, nullsFirst: false });

      if (error) throw error;
      const list = (data ?? []) as unknown as ChatConversation[];

      // Si aucune conversation, en créer une par défaut (subject null)
      if (list.length === 0) {
        const { data: created, error: createErr } = await supabase
          .from('chat_conversations' as AnyTable)
          .insert({ client_id: clientId })
          .select('*')
          .single();
        if (createErr) throw createErr;
        return [created as unknown as ChatConversation];
      }
      return list;
    },
  });

  // Subscribe Realtime : nouvelles convs créées + updates compteurs
  useEffect(() => {
    const channel = supabase
      .channel('client-chat-conv-list')
      .on(
        'postgres_changes' as never,
        { event: '*', schema: 'public', table: 'chat_conversations' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['my-chat-conversations'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return query;
}

// ── Détail d'UNE conversation spécifique ────────────────────

export function useMyChatConversation(conversationId: string | null | undefined) {
  return useQuery({
    queryKey: ['my-chat-conversation', conversationId],
    enabled: !!conversationId,
    staleTime: 15_000,
    queryFn: async (): Promise<ChatConversation | null> => {
      if (!conversationId) return null;
      const { data, error } = await supabase
        .from('chat_conversations' as AnyTable)
        .select('*')
        .eq('id', conversationId)
        .maybeSingle();
      if (error) throw error;
      return (data as unknown as ChatConversation) ?? null;
    },
  });
}

// ── Création explicite d'une nouvelle conversation ──────────

export function useCreateChatConversation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { subject: string }): Promise<ChatConversation> => {
      const clientId = await getCurrentClientId();
      if (!clientId) throw new Error('Not authenticated');
      const trimmed = input.subject.trim();
      if (!trimmed) throw new Error('Subject required');

      const { data, error } = await supabase
        .from('chat_conversations' as AnyTable)
        .insert({ client_id: clientId, subject: trimmed })
        .select('*')
        .single();

      if (error) throw error;
      return data as unknown as ChatConversation;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-chat-conversations'] });
    },
  });
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
      .on(
        'postgres_changes' as never,
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'chat_messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload: { new: ChatMessage }) => {
          // Read receipts : on remplace le message updated in-place
          queryClient.setQueryData<ChatMessage[]>(
            ['chat-messages', conversationId],
            (prev) => {
              if (!prev) return prev;
              return prev.map((m) => (m.id === payload.new.id ? payload.new : m));
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
    mutationFn: async (params: { conversationId: string; content: string; replyToMessageId?: string | null }) => {
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
          reply_to_message_id: params.replyToMessageId ?? null,
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
    mutationFn: async (params: { conversationId: string; file: File; replyToMessageId?: string | null }) => {
      const clientId = await getCurrentClientId();
      if (!clientId) throw new Error('Not authenticated');

      if (!ALLOWED_CHAT_IMAGE_MIME.includes(params.file.type)) {
        throw new Error('Format non supporté');
      }
      if (params.file.size > MAX_CHAT_IMAGE_BYTES) {
        throw new Error('Image trop volumineuse (max 5 Mo)');
      }
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
          media_size_bytes: params.file.size,
          reply_to_message_id: params.replyToMessageId ?? null,
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

// ── Envoi voice ─────────────────────────────────────────────

export function useSendClientVoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      conversationId: string;
      blob: Blob;
      mimeType: string;
      extension: string;
      durationSeconds: number;
      peaks: number[];
      replyToMessageId?: string | null;
    }) => {
      const clientId = await getCurrentClientId();
      if (!clientId) throw new Error('Not authenticated');

      const path = `${params.conversationId}/voice/${crypto.randomUUID()}.${params.extension}`;

      const { error: uploadError } = await supabase.storage
        .from(CHAT_BUCKET)
        .upload(path, params.blob, {
          cacheControl: '3600',
          upsert: false,
          contentType: params.mimeType || 'audio/webm',
        });
      if (uploadError) throw uploadError;

      const { data, error } = await supabase
        .from('chat_messages' as AnyTable)
        .insert({
          conversation_id: params.conversationId,
          sender_type: 'client',
          sender_id: clientId,
          media_url: path,
          media_type: 'voice' as ChatMediaType,
          media_duration_seconds: params.durationSeconds,
          media_size_bytes: params.blob.size,
          media_waveform_peaks: params.peaks,
          reply_to_message_id: params.replyToMessageId ?? null,
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

// ── Envoi vidéo ─────────────────────────────────────────────

export function useSendClientVideo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: { conversationId: string; file: File; replyToMessageId?: string | null }) => {
      const clientId = await getCurrentClientId();
      if (!clientId) throw new Error('Not authenticated');

      if (!ALLOWED_CHAT_VIDEO_MIME.includes(params.file.type)) {
        throw new Error('Format vidéo non supporté');
      }
      if (params.file.size > MAX_CHAT_VIDEO_BYTES) {
        throw new Error('Vidéo trop volumineuse (max 25 Mo)');
      }

      const meta = await readVideoMetadata(params.file);
      if (!meta) throw new Error('Vidéo invalide');
      if (meta.durationSeconds > MAX_VIDEO_DURATION_SECONDS) {
        throw new Error(`Vidéo trop longue (max ${MAX_VIDEO_DURATION_SECONDS}s)`);
      }

      const uuid = crypto.randomUUID();
      const ext = params.file.name.split('.').pop()?.toLowerCase() ?? 'mp4';
      const videoPath = `${params.conversationId}/video/${uuid}.${ext}`;
      const posterPath = `${params.conversationId}/video/${uuid}.poster.jpg`;

      // Upload vidéo
      const { error: vidErr } = await supabase.storage
        .from(CHAT_BUCKET)
        .upload(videoPath, params.file, {
          cacheControl: '3600',
          upsert: false,
          contentType: params.file.type,
        });
      if (vidErr) throw vidErr;

      // Upload poster (non-bloquant : si ça échoue, la vidéo s'affiche quand même)
      const posterBlob = await generateVideoPoster(params.file);
      if (posterBlob) {
        await supabase.storage
          .from(CHAT_BUCKET)
          .upload(posterPath, posterBlob, {
            cacheControl: '3600',
            upsert: false,
            contentType: 'image/jpeg',
          })
          .catch((e) => console.warn('Poster upload failed', e));
      }

      const { data, error } = await supabase
        .from('chat_messages' as AnyTable)
        .insert({
          conversation_id: params.conversationId,
          sender_type: 'client',
          sender_id: clientId,
          media_url: videoPath,
          media_type: 'video' as ChatMediaType,
          media_duration_seconds: meta.durationSeconds,
          media_size_bytes: params.file.size,
          reply_to_message_id: params.replyToMessageId ?? null,
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

// ── Envoi fichier ───────────────────────────────────────────

export function useSendClientFile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: { conversationId: string; file: File; replyToMessageId?: string | null }) => {
      const clientId = await getCurrentClientId();
      if (!clientId) throw new Error('Not authenticated');

      if (!ALLOWED_CHAT_FILE_MIME.includes(params.file.type)) {
        throw new Error('Format de fichier non supporté');
      }
      if (params.file.size > MAX_CHAT_FILE_BYTES) {
        throw new Error('Fichier trop volumineux (max 10 Mo)');
      }
      validateUploadFile(params.file);

      const ext = params.file.name.split('.').pop()?.toLowerCase() ?? 'bin';
      const path = `${params.conversationId}/file/${crypto.randomUUID()}.${ext}`;

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
          media_type: 'file' as ChatMediaType,
          media_size_bytes: params.file.size,
          media_filename: params.file.name,
          reply_to_message_id: params.replyToMessageId ?? null,
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
