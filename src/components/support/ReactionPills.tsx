import { useMemo } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { useToggleReaction } from '@/hooks/useMessageReactions';
import { cn } from '@/lib/utils';
import type { ChatMessageReaction, ChatReactionEmoji } from '@/types/chat';

interface ReactionPillsProps {
  reactions: ChatMessageReaction[];
  selfReactorId: string | null;
  align: 'left' | 'right';
  supabaseClient?: SupabaseClient;
  messageId: string;
  conversationId: string | null;
  selfReactorType?: 'client' | 'admin';
}

export function ReactionPills({
  reactions,
  selfReactorId,
  align,
  supabaseClient,
  messageId,
  conversationId,
  selfReactorType,
}: ReactionPillsProps) {
  const toggle = useToggleReaction(supabaseClient!);

  // Groupe par emoji
  const grouped = useMemo(() => {
    const map = new Map<ChatReactionEmoji, { count: number; selfReacted: boolean }>();
    for (const r of reactions) {
      const cur = map.get(r.emoji) ?? { count: 0, selfReacted: false };
      cur.count += 1;
      if (r.user_id === selfReactorId) cur.selfReacted = true;
      map.set(r.emoji, cur);
    }
    return Array.from(map.entries());
  }, [reactions, selfReactorId]);

  const handleToggle = (emoji: ChatReactionEmoji) => {
    if (!supabaseClient || !selfReactorId || !selfReactorType || !conversationId) return;
    toggle.mutate({
      messageId,
      userId: selfReactorId,
      senderType: selfReactorType,
      emoji,
      conversationId,
    });
  };

  return (
    <div className={cn('flex flex-wrap items-center gap-1 px-2', align === 'right' ? 'justify-end' : 'justify-start')}>
      {grouped.map(([emoji, info]) => (
        <button
          key={emoji}
          type="button"
          onClick={() => handleToggle(emoji)}
          className={cn(
            'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition-colors',
            info.selfReacted
              ? 'border-bonzini-violet bg-bonzini-violet/10 text-bonzini-violet'
              : 'border-border bg-background hover:bg-muted'
          )}
        >
          <span>{emoji}</span>
          {info.count > 1 && <span className="font-medium">{info.count}</span>}
        </button>
      ))}
    </div>
  );
}
