import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { motion } from 'framer-motion';
import type { SupabaseClient } from '@supabase/supabase-js';
import { ChatImage } from './ChatImage';
import { VoiceMessage } from './VoiceMessage';
import { VideoMessage } from './VideoMessage';
import { FileMessage } from './FileMessage';
import { ReadReceiptIndicator } from './ReadReceiptIndicator';
import { QuotedMessage } from './QuotedMessage';
import { MessageContextMenu } from './MessageContextMenu';
import { ReactionPills } from './ReactionPills';
import { cn } from '@/lib/utils';
import type { ChatMessage, ChatMessageReaction } from '@/types/chat';

interface MessageBubbleProps {
  message: ChatMessage;
  perspective: 'self' | 'other';
  variant?: 'client-app' | 'admin-app';
  showLabel?: boolean;
  /** True if this is the last bubble of a same-sender sequence — pour la "queue" */
  isLastInGroup?: boolean;
  quotedMessage?: ChatMessage | null;
  onReply?: (message: ChatMessage) => void;
  onQuoteClick?: (quotedMessageId: string) => void;
  reactions?: ChatMessageReaction[];
  supabaseClient?: SupabaseClient;
  selfReactorId?: string | null;
  selfReactorType?: 'client' | 'admin';
  conversationId?: string | null;
}

export function MessageBubble({
  message,
  perspective,
  variant = 'client-app',
  showLabel = false,
  isLastInGroup = true,
  quotedMessage,
  onReply,
  onQuoteClick,
  reactions = [],
  supabaseClient,
  selfReactorId,
  selfReactorType,
  conversationId,
}: MessageBubbleProps) {
  const { t } = useTranslation('support');
  const isSelf = perspective === 'self';
  const mediaType = message.media_type;

  const label = isSelf
    ? t('bubble.you')
    : message.sender_type === 'admin'
    ? t('bubble.bonziniTeam')
    : t('bubble.you');

  const time = format(new Date(message.created_at), 'HH:mm');

  const isMediaOnly = !!message.media_url && !message.content;
  const isImageOrVideo = mediaType === 'image' || mediaType === 'video';
  const isVoice = mediaType === 'voice';
  const isFile = mediaType === 'file';
  const hasQuote = !!quotedMessage;

  // Padding logique selon le type de contenu
  const bubblePadding = hasQuote
    ? 'px-2 pt-2 pb-2.5'
    : isMediaOnly && isImageOrVideo
    ? 'p-[3px]'
    : isMediaOnly && (isVoice || isFile)
    ? 'p-0'
    : 'px-2.5 py-1.5';

  // Queue uniquement sur la dernière bulle d'une séquence
  const tailRadius = isSelf
    ? isLastInGroup ? 'rounded-2xl rounded-br-md' : 'rounded-2xl'
    : isLastInGroup ? 'rounded-2xl rounded-bl-md' : 'rounded-2xl';

  // Couleurs : tint très léger pour self (à la WhatsApp avec son mint),
  // blanc pur pour other. Pas de gradient.
  const bubbleColors = isSelf
    ? 'bg-[hsl(258_100%_97%)] text-[hsl(258_50%_28%)] dark:bg-[hsl(258_45%_22%)] dark:text-[hsl(258_100%_92%)]'
    : 'bg-background text-foreground';

  const bubble = (
    <div
      className={cn(
        'max-w-[80%] text-[15px] leading-[1.42] tracking-[-0.005em]',
        'shadow-[0_0_0_1px_hsl(var(--border))]',
        bubblePadding,
        tailRadius,
        bubbleColors
      )}
    >
      {quotedMessage && (
        <QuotedMessage
          message={quotedMessage}
          variant="in-bubble"
          accent={isSelf ? 'white' : 'violet'}
          onClick={onQuoteClick ? () => onQuoteClick(quotedMessage.id) : undefined}
        />
      )}

      {mediaType === 'image' && message.media_url && (
        <ChatImage
          path={message.media_url}
          side={message.sender_type}
          variant={variant}
          className={message.content ? 'mb-2' : ''}
        />
      )}
      {mediaType === 'video' && message.media_url && (
        <VideoMessage
          path={message.media_url}
          durationSeconds={message.media_duration_seconds}
          variant={variant}
          className={message.content ? 'mb-2' : ''}
        />
      )}
      {mediaType === 'voice' && message.media_url && (
        <VoiceMessage
          path={message.media_url}
          peaks={message.media_waveform_peaks}
          durationSeconds={message.media_duration_seconds}
          perspective={perspective}
          variant={variant}
        />
      )}
      {mediaType === 'file' && message.media_url && (
        <FileMessage
          path={message.media_url}
          filename={message.media_filename}
          sizeBytes={message.media_size_bytes}
          perspective={perspective}
          variant={variant}
        />
      )}
      {message.content && (
        <p className="m-0 whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
          {message.content}
        </p>
      )}
    </div>
  );

  return (
    <motion.div
      data-message-id={message.id}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: [0.2, 0, 0, 1] }}
      className={cn(
        'flex w-full flex-col gap-0.5 scroll-mt-12',
        isSelf ? 'items-end' : 'items-start'
      )}
    >
      {showLabel && !isSelf && (
        <span className="px-3 pb-0.5 text-[11px] font-medium text-muted-foreground">
          {label}
        </span>
      )}

      {onReply || supabaseClient ? (
        <MessageContextMenu
          message={message}
          side={isSelf ? 'right' : 'left'}
          onReply={onReply ? () => onReply(message) : undefined}
          supabaseClient={supabaseClient}
          selfReactorId={selfReactorId ?? null}
          selfReactorType={selfReactorType}
          conversationId={conversationId ?? null}
          existingReactions={reactions}
        >
          {bubble}
        </MessageContextMenu>
      ) : (
        bubble
      )}

      {reactions.length > 0 && (
        <ReactionPills
          reactions={reactions}
          selfReactorId={selfReactorId ?? null}
          align={isSelf ? 'right' : 'left'}
          supabaseClient={supabaseClient}
          messageId={message.id}
          conversationId={conversationId ?? null}
          selfReactorType={selfReactorType}
        />
      )}

      {isLastInGroup && (
        <div
          className={cn(
            'flex items-center gap-1.5 px-2 mt-0.5',
            isSelf ? 'justify-end' : 'justify-start'
          )}
        >
          <span className="text-[10px] text-muted-foreground tabular-nums">{time}</span>
          {isSelf && <ReadReceiptIndicator readAt={message.read_at} />}
        </div>
      )}
    </motion.div>
  );
}
