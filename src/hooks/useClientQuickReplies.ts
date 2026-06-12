// ============================================================
// Quick replies suggérées au client (utilisées dans EmptyChatState)
// ============================================================
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { ChatClientQuickReply } from '@/types/chat';

type AnyTable = never;

export function useClientQuickReplies() {
  return useQuery({
    queryKey: ['chat-client-quick-replies'],
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<ChatClientQuickReply[]> => {
      const { data, error } = await supabase
        .from('chat_client_quick_replies' as AnyTable)
        .select('*')
        .eq('active', true)
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as ChatClientQuickReply[];
    },
  });
}
