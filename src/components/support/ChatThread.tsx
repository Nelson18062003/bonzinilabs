import { useEffect, useRef } from 'react';
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
  className?: string;
}

export function ChatThread({
  messages,
  selfSenderType,
  variant = 'client-app',
  isLoading = false,
  emptyState,
  className,
}: ChatThreadProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll au mount et à chaque nouveau message.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  if (!isLoading && messages.length === 0) {
    return (
      <div className={cn('flex flex-1 items-center justify-center p-6', className)}>
        {emptyState ?? <EmptyChatState />}
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col gap-2 px-3 py-4', className)}>
      {messages.map((m, i) => {
        const prev = messages[i - 1];
        const showDate =
          !prev || !isSameDay(new Date(prev.created_at), new Date(m.created_at));
        const prevSameSender = prev && prev.sender_type === m.sender_type;

        return (
          <div key={m.id} className="flex flex-col gap-2">
            {showDate && <DateSeparator isoDate={m.created_at} />}
            <MessageBubble
              message={m}
              perspective={m.sender_type === selfSenderType ? 'self' : 'other'}
              variant={variant}
              showLabel={!prevSameSender || showDate}
            />
          </div>
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
}
