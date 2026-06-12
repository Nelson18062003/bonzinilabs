import { useMemo } from 'react';
import { motion } from 'framer-motion';
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
    <div
      className={cn(
        'flex flex-wrap items-center gap-1 px-2 pt-0.5',
        align === 'right' ? 'justify-end' : 'justify-start'
      )}
    >
      {grouped.map(([emoji, info]) => (
        <motion.button
          key={emoji}
          type="button"
          onClick={() => handleToggle(emoji)}
          whileTap={{ scale: 0.92 }}
          className={cn(
            'inline-flex items-center gap-1 rounded-full border bg-background px-2 py-0.5 text-xs',
            'shadow-[0_0_0_1px_hsl(var(--border))]',
            info.selfReacted
              ? 'border-bonzini-violet bg-[hsl(258_100%_97%)] dark:bg-[hsl(258_45%_22%)]'
              : 'border-border'
          )}
        >
          <span>{emoji}</span>
          {info.count > 1 && (
            <span
              className={cn(
                'text-[10px] font-semibold',
                info.selfReacted ? 'text-bonzini-violet' : 'text-muted-foreground'
              )}
            >
              {info.count}
            </span>
          )}
        </motion.button>
      ))}
    </div>
  );
}
