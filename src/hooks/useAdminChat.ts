// ============================================================
// ADMIN-SIDE CHAT HOOKS
// Uses `supabaseAdmin` (admin session, storageKey: bonzini-admin-auth)
// ============================================================
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabaseAdmin } from '@/integrations/supabase/client';
import { validateUploadFile } from '@/lib/utils';
import { generateVideoPoster, readVideoMetadata } from '@/lib/video-utils';
import type {
  ChatConversation,
  ChatConversationWithClient,
  ChatMessage,
  ChatMediaType,
} from '@/types/chat';

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

type AnyTable = never;

// ── Liste des conversations (admin) avec infos client ───────

export function useAdminConversations(statusFilter: 'open' | 'closed' | 'all' = 'open') {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['admin-chat-conversations', statusFilter],
    staleTime: 10_000,
    queryFn: async (): Promise<ChatConversationWithClient[]> => {
      let q = supabaseAdmin
        .from('chat_conversations' as AnyTable)
        .select('*')
        .order('unread_count_admin', { ascending: false })
        .order('last_message_at', { ascending: false, nullsFirst: false })
        .limit(500);
      if (statusFilter !== 'all') {
        q = q.eq('status', statusFilter);
      }
      const { data: convs, error } = await q;
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
      .on(
        'postgres_changes' as never,
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'chat_messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload: { new: ChatMessage }) => {
          queryClient.setQueryData<ChatMessage[]>(
            ['admin-chat-messages', conversationId],
            (prev) => {
              if (!prev) return prev;
              return prev.map((m) => (m.id === payload.new.id ? payload.new : m));
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
    mutationFn: async (params: { conversationId: string; content: string; replyToMessageId?: string | null }) => {
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
          reply_to_message_id: params.replyToMessageId ?? null,
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
    mutationFn: async (params: { conversationId: string; file: File; replyToMessageId?: string | null }) => {
      const { data: { user } } = await supabaseAdmin.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      if (!ALLOWED_CHAT_IMAGE_MIME.includes(params.file.type)) {
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
          media_size_bytes: params.file.size,
          reply_to_message_id: params.replyToMessageId ?? null,
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

// ── Envoi voice admin ───────────────────────────────────────

export function useSendAdminVoice() {
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
      const { data: { user } } = await supabaseAdmin.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const path = `${params.conversationId}/voice/${crypto.randomUUID()}.${params.extension}`;

      const { error: uploadError } = await supabaseAdmin.storage
        .from(CHAT_BUCKET)
        .upload(path, params.blob, {
          cacheControl: '3600',
          upsert: false,
          contentType: params.mimeType || 'audio/webm',
        });
      if (uploadError) throw uploadError;

      const { data, error } = await supabaseAdmin
        .from('chat_messages' as AnyTable)
        .insert({
          conversation_id: params.conversationId,
          sender_type: 'admin',
          sender_id: user.id,
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
      queryClient.invalidateQueries({
        queryKey: ['admin-chat-messages', vars.conversationId],
      });
      queryClient.invalidateQueries({ queryKey: ['admin-chat-conversations'] });
    },
  });
}

// ── Envoi vidéo admin ───────────────────────────────────────

export function useSendAdminVideo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: { conversationId: string; file: File; replyToMessageId?: string | null }) => {
      const { data: { user } } = await supabaseAdmin.auth.getUser();
      if (!user) throw new Error('Not authenticated');

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

      const { error: vidErr } = await supabaseAdmin.storage
        .from(CHAT_BUCKET)
        .upload(videoPath, params.file, {
          cacheControl: '3600',
          upsert: false,
          contentType: params.file.type,
        });
      if (vidErr) throw vidErr;

      const posterBlob = await generateVideoPoster(params.file);
      if (posterBlob) {
        await supabaseAdmin.storage
          .from(CHAT_BUCKET)
          .upload(posterPath, posterBlob, {
            cacheControl: '3600',
            upsert: false,
            contentType: 'image/jpeg',
          })
          .catch((e) => console.warn('Poster upload failed', e));
      }

      const { data, error } = await supabaseAdmin
        .from('chat_messages' as AnyTable)
        .insert({
          conversation_id: params.conversationId,
          sender_type: 'admin',
          sender_id: user.id,
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
      queryClient.invalidateQueries({
        queryKey: ['admin-chat-messages', vars.conversationId],
      });
      queryClient.invalidateQueries({ queryKey: ['admin-chat-conversations'] });
    },
  });
}

// ── Envoi fichier admin ─────────────────────────────────────

export function useSendAdminFile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: { conversationId: string; file: File; replyToMessageId?: string | null }) => {
      const { data: { user } } = await supabaseAdmin.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      if (!ALLOWED_CHAT_FILE_MIME.includes(params.file.type)) {
        throw new Error('Format de fichier non supporté');
      }
      if (params.file.size > MAX_CHAT_FILE_BYTES) {
        throw new Error('Fichier trop volumineux (max 10 Mo)');
      }
      validateUploadFile(params.file);

      const ext = params.file.name.split('.').pop()?.toLowerCase() ?? 'bin';
      const path = `${params.conversationId}/file/${crypto.randomUUID()}.${ext}`;

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
