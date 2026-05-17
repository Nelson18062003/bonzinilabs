import { useCallback, useEffect, useMemo, useRef } from 'react';
import { isSameDay } from 'date-fns';
import { MessageBubble } from './MessageBubble';
import { DateSeparator } from './DateSeparator';
import { EmptyChatState } from './EmptyChatState';
import { cn } from '@/lib/utils';
import type { ChatMessage } from '@/types/chat';

interface ChatThreadProps {
  messages: ChatMessage[];
  selfSenderType: 'client' | 'admin';
  variant?: 'client-app' | 'admin-app';
  isLoading?: boolean;
  emptyState?: React.ReactNode;
  onReply?: (message: ChatMessage) => void;
  className?: string;
}

export function ChatThread({
  messages,
  selfSenderType,
  variant = 'client-app',
  isLoading = false,
  emptyState,
  onReply,
  className,
}: ChatThreadProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Index pour résoudre les quotes en O(1)
  const messagesById = useMemo(() => {
    const map = new Map<string, ChatMessage>();
    for (const m of messages) map.set(m.id, m);
    return map;
  }, [messages]);

  // Auto-scroll au mount et à chaque nouveau message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const scrollToMessage = useCallback((id: string) => {
    const el = containerRef.current?.querySelector(`[data-message-id="${id}"]`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Flash visuel pour faire remarquer
      el.classList.add('animate-pulse');
      window.setTimeout(() => el.classList.remove('animate-pulse'), 1200);
    }
  }, []);

  if (!isLoading && messages.length === 0) {
    return (
      <div className={cn('flex flex-1 items-center justify-center p-6', className)}>
        {emptyState ?? <EmptyChatState />}
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
            />
          </div>
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
}
