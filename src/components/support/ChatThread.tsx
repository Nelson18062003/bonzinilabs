import { useCallback, useEffect, useMemo, useRef } from 'react';
import { isSameDay } from 'date-fns';
import type { SupabaseClient } from '@supabase/supabase-js';
import { MessageBubble } from './MessageBubble';
import { DateSeparator } from './DateSeparator';
import { EmptyChatState } from './EmptyChatState';
import { useReactionsForMessages } from '@/hooks/useMessageReactions';
import { cn } from '@/lib/utils';
import type { ChatMessage } from '@/types/chat';

interface ChatThreadProps {
  messages: ChatMessage[];
  selfSenderType: 'client' | 'admin';
  variant?: 'client-app' | 'admin-app';
  isLoading?: boolean;
  emptyState?: React.ReactNode;
  onReply?: (message: ChatMessage) => void;
  // Réactions
  conversationId?: string | null;
  clientForReactions?: SupabaseClient;
  selfReactorId?: string | null;
  selfReactorType?: 'client' | 'admin';
  // Quick replies (côté client uniquement, dans EmptyChatState)
  onQuickReply?: (content: string) => void;
  className?: string;
}

export function ChatThread({
  messages,
  selfSenderType,
  variant = 'client-app',
  isLoading = false,
  emptyState,
  onReply,
  conversationId,
  clientForReactions,
  selfReactorId,
  selfReactorType,
  onQuickReply,
  className,
}: ChatThreadProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const messagesById = useMemo(() => {
    const map = new Map<string, ChatMessage>();
    for (const m of messages) map.set(m.id, m);
    return map;
  }, [messages]);

  const messageIds = useMemo(() => messages.map((m) => m.id), [messages]);

  const { data: reactions } = useReactionsForMessages(
    clientForReactions as SupabaseClient,
    conversationId,
    messageIds
  );

  // Index réactions par message
  const reactionsByMsg = useMemo(() => {
    const map = new Map<string, typeof reactions>();
    for (const r of reactions ?? []) {
      const arr = map.get(r.message_id) ?? [];
      arr.push(r);
      map.set(r.message_id, arr);
    }
    return map;
  }, [reactions]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const scrollToMessage = useCallback((id: string) => {
    const el = containerRef.current?.querySelector(`[data-message-id="${id}"]`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('animate-pulse');
      window.setTimeout(() => el.classList.remove('animate-pulse'), 1200);
    }
  }, []);

  if (!isLoading && messages.length === 0) {
    return (
      <div className={cn('flex flex-1 items-center justify-center p-6', className)}>
        {emptyState ?? <EmptyChatState onQuickReply={onQuickReply} />}
      </div>
    );
  }

  return (
    <div ref={containerRef} className={cn('flex flex-col gap-2 px-3 py-4', className)}>
      {messages.map((m, i) => {
        const prev = messages[i - 1];
        const showDate =
          !prev || !isSameDay(new Date(prev.created_at), new Date(m.created_at));
        const prevSameSender = prev && prev.sender_type === m.sender_type;
        const quoted = m.reply_to_message_id
          ? messagesById.get(m.reply_to_message_id) ?? null
          : null;

        return (
          <div key={m.id} className="flex flex-col gap-2">
            {showDate && <DateSeparator isoDate={m.created_at} />}
            <MessageBubble
              message={m}
              perspective={m.sender_type === selfSenderType ? 'self' : 'other'}
              variant={variant}
              showLabel={!prevSameSender || showDate}
              quotedMessage={quoted}
              onReply={onReply}
              onQuoteClick={scrollToMessage}
              reactions={reactionsByMsg.get(m.id) ?? []}
              supabaseClient={clientForReactions}
              selfReactorId={selfReactorId ?? null}
              selfReactorType={selfReactorType}
              conversationId={conversationId ?? null}
            />
          </div>
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
}
