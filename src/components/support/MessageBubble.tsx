import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { ChatImage } from './ChatImage';
import { VoiceMessage } from './VoiceMessage';
import { VideoMessage } from './VideoMessage';
import { FileMessage } from './FileMessage';
import { ReadReceiptIndicator } from './ReadReceiptIndicator';
import { QuotedMessage } from './QuotedMessage';
import { MessageContextMenu } from './MessageContextMenu';
import { cn } from '@/lib/utils';
import type { ChatMessage } from '@/types/chat';

interface MessageBubbleProps {
  message: ChatMessage;
  perspective: 'self' | 'other';
  variant?: 'client-app' | 'admin-app';
  showLabel?: boolean;
  // Message cité (résolu dans le parent pour éviter un fetch par bulle)
  quotedMessage?: ChatMessage | null;
  onReply?: (message: ChatMessage) => void;
  onQuoteClick?: (quotedMessageId: string) => void;
}

export function MessageBubble({
  message,
  perspective,
  variant = 'client-app',
  showLabel = false,
  quotedMessage,
  onReply,
  onQuoteClick,
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

  // Si la bulle a une citation, on doit garder un peu de padding même pour les médias purs
  const hasQuote = !!quotedMessage;

  const bubble = (
    <div
      className={cn(
        'max-w-[80%] rounded-2xl text-sm shadow-sm',
        isSelf
          ? 'rounded-br-md bg-bonzini-violet text-white'
          : 'rounded-bl-md bg-muted text-foreground',
        // Padding logic
        hasQuote
          ? 'px-2 pt-2 pb-2.5'
          : isMediaOnly && isImageOrVideo
          ? 'overflow-hidden p-1'
          : isMediaOnly && isVoice
          ? 'px-2.5 py-1.5'
          : isMediaOnly && isFile
          ? 'p-1'
          : 'px-3.5 py-2.5'
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
        <p className="whitespace-pre-wrap break-words leading-relaxed">
          {message.content}
        </p>
      )}
    </div>
  );

  return (
    <div
      data-message-id={message.id}
      className={cn(
        'flex w-full flex-col gap-1 scroll-mt-12',
        isSelf ? 'items-end' : 'items-start'
      )}
    >
      {showLabel && (
        <span
          className={cn(
            'px-2 text-[10px] font-semibold uppercase tracking-wider',
            isSelf ? 'text-bonzini-violet' : 'text-bonzini-orange'
          )}
        >
          {label}
        </span>
      )}

      {onReply ? (
        <MessageContextMenu
          message={message}
          side={isSelf ? 'right' : 'left'}
          onReply={() => onReply(message)}
        >
          {bubble}
        </MessageContextMenu>
      ) : (
        bubble
      )}

      <div className={cn('flex items-center gap-2 px-2', isSelf ? 'justify-end' : 'justify-start')}>
        <span className="text-[10px] text-muted-foreground">{time}</span>
        {isSelf && <ReadReceiptIndicator readAt={message.read_at} />}
      </div>
    </div>
  );
}
