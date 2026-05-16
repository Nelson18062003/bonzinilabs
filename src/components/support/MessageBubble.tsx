import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { ChatImage } from './ChatImage';
import { cn } from '@/lib/utils';
import type { ChatMessage } from '@/types/chat';

interface MessageBubbleProps {
  message: ChatMessage;
  // 'self' = bulle alignée à droite avec teinte du sender
  // 'other' = bulle alignée à gauche neutre
  perspective: 'self' | 'other';
  // Pour résoudre les URLs signées avec le bon client Supabase
  variant?: 'client-app' | 'admin-app';
  showLabel?: boolean;
}

export function MessageBubble({
  message,
  perspective,
  variant = 'client-app',
  showLabel = false,
}: MessageBubbleProps) {
  const { t } = useTranslation('support');
  const isSelf = perspective === 'self';

  const label = isSelf
    ? t('bubble.you')
    : message.sender_type === 'admin'
    ? t('bubble.bonziniTeam')
    : t('bubble.you');

  const time = format(new Date(message.created_at), 'HH:mm');

  return (
    <div
      className={cn(
        'flex w-full flex-col gap-1',
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

      <div
        className={cn(
          'max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm shadow-sm',
          isSelf
            ? 'rounded-br-md bg-bonzini-violet text-white'
            : 'rounded-bl-md bg-muted text-foreground',
          // Si c'est uniquement une image, pas de padding
          message.media_url && !message.content && 'overflow-hidden p-1'
        )}
      >
        {message.media_url && (
          <ChatImage
            path={message.media_url}
            side={message.sender_type}
            variant={variant}
            className={message.content ? 'mb-2' : ''}
          />
        )}
        {message.content && (
          <p className="whitespace-pre-wrap break-words leading-relaxed">
            {message.content}
          </p>
        )}
      </div>

      <span
        className={cn(
          'px-2 text-[10px] text-muted-foreground',
          isSelf ? 'text-right' : 'text-left'
        )}
      >
        {time}
      </span>
    </div>
  );
}
