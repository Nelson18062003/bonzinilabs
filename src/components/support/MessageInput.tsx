import { useRef, useState, KeyboardEvent, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { ImagePlus, Send, Loader2, Plus, Video, FileText, X } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { VoiceRecorder, type VoiceBlobPayload } from './VoiceRecorder';
import { QuotedMessage } from './QuotedMessage';
import type { ChatMessage } from '@/types/chat';

interface MessageInputProps {
  onSendText: (text: string) => Promise<void> | void;
  onSendImage: (file: File) => Promise<void> | void;
  onSendVoice?: (payload: VoiceBlobPayload) => Promise<void> | void;
  onSendVideo?: (file: File) => Promise<void> | void;
  onSendFile?: (file: File) => Promise<void> | void;
  onTextChange?: (value: string) => void;
  // Reply : si défini, on affiche la preview au-dessus de l'input et on inclut
  // le reply_to_message_id à l'envoi (géré côté parent via les callbacks).
  replyTo?: ChatMessage | null;
  onCancelReply?: () => void;
  disabled?: boolean;
  className?: string;
}

const VIDEO_MIME = 'video/mp4,video/quicktime';
const FILE_MIME = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/msword',
  'application/vnd.ms-excel',
  '.pdf',
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
].join(',');

export function MessageInput({
  onSendText,
  onSendImage,
  onSendVoice,
  onSendVideo,
  onSendFile,
  onTextChange,
  replyTo,
  onCancelReply,
  disabled = false,
  className,
}: MessageInputProps) {
  const { t } = useTranslation('support');
  const [text, setText] = useState('');
  const [sendingText, setSendingText] = useState(false);
  const [sendingMedia, setSendingMedia] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const sending = sendingText || sendingMedia;
  const hasText = text.trim().length > 0;
  const canSend = hasText && text.length <= 2000 && !sending && !disabled;

  const handleSend = useCallback(async () => {
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
      onTextChange?.('');
    } catch (e) {
      toast.error(t('errors.sendFailed'));
      console.error(e);
    } finally {
      setSendingText(false);
    }
  }, [text, onSendText, onTextChange, t]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    const isMobile = /Mobi|Android/i.test(navigator.userAgent);
    if (!isMobile && e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  // Génère un handler générique pour les uploads (image/video/file)
  const makeUploadHandler = useCallback(
    (
      onSend: (file: File) => Promise<void> | void,
      errorKeyByName: (name?: string) => string
    ) => async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      e.target.value = '';
      setMenuOpen(false);
      setSendingMedia(true);
      try {
        await onSend(file);
      } catch (err) {
        const errName = (err as Error)?.message ?? '';
        toast.error(errorKeyByName(errName));
        console.error(err);
      } finally {
        setSendingMedia(false);
      }
    },
    []
  );

  const handleImageChange = makeUploadHandler(onSendImage, (msg = '') => {
    if (msg.includes('Format')) return t('errors.imageWrongFormat');
    if (msg.includes('volumineuse') || msg.includes('large')) return t('errors.imageTooLarge');
    return t('errors.sendFailed');
  });

  const handleVideoChange = onSendVideo
    ? makeUploadHandler(onSendVideo, (msg = '') => {
        if (msg.includes('Format')) return t('errors.videoWrongFormat');
        if (msg.includes('volumineuse')) return t('errors.videoTooLarge');
        if (msg.includes('longue') || msg.includes('invalide')) return t('errors.videoTooLong');
        return t('errors.sendFailed');
      })
    : undefined;

  const handleFileChange = onSendFile
    ? makeUploadHandler(onSendFile, (msg = '') => {
        if (msg.includes('Format')) return t('errors.fileWrongFormat');
        if (msg.includes('volumineux')) return t('errors.fileTooLarge');
        return t('errors.sendFailed');
      })
    : undefined;

  const handleVoice = onSendVoice
    ? async (payload: VoiceBlobPayload) => {
        setSendingMedia(true);
        try {
          await onSendVoice(payload);
        } catch (err) {
          toast.error(t('errors.sendFailed'));
          console.error(err);
        } finally {
          setSendingMedia(false);
        }
      }
    : undefined;

  return (
    <div
      className={cn(
        'flex flex-col border-t border-border bg-background/95 backdrop-blur',
        className
      )}
    >
      {replyTo && (
        <div className="px-3 pt-2.5">
          <QuotedMessage
            message={replyTo}
            variant="in-input"
            onCancel={onCancelReply}
          />
        </div>
      )}
      <div className="relative flex items-end gap-2 p-3">
      <input
        ref={imageInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        className="hidden"
        onChange={handleImageChange}
      />
      {handleVideoChange && (
        <input
          ref={videoInputRef}
          type="file"
          accept={VIDEO_MIME}
          capture="environment"
          className="hidden"
          onChange={handleVideoChange}
        />
      )}
      {handleFileChange && (
        <input
          ref={fileInputRef}
          type="file"
          accept={FILE_MIME}
          className="hidden"
          onChange={handleFileChange}
        />
      )}

      {/* Bouton "+" qui ouvre un mini menu vidéo + fichier (+ photo direct) */}
      <div className="relative shrink-0">
        <button
          type="button"
          onClick={() => setMenuOpen((o) => !o)}
          disabled={sending || disabled}
          className={cn(
            'flex h-10 w-10 items-center justify-center rounded-full',
            'bg-bonzini-amber/15 text-bonzini-amber transition-colors',
            'hover:bg-bonzini-amber/25 active:scale-95',
            'disabled:opacity-50'
          )}
          aria-label={t('input.attachMenu')}
        >
          {menuOpen ? <X className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
        </button>

        {menuOpen && (
          <div className="absolute bottom-12 left-0 z-20 flex w-48 flex-col gap-1 rounded-2xl border border-border bg-popover p-1.5 shadow-lg">
            <MenuButton
              icon={ImagePlus}
              label={t('input.sendImage')}
              onClick={() => {
                setMenuOpen(false);
                imageInputRef.current?.click();
              }}
            />
            {handleVideoChange && (
              <MenuButton
                icon={Video}
                label={t('input.sendVideo')}
                onClick={() => {
                  setMenuOpen(false);
                  videoInputRef.current?.click();
                }}
              />
            )}
            {handleFileChange && (
              <MenuButton
                icon={FileText}
                label={t('input.sendFile')}
                onClick={() => {
                  setMenuOpen(false);
                  fileInputRef.current?.click();
                }}
              />
            )}
          </div>
        )}
      </div>

      {/* Voice recorder ou textarea (le recorder remplace TOUTE l'input zone pendant l'enregistrement) */}
      {handleVoice && !hasText ? (
        <div className="flex flex-1 items-end gap-2">
          <TextZone
            text={text}
            setText={setText}
            onTextChange={onTextChange}
            onKeyDown={handleKeyDown}
            sending={sending}
            disabled={disabled}
            t={t}
          />
          <VoiceRecorder onSend={handleVoice} disabled={sending || disabled} />
        </div>
      ) : (
        <TextZone
          text={text}
          setText={setText}
          onTextChange={onTextChange}
          onKeyDown={handleKeyDown}
          sending={sending}
          disabled={disabled}
          t={t}
        />
      )}

      {hasText && (
        <button
          type="button"
          onClick={() => void handleSend()}
          disabled={!canSend}
          className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition',
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
      )}
      </div>
    </div>
  );
}

interface MenuButtonProps {
  icon: React.ElementType;
  label: string;
  onClick: () => void;
}
function MenuButton({ icon: Icon, label, onClick }: MenuButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm hover:bg-muted"
    >
      <Icon className="h-4 w-4 text-bonzini-violet" />
      <span>{label}</span>
    </button>
  );
}

interface TextZoneProps {
  text: string;
  setText: (s: string) => void;
  onTextChange?: (s: string) => void;
  onKeyDown: (e: KeyboardEvent<HTMLTextAreaElement>) => void;
  sending: boolean;
  disabled: boolean;
  t: (key: string) => string;
}
function TextZone({ text, setText, onTextChange, onKeyDown, sending, disabled, t }: TextZoneProps) {
  return (
    <div className="flex flex-1 items-end rounded-2xl border border-border bg-background pl-3 pr-1.5 py-1.5">
      {/* eslint-disable-next-line no-restricted-syntax */}
      <textarea
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          onTextChange?.(e.target.value);
        }}
        onKeyDown={onKeyDown}
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
    </div>
  );
}
