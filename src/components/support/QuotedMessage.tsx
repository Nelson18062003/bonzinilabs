import { useTranslation } from 'react-i18next';
import { X, Image, Mic, Video, FileText, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ChatMessage } from '@/types/chat';

interface QuotedMessageProps {
  message: ChatMessage;
  variant: 'in-bubble' | 'in-input';
  accent?: 'violet' | 'white';
  onCancel?: () => void;
  onClick?: () => void;
  className?: string;
}

export function QuotedMessage({
  message,
  variant,
  accent = 'violet',
  onCancel,
  onClick,
  className,
}: QuotedMessageProps) {
  const { t } = useTranslation('support');

  const senderLabel =
    message.sender_type === 'admin' ? t('bubble.bonziniTeam') : t('bubble.you');

  const Icon = mediaIcon(message.media_type);
  const preview = previewText(message, t);

  // En in-bubble : on adapte au fond de la bulle parent
  // En in-input : background subtil violet
  const bgClass = variant === 'in-bubble'
    ? accent === 'white'
      ? 'bg-white/20'
      : 'bg-muted/60 dark:bg-muted/40'
    : '';

  const barClass = variant === 'in-bubble' && accent === 'white'
    ? 'bg-white/70'
    : 'bg-bonzini-violet';

  const content = (
    <div
      className={cn(
        'flex items-stretch gap-2 overflow-hidden rounded-lg pr-2',
        bgClass,
        variant === 'in-bubble' ? 'mb-1.5' : '',
        className
      )}
    >
      <div className={cn('w-[3px] shrink-0 rounded-l-lg', barClass)} />
      <div className="min-w-0 flex-1 py-1.5">
        <p
          className={cn(
            'truncate text-[11px] font-semibold',
            variant === 'in-bubble' && accent === 'white' ? 'text-white/90' : 'text-bonzini-violet'
          )}
        >
          {senderLabel}
        </p>
        <p className="flex items-center gap-1 truncate text-xs opacity-80">
          {Icon && <Icon className="h-3 w-3 shrink-0" />}
          <span className="truncate">{preview}</span>
        </p>
      </div>
      {variant === 'in-input' && onCancel && (
        <button
          type="button"
          onClick={onCancel}
          className="flex shrink-0 items-center justify-center self-center rounded-full p-1.5 text-muted-foreground hover:bg-muted"
          aria-label="Cancel reply"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );

  if (variant === 'in-bubble' && onClick) {
    return (
      <button type="button" onClick={onClick} className="w-full text-left">
        {content}
      </button>
    );
  }

  return content;
}

function mediaIcon(type: ChatMessage['media_type']) {
  if (type === 'image') return Image;
  if (type === 'voice') return Mic;
  if (type === 'video') return Video;
  if (type === 'file') return FileText;
  return MessageSquare;
}

function previewText(message: ChatMessage, t: (k: string) => string): string {
  if (message.content) {
    return message.content.length > 60
      ? message.content.slice(0, 57) + '…'
      : message.content;
  }
  if (message.media_type === 'image') return t('quoted.image');
  if (message.media_type === 'voice') return t('quoted.voice');
  if (message.media_type === 'video') return t('quoted.video');
  if (message.media_type === 'file') return message.media_filename || t('quoted.file');
  return '';
}
