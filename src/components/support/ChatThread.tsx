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
  conversationId?: string | null;
  clientForReactions?: SupabaseClient;
  selfReactorId?: string | null;
  selfReactorType?: 'client' | 'admin';
  onQuickReply?: (content: string) => void;
  /** Si défini, affiche un indicateur "X écrit…" tout en bas (intégré au flux,
   *  ne fait pas bouger l'input bar). */
  typingIndicatorSlot?: React.ReactNode;
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
  typingIndicatorSlot,
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
      <div className={cn('flex flex-1 items-center justify-center', className)}>
        {emptyState ?? <EmptyChatState onQuickReply={onQuickReply} />}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={cn('flex flex-col gap-[2px] px-3 py-3', className)}
    >
      {messages.map((m, i) => {
        const prev = messages[i - 1];
        const next = messages[i + 1];
        const showDate =
          !prev || !isSameDay(new Date(prev.created_at), new Date(m.created_at));
        const prevSameSender = prev && prev.sender_type === m.sender_type && !showDate;
        const nextSameSender = next && next.sender_type === m.sender_type
          && isSameDay(new Date(next.created_at), new Date(m.created_at));
        const quoted = m.reply_to_message_id
          ? messagesById.get(m.reply_to_message_id) ?? null
          : null;

        const item = (
          <MessageBubble
            message={m}
            perspective={m.sender_type === selfSenderType ? 'self' : 'other'}
            variant={variant}
            showLabel={!prevSameSender}
            isLastInGroup={!nextSameSender}
            quotedMessage={quoted}
            onReply={onReply}
            onQuoteClick={scrollToMessage}
            reactions={reactionsByMsg.get(m.id) ?? []}
            supabaseClient={clientForReactions}
            selfReactorId={selfReactorId ?? null}
            selfReactorType={selfReactorType}
            conversationId={conversationId ?? null}
          />
        );

        // Marge un peu plus large entre groupes (= changement de sender)
        const marginClass = !nextSameSender ? 'mb-2' : '';

        return (
          <div key={m.id} className={cn('flex flex-col gap-[2px]', marginClass)}>
            {showDate && <DateSeparator isoDate={m.created_at} />}
            {item}
          </div>
        );
      })}
      {/* Typing indicator intégré au flux pour éviter de faire bouger
          l'input bar. Reste tout en bas, juste avant le scroll anchor. */}
      {typingIndicatorSlot}
      <div ref={bottomRef} />
    </div>
  );
}
