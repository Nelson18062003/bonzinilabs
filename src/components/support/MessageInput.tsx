import { useRef, useState, KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { ImagePlus, Send, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface MessageInputProps {
  onSendText: (text: string) => Promise<void> | void;
  onSendImage: (file: File) => Promise<void> | void;
  disabled?: boolean;
  className?: string;
}

export function MessageInput({
  onSendText,
  onSendImage,
  disabled = false,
  className,
}: MessageInputProps) {
  const { t } = useTranslation('support');
  const [text, setText] = useState('');
  const [sendingText, setSendingText] = useState(false);
  const [sendingImage, setSendingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const sending = sendingText || sendingImage;
  const canSend = text.trim().length > 0 && text.length <= 2000 && !sending && !disabled;

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    if (trimmed.length > 2000) {
      toast.error(t('errors.messageTooLong'));
      return;
    }
    setSendingText(true);
    try {
      await onSendText(trimmed);
      setText('');
    } catch (e) {
      toast.error(t('errors.sendFailed'));
      console.error(e);
    } finally {
      setSendingText(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Desktop: Enter = send, Shift+Enter = newline
    // Mobile: laisse Enter = newline (le bouton envoyer s'occupe d'envoyer)
    const isMobile = /Mobi|Android/i.test(navigator.userAgent);
    if (!isMobile && e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  const handlePickImage = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Reset input pour pouvoir reuploader la même image plus tard
    e.target.value = '';

    setSendingImage(true);
    try {
      await onSendImage(file);
    } catch (err) {
      const msg = (err as Error)?.message ?? '';
      if (msg.includes('Format')) {
        toast.error(t('errors.imageWrongFormat'));
      } else if (msg.includes('volumineuse') || msg.includes('large')) {
        toast.error(t('errors.imageTooLarge'));
      } else {
        toast.error(t('errors.sendFailed'));
      }
      console.error(err);
    } finally {
      setSendingImage(false);
    }
  };

  return (
    <div
      className={cn(
        'flex items-end gap-2 border-t border-border bg-background/95 p-3 backdrop-blur',
        className
      )}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        className="hidden"
        onChange={handleFileChange}
      />

      <button
        type="button"
        onClick={handlePickImage}
        disabled={sending || disabled}
        className={cn(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-full',
          'bg-bonzini-amber/15 text-bonzini-amber transition-colors',
          'hover:bg-bonzini-amber/25 active:scale-95',
          'disabled:opacity-50'
        )}
        aria-label={t('input.sendImage')}
      >
        {sendingImage ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <ImagePlus className="h-5 w-5" />
        )}
      </button>

      <div className="flex flex-1 items-end rounded-2xl border border-border bg-background pl-3 pr-1.5 py-1.5">
        {/* Embedded chat input — raw textarea is the right primitive here.
            Font is text-base (16px) to avoid iOS Safari auto-zoom. */}
        {/* eslint-disable-next-line no-restricted-syntax */}
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t('input.placeholder')}
          rows={1}
          maxLength={2000}
          disabled={sending || disabled}
          className={cn(
            'min-h-[36px] max-h-32 w-full resize-none bg-transparent py-1 text-base leading-snug',
            'placeholder:text-muted-foreground focus:outline-none'
          )}
          onInput={(e) => {
            const target = e.currentTarget;
            target.style.height = 'auto';
            target.style.height = Math.min(target.scrollHeight, 128) + 'px';
          }}
        />
        <button
          type="button"
          onClick={() => void handleSend()}
          disabled={!canSend}
          className={cn(
            'ml-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition',
            canSend
              ? 'bg-bonzini-violet text-white hover:bg-bonzini-violet/90 active:scale-95'
              : 'bg-muted text-muted-foreground'
          )}
          aria-label={t('input.send')}
        >
          {sendingText ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </button>
      </div>
    </div>
  );
}
